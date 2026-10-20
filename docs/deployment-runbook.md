# Hosted private-case backend runbook

**STATE: OFF.** No database or email credentials are configured in Vercel. The browser-local workspace still works. This guide does not authorize activation with private homeowner data.

1. Provision PostgreSQL 15+ with backups and encryption via an approved database provider. Confirm any pricing terms first.
2. Create **separate database accounts**: a schema migration owner and a runtime login account named commonground_runtime. Runtime must not own app tables or have SUPERUSER/BYPASSRLS.
3. Apply migrations with DATABASE_MIGRATION_URL from trusted admin infrastructure (never Vercel production env), using npm run db:migrate.
4. Apply ops/runtime-grants.sql from the migration owner and test RLS with distinct users.
5. Set Vercel encrypted server-only variables DATABASE_RUNTIME_URL, AUTH_TOKEN_PEPPER, RESEND_API_KEY, EMAIL_FROM and PUBLIC_ORIGIN. Keep SHARED_BETA_ENABLED=false while testing.
6. Verify sender domain, use mail deliverability checks, and test one-time link expiry/replay and CSRF.
7. Exercise cross-tenant authorization, concurrency and append-only audit histories in protected preview. Verify backups and restore drills.
8. Only after acceptance tests, security/privacy assessment and legal reviewer signoff, enable SHARED_BETA_ENABLED=true and retest status, sessions, cases, audit events, and error logging.
9. Do not enable hosted document uploads, HOA board roles, mediation, payments or elections as part of this limited beta. They need separate policy gates.

The private case API will refuse DB connections where current_user is the table owner, superuser or BYPASSRLS. It accepts actor identity only from server-verified sessions. Source database schema is not proof of a working secure service.


## v0.4 release controls (added 2026-10-19)

The migration runner now journal-commits each migration in the same transaction as the DDL. Apply the new 0004_auth_privileges.sql migration before enabling sign-in. Reapply ops/runtime-grants.sql to remove raw app.login_tokens and app.sessions access from commonground_runtime and grant only the bounded authentication routines. Verify replay rejection, server-side identity, and sign-out with a non-owner database role. Existing databases must be backed up and migrations tested against a staging restore first.

Concurrent case updates now require the prior expectedVersion field. A stale write returns HTTP 409 and must prompt the user to reload and reconcile the latest record. Do not bypass this check for background jobs. The Process Review dashboard compares local case records only and is not evidence of legal noncompliance.


## v0.7 verified-email collaboration rollout

Migrate through 0005_case_room.sql, then reapply ops/runtime-grants.sql. On protected staging, verify case creator can invite only their own cases; a different mailbox cannot consume a token; replay and expiry fail; guests can view only accepted cases; private statements remain author-only; only other members may acknowledge shared notes; guests cannot edit the creator's case; and revocation removes all future access. Confirm rollback and point-in-time restoration before collecting actual resident data.

Configure CASE_COLLAB_ENABLED=false by default. The new case-room APIs additionally require SHARED_BETA_ENABLED=true, configured nonowner database credentials, a verified mail provider, and the separate CASE_COLLAB_ENABLED=true flag. Nothing in an email invitation proves legal property ownership or board authority. No uploaded evidence, certified service, or privileged mediation is available in this beta. See docs/collaboration-v07.md for the security model.
