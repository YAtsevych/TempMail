import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.D,
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
