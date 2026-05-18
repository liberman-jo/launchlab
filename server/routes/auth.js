const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const requireAuth = require("../middleware/auth");

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, goal } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "email, password, and name are required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: "An account with this email already exists" });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: { email: email.toLowerCase(), password: hashed, name, goal: goal || null },
      select: { id: true, email: true, name: true, goal: true, createdAt: true },
    });

    res.status(201).json({ token: makeToken(user.id), user });
  } catch (e) { next(e); }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const { password: _, ...safe } = user;
    res.json({ token: makeToken(user.id), user: safe });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, goal: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) { next(e); }
});

// PUT /api/auth/me
router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { name, goal } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, goal },
      select: { id: true, email: true, name: true, goal: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

module.exports = router;
