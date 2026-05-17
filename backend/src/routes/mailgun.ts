import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { createEmail } from "../services/emailService";

const router = Router();
const upload = multer(); // парсит multipart/form-data

// Проверка подписи Mailgun (опционально, но правильно)
const verifyMailgunSignature = (req: Request): boolean => {
  const key = process.env.MAILGUN_SIGNING_KEY;
  if (!key) return true; // если ключ не задан — пропускаем проверку

  const timestamp = req.body.timestamp;
  const token = req.body.token;
  const signature = req.body.signature;

  if (!timestamp || !token || !signature) return false;

  const hmac = crypto
    .createHmac("sha256", key)
    .update(timestamp + token)
    .digest("hex");

  return hmac === signature;
};

router.post("/inbound", upload.none(), async (req: Request, res: Response) => {
  try {
    if (!verifyMailgunSignature(req)) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid signature" });
    }

    const recipient = req.body.recipient; // куда пришло
    const sender = req.body.sender; // от кого
    const subject = req.body.subject || null;
    const body_text = req.body["body-plain"] || null;
    const body_html = req.body["body-html"] || null;

    if (!recipient || !sender) {
      return res
        .status(400)
        .json({ success: false, error: "Missing recipient/sender" });
    }

    await createEmail({
      inbox_address: recipient,
      from_address: sender,
      subject,
      body_text,
      body_html,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Mailgun inbound error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
