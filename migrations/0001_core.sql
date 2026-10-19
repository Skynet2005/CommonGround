
-- 0001: Core, isolated CommonGround data plane (PostgreSQL 15+).
-- Apply only with a MIGRATION OWNER, not a runtime credential.
-- The runtime must be a distinct NON-owner, NON-BYPASSRLS role.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

CREATE TABLE IF NOT EXISTS app.accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 display_name text,
 email_verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 disabled_at timestamptz,
 CONSTRAINT valid_email_length CHECK(length(email) BETWEEN 3 AND 254),
 CONSTRAINT normalized_email CHECK(email=lower(trim(email)))
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_ci ON app.accounts(email);

CREATE TABLE IF NOT EXISTS app.login_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 token_digest text NOT NULL UNIQUE CHECK (length(token_digest)=64),
 request_fingerprint text NOT NULL CHECK(length(request_fingerprint)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CONSTRAINT login_token_valid CHECK (expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS login_tokens_email_created ON app.login_tokens(email,created_at DESC);
CREATE INDEX IF NOT EXISTS login_tokens_fingerprint_created ON app.login_tokens(request_fingerprint,created_at DESC);

CREATE TABLE IF NOT EXISTS app.sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES app.accounts(id),
 token_digest text UNIQUE NOT NULL CHECK(length(token_digest)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 CONSTRAINT session_expiry CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS sessions_account_expiry ON app.sessions(account_id,expires_at DESC);

CREATE TABLE IF NOT EXISTS app.communities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 state char(2) NOT NULL DEFAULT 'FL',
 county text,
 external_id text,
 status text NOT NULL DEFAULT 'unverified' CHECK(status IN ('unverified','verified','suspended')),
 created_by uuid REFERENCES app.accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT community_name_length CHECK(length(name) BETWEEN 2 AND 200)
);
CREATE TABLE IF NOT EXISTS app.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid NOT NULL REFERENCES app.communities(id),
 account_id uuid NOT NULL REFERENCES app.accounts(id),
 role text NOT NULL CHECK(role IN ('resident','director','officer','manager','architectural_committee','neutral','auditor')),
 verification text NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','revoked')),
 verified_by uuid REFERENCES app.accounts(id),
 verified_at timestamptz,
 revoked_at timestamptz,
 UNIQUE(community_id,account_id,role)
);
CREATE INDEX IF NOT EXISTS memberships_person ON app.memberships(account_id,verification);

CREATE TABLE IF NOT EXISTS app.parcels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid NOT NULL REFERENCES app.communities(id),
 parcel_reference text NOT NULL,
 parcel_label text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(community_id,parcel_reference)
);
CREATE TABLE IF NOT EXISTS app.parcel_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parcel_id uuid NOT NULL REFERENCES app.parcels(id),
 account_id uuid NOT NULL REFERENCES app.accounts(id),
 capacity text NOT NULL CHECK(capacity IN ('owner','tenant','agent','authorized_representative')),
 verification text NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','denied','revoked')),
 reviewer_id uuid REFERENCES app.accounts(id),
 reviewed_at timestamptz,
 valid_from date,
 valid_to date
);

CREATE TABLE IF NOT EXISTS app.cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid REFERENCES app.communities(id),
 parcel_id uuid REFERENCES app.parcels(id),
 created_by uuid NOT NULL REFERENCES app.accounts(id),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 180),
 category text NOT NULL CHECK(category IN ('Architectural','Enforcement','Financial','Records','Elections','Maintenance','Governance','Other')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','shared','in_review','in_discussion','resolved','closed')),
 summary text NOT NULL DEFAULT '',
 rule_reference text NOT NULL DEFAULT '',
 evidence_summary text NOT NULL DEFAULT '',
 proposed_resolution text NOT NULL DEFAULT '',
 response_opportunity boolean NOT NULL DEFAULT false,
 independent_review_considered boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>=1),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS cases_creator_updated ON app.cases(created_by,updated_at DESC);
CREATE INDEX IF NOT EXISTS cases_community_status ON app.cases(community_id,status);

CREATE TABLE IF NOT EXISTS app.case_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES app.cases(id),
 account_id uuid NOT NULL REFERENCES app.accounts(id),
 role text NOT NULL CHECK(role IN ('resident','association','manager','neutral','observer')),
 invited_by uuid REFERENCES app.accounts(id),
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,account_id,role)
);
CREATE INDEX IF NOT EXISTS case_participants_person ON app.case_participants(account_id,accepted_at);

