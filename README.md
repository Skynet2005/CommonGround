# CommonGround

This is the dedicated standalone source repository for the CommonGround HOA procedural-fairness platform.

Originally developed in [Skynet2005/SkyneticApps](https://github.com/Skynet2005/SkyneticApps/tree/main/apps/commonground). This migration moves the application to the repository root. The original copy is retained as a fallback until Vercel cutover is verified.

---

# CommonGround v0.4 — Process assurance and backend hardening

Live application: https://commonground-nu.vercel.app

This release repairs sign-in authorization under deny-by-default RLS, makes migration journaling transactional, enforces version checks before authenticated case edits, routes email links directly to the correct view, and adds deterministic resident-facing process review under Oversight.

**Important:** The actual hosted PostgreSQL database and mail provider are still not connected. Shared accounts and hosted cases remain disabled; the active case and encrypted-evidence workflows are browser-local. Do not enter real resident information in unencrypted browser case fields. The encrypted vault does not establish independent evidentiary custody.

Validation: 24 passing tests in the Node 24 Vercel sandbox, a successful Vite production build, and PostgreSQL-compatible migration/authorization tests. Independent security review and legal review are still required before real community use.

Release methodology and residual risks: docs/security-review-v04.md

---

# CommonGround v0.3 — Integrated Data Architecture

CommonGround is a Florida-first HOA fairness, evidence and independent governance project. The UI is deployed at https://commonground-nu.vercel.app and GitHub contains a **vertically integrated PostgreSQL data architecture**, a feature atlas and a gated authenticated backend.

## Live and tested today
- Browser-local case-management prototype, legal procedure navigator, charter, audit checks and encrypted evidence vault
- Encrypted offline vault backup / restore
- Interactive product architecture / feature atlas and shared-workspace readiness view
- Tests for database migration, case isolation under a distinct runtime role, append-only audit records, and default-deny mediation/accounting data

## NOT yet enabled as a hosted service
- No live PostgreSQL instance or authenticated email service has been attached to the Vercel project
- Hosted user login and private case APIs are implemented but **disabled by default** pending database and email configuration
- No actual shared HOA invite, ownership verification, private remote evidence store, election, payments, mediator access or AI judgments

## Run from repository root

    npm install
    npm test
    npm run build
    npm run dev

Database migrations require a separately authorized migration-owner connection and formal operator approval. Read docs/deployment-runbook.md, docs/platform-architecture.md, docs/feature-review.md, and docs/release-gates.md before activating any shared hosted data.

**Keep real resident evidence out of the local case text fields.** localStorage is plaintext. Only local vault file bytes and filenames are encrypted; they are not sent to Vercel. No data should be mistaken for a legally authenticated record merely because it has a hash.

Primary source for legal research: https://www.flsenate.gov/Laws/Statutes/2026/Chapter720

---

# CommonGround (v0.2)
Independent Florida-first HOA procedural fairness and dispute-workspace prototype.

**Site:** https://commonground-nu.vercel.app

## Working functions
- Local case management, procedural completeness checks, status and history
- Source-linked Florida law navigator (architecture/fences, fines, records, elections, financial collections)
- Field-level before/after audit events with SHA-256 local hash links and last recorded state verification
- Local encrypted evidence vault with portable encrypted backup and restore: AES-256-GCM, PBKDF2/SHA-256 600,000 iterations, random per-item salts and nonces, encrypted filenames, ciphertext in IndexedDB, SHA-256 verified decrypt-and-download
- Browser-local import/export, Markdown case briefs, governance charter, responsive oversight interface

## Run and test
    npm install
    npm test
    npm run build
    npm run dev

Built with Vite + React. The Vercel project uses Root Directory repository root, with git deployment from main.

## Security limitations

**Prototype only.** Cases and non-vault notes are plain localStorage, editable by anyone with access to this browser profile. Do not put names, addresses, passwords, account numbers, privileged documents, or real private dispute evidence into case forms.

Vault files are locally encrypted in IndexedDB and are never transmitted to our backend. Lost passphrases or deleted browser data are unrecoverable. Browser compromise or malicious extensions may access content or passphrases while in use. This is not independent legal evidence custody or a backed-up repository.

The platform has no multi-user identity verification, server database, invitations, shared cases, real HOA membership validation, remotely enforced role permissions, outside fact verification, or AI legal conclusions. Nothing is filed, served, or legally binding. Documentation coverage is not legal compliance, fairness, or likelihood of prevailing.

See docs/production-schema.sql for proposed **undeployed** database tables and docs/release-gates.md for required production safeguards. Never connect sensitive records before those gates pass.

## Primary sources
- https://www.flsenate.gov/Laws/Statutes/2026/Chapter720
- https://www.flsenate.gov/Laws/Statutes/2026/720.303
- https://www.flsenate.gov/Laws/Statutes/2026/720.3035
- https://www.flsenate.gov/Laws/Statutes/2026/720.305
- https://www.flsenate.gov/Laws/Statutes/2026/720.311

Refer to the effective version, governing documents, and qualified Florida counsel for legal matters. MIT licensed under parent repository.
