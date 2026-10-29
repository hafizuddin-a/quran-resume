-- Place sync: one row per pairing between the extension and its phones.
CREATE TABLE IF NOT EXISTS pairs (
  code TEXT PRIMARY KEY,            -- long random secret held by the paired devices
  verse_key TEXT,                   -- e.g. "2:90"
  saved_at INTEGER NOT NULL DEFAULT 0,
  phones INTEGER NOT NULL DEFAULT 0,
  link_code TEXT UNIQUE,            -- 6 digits, works once, for 10 minutes
  link_expires INTEGER,
  created_at INTEGER NOT NULL
);

-- Reminders: one row per phone.
CREATE TABLE IF NOT EXISTS phones (
  id TEXT PRIMARY KEY,              -- random id generated on the phone
  subscription TEXT,                -- web push subscription (JSON)
  enabled INTEGER NOT NULL DEFAULT 0,
  times TEXT NOT NULL,              -- JSON, three "HH:MM" values
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  day TEXT,                         -- the phone's local date that sent/acked refer to
  sent TEXT NOT NULL DEFAULT '[]',  -- JSON, reminder slots sent that day
  acked INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER                   -- when the next reminder is due (epoch ms); the sender reads only due rows
);
CREATE INDEX IF NOT EXISTS phones_due ON phones (next_at);

-- Wrong link codes per visitor and minute, so 6-digit codes can't be guessed.
-- Rows are only written on a wrong code and cleared after an hour.
CREATE TABLE IF NOT EXISTS link_failures (
  ip TEXT NOT NULL,
  minute INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, minute)
);
