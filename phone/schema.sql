-- One row per paired phone/computer set. `code` is the secret in the phone link.
CREATE TABLE IF NOT EXISTS places (
  code       TEXT PRIMARY KEY,
  verse_key  TEXT,                       -- like "2:9"; NULL until a place is saved
  saved_at   INTEGER NOT NULL DEFAULT 0, -- when the place was saved (ms since epoch)
  updated_at INTEGER NOT NULL            -- last time the row was used, for clean-up
);
CREATE INDEX IF NOT EXISTS places_updated_at ON places (updated_at);
