const router     = require("express").Router();
const requireAuth = require("../middleware/auth");
const prisma     = require("../lib/prisma");
const { runBusinessJobs } = require("../lib/scheduler");
const { dispatchPost }    = require("../services/social");
const { deployToNetlify, testNetlifyCredentials } = require("../services/deploy");

// GET /api/automation/:businessId/logs
router.get("/:businessId/logs", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const logs = await prisma.automationLog.findMany({
      where: { businessId: req.params.businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ logs });
  } catch (e) { next(e); }
});

// POST /api/automation/:businessId/run — trigger a manual auto-cycle
router.post("/:businessId/run", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    // Run async, respond immediately
    runBusinessJobs(biz).catch(e => console.error("[Automation] manual run error:", e.message));
    res.json({ ok: true, message: "Automation cycle started" });
  } catch (e) { next(e); }
});

// PUT /api/automation/:businessId/mode — save automation mode to DB
router.put("/:businessId/mode", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const { autoMode } = req.body;
    const updated = await prisma.business.update({ where: { id: biz.id }, data: { autoMode: JSON.stringify(autoMode) } });
    res.json({ autoMode: JSON.parse(updated.autoMode || "{}") });
  } catch (e) { next(e); }
});

// PUT /api/automation/:businessId/credentials — save all automation credentials
router.put("/:businessId/credentials", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });

    // Merge new values over existing saved creds (so partial saves don't wipe unrelated fields)
    let existing = {};
    try { existing = JSON.parse(biz.autoCredentials || "{}"); } catch {}

    const incoming = req.body;
    const merged = { ...existing, ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== undefined && v !== null)) };
    // Ensure defaults
    if (!merged.smtpHost) merged.smtpHost = "smtp.gmail.com";
    if (!merged.smtpPort) merged.smtpPort = 587;

    await prisma.business.update({ where: { id: biz.id }, data: { autoCredentials: JSON.stringify(merged) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/automation/:businessId/test-post — send a test social post right now
router.post("/:businessId/test-post", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const creds   = (() => { try { return JSON.parse(biz.autoCredentials || "{}"); } catch { return {}; } })();
    const { caption, hashtags } = req.body;
    if (!caption) return res.status(400).json({ error: "caption is required" });
    const results = await dispatchPost(caption, hashtags || [], creds);
    res.json({ results });
  } catch (e) { next(e); }
});

// POST /api/automation/:businessId/deploy — manually trigger a website deploy
router.post("/:businessId/deploy", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const creds = (() => { try { return JSON.parse(biz.autoCredentials || "{}"); } catch { return {}; } })();
    if (!creds.netlifyToken || !creds.netlifySiteId) return res.status(400).json({ error: "Netlify credentials not configured" });
    const websiteOut = await prisma.businessOutput.findFirst({ where: { businessId: biz.id, type: "website" } });
    if (!websiteOut) return res.status(404).json({ error: "No website found — generate one first" });
    const result = await deployToNetlify(creds.netlifySiteId, creds.netlifyToken, websiteOut.content);
    await prisma.automationLog.create({ data: { businessId: biz.id, type: "website_deploy", description: `Website manually deployed to Netlify — live at ${result.url}` } });
    res.json({ url: result.url });
  } catch (e) { next(e); }
});

// POST /api/automation/:businessId/test-netlify — validate Netlify credentials
router.post("/:businessId/test-netlify", requireAuth, async (req, res, next) => {
  try {
    const { netlifyToken, netlifySiteId } = req.body;
    const info = await testNetlifyCredentials(netlifySiteId, netlifyToken);
    res.json({ ok: true, siteName: info.name, siteUrl: info.url });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/automation/:businessId/logs — clear log history
router.delete("/:businessId/logs", requireAuth, async (req, res, next) => {
  try {
    const biz = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!biz) return res.status(404).json({ error: "Business not found" });
    await prisma.automationLog.deleteMany({ where: { businessId: req.params.businessId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
