// backend/src/index.ts
// Точка входу Express-сервера.
//
// Відповідальності:
//   - HTTP API (/inbox, /emails, /mailgun)
//   - WebSocket сервер (Socket.io) для push-доставки листів
//   - Health check (/health)
//   - 404 та error handlers

import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import pool from "./db";
import redis from "./services/redisService";
import inboxRouter from "./routes/inbox";
import emailsRouter from "./routes/emails";
import mailgunRouter from "./routes/mailgun";
import { initIo } from "./socket";

//Імпорти для метрик
import { getMetricCounters } from "./services/redisService";
import { emailQueue } from "./queues/emailQueue";

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// ── Socket.io ─────────────────────────────────────────────
// WebSocket-сервер поверх того самого HTTP-порту.
// Клієнт підписується на кімнату "mailbox:<address>" через SUBSCRIBE_MAILBOX.
// Worker публікує NEW_EMAIL в Redis → initIo отримує і робить emit.
export const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://tempmail-front.onrender.com",
    ],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Реєструємо io в синглтоні socket.ts до першого підключення
initIo(io);

io.on("connection", (socket) => {
  console.log(
    `[ws] + Client connected | id=${socket.id} | total=${io.engine.clientsCount}`,
  );

  socket.on("SUBSCRIBE_MAILBOX", (address: string) => {
    if (typeof address !== "string" || address.length > 320) {
      console.warn(`[ws] ⚠ Invalid mailbox address from ${socket.id}`);
      return;
    }
    socket.join(`mailbox:${address.toLowerCase()}`);
    console.log(
      `[ws] ✓ Subscribed | id=${socket.id} | mailbox=${address.toLowerCase()}`,
    );
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `[ws] - Client disconnected | id=${socket.id} | reason=${reason} | total=${io.engine.clientsCount}`,
    );
  });
});

// ── Middleware ────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://tempmail-front.onrender.com",
];

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// ── Routes ────────────────────────────────────────────────
app.use("/mailgun", mailgunRouter);
app.use("/inbox", inboxRouter);
app.use("/emails", emailsRouter);

// ── Health Check ──────────────────────────────────────────
// Перевіряє підключення до PostgreSQL, Redis та стан WebSocket.
app.get("/health", async (req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({
      status: "ok",
      database: "connected",
      redis: "connected",
      wsClients: io.engine.clientsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] ❌ Health check failed:", (error as Error).message);
    res.status(500).json({ status: "error", error: String(error) });
  }
});

// ── Metrics ───────────────────────────────────────────────
// Повертає всі лічильники системи для Розділу 3 диплому.
// Використовуй після стрес-тесту щоб зняти дані для таблиць.
app.get("/api/metrics", async (req: Request, res: Response) => {
  try {
    const [counters, jobCounts, dbResult] = await Promise.all([
      getMetricCounters(),
      emailQueue.getJobCounts("waiting", "active", "completed", "failed"),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM inboxes WHERE expires_at > NOW()",
      ),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      traffic: {
        totalReceived: counters.totalReceived ?? 0,
        miceProcessed: counters.miceProcessed ?? 0,
        elephantProcessed: counters.elephantProcessed ?? 0,
        rateLimitedRejected: counters.rateLimitedRejected ?? 0,
        mimeRejected: counters.mimeRejected ?? 0,
      },
      queue: jobCounts,
      system: {
        activeMailboxes: dbResult.rows[0]?.count ?? 0,
        wsClients: io.engine.clientsCount,
      },
    });
  } catch (err) {
    console.error("[metrics] ❌ Error:", (err as Error).message);
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

// ── 404 Handler ───────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Error Handler ─────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] ❌ Unhandled error:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// ── Start ─────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[server] ✅ Running on port ${PORT}`);
});
