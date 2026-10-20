# CommonGround — Product and security audit (October 2026)

**Status:** Source-backed engineering review and market opportunity analysis. Not a legal opinion, penetration test, client-browser certification, or guarantee of full platform readiness.

## Critical findings

| Area | What works | Main deficiency | Priority |
|---|---|---|---|
| Startup | React/Vite app is deployed, hotfix imports missing Wrench icon | No identifier lint or actual render smoke test allowed a blank page | P0: add CI and recovery |
| Browser-local case records | Case entry, checklist, linked history, exports | Case text is unencrypted localStorage; hashes are not independently anchored | P0 before handling actual confidential cases |
| Encrypted local operations | Community records, meetings, maintenance, vendor review, illustrative finance, informal polls | Does not sync or grant authenticated roles; encrypted evidence and metadata backups are separate | P1 |
| Hosted identity | Passwordless endpoint and RLS draft exists, gated | No PostgreSQL or email provider actually configured; no ownership/authority proof | P0 for shared platform |
| Legal source navigator | 2026 Florida statute links and procedure categories | No verified recorded HOA covenants, effective version graph, certified notices or human-reviewed flowcharts | P1 |
| Document vault | Local AES-256-GCM encryption with tested recovery | No hosted permissioned storage, virus scanning, independent custody, cross-device recovery or retention enforcement | P1 |
| Financial/governance | Model and illustrative workflows | No payment processing, accountant-reviewed ledgers, certified elections or independently neutral reviews | P2–P3 |
| Quality and accessibility | 36 passing pre-hotfix unit/integration tests | Tests did not catch a missing imported icon; no responsive browser grid, WCAG audit or monitoring/rollback SLO | P0/P1 |
| Stewardship | Fairness charter and independent-review model proposed | Independent governance and neutrality guarantees are not yet organizationally established | P1 |

## Market positioning

PayHOA, Condo Control, Vantaca, Enumerate and TownSq already offer many combinations of maintenance, resident portals, payments, violations, records, and governance functionality. Merely building another menu of those modules is not a credible moat.

A more defensible promise is **verifiable fair process**: every material association decision linked to authenticated authority, current governing source, evidence and counterevidence, proper notice, opportunity to respond, actual reason, and qualified appeal. Homeowner and association retain data access proportionate to their rights.

Representative references:
- https://www.payhoa.com/
- https://www.condocontrol.com/
- https://www.flsenate.gov/Laws/Statutes/2026/Chapter720/All
- User discussions (anecdotal): https://www.reddit.com/r/HOA/comments/1lpfjsa/ and https://www.reddit.com/r/HOA/comments/1pciji0/

## Differentiated product features (ordered)

1. **RuleGraph** — versioned county-recorded declarations, amendments, covenants, plats/easements and statutes. Exact clause citations, effective dates, provenance and exception handling. Source-first search, not invented legal authority.
2. **Decision Passport** — for every action, a portable signed record of authority, rule, factual basis, notice proof, response, independent review, reasons, outcome and later corrections. Anchored independently of either party.
3. **Fairness Twin** — privacy-safe comparisons of truly comparable cases (rule version, specific facts, category, dates, exceptions) to flag anomalous treatment for human inquiry, never automatic accusations.
4. **Two-Sided Dispute Room** — secure owner/HOA record exchange with independently controlled access, witnessed receipts, immutable submissions and neutral-review conflict screening.
5. **Process Navigator Pro** — contextual pathways and approval gates for architectural approvals, fine hearings, records, assessments, elections and mediation. Human-checked dates and verified statutory service, not just drafts.
6. **Governance Transparency Ledger** — board decisions, meeting notices, recusals, vendor quotes, contract awards, rationale, reserve spending and audit/redaction history.
7. **Maintenance Completion Proof** — report, approval, quote, contractor execution, inspection, owner response, closure/reopen and warranty trail.
8. **Official Records Portal** — published versions with per-record visibility, redactions, attestation and access-request/response status for eligible residents.
9. **Independent Neutral Network** — verified mediators, inspectors and arbitrators with disclosures, party consent, recusals and audited quality controls.
10. **Explainable Reserve and Spending Intelligence** — contract-linked budget-to-actual, capital replacement forecast, conflicts, and independent reconciliation.
11. **Portable Civic Records** — an open API and complete resident data/evidence exports independent of the association's chosen management vendor.
12. **Accessible Resident Advocate** — plain-language, multilingual, mobile, low-bandwidth workflows with transparent progress and human escalation.
13. **Cited AI Copilot** — retrieval of exact authorized source versions, bidirectional evidence evaluation and uncertainty. Never autonomously issue legal or financial orders.
14. **Certified Voting Engine** — independently security-reviewed voter eligibility, receipts, consent, proxy rules, secrecy and recount.
15. **Processor-Integrated Financial Operations** — regulated payment processors, role separation, reconciliation, immutable journal reversals and verified delinquency workflows.

## Florida-specific gating

- Section 720.305 establishes specific fine and suspension process controls, including hearing requirements. A locally drafted notice is not proof it was served.
- Section 720.303 addresses official records and posting requirements, with exceptions and qualified applicability.
- Section 720.3055 regulates contracts and certain competitive bid rules, with exceptions.
- Section 720.311 has dispute resolution exclusions and special procedures.
- Section 720.317 requires authenticated compliant electronic voting and consent, not informal polls.

Qualified Florida counsel must approve workflows and verify effective versions and community governing documents before binding transactions.

## Roadmap with acceptance gates

**R0 — Reliability now:** fix startup exception, true React render smoke test, lint for missing globals/imports, visible fallback/error recovery, monitor frontend errors, verify deployment and release rollback. Exit: browser boot is tested in CI.

**R1 — Secure collaboration:** host non-owner PostgreSQL roles/migrations, auth delivery, identity/parcel verification, per-case role grants, private encrypted objects, recovery and retention controls. Exit: negative cross-tenant tests, backup restore and external review.

**R2 — Product differentiation:** RuleGraph and Decision Passport, two-sided case exchange, sourced notice records and neutral oversight. Exit: counsel-approved pilot, case-level human review, privacy assessment and measured user trust.

**R3 — Network features:** Fairness Twin, record requests, mediation, transparent procurement, maintenance completion and publishable privacy-safe scorecards. Exit: independently verified comparable-case evaluation and secure integration contracts.

**R4 — High assurance:** AI analysis, statutory election, processor-backed accounting and reserve forecasts only after module-specific external audits.

## Outcome measurements

Track successful launches, error-free sessions, completed cases, timely meaningful responses, valid source citations, verified deliveries, neutral independence/recusal, reversible incorrect decisions, complete data exports, privacy incidents and independently sampled procedural quality. No broad fairness score should treat filled-in fields or high settlement rates as proof of justice.

This audit is an engineering and product recommendation based on available source and public evidence, not a verified pricing/business forecast.
