-- Separate PostgreSQL runtime role. Must exist before executing this file.
-- Run ONLY with migration privileges and after all database migrations.
BEGIN;
GRANT USAGE ON SCHEMA app TO commonground_runtime;
-- Raw authentication tables remain inaccessible to the runtime login.
REVOKE ALL ON app.login_tokens,app.sessions FROM commonground_runtime;
GRANT SELECT ON app.accounts TO commonground_runtime;
GRANT SELECT ON app.communities,app.memberships,app.parcels,app.parcel_claims TO commonground_runtime;
GRANT SELECT,INSERT,UPDATE ON app.cases TO commonground_runtime;
GRANT SELECT ON app.case_participants TO commonground_runtime;
GRANT SELECT,INSERT ON app.case_events TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.current_actor() TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.can_access_case(uuid) TO commonground_runtime;
REVOKE EXECUTE ON FUNCTION app.upsert_verified_account(text) FROM commonground_runtime;
GRANT EXECUTE ON FUNCTION app.auth_issue_link(text,text,text) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.auth_cancel_link(uuid,text) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.auth_accept_link(text,text) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.auth_session_account(text) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.auth_revoke_session(text) TO commonground_runtime;
-- Collaboration grants: participant-only room content, no raw invitation access.
REVOKE ALL ON app.case_invites,app.case_room_access_events FROM commonground_runtime;
GRANT SELECT,INSERT ON app.case_room_notes TO commonground_runtime;
GRANT SELECT,INSERT ON app.case_room_receipts TO commonground_runtime;
GRANT SELECT ON app.case_room_access_events TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.case_issue_invite(uuid,text,text,text) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.case_cancel_invite(uuid) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.case_pending_invites(uuid) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.case_accept_invite(text) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.case_revoke_participant(uuid,uuid) TO commonground_runtime;
GRANT EXECUTE ON FUNCTION app.case_room_members(uuid) TO commonground_runtime;
COMMIT;
