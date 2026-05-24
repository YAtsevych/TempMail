// backend/src/utils/classifier.ts
// Класифікатор трафіку — 2-й ешелон захисту (Розділ 1.3 диплому).
// Визначає клас повідомлення: mice (пріоритет 2) або elephant (пріоритет 1).
//
// Алгоритм: зважена система ознак.
// Кожна ознака додає бали до mice або elephant.
// Фінальний клас = той що набрав більше балів.
//
// mice  = транзакційні листи (OTP, підтвердження, сповіщення)
//         → малий розмір, ключові слова в subject, один одержувач
// elephant = масові розсилки, newsletters, листи з вкладеннями
//         → великий розмір, HTML-важкий, багато вкладень

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
  reasons: string[]; // для логів Розділу 3
}

// ── Ознаки mice (транзакційний лист) ─────────────────────
// Кожна ознака = кількість балів на користь mice

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

// ── Ознаки elephant (масова розсилка) ────────────────────

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

// ── Розмірні пороги ───────────────────────────────────────
const SIZE_THRESHOLDS = {
  definitelyMice: 2 * 1024, // < 2KB  → майже точно mice  (+4 бали)
  likelyMice: 10 * 1024, // < 10KB → швидше mice        (+2 бали)
  likelyElephant: 50 * 1024, // > 50KB → швидше elephant    (+3 бали)
  definitelyElephant: 200 * 1024, // > 200KB → точно elephant  (+5 балів)
};

/**
 * Класифікує вхідне повідомлення як mice або elephant.
 *
 * @returns ClassifyResult з типом, балами та причинами — для логів Розділу 3
 *
 * LOG формат (queueWorker.ts):
 *   [CLASSIFY] type=mice score={mice:8,elephant:2} reasons=["OTP в subject","noreply відправник"]
 */
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

  // ── 1. Аналіз subject ─────────────────────────────────
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

  // ── 2. Аналіз from_address ────────────────────────────
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

  // ── 3. Розмір повідомлення ────────────────────────────
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

  // ── 4. Вкладення ──────────────────────────────────────
  if (attachments.length > 0) {
    elephantScore += Math.min(attachments.length * 2, 6);
    reasons.push(`[elephant] ${attachments.length} вкладень`);
  }

  // ── 5. HTML-важкість ─────────────────────────────────
  // Транзакційні листи мають простий HTML або лише text.
  // Newsletter = складний HTML з таблицями, стилями, картинками.
  const htmlRatio = body_html.length / Math.max(body_text.length || 1, 1);
  if (htmlRatio > 10) {
    // HTML в 10+ разів більший за text → явна HTML-розсилка
    elephantScore += 3;
    reasons.push(`[elephant] HTML/text ratio=${htmlRatio.toFixed(1)}`);
  }

  // ── 6. Ознаки unsubscribe в body ─────────────────────
  // Наявність посилання на відписку = маркетинговий лист
  if (/unsubscribe|opt.out|manage.subscription/i.test(body_html + body_text)) {
    elephantScore += 4;
    reasons.push("[elephant] unsubscribe в body");
  }

  // ── Фінальне рішення ──────────────────────────────────
  // При рівних балах → mice (пріоритизуємо транзакційний трафік)
  const type: "mice" | "elephant" =
    miceScore >= elephantScore ? "mice" : "elephant";

  return {
    type,
    score: { mice: miceScore, elephant: elephantScore },
    reasons,
  };
}

export function getPriority(type: "mice" | "elephant"): number {
  return type === "mice" ? 2 : 1;
}
