"use strict";
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// ── Open DB ────────────────────────────────────────────────────────────────────
function dbPath() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const p = url.replace(/^file:/, "");
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

const db = new DatabaseSync(dbPath());
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

// ── Schema ─────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    goal TEXT,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS "Business" (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tagline TEXT DEFAULT '',
    location TEXT NOT NULL,
    budget REAL NOT NULL DEFAULT 0,
    hoursPerWeek INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'setup',
    ideaData TEXT NOT NULL DEFAULT '{}',
    intakeData TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updatedAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_biz_user ON "Business"(userId);

  CREATE TABLE IF NOT EXISTS "Task" (
    id TEXT PRIMARY KEY,
    businessId TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Operations',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    mode TEXT NOT NULL DEFAULT 'auto',
    estimatedTime TEXT DEFAULT '—',
    estimatedCost TEXT DEFAULT '—',
    canAutomate INTEGER NOT NULL DEFAULT 0,
    steps TEXT NOT NULL DEFAULT '[]',
    outputData TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updatedAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_task_biz ON "Task"(businessId);

  CREATE TABLE IF NOT EXISTS "BusinessOutput" (
    id TEXT PRIMARY KEY,
    businessId TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updatedAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_out_biz ON "BusinessOutput"(businessId);

  CREATE TABLE IF NOT EXISTS "Integration" (
    id TEXT PRIMARY KEY,
    businessId TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    accessToken TEXT,
    refreshToken TEXT,
    metadata TEXT,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updatedAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(businessId, provider)
  );

  CREATE TABLE IF NOT EXISTS "FinancialEntry" (
    id TEXT PRIMARY KEY,
    businessId TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'income',
    category TEXT NOT NULL DEFAULT 'Other',
    amount REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_fin_biz ON "FinancialEntry"(businessId);

  CREATE TABLE IF NOT EXISTS "Lead" (
    id TEXT PRIMARY KEY,
    businessId TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    businessType TEXT NOT NULL DEFAULT '',
    contactEmail TEXT,
    contactPhone TEXT,
    location TEXT NOT NULL DEFAULT '',
    website TEXT,
    estimatedSize TEXT DEFAULT 'small',
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT DEFAULT '',
    pitch TEXT DEFAULT '',
    emailSubject TEXT DEFAULT '',
    emailBody TEXT DEFAULT '',
    emailSentAt TEXT,
    repliedAt TEXT,
    convertedAt TEXT,
    deliverableData TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_lead_biz ON "Lead"(businessId);

  CREATE TABLE IF NOT EXISTS "AutomationLog" (
    id TEXT PRIMARY KEY,
    businessId TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'done',
    meta TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_autolog_biz ON "AutomationLog"(businessId);
`);

// Add columns to existing DBs that may not have them
["autoMode TEXT DEFAULT '{}'", "autoCredentials TEXT DEFAULT '{}'"].forEach(col => {
  try { db.exec(`ALTER TABLE "Business" ADD COLUMN ${col}`); } catch {}
});

// ── Helpers ────────────────────────────────────────────────────────────────────
const newId  = () => uuidv4().replace(/-/g, "").slice(0, 25);
const now    = () => new Date().toISOString();

// Flatten Prisma-style compound where keys: {businessId_provider: {businessId, provider}} → {businessId, provider}
function flatWhere(where = {}) {
  const flat = {};
  for (const [k, v] of Object.entries(where)) {
    if (k.includes("_") && v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(flat, v);
    } else {
      flat[k] = v;
    }
  }
  return flat;
}

function buildWhere(where) {
  const flat = flatWhere(where);
  const keys = Object.keys(flat);
  const conditions = keys.map(k => `"${k}" = ?`);
  const values     = Object.values(flat);
  return { conditions, values };
}

function applySelect(row, select) {
  if (!select || !row) return row;
  return Object.fromEntries(Object.entries(select).filter(([, v]) => v).map(([k]) => [k, row[k]]));
}

function loadBizIncludes(biz, include) {
  if (!include || !biz) return biz;
  if (include.tasks !== undefined) {
    const ob = (typeof include.tasks === "object" && include.tasks.orderBy) || { sortOrder: "asc" };
    const [[col, dir]] = Object.entries(ob);
    biz.tasks = db.prepare(`SELECT * FROM "Task" WHERE "businessId" = ? ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`).all(biz.id);
  }
  if (include.outputs !== undefined) {
    biz.outputs = db.prepare(`SELECT * FROM "BusinessOutput" WHERE "businessId" = ? ORDER BY createdAt DESC`).all(biz.id);
  }
  if (include.integrations !== undefined) {
    biz.integrations = db.prepare(`SELECT * FROM "Integration" WHERE "businessId" = ?`).all(biz.id);
  }
  return biz;
}

function loadTaskIncludes(task, include) {
  if (!include || !task) return task;
  if (include.business) {
    task.business = db.prepare(`SELECT * FROM "Business" WHERE id = ?`).get(task.businessId) || null;
  }
  return task;
}

// ── Models ─────────────────────────────────────────────────────────────────────

const user = {
  async findUnique({ where, select }) {
    const { conditions, values } = buildWhere(where);
    const row = db.prepare(`SELECT * FROM "User" WHERE ${conditions.join(" AND ")} LIMIT 1`).get(...values);
    return applySelect(row, select) || null;
  },
  async create({ data, select }) {
    const id = newId();
    db.prepare(`INSERT INTO "User" (id, email, password, name, goal, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, data.email, data.password, data.name, data.goal ?? null, now());
    const row = db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(id);
    return applySelect(row, select);
  },
  async update({ where, data, select }) {
    const { conditions, values: wv } = buildWhere(where);
    const allowed = ["name", "goal"];
    const sets = allowed.filter(k => k in data).map(k => `"${k}" = ?`);
    const vals = allowed.filter(k => k in data).map(k => data[k]);
    if (sets.length) {
      db.prepare(`UPDATE "User" SET ${sets.join(", ")} WHERE ${conditions.join(" AND ")}`).run(...vals, ...wv);
    }
    const row = db.prepare(`SELECT * FROM "User" WHERE ${conditions.join(" AND ")} LIMIT 1`).get(...wv);
    return applySelect(row, select) || null;
  },
};

const business = {
  async findMany({ where = {}, include, orderBy } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["createdAt", "desc"]] = Object.entries(orderBy || { createdAt: "desc" });
    const sql = conditions.length
      ? `SELECT * FROM "Business" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`
      : `SELECT * FROM "Business" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`;
    const rows = db.prepare(sql).all(...values);
    return rows.map(r => loadBizIncludes(r, include));
  },
  async findFirst({ where = {}, include } = {}) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length
      ? `SELECT * FROM "Business" WHERE ${conditions.join(" AND ")} LIMIT 1`
      : `SELECT * FROM "Business" LIMIT 1`;
    const row = db.prepare(sql).get(...values);
    return loadBizIncludes(row || null, include);
  },
  async create({ data, include }) {
    const id  = newId();
    const ts  = now();
    db.prepare(`INSERT INTO "Business" (id, userId, name, tagline, location, budget, hoursPerWeek, ideaData, intakeData, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, data.userId, data.name, data.tagline ?? "", data.location, data.budget ?? 0, data.hoursPerWeek ?? 0, data.ideaData ?? "{}", data.intakeData ?? "{}", ts, ts);
    const row = db.prepare(`SELECT * FROM "Business" WHERE id = ?`).get(id);
    if (include) { row.tasks = []; row.outputs = []; row.integrations = []; }
    return row;
  },
  async update({ where, data, include }) {
    const allowed = ["name", "tagline", "location", "budget", "hoursPerWeek", "status", "ideaData", "intakeData", "autoMode", "autoCredentials"];
    const sets = [...allowed.filter(k => k in data).map(k => `"${k}" = ?`), `"updatedAt" = ?`];
    const vals = [...allowed.filter(k => k in data).map(k => data[k]), now()];
    const { conditions, values: wv } = buildWhere(where);
    db.prepare(`UPDATE "Business" SET ${sets.join(", ")} WHERE ${conditions.join(" AND ")}`).run(...vals, ...wv);
    return business.findFirst({ where, include });
  },
  async delete({ where }) {
    const { conditions, values } = buildWhere(where);
    db.prepare(`DELETE FROM "Business" WHERE ${conditions.join(" AND ")}`).run(...values);
    return { ok: true };
  },
  async findUnique({ where, include }) {
    return business.findFirst({ where, include });
  },
};

const task = {
  async findMany({ where = {}, orderBy } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["sortOrder", "asc"]] = Object.entries(orderBy || { sortOrder: "asc" });
    const sql = conditions.length
      ? `SELECT * FROM "Task" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`
      : `SELECT * FROM "Task" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`;
    return db.prepare(sql).all(...values);
  },
  async findFirst({ where = {}, include } = {}) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length
      ? `SELECT * FROM "Task" WHERE ${conditions.join(" AND ")} LIMIT 1`
      : `SELECT * FROM "Task" LIMIT 1`;
    const row = db.prepare(sql).get(...values);
    return loadTaskIncludes(row || null, include);
  },
  async create({ data }) {
    const id = newId();
    const ts = now();
    db.prepare(`INSERT INTO "Task" (id, businessId, name, category, description, status, mode, estimatedTime, estimatedCost, canAutomate, steps, outputData, sortOrder, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, data.businessId, data.name, data.category ?? "Operations", data.description ?? "", data.status ?? "pending", data.mode ?? "manual", data.estimatedTime ?? "—", data.estimatedCost ?? "—", data.canAutomate ? 1 : 0, data.steps ?? "[]", data.outputData ?? null, data.sortOrder ?? 99, ts, ts);
    return db.prepare(`SELECT * FROM "Task" WHERE id = ?`).get(id);
  },
  async update({ where, data }) {
    const allowed = ["name", "description", "mode", "status", "outputData", "steps", "sortOrder"];
    const sets = [...allowed.filter(k => k in data).map(k => `"${k}" = ?`), `"updatedAt" = ?`];
    const vals = [...allowed.filter(k => k in data).map(k => data[k]), now()];
    if ("canAutomate" in data) { sets.splice(-1, 0, `"canAutomate" = ?`); vals.splice(-1, 0, data.canAutomate ? 1 : 0); }
    const { conditions, values: wv } = buildWhere(where);
    db.prepare(`UPDATE "Task" SET ${sets.join(", ")} WHERE ${conditions.join(" AND ")}`).run(...vals, ...wv);
    return task.findFirst({ where });
  },
  async delete({ where }) {
    const { conditions, values } = buildWhere(where);
    db.prepare(`DELETE FROM "Task" WHERE ${conditions.join(" AND ")}`).run(...values);
    return { ok: true };
  },
  async deleteMany({ where = {} }) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length ? `DELETE FROM "Task" WHERE ${conditions.join(" AND ")}` : `DELETE FROM "Task"`;
    db.prepare(sql).run(...values);
    return { count: -1 };
  },
};

const businessOutput = {
  async findFirst({ where = {} }) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length
      ? `SELECT * FROM "BusinessOutput" WHERE ${conditions.join(" AND ")} LIMIT 1`
      : `SELECT * FROM "BusinessOutput" LIMIT 1`;
    return db.prepare(sql).get(...values) || null;
  },
  async findMany({ where = {}, orderBy } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["createdAt", "desc"]] = Object.entries(orderBy || { createdAt: "desc" });
    const sql = conditions.length
      ? `SELECT * FROM "BusinessOutput" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`
      : `SELECT * FROM "BusinessOutput" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`;
    return db.prepare(sql).all(...values);
  },
  async create({ data }) {
    const id = data.id || newId();
    const ts = now();
    db.prepare(`INSERT INTO "BusinessOutput" (id, businessId, type, title, content, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`)
      .run(id, data.businessId, data.type, data.title, data.content, ts, ts);
    return db.prepare(`SELECT * FROM "BusinessOutput" WHERE id = ?`).get(id);
  },
  async update({ where, data }) {
    const allowed = ["content", "title", "type"];
    const sets = [...allowed.filter(k => k in data).map(k => `"${k}" = ?`), `"updatedAt" = ?`];
    const vals = [...allowed.filter(k => k in data).map(k => data[k]), now()];
    const { conditions, values: wv } = buildWhere(where);
    db.prepare(`UPDATE "BusinessOutput" SET ${sets.join(", ")} WHERE ${conditions.join(" AND ")}`).run(...vals, ...wv);
    return businessOutput.findFirst({ where });
  },
  async upsert({ where, update, create }) {
    const existing = await businessOutput.findFirst({ where });
    if (existing) return businessOutput.update({ where: { id: existing.id }, data: update });
    return businessOutput.create({ data: create });
  },
};

