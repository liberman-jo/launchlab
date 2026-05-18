const router  = require("express").Router();
const requireAuth = require("../middleware/auth");
const prisma  = require("../lib/prisma");

// GET /api/integrations/:businessId — list integration status
router.get("/:businessId", requireAuth, async (req, res, next) => {
  try {
    const business = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!business) return res.status(404).json({ error: "Business not found" });
    const integrations = await prisma.integration.findMany({ where: { businessId: req.params.businessId } });
    res.json({ integrations });
  } catch (e) { next(e); }
});

// POST /api/integrations/:businessId/stripe — initiate Stripe Connect
router.post("/:businessId/stripe", requireAuth, async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Stripe not configured. Add STRIPE_SECRET_KEY to .env" });
    }
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const account = await stripe.accounts.create({ type: "express" });

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CLIENT_URL}/hub/${req.params.businessId}?tab=settings`,
      return_url:  `${process.env.CLIENT_URL}/hub/${req.params.businessId}?tab=settings&stripe=connected`,
      type: "account_onboarding",
    });

    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: req.params.businessId, provider: "stripe" } },
      update: { metadata: JSON.stringify({ accountId: account.id }), status: "pending" },
      create: { businessId: req.params.businessId, provider: "stripe", status: "pending", metadata: JSON.stringify({ accountId: account.id }) },
    });

    res.json({ url: link.url });
  } catch (e) { next(e); }
});

// POST /api/integrations/:businessId/:provider/disconnect
router.post("/:businessId/:provider/disconnect", requireAuth, async (req, res, next) => {
  try {
    const business = await prisma.business.findFirst({ where: { id: req.params.businessId, userId: req.userId } });
    if (!business) return res.status(404).json({ error: "Business not found" });

    await prisma.integration.updateMany({
      where: { businessId: req.params.businessId, provider: req.params.provider },
      data: { status: "disconnected", accessToken: null, refreshToken: null },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
// GET /api/integrations/google/auth?businessId=xxx
router.get("/google/auth", requireAuth, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID to .env" });
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",     process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri",  process.env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         "https://www.googleapis.com/auth/business.manage email profile");
  url.searchParams.set("state",         req.query.businessId || "");
  res.json({ url: url.toString() });
});

// GET /api/integrations/google/callback
router.get("/google/callback", async (req, res, next) => {
  try {
    const { code, state: businessId } = req.query;
    if (!code) return res.redirect(`${process.env.CLIENT_URL}?error=google_auth_failed`);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description);

    if (businessId) {
      await prisma.integration.upsert({
        where:  { businessId_provider: { businessId, provider: "google" } },
        update: { status: "connected", accessToken: tokens.access_token, refreshToken: tokens.refresh_token || null },
        create: { businessId, provider: "google", status: "connected", accessToken: tokens.access_token, refreshToken: tokens.refresh_token || null },
      });
    }
    res.redirect(`${process.env.CLIENT_URL}/hub/${businessId}?tab=settings&google=connected`);
  } catch (e) { next(e); }
});

module.exports = router;
