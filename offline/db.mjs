// اتصال PostgreSQL المحلي
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "idara_maktab",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
});

export const query = (text, params) => pool.query(text, params);

pool.on("error", (err) => {
  console.error("❌ خطأ في اتصال قاعدة البيانات:", err.message);
});
