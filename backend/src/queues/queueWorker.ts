import { Worker } from "bullmq";
import pool from "../db";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { redisConnectionFromEnv } from "./emailQueue";
import { emailQueue } from "./emailQueue";
console.log("=== BullMQ WORKER STARTED ===");

const worker = new Worker(
  "emailQueue",
  async (job) => {
    const email = job.data;
    console.log("📥 processing job", job.id, job.name);
    console.log("[WORKER LOGGING TO worker-test.log]");
    console.log(
      `[BullMQ][Worker] Picked job: ${job.id} email=${email.subject}`,
    );
    fs.appendFileSync(
      "worker-test.log",
      `[WORKER START] ${new Date().toISOString()}\n`,
    );
    await pool.query(
      `INSERT INTO emails
        (id, inbox_address, from_address, subject, body_html, body_text, confirmation_code, expires_at, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        uuidv4(),
        email.inbox_address,
        email.from_address,
        email.subject || null,
        email.body_html || null,
        email.body_text || null,
        null, // можно доработать если confirmation code нужен
        new Date(Date.now() + 3600 * 1000),
        new Date(),
      ],
    );
    // ({ ... }) можно добавить пуш по WebSocket и т.д.
    fs.appendFileSync("worker-test.log", "Твой лог текст\n");
    console.log(
      `[BullMQ][Worker] Email "${email.subject}" for ${email.inbox_address} saved to DB`,
    );
  },
  {
    connection: redisConnectionFromEnv(),
  },
);

worker.on("completed", (job) => {
  fs.appendFileSync("worker-test.log", "Твой лог текст\n");
  console.log(`[BullMQ][Worker] Job COMPLETED: ${job.id}`);
});

worker.on("failed", (job, err) => {
  fs.appendFileSync("worker-test.log", "Твой лог текст\n");
  console.error(`[BullMQ][Worker] Job FAILED: ${job?.id} —`, err);
});
worker.on("completed", (job) => {
  console.log("✅ completed", job.id, job.name);
});

worker.on("failed", (job, err) => {
  console.log("❌ failed", job?.id, job?.name, err);
});

worker.on("error", (err) => {
  console.log("❌ worker error", err);
});
