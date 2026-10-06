ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS service_mode text,
  ADD COLUMN IF NOT EXISTS storage_branch_brand text,
  ADD COLUMN IF NOT EXISTS storage_branch_google_place_id text,
  ADD COLUMN IF NOT EXISTS storage_branch_name text,
  ADD COLUMN IF NOT EXISTS storage_branch_address text,
  ADD COLUMN IF NOT EXISTS storage_branch_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_checked_at timestamp,
  ADD COLUMN IF NOT EXISTS eligibility_version integer DEFAULT 1;

UPDATE quotes q
SET service_mode = CASE
      WHEN q.storage_branch_id IS NOT NULL THEN 'branch_connected'
      ELSE 'general_point_to_point'
    END,
    storage_branch_brand = COALESCE(q.storage_branch_brand, b.brand),
    storage_branch_google_place_id = COALESCE(q.storage_branch_google_place_id, b.google_place_id),
    storage_branch_name = COALESCE(q.storage_branch_name, b.name),
    storage_branch_address = COALESCE(q.storage_branch_address, b.address),
    storage_branch_snapshot = COALESCE(
      q.storage_branch_snapshot,
      CASE WHEN b.id IS NOT NULL THEN jsonb_build_object(
        'id', b.id,
        'brand', b.brand,
        'name', b.name,
        'address', b.address,
        'googlePlaceId', b.google_place_id,
        'mapsUrl', b.maps_url,
        'lat', b.lat,
        'lng', b.lng,
        'sourceVersion', b.source_version
      ) ELSE NULL END
    ),
    eligibility_version = COALESCE(q.eligibility_version, 1)
FROM ustorage_branches b
WHERE q.storage_branch_id = b.id;

-- Preserve orphaned legacy branch quotes as historical records while making
-- the live reference safe for the new foreign key.
UPDATE quotes q
SET service_mode = 'branch_connected',
    storage_branch_snapshot = COALESCE(
      q.storage_branch_snapshot,
      jsonb_build_object(
        'id', q.storage_branch_id,
        'legacy', true,
        'address', CASE
          WHEN q.storage_move_type = 'out_of_storage' THEN q.from_address
          WHEN q.storage_move_type = 'into_storage' THEN q.to_address
          ELSE NULL
        END
      )
    ),
    storage_branch_address = COALESCE(
      q.storage_branch_address,
      CASE
        WHEN q.storage_move_type = 'out_of_storage' THEN q.from_address
        WHEN q.storage_move_type = 'into_storage' THEN q.to_address
        ELSE NULL
      END
    ),
    storage_branch_id = NULL
WHERE q.storage_branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ustorage_branches b WHERE b.id = q.storage_branch_id
  );

UPDATE quotes
SET service_mode = COALESCE(service_mode, 'general_point_to_point'),
    eligibility_version = COALESCE(eligibility_version, 1);

-- Legacy partial saves could leave branch-derived fields behind after clearing
-- the branch. Normalize those records before enforcing general-mode consistency.
UPDATE quotes
SET storage_branch_id = NULL,
    storage_move_type = NULL,
    storage_branch_brand = NULL,
    storage_branch_google_place_id = NULL,
    storage_branch_name = NULL,
    storage_branch_address = NULL,
    storage_branch_snapshot = NULL
WHERE service_mode = 'general_point_to_point';

ALTER TABLE quotes
  ALTER COLUMN service_mode SET NOT NULL,
  ALTER COLUMN eligibility_version SET DEFAULT 1,
  ALTER COLUMN eligibility_version SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_storage_branch_id_fk'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_storage_branch_id_fk
      FOREIGN KEY (storage_branch_id)
      REFERENCES ustorage_branches(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_service_mode_valid'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_service_mode_valid
      CHECK (service_mode IN ('branch_connected', 'general_point_to_point'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_storage_move_type_valid'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_storage_move_type_valid
      CHECK (storage_move_type IS NULL OR storage_move_type IN ('into_storage', 'out_of_storage'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_general_mode_consistent'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_general_mode_consistent
      CHECK (
        service_mode <> 'general_point_to_point'
        OR (
          storage_branch_id IS NULL
          AND storage_move_type IS NULL
          AND storage_branch_brand IS NULL
          AND storage_branch_google_place_id IS NULL
          AND storage_branch_name IS NULL
          AND storage_branch_address IS NULL
          AND storage_branch_snapshot IS NULL
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_new_branch_mode_consistent'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_new_branch_mode_consistent
      CHECK (
        service_mode <> 'branch_connected'
        OR eligibility_checked_at IS NULL
        OR (
          storage_move_type IN ('into_storage', 'out_of_storage')
          AND storage_branch_snapshot IS NOT NULL
          AND storage_branch_snapshot->>'id' IS NOT NULL
          AND storage_branch_address IS NOT NULL
          AND storage_branch_google_place_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- Earlier code treated this as a singleton but did not enforce it. Keep the
-- most recently updated policy deterministically before adding the invariant.
INSERT INTO ustorage_settings (
  branch_moves_enabled,
  general_moves_enabled,
  into_storage_enabled,
  out_of_storage_enabled,
  match_radius_km
)
SELECT true, false, true, true, '2.00'
WHERE NOT EXISTS (SELECT 1 FROM ustorage_settings);

DELETE FROM ustorage_settings duplicate
USING ustorage_settings keeper
WHERE duplicate.id <> keeper.id
  AND (
    keeper.updated_at > duplicate.updated_at
    OR (keeper.updated_at = duplicate.updated_at AND keeper.id > duplicate.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_ustorage_settings_singleton
  ON ustorage_settings ((true));
CREATE INDEX IF NOT EXISTS idx_quotes_service_mode ON quotes (service_mode);
CREATE INDEX IF NOT EXISTS idx_quotes_storage_branch ON quotes (storage_branch_id);
CREATE INDEX IF NOT EXISTS idx_quotes_storage_place ON quotes (storage_branch_google_place_id);