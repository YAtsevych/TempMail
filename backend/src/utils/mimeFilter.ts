// Перевіряє лист на аномалії до того як він потрапить в БД

export interface MimeFilterResult {
  passed: boolean;
  reason?: string;
  rule?: string;
}

export interface MimeFilterInput {
  bodyText?: string | null;
  bodyHtml?: string | null;
  attachments?: Array<{
    name?: string;
    size?: number;
    content_type?: string;
  }>;
}

// Виконувані файли
const DANGEROUS_MIME_TYPES = new Set([
  "application/x-executable",
  "application/x-msdownload",
  "application/x-sh",
  "application/bat",
  "application/x-bat",
  "application/x-msdos-program",
]);

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

export function runMimeFilter(input: MimeFilterInput): MimeFilterResult {
  const attachments = input.attachments ?? [];

  // Одне вкладення більше 25MB = підозріло
  const MAX_SINGLE_ATTACHMENT = 25 * 1024 * 1024;
  for (const attachment of attachments) {
    if ((attachment.size ?? 0) > MAX_SINGLE_ATTACHMENT) {
      return {
        passed: false,
        reason: `"${attachment.name ?? "unknown"}" важить ${attachment.size} байт — більше 25MB`,
        rule: "RULE_1",
      };
    }
  }

  // Сума всіх вкладень більше 50MB = схоже на ZIP-бомбу
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  const totalSize = attachments.reduce((sum, a) => sum + (a.size ?? 0), 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      passed: false,
      reason: `Загальний розмір вкладень ${totalSize} байт — більше 50MB`,
      rule: "RULE_2",
    };
  }

  // Більше 20 вкладень = нетипово для звичайного листа
  const MAX_ATTACHMENTS = 20;
  if (attachments.length > MAX_ATTACHMENTS) {
    return {
      passed: false,
      reason: `Забагато вкладень: ${attachments.length} (максимум ${MAX_ATTACHMENTS})`,
      rule: "RULE_3",
    };
  }

  // Тіло листа більше 1MB == явна аномалія
  const MAX_BODY_SIZE = 1 * 1024 * 1024;
  const bodySize =
    (input.bodyText?.length ?? 0) + (input.bodyHtml?.length ?? 0);
  if (bodySize > MAX_BODY_SIZE) {
    return {
      passed: false,
      reason: `Тіло листа ${bodySize} байт — більше 1MB`,
      rule: "RULE_4",
    };
  }

  // Виконувані файли === блокуємо незалежно від розміру
  for (const attachment of attachments) {
    const mimeType = (attachment.content_type ?? "").toLowerCase();
    const fileName = (attachment.name ?? "").toLowerCase();
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop() : "";

    if (DANGEROUS_MIME_TYPES.has(mimeType) || DANGEROUS_EXTENSIONS.has(ext)) {
      return {
        passed: false,
        reason: `Небезпечний файл: "${attachment.name}" (${attachment.content_type})`,
        rule: "RULE_5",
      };
    }
  }

  return { passed: true };
}
