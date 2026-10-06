-- Partner companies use mover_profiles as the canonical company identity.
-- All statements are compatibility-safe for deployments that already contain
-- legacy mover profiles and dispatch records.
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE mover_profiles ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS company_id varchar;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS membership_id varchar;
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON activity_logs(company_id, created_at);

CREATE TABLE IF NOT EXISTS partner_company_memberships (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES mover_profiles(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE CASCADE,
  invited_email text,
  role text NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'invited',
  invitation_token_hash text,
  invited_at timestamp NOT NULL DEFAULT now(),
  accepted_at timestamp,
  invited_by varchar REFERENCES users(id),
  updated_by varchar REFERENCES users(id),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_memberships_company_status
  ON partner_company_memberships(company_id, status);
CREATE INDEX IF NOT EXISTS idx_company_memberships_user_status
  ON partner_company_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_company_memberships_invited_email
  ON partner_company_memberships(invited_email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_company_user
  ON partner_company_memberships(company_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_company_invited_email
  ON partner_company_memberships(company_id, invited_email) WHERE invited_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_invitation_token
  ON partner_company_memberships(invitation_token_hash) WHERE invitation_token_hash IS NOT NULL;

-- Idempotent legacy backfill. It deliberately preserves every profile id and
-- does not rewrite historical foreign keys.
INSERT INTO partner_company_memberships (company_id, user_id, role, status, accepted_at, invited_by, updated_by)
SELECT mp.id, mp.user_id, 'owner', 'active', now(), mp.user_id, mp.user_id
FROM mover_profiles mp
WHERE NOT EXISTS (
  SELECT 1 FROM partner_company_memberships m
  WHERE m.company_id = mp.id AND m.user_id = mp.user_id
);