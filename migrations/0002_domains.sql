
-- 0002: Vertically integrated but deliberately restricted domain model.
-- Tables without explicitly tested RLS policies default-deny runtime access.
-- Modules are designed and migrated, not declared production-enabled by this.
BEGIN;
CREATE TABLE app.document_collections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 name text NOT NULL,scope text NOT NULL CHECK(scope IN ('official','member_only','private_case','privileged','mediation')),
 retention_policy text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),collection_id uuid REFERENCES app.document_collections(id),
 community_id uuid REFERENCES app.communities(id),case_id uuid REFERENCES app.cases(id),
 title text NOT NULL,document_kind text NOT NULL CHECK(document_kind IN
 ('declaration','amendment','bylaws','guideline','survey','plat','easement','notice','meeting_minutes','contract','financial_report','case_material','other')),
 source_claim text NOT NULL DEFAULT 'uploaded_unverified',
 visibility text NOT NULL CHECK(visibility IN ('public','members','restricted','case_participants','privileged','mediation')),
 created_by uuid NOT NULL REFERENCES app.accounts(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.document_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES app.documents(id),
 version integer NOT NULL CHECK(version>0),blob_key text NOT NULL UNIQUE,
 bytes bigint NOT NULL CHECK(bytes>0),sha256 text NOT NULL CHECK(length(sha256)=64),
 mime_type text NOT NULL,claimed_effective_at date,authenticity text NOT NULL DEFAULT 'unverified'
 CHECK(authenticity IN ('unverified','official_source','attested','disputed','superseded')),
 attested_by uuid REFERENCES app.accounts(id),attested_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(document_id,version)
);
CREATE TABLE app.legal_sources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),jurisdiction text NOT NULL,
 citation text NOT NULL,source_uri text NOT NULL,domain text NOT NULL,
 authoritative boolean NOT NULL DEFAULT false,UNIQUE(jurisdiction,citation,source_uri)
);
CREATE TABLE app.legal_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES app.legal_sources(id),
 effective_from date,effective_to date,retrieved_at timestamptz NOT NULL DEFAULT now(),
 source_sha256 text NOT NULL CHECK(length(source_sha256)=64),
 exact_text text,reviewed_by uuid REFERENCES app.accounts(id),reviewed_at timestamptz,
 confidence text NOT NULL DEFAULT 'unreviewed' CHECK(confidence IN ('unreviewed','verified_source','reviewed_by_counsel')),
 UNIQUE(source_id,source_sha256)
);
CREATE TABLE app.community_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 document_version_id uuid NOT NULL REFERENCES app.document_versions(id),citation text NOT NULL,
 normalized_text text,category text,effective_from date,effective_to date,
 authority_verified_by uuid REFERENCES app.accounts(id),authority_verified_at timestamptz,
 supersedes uuid REFERENCES app.community_rules(id)
);
CREATE TABLE app.rule_crosswalk(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_rule_id uuid NOT NULL REFERENCES app.community_rules(id),
 legal_version_id uuid NOT NULL REFERENCES app.legal_versions(id),relation text NOT NULL
 CHECK(relation IN ('supports','limits','conflicts','requires_review')),
 rationale text,reviewed_by uuid REFERENCES app.accounts(id),reviewed_at timestamptz,
 UNIQUE(community_rule_id,legal_version_id,relation)
);
CREATE TABLE app.case_issues(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 issue_kind text NOT NULL,claim text NOT NULL,asserted_by uuid NOT NULL REFERENCES app.accounts(id),
 issue_state text NOT NULL DEFAULT 'alleged' CHECK(issue_state IN ('alleged','contested','admitted','verified','withdrawn','resolved')),
 resolution_note text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.issue_support(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid NOT NULL REFERENCES app.case_issues(id),
 evidence_id uuid REFERENCES app.evidence_objects(id),rule_id uuid REFERENCES app.community_rules(id),
 legal_version_id uuid REFERENCES app.legal_versions(id),nature text NOT NULL
 CHECK(nature IN ('supports','contradicts','context')),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (num_nonnulls(evidence_id,rule_id,legal_version_id)=1)
);
CREATE TABLE app.notices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 sender_id uuid NOT NULL REFERENCES app.accounts(id),notice_type text NOT NULL,
 legal_basis_version_id uuid REFERENCES app.legal_versions(id),
 content_document_version_id uuid REFERENCES app.document_versions(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','issued','withdrawn')),
 prepared_at timestamptz NOT NULL DEFAULT now(),approved_by uuid REFERENCES app.accounts(id),
 issued_at timestamptz,
 CHECK(status<>'issued' OR (issued_at IS NOT NULL AND approved_by IS NOT NULL))
);
CREATE TABLE app.notice_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notice_id uuid NOT NULL REFERENCES app.notices(id),
 recipient_id uuid REFERENCES app.accounts(id),channel text NOT NULL CHECK(channel IN ('postal','email','personal','other')),
 external_delivery_reference text,delivered_at timestamptz,
 proof_evidence_id uuid REFERENCES app.evidence_objects(id),
 delivery_state text NOT NULL DEFAULT 'unverified' CHECK(delivery_state IN
 ('unverified','submitted','delivered','failed','disputed')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.deadlines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 notice_id uuid REFERENCES app.notices(id),kind text NOT NULL,
 date_basis text NOT NULL,trigger_at timestamptz,deadline_at timestamptz,
 legal_version_id uuid REFERENCES app.legal_versions(id),
 calculated_by text NOT NULL CHECK(calculated_by IN ('manual','statutory_reviewed','provisional')),
 validated_by uuid REFERENCES app.accounts(id),validated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.settlement_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 proposed_by uuid NOT NULL REFERENCES app.accounts(id),
 terms_document_version_id uuid REFERENCES app.document_versions(id),
 summary text NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN
 ('draft','offered','countered','accepted_by_all','rejected','withdrawn','expired')),
 valid_until timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.proposal_signoffs(
 proposal_id uuid NOT NULL REFERENCES app.settlement_proposals(id),
 account_id uuid NOT NULL REFERENCES app.accounts(id),decision text NOT NULL
 CHECK(decision IN ('accept','reject','request_revision')),
 identity_verification text NOT NULL DEFAULT 'unverified',signed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(proposal_id,account_id)
);
CREATE TABLE app.reviewer_disclosures(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reviewer_id uuid NOT NULL REFERENCES app.accounts(id),
 case_id uuid NOT NULL REFERENCES app.cases(id),conflict_type text NOT NULL,
 explanation text,disposition text NOT NULL DEFAULT 'pending' CHECK(disposition IN
 ('pending','cleared','recused','disqualified')),assessed_by uuid REFERENCES app.accounts(id),
 reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.neutral_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 reviewer_id uuid NOT NULL REFERENCES app.accounts(id),scope text NOT NULL,
 finding_document_version_id uuid REFERENCES app.document_versions(id),
 finding_type text CHECK(finding_type IN ('procedural','factual','nonbinding_recommendation')),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','conflict_screening','accepted','in_review','complete','withdrawn')),
 accepted_by_parties boolean NOT NULL DEFAULT false,
 completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.appeals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 challenged_review_id uuid REFERENCES app.neutral_reviews(id),
 appellant_id uuid NOT NULL REFERENCES app.accounts(id),grounds text NOT NULL,
 status text NOT NULL DEFAULT 'filed' CHECK(status IN ('filed','screening','accepted','dismissed','resolved')),
 reviewer_id uuid REFERENCES app.accounts(id),determination_document_version_id uuid REFERENCES app.document_versions(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Mediation data has extra isolation. Never merge sealed negotiations with
-- ordinary case events, general case exports, audit metadata or AI prompts.
CREATE TABLE app.mediation_sessions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES app.cases(id),
 mediator_id uuid REFERENCES app.accounts(id),consent_record_id uuid,
 state text NOT NULL DEFAULT 'offered' CHECK(state IN ('offered','consented','scheduled','held','completed','canceled')),
 confidential boolean NOT NULL DEFAULT true,scheduled_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.mediation_private_materials(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES app.mediation_sessions(id),
 submitted_by uuid NOT NULL REFERENCES app.accounts(id),restricted_to uuid REFERENCES app.accounts(id),
 encrypted_blob_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.governance_seats(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 occupant_id uuid REFERENCES app.accounts(id),position text NOT NULL,start_at date,end_at date,
 verification text NOT NULL DEFAULT 'unverified',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.meetings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 meeting_type text NOT NULL,scheduled_at timestamptz,
 notice_document_version_id uuid REFERENCES app.document_versions(id),
 notice_at timestamptz,agenda_document_version_id uuid REFERENCES app.document_versions(id),
 minutes_document_version_id uuid REFERENCES app.document_versions(id),quorum_confirmed boolean,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.meeting_attendance(
 meeting_id uuid NOT NULL REFERENCES app.meetings(id),account_id uuid NOT NULL REFERENCES app.accounts(id),
 attendance_mode text NOT NULL,attended_at timestamptz,PRIMARY KEY(meeting_id,account_id)
);
CREATE TABLE app.ballot_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 meeting_id uuid REFERENCES app.meetings(id),title text NOT NULL,
 ballot_type text NOT NULL CHECK(ballot_type IN ('election','recall','amendment','other_vote')),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','reviewed','open','closed','certified')),
 opens_at timestamptz,closes_at timestamptz,independent_verifier_id uuid REFERENCES app.accounts(id),
 certified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.ballot_credentials(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ballot_event_id uuid NOT NULL REFERENCES app.ballot_events(id),
 voter_id uuid NOT NULL REFERENCES app.accounts(id),eligibility_basis text NOT NULL,
 credential_digest text NOT NULL UNIQUE,issued_at timestamptz NOT NULL DEFAULT now(),
 used_at timestamptz,UNIQUE(ballot_event_id,voter_id)
);
CREATE TABLE app.sealed_ballots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ballot_event_id uuid NOT NULL REFERENCES app.ballot_events(id),
 encrypted_selection bytea NOT NULL,opaque_ballot_digest text NOT NULL UNIQUE,
 cast_at timestamptz NOT NULL DEFAULT now()
 -- Intentional: NO voter_id column to preserve ballot unlinkability.
);
CREATE TABLE app.financial_periods(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 begins_on date NOT NULL,ends_on date NOT NULL,period_kind text NOT NULL,
 UNIQUE(community_id,begins_on,ends_on),CHECK(ends_on>=begins_on)
);
CREATE TABLE app.budgets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),period_id uuid NOT NULL REFERENCES app.financial_periods(id),
 prepared_by uuid NOT NULL REFERENCES app.accounts(id),approved_by uuid REFERENCES app.accounts(id),
 approved_at timestamptz,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','proposed','approved','superseded')),
 UNIQUE(period_id,state)
);
CREATE TABLE app.budget_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),budget_id uuid NOT NULL REFERENCES app.budgets(id),
 account_category text NOT NULL,amount_minor bigint NOT NULL,currency char(3) NOT NULL DEFAULT 'USD',
 explanation text
);
CREATE TABLE app.vendors(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 trade_name text NOT NULL,verification text NOT NULL DEFAULT 'unverified',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.vendor_conflicts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES app.vendors(id),
 member_id uuid NOT NULL REFERENCES app.accounts(id),relationship text NOT NULL,
 disclosed_at timestamptz NOT NULL DEFAULT now(),reviewed_by uuid REFERENCES app.accounts(id)
);
CREATE TABLE app.vendor_bids(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 vendor_id uuid NOT NULL REFERENCES app.vendors(id),purpose text NOT NULL,
 proposed_amount_minor bigint CHECK(proposed_amount_minor>=0),currency char(3) NOT NULL DEFAULT 'USD',
 submitted_at timestamptz,document_version_id uuid REFERENCES app.document_versions(id)
);
CREATE TABLE app.contracts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 vendor_id uuid NOT NULL REFERENCES app.vendors(id),selected_bid_id uuid REFERENCES app.vendor_bids(id),
 document_version_id uuid REFERENCES app.document_versions(id),
 award_reason text,approved_by uuid REFERENCES app.accounts(id),approved_at timestamptz,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','active','expired','terminated'))
);
CREATE TABLE app.ledger_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 code text NOT NULL,name text NOT NULL,kind text NOT NULL
 CHECK(kind IN ('asset','liability','equity','revenue','expense')),
 UNIQUE(community_id,code)
);
CREATE TABLE app.journal_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 reference text,entry_date date NOT NULL,description text,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','posted','reversed')),
 posted_by uuid REFERENCES app.accounts(id),posted_at timestamptz,
 reversal_of uuid REFERENCES app.journal_entries(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.journal_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entry_id uuid NOT NULL REFERENCES app.journal_entries(id),
 account_id uuid NOT NULL REFERENCES app.ledger_accounts(id),debit_minor bigint NOT NULL DEFAULT 0,
 credit_minor bigint NOT NULL DEFAULT 0, CHECK(debit_minor>=0 AND credit_minor>=0),
 CHECK((debit_minor>0 AND credit_minor=0) OR (credit_minor>0 AND debit_minor=0))
);
-- Posting guard must be implemented before any ledger features go live:
-- transactional balanced debits/credits, amount immutability, same-community checks,
-- two-person approvals, idempotency, period close and reversal-only adjustments.
CREATE TABLE app.assessment_schedules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 label text NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>=0),
 starts_on date NOT NULL,ends_on date,approved_by uuid REFERENCES app.accounts(id),
 governing_rule_id uuid REFERENCES app.community_rules(id)
);
CREATE TABLE app.assessment_charges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),schedule_id uuid NOT NULL REFERENCES app.assessment_schedules(id),
 parcel_id uuid NOT NULL REFERENCES app.parcels(id),due_on date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>=0),status text NOT NULL DEFAULT 'due'
 CHECK(status IN ('due','part_paid','paid','disputed','reversed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.payment_references(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),charge_id uuid NOT NULL REFERENCES app.assessment_charges(id),
 external_processor text NOT NULL,external_payment_id text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),state text NOT NULL
 CHECK(state IN ('pending','cleared','refunded','failed','reversed')),
 UNIQUE(external_processor,external_payment_id)
);
CREATE TABLE app.maintenance_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid NOT NULL REFERENCES app.communities(id),
 parcel_id uuid REFERENCES app.parcels(id),opened_by uuid NOT NULL REFERENCES app.accounts(id),
 title text NOT NULL,description text,status text NOT NULL DEFAULT 'open'
 CHECK(status IN ('open','triaged','scheduled','complete','canceled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.work_orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES app.maintenance_requests(id),
 vendor_id uuid REFERENCES app.vendors(id),contract_id uuid REFERENCES app.contracts(id),
 expected_amount_minor bigint,approved_by uuid REFERENCES app.accounts(id),
 actual_completed_at timestamptz,inspection_evidence_id uuid REFERENCES app.evidence_objects(id)
);
CREATE TABLE app.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES app.accounts(id),
 category text NOT NULL,title text NOT NULL,body text,created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,read_at timestamptz
);
CREATE TABLE app.consent_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES app.accounts(id),
 purpose text NOT NULL,version text NOT NULL,granted_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,source text NOT NULL
);
CREATE TABLE app.data_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES app.accounts(id),
 request_type text NOT NULL CHECK(request_type IN ('export','delete','rectify','restrict')),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','verifying','in_progress','complete','denied')),
 case_id uuid REFERENCES app.cases(id),completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.security_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES app.accounts(id),
 community_id uuid REFERENCES app.communities(id),case_id uuid REFERENCES app.cases(id),
 event_type text NOT NULL,resource_type text,resource_id uuid,
 event_digest text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.compliance_observations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid REFERENCES app.communities(id),
 case_id uuid REFERENCES app.cases(id),signal_type text NOT NULL,
 severity text NOT NULL CHECK(severity IN ('informational','review','urgent')),
 evidence_basis text NOT NULL,signal_state text NOT NULL DEFAULT 'open'
 CHECK(signal_state IN ('open','under_review','dismissed','substantiated')),
 reviewer_id uuid REFERENCES app.accounts(id),reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.ai_recommendations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid REFERENCES app.cases(id),
 requested_by uuid NOT NULL REFERENCES app.accounts(id),model text NOT NULL,prompt_version text NOT NULL,
 source_versions jsonb NOT NULL DEFAULT '[]'::jsonb,
 prompt_digest text NOT NULL,output_digest text NOT NULL,
 finding_type text NOT NULL DEFAULT 'advisory',
 reviewer_id uuid REFERENCES app.accounts(id),reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(finding_type='advisory')
);
CREATE TABLE app.metric_snapshots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid REFERENCES app.communities(id),
 period_start timestamptz NOT NULL,period_end timestamptz NOT NULL,
 definition_version text NOT NULL,metric_key text NOT NULL,value_numeric numeric,
 privacy_suppressed boolean NOT NULL DEFAULT true,
 CHECK(period_end>period_start),UNIQUE(community_id,period_start,period_end,metric_key,definition_version)
);
-- No permissive policies are installed for non-pilot modules.
-- The user-serving database account therefore cannot read these tables until
-- each module receives reviewed RLS policies, route-level authorization and tests.
DO $$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY[
 'document_collections','documents','document_versions','legal_sources','legal_versions','community_rules','rule_crosswalk',
 'case_issues','issue_support','notices','notice_deliveries','deadlines','settlement_proposals','proposal_signoffs',
 'reviewer_disclosures','neutral_reviews','appeals','mediation_sessions','mediation_private_materials',
 'governance_seats','meetings','meeting_attendance','ballot_events','ballot_credentials','sealed_ballots',
 'financial_periods','budgets','budget_lines','vendors','vendor_conflicts','vendor_bids','contracts',
 'ledger_accounts','journal_entries','journal_lines','assessment_schedules','assessment_charges',
 'payment_references','maintenance_requests','work_orders','notifications','consent_records',
 'data_requests','security_audit','compliance_observations','ai_recommendations','metric_snapshots'
 ] LOOP
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',item);
 END LOOP;
END $$;
COMMIT;
