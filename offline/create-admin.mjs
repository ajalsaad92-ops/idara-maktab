// إعادة تعيين كلمة سر المدير (للطوارئ)
import readline from "readline/promises";
import { stdin, stdout } from "process";
import { pool, query } from "./db.mjs";
import { hashPassword } from "./auth.mjs";

const rl = readline.createInterface({ input: stdin, output: stdout });

async function main() {
  console.log("\n🔐 إعادة تعيين كلمة سر المدير\n");
  const email = (await rl.question("البريد الإلكتروني: ")).trim().toLowerCase();
  const password = (await rl.question("كلمة السر الجديدة: ")).trim();
  rl.close();

  if (!email || password.length < 6) {
    console.error("❌ بيانات غير صالحة (كلمة السر 6 أحرف على الأقل)");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const { rows } = await query("SELECT id FROM users WHERE email = $1", [email]);

  if (rows.length === 0) {
    const { rows: u } = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [email, hash]
    );
    await query("INSERT INTO profiles (id, full_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [u[0].id, "مدير النظام"]);
    await query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING", [u[0].id]);
    console.log("✅ تم إنشاء حساب مدير جديد");
  } else {
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, rows[0].id]);
    await query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING", [rows[0].id]);
    console.log("✅ تم تحديث كلمة سر المدير");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
