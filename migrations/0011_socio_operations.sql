-- Task #97 socio operations. Idempotent additive migration; legacy dispatch
-- columns remain readable while new records use canonical resources.
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS operating_timezone text DEFAULT 'America/Mexico_City';
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS operating_schedule jsonb;
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS service_capabilities text[];
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS travel_buffer_minutes integer DEFAULT 60;
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS turnaround_buffer_minutes integer DEFAULT 30;
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS onboarding_readiness jsonb;

ALTER TABLE partner_vehicles ADD COLUMN IF NOT EXISTS truck_type_id varchar REFERENCES truck_types(id) ON DELETE RESTRICT;
ALTER TABLE partner_vehicles ADD COLUMN IF NOT EXISTS legacy_capacity_needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE partner_vehicles ADD COLUMN IF NOT EXISTS legacy_capacity_note text;
CREATE INDEX IF NOT EXISTS idx_partner_vehicles_truck_type ON partner_vehicles(truck_type_id);

CREATE TABLE IF NOT EXISTS partner_crews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  mover_profile_id varchar NOT NULL REFERENCES mover_profiles(id) ON DELETE CASCADE,
  name text NOT NULL, role text DEFAULT 'crew', member_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_crews_partner ON partner_crews(mover_profile_id);
CREATE TABLE IF NOT EXISTS crew_availability_windows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id varchar NOT NULL REFERENCES partner_crews(id) ON DELETE CASCADE,
  starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, is_available boolean NOT NULL DEFAULT true,
  label text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crew_availability_crew_time ON crew_availability_windows(crew_id, starts_at, ends_at);
CREATE TABLE IF NOT EXISTS partner_operating_schedules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  mover_profile_id varchar NOT NULL REFERENCES mover_profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL, starts_at text NOT NULL, ends_at text NOT NULL,
  is_active boolean NOT NULL DEFAULT true, timezone text NOT NULL DEFAULT 'America/Mexico_City',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_schedule_partner_day ON partner_operating_schedules(mover_profile_id, day_of_week);
CREATE TABLE IF NOT EXISTS partner_calendar_exceptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  mover_profile_id varchar NOT NULL REFERENCES mover_profiles(id) ON DELETE CASCADE,
  starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, kind text NOT NULL DEFAULT 'blackout',
  label text, timezone text NOT NULL DEFAULT 'America/Mexico_City', created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_calendar_exception_time ON partner_calendar_exceptions(mover_profile_id, starts_at, ends_at);

ALTER TABLE dispatch_assignments ADD COLUMN IF NOT EXISTS crew_count_required integer;
ALTER TABLE dispatch_assignments ADD COLUMN IF NOT EXISTS vehicle_weight_required_kg integer;
ALTER TABLE dispatch_assignments ADD COLUMN IF NOT EXISTS vehicle_volume_required_m3 numeric(8,2);
ALTER TABLE dispatch_assignments ADD COLUMN IF NOT EXISTS vehicle_type_snapshot jsonb;
ALTER TABLE dispatch_assignments ADD COLUMN IF NOT EXISTS crew_snapshot jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS required_vehicle_weight_kg integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS required_vehicle_volume_m3 numeric(8,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS required_crew_count integer;
CREATE TABLE IF NOT EXISTS assignment_crews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id varchar NOT NULL REFERENCES dispatch_assignments(id) ON DELETE CASCADE,
  crew_id varchar NOT NULL REFERENCES partner_crews(id),
  UNIQUE(assignment_id, crew_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_crews_assignment ON assignment_crews(assignment_id);
CREATE TABLE IF NOT EXISTS crew_assignment_reservations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id varchar NOT NULL REFERENCES dispatch_assignments(id) ON DELETE CASCADE,
  crew_id varchar NOT NULL REFERENCES partner_crews(id),
  starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, status text NOT NULL DEFAULT 'tentative',
  created_at timestamp NOT NULL DEFAULT now(), released_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_crew_reservations_crew_time ON crew_assignment_reservations(crew_id, starts_at, ends_at);

-- Map only unambiguous legacy capacity values; all other legacy rows are
-- explicitly flagged for review rather than silently inventing a truck type.
UPDATE partner_vehicles v SET truck_type_id = t.id, legacy_capacity_needs_review = false
FROM truck_types t
WHERE v.truck_type_id IS NULL AND v.capacity IS NOT NULL
  AND regexp_replace(lower(v.capacity), '[^0-9.]', '', 'g') <> ''
  AND t.capacity_kg = round((regexp_replace(lower(v.capacity), '[^0-9.]', '', 'g'))::numeric)
  AND (SELECT count(*) FROM truck_types t2 WHERE t2.capacity_kg = t.capacity_kg) = 1;
UPDATE partner_vehicles SET legacy_capacity_needs_review = true,
  legacy_capacity_note = COALESCE(legacy_capacity_note, 'Legacy capacity could not be mapped unambiguously')
WHERE truck_type_id IS NULL AND capacity IS NOT NULL;

-- Provision the internal socio deterministically whenever its legacy profile
-- exists; no duplicate company or membership is created on reruns.
INSERT INTO companies (id, name, classification, mover_profile_id, owner_user_id, is_active, created_at, updated_at)
SELECT mp.id, mp.company_name, 'partner', mp.id, mp.user_id, true, mp.created_at, mp.updated_at
FROM mover_profiles mp WHERE mp.is_internal = true
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, classification = 'partner',
  mover_profile_id = EXCLUDED.mover_profile_id, owner_user_id = EXCLUDED.owner_user_id;
INSERT INTO company_memberships (company_id, user_id, role, status, accepted_at, invited_by, updated_by)
SELECT c.id, c.owner_user_id, 'owner', 'active', now(), c.owner_user_id, c.owner_user_id
FROM companies c WHERE c.mover_profile_id IS NOT NULL AND c.classification IN ('partner','both')
  AND c.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_memberships m
    WHERE m.company_id = c.id AND m.user_id = c.owner_user_id
  );