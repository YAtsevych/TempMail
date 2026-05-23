// backend/src/queues/queueWorker.ts
// Изменения относительно оригинала:
//   1. Импортирован io из index.ts
//   2. После INSERT в БД — emit "NEW_EMAIL" в комнату mailbox:<address>
//   3. Убраны дублирующиеся обработчики completed/failed
//   4. Добавлены структурированные логи для Розділу 3 диплому

import { Worker } from "bullmq";
import pool from "../db";
import { v4 as uuidv4 } from "uuid";
import { redisConnectionFromEnv } from "./emailQueue";

console.log("=== BullMQ WORKER STARTED ===");

// Ленивый импорт io — избегаем circular dependency.
// index.ts экспортирует io, но сам импортирует emailQueue.
// Решение: получаем io в момент первого использования, не при старте.
let _io: import("socket.io").Server | null = null;
const getIo = async () => {
  if (!_io) {
    // Динамический импорт разрывает circular dependency
    const { io } = await import("../index");
    _io = io;
  }
  return _io;
};

const worker = new Worker(
  "emailQueue",
  async (job) => {
    const startTs = Date.now(); // для метрик обработки (Розділ 3)
    const email = job.data;

    // LOG формат для Розділу 3:
    // [BullMQ][Worker] Job abc123 | priority=mice | from=test@ex.com | inbox=james@tempmailbox.uk
    console.log(
      `[BullMQ][Worker] Job ${job.id} | priority=${job.opts.priority === 2 ? "mice" : "elephant"} | ` +
        `from=${email.from_address} | inbox=${email.inbox_address}`,
    );

    // ── Шаг 1: Сохраняем письмо в PostgreSQL ─────────────
    const emailId = uuidv4();
    await pool.query(
      `INSERT INTO emails
        (id, inbox_address, from_address, subject, body_html, body_text, confirmation_code, expires_at, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        emailId,
        email.inbox_address,
        email.from_address,
        email.subject || null,
        email.body_html || null,
        email.body_text || null,
        null,
        new Date(Date.now() + 3600 * 1000),
        new Date(),
      ],
    );

    // ── Шаг 2: Push по WebSocket → клиент видит письмо мгновенно ──
    // Emit идёт в комнату "mailbox:<адрес>".
    // Клиент подписался на неё через SUBSCRIBE_MAILBOX.
    // Передаём только preview (без полного body) — экономим трафик.
    const io = await getIo();
    const room = `mailbox:${email.inbox_address}`;
    const payload = {
      id: emailId,
      from_address: email.from_address,
      subject: email.subject || "(no subject)",
      // preview: первые 200 символов body_text
      preview: (email.body_text || "").slice(0, 200),
      created_at: new Date().toISOString(),
      is_read: false,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      body_html: email.body_html || "",
      body_text: email.body_text || "",
    };
    io.to(room).emit("NEW_EMAIL", payload);

    // LOG для Розділу 3: время обработки — ключевая метрика NFR-02
    const processingMs = Date.now() - startTs;
    console.log(
      `[BullMQ][Worker] Job ${job.id} DONE | ` +
        `emailId=${emailId} | processingMs=${processingMs} | ` +
        `wsRoom=${room} | status=emitted`,
    );
  },
  {
    connection: redisConnectionFromEnv(),
  },
);

worker.on("completed", (job) => {
  console.log(`[BullMQ][Worker] Job COMPLETED: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[BullMQ][Worker] Job FAILED: ${job?.id} —`, err.message);
});

worker.on("error", (err) => {
  console.error("[BullMQ][Worker] Worker error:", err);
});
