// Воркери BullMQ — читають листи з черг, та записують в Redis
//Flasher - Читає листи з Redis, та записує у БД(Працює за правилами BUFFER_CONFIG)
// Запускається як окремий процес поряд з index.ts

import { Worker } from "bullmq";
import pool from "../db";
import { v4 as uuidv4 } from "uuid";
import { redisConnectionFromEnv } from "./emailQueue";
import { createPublisher, PUBSUB_CHANNEL } from "../socket";
import { runMimeFilter, MimeFilterInput } from "../utils/mimeFilter";
import { incrementMetric } from "../services/redisService";
import { Job } from "bullmq";
import Redis from "ioredis";
import { RedisOptions } from "ioredis";

//////////////////////////////////////////////////////////////////////////////////////

//Окремі редіс, для кожної черги, щоб не було проблем з синхронізацієї
const redisOpts = redisConnectionFromEnv() as RedisOptions;

const redisMice = new Redis({
  ...redisOpts,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 3000),
  commandTimeout: 5000,
});
const redisElephant = new Redis({
  ...redisOpts,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 3000),
  commandTimeout: 5000,
});
export const redisWorker = new Redis({
  ...redisOpts,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 3000),
  commandTimeout: 5000,
});

//////////////////////////////////////////////////////////////////////////////////////////////

const publisher = createPublisher();
export interface EmailJobData {
  inbox_address: string;
  from_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: any[];
  received_at: string;
  type: string;
  score: { mice: number; elephant: number };
  reasons: string[];
}

//Налаштування флешшера

const BUFFER_CONFIG: Record<
  string,
  { maxBufferSize: number; timeoutMs: number }
> = {
  mice: {
    maxBufferSize: 100,
    timeoutMs: 100,
  },
  elephant: {
    maxBufferSize: 50,
    timeoutMs: 200,
  },
};
//Функція воркера, читає з черги, перевіряє, та зберігає у потрібному форматі в Redis
async function processEmail(job: Job<EmailJobData>) {
  const startTs = Date.now();
  const email = job.data;

  // console.log(
  //   `[processEmailWorker${job.data.type}] job=${job.id} | type=${job.data.type} | ` +
  //     `mice:${job.data.score.mice} vs elephant:${job.data.score.elephant} | ` +
  //     `${job.data.reasons.join(", ")}`,
  // );

  // 3-й ешелон: MIME-фільтр аномалій (Блокування небезпечних розширень)
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

  // Зберігання в Redis
  const emailId = uuidv4();
  const emailRecord = {
    emailId: emailId,
    inbox_address: email.inbox_address,
    from_address: email.from_address,
    subject: email.subject || null,
    body_html: email.body_html || null,
    body_text: email.body_text || null,
    confirmation_code: null,
    expires_at: new Date(Date.now() + 3600 * 1000),
    created_at: new Date(),
  };
  await redisWorker.rpush(`buffer:${email.type}`, JSON.stringify(emailRecord));
  return { status: "buffered", id: emailId };
}

/////////////////////////////////////////////////////////////////////////////////////////////////

