ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_origin text NOT NULL DEFAULT 'public';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acting_employee_id varchar REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_customer_id varchar REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by_admin_id varchar REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS follow_up_owner_id varchar REFERENCES users(id);
ALTER TABLE quote_services ADD COLUMN IF NOT EXISTS created_by_admin_id varchar REFERENCES users(id);
ALTER TABLE quote_services ADD COLUMN IF NOT EXISTS follow_up_owner_id varchar REFERENCES users(id);
CREATE INDEX IF NOT EXISTS quotes_created_by_admin_id_idx ON quotes(created_by_admin_id);
CREATE INDEX IF NOT EXISTS quotes_follow_up_owner_id_idx ON quotes(follow_up_owner_id);
CREATE INDEX IF NOT EXISTS quote_services_created_by_admin_id_idx ON quote_services(created_by_admin_id);
CREATE INDEX IF NOT EXISTS quote_services_follow_up_owner_id_idx ON quote_services(follow_up_owner_id);
CREATE INDEX IF NOT EXISTS quote_activity_log_event_key_idx ON quote_activity_log(action_type);
CREATE TABLE IF NOT EXISTS service_activity_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_service_id varchar NOT NULL REFERENCES quote_services(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  actor_type text,
  actor_id varchar,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_activity_log ADD COLUMN IF NOT EXISTS quote_service_id varchar REFERENCES quote_services(id) ON DELETE CASCADE;
DELETE FROM service_activity_log WHERE quote_service_id IS NULL;
ALTER TABLE service_activity_log ALTER COLUMN quote_service_id SET NOT NULL;
ALTER TABLE service_activity_log DROP COLUMN IF EXISTS service_id;
CREATE INDEX IF NOT EXISTS service_activity_quote_service_idx ON service_activity_log(quote_service_id);
CREATE INDEX IF NOT EXISTS service_activity_event_idx ON service_activity_log(action_type);

CREATE OR REPLACE FUNCTION preserve_immutable_creator()
RETURNS trigger AS $$
BEGIN
  IF OLD.created_by_admin_id IS NOT NULL AND NEW.created_by_admin_id IS DISTINCT FROM OLD.created_by_admin_id THEN
    RAISE EXCEPTION 'created_by_admin_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_preserve_creator ON quotes;
CREATE TRIGGER quotes_preserve_creator
BEFORE UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION preserve_immutable_creator();

DROP TRIGGER IF EXISTS quote_services_preserve_creator ON quote_services;
CREATE TRIGGER quote_services_preserve_creator
BEFORE UPDATE ON quote_services
FOR EACH ROW EXECUTE FUNCTION preserve_immutable_creator();

DROP TRIGGER IF EXISTS services_preserve_creator ON services;
ALTER TABLE services DROP COLUMN IF EXISTS created_by_admin_id;
ALTER TABLE services DROP COLUMN IF EXISTS follow_up_owner_id;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_quote_origin_valid') THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_quote_origin_valid
      CHECK (quote_origin IN ('public', 'self_service', 'assisted'));
  END IF;
END $$;

INSERT INTO platform_roles (slug, name, description, is_system)
VALUES ('ventas', 'Ventas', 'Create and manage assisted customer quote drafts.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO platform_role_modules (role_id, module_key)
SELECT id, module_key FROM platform_roles,
  (VALUES ('module:quotes'), ('capability:quotes:assisted')) AS modules(module_key)
WHERE slug = 'ventas'
ON CONFLICT (role_id, module_key) DO NOTHING;

UPDATE admin_workspace_sections
SET workspace_key = 'admin-sales', position = 0, updated_at = now()
WHERE href = '/admin/dashboard/quotes';

-- Existing records are customer self-service/public records, never employee-owned.
UPDATE quotes SET quote_origin = CASE WHEN user_id IS NULL THEN 'public' ELSE 'self_service' END
WHERE quote_origin IS NULL OR quote_origin = '';