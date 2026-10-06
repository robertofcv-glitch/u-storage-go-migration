ALTER TABLE ustorage_branches
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS brand text DEFAULT 'U-Storage',
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS source_imported_at timestamp,
  ADD COLUMN IF NOT EXISTS catalog_status text DEFAULT 'official';

UPDATE ustorage_branches
SET brand = COALESCE(brand, 'U-Storage'),
    catalog_status = COALESCE(catalog_status, 'official'),
    is_active = COALESCE(is_active, false);

ALTER TABLE ustorage_branches
  ALTER COLUMN brand SET DEFAULT 'U-Storage',
  ALTER COLUMN brand SET NOT NULL,
  ALTER COLUMN catalog_status SET DEFAULT 'official',
  ALTER COLUMN catalog_status SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT false,
  ALTER COLUMN is_active SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ustorage_branches_google_place_id_unique
  ON ustorage_branches (google_place_id);
CREATE INDEX IF NOT EXISTS idx_ustorage_branches_public
  ON ustorage_branches (catalog_status, is_active);
CREATE INDEX IF NOT EXISTS idx_ustorage_branches_brand
  ON ustorage_branches (brand);

ALTER TABLE ustorage_settings
  ADD COLUMN IF NOT EXISTS branch_moves_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS general_moves_enabled boolean DEFAULT false;

UPDATE ustorage_settings
SET branch_moves_enabled = COALESCE(branch_moves_enabled, true),
    general_moves_enabled = COALESCE(general_moves_enabled, false);

ALTER TABLE ustorage_settings
  ALTER COLUMN branch_moves_enabled SET DEFAULT true,
  ALTER COLUMN branch_moves_enabled SET NOT NULL,
  ALTER COLUMN general_moves_enabled SET DEFAULT false,
  ALTER COLUMN general_moves_enabled SET NOT NULL;