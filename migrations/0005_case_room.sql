-- 0005: Authenticated case-room collaboration with case-scoped consent.
-- IMPORTANT: No legal title/ownership or HOA office is verified by email alone.
-- Application runtime is a separate, NON-owner, NON-BYPASSRLS role.
BEGIN;
ALTER TABLE app.case_invites ADD COLUMN invitee_email text;
ALTER TABLE app.case_invites ADD CONSTRAINT case_invites_email_length
 CHECK(invitee_email IS NULL OR length(invitee_email) BETWEEN 3 AND 254);

CREATE TABLE app.case_room_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES app.cases(id),
 author_id uuid NOT NULL REFERENCES app.accounts(id),
 visibility text NOT NULL CHECK(visibility IN ('shared','private')),
 statement text NOT NULL CHECK(length(statement) BETWEEN 3 AND 5000),
 evidence_reference text NOT NULL DEFAULT '' CHECK(length(evidence_reference)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,case_id)
);
CREATE INDEX case_room_notes_case ON app.case_room_notes(case_id,created_at,id);
CREATE INDEX case_room_notes_actor_rate ON app.case_room_notes(case_id,author_id,created_at DESC);

-- Database-side anti-flooding, in addition to mail invitation limits.
CREATE FUNCTION app.case_room_note_rate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $room_rate$
BEGIN
 IF app.current_actor() IS DISTINCT FROM NEW.author_id
    OR NOT app.can_access_case(NEW.case_id) THEN
  RAISE EXCEPTION 'Unauthorized room statement';
 END IF;
 IF (SELECT count(*) FROM app.case_room_notes n
   WHERE n.case_id=NEW.case_id AND n.author_id=NEW.author_id
   AND n.created_at>now()-interval '1 hour')>=60 THEN
  RAISE EXCEPTION 'Hourly case room note limit reached';
 END IF;
 RETURN NEW;
END $room_rate$;
CREATE TRIGGER enforce_room_note_rate BEFORE INSERT ON app.case_room_notes
 FOR EACH ROW EXECUTE FUNCTION app.case_room_note_rate();
REVOKE ALL ON FUNCTION app.case_room_note_rate() FROM PUBLIC;
CREATE TRIGGER prevent_case_room_notes_edit
 BEFORE UPDATE OR DELETE ON app.case_room_notes
 FOR EACH ROW EXECUTE FUNCTION app.prevent_event_mutation();

CREATE TABLE app.case_room_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 note_id uuid NOT NULL,
 case_id uuid NOT NULL REFERENCES app.cases(id),
 acknowledged_by uuid NOT NULL REFERENCES app.accounts(id),
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (note_id,case_id) REFERENCES app.case_room_notes(id,case_id),
 UNIQUE(note_id,acknowledged_by)
);
CREATE INDEX case_room_receipts_case ON app.case_room_receipts(case_id,note_id);
CREATE TRIGGER prevent_case_room_receipts_edit
 BEFORE UPDATE OR DELETE ON app.case_room_receipts
 FOR EACH ROW EXECUTE FUNCTION app.prevent_event_mutation();

