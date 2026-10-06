-- Task #100 quote-to-service operations. Additive and safe to rerun.
CREATE TABLE IF NOT EXISTS operational_services (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id varchar NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE RESTRICT,
  assignment_id varchar REFERENCES dispatch_assignments(id) ON DELETE SET NULL,
  customer_id varchar REFERENCES users(id) ON DELETE SET NULL,
  company_id varchar REFERENCES companies(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'planning',
  snapshot jsonb NOT NULL,
  started_at timestamp,
  finished_at timestamp,
  completed_at timestamp,
  cancelled_at timestamp,
  cancellation_reason text,
  exception_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operational_services_stage ON operational_services(stage, updated_at);
CREATE INDEX IF NOT EXISTS idx_operational_services_quote ON operational_services(quote_id);

CREATE TABLE IF NOT EXISTS quote_offer_revisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id varchar NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  terms text, payment_terms text, deadline timestamp, note text,
  sent_by varchar REFERENCES users(id),
  sent_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(quote_id, version)
);
ALTER TABLE quote_offer_revisions ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE quote_offer_revisions ADD COLUMN IF NOT EXISTS deadline timestamp;
CREATE TABLE IF NOT EXISTS quote_customer_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id varchar NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  offer_revision_id varchar REFERENCES quote_offer_revisions(id),
  decision text NOT NULL, note text,
  actor_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_collections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id varchar NOT NULL UNIQUE REFERENCES operational_services(id) ON DELETE CASCADE,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  deadline timestamp,
  provider text, external_reference text, evidence_reference text, notes text,
  submitted_at timestamp, verified_at timestamp, rejected_at timestamp,
  expired_at timestamp, refunded_at timestamp,
  actor_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_collections_status_deadline ON service_collections(status, deadline);
CREATE TABLE IF NOT EXISTS service_collection_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id varchar NOT NULL REFERENCES service_collections(id) ON DELETE CASCADE,
  from_status text, to_status text NOT NULL, method text, provider text,
  external_reference text, evidence_reference text, notes text,
  actor_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_checklist_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id varchar NOT NULL REFERENCES operational_services(id) ON DELETE CASCADE,
  key text NOT NULL, required boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  completed_by varchar REFERENCES users(id), completed_at timestamp, note text,
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(service_id, key)
);
CREATE TABLE IF NOT EXISTS service_timeline_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id varchar NOT NULL REFERENCES operational_services(id) ON DELETE CASCADE,
  type text NOT NULL, from_stage text, to_stage text, note text,
  evidence_reference text, metadata jsonb,
  actor_id varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_timeline_service_created ON service_timeline_events(service_id, created_at);
CREATE TABLE IF NOT EXISTS service_feedback_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id varchar NOT NULL UNIQUE REFERENCES operational_services(id) ON DELETE CASCADE,
  quote_id varchar NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  issued_at timestamp NOT NULL DEFAULT now(), closed_at timestamp,
  rating_id varchar REFERENCES ratings(id) ON DELETE SET NULL
);