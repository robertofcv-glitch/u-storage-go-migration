CREATE TABLE IF NOT EXISTS platform_roles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar REFERENCES users(id),
  updated_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_role_modules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id varchar NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT platform_role_modules_role_module_unique UNIQUE(role_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_role_modules_role ON platform_role_modules(role_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_roles_slug_not_reserved') THEN
    ALTER TABLE platform_roles
      ADD CONSTRAINT platform_roles_slug_not_reserved CHECK (slug NOT IN ('admin', 'client', 'mover'));
  END IF;
END $$;

INSERT INTO platform_roles (slug, name, description, is_system)
VALUES
  ('super_admin', 'Super Admin', 'Unrestricted access to every administration module.', true),
  ('operations', 'Operations', 'Operational planning, partners, inventory and service delivery.', true),
  ('commercial', 'Commercial', 'Sales, pricing, analytics and marketing.', true),
  ('accounting', 'Accounting', 'Payments, pricing and financial reporting.', true),
  ('customer_service', 'Customer Service', 'Quotes, ratings and customer communications.', true),
  ('legacy_admin', 'Admin', 'Compatibility workspace for administrators created before platform roles.', true)
ON CONFLICT (slug) DO NOTHING;

WITH modules(slug, module_key) AS (
  VALUES
    ('super_admin', '*'),
    ('operations', 'module:dashboard'), ('operations', 'module:analytics'), ('operations', 'module:quotes'),
    ('operations', 'module:ratings'), ('operations', 'module:activity'), ('operations', 'module:communications'),
    ('operations', 'module:whatsapp'), ('operations', 'module:ai_agent'), ('operations', 'module:inventory'),
    ('operations', 'module:ustorage'), ('operations', 'module:users'), ('operations', 'module:companies'),
    ('commercial', 'module:dashboard'), ('commercial', 'module:analytics'), ('commercial', 'module:quotes'),
    ('commercial', 'module:ratings'), ('commercial', 'module:pricing'), ('commercial', 'module:marketing'),
    ('commercial', 'module:communications'),
    ('accounting', 'module:dashboard'), ('accounting', 'module:analytics'), ('accounting', 'module:quotes'),
    ('accounting', 'module:pricing'), ('accounting', 'module:payments'),
    ('customer_service', 'module:dashboard'), ('customer_service', 'module:quotes'),
    ('customer_service', 'module:ratings'), ('customer_service', 'module:communications'),
    ('customer_service', 'module:whatsapp'), ('customer_service', 'module:users'),
    ('legacy_admin', 'module:dashboard'), ('legacy_admin', 'module:analytics'), ('legacy_admin', 'module:quotes'),
    ('legacy_admin', 'module:ratings'), ('legacy_admin', 'module:activity'), ('legacy_admin', 'module:communications'),
    ('legacy_admin', 'module:whatsapp'), ('legacy_admin', 'module:ai_agent'), ('legacy_admin', 'module:inventory'),
    ('legacy_admin', 'module:pricing'), ('legacy_admin', 'module:ustorage'), ('legacy_admin', 'module:payments'),
    ('legacy_admin', 'module:database'), ('legacy_admin', 'module:marketing'), ('legacy_admin', 'module:users'),
    ('legacy_admin', 'module:settings'), ('legacy_admin', 'module:companies'), ('legacy_admin', 'module:role_management')
)
INSERT INTO platform_role_modules (role_id, module_key)
SELECT pr.id, modules.module_key FROM modules JOIN platform_roles pr ON pr.slug = modules.slug
ON CONFLICT (role_id, module_key) DO NOTHING;

INSERT INTO user_roles (user_id, role, granted_by, is_active)
SELECT admin_role.user_id, 'legacy_admin', admin_role.granted_by, true
FROM user_roles admin_role
WHERE admin_role.role = 'admin'
  AND admin_role.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles assigned
    JOIN platform_roles role_definition ON role_definition.slug = assigned.role
    WHERE assigned.user_id = admin_role.user_id
      AND assigned.is_active = true
  )
ON CONFLICT DO NOTHING;