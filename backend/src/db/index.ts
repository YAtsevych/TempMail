import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // максимум з'єднань (за замовчуванням 10)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.message);
    return;
  }
  console.log("✅ Database connected successfully");
  release();
});

export default pool;
