// Вебхук від Mailgun — точка входу для всіх вхідних листів
import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { emailQueue } from "../queues/emailQueue";
import { classifyEmail, getPriority } from "../utils/classifier";
import { checkRateLimit, incrementMetric } from "../services/redisService";

const router = Router();
const upload = multer();

// Перевіряємо підпис від Mailgun
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
// Используем встроенный модуль buffer для декодирования
const decodeMimeHeader = (header: string): string => {
  if (!header || !header.startsWith("=?")) return header;

  try {
    // Регулярка для извлечения base64 части из =?UTF-8?b?DATA?=
    const match = header.match(/=\?UTF-8\?[Bb]\?([^?]+)\?=/i);
    if (match && match[1]) {
      return Buffer.from(match[1], "base64").toString("utf-8");
    }
  } catch (e) {
    console.error("Ошибка декодирования заголовка:", e);
  }
  return header;
};
/**
 * Маршрут обробки вхідних листів.
 * Використовує механізм проміжних функцій (next) для покрокового проходження ешелонів захисту.
 */
router.post(
  "/inbound",
  async (req: Request, res: Response, next) => {
    //Перевірка ліміту частоти (Token Bucket)
    //Зчитуємо IP із заголовків, надісланих стрес-тестом. Це відбувається миттєво до парсингу тіла.
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
  //Парсинг тіла запиту (Multipart Form Data). Запускається ТІЛЬКИ для легітимного трафіку!
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
      const fromHeader = req.body["from"] || req.body.sender; // А вот это — заголовок "From: Name <email@domain.com>"
      const decodedFrom = decodeMimeHeader(fromHeader);

      // Функция для парсинга email из строки "Name <email@domain.com>"
      const extractEmail = (header: string): string => {
        const match = header.match(/<([^>]+)>/);
        return match ? match[1] : header;
      };
      const cleanSender = decodedFrom ? extractEmail(fromHeader) : sender;
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

      if (!recipient || !cleanSender) {
        return res
          .status(400)
          .json({ success: false, error: "Missing recipient/sender" });
      }

      //Інтелектуальна класифікація контенту (Mice vs Elephant)
      const { type: priorityClass } = classifyEmail({
        subject,
        body_text,
        body_html,
        from_address: cleanSender,
        attachments,
      });

      // Передаємо IP далі у лог, щоб бачити реальну картину
      const senderIpLog =
        (req.headers["x-sender-ip"] as string) || req.ip || "0.0.0.0";

      //ДОДАВАННЯ В ЧЕРГУ BULLMQ
      const job = await emailQueue.add(
        "newEmail",
        {
          inbox_address: String(recipient).toLowerCase(),
          from_address: cleanSender,
          subject,
          body_text,
          body_html,
          attachments,
          received_at: new Date().toISOString(),
        },
        {
          priority: getPriority(priorityClass),
          removeOnComplete: true,
        },
      );

      console.log(
        `[mailgun] ✅ Job ${job.id} | type=${priorityClass} | from=${cleanSender} | ip=${senderIpLog}`,
      );

      return res.json({
        success: true,
        jobId: job.id,
        priority: priorityClass,
      });
    } catch (err) {
      console.error("[mailgun] ❌ Inbound error:", (err as Error).message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  },
);

export default router;
