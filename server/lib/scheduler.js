"use strict";
const prisma = require("./prisma");
const { generateManagementReport, generateMarketingReport, seoOptimizeWebsite } = require("../services/ai");
const { runLeadGeneration, runOutreach, runClientDeliverables } = require("../services/outreach");
const { dispatchPost } = require("../services/social");
const { deployToNetlify } = require("../services/deploy");

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ONE_DAY_MS  = 24 * 60 * 60 * 1000;

function safeJSON(str, fb = {}) {
  try { return JSON.parse(str || "{}") || fb; } catch { return fb; }
}

function olderThan(isoStr, ms) {
  if (!isoStr) return true;
  return Date.now() - new Date(isoStr).getTime() > ms;
}

async function makeLogger(businessId) {
  return async (type, description, status = "done") => {
    try {
      await prisma.automationLog.create({ data: { businessId, type, description, status } });
    } catch {}
  };
}

async function runBusinessJobs(business) {
  const autoMode = safeJSON(business.autoMode, {});
  const isFullAuto = Object.values(autoMode).some(v => v === "Full auto");
  if (!isFullAuto) return;

  const creds  = safeJSON(business.autoCredentials, null);
  const idea   = safeJSON(business.ideaData, {});
  const intake = safeJSON(business.intakeData, {});
  const log    = await makeLogger(business.id);

  // ── 1. Daily Management Report ─────────────────────────────────────────────
  if (autoMode.management === "Full auto") {
    const lastMgmt = await prisma.automationLog.findFirst({
      where: { businessId: business.id, type: "management_report" },
      orderBy: { createdAt: "desc" },
    });
    if (olderThan(lastMgmt?.createdAt, ONE_DAY_MS)) {
      try {
        const financials   = await prisma.financialEntry.findMany({ where: { businessId: business.id }, orderBy: { date: "desc" } });
        const integrations = await prisma.integration.findMany({ where: { businessId: business.id } });
        const report       = await generateManagementReport(business, idea, intake, financials, integrations);
        await prisma.businessOutput.upsert({
          where:  { businessId_type: { businessId: business.id, type: "management_report" } },
          update: { content: JSON.stringify(report), title: "Management Report" },
          create: { businessId: business.id, type: "management_report", title: "Management Report", content: JSON.stringify(report) },
        });
        await log("management_report", `Daily management report generated — Health Score: ${report.healthScore}/10`);
      } catch (e) { await log("management_report", `Management report failed: ${e.message}`, "error"); }
    }
  }

  // ── 2. Daily Marketing Report ──────────────────────────────────────────────
  if (autoMode.marketing === "Full auto") {
    const lastMktg = await prisma.automationLog.findFirst({
      where: { businessId: business.id, type: "marketing_report" },
      orderBy: { createdAt: "desc" },
    });
    if (olderThan(lastMktg?.createdAt, ONE_DAY_MS)) {
      try {
        const integrations = await prisma.integration.findMany({ where: { businessId: business.id } });
        const tasks        = await prisma.task.findMany({ where: { businessId: business.id } });
        const report       = await generateMarketingReport(business, idea, intake, integrations, tasks);
        await prisma.businessOutput.upsert({
          where:  { businessId_type: { businessId: business.id, type: "marketing_report" } },
          update: { content: JSON.stringify(report), title: "Marketing Report" },
          create: { businessId: business.id, type: "marketing_report", title: "Marketing Report", content: JSON.stringify(report) },
        });
        await log("marketing_report", `Daily marketing report generated — Growth Score: ${report.growthScore}/10`);
      } catch (e) { await log("marketing_report", `Marketing report failed: ${e.message}`, "error"); }
    }

    // ── 3. Auto SEO optimize website (weekly) ─────────────────────────────
    const lastSEO = await prisma.automationLog.findFirst({
      where: { businessId: business.id, type: "seo_optimize" },
      orderBy: { createdAt: "desc" },
    });
    if (olderThan(lastSEO?.createdAt, 7 * ONE_DAY_MS)) {
      try {
        const websiteOut = await prisma.businessOutput.findFirst({ where: { businessId: business.id, type: "website" } });
        if (websiteOut) {
          const improved = await seoOptimizeWebsite(websiteOut.content, business, idea);
          await prisma.businessOutput.update({ where: { id: websiteOut.id }, data: { content: improved, title: business.name + " — Website (SEO Optimized)" } });
          await log("seo_optimize", `Website automatically SEO-optimized — meta tags, schema.org, and keywords improved`);
        }
      } catch (e) { await log("seo_optimize", `SEO optimization failed: ${e.message}`, "error"); }
    }
  }

  // ── 4. Lead Generation (runs regardless of which agent is full auto) ───────
  try {
    await runLeadGeneration(business, idea, intake, log);
  } catch (e) { await log("lead_generation", `Lead generation failed: ${e.message}`, "error"); }

  // ── 5. Cold Email Outreach ─────────────────────────────────────────────────
  if (creds?.emailUser && creds?.emailPass) {
    try {
      await runOutreach(business, idea, creds, log);
    } catch (e) { await log("outreach_email", `Outreach failed: ${e.message}`, "error"); }
  }

  // ── 6. Client Deliverables ─────────────────────────────────────────────────
  try {
    await runClientDeliverables(business, idea, intake, creds, log);
  } catch (e) { await log("client_deliverable", `Deliverable generation failed: ${e.message}`, "error"); }

  // ── 7. Social Media Auto-Posting ──────────────────────────────────────────
  if (autoMode.marketing === "Full auto") {
    try {
      await runSocialPosting(business, creds, log);
    } catch (e) { await log("social_post", `Social posting failed: ${e.message}`, "error"); }
  }

  // ── 8. Auto Website Deploy ────────────────────────────────────────────────
  if (creds?.netlifyToken && creds?.netlifySiteId) {
    try {
      await runWebsiteDeploy(business, creds, log);
    } catch (e) { await log("website_deploy", `Website deploy failed: ${e.message}`, "error"); }
  }
}

