import { Router, Request, Response } from "express";
import {
  createInbox,
  getInboxByAddress,
  getInboxByToken,
  deleteInbox,
} from "../services/inboxService";

const router = Router();

// POST /inbox/create — создать новый inbox
router.post("/create", async (req: Request, res: Response) => {
  try {
    const inbox = await createInbox();

    res.status(201).json({
      success: true,
      data: {
        address: inbox.address,
        token: inbox.token,
        expires_at: inbox.expires_at,
      },
    });
  } catch (error) {
    console.error("❌ Create inbox error:", error);
    res.status(500).json({ success: false, error: "Failed to create inbox" });
  }
});

// GET /inbox/:address — получить inbox
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const raw = req.params.address;
    const address = Array.isArray(raw) ? raw[0] : raw;
    const inbox = await getInboxByAddress(address);

    if (!inbox) {
      return res.status(404).json({
        success: false,
        error: "Inbox not found or expired",
      });
    }

    res.json({
      success: true,
      data: {
        address: inbox.address,
        expires_at: inbox.expires_at,
        last_active: inbox.last_active,
      },
    });
  } catch (error) {
    console.error("❌ Get inbox error:", error);
    res.status(500).json({ success: false, error: "Failed to get inbox" });
  }
});

// DELETE /inbox/:address — удалить inbox
router.delete("/:address", async (req: Request, res: Response) => {
  try {
    const raw = req.params.address;
    const address = Array.isArray(raw) ? raw[0] : raw;

    const inbox = await getInboxByAddress(address);
    if (!inbox) {
      return res.status(404).json({
        success: false,
        error: "Inbox not found",
      });
    }

    await deleteInbox(address);

    res.json({ success: true, message: "Inbox deleted" });
  } catch (error) {
    console.error("❌ Delete inbox error:", error);
    res.status(500).json({ success: false, error: "Failed to delete inbox" });
  }
});

export default router;
