const router     = require("express").Router();
const requireAuth = require("../middleware/auth");
const prisma     = require("../lib/prisma");
const { generateLeads } = require("../services/ai");
const { runBusinessJobs } = require("../lib/scheduler");

async function ownsBiz(businessId, userId) {
  return prisma.business.findFirst({ where: { id: businessId, userId } });
}

// GET /api/leads/:businessId
router.get("/:businessId", requireAuth, async (req, res, next) => {
  try {
    const biz = await ownsBiz(req.params.businessId, req.userId);
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const leads = await prisma.lead.findMany({ where: { businessId: req.params.businessId }, orderBy: { createdAt: "desc" } });
    res.json({ leads: leads.map(l => ({ ...l, deliverableData: (() => { try { return JSON.parse(l.deliverableData || "{}"); } catch { return {}; } })() })) });
  } catch (e) { next(e); }
});

// POST /api/leads/:businessId/generate — generate new leads with AI
router.post("/:businessId/generate", requireAuth, async (req, res, next) => {
  try {
    const biz = await ownsBiz(req.params.businessId, req.userId);
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const idea   = (() => { try { return JSON.parse(biz.ideaData   || "{}"); } catch { return {}; } })();
    const intake = (() => { try { return JSON.parse(biz.intakeData || "{}"); } catch { return {}; } })();
    const existing = await prisma.lead.findMany({ where: { businessId: biz.id } });
    const existingNames = existing.map(l => l.name);
    const newLeads = await generateLeads(biz, idea, intake, existingNames);
    if (!Array.isArray(newLeads)) return res.status(500).json({ error: "Failed to generate leads" });
    const created = [];
    for (const ld of newLeads.slice(0, 8)) {
      if (!ld.name) continue;
      const l = await prisma.lead.create({ data: { ...ld, businessId: biz.id } });
      created.push({ ...l, deliverableData: {} });
    }
    res.json({ leads: created });
  } catch (e) { next(e); }
});

// PUT /api/leads/:businessId/:leadId — update status, add notes, etc.
router.put("/:businessId/:leadId", requireAuth, async (req, res, next) => {
  try {
    const biz = await ownsBiz(req.params.businessId, req.userId);
    if (!biz) return res.status(404).json({ error: "Business not found" });
    const { status, notes, contactEmail, contactPhone, repliedAt, convertedAt } = req.body;
    const updated = await prisma.lead.update({
      where: { id: req.params.leadId },
      data: {
        ...(status       !== undefined && { status }),
        ...(notes        !== undefined && { notes }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(repliedAt    !== undefined && { repliedAt }),
        ...(convertedAt  !== undefined && { convertedAt: status === "client" ? new Date().toISOString() : convertedAt }),
      },
    });
    res.json({ lead: { ...updated, deliverableData: (() => { try { return JSON.parse(updated?.deliverableData || "{}"); } catch { return {}; } })() } });
  } catch (e) { next(e); }
});

// DELETE /api/leads/:businessId/:leadId
router.delete("/:businessId/:leadId", requireAuth, async (req, res, next) => {
  try {
    const biz = await ownsBiz(req.params.businessId, req.userId);
    if (!biz) return res.status(404).json({ error: "Business not found" });
    await prisma.lead.delete({ where: { id: req.params.leadId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
