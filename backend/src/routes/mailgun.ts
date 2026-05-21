import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { emailQueue } from "../queues/emailQueue";
import { classifyEmail, getPriority } from "../utils/classifier";

const router = Router();
const upload = multer();

const verifyMailgunSignature = (req: Request): boolean => {
  const key = process.env.MAILGUN_SIGNING_KEY;
  console.log("MAILGUN_SIGNING_KEY present?", Boolean(key));
  console.log("MAILGUN_SIGNING_KEY value:", key);
  if (!key) return true;

  const body = req.body || {};
  const timestamp = body.timestamp;
  const token = body.token;
  const signature = body.signature;

  if (!timestamp || !token || !signature) return false;

  const hmac = crypto
    .createHmac("sha256", key)
    .update(timestamp + token)
    .digest("hex");

  return hmac === signature;
};

router.post("/inbound", upload.none(), async (req: Request, res: Response) => {
  console.log("MAILGUN HIT /inbound", new Date().toISOString());
  console.log("MAILGUN content-type:", req.headers["content-type"]);
  console.log("MAILGUN body keys:", Object.keys(req.body || {}));
  try {
    if (!verifyMailgunSignature(req)) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid signature" });
    }

    const recipient = req.body.recipient;
    const sender = req.body.sender;
    const subject = req.body.subject || null;
    const body_text = req.body["body-plain"] || null;
    const body_html = req.body["body-html"] || null;
    const attachments = req.body.attachments || [];

    if (!recipient || !sender) {
      return res
        .status(400)
        .json({ success: false, error: "Missing recipient/sender" });
    }

    const recipient_normal = String(recipient).toLowerCase();

    // --- BullMQ: Классификация и постановка письма в очередь ---
    const priorityClass = classifyEmail({
      subject,
      body_text,
      body_html,
      attachments,
    });
    console.log("MailGun priorityClass:" + priorityClass);
    const job = await emailQueue.add(
      "newEmail",
      {
        inbox_address: recipient_normal,
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
      `[BullMQ] Job ${job.id} (${priorityClass}) added for ${recipient_normal}`,
    );

    return res.json({ success: true, jobId: job.id, priority: priorityClass });
  } catch (err) {
    console.error("Mailgun inbound error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
