const router      = require("express").Router();
const requireAuth = require("../middleware/auth");
const prisma      = require("../lib/prisma");
const ai = require("../services/ai");

// POST /api/generate/ideas
router.post("/ideas", requireAuth, async (req, res, next) => {
  try {
    const { intake } = req.body;
    if (!intake?.location) return res.status(400).json({ error: "intake.location is required" });
    const ideas = await ai.generateIdeas(intake);
    res.json({ ideas });
  } catch (e) { next(e); }
});

// POST /api/generate/tasks
router.post("/tasks", requireAuth, async (req, res, next) => {
  try {
    const { idea, intake, businessId } = req.body;
    if (!idea || !intake) return res.status(400).json({ error: "idea and intake are required" });

    const tasks = await ai.generateTasks(idea, intake);

    // If businessId provided, save to DB
    if (businessId) {
      const business = await prisma.business.findFirst({ where: { id: businessId, userId: req.userId } });
      if (business) {
        await prisma.task.deleteMany({ where: { businessId } });
        await Promise.all(tasks.map((t, i) => prisma.task.create({
          data: {
            businessId,
            name: t.name, category: t.category || "Operations",
            description: t.description || "",
            estimatedTime: t.estimatedTime || "—", estimatedCost: t.estimatedCost || "—",
            canAutomate: !!t.canAutomate,
            steps: JSON.stringify(t.steps || []),
            mode: t.canAutomate ? "auto" : "guided",
            sortOrder: i,
          },
        })));
      }
    }

    res.json({ tasks });
  } catch (e) { next(e); }
});

// POST /api/generate/website
router.post("/website", requireAuth, async (req, res, next) => {
  try {
    const { businessId } = req.body;
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: req.userId },
    });
    if (!business) return res.status(404).json({ error: "Business not found" });

    const idea   = JSON.parse(business.ideaData   || "{}");
    const intake = JSON.parse(business.intakeData  || "{}");
    const html   = await ai.generateWebsite(business, idea, intake);

    // Upsert into BusinessOutput
    const existing = await prisma.businessOutput.findFirst({ where: { businessId, type: "website" } });
    let output;
    if (existing) {
      output = await prisma.businessOutput.update({ where: { id: existing.id }, data: { content: html } });
    } else {
      output = await prisma.businessOutput.create({ data: { businessId, type: "website", title: business.name + " — Website", content: html } });
    }
    res.json({ output });
  } catch (e) { next(e); }
});

// POST /api/generate/business-plan
router.post("/business-plan", requireAuth, async (req, res, next) => {
  try {
    const { businessId } = req.body;
    const business = await prisma.business.findFirst({ where: { id: businessId, userId: req.userId } });
    if (!business) return res.status(404).json({ error: "Business not found" });

    const idea   = JSON.parse(business.ideaData  || "{}");
    const intake = JSON.parse(business.intakeData || "{}");
    const html   = await ai.generateBusinessPlan(business, idea, intake);

    const existing = await prisma.businessOutput.findFirst({ where: { businessId, type: "business_plan" } });
    let output;
    if (existing) {
      output = await prisma.businessOutput.update({ where: { id: existing.id }, data: { content: html } });
    } else {
      output = await prisma.businessOutput.create({ data: { businessId, type: "business_plan", title: business.name + " — Business Plan", content: html } });
    }
    res.json({ output });
  } catch (e) { next(e); }
});

// POST /api/generate/social-content
router.post("/social-content", requireAuth, async (req, res, next) => {
  try {
    const { businessId } = req.body;
    const business = await prisma.business.findFirst({ where: { id: businessId, userId: req.userId } });
    if (!business) return res.status(404).json({ error: "Business not found" });

    const idea   = JSON.parse(business.ideaData  || "{}");
    const intake = JSON.parse(business.intakeData || "{}");
    const data   = await ai.generateSocialContent(business, idea, intake);

    const existing = await prisma.businessOutput.findFirst({ where: { businessId, type: "social_content" } });
    const content  = JSON.stringify(data, null, 2);
    let output;
    if (existing) {
      output = await prisma.businessOutput.update({ where: { id: existing.id }, data: { content } });
    } else {
      output = await prisma.businessOutput.create({ data: { businessId, type: "social_content", title: business.name + " — Social Content", content } });
    }
    res.json({ output, data });
  } catch (e) { next(e); }
});

// POST /api/generate/email-templates
router.post("/email-templates", requireAuth, async (req, res, next) => {
  try {
    const { businessId } = req.body;
    const business = await prisma.business.findFirst({ where: { id: businessId, userId: req.userId } });
    if (!business) return res.status(404).json({ error: "Business not found" });

    const idea = JSON.parse(business.ideaData || "{}");
    const data = await ai.generateEmailTemplates(business, idea);

    const existing = await prisma.businessOutput.findFirst({ where: { businessId, type: "email_templates" } });
    const content  = JSON.stringify(data, null, 2);
    let output;
    if (existing) {
      output = await prisma.businessOutput.update({ where: { id: existing.id }, data: { content } });
    } else {
      output = await prisma.businessOutput.create({ data: { businessId, type: "email_templates", title: business.name + " — Email Templates", content } });
    }
    res.json({ output, data });
  } catch (e) { next(e); }
});

// POST /api/generate/chat — AI guide chat
router.post("/chat", requireAuth, async (req, res, next) => {
  try {
    const { message, businessId } = req.body;
    let context = {};
    if (businessId) {
      const business = await prisma.business.findFirst({ where: { id: businessId, userId: req.userId } });
      if (business) context = { name: business.name, location: business.location, idea: JSON.parse(business.ideaData || "{}") };
    }
    const reply = await ai.chatResponse(message, context);
    res.json({ reply });
  } catch (e) { next(e); }
});

module.exports = router;
