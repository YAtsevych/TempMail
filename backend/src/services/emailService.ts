import pool from "../db";
import { del, get, setWithTTL } from "./redisService";
import { extractConfirmationCode } from "../utils/extractConfirmationCode";
import type { CreateEmailInput, Email } from "../types/email";

const EMAILS_TTL = 60 * 60; // 1 час

const emailsKey = (inbox: string) => `emails:${inbox}`;
const codeKey = (inbox: string) => `code:${inbox}`;

export const createEmail = async (input: CreateEmailInput): Promise<Email> => {
  const expiresAt = new Date(Date.now() + EMAILS_TTL * 1000);

  const textForCode = `${input.subject ?? ""}\n${input.body_text ?? ""}\n${input.body_html ?? ""}`;
  const confirmationCode = extractConfirmationCode(textForCode);

  const result = await pool.query<Email>(
    `INSERT INTO emails (inbox_address, from_address, subject, body_html, body_text, confirmation_code, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.inbox_address,
      input.from_address,
      input.subject ?? null,
      input.body_html ?? null,
      input.body_text ?? null,
      confirmationCode,
      expiresAt,
    ],
  );

  const email = result.rows[0];

  // Инвалидация кеша списка писем
  await del(emailsKey(input.inbox_address));

  // Если нашли confirmation_code — кладём в Redis отдельно (удобно для расширения/extension)
  if (confirmationCode) {
    await setWithTTL(
      codeKey(input.inbox_address),
      { code: confirmationCode, email_id: email.id },
      10 * 60,
    ); // 10 мин
  }

  return email;
};

export const listEmails = async (inboxAddress: string): Promise<Email[]> => {
  // 1) Redis cache
  const cached = await get<Email[]>(emailsKey(inboxAddress));
  if (cached) return cached;

  // 2) Postgres
  const result = await pool.query<Email>(
    `SELECT * FROM emails
     WHERE inbox_address = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [inboxAddress],
  );

  const emails = result.rows;

  // 3) Cache
  await setWithTTL(emailsKey(inboxAddress), emails, EMAILS_TTL);

  return emails;
};

export const getLatestConfirmationCode = async (
  inboxAddress: string,
): Promise<{ code: string; email_id: string } | null> => {
  const cached = await get<{ code: string; email_id: string }>(
    codeKey(inboxAddress),
  );
  if (cached) return cached;

  // Если в Redis нет — попробуем найти в Postgres
  const result = await pool.query<{ confirmation_code: string; id: string }>(
    `SELECT id, confirmation_code
     FROM emails
     WHERE inbox_address = $1 AND confirmation_code IS NOT NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [inboxAddress],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const payload = { code: row.confirmation_code, email_id: row.id };

  // Cache на 10 минут
  await setWithTTL(codeKey(inboxAddress), payload, 10 * 60);

  return payload;
};

export const markEmailRead = async (emailId: string): Promise<void> => {
  await pool.query(`UPDATE emails SET is_read = TRUE WHERE id = $1`, [emailId]);
};
