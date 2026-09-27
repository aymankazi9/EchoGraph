-- 036_handwritten_pages.sql
-- Stores per-file encrypted OCR text for handwritten photo/image uploads.
-- Each row represents one uploaded file (a single image or a multi-page PDF),
-- ordered by session_files.order_index so pages concatenate correctly.

CREATE TABLE IF NOT EXISTS handwritten_pages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  file_id        UUID        NOT NULL REFERENCES files(id)    ON DELETE CASCADE,
  order_index    INT         NOT NULL,  -- matches session_files.order_index
  text_encrypted TEXT        NOT NULL,  -- encryptText() output ("ctB64:ivB64")
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handwritten_pages_session_idx ON handwritten_pages(session_id);

ALTER TABLE handwritten_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON handwritten_pages
  FOR ALL
  USING  (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()));
