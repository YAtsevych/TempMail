// Вебхук від Mailgun — точка входу для всіх вхідних листів

import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { emailQueue } from "../queues/emailQueue";
import { classifyEmail, getPriority } from "../utils/classifier";
import { checkRateLimit, incrementMetric } from "../services/redisService";

const router = Router();
const upload = multer();

// Перевіряємо підпис від Mailgun щоб не приймати підроблені запити
const verifyMailgunSignature = (req: Request): boolean => {
  const key = process.env.MAILGUN_SIGNING_KEY;
  if (!key) return true; // якщо ключ не задано — пропускаємо (dev режим)

  const { timestamp, token, signature } = req.body || {};
  if (!timestamp || !token || !signature) return false;

  const hmac = crypto
    .createHmac("sha256", key)
    .update(timestamp + token)
    .digest("hex");

  return hmac === signature;
};

router.post("/inbound", upload.none(), async (req: Request, res: Response) => {
  // IP відправника — беремо реальний, не IP Mailgun gateway
  const senderIp =
    (req.body?.["X-Sender-IP"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.ip ||
    "0.0.0.0";

  // 1-й ешелон: Token Bucket rate limiter
  await incrementMetric("totalReceived");
  const { allowed } = await checkRateLimit(senderIp);

  if (!allowed) {
    await incrementMetric("rateLimitedRejected");
    return res.status(429).json({
      success: false,
      error: "rate_limit_exceeded",
      retryAfterMs: 100, // при rate=10, наступний токен через ~100мс
    });
  }

  try {
    if (!verifyMailgunSignature(req)) {
      console.warn(`[mailgun] ⚠ Invalid signature | ip=${senderIp}`);
      return res
        .status(403)
        .json({ success: false, error: "Invalid signature" });
    }

    const recipient = req.body.recipient;
    const sender = req.body.sender;
    const subject = req.body.subject || null;
    const body_text = req.body["body-plain"] || null;
    const body_html = req.body["body-html"] || null;

    // Mailgun серіалізує вкладення як JSON-рядок
    let attachments: Array<{
      name?: string;
      size?: number;
      content_type?: string;
    }> = [];
    try {
      const raw = req.body.attachments;
      if (typeof raw === "string") attachments = JSON.parse(raw);
      else if (Array.isArray(raw)) attachments = raw;
    } catch {
      attachments = [];
    }

    if (!recipient || !sender) {
      return res
        .status(400)
        .json({ success: false, error: "Missing recipient/sender" });
    }

    // 2-й ешелон: класифікуємо лист і ставимо в чергу з пріоритетом
    const { type: priorityClass } = classifyEmail({
      subject,
      body_text,
      body_html,
      from_address: sender,
      attachments,
    });

    const job = await emailQueue.add(
      "newEmail",
      {
        inbox_address: String(recipient).toLowerCase(),
        from_address: sender,
        subject,
        body_text,
        body_html,
        attachments,
        received_at: new Date().toISOString(),
      },
      { priority: getPriority(priorityClass), removeOnComplete: true },
    );

    console.log(
      `[mailgun] ✅ Job ${job.id} | type=${priorityClass} | from=${sender} | to=${recipient}`,
    );

    return res.json({ success: true, jobId: job.id, priority: priorityClass });
  } catch (err) {
    console.error("[mailgun] ❌ Inbound error:", (err as Error).message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
