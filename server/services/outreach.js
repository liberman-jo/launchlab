const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { generateLeads, composeOutreachEmail, generateClientDeliverables } = require("./ai");

function safeJSON(str, fallback) {
  try { return JSON.parse(str || "{}") || fallback; } catch { return fallback; }
}

function createTransport(creds) {
  return nodemailer.createTransport({
    host:   creds.smtpHost || "smtp.gmail.com",
    port:   Number(creds.smtpPort) || 587,
    secure: false,
    auth:   { user: creds.emailUser, pass: creds.emailPass },
    tls:    { rejectUnauthorized: false },
  });
}

async function sendEmail(creds, to, subject, body, fromName) {
  const transport = createTransport(creds);
  await transport.sendMail({
    from:    `"${fromName}" <${creds.emailUser}>`,
    to,
    subject,
    text:    body,
    html:    `<pre style="font-family:sans-serif;white-space:pre-wrap;max-width:600px">${body}</pre>`,
  });
}

async function runLeadGeneration(business, idea, intake, log) {
  const existing = await prisma.lead.findMany({ where: { businessId: business.id } });
  if (existing.length >= 20) return 0; // enough leads

  const existingNames = existing.map(l => l.name);
  const newLeads = await generateLeads(business, idea, intake, existingNames);
  if (!Array.isArray(newLeads)) return 0;

  let created = 0;
  for (const ld of newLeads.slice(0, 8)) {
    if (!ld.name) continue;
    await prisma.lead.create({ data: { ...ld, businessId: business.id } });
    created++;
  }

  if (created > 0) {
    await log("lead_generation", `Generated ${created} new potential client leads in ${business.location}`);
  }
  return created;
}

async function runOutreach(business, idea, creds, log) {
  if (!creds?.emailUser || !creds?.emailPass) return 0;

  const unsent = await prisma.lead.findMany({
    where: { businessId: business.id, status: "new" },
    orderBy: { createdAt: "asc" },
  });
  const toSend = unsent.filter(l => !l.emailSentAt && l.contactEmail).slice(0, 3);
  if (toSend.length === 0) return 0;

  let sent = 0;
  for (const lead of toSend) {
    try {
      const { subject, body } = await composeOutreachEmail(lead, business, idea);
      await sendEmail(creds, lead.contactEmail, subject, body, business.name);
      await prisma.lead.update({
        where: { id: lead.id },
        data:  { status: "emailed", emailSentAt: new Date().toISOString(), emailSubject: subject, emailBody: body },
      });
      await log("outreach_email", `Sent cold email to ${lead.name} (${lead.contactEmail}) — subject: "${subject}"`);
      sent++;
    } catch (e) {
      await log("outreach_email", `Failed to email ${lead.name}: ${e.message}`, "error");
    }
  }
  return sent;
}

async function runClientDeliverables(business, idea, intake, creds, log) {
  const clients = await prisma.lead.findMany({
    where: { businessId: business.id, status: "client" },
  });
  const needsWork = clients.filter(c => {
    const d = safeJSON(c.deliverableData, {});
    return !d.generated;
  });

  let done = 0;
  for (const client of needsWork.slice(0, 2)) {
    try {
      const { website, social, emails } = await generateClientDeliverables(client, business, idea, intake);
      const deliverableData = { generated: true, generatedAt: new Date().toISOString(), website, social, emails };
      await prisma.lead.update({ where: { id: client.id }, data: { deliverableData } });
      await log("client_deliverable", `Auto-generated website + social calendar + email templates for client: ${client.name}`);

      // Email the deliverables to the client if credentials available and contact email exists
      if (creds?.emailUser && creds?.emailPass && client.contactEmail) {
        try {
          await sendEmail(creds, client.contactEmail,
            `Your ${business.name} deliverables are ready`,
            `Hi ${client.name} team,\n\nYour digital assets are ready:\n\n• Custom website (HTML file attached)\n• 30-day social media calendar\n• Professional email templates\n\nPlease reply and we will send the full files.\n\nBest,\n${business.name}`,
            business.name
          );
          await log("client_delivery", `Emailed deliverable notification to ${client.name} (${client.contactEmail})`);
        } catch {}
      }
      done++;
    } catch (e) {
      await log("client_deliverable", `Failed to generate deliverables for ${client.name}: ${e.message}`, "error");
    }
  }
  return done;
}

module.exports = { runLeadGeneration, runOutreach, runClientDeliverables, sendEmail };