async function runSocialPosting(business, creds, log) {
  const hasSocial = creds?.fbPageId || creds?.igUserId || creds?.linkedInUrn || creds?.twitterApiKey;
  if (!hasSocial) return;

  // Find today's post(s) from the social calendar based on business age
  const socialOut = await prisma.businessOutput.findFirst({ where: { businessId: business.id, type: "social_content" } });
  if (!socialOut) return;

  let calendar;
  try { calendar = JSON.parse(socialOut.content); } catch { return; }
  const posts = calendar.posts || [];
  if (!posts.length) return;

  // Calculate which day we're on since business creation
  const dayAge = Math.floor((Date.now() - new Date(business.createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Check if we already posted today
  const todayStr = new Date().toISOString().slice(0, 10);
  const alreadyPosted = await prisma.automationLog.findFirst({
    where: { businessId: business.id, type: "social_post" },
    orderBy: { createdAt: "desc" },
  });
  if (alreadyPosted && alreadyPosted.createdAt.slice(0, 10) === todayStr) return;

  // Find post for today's day
  const todayPost = posts.find(p => p.day === dayAge) || posts[dayAge % posts.length];
  if (!todayPost) return;

  const results = await dispatchPost(todayPost.caption, todayPost.hashtags, creds);
  const succeeded = results.filter(r => r.ok).map(r => r.platform).join(", ");
  const failed    = results.filter(r => !r.ok).map(r => `${r.platform}: ${r.error}`).join(", ");

  if (succeeded) await log("social_post", `Day ${dayAge} post published to: ${succeeded} — "${todayPost.caption.slice(0, 60)}..."`);
  if (failed)    await log("social_post", `Social post failed on: ${failed}`, "error");
}

async function runWebsiteDeploy(business, creds, log) {
  // Only deploy if website was updated since last deploy
  const websiteOut = await prisma.businessOutput.findFirst({ where: { businessId: business.id, type: "website" } });
  if (!websiteOut) return;

  const lastDeploy = await prisma.automationLog.findFirst({
    where: { businessId: business.id, type: "website_deploy" },
    orderBy: { createdAt: "desc" },
  });

  const websiteUpdated = new Date(websiteOut.updatedAt || websiteOut.createdAt).getTime();
  const lastDeployTime = lastDeploy ? new Date(lastDeploy.createdAt).getTime() : 0;
  if (websiteUpdated <= lastDeployTime) return; // no changes since last deploy

  const { url } = await deployToNetlify(creds.netlifySiteId, creds.netlifyToken, websiteOut.content);
  await log("website_deploy", `Website auto-deployed to Netlify — live at ${url}`);
}

async function runAllJobs() {
  try {
    const businesses = await prisma.business.findMany({});
    for (const biz of businesses) {
      await runBusinessJobs(biz).catch(e => console.error(`[Scheduler] Error for ${biz.id}:`, e.message));
    }
  } catch (e) { console.error("[Scheduler] Fatal error:", e.message); }
}

function start() {
  console.log(`[Scheduler] Starting — checking every ${INTERVAL_MS / 60000} minutes`);
  setTimeout(() => {
    runAllJobs();
    setInterval(runAllJobs, INTERVAL_MS);
  }, 30000); // wait 30s after boot before first run
}

module.exports = { start, runAllJobs, runBusinessJobs };
