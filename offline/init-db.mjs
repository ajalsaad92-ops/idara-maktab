// تهيئة قاعدة البيانات: تطبيق المخطط + إنشاء مدير افتراضي
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool, query } from "./db.mjs";
import { hashPassword } from "./auth.mjs";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("⏳ تطبيق المخطط...");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await query(schema);
  console.log("✅ المخطط طُبِّق بنجاح");

  // إنشاء مدير افتراضي إن لم يكن موجودًا
  const email = (process.env.ADMIN_EMAIL || "admin@office.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin1234";
  const name = process.env.ADMIN_NAME || "مدير النظام";

  const { rows } = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (rows.length === 0) {
    const hash = await hashPassword(password);
    const { rows: u } = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [email, hash]
    );
    await query("INSERT INTO profiles (id, full_name) VALUES ($1, $2)", [u[0].id, name]);
    await query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING", [u[0].id]);
    console.log(`✅ تم إنشاء حساب مدير افتراضي:`);
    console.log(`   البريد:      ${email}`);
    console.log(`   كلمة السر:   ${password}`);
    console.log(`   ⚠️  غيّر كلمة السر فورًا بعد أول دخول`);
  } else {
    console.log(`ℹ️  حساب المدير موجود مسبقًا (${email})`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("❌ فشل التهيئة:", err.message);
  process.exit(1);
});
