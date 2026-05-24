// Воркер BullMQ — обробляє листи з черги
// Запускається як окремий процес поряд з index.ts

import { Worker } from "bullmq";
import pool from "../db";
import { v4 as uuidv4 } from "uuid";
import { redisConnectionFromEnv } from "./emailQueue";
import { createPublisher, PUBSUB_CHANNEL } from "../socket";
import { runMimeFilter, MimeFilterInput } from "../utils/mimeFilter";
import { classifyEmail } from "../utils/classifier";
import { incrementMetric } from "../services/redisService";

console.log("[worker] ✅ BullMQ Worker started");

const publisher = createPublisher();

// Скользящий масив останніх 1000 вимірювань для p99
const processingTimes: number[] = [];

export function recordProcessingTime(ms: number): void {
  processingTimes.push(ms);
  if (processingTimes.length > 1000) processingTimes.shift();
}

export function getProcessingStats(): {
  avg: number;
  p99: number;
  count: number;
} {
  if (processingTimes.length === 0) return { avg: 0, p99: 0, count: 0 };
  const sorted = [...processingTimes].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
  const p99 = sorted[Math.ceil(sorted.length * 0.99) - 1];
  return { avg, p99, count: sorted.length };
}

const worker = new Worker(
  "emailQueue",
  async (job) => {
    const startTs = Date.now();
    const email = job.data;

    // 2-й ешелон: класифікація
    const classifyResult = classifyEmail({
      subject: email.subject,
      body_text: email.body_text,
      body_html: email.body_html,
      from_address: email.from_address,
      attachments: email.attachments ?? [],
    });

    console.log(
      `[worker] job=${job.id} | type=${classifyResult.type} | ` +
        `mice:${classifyResult.score.mice} vs elephant:${classifyResult.score.elephant} | ` +
        `${classifyResult.reasons.join(", ")}`,
    );

    // 3-й ешелон: MIME-фільтр — відхиляємо аномальні листи до збереження в БД
    const mimeResult = runMimeFilter({
      bodyText: email.body_text,
      bodyHtml: email.body_html,
      attachments: email.attachments ?? [],
    } as MimeFilterInput);

    if (!mimeResult.passed) {
      await incrementMetric("mimeRejected");
      console.warn(
        `[worker] 🚫 MIME rejected | job=${job.id} | rule=${mimeResult.rule} | ${mimeResult.reason}`,
      );
      return {
        status: "rejected",
        rule: mimeResult.rule,
        reason: mimeResult.reason,
      };
    }

    // Зберігаємо в PostgreSQL
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

    // Оновлюємо лічильники для метрик
    await incrementMetric(
      classifyResult.type === "mice" ? "miceProcessed" : "elephantProcessed",
    );

    // Push клієнту через Redis Pub/Sub → Socket.io
    const room = `mailbox:${email.inbox_address}`;
    const payload = {
      id: emailId,
      from_address: email.from_address,
      subject: email.subject || "(no subject)",
      preview: (email.body_text || "").slice(0, 200),
      created_at: new Date().toISOString(),
      is_read: false,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      body_html: email.body_html || "",
      body_text: email.body_text || "",
    };

    await publisher.publish(PUBSUB_CHANNEL, JSON.stringify({ room, payload }));

    const processingMs = Date.now() - startTs;
    recordProcessingTime(processingMs);

    console.log(
      `[worker] ✅ job=${job.id} | ${processingMs}ms | emailId=${emailId}`,
    );
  },
  { connection: redisConnectionFromEnv(), concurrency: 10 },
);

worker.on("completed", (job) => {
  console.log(`[worker] ✓ Completed job=${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] ❌ Failed job=${job?.id} | ${err.message}`);
});

worker.on("error", (err) => {
  console.error("[worker] ❌ Worker error:", err.message);
});
