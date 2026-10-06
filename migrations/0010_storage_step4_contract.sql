ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_contract_status text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_rental_intent text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_availability_status text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_selected_unit_code text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_selected_unit_snapshot jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_reservation_status text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS storage_availability_checked_at timestamp;

COMMENT ON COLUMN quotes.storage_selected_unit_snapshot IS
  'Booking-time sanitized snapshot of the public U-Storage unit option; never contains customer PII.';