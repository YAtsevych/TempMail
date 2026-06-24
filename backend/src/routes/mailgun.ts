// Вебхук від Mailgun — точка входу для всіх вхідних листів
import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { elephantQueue, miceQueue } from "../queues/emailQueue";

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

/**
 * Маршрут обробки вхідних листів.
 * Використовує механізм проміжних функцій (next) для покрокового проходження ешелонів захисту.
 */
router.post(
  "/inbound",
  async (req: Request, res: Response, next) => {
    // 1. ПЕРШИЙ ЕШЕЛОН ЗАХИСТУ: Перевірка ліміту частоти (Token Bucket)
    // Зчитуємо IP із заголовків, надісланих стрес-тестом. Це відбувається миттєво до парсингу тіла.
    const senderIp =
      (req.headers["x-sender-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      req.ip ||
      "0.0.0.0";

    // Оновлюємо метрику загального обсягу вхідного трафіку
    await incrementMetric("totalReceived");

    // Викликаємо атомарний Lua-скрипт лімітера в Redis
    const { allowed } = await checkRateLimit(senderIp);
    // Якщо ліміт перевищено — жорстко відсікаємо DoS-атаку на порозі системи
    if (!allowed) {
      await incrementMetric("rateLimitedRejected");
      console.log(
        `[ratelimit] 🚫 БЛОКУВАННЯ НА ПОРОЗІ | ip=${senderIp} (Мультер не запускався)`,
      );
      return res.status(429).json({
        success: false,
        error: "rate_limit_exceeded",
        retryAfterMs: 100, // при rate=10, наступний токен через ~100мс
      });
    }

    // Якщо IP пройшов лімітер — передаємо керування наступній мідлварі (multer)
    next();
  },
  // 2. Парсинг тіла запиту (Multipart Form Data). Запускається ТІЛЬКИ для легітимного трафіку!
  upload.none(),
  async (req: Request, res: Response) => {
    try {
      // Якщо увімкнено верифікацію підпису Mailgun — перевіряємо вже після парсингу тіла
      if (!verifyMailgunSignature(req)) {
        console.warn(`[mailgun] ⚠ Invalid signature`);
        return res
          .status(403)
          .json({ success: false, error: "Invalid signature" });
      }

      const recipient = req.body.recipient;
      const sender = req.body.sender;
      const subject = req.body.subject || null;
      const body_text = req.body["body-plain"] || null;
      const body_html = req.body["body-html"] || null;

      // Десеріалізація масиву вкладень
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

      // 3. ДРУГИЙ ЕШЕЛОН ЗАХИСТУ: Інтелектуальна класифікація контенту (Mice vs Elephant)
      const EmailClass = classifyEmail({
        subject,
        body_text,
        body_html,
        from_address: sender,
        attachments,
      });

      // Передаємо IP далі у лог, щоб бачити реальну картину
      const senderIpLog =
        (req.headers["x-sender-ip"] as string) || req.ip || "0.0.0.0";

      // 4. ДОДАВАННЯ В ЧЕРГУ BULLMQ
      // Для тесту чистих пріоритетів залишаємо параметр { priority }.
      const jobData = {
        inbox_address: String(recipient).toLowerCase(),
        from_address: sender,
        subject,
        body_text,
        body_html,
        attachments,
        received_at: new Date().toISOString(),
        type: EmailClass.type,
        score: EmailClass.score,
        reasons: EmailClass.reasons,
      };
      const queue = EmailClass.type === "mice" ? miceQueue : elephantQueue;
      const job = await queue.add("newEmail", jobData, {
        priority: getPriority(EmailClass.type),
        removeOnComplete: true,
      });

      // console.log(
      //   `[mailgun] ✅ ${EmailClass.type} | Job ${job.id} | type=${EmailClass.type} | from=${sender} | ip=${senderIpLog}`,
      // );
      return res.json({
        success: true,
        jobId: job.id,
        priority: EmailClass.type,
      });
    } catch (err) {
      console.error("[mailgun] ❌ Inbound error:", (err as Error).message);

      return res.status(500).json({ success: false, error: "Server error" });
    }
  },
);

export default router;
