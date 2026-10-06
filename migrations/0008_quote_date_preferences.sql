ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS move_availability_start text,
  ADD COLUMN IF NOT EXISTS move_availability_end text,
  ADD COLUMN IF NOT EXISTS preferred_move_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_move_availability_range_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_move_availability_range_check
  CHECK (
    move_availability_start IS NULL
    OR move_availability_end IS NULL
    OR (
      move_availability_start ~ '^\d{4}-\d{2}-\d{2}$'
      AND move_availability_end ~ '^\d{4}-\d{2}-\d{2}$'
      AND move_availability_end::date - move_availability_start::date BETWEEN 0 AND 13
    )
  );