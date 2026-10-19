# CommonGround — integrated data architecture (v0.3)

**STATUS:** The schema and APIs are code, NOT a provisioned shared database. They are deliberately gated pending infrastructure, legal and security review.

## Non-negotiable rules

Every record must have provenance and a clear access policy. An email login is not proof of parcel ownership or HOA board authority. A hash of a photograph does not prove the photograph is genuine. A rule quotation is not a finding that the HOA may enforce it. AI has no binding authority.

Mediation records are isolated from normal case exports, search, AI prompts, reporting and public official records. The platform cannot replace legal remedies or enforce property entry.

## Normalized PostgreSQL domains

| Data plane | Representative tables | Trust boundary |
|---|---|---|
| Identity and community | accounts, sessions, communities, memberships, parcels, parcel_claims | Independently review ownership and role |
| Law and documents | legal_sources, legal_versions, documents, document_versions, community_rules, rule_crosswalk | Version and cite official authority |
| Claims and cases | cases, case_participants, case_issues, issue_support, case_events | Private-by-default, two-sided evidence |
| Custody and delivery | evidence_objects, evidence_attestations, notices, notice_deliveries, deadlines | Prove exact bytes and delivery events without assuming authenticity |
| Reviews | neutral_reviews, reviewer_disclosures, appeals, settlement_proposals, proposal_signoffs | Human acceptance, independent conflicts |
| Mediation | mediation_sessions, mediation_private_materials | Separate sealed access and retention |
| Governance | governance_seats, meetings, meeting_attendance, ballot_events, sealed_ballots | Secret ballot engine must be separately audited |
| Finance and procurement | financial_periods, budgets, ledger_accounts, journal_entries, journal_lines, vendor_bids, contracts, assessment_charges, payment_references | Balanced ledger and approval rules must precede activation |
| Community work | maintenance_requests, work_orders | Contractor approval and inspection proof |
| Privacy and safety | notifications, consent_records, data_requests, security_audit, ai_recommendations, metric_snapshots | Minimize disclosure and independently inspect outcomes |

Migration files: migrations/0001_core.sql, migrations/0002_domains.sql and migrations/0003_account_bootstrap.sql. Dedicated runtime grants: ops/runtime-grants.sql. Server API functions: api/status.js, api/auth/*, api/cases.js and api/events.js. Application consumers: src/SharedWorkspace.jsx and src/Atlas.jsx.

The runtime database role must NOT be the migration owner, a superuser, or have BYPASSRLS. Server transactions set app.actor_id from a validated opaque session, never from submitted user JSON. Core cases are isolated by RLS. All future-module tables are RLS-enabled but have no permissive policies.

Passwordless login flow: same-origin email request, HMAC-hashed one-time token in PostgreSQL, 15-minute expiry and throttling, private link in URL fragment, atomic consumption and 14-day Secure/HttpOnly/SameSite session cookie. Email ownership alone confers no official HOA role.

The private browser vault remains separate from remote cases. A future hosted vault needs private objects, envelope encryption, per-file sharing, malware scans, retention, externally anchored custody records, restore drills and credential recovery. No hosted evidence upload is activated.

Go-live obligations: threat model, verified authorization tests, third-party code audit and penetration test, Florida Chapter 720/617/468 legal review, accessibility testing, operational monitoring, encrypted point-in-time backup, retention requests and nonprofit governance. See docs/release-gates.md.
