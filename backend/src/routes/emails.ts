import { Router, Request, Response } from "express";
import {
  createEmail,
  getLatestConfirmationCode,
  listEmails,
  markEmailRead,
} from "../services/emailService";

const router = Router();

// POST /emails (эмуляция входящего письма)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { inbox_address, from_address, subject, body_html, body_text } =
      req.body ?? {};

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

    const email = await createEmail({
      inbox_address,
      from_address,
      subject,
      body_html,
      body_text,
    });

    return res.status(201).json({ success: true, data: email });
  } catch (error) {
    console.error("❌ Create email error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create email" });
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

    const emails = await listEmails(inbox);
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

    const code = await getLatestConfirmationCode(inbox);
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