//Функція збереження у БД за допомогою UNNEST та при ON CONFLICT (id) DO NOTHING;
async function saveEmailsBulk(batch: any[]): Promise<string[]> {
  const ids: string[] = [];
  const inboxAddresses: string[] = [];
  const fromAddresses: string[] = [];
  const subjects: (string | null)[] = [];
  const bodyTexts: (string | null)[] = [];
  const bodyHtmls: (string | null)[] = [];
  const confirmationCodes: null[] = [];
  const expiresAtDates: Date[] = [];
  const createdAtDates: Date[] = [];

  for (const row of batch) {
    ids.push(row.emailId);
    inboxAddresses.push(row.inbox_address);
    fromAddresses.push(row.from_address);
    subjects.push(row.subject);
    bodyTexts.push(row.body_text);
    bodyHtmls.push(row.body_html);
    confirmationCodes.push(row.confirmation_code);
    expiresAtDates.push(row.expires_at);
    createdAtDates.push(row.created_at);
  }

  //
  const sql = `
    INSERT INTO emails 
      (id, inbox_address, from_address, subject, body_text, body_html, confirmation_code, expires_at, created_at)
    SELECT * FROM UNNEST(
      $1::uuid[], 
      $2::text[], 
      $3::text[], 
      $4::text[], 
      $5::text[], 
      $6::text[], 
      $7::text[],
      $8::timestamp[], 
      $9::timestamp[]
    ) AS input_data(id, inbox_address, from_address, subject, body_text, body_html, confirmation_code, expires_at, created_at)
    WHERE input_data.inbox_address IN (SELECT address FROM inboxes)
    ON CONFLICT (id) DO NOTHING
    RETURNING id;
  `;

  const values = [
    ids,
    inboxAddresses,
    fromAddresses,
    subjects,
    bodyTexts,
    bodyHtmls,
    confirmationCodes,
    expiresAtDates,
    createdAtDates,
  ];

  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = 3000;");
    const res = await client.query(sql, values);

    // Возвращаем массив UUID успешно созданных писем
    return (res.rows || []).map((row) => row.id);
  } finally {
    client.release();
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////

// Атомарний Lua-скрипт зрізу (Бере лімітовану пачку і відразу видаляє її з буфера)
const atomicPopScript = `
  local batch = redis.call('LRANGE', KEYS[1], 0, ARGV[1])
  if #batch == 0 then return {} end
  redis.call('LTRIM', KEYS[1], #batch, -1)
  return batch
`;

// Флаги блокування паралельних тактів одного флешера
let isFlushing: Record<string, boolean> = { mice: false, elephant: false };

// Допоміжна функція збірки пейлоаду для сокетів
function buildSocketPayload(rec: any) {
  return {
    id: rec.emailId,
    from_address: rec.from_address,
    subject: rec.subject || "(no subject)",
    preview: (rec.body_text || "").slice(0, 200),
    created_at: new Date(rec.created_at).toISOString(),
    is_read: false,
    expires_at: new Date(rec.expires_at).toISOString(),
    body_html: rec.body_html || "",
    body_text: rec.body_text || "",
  };
}

/////////////////////////////////////////////////////////////////////////////////////////

//Функція Флешера. Бере пачку листів, додає в базу робит публікацію у WebSocket
async function startFlasher(type: "mice" | "elephant", redisClient: Redis) {
  if (isFlushing[type]) {
    setTimeout(
      () => startFlasher(type, redisClient),
      BUFFER_CONFIG[type].timeoutMs,
    );
    return;
  }

  isFlushing[type] = true;

  try {
    const rawBatch = (await redisClient.eval(
      atomicPopScript,
      1,
      `buffer:${type}`,
      String(BUFFER_CONFIG[type].maxBufferSize - 1),
    )) as string[];

    if (rawBatch && rawBatch.length > 0) {
      const parsedBatch = rawBatch.map((s) => JSON.parse(s));

      try {
        // Получаем точный список UUID, которые засинкались в СУБД
        const savedIds = await saveEmailsBulk(parsedBatch);
        const allowedIdsSet = new Set(savedIds);

        if (savedIds.length < parsedBatch.length) {
          console.warn(
            `[flasher:${type}] 🧹 SQL-Фильтр отсек ${parsedBatch.length - savedIds.length} писем (инбокс не существует или дубликат id).`,
          );
        }

        // Крок 3: Пушим в сокеты строго по совпадению emailId
        parsedBatch.forEach((rec) => {
          if (!allowedIdsSet.has(rec.emailId)) return; // Теперь это абсолютно безопасно!

          publisher
            .publish(
              PUBSUB_CHANNEL,
              JSON.stringify({
                room: `mailbox:${rec.inbox_address}`,
                payload: buildSocketPayload(rec),
              }),
            )
            .catch((err) =>
              console.error(`[Socket Error:${type}]`, err.message),
            );
        });
      } catch (dbErr) {
        console.error(
          `[flasher:${type}] 🚨 Помилка СУБД. Повертаємо батч назад у Redis buffer.`,
        );
        await redisClient.lpush(`buffer:${type}`, ...rawBatch.reverse());
        throw dbErr;
      }
    }
  } catch (err) {
    console.error(
      `[flasher:${type}] КРИТИЧНА ПОМИЛКА ТАКТУ:`,
      (err as Error).message,
    );
  } finally {
    isFlushing[type] = false;
    setTimeout(
      () => startFlasher(type, redisClient),
      BUFFER_CONFIG[type].timeoutMs,
    );
  }
}
//Запуск Воркерів
const miceWorker = new Worker("miceQueue", processEmail, {
  connection: redisConnectionFromEnv(),
  concurrency: 3,
});
const elephantWorker = new Worker("elephantQueue", processEmail, {
  connection: redisConnectionFromEnv(),
  concurrency: 5,
});

//Запуск Флешерів
startFlasher("mice", redisMice);
startFlasher("elephant", redisElephant);

//Логи Воркерів
miceWorker.on("failed", (job, err) => {
  console.error(`[miceWorker] ❌ Failed job=${job?.id} | ${err.message}`);
});

miceWorker.on("error", (err) => {
  console.error("[miceWorker] ❌ Worker error:", err.message);
});

elephantWorker.on("failed", (job, err) => {
  console.error(`[elephantWorker] ❌ Failed job=${job?.id} | ${err.message}`);
});

elephantWorker.on("error", (err) => {
  console.error("[elephantWorker] ❌ Worker error:", err.message);
});

/////////////////////////////////////////////////////////////////////////////////

//TTL видалення для inboxes
setInterval(
  async () => {
    let client;
    const sql = `DELETE FROM inboxes WHERE expires_at < NOW();`;

    try {
      client = await pool.connect(); // 2. Беремо коннект
      await client.query(sql); // 3. Виконуємо видалення
    } catch (err) {
      // 4. Ловимо помилки Neon DB (наприклад, холодний старт), щоб воркер не впав
      console.error(
        "[TTL Cleaner] ❌ Помилка зачистки інбоксів:",
        (err as Error).message,
      );
    } finally {
      // 5. Повертаємо коннект у пул ТІЛЬКИ якщо клієнт дійсно був створений
      if (client) {
        client.release();
      }
    }
  },
  5 * 60 * 1000, // Робота кожні 5 хвилин
);
