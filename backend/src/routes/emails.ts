import { Router, Request, Response } from "express";
import {
  getLatestConfirmationCode,
  listEmails,
  markEmailRead,
} from "../services/emailService";
import { emailQueue } from "../queues/emailQueue";
import { classifyEmail, getPriority } from "../utils/classifier";

const router = Router();

// POST /emails — новые письма теперь ТОЛЬКО через очередь!
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      inbox_address,
      from_address,
      subject,
      body_html,
      body_text,
      attachments,
    } = req.body ?? {};

    if (!inbox_address || typeof inbox_address !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "inbox_address is required" });
    }
    if (!from_address || typeof from_address !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "from_address is required" });
    }

    // Классификация для приоритета
    const classifyResult = classifyEmail({
      subject,
      body_text,
      body_html,
      from_address: from_address, // або from_address залежно від файлу
      attachments,
    });
    const priorityClass = classifyResult.type;

    // Добавляем письмо в очередь BullMQ
    const job = await emailQueue.add(
      "newEmail",
      {
        inbox_address: inbox_address.toLowerCase(),
        from_address,
        subject,
        body_html,
        body_text,
        attachments: attachments || [],
        received_at: new Date().toISOString(),
      },
      { priority: getPriority(priorityClass), removeOnComplete: true },
    );

    console.log(
      `[BullMQ][API] Job ${job.id} (${priorityClass}) added for ${inbox_address}`,
    );

    // Ответ: письмо будет доступно после обработки воркером!
    return res.status(202).json({
      success: true,
      jobId: job.id,
      priority: priorityClass,
      message: "Email accepted and queued, will appear after processing.",
    });
  } catch (error) {
    console.error("❌ Create email error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to queue email" });
  }
});

// GET /emails?inbox=...
router.get("/", async (req: Request, res: Response) => {
  try {
    const raw = req.query.inbox;
    const inbox = Array.isArray(raw) ? raw[0] : raw;

    if (!inbox || typeof inbox !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Query param inbox is required" });
    }

    const emails = await listEmails(inbox.toLowerCase());
    return res.json({ success: true, data: emails });
  } catch (error) {
    console.error("❌ List emails error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to list emails" });
  }
});

// GET /emails/code?inbox=...
router.get("/code", async (req: Request, res: Response) => {
  try {
    const raw = req.query.inbox;
    const inbox = Array.isArray(raw) ? raw[0] : raw;

    if (!inbox || typeof inbox !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Query param inbox is required" });
    }

    const code = await getLatestConfirmationCode(inbox.toLowerCase());
    return res.json({ success: true, data: code });
  } catch (error) {
    console.error("❌ Get code error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to get code" });
  }
});

// PATCH /emails/:id/read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (typeof id !== "string") {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    await markEmailRead(id);
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Mark read error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to mark read" });
  }
});

export default router;
