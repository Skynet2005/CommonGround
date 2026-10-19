# CommonGround Community Operations — encrypted local workbench

Release: v0.5.0. Scope: usable local workflows, NOT verified shared governance. This is an implementation of eight administrative modules inside a local-only encrypted workspace, separate from the browser-local unencrypted sample case workspace.

## Usable interactions

1. **People & roles:** Record self-reported residents, tenants, managers, proposed board members and neutrals. Roles are not verified and confer no software authority.
2. **Meetings:** Create agenda and meeting records, track status through held/minutes drafted/closed. No statutory notice or quorum is certified.
3. **Maintenance:** Capture requests and their descriptions, move from open through triage, scheduled, complete or canceled.
4. **Vendor review:** Record bidder, scope, cost and conflict disclosure, then label bid status. Selecting a quote is NOT contract execution.
5. **Budget & ledger:** Create allocations, mark them as internally approved and record illustrative paired debit/credit entries. Reversal adds a compensating entry rather than mutating historical amounts. No actual transaction, bank account, payroll or assessment collection is connected.
6. **Notices:** Draft and review proposed letters with separate source references and tentative dates. Nothing is emailed, printed, delivered or legally served. No deadline calculations.
7. **Documents:** Index records and link encrypted local file attachments. Attachment filenames and bytes are encrypted by the existing IndexedDB evidence vault. Evidence vault backups must be exported separately from operations backups.
8. **Community feedback:** Create informal choices, record local unverified responses, close polls. No verified voting eligibility, duplicate prevention or secret ballot safeguards. NOT a statutory HOA election/recall.

## Storage and privacy

- Browser-local operations records are encrypted with AES-256-GCM and a passphrase-derived key via the existing 600,000-iteration PBKDF2/SHA-256 implementation.
- No password or decrypted workspace content is saved to localStorage or transmitted to CommonGround.
- Each data mutation saves the sealed workspace to IndexedDB, with an external revision check within a single IndexedDB transaction to reject simultaneous stale tab edits.
- Local activity entries have hash links that detect some corruption or manual alteration. They are **not** independent custody, identity attestation or legal evidence.
- The backup button downloads an encrypted metadata archive. Evidence attachments have their own encrypted backup in Evidence Vault. Restore the two archives separately.
- Do not enter private legal documents in the **unencrypted case workspace**, even though the separate Operations workspace is encrypted.
- Browser compromise, extensions, malware, lost passphrases, accidental clearing of browser storage, large data volumes, and unbacked-up attachments still present risks. Do not use CommonGround as the sole legal or financial record.

## Deployment and testing

Runs as part of the React + Vite app at the repository root. The Vercel hosted sign-in/API still remains **disabled** until a properly provisioned non-owner PostgreSQL credential, verified email delivery, domain verification and secure rollout are complete.

Run \`npm test\` and \`npm run build\`. The module's pure data engine is tested for record validations, correct monetary parsing, ledger balance and reversals, polls, and audit tampering.

## Future external production gates

See \`docs/release-gates.md\` and \`docs/deployment-runbook.md\`. Actual HOA features require authenticated and verified community roles, independent fact/reviewer checks, private object storage, source-versioned law/document records, delivery proofs, properly controlled accounting, and separately audited legal election systems. Legal workflow review by qualified Florida counsel is still required before real use.