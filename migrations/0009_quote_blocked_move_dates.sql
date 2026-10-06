ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS blocked_move_dates jsonb NOT NULL DEFAULT '[]'::jsonb;