const integration = {
  async findMany({ where = {} } = {}) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length
      ? `SELECT * FROM "Integration" WHERE ${conditions.join(" AND ")}`
      : `SELECT * FROM "Integration"`;
    return db.prepare(sql).all(...values);
  },
  async findFirst({ where = {} } = {}) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length
      ? `SELECT * FROM "Integration" WHERE ${conditions.join(" AND ")} LIMIT 1`
      : `SELECT * FROM "Integration" LIMIT 1`;
    return db.prepare(sql).get(...values) || null;
  },
  async upsert({ where, update, create }) {
    const existing = await integration.findFirst({ where });
    if (existing) {
      const sets = [...Object.keys(update).map(k => `"${k}" = ?`), `"updatedAt" = ?`];
      const vals = [...Object.values(update), now()];
      db.prepare(`UPDATE "Integration" SET ${sets.join(", ")} WHERE id = ?`).run(...vals, existing.id);
      return db.prepare(`SELECT * FROM "Integration" WHERE id = ?`).get(existing.id);
    }
    const id = newId(); const ts = now();
    db.prepare(`INSERT INTO "Integration" (id, businessId, provider, status, accessToken, refreshToken, metadata, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, create.businessId, create.provider, create.status ?? "disconnected", create.accessToken ?? null, create.refreshToken ?? null, create.metadata ?? null, ts, ts);
    return db.prepare(`SELECT * FROM "Integration" WHERE id = ?`).get(id);
  },
  async updateMany({ where, data }) {
    const { conditions, values: wv } = buildWhere(where);
    if (!conditions.length) return { count: 0 };
    const sets = [...Object.keys(data).map(k => `"${k}" = ?`), `"updatedAt" = ?`];
    const vals = [...Object.values(data), now()];
    db.prepare(`UPDATE "Integration" SET ${sets.join(", ")} WHERE ${conditions.join(" AND ")}`).run(...vals, ...wv);
    return { count: 1 };
  },
};

const lead = {
  async findMany({ where = {}, orderBy } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["createdAt", "desc"]] = Object.entries(orderBy || { createdAt: "desc" });
    const sql = conditions.length
      ? `SELECT * FROM "Lead" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`
      : `SELECT * FROM "Lead" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`;
    return db.prepare(sql).all(...values);
  },
  async findFirst({ where = {} } = {}) {
    const { conditions, values } = buildWhere(where);
    const sql = conditions.length
      ? `SELECT * FROM "Lead" WHERE ${conditions.join(" AND ")} LIMIT 1`
      : `SELECT * FROM "Lead" LIMIT 1`;
    return db.prepare(sql).get(...values) || null;
  },
  async create({ data }) {
    const id = newId(); const ts = now();
    db.prepare(`INSERT INTO "Lead" (id,businessId,name,businessType,contactEmail,contactPhone,location,website,estimatedSize,status,notes,pitch,emailSubject,emailBody,emailSentAt,repliedAt,convertedAt,deliverableData,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, data.businessId, data.name||"", data.businessType||"", data.contactEmail||null, data.contactPhone||null, data.location||"", data.website||null, data.estimatedSize||"small", data.status||"new", data.notes||"", data.pitch||"", data.emailSubject||"", data.emailBody||"", data.emailSentAt||null, data.repliedAt||null, data.convertedAt||null, JSON.stringify(data.deliverableData||{}), ts);
    return db.prepare(`SELECT * FROM "Lead" WHERE id = ?`).get(id);
  },
  async update({ where, data }) {
    const allowed = ["name","businessType","contactEmail","contactPhone","location","website","estimatedSize","status","notes","pitch","emailSubject","emailBody","emailSentAt","repliedAt","convertedAt","deliverableData"];
    const { conditions, values: wv } = buildWhere(where);
    const sets = allowed.filter(k => k in data).map(k => `"${k}" = ?`);
    const vals = allowed.filter(k => k in data).map(k => k === "deliverableData" ? JSON.stringify(data[k]) : data[k]);
    if (sets.length) db.prepare(`UPDATE "Lead" SET ${sets.join(", ")} WHERE ${conditions.join(" AND ")}`).run(...vals, ...wv);
    const { conditions: c2, values: v2 } = buildWhere(where);
    return db.prepare(`SELECT * FROM "Lead" WHERE ${c2.join(" AND ")} LIMIT 1`).get(...v2) || null;
  },
  async delete({ where }) {
    const { conditions, values } = buildWhere(where);
    db.prepare(`DELETE FROM "Lead" WHERE ${conditions.join(" AND ")}`).run(...values);
    return { ok: true };
  },
  async deleteMany({ where = {} }) {
    const { conditions, values } = buildWhere(where);
    if (conditions.length) db.prepare(`DELETE FROM "Lead" WHERE ${conditions.join(" AND ")}`).run(...values);
    return { count: 0 };
  },
};

