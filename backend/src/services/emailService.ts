import pool from "../db";
import { del, get, setWithTTL } from "./redisService";
import { extractConfirmationCode } from "../utils/extractConfirmationCode";
import type { CreateEmailInput, Email } from "../types/email";

const EMAILS_TTL = 60 * 60; // 1 час
const EMPTY_CACHE_TTL = 5; // 5 секунд, чтобы пустой список не залипал

const normalizeInbox = (inbox: string) => inbox.toLowerCase();
const emailsKey = (inbox: string) => `emails:${normalizeInbox(inbox)}`;
const codeKey = (inbox: string) => `code:${normalizeInbox(inbox)}`;

export const createEmail = async (input: CreateEmailInput): Promise<Email> => {
  const expiresAt = new Date(Date.now() + EMAILS_TTL * 1000);
  const inbox = normalizeInbox(input.inbox_address);

  const textForCode = `${input.subject ?? ""}\n${input.body_text ?? ""}\n${input.body_html ?? ""}`;
  const confirmationCode = extractConfirmationCode(textForCode);

  const result = await pool.query<Email>(
    `INSERT INTO emails (inbox_address, from_address, subject, body_html, body_text, confirmation_code, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      inbox,
      input.from_address,
      input.subject ?? null,
      input.body_html ?? null,
      input.body_text ?? null,
      confirmationCode,
      expiresAt,
    ],
  );

  const email = result.rows[0];

  // ✅ инвалидируем правильный ключ
  await del(emailsKey(inbox));

  if (confirmationCode) {
    await setWithTTL(
      codeKey(inbox),
      { code: confirmationCode, email_id: email.id },
      10 * 60,
    );
  }

  return email;
};

export const listEmails = async (inboxAddress: string): Promise<Email[]> => {
  const inbox = normalizeInbox(inboxAddress);

  const result = await pool.query<Email>(
    `SELECT * FROM emails
     WHERE inbox_address = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [inbox],
  );

  const emails = result.rows;

  // ✅ если пусто — кэшируем на 5 сек, чтобы не залипало
  await setWithTTL(
    emailsKey(inbox),
    emails,
    emails.length === 0 ? EMPTY_CACHE_TTL : EMAILS_TTL,
  );

  return emails;
};

export const getLatestConfirmationCode = async (
  inboxAddress: string,
): Promise<{ code: string; email_id: string } | null> => {
  const inbox = normalizeInbox(inboxAddress);

  const result = await pool.query<{ confirmation_code: string; id: string }>(
    `SELECT id, confirmation_code
     FROM emails
     WHERE inbox_address = $1 AND confirmation_code IS NOT NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [inbox],
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const payload = { code: row.confirmation_code, email_id: row.id };

  await setWithTTL(codeKey(inbox), payload, 10 * 60);

  return payload;
};

export const markEmailRead = async (emailId: string): Promise<void> => {
  await pool.query(`UPDATE emails SET is_read = TRUE WHERE id = $1`, [emailId]);
};
