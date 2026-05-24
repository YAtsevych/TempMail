// Визначає тип листа: mice (OTP, підтвердження) або elephant (розсилка, реклама)
// Використовує зважену систему ознак — чим більше балів, тим впевненіша класифікація

export interface ClassifyInput {
  subject?: string;
  body_text?: string;
  body_html?: string;
  from_address?: string;
  attachments?: Array<{ size?: number; content_type?: string }>;
}

export interface ClassifyResult {
  type: "mice" | "elephant";
  score: { mice: number; elephant: number };
  reasons: string[];
}

// Ознаки транзакційного листа (mice)
const MICE_SUBJECT_PATTERNS = [
  { pattern: /\b(OTP|one.time.pass)/i, score: 5, label: "OTP в subject" },
  {
    pattern: /\b(verification|verify|verified)/i,
    score: 4,
    label: "verify в subject",
  },
  {
    pattern: /\b(confirm|confirmation)/i,
    score: 4,
    label: "confirm в subject",
  },
  { pattern: /\b(code|passcode|pin)\b/i, score: 3, label: "code в subject" },
  {
    pattern: /\b(password.reset|reset.password)/i,
    score: 4,
    label: "reset пароля",
  },
  {
    pattern: /\b(login|sign.in|signin)\b/i,
    score: 3,
    label: "login в subject",
  },
  {
    pattern: /\b(alert|warning|urgent|important)/i,
    score: 2,
    label: "urgent в subject",
  },
  {
    pattern: /\b(invoice|receipt|order.#?\d+)/i,
    score: 3,
    label: "транзакція в subject",
  },
  { pattern: /\b(welcome|account.created)/i, score: 2, label: "welcome лист" },
];

const MICE_FROM_PATTERNS = [
  {
    pattern: /noreply|no-reply|donotreply/i,
    score: 3,
    label: "noreply відправник",
  },
  {
    pattern: /notify|notification|alert/i,
    score: 2,
    label: "notify відправник",
  },
  { pattern: /security|auth|account/i, score: 2, label: "security відправник" },
  { pattern: /support|help|service/i, score: 1, label: "support відправник" },
];

// Ознаки масової розсилки (elephant)
const ELEPHANT_SUBJECT_PATTERNS = [
  {
    pattern: /newsletter|digest|weekly|monthly/i,
    score: 5,
    label: "newsletter в subject",
  },
  {
    pattern: /unsubscribe|opt.out|manage.preferences/i,
    score: 5,
    label: "unsubscribe в subject",
  },
  {
    pattern: /sale|discount|offer|deal|promo/i,
    score: 3,
    label: "промо в subject",
  },
  {
    pattern: /update[sd]?.*from|news.from/i,
    score: 2,
    label: "update/news розсилка",
  },
];

const ELEPHANT_FROM_PATTERNS = [
  {
    pattern: /newsletter|marketing|promo|campaign/i,
    score: 4,
    label: "marketing відправник",
  },
  { pattern: /news@|digest@|updates@/i, score: 3, label: "news відправник" },
  {
    pattern: /mailchimp|sendgrid|klaviyo|hubspot/i,
    score: 3,
    label: "ESP сервіс",
  },
];

// Пороги розміру для класифікації
const SIZE_THRESHOLDS = {
  definitelyMice: 2 * 1024, // < 2KB   → майже точно mice
  likelyMice: 10 * 1024, // < 10KB  → схоже на mice
  likelyElephant: 50 * 1024, // > 50KB  → схоже на elephant
  definitelyElephant: 200 * 1024, // > 200KB → точно elephant
};

export function classifyEmail(input: ClassifyInput): ClassifyResult {
  const {
    subject = "",
    body_text = "",
    body_html = "",
    from_address = "",
    attachments = [],
  } = input;

  let miceScore = 0;
  let elephantScore = 0;
  const reasons: string[] = [];

  // Аналізуємо subject
  for (const { pattern, score, label } of MICE_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      miceScore += score;
      reasons.push(label);
    }
  }
  for (const { pattern, score, label } of ELEPHANT_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      elephantScore += score;
      reasons.push(`[elephant] ${label}`);
    }
  }

  // Аналізуємо відправника
  for (const { pattern, score, label } of MICE_FROM_PATTERNS) {
    if (pattern.test(from_address)) {
      miceScore += score;
      reasons.push(label);
    }
  }
  for (const { pattern, score, label } of ELEPHANT_FROM_PATTERNS) {
    if (pattern.test(from_address)) {
      elephantScore += score;
      reasons.push(`[elephant] ${label}`);
    }
  }

  // Розмір листа
  const totalSize =
    (body_text?.length ?? 0) +
    (body_html?.length ?? 0) +
    attachments.reduce((sum, a) => sum + (a.size ?? 0), 0);

  if (totalSize < SIZE_THRESHOLDS.definitelyMice) {
    miceScore += 4;
    reasons.push(`розмір ${totalSize}B < 2KB`);
  } else if (totalSize < SIZE_THRESHOLDS.likelyMice) {
    miceScore += 2;
    reasons.push(`розмір ${totalSize}B < 10KB`);
  } else if (totalSize > SIZE_THRESHOLDS.definitelyElephant) {
    elephantScore += 5;
    reasons.push(`[elephant] розмір ${totalSize}B > 200KB`);
  } else if (totalSize > SIZE_THRESHOLDS.likelyElephant) {
    elephantScore += 3;
    reasons.push(`[elephant] розмір ${totalSize}B > 50KB`);
  }

  // Вкладення => завжди підозріло для транзакційного листа
  if (attachments.length > 0) {
    elephantScore += Math.min(attachments.length * 2, 6);
    reasons.push(`[elephant] ${attachments.length} вкладень`);
  }

  // Якщо HTML набагато більший за текст == це розсилка
  const htmlRatio = body_html.length / Math.max(body_text.length || 1, 1);
  if (htmlRatio > 10) {
    elephantScore += 3;
    reasons.push(`[elephant] HTML/text ratio=${htmlRatio.toFixed(1)}`);
  }

  // Посилання на відписку +- маркер маркетингового листа
  if (/unsubscribe|opt.out|manage.subscription/i.test(body_html + body_text)) {
    elephantScore += 3;
    reasons.push("[elephant] unsubscribe в body");
  }

  // При рівних балах — mice, бо транзакційний трафік важливіший
  const type: "mice" | "elephant" =
    miceScore >= elephantScore ? "mice" : "elephant";

  return { type, score: { mice: miceScore, elephant: elephantScore }, reasons };
}

export function getPriority(type: "mice" | "elephant"): number {
  // BullMQ: більше число = вищий пріоритет
  return type === "mice" ? 2 : 1;
}
