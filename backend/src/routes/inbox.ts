// REST API для управління інбоксами

import { Router, Request, Response } from "express";
import {
  createInbox,
  getInboxByAddress,
  deleteInbox,
} from "../services/inboxService";

const router = Router();

// POST /inbox/create — створити новий інбокс
router.post("/create", async (req: Request, res: Response) => {
  try {
    const inbox = await createInbox();
    res.status(201).json({
      success: true,
      data: {
        address: inbox.address, // lower-case — для логіки
        inbox_address: inbox.inbox_address, // красивий — для UI
        token: inbox.token,
        expires_at: inbox.expires_at,
      },
    });
  } catch (error) {
    console.error("[inbox] ❌ Create error:", (error as Error).message);
    res.status(500).json({ success: false, error: "Failed to create inbox" });
  }
});

// GET /inbox/:address — отримати інбокс
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const raw = req.params.address;
    const address = Array.isArray(raw) ? raw[0] : raw;
    const inbox = await getInboxByAddress(address);

    if (!inbox) {
      return res
        .status(404)
        .json({ success: false, error: "Inbox not found or expired" });
    }

    res.json({
      success: true,
      data: {
        address: inbox.address,
        inbox_address: inbox.inbox_address,
        expires_at: inbox.expires_at,
        last_active: inbox.last_active,
      },
    });
  } catch (error) {
    console.error("[inbox] ❌ Get error:", (error as Error).message);
    res.status(500).json({ success: false, error: "Failed to get inbox" });
  }
});

// DELETE /inbox/:address — видалити інбокс разом з усіма листами
router.delete("/:address", async (req: Request, res: Response) => {
  try {
    const raw = req.params.address;
    const address = Array.isArray(raw) ? raw[0] : raw;
    const inbox = await getInboxByAddress(address);

    if (!inbox) {
      return res.status(404).json({ success: false, error: "Inbox not found" });
    }

    await deleteInbox(address);
    res.json({ success: true, message: "Inbox deleted" });
  } catch (error) {
    console.error("[inbox] ❌ Delete error:", (error as Error).message);
    res.status(500).json({ success: false, error: "Failed to delete inbox" });
  }
});

export default router;
