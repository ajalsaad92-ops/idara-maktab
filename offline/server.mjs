// خادم HTTP المحلي — REST API + خدمة الواجهة الثابتة
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { query, pool } from "./db.mjs";
import { login, logout, authMiddleware, loadRoles, requireRole, hashPassword } from "./auth.mjs";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ===========================================================================
// المصادقة
// ===========================================================================
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "البريد وكلمة السر مطلوبان" });
  const result = await login(email, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  await logout(token);
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware, loadRoles, async (req, res) => {
  const { rows: profileRows } = await query(
    "SELECT id, email FROM users WHERE id = $1",
    [req.userId]
  );
  const { rows: pRows } = await query(
    "SELECT full_name, department, avatar_url, phone, job_title FROM profiles WHERE id = $1",
    [req.userId]
  );
  if (!profileRows[0]) return res.status(404).json({ error: "المستخدم غير موجود" });
  res.json({
    user: { ...profileRows[0], roles: req.roles, profile: pRows[0] || null },
  });
});

// ===========================================================================
// CRUD عام — يطابق واجهة Supabase REST تقريبًا
// كل الجداول المسموح بها يدويًا لتفادي SQL Injection
// ===========================================================================
const TABLES = {
  profiles: { keyField: "id" },
  user_roles: { keyField: "id" },
  attendance: { keyField: "id" },
  tasks: { keyField: "id" },
  task_assignments: { keyField: "id" },
  task_comments: { keyField: "id" },
  task_transfers: { keyField: "id" },
  task_shares: { keyField: "id" },
  notifications: { keyField: "id" },
  exit_requests: { keyField: "id" },
  manager_queries: { keyField: "id" },
  departments: { keyField: "id" },
  settings: { keyField: "key" },
  role_permissions: { keyField: "role" },
  audit_logs: { keyField: "id" },
  task_attachments: { keyField: "id" },
};

// GET قائمة من جدول
app.get("/api/db/:table", authMiddleware, loadRoles, async (req, res) => {
  const table = req.params.table;
  if (!TABLES[table]) return res.status(404).json({ error: "جدول غير معروف" });

  try {
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const order = req.query.order || "created_at desc";
    const [col, dir] = String(order).split(/[\s.]+/);
    const safeDir = dir?.toLowerCase() === "asc" ? "ASC" : "DESC";

    let where = "";
    const params = [];
    let idx = 1;

    // فلاتر بسيطة: ?user_id=xxx&status=new
    const conditions = [];
    for (const [k, v] of Object.entries(req.query)) {
      if (["limit", "order"].includes(k)) continue;
      if (!/^[a-z_]+$/.test(k)) continue;
      conditions.push(`${k} = $${idx++}`);
      params.push(v);
    }
    if (conditions.length) where = "WHERE " + conditions.join(" AND ");

    const sql = `SELECT * FROM public.${table} ${where} ORDER BY ${/^[a-z_]+$/.test(col) ? col : "created_at"} ${safeDir} LIMIT ${limit}`;
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST إدراج
app.post("/api/db/:table", authMiddleware, loadRoles, async (req, res) => {
  const table = req.params.table;
  if (!TABLES[table]) return res.status(404).json({ error: "جدول غير معروف" });

  const data = req.body || {};
  // تمرير user_id تلقائيًا إن كان موجودًا في الجدول وليس مُرسلًا
  if (["attendance", "notifications", "task_comments"].includes(table) && !data.user_id) {
    data.user_id = req.userId;
  }

  const keys = Object.keys(data).filter((k) => /^[a-z_]+$/.test(k));
  if (!keys.length) return res.status(400).json({ error: "لا توجد بيانات" });

  const values = keys.map((k) => data[k]);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");

  try {
    const { rows } = await query(
      `INSERT INTO public.${table} (${keys.join(",")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH تحديث
app.patch("/api/db/:table/:id", authMiddleware, loadRoles, async (req, res) => {
  const table = req.params.table;
  const cfg = TABLES[table];
  if (!cfg) return res.status(404).json({ error: "جدول غير معروف" });

  const data = req.body || {};
  const keys = Object.keys(data).filter((k) => /^[a-z_]+$/.test(k));
  if (!keys.length) return res.status(400).json({ error: "لا توجد بيانات" });

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(",");
  const values = keys.map((k) => data[k]);
  values.push(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE public.${table} SET ${sets} WHERE ${cfg.keyField} = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: "السجل غير موجود" });
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE حذف (للمديرين فقط)
app.delete("/api/db/:table/:id", authMiddleware, loadRoles, requireRole("admin", "manager"), async (req, res) => {
  const table = req.params.table;
  const cfg = TABLES[table];
  if (!cfg) return res.status(404).json({ error: "جدول غير معروف" });

  try {
    await query(`DELETE FROM public.${table} WHERE ${cfg.keyField} = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// إدارة المستخدمين (للمسؤولين فقط)
// ===========================================================================
app.post("/api/admin/users", authMiddleware, loadRoles, requireRole("admin"), async (req, res) => {
  const { email, password, full_name, role = "employee", department } = req.body || {};
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "البيانات ناقصة" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hash = await hashPassword(password);
    const { rows: uRows } = await client.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), hash]
    );
    const userId = uRows[0].id;
    await client.query(
      "INSERT INTO profiles (id, full_name, department) VALUES ($1, $2, $3)",
      [userId, full_name, department || null]
    );
    await client.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, role]
    );
    await client.query("COMMIT");
    res.json({ data: { id: userId, email: uRows[0].email, full_name, role } });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "البريد مستخدم مسبقًا" });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ===========================================================================
// فحص الصحة
// ===========================================================================
app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: "db_error", error: err.message });
  }
});

// ===========================================================================
// خدمة الواجهة (Frontend) من مجلد dist
// ===========================================================================
const distPath = path.join(__dirname, "public");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "نقطة API غير موجودة" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

// ===========================================================================
// تشغيل
// ===========================================================================
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

function getLanIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

app.listen(PORT, HOST, () => {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   ✅ خادم إدارة المكتب يعمل                                ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║   📡 المنفذ: ${PORT}`.padEnd(60) + "║");
  console.log("║");
  console.log("║   🌐 عناوين الوصول من أجهزة الموظفين:");
  for (const ip of getLanIPs()) {
    console.log(`║      → http://${ip}:${PORT}`);
  }
  console.log(`║      → http://localhost:${PORT}  (من هذا الجهاز فقط)`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");
});
