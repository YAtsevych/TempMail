// REST API для роботи з листами

import { Router, Request, Response } from "express";
import {
  getLatestConfirmationCode,
  listEmails,
  markEmailRead,
} from "../services/emailService";
import { emailQueue } from "../queues/emailQueue";
import { classifyEmail, getPriority } from "../utils/classifier";

const router = Router();

// POST /emails — приймаємо лист і кладемо в чергу
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

    const { type: priorityClass } = classifyEmail({
      subject,
      body_text,
      body_html,
      from_address,
      attachments,
    });

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
      `[emails] ✅ Job ${job.id} | type=${priorityClass} | inbox=${inbox_address}`,
    );

    return res.status(202).json({
      success: true,
      jobId: job.id,
      priority: priorityClass,
    });
  } catch (error) {
    console.error("[emails] ❌ Queue error:", (error as Error).message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to queue email" });
  }
});

// GET /emails?inbox=... — отримати список листів
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
    console.error("[emails] ❌ List error:", (error as Error).message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to list emails" });
  }
});

// GET /emails/code?inbox=... — останній код підтвердження
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
    console.error("[emails] ❌ Code error:", (error as Error).message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to get code" });
  }
});

// PATCH /emails/:id/read — позначити як прочитане
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string") {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }
    await markEmailRead(id);
    return res.json({ success: true });
  } catch (error) {
    console.error("[emails] ❌ Mark read error:", (error as Error).message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to mark read" });
  }
});

export default router;
