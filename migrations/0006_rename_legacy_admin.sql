UPDATE platform_roles
SET name = 'Admin',
    updated_at = now()
WHERE slug = 'legacy_admin'
  AND name = 'Legacy Admin';