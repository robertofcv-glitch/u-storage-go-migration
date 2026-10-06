-- Task #118: private customer intake evidence for the admin quote review workspace.
-- Additive and safe to rerun.
CREATE TABLE IF NOT EXISTS quote_intake_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id varchar NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  file_data text,
  status text NOT NULL DEFAULT 'ready',
  uploaded_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_intake_attachments_quote
  ON quote_intake_attachments(quote_id, created_at);

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_review_version integer NOT NULL DEFAULT 0;