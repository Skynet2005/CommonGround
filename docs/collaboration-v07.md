# CommonGround v0.7 — Case-Room Collaboration

Status: IMPLEMENTED IN CODE, **NOT ENABLED ON PRODUCTION**. This release is a secure-by-default foundation for authenticated participation, not verified HOA ownership.

## Supported when backend is configured

- The case creator emails a 48-hour one-time invitation, redeemable only by an authenticated session with the matching verified mailbox.
- Invitation tokens are 256-bit random values and only HMAC digests are persisted. Tokens occur in URL fragments, not web server query logs.
- An accepted guest receives a case-only observer role. This is **not** verified homeowner or board membership. Both sides can see accepted email addresses after explicit consent.
- Creator may cancel pending invitations and revoke guests. Revocation blocks **future** access but cannot retract previously shared content.
- Shared notes are visible to every accepted case member, including those invited later. Private notes are visible **only to their author**, not automatically to the case creator.
- A different room member can acknowledge receiving a shared statement. This is not statutory legal service, agreement with its claims, or proof of evidentiary authenticity.
- Notes and receipts are append-only at the application database layer. Trusted database administrators/backups are outside this protection.
- Raw invitations remain inaccessible to the runtime database login. PostgreSQL RLS isolates cases and scopes access.
- Negative tests exercise wrong recipient, token replay, private-note isolation, case edits, spoofed authorship and revocation.

## Production rollout gates

Provision a PostgreSQL 15+ cluster with an audited distinct migration owner and app runtime role. The runtime role must not own app tables, be superuser or have BYPASSRLS. Install migrations 0001–0005 with the atomic migration runner, then reapply ops/runtime-grants.sql. Never configure the migration URL in Vercel.

Configure Vercel server-only DATABASE_RUNTIME_URL, AUTH_TOKEN_PEPPER, RESEND_API_KEY, EMAIL_FROM and PUBLIC_ORIGIN. Test real email deliverability and domain authentication. Keep SHARED_BETA_ENABLED and CASE_COLLAB_ENABLED false until authorization-negative tests, incident monitoring, encrypted backup restore, rate limits and third-party security review succeed in protected staging. Enable both flags only with operator approval.

No such production database or email provider is connected as of this release. The public web application remains local-only and will reject shared API access with 503.

## Important exclusions

Verified email is not verified association membership, parcel title, property authority, board office, or neutral reviewer independence. Remote statements are stored in PostgreSQL and NOT end-to-end encrypted. Do not enter privileged mediation, legal strategy, private identification or sensitive health/banking data. Shared file uploads, malware scanning, externally authenticated evidence custody, true statutory legal service, binding elections and regulated payments remain unimplemented.

Read docs/trust-center-v06.md for the encrypted local Trust Center and docs/deployment-runbook.md for operator setup. No real homeowner data should be put into the hosted beta until legal/privacy/security release gates are reviewed and signed off.