const automationLog = {
  async findMany({ where = {}, orderBy, take } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["createdAt", "desc"]] = Object.entries(orderBy || { createdAt: "desc" });
    const limit = take ? ` LIMIT ${parseInt(take)}` : "";
    const sql = conditions.length
      ? `SELECT * FROM "AutomationLog" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}${limit}`
      : `SELECT * FROM "AutomationLog" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}${limit}`;
    return db.prepare(sql).all(...values);
  },
  async findFirst({ where = {}, orderBy } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["createdAt", "desc"]] = Object.entries(orderBy || { createdAt: "desc" });
    const sql = conditions.length
      ? `SELECT * FROM "AutomationLog" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"} LIMIT 1`
      : `SELECT * FROM "AutomationLog" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"} LIMIT 1`;
    return db.prepare(sql).get(...values) || null;
  },
  async create({ data }) {
    const id = newId(); const ts = now();
    db.prepare(`INSERT INTO "AutomationLog" (id,businessId,type,description,status,meta,createdAt) VALUES (?,?,?,?,?,?,?)`)
      .run(id, data.businessId, data.type, data.description||"", data.status||"done", JSON.stringify(data.meta||{}), ts);
    return db.prepare(`SELECT * FROM "AutomationLog" WHERE id = ?`).get(id);
  },
  async deleteMany({ where = {} }) {
    const { conditions, values } = buildWhere(where);
    if (conditions.length) db.prepare(`DELETE FROM "AutomationLog" WHERE ${conditions.join(" AND ")}`).run(...values);
  },
};

