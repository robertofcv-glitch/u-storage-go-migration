-- Task 109: privacy-safe provenance for confirmed U-Storage reservations.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_handoff_provenance text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_reservation_ref_hash text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_rental_start timestamp;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_verified_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_redemption_ref text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_exchange_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_storage_exchange_id ON quotes(storage_exchange_id) WHERE storage_exchange_id IS NOT NULL;