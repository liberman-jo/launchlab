const router      = require("express").Router();
const requireAuth = require("../middleware/auth");
const prisma      = require("../lib/prisma");

// GET /api/businesses — list user's businesses
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const businesses = await prisma.business.findMany({
      where: { userId: req.userId },
      include: { tasks: { orderBy: { sortOrder: "asc" } }, outputs: true, integrations: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ businesses });
  } catch (e) { next(e); }
});

// POST /api/businesses — create a new business
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, tagline, location, budget, hoursPerWeek, ideaData, intakeData } = req.body;
    if (!name || !location) return res.status(400).json({ error: "name and location are required" });

    const business = await prisma.business.create({
      data: {
        userId: req.userId,
        name, tagline: tagline || "",
        location,
        budget: parseFloat(budget) || 0,
        hoursPerWeek: parseInt(hoursPerWeek) || 0,
        ideaData:   JSON.stringify(ideaData   || {}),
        intakeData: JSON.stringify(intakeData || {}),
      },
      include: { tasks: true, outputs: true, integrations: true },
    });
    res.status(201).json({ business });
  } catch (e) { next(e); }
});

// GET /api/businesses/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const business = await prisma.business.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { tasks: { orderBy: { sortOrder: "asc" } }, outputs: true, integrations: true },
    });
    if (!business) return res.status(404).json({ error: "Business not found" });
    res.json({ business });
  } catch (e) { next(e); }
});

// PUT /api/businesses/:id — update business fields
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.business.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: "Business not found" });

    const { name, tagline, location, budget, hoursPerWeek, status, ideaData, intakeData } = req.body;
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: {
        ...(name          !== undefined && { name }),
        ...(tagline       !== undefined && { tagline }),
        ...(location      !== undefined && { location }),
        ...(budget        !== undefined && { budget: parseFloat(budget) }),
        ...(hoursPerWeek  !== undefined && { hoursPerWeek: parseInt(hoursPerWeek) }),
        ...(status        !== undefined && { status }),
        ...(ideaData      !== undefined && { ideaData: JSON.stringify(ideaData) }),
        ...(intakeData    !== undefined && { intakeData: JSON.stringify(intakeData) }),
      },
      include: { tasks: { orderBy: { sortOrder: "asc" } }, outputs: true, integrations: true },
    });
    res.json({ business });
  } catch (e) { next(e); }
});

// DELETE /api/businesses/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.business.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: "Business not found" });
    await prisma.business.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/businesses/:id/outputs — get generated outputs
router.get("/:id/outputs", requireAuth, async (req, res, next) => {
  try {
    const business = await prisma.business.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!business) return res.status(404).json({ error: "Business not found" });
    const outputs = await prisma.businessOutput.findMany({ where: { businessId: req.params.id }, orderBy: { createdAt: "desc" } });
    res.json({ outputs });
  } catch (e) { next(e); }
});

module.exports = router;
