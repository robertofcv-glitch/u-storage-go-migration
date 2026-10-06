CREATE TABLE IF NOT EXISTS admin_workspace_sections (
  href text PRIMARY KEY,
  workspace_key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by varchar REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_sections_workspace
  ON admin_workspace_sections (workspace_key, position);

INSERT INTO admin_workspace_sections (href, workspace_key, position)
VALUES
  ('/admin/dashboard', 'admin-overview', 0),
  ('/admin/dashboard/analytics', 'admin-overview', 1),
  ('/admin/dashboard/activity', 'admin-overview', 2),
  ('/admin/dashboard/quotes', 'admin-operations', 0),
  ('/admin/dashboard/inventory', 'admin-operations', 1),
  ('/admin/dashboard/ustorage', 'admin-operations', 2),
  ('/admin/dashboard/ratings', 'admin-customer-care', 0),
  ('/admin/dashboard/communications', 'admin-customer-care', 1),
  ('/admin/dashboard/whatsapp-inbox', 'admin-customer-care', 2),
  ('/admin/dashboard/ai-agent', 'admin-customer-care', 3),
  ('/admin/dashboard/seo-marketing', 'admin-growth', 0),
  ('/admin/dashboard/blog', 'admin-growth', 1),
  ('/admin/dashboard/pricing', 'admin-finance', 0),
  ('/admin/dashboard/payments', 'admin-finance', 1),
  ('/admin/dashboard/usuarios', 'admin-organization', 0),
  ('/admin/dashboard/roles', 'admin-organization', 1),
  ('/admin/dashboard/database', 'admin-system', 0),
  ('/admin/dashboard/settings', 'admin-system', 1)
ON CONFLICT (href) DO NOTHING;