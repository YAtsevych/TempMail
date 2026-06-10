export interface ClassifyInput {
  subject?: string;
  body_text?: string;
  body_html?: string;
  from_address?: string;
  attachments?: Array<{ size?: number; content_type?: string }>;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ClassifyResult {
  type: "mice" | "elephant";
  score: { mice: number; elephant: number };
  reasons: string[];
}

// Функція для нормалізації заголовків (завжди lower-case для пошуку)
const getHeader = (headers: Record<string, any>, key: string): string => {
  const value = headers[key.toLowerCase()] || headers[key] || "";
  return Array.isArray(value) ? value.join(" ") : String(value);
};

const BOUNDARY_START = "(?<!\\p{L})";
const BOUNDARY_END = "(?!\\p{L})";

//АТОМАРНІ ПАТЕРНИ на основні мов: EN, RU, UK, ES, FR, DE, RO
const MICE_SUBJECT_PATTERNS = [
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:otp|one[- ]time[- ]pass|code|passcode|pin|код|cod)${BOUNDARY_END}`,
      "iu",
    ),
    score: 6,
    label: "OTP/Code маркер (багатомовний)",
  },
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:verification|verify|confirm|confirmation|підтвердження|подтверждение|verificación|confirmación|bestätigung|confirmare)${BOUNDARY_END}`,
      "iu",
    ),
    score: 5,
    label: "Verify/Confirm маркер (багатомовний)",
  },
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:password[- ]reset|reset|пароль|recuperar|réinitialiser|passwort|parolă)${BOUNDARY_END}`,
      "iu",
    ),
    score: 5,
    label: "Reset Password маркер (багатомовний)",
  },
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:login|sign[- ]in|вхід|вход|iniciar sesión|connexion|anmelden|autentificare)${BOUNDARY_END}`,
      "iu",
    ),
    score: 3,
    label: "Login маркер (багатомовний)",
  },
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:invoice|receipt|order|рахунок|чек|замовлення|квитанція|оплата|factura|recibo|facture|rechnung|comandă)${BOUNDARY_END}`,
      "iu",
    ),
    score: 4,
    label: "Транзакційний маркер (багатомовний)",
  },
];

const ELEPHANT_SUBJECT_PATTERNS = [
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:newsletter|digest|weekly|monthly|boletín|lettre|rundschreiben|buletin)${BOUNDARY_END}`,
      "iu",
    ),
    score: 6,
    label: "Newsletter маркер (багатомовний)",
  },
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:unsubscribe|opt[- ]out|відписатися|отписаться|cancelar|désabonner|abmelden|dezabonare)${BOUNDARY_END}`,
      "iu",
    ),
    score: 6,
    label: "Unsubscribe маркер (багатомовний)",
  },
  {
    pattern: new RegExp(
      `${BOUNDARY_START}(?:sale|discount|offer|promo|win|знижка|акція|розпродаж|виграш|безкоштовно|oferta|réduction|rabatt|reduceri)${BOUNDARY_END}`,
      "iu",
    ),
    score: 8,
    label: "💥 Промо маркер (багатомовний)",
  },
];

const ELEPHANT_FROM_PATTERNS = [
  {
    pattern: /newsletter|marketing|promo|campaign|offers|boletin/i,
    score: 5,
    label: "Marketing відправник",
  },
  {
    pattern: /news@|digest@|updates@|info@/i,
    score: 2,
    label: "News/Info відправник",
  },
  {
    pattern: /mailchimp|sendgrid|klaviyo|hubspot|mailer|brevo|mailgun/i,
    score: 4,
    label: "ESP сервіс розсилок",
  },
];

const SIZE_THRESHOLDS = {
  definitelyMice: 2.5 * 1024,
  likelyMice: 10 * 1024,
  likelyElephant: 50 * 1024,
  definitelyElephant: 102 * 1024,
};

export function classifyEmail(input: ClassifyInput): ClassifyResult {
  const {
    subject = "",
    body_text = "",
    body_html = "",
    from_address = "",
    attachments = [],
    headers = {},
  } = input;

  let miceScore = 0;
  let elephantScore = 0;
  const reasons: string[] = [];

  // Нормалізація для пошуку
  const searchSubject = subject.toLowerCase();
  const searchFrom = from_address.toLowerCase();
  const fullBody = (body_html + " " + body_text).toLowerCase();

  // АНАЛІЗ RFC / SMTP ЗАГОЛОВКІВ (Мовно-агностичні індикатори)
  const listUnsubscribe = getHeader(headers, "list-unsubscribe");
  const autoSubmitted = getHeader(headers, "auto-submitted").toLowerCase();
  const xMailer = getHeader(headers, "x-mailer").toLowerCase();
  const feedbackId = getHeader(headers, "feedback-id"); // Популярно у масових розсилках (Gmail/AWS)

  if (listUnsubscribe || feedbackId) {
    elephantScore += 7;
    reasons.push(
      "[elephant] Виявлено службові заголовки масової розсилки (List-Unsubscribe / Feedback-ID)",
    );
  }

  if (
    autoSubmitted.includes("auto-generated") ||
    autoSubmitted.includes("auto-replied")
  ) {
    miceScore += 5;
    reasons.push(
      "Виявлено заголовок Auto-Submitted: auto-generated (Ознака системного листа)",
    );
  }

  if (/mailchimp|sendgrid|phpmailer|mailerlite/i.test(xMailer)) {
    elephantScore += 3;
    reasons.push(
      `[elephant] Маркетинговий X-Mailer: ${xMailer.substring(0, 20)}`,
    );
  }

  // АНАЛІЗ ТЕМИ ЛИСТА
  for (const { pattern, score, label } of MICE_SUBJECT_PATTERNS) {
    if (pattern.test(searchSubject)) {
      miceScore += score;
      reasons.push(label);
    }
  }
  for (const { pattern, score, label } of ELEPHANT_SUBJECT_PATTERNS) {
    if (pattern.test(searchSubject)) {
      elephantScore += score;
      reasons.push(`[elephant] ${label}`);
    }
  }

  // АНАЛІЗ ВІДПРАВНИКА
  if (/noreply|no-reply|donotreply/i.test(searchFrom)) {
    miceScore += 1;
    reasons.push("Noreply відправник");
  } else if (
    /notify|notification|alert|security|auth|account|support|help/i.test(
      searchFrom,
    )
  ) {
    miceScore += 2;
    reasons.push("Системний відправник (notify/security)");
  }

  for (const { pattern, score, label } of ELEPHANT_FROM_PATTERNS) {
    if (pattern.test(searchFrom)) {
      elephantScore += score;
      reasons.push(`[elephant] ${label}`);
    }
  }

  // ГЕОМЕТРІЯ ПАКЕТА
  const totalSize =
    body_text.length +
    body_html.length +
    attachments.reduce((sum, a) => sum + (a.size ?? 0), 0);

  if (totalSize > 0) {
    if (totalSize < SIZE_THRESHOLDS.definitelyMice) {
      miceScore += 3;
      reasons.push(`Мікро-розмір ${totalSize}B (<2.5KB)`);
    } else if (totalSize < SIZE_THRESHOLDS.likelyMice) {
      miceScore += 1;
      reasons.push(`Розмір ${totalSize}B < 10KB`);
    } else if (totalSize > SIZE_THRESHOLDS.definitelyElephant) {
      elephantScore += 6;
      reasons.push(`[elephant] Розмір ${totalSize}B перевищує ліміт (>102KB)`);
    } else if (totalSize > SIZE_THRESHOLDS.likelyElephant) {
      elephantScore += 3;
      reasons.push(`[elephant] Великий розмір ${totalSize}B > 50KB`);
    }
  }

  // СТРУКТУРНІ АНОМАЛІЇ (HTML-to-Text)
  const textLen = Math.max(body_text.length, 1);
  const htmlLen = body_html.length;
  const htmlRatio = htmlLen / textLen;

  if (htmlLen > 0) {
    if (htmlRatio > 12.0) {
      elephantScore += 5;
      reasons.push(
        `[elephant] Аномальний HTML-to-Text ratio=${htmlRatio.toFixed(1)}`,
      );
    } else if (htmlRatio > 5.0) {
      elephantScore += 2;
      reasons.push(
        `[elephant] Помірний HTML-to-Text ratio=${htmlRatio.toFixed(1)}`,
      );
    }
  }

  // ГІПЕРПОСИЛАННЯ
  const linkCount = (body_html.match(/href=/gi) || []).length;
  if (linkCount > 4) {
    elephantScore += Math.min(linkCount - 2, 6);
    reasons.push(`[elephant] Виявлено масив гіперпосилань: ${linkCount}`);
  }

  // ПОШУК ТЕКСТОВИХ ПЛАШОК ВІДПИСКИ (Багатомовний)
  if (
    /(?:unsubscribe|opt[- ]out|відписатися|отписаться|cancelar|désabonner|abmelden|dezabonare)/i.test(
      fullBody,
    )
  ) {
    elephantScore += 3;
    reasons.push("[elephant] Текстова інструкція відписки в тілі");
  }

  // ЦИФРОВІ АВТЕНТИФІКАЦІЙНІ ТОКЕНИ
  // Використовуємо універсальні межі замість \b для коректної ізоляції
  if (
    totalSize < 12000 &&
    /(?:^|\s|>)(?:\d{4,8}|[a-z0-9]{3,4}-\d{3,4})(?:\s|<|$)/i.test(
      fullBody + " " + searchSubject,
    )
  ) {
    miceScore += 5;
    reasons.push("Виявлено сигнатуру цифрового токена (OTP/2FA)");
  }

  //ФІНАЛЬНИЙ СЕЙФГАРД
  let type: "mice" | "elephant" = "elephant";

  if (miceScore === 0 && elephantScore === 0) {
    type = "elephant";
    reasons.push("Нейтральний потік (Дефолтний поріг)");
  } else if (miceScore >= elephantScore) {
    type = "mice";
  } else {
    type = "elephant";
  }

  return { type, score: { mice: miceScore, elephant: elephantScore }, reasons };
}

export function getPriority(type: "mice" | "elephant"): number {
  return type === "mice" ? 1 : 10;
}
