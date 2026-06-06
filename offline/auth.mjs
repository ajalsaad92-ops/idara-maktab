// المصادقة المحلية (يحل محل Supabase Auth)
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "./db.mjs";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;

if (JWT_SECRET === "change-me-in-production" || JWT_SECRET.includes("قم_بتغيير")) {
  console.warn("⚠️  تحذير: JWT_SECRET افتراضي — يجب تغييره في ملف .env");
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// تسجيل الدخول
export async function login(email, password) {
  const { rows } = await query(
    "SELECT id, email, password_hash, is_active FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  if (rows.length === 0) return { error: "البريد أو كلمة السر غير صحيحة" };

  const user = rows[0];
  if (!user.is_active) return { error: "هذا الحساب موقوف" };

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return { error: "البريد أو كلمة السر غير صحيحة" };

  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);

  const token = signToken(user);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [user.id, tokenHash, SESSION_DAYS]
  );

  // جلب الأدوار + الملف الشخصي
  const { rows: roleRows } = await query(
    "SELECT role FROM user_roles WHERE user_id = $1",
    [user.id]
  );
  const { rows: profileRows } = await query(
    "SELECT full_name, department, avatar_url, phone, job_title FROM profiles WHERE id = $1",
    [user.id]
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      roles: roleRows.map((r) => r.role),
      profile: profileRows[0] || null,
    },
  };
}

// تسجيل الخروج
export async function logout(token) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

// Middleware للتحقق من JWT
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "غير مصرّح" });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "جلسة منتهية" });

  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}

// Middleware لجلب الأدوار
export async function loadRoles(req, res, next) {
  if (!req.userId) return next();
  const { rows } = await query(
    "SELECT role FROM user_roles WHERE user_id = $1",
    [req.userId]
  );
  req.roles = rows.map((r) => r.role);
  req.isAdmin = req.roles.includes("admin");
  req.isManager = req.roles.includes("manager") || req.isAdmin;
  next();
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.roles?.some((r) => allowed.includes(r))) {
      return res.status(403).json({ error: "صلاحيات غير كافية" });
    }
    next();
  };
}
