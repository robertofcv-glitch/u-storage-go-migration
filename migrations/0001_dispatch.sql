-- Task #40 dispatch foundation. Review/history artifact; Replit Publish applies
-- the schema diff (the application does not execute migrations at startup).
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS workflow_mode text DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS workflow_version integer NOT NULL DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_proposal_amount numeric(10,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_proposal_version integer NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_proposal_currency text DEFAULT 'MXN';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_proposal_note text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_proposed_at timestamp;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_proposed_by varchar REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_client_responded_at timestamp;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_client_response text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_client_change_request text;
UPDATE quotes SET workflow_mode = 'bidding'
WHERE workflow_mode IS NULL AND (bidding_status IS NOT NULL AND bidding_status <> 'pending'
  OR EXISTS (SELECT 1 FROM quote_bids b WHERE b.quote_id = quotes.id)
  OR EXISTS (SELECT 1 FROM quote_invitations i WHERE i.quote_id = quotes.id));
-- Leave all other historical rows null: application reads null as legacy.
-- New quotes are explicitly stamped "dispatch" by the application.

CREATE TABLE IF NOT EXISTS partner_vehicles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), mover_profile_id varchar NOT NULL REFERENCES mover_profiles(id) ON DELETE CASCADE,
  name text NOT NULL, registration text, vehicle_type text, capacity text, is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicle_availability_windows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id varchar NOT NULL REFERENCES partner_vehicles(id) ON DELETE CASCADE,
  starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, label text, is_available boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dispatch_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), quote_id varchar NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  mover_profile_id varchar NOT NULL REFERENCES mover_profiles(id), starts_at timestamp NOT NULL, ends_at timestamp NOT NULL,
  status text NOT NULL DEFAULT 'proposed', proposed_by varchar REFERENCES users(id), responded_at timestamp, response_note text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assignment_vehicles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id varchar NOT NULL REFERENCES dispatch_assignments(id) ON DELETE CASCADE,
  vehicle_id varchar NOT NULL REFERENCES partner_vehicles(id)
);
CREATE TABLE IF NOT EXISTS assignment_reservations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id varchar NOT NULL REFERENCES dispatch_assignments(id) ON DELETE CASCADE,
  vehicle_id varchar NOT NULL REFERENCES partner_vehicles(id), starts_at timestamp NOT NULL, ends_at timestamp NOT NULL,
  status text NOT NULL DEFAULT 'tentative', created_at timestamp NOT NULL DEFAULT now(), released_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_assignment_reservations_vehicle_time ON assignment_reservations(vehicle_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_assignments_quote ON dispatch_assignments(quote_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_vehicles_assignment_vehicle ON assignment_vehicles(assignment_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_availability_time ON vehicle_availability_windows(starts_at, ends_at);