CREATE TABLE app.case_room_access_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES app.cases(id),
 actor_id uuid NOT NULL REFERENCES app.accounts(id),
 event_type text NOT NULL CHECK(event_type IN ('invited','accepted','revoked','canceled')),
 subject_id uuid REFERENCES app.accounts(id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER prevent_case_room_access_events_edit
 BEFORE UPDATE OR DELETE ON app.case_room_access_events
 FOR EACH ROW EXECUTE FUNCTION app.prevent_event_mutation();

ALTER TABLE app.case_room_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.case_room_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.case_room_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_note_read ON app.case_room_notes FOR SELECT
 USING(app.can_access_case(case_id) AND
  (visibility='shared' OR author_id=app.current_actor()));
CREATE POLICY room_note_add ON app.case_room_notes FOR INSERT
 WITH CHECK(app.can_access_case(case_id) AND author_id=app.current_actor());
CREATE POLICY room_receipts_read ON app.case_room_receipts FOR SELECT
 USING(app.can_access_case(case_id));
CREATE POLICY room_receipts_add ON app.case_room_receipts FOR INSERT
 WITH CHECK (
  acknowledged_by=app.current_actor() AND app.can_access_case(case_id)
  AND EXISTS (SELECT 1 FROM app.case_room_notes n
   WHERE n.id=note_id AND n.visibility='shared'
    AND n.author_id<>app.current_actor())
 );
CREATE POLICY room_access_events_read ON app.case_room_access_events FOR SELECT
 USING(app.can_access_case(case_id));

-- These authorization functions intentionally bypass RLS as their *owner*.
-- They validate the authenticated actor set by a server-verified session transaction.
-- Do not create them under the runtime login or grant them to PUBLIC.
CREATE FUNCTION app.case_issue_invite(
 target uuid, recipient text, token_hash text, email_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE actor uuid := app.current_actor();
DECLARE invite_id uuid;
BEGIN
 IF actor IS NULL OR recipient IS NULL OR
    recipient<>lower(trim(recipient)) OR length(recipient) NOT BETWEEN 3 AND 254
    OR position('@' IN recipient)<2 OR token_hash !~ '^[0-9a-f]{64}$'
    OR email_hash !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'Invalid invitation request';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM app.cases
    WHERE id=target AND created_by=actor AND deleted_at IS NULL
    AND status NOT IN ('closed')) THEN
  RAISE EXCEPTION 'Only the active case creator can invite';
 END IF;
 IF EXISTS (SELECT 1 FROM app.accounts WHERE id=actor AND email=recipient) THEN
  RAISE EXCEPTION 'Cannot invite your own account';
 END IF;
 IF (SELECT count(*) FROM app.case_invites
     WHERE case_id=target AND created_by=actor
      AND created_at>now()-interval '1 day')>=10 THEN
  RAISE EXCEPTION 'Daily invitation limit reached';
 END IF;
 IF (SELECT count(*) FROM app.case_invites
     WHERE created_by=actor AND created_at>now()-interval '1 day')>=30 THEN
  RAISE EXCEPTION 'Account daily invitation limit reached';
 END IF;
 INSERT INTO app.case_invites(
  case_id,invitee_email,invitee_email_digest,invite_token_digest,
  role,created_by,expires_at
 ) VALUES(target,recipient,email_hash,token_hash,'observer',actor,
    now()+interval '48 hours')
 RETURNING id INTO invite_id;
 INSERT INTO app.case_room_access_events(case_id,actor_id,event_type)
 VALUES(target,actor,'invited');
 RETURN invite_id;
END $$;

CREATE FUNCTION app.case_cancel_invite(invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE actor uuid := app.current_actor();
DECLARE target uuid;
BEGIN
 UPDATE app.case_invites SET revoked_at=now()
 WHERE id=invite_id AND created_by=actor AND accepted_at IS NULL AND revoked_at IS NULL
 RETURNING case_id INTO target;
 IF target IS NULL THEN RETURN false; END IF;
 INSERT INTO app.case_room_access_events(case_id,actor_id,event_type)
 VALUES(target,actor,'canceled');
 RETURN true;
END $$;

CREATE FUNCTION app.case_pending_invites(target uuid)
RETURNS TABLE(invite_id uuid,recipient_email text,issued_at timestamptz,expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=app,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.cases
 WHERE id=target AND created_by=app.current_actor() AND deleted_at IS NULL)
 THEN RETURN; END IF;
 RETURN QUERY SELECT i.id,i.invitee_email,i.created_at,i.expires_at
 FROM app.case_invites i WHERE i.case_id=target
  AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()
 ORDER BY i.created_at DESC;
END $$;

CREATE FUNCTION app.case_accept_invite(token_hash text)
RETURNS TABLE(accepted_case_id uuid, accepted_role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE actor uuid := app.current_actor();
DECLARE recipient text;
DECLARE token_row record;
BEGIN
 IF actor IS NULL OR token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 SELECT a.email INTO recipient FROM app.accounts a
 WHERE a.id=actor AND a.email_verified_at IS NOT NULL AND a.disabled_at IS NULL;
 IF recipient IS NULL THEN RETURN; END IF;
 SELECT * INTO token_row FROM app.case_invites i
 WHERE i.invite_token_digest=token_hash
  AND i.accepted_at IS NULL AND i.revoked_at IS NULL
  AND i.expires_at>now() AND i.invitee_email=recipient
 FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT EXISTS (SELECT 1 FROM app.cases c
   WHERE c.id=token_row.case_id AND c.deleted_at IS NULL
    AND c.status<>'closed') THEN RETURN; END IF;
 -- A verified email controls a mailbox, not HOA legal authority.
 -- Invitees receive ONLY the existing nonprivileged 'observer' case role.
 INSERT INTO app.case_participants(case_id,account_id,role,invited_by,accepted_at)
 VALUES(token_row.case_id,actor,'observer',token_row.created_by,now())
 ON CONFLICT (case_id,account_id,role) DO UPDATE
   SET revoked_at=NULL,accepted_at=now(),invited_by=EXCLUDED.invited_by;
 UPDATE app.case_invites SET accepted_at=now(),accepted_by=actor
 WHERE id=token_row.id;
 INSERT INTO app.case_room_access_events(case_id,actor_id,event_type,subject_id)
 VALUES(token_row.case_id,actor,'accepted',actor);
 accepted_case_id:=token_row.case_id;
 accepted_role:='observer';
 RETURN NEXT;
END $$;

CREATE FUNCTION app.case_revoke_participant(target uuid, participant uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE actor uuid := app.current_actor();
DECLARE changed integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.cases
  WHERE id=target AND created_by=actor AND deleted_at IS NULL)
  THEN RAISE EXCEPTION 'Case owner authorization required'; END IF;
 IF participant=actor THEN RAISE EXCEPTION 'Cannot revoke case owner'; END IF;
 UPDATE app.case_participants
 SET revoked_at=now() WHERE case_id=target AND account_id=participant
  AND accepted_at IS NOT NULL AND revoked_at IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed>0 THEN
  UPDATE app.case_invites SET revoked_at=now()
  WHERE case_id=target AND accepted_at IS NULL AND revoked_at IS NULL
    AND invitee_email=(SELECT email FROM app.accounts WHERE id=participant);
  INSERT INTO app.case_room_access_events(case_id,actor_id,event_type,subject_id)
  VALUES(target,actor,'revoked',participant);
 END IF;
 RETURN changed>0;
END $$;

CREATE FUNCTION app.case_room_members(target uuid)
RETURNS TABLE(member_id uuid,member_email text,member_role text,joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=app,pg_temp AS $$
BEGIN
 IF NOT app.can_access_case(target) THEN RETURN; END IF;
 RETURN QUERY
 SELECT a.id,a.email,'case_owner'::text,c.created_at FROM app.cases c
 JOIN app.accounts a ON a.id=c.created_by
 WHERE c.id=target AND c.deleted_at IS NULL
 UNION ALL
 SELECT a.id,a.email,p.role,p.accepted_at
 FROM app.case_participants p JOIN app.accounts a ON a.id=p.account_id
 WHERE p.case_id=target AND p.accepted_at IS NOT NULL AND p.revoked_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION app.case_issue_invite(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.case_cancel_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.case_pending_invites(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.case_accept_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.case_revoke_participant(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.case_room_members(uuid) FROM PUBLIC;
COMMIT;
