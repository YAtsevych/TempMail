-- Таблица inbox адресов
CREATE TABLE IF NOT EXISTS inboxes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address     VARCHAR(255) UNIQUE NOT NULL,
  token       VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  expires_at  TIMESTAMP NOT NULL,
  last_active TIMESTAMP DEFAULT NOW()
);

-- Таблица писем
CREATE TABLE IF NOT EXISTS emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_address     VARCHAR(255) NOT NULL,
  from_address      VARCHAR(255) NOT NULL,
  subject           VARCHAR(500),
  body_html         TEXT,
  body_text         TEXT,
  confirmation_code VARCHAR(20),
  is_read           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  expires_at        TIMESTAMP NOT NULL,

  -- Связь с таблицей inboxes
  FOREIGN KEY (inbox_address) 
    REFERENCES inboxes(address) 
    ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_emails_inbox 
  ON emails(inbox_address);

CREATE INDEX IF NOT EXISTS idx_inboxes_address 
  ON inboxes(address);

CREATE INDEX IF NOT EXISTS idx_emails_created 
  ON emails(created_at);