const financialEntry = {
  async findMany({ where = {}, orderBy } = {}) {
    const { conditions, values } = buildWhere(where);
    const [[col, dir] = ["date", "desc"]] = Object.entries(orderBy || { date: "desc" });
    const sql = conditions.length
      ? `SELECT * FROM "FinancialEntry" WHERE ${conditions.join(" AND ")} ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`
      : `SELECT * FROM "FinancialEntry" ORDER BY "${col}" ${dir === "asc" ? "ASC" : "DESC"}`;
    return db.prepare(sql).all(...values);
  },
  async create({ data }) {
    const id = newId();
    const ts = now();
    db.prepare(`INSERT INTO "FinancialEntry" (id, businessId, type, category, amount, description, date, createdAt) VALUES (?,?,?,?,?,?,?,?)`)
      .run(id, data.businessId, data.type ?? "income", data.category ?? "Other", data.amount ?? 0, data.description ?? "", data.date ?? ts.slice(0, 10), ts);
    return db.prepare(`SELECT * FROM "FinancialEntry" WHERE id = ?`).get(id);
  },
  async delete({ where }) {
    const { conditions, values } = buildWhere(where);
    db.prepare(`DELETE FROM "FinancialEntry" WHERE ${conditions.join(" AND ")}`).run(...values);
    return { ok: true };
  },
};

module.exports = {
  user,
  business,
  task,
  businessOutput,
  integration,
  financialEntry,
  lead,
  automationLog,
  $connect:    async () => {},
  $disconnect: async () => {},
};
