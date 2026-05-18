"use strict";
const router  = require("express").Router();
const crypto  = require("crypto");
const prisma  = require("../lib/prisma");
const { sendEmail } = require("../services/outreach");

function safeJSON(str, fb = {}) {
  try { return JSON.parse(str || "{}") || fb; } catch { return fb; }
}

// Capture raw body before JSON parse (needed for HMAC signature verification)
function rawBodyMiddleware(req, res, next) {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", chunk => { data += chunk; });
  req.on("end", () => {
    req.rawBody = data;
    try { req.body = JSON.parse(data || "{}"); } catch { req.body = {}; }
    next();
  });
}

// ── POST /api/webhooks/calendly/:businessId ────────────────────────────────────
router.post("/calendly/:businessId", rawBodyMiddleware, async (req, res) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });

    // Verify Calendly signature (optional — only if secret is configured)
    const creds = safeJSON(biz.autoCredentials);
    if (creds.calendlyWebhookSecret) {
      const sigHeader = req.headers["calendly-webhook-signature"] || "";
      const parts     = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
      if (parts.t && parts.v1) {
        const expected = crypto.createHmac("sha256", creds.calendlyWebhookSecret)
          .update(`${parts.t}.${req.rawBody}`)
          .digest("hex");
        if (expected !== parts.v1) return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const { event, payload } = req.body;
    if (!event || !payload) return res.json({ ok: true });

    if (event === "invitee.created") {
      await handleBooking(biz, creds, payload);
    } else if (event === "invitee.canceled") {
      await handleCancellation(biz, payload);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[Calendly webhook]", e.message);
    res.status(500).json({ error: e.message });
  }
});

async function handleBooking(biz, creds, payload) {
  const invitee   = payload.invitee || {};
  const eventType = payload.event_type?.name || "Consultation";
  const name      = invitee.name || "Unknown";
  const email     = invitee.email || null;
  const startTime = payload.scheduled_event?.start_time;

  await prisma.automationLog.create({
    data: {
      businessId:  biz.id,
      type:        "calendly_booking",
      description: `New booking: ${name}${email ? ` (${email})` : ""} — ${eventType}${startTime ? ` at ${new Date(startTime).toLocaleString()}` : ""}`,
      status:      "done",
    },
  });

  // Upsert as a lead
  const existing = email
    ? await prisma.lead.findFirst({ where: { businessId: biz.id, contactEmail: email } })
    : null;

  let lead;
  if (existing) {
    const wasContacted = ["new","emailed"].includes(existing.status);
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data:  {
        status: wasContacted ? "responded" : existing.status,
        notes:  (existing.notes || "") + `\nBooked: ${eventType} on ${startTime ? new Date(startTime).toLocaleDateString() : "TBD"}`,
      },
    });
  } else {
    lead = await prisma.lead.create({
      data: {
        businessId:   biz.id,
        name,
        businessType: eventType,
        contactEmail: email,
        status:       "responded",
        notes:        `Booked via Calendly: ${eventType}${startTime ? ` on ${new Date(startTime).toLocaleDateString()}` : ""}`,
      },
    });
  }

  // Auto-send a warm confirmation email
  if (creds?.emailUser && creds?.emailPass && email) {
    try {
      await sendEmail(
        creds,
        email,
        `Looking forward to meeting you, ${name.split(" ")[0]}!`,
        `Hi ${name.split(" ")[0]},\n\nThank you for booking a ${eventType} with ${biz.name}!\n\nWe are excited to speak with you${startTime ? ` on ${new Date(startTime).toLocaleString()}` : ""}.\n\nTo make the most of our time together, feel free to reply with a brief description of your current situation and what you are hoping to achieve.\n\nSee you soon!\n\n— ${biz.name}`,
        biz.name
      );
      await prisma.automationLog.create({
        data: { businessId: biz.id, type: "outreach_email", description: `Auto-sent booking confirmation to ${name} (${email})`, status: "done" },
      });
    } catch {}
  }
}

async function handleCancellation(biz, payload) {
  const invitee = payload.invitee || {};
  const name    = invitee.name || "Unknown";
  const email   = invitee.email || null;

  await prisma.automationLog.create({
    data: {
      businessId:  biz.id,
      type:        "calendly_booking",
      description: `Cancelled: ${name}${email ? ` (${email})` : ""} cancelled their booking`,
      status:      "done",
    },
  });

  if (email) {
    const lead = await prisma.lead.findFirst({ where: { businessId: biz.id, contactEmail: email } });
    if (lead && ["responded","new","emailed"].includes(lead.status)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data:  { status: "new", notes: (lead.notes || "") + "\nCancelled their booking." },
      });
    }
  }
}

module.exports = router;
