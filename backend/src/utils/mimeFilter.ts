// backend/src/utils/mimeFilter.ts
// MIME-фільтр — 3-й ешелон захисту (Розділ 1.3 диплому).
// Викликається в queueWorker.ts після збереження в БД — до парсингу вкладень.
// Відкидає аномальні структури ДО того як вони споживають CPU парсера.
//
// Правила з диплому:
//   - Вкладення > 25MB → reject (MIME-бомба за розміром)
//   - Сумарний розмір > 50MB → reject (ZIP-бомба)
//   - Кількість вкладень > 20 → reject (MIME-бомба за кількістю)
//   - Body > 1MB → reject (аномально великий лист)
//   - Небезпечні MIME-типи → reject

// Результат фільтрації
export interface MimeFilterResult {
  passed: boolean;
  reason?: string; // причина відхилення (для логів Розділу 3)
  rule?: string; // яке правило спрацювало (RULE_1, RULE_2...)
}

// Вхідні дані для фільтра
export interface MimeFilterInput {
  bodyText?: string | null;
  bodyHtml?: string | null;
  attachments?: Array<{
    name?: string;
    size?: number;
    content_type?: string;
  }>;
}

// Небезпечні MIME-типи виконуваних файлів
const DANGEROUS_MIME_TYPES = new Set([
  "application/x-executable",
  "application/x-msdownload",
  "application/x-sh",
  "application/bat",
  "application/x-bat",
  "application/x-msdos-program",
]);

// Небезпечні розширення файлів (додатковий захист)
const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".sh",
  ".cmd",
  ".com",
  ".vbs",
  ".ps1",
  ".msi",
  ".jar",
]);

/**
 * Запускає MIME-фільтрацію вхідного листа.
 * Повертає { passed: true } якщо лист безпечний.
 * Повертає { passed: false, reason, rule } якщо лист відхилено.
 *
 * Складність: O(n) де n = кількість вкладень.
 * Викликається до парсингу — CPU не витрачається на небезпечний контент.
 */
export function runMimeFilter(input: MimeFilterInput): MimeFilterResult {
  const attachments = input.attachments ?? [];

  // ── RULE_1: Розмір окремого вкладення ────────────────
  // MIME-бомби генеруються з розміром від кількох десятків MB.
  // Легітимні вкладення рідко перевищують 10-15MB.
  // Поріг 25MB дає запас для легітимних файлів.
  const MAX_SINGLE_ATTACHMENT = 25 * 1024 * 1024; // 25MB
  for (const attachment of attachments) {
    if ((attachment.size ?? 0) > MAX_SINGLE_ATTACHMENT) {
      return {
        passed: false,
        reason: `Attachment "${attachment.name ?? "unknown"}" size ${attachment.size} bytes exceeds 25MB limit`,
        rule: "RULE_1",
      };
    }
  }

  // ── RULE_2: Сумарний розмір всіх вкладень ────────────
  // ZIP-бомба: архів 1KB розпаковується в 1GB.
  // Сумарний розмір > 50MB — аномалія для поштового сервісу.
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
  const totalSize = attachments.reduce((sum, a) => sum + (a.size ?? 0), 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      passed: false,
      reason: `Total attachments size ${totalSize} bytes exceeds 50MB limit`,
      rule: "RULE_2",
    };
  }

  // ── RULE_3: Кількість вкладень ────────────────────────
  // MIME-бомба через кількість: 1000 вкладень по 1KB.
  // Легітимні листи мають до 5-10 вкладень.
  // Поріг 20 дає запас для корпоративних листів.
  const MAX_ATTACHMENTS = 20;
  if (attachments.length > MAX_ATTACHMENTS) {
    return {
      passed: false,
      reason: `Too many attachments: ${attachments.length} (max ${MAX_ATTACHMENTS})`,
      rule: "RULE_3",
    };
  }

  // ── RULE_4: Розмір тіла листа ─────────────────────────
  // Нормальний лист: до 100KB.
  // Розсилка з HTML: до 500KB.
  // > 1MB — аномалія, можлива атака через body flooding.
  const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
  const bodySize =
    (input.bodyText?.length ?? 0) + (input.bodyHtml?.length ?? 0);
  if (bodySize > MAX_BODY_SIZE) {
    return {
      passed: false,
      reason: `Body size ${bodySize} bytes exceeds 1MB limit`,
      rule: "RULE_4",
    };
  }

  // ── RULE_5: Небезпечні MIME-типи ─────────────────────
  // Виконувані файли не мають легітимної причини бути у тимчасовій пошті.
  for (const attachment of attachments) {
    const mimeType = (attachment.content_type ?? "").toLowerCase();
    const fileName = (attachment.name ?? "").toLowerCase();
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";

    if (DANGEROUS_MIME_TYPES.has(mimeType) || DANGEROUS_EXTENSIONS.has(ext)) {
      return {
        passed: false,
        reason: `Dangerous attachment: name="${attachment.name}" type="${attachment.content_type}"`,
        rule: "RULE_5",
      };
    }
  }

  // Всі правила пройдено — лист безпечний
  return { passed: true };
}
