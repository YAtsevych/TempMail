export function classifyEmail({
  subject = "",
  body_text = "",
  body_html = "",
  attachments = [],
}: {
  subject?: string;
  body_text?: string;
  body_html?: string;
  attachments?: Array<{ size?: number }>;
}): "mice" | "elephant" {
  const size =
    (body_text?.length || 0) +
    (body_html?.length || 0) +
    (attachments?.reduce((sum, a) => sum + (a.size || 0), 0) || 0);

  const miceBySubject = /(OTP|code|verification|confirm)/i.test(subject);
  if (miceBySubject || size < 10 * 1024) return "mice";
  return "elephant";
}

export function getPriority(type: "mice" | "elephant") {
  return type === "mice" ? 2 : 1;
}
