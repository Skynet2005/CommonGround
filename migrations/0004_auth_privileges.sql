-- 0004: Privileged authentication procedures with runtime-safe entrypoints.
-- Preconditions: 0001 core and 0003 account bootstrap.
-- These SECURITY DEFINER functions run as the migration owner, while the public
-- application connection remains a non-owner with denied direct auth-table access.
BEGIN;

CREATE FUNCTION app.auth_issue_link(
 normalized_email text,
 hashed_token text,
 hashed_fingerprint text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp
AS $$
DECLARE new_id uuid;
BEGIN
 IF normalized_email IS NULL OR normalized_email <> lower(trim(normalized_email))
    OR length(normalized_email) NOT BETWEEN 3 AND 254
    OR position('@' IN normalized_email)=0
    OR hashed_token IS NULL OR length(hashed_token)<>64
    OR hashed_token !~ '^[0-9a-f]{64}$'
    OR hashed_fingerprint IS NULL OR hashed_fingerprint !~ '^[0-9a-f]{64}$' THEN
  RETURN NULL;
 END IF;

 -- A malicious requester shouldn't be able to exceed these server-side quotas
 -- merely by calling the endpoint repeatedly.
 IF (SELECT count(*) FROM app.login_tokens
      WHERE email=normalized_email AND created_at>now()-interval '15 minutes')>=3
    OR (SELECT count(*) FROM app.login_tokens
      WHERE request_fingerprint=hashed_fingerprint
        AND created_at>now()-interval '15 minutes')>=10 THEN
  RETURN NULL;
 END IF;

 INSERT INTO app.login_tokens(email,token_digest,request_fingerprint,expires_at)
 VALUES(normalized_email,hashed_token,hashed_fingerprint,now()+interval '15 minutes')
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;

CREATE FUNCTION app.auth_cancel_link(link_id uuid, hashed_token text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
BEGIN
 DELETE FROM app.login_tokens WHERE id=link_id AND token_digest=hashed_token
   AND consumed_at IS NULL;
 RETURN FOUND;
END $$;

CREATE FUNCTION app.auth_accept_link(
 hashed_token text,
 session_digest text
) RETURNS TABLE(account_id uuid, verified_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE t record;
DECLARE verified_id uuid;
BEGIN
 IF hashed_token !~ '^[0-9a-f]{64}$'
    OR session_digest !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 SELECT id,email INTO t FROM app.login_tokens
 WHERE token_digest=hashed_token AND consumed_at IS NULL
   AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;

 SELECT app.upsert_verified_account(t.email) INTO verified_id;
 INSERT INTO app.sessions(account_id,token_digest,expires_at)
 VALUES(verified_id,session_digest,now()+interval '14 days');
 UPDATE app.login_tokens SET consumed_at=now() WHERE id=t.id;
 account_id:=verified_id;
 verified_email:=t.email;
 RETURN NEXT;
END $$;

CREATE FUNCTION app.auth_session_account(hashed_token text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=app,pg_temp AS $$
 SELECT s.account_id FROM app.sessions s
 JOIN app.accounts a ON a.id=s.account_id
 WHERE s.token_digest=hashed_token AND s.revoked_at IS NULL
   AND s.expires_at>now() AND a.disabled_at IS NULL
   AND a.email_verified_at IS NOT NULL LIMIT 1;
$$;

CREATE FUNCTION app.auth_revoke_session(hashed_token text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
BEGIN
 UPDATE app.sessions SET revoked_at=now()
 WHERE token_digest=hashed_token AND revoked_at IS NULL;
 RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION app.auth_issue_link(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_cancel_link(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_accept_link(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_session_account(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_revoke_session(text) FROM PUBLIC;

COMMIT;
