
-- 0003: Narrow, migration-owner account bootstrap for verified email link.
-- Authentication proof is checked by the server before invoking this function.
BEGIN;
CREATE FUNCTION app.upsert_verified_account(verified_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE account_id uuid;
BEGIN
 IF verified_email IS NULL OR length(verified_email)>254 OR length(verified_email)<3
    OR verified_email<>lower(trim(verified_email)) OR position('@' in verified_email)=0 THEN
  RAISE EXCEPTION 'Invalid verified account email';
 END IF;
 INSERT INTO app.accounts(email,email_verified_at) VALUES(verified_email,now())
 ON CONFLICT(email) DO UPDATE SET email_verified_at=EXCLUDED.email_verified_at
 RETURNING id INTO account_id;
 RETURN account_id;
END $$;
REVOKE ALL ON FUNCTION app.upsert_verified_account(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.can_access_case(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_actor() FROM PUBLIC;
COMMIT;
