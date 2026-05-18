require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const path       = require("path");
const rateLimit  = require("express-rate-limit");
const prisma = require("./lib/prisma");

const authRoutes     = require("./routes/auth");
const businessRoutes = require("./routes/business");
const taskRoutes     = require("./routes/tasks");
const generateRoutes = require("./routes/generate");
const integRoutes    = require("./routes/integrations");
const reportsRoutes  = require("./routes/reports");
const leadsRoutes    = require("./routes/leads");
const autoRoutes     = require("./routes/automation");
const webhookRoutes  = require("./routes/webhooks");
const scheduler      = require("./lib/scheduler");

const app    = express();
const PORT   = process.env.PORT || 3001;

const IS_PROD = process.env.NODE_ENV === "production";

// ── MIDDLEWARE ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));

// Webhooks need raw body for signature verification — mount BEFORE express.json()
app.use("/api/webhooks", webhookRoutes);

// All other routes get parsed JSON
app.use(express.json({ limit: "10mb" }));

// Rate limiting for AI endpoints
const aiLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: "Too many requests. Please wait a moment." } });

// ── ROUTES ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/businesses",   businessRoutes);
app.use("/api/tasks",        taskRoutes);
app.use("/api/generate",     aiLimiter, generateRoutes);
app.use("/api/integrations", integRoutes);
app.use("/api/reports",      reportsRoutes);
app.use("/api/leads",        leadsRoutes);
app.use("/api/automation",   autoRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── SERVE FRONTEND IN PRODUCTION ──────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, "../client/dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

// ── ERROR HANDLER ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

// ── START ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`LaunchLab server running on http://localhost:${PORT}`);
      scheduler.start();
    });
  } catch (e) {
    console.error("Failed to start:", e);
    process.exit(1);
  }
}

start();
module.exports = { app, prisma };
