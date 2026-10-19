# CommonGround v0.4 — security, correctness and process assurance

Date: 2026-10-19
Scope: Source-only backend hardening, browser-local process review and operational safeguards.
Status: Staging/production shared database remains **OFF**. Real HOA membership and hosted evidence not implemented.

## Key corrections

1. **Least-privilege authentication routines.** Migration 0004 defines security-definer routines to issue, cancel and consume one-time email login tokens, inspect valid sessions, and revoke sessions. The runtime database role gets EXECUTE on these bounded functions and no direct permission to read or mutate the login/session tables.
2. **Passwordless login replay resistance.** A link can be used once within its expiry. Requests are throttled at the database level, not by reading token tables from a restricted caller. Email still uses a separately configured, approved service.
3. **Atomic schema upgrades.** The migration runner executes both the SQL migration and its applied-migration journal entry inside one transaction. Applied migration content hashes cannot silently change.
4. **Optimistic case version checks.** PATCH /api/cases and POST /api/events require expectedVersion. After an authenticated writer takes the case row lock, a mismatch returns HTTP 409 instead of silently replacing a newer record.
5. **Link routing.** Email sign-in links use the URL fragment and load Shared Workspace on first page render, allowing one-time code verification without putting the token in HTTP query parameters.
6. **Source-specific process assurance.** The local browser interface highlights incomplete procedural documentation. Exact normalized rule references must match before cases are suggested for comparison. This is not a finding of selective enforcement.
7. **Regression tests.** PostgreSQL-compatible tests verify authentication behavior and replay rejection. Existing tests cover tenant isolation, DB privacy, cryptographic integrity, migration execution, and API request checks.

## Known limitations remaining

- No provisioned PostgreSQL or email sending credentials. Vercel private beta flag is disabled. Database API has not undergone integration testing against a hosted PostgreSQL service.
- The API uses a trusted server-set database session variable for row-level rules. Compromise of the server's database runtime credential would require additional controls (credential rotation, breach containment, monitored access) beyond the RLS assumptions tested.
- Browser-local case text is NOT encrypted. The separate encrypted vault is not an independent evidence archive. Do not enter private facts into plain case fields.
- Login one-time links do not prove HOA membership, ownership, tenant standing, board office, or management authority.
- No live independent mediation, third-party review, notice service, electronic voting, finance operations, legal decision engine, or hosted evidence sharing.
- Account enrollment needs reviewed abuse prevention, automatic expiry cleanup, real provider deliverability and independent threat modeling before public production.
- Legal guidance is human-authored and linked to Florida's official 2026 statutes. Counsel should validate workflows prior to use in active disputes.
- Controlled previews and production release tests need automated browser accessibility testing, negative cross-account checks on a hosted database, load/performance tests and mandatory approvals.

## Process assurance interpretation

The five gap indicators are deterministic based on user-entered fields. Comparable cases require the same normalized community, category and authority text. Differences in facts, property conditions, notices, applicable dates, remedies or adjudicatory outcomes may justify different treatment.

No compliance score, guarantee, accusations, resident rankings or protected-class profiling is generated. Privacy is preserved by performing these comparisons only within the viewer's local records.

## Before external pilot launch

Provision separate migration and runtime DB roles; apply and verify migrations; add private evidence storage with encryption and object-level permissions; establish independent nonprofit stewardship; complete formal counsel and third-party security review; enforce actual HOA membership verification, reviewer conflicts and required notice processes; implement audit anchor and deletion/retention protocols.
