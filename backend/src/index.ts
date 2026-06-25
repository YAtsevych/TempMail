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
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
//Імпорти для метрик
import { getMetricCounters } from "./services/redisService";
import { miceQueue, elephantQueue } from "./queues/emailQueue";
import basicAuth from "express-basic-auth";
dotenv.config({ path: path.join(__dirname, "../.env") });

// 1. Створюємо адаптер для Express
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
// 2. Ініціалізуємо Bull-Board (ВИПРАВЛЕНО: передаємо черги через кому + додаємо serverAdapter)
createBullBoard({
  queues: [new BullMQAdapter(miceQueue), new BullMQAdapter(elephantQueue)],
  serverAdapter: serverAdapter,
});

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

app.use(
  "/admin/queues",
  basicAuth({
    users: {
      [process.env.ADMIN_USER || "DISABLED_USER_" + crypto.randomUUID()]:
        process.env.ADMIN_PASS || "DISABLED_PASSWORD_" + crypto.randomUUID(),
    },
    challenge: true, // Змушує браузер показати вікно логіна
  }),
  serverAdapter.getRouter(),
);
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
app.set("trust proxy", 1);
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
// Повертає всі лічильники системи.

app.get("/api/metrics", async (req: Request, res: Response) => {
  try {
    // Тепер чітко приймаємо 4 змінні на 4 проміси
    const [counters, miceCounts, elephantCounts, dbResult] = await Promise.all([
      getMetricCounters(),
      miceQueue.getJobCounts("waiting", "active", "completed", "failed"),
      elephantQueue.getJobCounts("waiting", "active", "completed", "failed"),
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
      queues: {
        mice: miceCounts,
        elephant: elephantCounts,
      },
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
