
-- CommonGround architecture draft: proposed production schema, NOT yet deployed.
-- Requires security review, migrations, authenticated server APIs and operational
-- row-level access policies BEFORE connecting any real homeowner data.
-- A bare schema or connected database is NOT an authorization boundary.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE IF NOT EXISTS accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email citext UNIQUE NOT NULL,
 email_verified_at timestamptz,
 display_name text,
 created_at timestamptz NOT NULL DEFAULT now(),
 disabled_at timestamptz
);
CREATE TABLE IF NOT EXISTS communities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 state char(2) NOT NULL CHECK (state='FL'),
 county text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid NOT NULL REFERENCES communities(id),
 account_id uuid NOT NULL REFERENCES accounts(id),
 role text NOT NULL CHECK (role IN ('resident','board','manager','neutral','auditor')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
 proof_reviewed_by uuid REFERENCES accounts(id),
 proof_reviewed_at timestamptz,
 granted_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 UNIQUE (community_id,account_id,role)
);
CREATE TABLE IF NOT EXISTS cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid REFERENCES communities(id),
 creator_id uuid NOT NULL REFERENCES accounts(id),
 title text NOT NULL CHECK (length(title) BETWEEN 3 AND 180),
 category text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shared','in_review','discussion','resolved','closed')),
 summary text,
 governing_authority text,
 proposed_resolution text,
 record_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS case_participants (
 case_id uuid NOT NULL REFERENCES cases(id),
 account_id uuid NOT NULL REFERENCES accounts(id),
 capacity text NOT NULL CHECK (capacity IN ('creator','resident','board','manager','neutral','auditor')),
 invited_by uuid REFERENCES accounts(id),
 accepted_at timestamptz,
 access_revoked_at timestamptz,
 PRIMARY KEY(case_id,account_id,capacity)
);
CREATE TABLE IF NOT EXISTS evidence_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES cases(id),
 uploaded_by uuid NOT NULL REFERENCES accounts(id),
 object_key text NOT NULL UNIQUE,
 cipher_suite text NOT NULL DEFAULT 'AES-256-GCM',
 encrypted_file_key bytea NOT NULL,
 content_sha256 bytea NOT NULL CHECK(octet_length(content_sha256)=32),
 encrypted_metadata bytea NOT NULL,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES cases(id),
 actor_id uuid NOT NULL REFERENCES accounts(id),
 actor_capacity text NOT NULL,
 event_type text NOT NULL,
 event_payload jsonb NOT NULL,
 prior_hash bytea,
 content_hash bytea NOT NULL CHECK(octet_length(content_hash)=32),
 event_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_events_case_order ON case_events(case_id,created_at,id);
CREATE TABLE IF NOT EXISTS case_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES cases(id),
 invitee_email_hash bytea NOT NULL,
 invite_token_hash bytea UNIQUE NOT NULL,
 intended_capacity text NOT NULL,
 expires_at timestamptz NOT NULL,
 accepted_by uuid REFERENCES accounts(id),
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_by uuid NOT NULL REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS neutral_conflicts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES cases(id),
 reviewer_id uuid NOT NULL REFERENCES accounts(id),
 disclosed_at timestamptz NOT NULL DEFAULT now(),
 conflict_type text NOT NULL,
 disposition text CHECK(disposition IN ('disqualified','cleared','referred')),
 resolved_by uuid REFERENCES accounts(id)
);
-- Deny table access to application identities until security policies are
-- explicitly reviewed, tested and deployed. No permissive RLS policies here.
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE neutral_conflicts ENABLE ROW LEVEL SECURITY;
-- A production migration must manage service/database roles and grant only
-- required rights, with FORCE RLS where applicable and explicit tenant policies.
COMMIT;
