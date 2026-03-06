import fs from "fs";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

// Явно указываем путь к .env
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Проверка что переменные читаются
console.log("DATABASE_URL:", process.env.DATABASE_URL);

const runMigration = async () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not defined in .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log("🔄 Running migrations...");

    const sql = fs.readFileSync(
      path.join(__dirname, "migrations", "init.sql"),
      "utf-8",
    );

    await pool.query(sql);
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await pool.end();
  }
};

runMigration();
