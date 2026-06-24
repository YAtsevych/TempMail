// REST API для роботи з листами

import { Router, Request, Response } from "express";
import {
  getLatestConfirmationCode,
  listEmails,
  markEmailRead,
} from "../services/emailService";

const router = Router();

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
