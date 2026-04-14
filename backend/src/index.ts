import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import pool from "./db";
import redis from "./services/redisService";
import inboxRouter from "./routes/inbox";
import emailsRouter from "./routes/emails";
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Роуты ────────────────────────────────
app.use("/inbox", inboxRouter);
// ── Health Check ─────────────────────────
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Тест PostgreSQL
    await pool.query("SELECT 1");

    // Тест Redis
    await redis.ping();

    res.json({
      status: "ok",
      database: "connected ✅",
      redis: "connected ✅",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: String(error),
    });
  }
});
app.use("/emails", emailsRouter);
// ── 404 Handler ──────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// ── Error Handler ────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
  });
});

// ── Запуск сервера ───────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
