# CommonGround v0.6 — Trust Center implementation and release constraints

## What is implemented

CommonGround now provides a **locally encrypted Trust Center** inside Community Operations. A single passphrase unlocks the existing encrypted IndexedDB operations workspace (and its backup system), including:

1. **RuleGraph source versions** — create a governing-source entry with title, type, county recording or legal reference, precise section, quoted excerpt, source URL (HTTP/S), entered effective date, reporter, notes and an optional superseded predecessor. Exact source text is copied into each decision passport and hashed. There is **no external source verification**. A user-entered URL is not evidence that the contents are authoritative.
2. **Decision Passport** — select a recorded source version, category and contested facts, record a proposed outcome, claimed decision-maker and asserted authority. Preserve the exact cited source digest, then document reasoning, response opportunity, unsent notice draft, claimed delivery proof reference and workflow status. Each edit creates a hash-linked audit event, while the current encrypted state is also bound to its latest local snapshot digest.
3. **Two-sided dispute record** — attach separate homeowner, association, or independent-observation statements and references to evidence. These are **local perspectives, not messages to another person**, and are never presented as accepted truth.
4. **Independent review proposals** — record proposed reviewer, organization, scope, conflicts, candidate recommendation and status. The application does not contact the reviewer, verify independence, assign a legal review role or provide confidential mediation facilities.
5. **Due-process documentation** — a transparent six-part checklist for recorded governing authority, evidence, both perspectives, notice proof references, stated reasons and independent-review consideration. Completion **does not establish legal compliance** or effective service.
6. **Exact-source comparison** — display other passports entered under the same captured rule-version digest, category and community. Show their statuses, reasoning, response documentation and proposed remedies. This is a prompt for careful human investigation, **not a selective-enforcement or discrimination finding**.
7. **Portable decision export** — explicit opt-in plain JSON export of the passport, source snapshot, positions, proposed reviews, procedural checklist and related audit events, including creation of the cited source entry. The file is **not encrypted**, signed by an authority, notarized or admissibility-certified.
8. **Backward-compatible encryption** — users with v0.5 operations archives can unlock their data without migrating the legacy hashed history. New Trust Center changes append to the same encrypted workspace, preserving old local audit entries and extending the snapshot record.

## Usability workflow

- Open **Community operations**, unlock your existing private passphrase-protected workspace, and select **Trust Center**.
- Set the local community label first, using a non-sensitive name.
- In RuleGraph, add an actual source quotation and recording reference. If it amends a previous version, select the earlier source from the predecessor selector.
- Create a Decision Passport linked to the correct governing version.
- Add both parties' factual positions and evidence references, clearly attributing statements.
- Record a review proposal with the reviewer's stated conflict disclosures, and track progress.
- Open Decision Passports to review the completeness checks, compare exact-version entries and export an explicitly unencrypted record.
- Export **encrypted Operations backup** separately. Encrypted evidence files require their separate Evidence Vault backup.

## Threat model and non-functional limitations

- A passphrase encrypts contents **on this device**. It does not establish who entered them. The browser, its extensions or local OS can be compromised, and a device owner can forge/rebuild local hashes.
- No production PostgreSQL or email identity provider is connected to the standalone Vercel project as of this release. There is **no multi-device sync, verified ownership, role authorization, shared case room, secure recipient acknowledgment, independent neutral credential verification, certified delivery, real accounting, statutory elections or AI legal decision engine**.
- There is no server-side legal-source ingestion or search. Source text must be pasted by the user and reviewed. No automated document-version check against county records or statutory amendments is performed.
- No legal notices are delivered. The typed field called "delivery proof reference" is not tested or certified by CommonGround. No legally significant deadline is calculated.
- Proposed independent reviews are not confidential mediation or legal findings; the notes must not be assumed privileged.
- Export JSON reveals the plaintext record. Users must safeguard it, and must not mistake hashes for externally authenticated evidence custody.
- Rule comparison tests only *exact recorded* rule version, community and category; factual comparability and exceptions always require independent assessment.
- Do not store real sensitive personal identifiers in the browser-local unencrypted **Case Workspace**. The encrypted operations workspace reduces at-rest risk but is not a replacement for approved institutional records management.

## Quality checks

The new tests exercise source validation, immutable rule-version snapshotting, invalid source URLs/dates, notice and review workflow documentation, SHA-256 snapshot tamper detection, exact-version comparison, export completeness, and successful opening of legacy encrypted Operations data. Existing unit tests check database RLS, endpoint boundaries, encryption, backup restore, and app startup.

## Beyond v0.6: requirements for real communities

| Priority | Feature | Release prerequisite |
|---|---|---|
| P0 | Hosted organization, email login, community and parcel identity | Provisioned non-owner PostgreSQL role, verified mail, independently checked ownership/roles, negative access tests |
| P0 | Truly shared two-sided case room | Isolated encrypted hosted evidence, authenticated invitations, tamper-evident acceptance timestamps, per-party access |
| P1 | RuleGraph verification | County instrument retrieval, versioned official sources, effective-date decisions, legal reviewer sign-off, source citation testing |
| P1 | Proof of notice and statutory process | Qualified Florida lawyer-reviewed rule engine, actual delivery/receipts, exceptions and independently verifiable timestamps |
| P1 | Independent reviewers | Identity/credential validation, disclosed affiliations, per-case consent and conflict decisions, private review vault |
| P1 | Fairness Twin analytics | Verified case data, privacy protections, meaningful fact/exception matching, human oversight, bias evaluation |
| P2 | Procurement, maintenance and record-requests | Authenticated contractors, approved work orders, detailed costs, third-party signoff, secure records redaction |
| P2 | AI Advocate | Source-licensed retrieval and exact citations, adversarial tests, abstention, consent, human legal review |
| P3 | Certified elections and processor-backed finance | Independent statutory and security certification, audited ledger reconciliation, processor integration |

**Do not market current local records as independently adjudicated decisions or the platform as Florida-law-certified.** Independent review of law, security, data handling and accessibility is necessary before actual users rely on it.
