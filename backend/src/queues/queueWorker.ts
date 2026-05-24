import { Worker } from "bullmq";
import pool from "../db";
import { v4 as uuidv4 } from "uuid";
import { redisConnectionFromEnv, emailQueue } from "./emailQueue";
import { createPublisher, PUBSUB_CHANNEL } from "../socket";
import { runMimeFilter, MimeFilterInput } from "../utils/mimeFilter";
console.log("=== BullMQ WORKER STARTED ===");

// Publisher живёт в процессе воркера
const publisher = createPublisher();

const worker = new Worker(
  "emailQueue",
  async (job) => {
    const startTs = Date.now();
    const email = job.data;
    console.log(
      `[MIME-DEBUG] attachments=${JSON.stringify(email.attachments)} | ` +
        `bodySize=${(email.body_text?.length ?? 0) + (email.body_html?.length ?? 0)}`,
    );
    console.log(
      `[BullMQ][Worker] Job ${job.id} | priority=${job.opts.priority === 2 ? "mice" : "elephant"} | ` +
        `from=${email.from_address} | inbox=${email.inbox_address}`,
    );

    // ── MIME-фільтр: 3-й ешелон захисту ──────────────────
    // Запускається ДО збереження в БД.
    // Відхилені листи не потрапляють в PostgreSQL і не споживають ресурси.
    const mimeInput: MimeFilterInput = {
      bodyText: email.body_text,
      bodyHtml: email.body_html,
      attachments: email.attachments ?? [],
    };

    const mimeResult = runMimeFilter(mimeInput);

    if (!mimeResult.passed) {
      // LOG для Розділу 3: фіксуємо кожне відхилення з правилом
      console.warn(
        `[MIME-FILTER] Job ${job.id} REJECTED | ` +
          `rule=${mimeResult.rule} | reason="${mimeResult.reason}" | ` +
          `from=${email.from_address}`,
      );
      // Повертаємо без помилки — job вважається виконаним (не retry)
      return {
        status: "rejected",
        rule: mimeResult.rule,
        reason: mimeResult.reason,
      };
    }
    // Шаг 1: сохраняем в PostgreSQL
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

    // публикуем в Redis → index.ts получит и сделает io.emit
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
    console.log(
      `[BullMQ][Worker] Job ${job.id} DONE | ` +
        `emailId=${emailId} | processingMs=${processingMs} | ` +
        `wsRoom=${room} | status=published_to_redis`,
    );
  },
  { connection: redisConnectionFromEnv() },
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
