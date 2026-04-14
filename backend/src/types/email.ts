export interface Email {
  id: string;
  inbox_address: string;
  from_address: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  confirmation_code: string | null;
  is_read: boolean;
  created_at: Date;
  expires_at: Date;
}

export interface CreateEmailInput {
  inbox_address: string;
  from_address: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
}