CREATE TABLE IF NOT EXISTS app.case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES app.cases(id),
 actor_id uuid NOT NULL REFERENCES app.accounts(id),
 event_type text NOT NULL CHECK(length(event_type) BETWEEN 2 AND 70),
 public_note text NOT NULL DEFAULT '',
 changes jsonb NOT NULL DEFAULT '{}'::jsonb,
 previous_digest text,
 digest text NOT NULL CHECK(length(digest)=64),
 case_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT event_notes_limit CHECK(length(public_note)<=12000)
);
CREATE UNIQUE INDEX IF NOT EXISTS case_events_one_version ON app.case_events(case_id,case_version);
CREATE INDEX IF NOT EXISTS case_events_order ON app.case_events(case_id,case_version);

CREATE TABLE IF NOT EXISTS app.case_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES app.cases(id),
 invitee_email_digest text NOT NULL,
 invite_token_digest text UNIQUE NOT NULL,
 role text NOT NULL CHECK(role IN ('resident','association','manager','neutral','observer')),
 created_by uuid NOT NULL REFERENCES app.accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_by uuid REFERENCES app.accounts(id),
 accepted_at timestamptz,
 revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS app.evidence_objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES app.cases(id),
 uploaded_by uuid NOT NULL REFERENCES app.accounts(id),
 private_blob_key text NOT NULL UNIQUE,
 sha256_ciphertext text NOT NULL CHECK(length(sha256_ciphertext)=64),
 encrypted_filename bytea NOT NULL,
 encryption_envelope jsonb NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 52428800),
 classification text NOT NULL DEFAULT 'private' CHECK(classification IN ('private','shared_by_consent','sealed_mediation')),
 provenance text NOT NULL DEFAULT 'self_reported' CHECK(provenance IN ('self_reported','witness_attested','professional_verified','official_record')),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS app.evidence_attestations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evidence_id uuid NOT NULL REFERENCES app.evidence_objects(id),
 attestor_id uuid NOT NULL REFERENCES app.accounts(id),
 attestation_type text NOT NULL,
 notes text,
 accepted_by uuid REFERENCES app.accounts(id),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Case-related audit log uses append-only application grants and triggers.
CREATE FUNCTION app.prevent_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Case events are append-only';
END $$;
CREATE TRIGGER case_event_immutable BEFORE UPDATE OR DELETE ON app.case_events
 FOR EACH ROW EXECUTE FUNCTION app.prevent_event_mutation();

CREATE FUNCTION app.current_actor() RETURNS uuid
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.actor_id',true),'')::uuid;
$$;
-- SECURITY DEFINER executes with the migration owner's table permissions.
-- This narrow function is used solely to break a policy recursion cycle;
-- never let untrusted clients choose app.actor_id or connect directly.
CREATE FUNCTION app.can_access_case(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=app,pg_temp AS $$
 SELECT EXISTS (
  SELECT 1 FROM app.cases c
  WHERE c.id=target AND c.deleted_at IS NULL AND
   (c.created_by=app.current_actor()
    OR EXISTS (SELECT 1 FROM app.case_participants p
       WHERE p.case_id=c.id AND p.account_id=app.current_actor()
        AND p.accepted_at IS NOT NULL AND p.revoked_at IS NULL))
 );
$$;

-- Explicit deny-by-default RLS; migration owners may bypass and must never be
-- configured as the runtime database credential.
ALTER TABLE app.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.parcel_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.case_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.evidence_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.evidence_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_self ON app.accounts
 FOR SELECT USING (id=app.current_actor());
CREATE POLICY accounts_self_update ON app.accounts
 FOR UPDATE USING(id=app.current_actor()) WITH CHECK(id=app.current_actor());
CREATE POLICY cases_read ON app.cases FOR SELECT USING(app.can_access_case(id));
CREATE POLICY cases_insert ON app.cases FOR INSERT
 WITH CHECK(created_by=app.current_actor() AND community_id IS NULL AND parcel_id IS NULL);
CREATE POLICY cases_update ON app.cases FOR UPDATE
 USING(created_by=app.current_actor() AND deleted_at IS NULL)
 WITH CHECK(created_by=app.current_actor());
CREATE POLICY events_read ON app.case_events FOR SELECT
 USING(app.can_access_case(case_id));
CREATE POLICY events_append ON app.case_events FOR INSERT
 WITH CHECK(actor_id=app.current_actor() AND app.can_access_case(case_id));
CREATE POLICY participants_read ON app.case_participants FOR SELECT
 USING(app.can_access_case(case_id));

-- Auth-only tables use tightly constrained API endpoints. They must not be
-- reachable by public database credentials or frontends.
-- Their runtime grants are explicit in ops/runtime-grants.sql.
COMMIT;
