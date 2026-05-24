// Симулятор входящего письма через Mailgun webhook.
// Генерирует корректную подпись HMAC-SHA256 — проходит verifyMailgunSignature.
//
// Запуск:
//   npx ts-node src/utils/sendTestEmail.ts
//   npx ts-node src/utils/sendTestEmail.ts elephant  ← большое письмо
//   npx ts-node src/utils/sendTestEmail.ts spam 20   ← 20 писем подряд (тест rate limit)

import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const API_URL = `https://tempmail-backend-qdjs.onrender.com/mailgun/inbound`;
const SIGNING_KEY = process.env.MAILGUN_SIGNING_KEY || "";
const INBOX = process.env.TEST_INBOX || "test@tempmailbox.uk";

// ── Генерация подписи (точно как Mailgun) ─────────────────
function generateSignature(timestamp: string, token: string): string {
  return crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(timestamp + token)
    .digest("hex");
}

// ── Шаблоны писем ─────────────────────────────────────────
const templates = {
  // mice: маленькое OTP письмо (приоритет 2)
  mice: {
    from: "noreply@github.com",
    subject: "Your verification code",
    "body-plain":
      "Your GitHub verification code is: 849321\n\nThis code expires in 15 minutes.",
    "body-html":
      "<p>Your GitHub verification code is: <strong>849321</strong></p><p>This code expires in 15 minutes.</p>",
  },
  // elephant: большое HTML письмо (приоритет 1)
  elephant: {
    from: "newsletter@medium.com",
    subject: "Your weekly digest from Medium",
    "body-plain": "A".repeat(15000), // > 10KB → elephant
    "body-html": `<html><body>${"<p>Newsletter content paragraph.</p>".repeat(300)}</body></html>`,
  },
  // spam: для теста rate limiter
  spam: {
    from: "spam@attacker.com",
    subject: "Buy now!!!",
    "body-plain": "Click here to claim your prize.",
    "body-html": "<p>Click here to claim your prize.</p>",
  },
};

// ── Отправка одного письма ────────────────────────────────
async function sendEmail(
  type: keyof typeof templates,
  index = 1,
): Promise<{ status: number; body: unknown }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = crypto.randomBytes(16).toString("hex");
  const signature = generateSignature(timestamp, token);

  const template = templates[type];

  // FormData как multipart/form-data (Mailgun отправляет именно так)
  const params = new URLSearchParams({
    recipient: INBOX,
    sender: template.from,
    from: template.from,
    subject: `[${index}] ${template.subject}`,
    "body-plain": template["body-plain"],
    "body-html": template["body-html"],
    timestamp,
    token,
    signature,
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ── Точка входа ───────────────────────────────────────────
async function main() {
  const type = (process.argv[2] || "mice") as keyof typeof templates;
  const count = parseInt(process.argv[3] || "1", 10);

  if (!templates[type]) {
    console.error(
      `❌ Неизвестный тип: ${type}. Доступны: mice, elephant, spam`,
    );
    process.exit(1);
  }

  if (!SIGNING_KEY) {
    console.error("❌ MAILGUN_SIGNING_KEY не задан в .env");
    process.exit(1);
  }

  console.log(`📤 Отправляю ${count} письмо(а) типа "${type}" на ${INBOX}`);
  console.log(`📡 URL: ${API_URL}\n`);

  let passed = 0;
  let rejected = 0;

  for (let i = 1; i <= count; i++) {
    const { status, body } = await sendEmail(type, i);

    if (status === 200 || status === 202) {
      passed++;
      console.log(`✅ [${i}/${count}] status=${status}`, body);
    } else if (status === 429) {
      rejected++;
      console.log(`🚫 [${i}/${count}] RATE LIMITED status=429`, body);
    } else {
      console.log(`❌ [${i}/${count}] status=${status}`, body);
    }

    // Небольшая пауза между запросами чтобы не перегружать event loop
    if (count > 1) await new Promise((r) => setTimeout(r, 50));
  }

  console.log(
    `\n📊 Итог: passed=${passed} rejected=${rejected} total=${count}`,
  );

  // При count=60: passed=50 (burst β), rejected=10+ (rate limit сработал)
}

main().catch(console.error);
