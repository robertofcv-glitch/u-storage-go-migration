-- Generalized companies and memberships compatibility migration.
-- It is safe to run repeatedly and never changes legacy mover profile IDs.
CREATE TABLE IF NOT EXISTS companies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  classification text NOT NULL DEFAULT 'client',
  mover_profile_id varchar UNIQUE REFERENCES mover_profiles(id) ON DELETE SET NULL,
  owner_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companies_classification ON companies(classification);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_mover_profile ON companies(mover_profile_id);
CREATE TABLE IF NOT EXISTS company_migration_markers (
  key text PRIMARY KEY,
  completed_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_memberships (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE CASCADE,
  invited_email text,
  invitation_token_hash text,
  invitation_expires_at timestamp,
  role text NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'invited',
  invited_at timestamp NOT NULL DEFAULT now(),
  accepted_at timestamp,
  invited_by varchar REFERENCES users(id),
  updated_by varchar REFERENCES users(id),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_memberships_v2_company ON company_memberships(company_id, status);
CREATE INDEX IF NOT EXISTS idx_company_memberships_v2_user ON company_memberships(user_id, status);
ALTER TABLE company_memberships ADD COLUMN IF NOT EXISTS invitation_token_hash text;
ALTER TABLE company_memberships ADD COLUMN IF NOT EXISTS invitation_expires_at timestamp;
ALTER TABLE partner_company_memberships ADD COLUMN IF NOT EXISTS invitation_expires_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_v2_user
  ON company_memberships(company_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_v2_invited_email
  ON company_memberships(company_id, invited_email) WHERE invited_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_memberships_v2_invitation
  ON company_memberships(invitation_token_hash) WHERE invitation_token_hash IS NOT NULL;

-- Partner companies retain their mover profile as a stable historical identity.
INSERT INTO companies (id, name, classification, mover_profile_id, owner_user_id, created_at, updated_at)
SELECT mp.id, mp.company_name, 'partner', mp.id, mp.user_id, mp.created_at, mp.updated_at
FROM mover_profiles mp
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.mover_profile_id = mp.id)
AND NOT EXISTS (SELECT 1 FROM company_migration_markers WHERE key='generalized_companies_backfill_v1');

INSERT INTO company_memberships
  (id, company_id, user_id, invited_email, role, status, invitation_token_hash,
   invited_at, accepted_at, invited_by, updated_by, updated_at)
SELECT m.id, c.id, m.user_id, m.invited_email, m.role, m.status, m.invitation_token_hash,
       m.invited_at, m.accepted_at, m.invited_by, m.updated_by, m.updated_at
FROM partner_company_memberships m
JOIN companies c ON c.mover_profile_id = m.company_id
WHERE NOT EXISTS (
  SELECT 1 FROM company_memberships x WHERE x.id = m.id
) AND NOT EXISTS (SELECT 1 FROM company_migration_markers WHERE key='generalized_companies_backfill_v1');

-- Every client (including guest/placeholder clients) gets one durable personal company.
INSERT INTO companies (name, classification, owner_user_id)
SELECT COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), 'Client'), 'client', u.id
FROM users u
WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'client' AND ur.is_active = true)
AND NOT EXISTS (
  SELECT 1 FROM company_memberships m
  JOIN companies existing ON existing.id = m.company_id
  WHERE m.user_id = u.id AND m.status IN ('active', 'invited')
    AND existing.mover_profile_id IS NULL AND existing.classification IN ('client', 'both')
) AND NOT EXISTS (SELECT 1 FROM company_migration_markers WHERE key='generalized_companies_backfill_v1');
INSERT INTO company_memberships (company_id, user_id, role, status, accepted_at, invited_by, updated_by)
SELECT c.id, c.owner_user_id, 'owner', 'active', now(), c.owner_user_id, c.owner_user_id
FROM companies c
WHERE c.classification = 'client' AND c.owner_user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM company_memberships m WHERE m.company_id = c.id AND m.user_id = c.owner_user_id)
AND NOT EXISTS (SELECT 1 FROM company_migration_markers WHERE key='generalized_companies_backfill_v1');
-- The marker condition prevents a later migration rerun from resurrecting a
-- deliberately removed personal owner membership.
INSERT INTO company_migration_markers(key) VALUES ('generalized_companies_backfill_v1') ON CONFLICT DO NOTHING;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS company_id varchar REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE saved_addresses ADD COLUMN IF NOT EXISTS company_id varchar REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_company ON quotes(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_company ON saved_addresses(company_id, created_at);

UPDATE quotes q SET company_id = c.id
FROM company_memberships m JOIN companies c ON c.id = m.company_id
WHERE q.company_id IS NULL AND m.user_id = q.user_id AND m.status = 'active'
  AND c.classification IN ('client', 'both');
UPDATE saved_addresses a SET company_id = c.id
FROM company_memberships m JOIN companies c ON c.id = m.company_id
WHERE a.company_id IS NULL AND m.user_id = a.user_id AND m.status = 'active'
  AND c.classification IN ('client', 'both');

-- Bidirectional compatibility for partner memberships. Existing counterpart
-- rows always follow updates/deletes. A new generalized row creates partner
-- access only when its company is partner-only; client/both membership is not
-- an implicit operational-partner grant.
CREATE OR REPLACE FUNCTION sync_legacy_partner_membership_to_generalized()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM company_memberships WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = NEW.company_id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO company_memberships
    (id, company_id, user_id, invited_email, invitation_token_hash, invitation_expires_at, role, status,
     invited_at, accepted_at, invited_by, updated_by, updated_at)
  VALUES
    (NEW.id, NEW.company_id, NEW.user_id, NEW.invited_email, NEW.invitation_token_hash, NEW.invitation_expires_at,
     NEW.role, NEW.status, NEW.invited_at, NEW.accepted_at, NEW.invited_by, NEW.updated_by, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    company_id=EXCLUDED.company_id, user_id=EXCLUDED.user_id,
    invited_email=EXCLUDED.invited_email, invitation_token_hash=EXCLUDED.invitation_token_hash, invitation_expires_at=EXCLUDED.invitation_expires_at,
    role=EXCLUDED.role, status=EXCLUDED.status, invited_at=EXCLUDED.invited_at,
    accepted_at=EXCLUDED.accepted_at, invited_by=EXCLUDED.invited_by,
    updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION sync_generalized_membership_to_legacy_partner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE should_sync boolean;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM partner_company_memberships WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT EXISTS(SELECT 1 FROM partner_company_memberships p WHERE p.id = NEW.id)
      OR EXISTS(SELECT 1 FROM companies c WHERE c.id = NEW.company_id AND c.classification = 'partner')
    INTO should_sync;
  IF NOT should_sync THEN RETURN NEW; END IF;
  INSERT INTO partner_company_memberships
    (id, company_id, user_id, invited_email, invitation_token_hash, invitation_expires_at, role, status,
     invited_at, accepted_at, invited_by, updated_by, updated_at)
  VALUES
    (NEW.id, NEW.company_id, NEW.user_id, NEW.invited_email, NEW.invitation_token_hash, NEW.invitation_expires_at,
     NEW.role, NEW.status, NEW.invited_at, NEW.accepted_at, NEW.invited_by, NEW.updated_by, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE SET
    company_id=EXCLUDED.company_id, user_id=EXCLUDED.user_id,
    invited_email=EXCLUDED.invited_email, invitation_token_hash=EXCLUDED.invitation_token_hash, invitation_expires_at=EXCLUDED.invitation_expires_at,
    role=EXCLUDED.role, status=EXCLUDED.status, invited_at=EXCLUDED.invited_at,
    accepted_at=EXCLUDED.accepted_at, invited_by=EXCLUDED.invited_by,
    updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_partner_membership_to_generalized ON partner_company_memberships;
CREATE TRIGGER trg_partner_membership_to_generalized
AFTER INSERT OR UPDATE OR DELETE ON partner_company_memberships
FOR EACH ROW EXECUTE FUNCTION sync_legacy_partner_membership_to_generalized();
DROP TRIGGER IF EXISTS trg_generalized_membership_to_partner ON company_memberships;
CREATE TRIGGER trg_generalized_membership_to_partner
AFTER INSERT OR UPDATE OR DELETE ON company_memberships
FOR EACH ROW EXECUTE FUNCTION sync_generalized_membership_to_legacy_partner();

-- Verification queries for rollout:
-- SELECT p.id FROM partner_company_memberships p LEFT JOIN company_memberships c USING(id) WHERE c.id IS NULL;
-- SELECT c.id FROM company_memberships c JOIN companies co ON co.id=c.company_id
-- LEFT JOIN partner_company_memberships p USING(id)
-- WHERE co.classification='partner' AND p.id IS NULL;