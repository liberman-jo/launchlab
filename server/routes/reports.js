const router     = require("express").Router();
const rateLimit  = require("express-rate-limit");
const requireAuth = require("../middleware/auth");
const prisma     = require("../lib/prisma");
const { generateManagementReport, generateMarketingReport, seoOptimizeWebsite, generateSocialPost } = require("../services/ai");

const aiLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: "Too many requests. Please wait a moment." } });

// ── FINANCES ──────────────────────────────────────────────────────────────────

router.get("/:businessId/finances", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const entries = await prisma.financialEntry.findMany({ where: { businessId: req.params.businessId }, orderBy: { date: "desc" } });
    res.json({ entries });
  } catch (e) { next(e); }
});

router.post("/:businessId/finances", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const { type, category, amount, description, date } = req.body;
    if (!type || !amount || !date) return res.status(400).json({ error: "type, amount, and date are required" });
    const entry = await prisma.financialEntry.create({
      data: { businessId: req.params.businessId, type, category: category || "Other", amount: Number(amount), description: description || "", date }
    });
    res.json({ entry });
  } catch (e) { next(e); }
});

router.delete("/:businessId/finances/:entryId", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    await prisma.financialEntry.delete({ where: { id: req.params.entryId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── MANAGEMENT REPORT ─────────────────────────────────────────────────────────

router.post("/:businessId/management-report", aiLimiter, requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const idea        = (() => { try { return JSON.parse(biz.ideaData || "{}"); } catch { return {}; } })();
    const intake      = (() => { try { return JSON.parse(biz.intakeData || "{}"); } catch { return {}; } })();
    const financials  = await prisma.financialEntry.findMany({ where: { businessId: biz.id }, orderBy: { date: "desc" } });
    const integrations = await prisma.integration.findMany({ where: { businessId: biz.id } });

    const report = await generateManagementReport(biz, idea, intake, financials, integrations);

    await prisma.businessOutput.upsert({
      where:  { businessId_type: { businessId: biz.id, type: "management_report" } },
      update: { content: JSON.stringify(report), title: "Management Report" },
      create: { businessId: biz.id, type: "management_report", title: "Management Report", content: JSON.stringify(report) },
    });

    res.json({ report });
  } catch (e) { next(e); }
});

// ── MARKETING REPORT ──────────────────────────────────────────────────────────

router.post("/:businessId/marketing-report", aiLimiter, requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const idea        = (() => { try { return JSON.parse(biz.ideaData || "{}"); } catch { return {}; } })();
    const intake      = (() => { try { return JSON.parse(biz.intakeData || "{}"); } catch { return {}; } })();
    const integrations = await prisma.integration.findMany({ where: { businessId: biz.id } });
    const tasks       = await prisma.task.findMany({ where: { businessId: biz.id } });

    const report = await generateMarketingReport(biz, idea, intake, integrations, tasks);

    await prisma.businessOutput.upsert({
      where:  { businessId_type: { businessId: biz.id, type: "marketing_report" } },
      update: { content: JSON.stringify(report), title: "Marketing Report" },
      create: { businessId: biz.id, type: "marketing_report", title: "Marketing Report", content: JSON.stringify(report) },
    });

    res.json({ report });
  } catch (e) { next(e); }
});

// ── SEO OPTIMIZE WEBSITE ──────────────────────────────────────────────────────

router.post("/:businessId/seo-optimize", aiLimiter, requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const websiteOutput = await prisma.businessOutput.findFirst({ where: { businessId: biz.id, type: "website" } });
    if (!websiteOutput) return res.status(404).json({ error: "No website found. Generate a website first." });

    const idea = (() => { try { return JSON.parse(biz.ideaData || "{}"); } catch { return {}; } })();
    const improved = await seoOptimizeWebsite(websiteOutput.content, biz, idea);

    const updated = await prisma.businessOutput.update({
      where: { id: websiteOutput.id },
      data: { content: improved, title: biz.name + " — Website (SEO Optimized)" },
    });

    res.json({ output: updated });
  } catch (e) { next(e); }
});

// ── SOCIAL POST GENERATOR ─────────────────────────────────────────────────────

router.post("/:businessId/social-post", aiLimiter, requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const { platform = "Instagram", postType = "promotional" } = req.body;
    const idea = (() => { try { return JSON.parse(biz.ideaData || "{}"); } catch { return {}; } })();
    const post = await generateSocialPost(biz, idea, platform, postType);
    res.json({ post });
  } catch (e) { next(e); }
});

module.exports = router;
