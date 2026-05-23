// backend/src/index.ts
// Изменения относительно оригинала:
//   1. Создан httpServer поверх Express app (нужен для Socket.io)
//   2. Инициализирован io = new Server(httpServer, ...)
//   3. Добавлен обработчик SUBSCRIBE_MAILBOX — клиент подписывается на комнату
//   4. io экспортируется для использования в queueWorker.ts
//   5. app.listen() → httpServer.listen()

import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http"; // <-- НОВОЕ
import { Server } from "socket.io"; // <-- НОВОЕ
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
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app); // <-- НОВОЕ

// ── Socket.io ────────────────────────────────────────────
// Создаём WebSocket-сервер поверх того же HTTP-порта.
// CORS разрешает фронтенд (Vite на 5173 и Render).
export const io = new Server(httpServer, {
  // <-- НОВОЕ (экспорт!)
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://tempmail-front.onrender.com",
    ],
    credentials: true,
  },
  // Fallback на long-polling для сред без WS (некоторые хостинги)
  transports: ["websocket", "polling"],
});
initIo(io);
// Клиент подписывается на обновления своего mailbox:
//   emit("SUBSCRIBE_MAILBOX", "james123@tempmailbox.uk")
//   → socket.join("mailbox:james123@tempmailbox.uk")
// Воркер потом делает: io.to("mailbox:...").emit("NEW_EMAIL", data)
io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on("SUBSCRIBE_MAILBOX", (address: string) => {
    // Базовая валидация — не пускаем мусор в имена комнат
    if (typeof address !== "string" || address.length > 320) return;
    socket.join(`mailbox:${address.toLowerCase()}`);
    console.log(`[WS] ${socket.id} subscribed to mailbox:${address}`);
  });

  socket.on("disconnect", () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Middleware ────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const allowed = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://tempmail-front.onrender.com",
];

app.use(helmet());
app.use(cors({ origin: allowed }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// ── Роуты ─────────────────────────────────────────────────
app.use("/mailgun", mailgunRouter);
app.use("/inbox", inboxRouter);
app.use("/emails", emailsRouter);

// ── Health Check ──────────────────────────────────────────
app.get("/health", async (req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({
      status: "ok",
      database: "connected ✅",
      redis: "connected ✅",
      websocket: `clients: ${io.engine.clientsCount}`, // <-- НОВОЕ: видим кол-во WS клиентов
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: "error", error: String(error) });
  }
});

// ── 404 / Error handlers ──────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// ── Запуск ────────────────────────────────────────────────
// ВАЖНО: httpServer.listen, НЕ app.listen — иначе Socket.io не подключится
httpServer.listen(PORT, () => {
  console.log(`🚀 Server + WebSocket running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
