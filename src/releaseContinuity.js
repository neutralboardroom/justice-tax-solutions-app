const APP_VERSION = '0.1.67';

const HOMEPAGE_STABILITY_RULE = {
  version: APP_VERSION,
  headline: 'Keep the current homepage structure stable while polishing the rest of the platform.',
  rule: 'Do not redesign the homepage layout unless Roger explicitly asks. Make small copy/navigation refinements only when they reduce confusion or reinforce save/resume, data preservation, and tax-only safety.',
  homepage_should_preserve: [
    'hero positioning around file, fix, review, amend, and understand your taxes',
    'six public start paths: personal return, business return, past-return review, Free Truth Check, fix a tax problem, and not sure',
    'prominent prior-return review / amendment opportunity section',
    'free starting summary flow',
    'document-safety warnings and no-guarantee language',
    'Spanish entry point without turning the homepage into an internal dashboard'
  ],
  allowed_small_refinements: [
    'remove duplicate navigation links',
    'tighten wording where it is confusing or overly internal',
    'add small save/resume or data-continuity notes without changing the layout',
    'keep staff/owner readiness links available but not dominant for customers'
  ]
};

const RELEASE_DATA_PRESERVATION_GATES = [
  {
    key: 'source_only_deploy',
    label: 'Deploy source code only',
    must_pass: true,
    detail: 'A new ZIP, git push, or Render deploy may replace code, but must not delete or overwrite live DATA_DIR, UPLOAD_DIR, managed database tables, private object storage, or payment/provider records.'
  },
  {
    key: 'accounts_login_preserved',
    label: 'Accounts and login records preserved',
    must_pass: true,
    detail: 'Users, staff, accountants, CPAs, EAs, professionals, password-reset state, invite records, and role permissions must remain after deploy. Rotating JWT/session secrets may sign users out, but cannot erase accounts.'
  },
  {
    key: 'work_progress_preserved',
    label: 'Public and professional work progress preserved',
    must_pass: true,
    detail: 'Partially completed intakes, organizers, saved drafts, case progress saves, staff notes, professional workpapers, review checklists, release gates, and follow-up dates must remain available after deploy.'
  },
  {
    key: 'documents_preserved',
    label: 'Uploaded document records preserved',
    must_pass: true,
    detail: 'Document metadata, encrypted file/object-storage references, retention status, access logs, scan/quarantine status, and deletion requests must remain linked to the correct case and user.'
  },
  {
    key: 'quotes_payments_preserved',
    label: 'Quotes and payment records preserved',
    must_pass: true,
    detail: 'Quotes, Stripe session IDs, payment status, receipts, refunds/chargebacks, referral reward links, bank-product readiness records, and payment webhook audit events must not be reset by deploys.'
  },
  {
    key: 'no_destructive_migration',
    label: 'No destructive migration without approval',
    must_pass: true,
    detail: 'Schema changes should be additive. Any destructive migration requires backup, restore test, written owner approval, rollback steps, and a post-deploy reconciliation report.'
  },
  {
    key: 'post_deploy_resume_test',
    label: 'Post-deploy save/resume test completed',
    must_pass: true,
    detail: 'After deploy, test a customer dashboard, a saved draft, a staff queue item, a professional work item, a quote/payment record, and a document reference before announcing release success.'
  }
];

const SAVE_RESUME_CONTINUITY_MAP = {
  version: APP_VERSION,
  headline: 'Every long workflow should be saveable, resumable, and recoverable.',
  customer_workflows: [
    { key: 'personal_return', label: 'Personal return intake', save_points: ['contact info', 'tax year', 'income types', 'dependents/credits', 'state/city needs', 'document checklist', 'review request'] },
    { key: 'business_return', label: 'Business return intake', save_points: ['entity type', 'tax year/period', 'bookkeeping status', 'income/expense categories', 'payroll/sales-tax flags', 'professional routing'] },
    { key: 'prior_return_review', label: 'Prior-return review / amendment screening', save_points: ['years to review', 'personal/business returns', 'possible issue categories', 'notice connection', 'state/city amendment flags', 'paid option choice'] },
    { key: 'truth_check', label: 'Free Tax Problem Truth Check', save_points: ['agency', 'notice type', 'tax year/period', 'deadline', 'amount at issue', 'urgency flags', 'documents to gather'] },
    { key: 'official_pdf_workspace', label: 'Official-PDF/form organizer workspaces', save_points: ['section answers', 'field verification', 'staff QA note', 'client verification state', 'release gate state'] }
  ],
  staff_professional_workflows: [
    'staff triage lane, issue category, urgency level, and follow-up date',
    'quote scope, quote status, payment status, and user approval state',
    'accountant/CPA/EA/professional assignment, checklist, workpaper status, and signoff state',
    'official PDF source, checksum, mapping, sample-output QA, visual QA, and release gate records',
    'document review notes, safety flags, deletion/retention state, and access log events'
  ],
  user_promises: [
    'Users should be told when work is saved and where to resume.',
    'Users should see last-saved status on dashboard/workspace pages.',
    'Staff should see incomplete drafts and know what section the user stopped on.',
    'Professional reviewers should be able to pause work without losing notes or signoff state.'
  ]
};

const QUOTE_PAYMENT_PRESERVATION = {
  version: APP_VERSION,
  headline: 'Quotes, payments, refunds, referrals, and paid-work status must survive deployments.',
  preserved_items: [
    'quote request and quote approval records',
    'selected pricing tier and custom quote scope',
    'payment intent/session IDs and webhook events',
    'paid, pending, failed, refunded, disputed, or chargeback status',
    'receipts and customer payment confirmation metadata',
    'referral attribution and reward ledger records',
    'staff notes explaining why a paid option was offered',
    'professional review fee/scope records when applicable'
  ],
  release_checks: [
    'Before deploy: export or back up payments, quotes, referral rewards, and payment webhook events.',
    'After deploy: confirm staff payment board still shows old records and no duplicate paid records were created.',
    'After deploy: submit a test/development quote or payment-state event only in non-production mode or with clearly marked test data.',
    'Never reset paid-work status by replacing source files or local JSON data during deployment.'
  ],
  user_facing_copy: 'If you already started, saved work, approved a quote, made a payment, or uploaded allowed documents, a platform update should not make you start over. Sign in to resume from your dashboard.'
};

const DEPLOYMENT_RELEASE_CHECK_SEQUENCE = [
  { step: 1, label: 'Pre-deploy backup', owner: 'owner/staff', pass_condition: 'Database and upload/object-storage backups completed or verified.' },
  { step: 2, label: 'Environment continuity', owner: 'owner/staff', pass_condition: 'DATA_DIR, UPLOAD_DIR, DATABASE_URL, object storage, Stripe, JWT/session, and admin/staff secrets are not overwritten by the ZIP.' },
  { step: 3, label: 'Additive migration review', owner: 'developer/staff', pass_condition: 'Schema changes are additive or migration-backed; no destructive changes run automatically.' },
  { step: 4, label: 'Deploy source release', owner: 'owner/deployment', pass_condition: 'Only code/static assets are updated; runtime data is untouched.' },
  { step: 5, label: 'Version smoke test', owner: 'owner/staff', pass_condition: '/health returns the expected version.' },
  { step: 6, label: 'Customer continuity smoke test', owner: 'staff', pass_condition: 'Customer can sign in, see cases, open a saved draft, and resume progress.' },
  { step: 7, label: 'Staff/professional continuity smoke test', owner: 'staff/pro reviewer', pass_condition: 'Staff queue, notes, professional assignments, workpapers/checklists, and release gates remain visible.' },
  { step: 8, label: 'Document/payment smoke test', owner: 'staff/owner', pass_condition: 'Document references, quotes, payment status, referral rewards, and audit logs remain present.' },
  { step: 9, label: 'Record release check', owner: 'staff/owner', pass_condition: 'Release continuity check event recorded before inviting users back.' }
];

function safeCount(store, collection) {
  try { return store && store.list ? store.list(collection).filter((x) => !x.deleted_at).length : 0; }
  catch { return 0; }
}

function buildReleaseContinuityAudit({ store, env = process.env } = {}) {
  const summary = store && store.storageSummary ? store.storageSummary() : { counts: {} };
  const counts = summary.counts || {};
  const hasManagedDb = Boolean(env.DATABASE_URL);
  const hasExternalStorage = env.SECURE_OBJECT_STORAGE_CONFIGURED === 'true';
  const dataPathRisk = Boolean(summary.data_inside_app_directory || summary.uploads_inside_app_directory);
  return {
    version: APP_VERSION,
    headline: 'Release continuity audit: improve the platform without risking user data.',
    homepage_stability_rule: HOMEPAGE_STABILITY_RULE,
    release_data_preservation_gates: RELEASE_DATA_PRESERVATION_GATES,
    save_resume_continuity_map: SAVE_RESUME_CONTINUITY_MAP,
    quote_payment_preservation: QUOTE_PAYMENT_PRESERVATION,
    deployment_sequence: DEPLOYMENT_RELEASE_CHECK_SEQUENCE,
    current_storage_snapshot: {
      persistence_mode: summary.mode || (hasManagedDb ? 'managed-database-present' : 'local-json-starter'),
      managed_database_configured: hasManagedDb,
      secure_object_storage_configured: hasExternalStorage,
      data_path_inside_release_folder: Boolean(summary.data_inside_app_directory),
      upload_path_inside_release_folder: Boolean(summary.uploads_inside_app_directory),
      data_path_risk: dataPathRisk,
      counts: {
        users: counts.users || 0,
        cases: counts.cases || 0,
        documents: counts.documents || 0,
        quotes: counts.quotes || 0,
        payments: counts.payments || 0,
        work_progress_drafts: counts.work_progress_drafts || 0,
        case_progress_saves: counts.case_progress_saves || 0,
        professional_work_drafts: counts.professional_work_drafts || 0,
        deployment_continuity_snapshots: counts.deployment_continuity_snapshots || 0,
        release_integrity_checks: counts.release_integrity_checks || 0,
        quote_payment_preservation_checks: counts.quote_payment_preservation_checks || 0
      }
    },
    go_no_go: {
      source_code_release_for_review: 'go_after_local_tests',
      production_deploy_with_existing_users: dataPathRisk && !hasManagedDb ? 'caution_requires_external_persistent_data_paths_or_backup_restore_plan' : 'go_only_after_backup_and_post_deploy_continuity_checks',
      live_sensitive_uploads: 'blocked_until_security_and_storage_gates_pass',
      final_official_form_output: 'blocked_until_official_pdf_visual_qa_and_release_gates_pass',
      efile_bank_products: 'future_only_until_efin_vendor_disclosures_and_payment_controls_are_live'
    }
  };
}

function buildProfessionalWorkDraftPayload({ staff = {}, body = {} }) {
  const now = new Date().toISOString();
  return {
    staff_id: staff.id || '',
    staff_email: staff.email || '',
    professional_role: String(body.professional_role || body.role || staff.role || 'staff').slice(0, 80),
    case_id: String(body.case_id || body.caseId || '').slice(0, 120),
    title: String(body.title || 'Professional work draft').slice(0, 160),
    workflow: String(body.workflow || 'professional-review-work').slice(0, 120),
    status: String(body.status || 'draft_saved').slice(0, 80),
    last_completed_section: String(body.last_completed_section || body.section || '').slice(0, 180),
    progress_percent: Math.max(0, Math.min(100, Number(body.progress_percent || 0))),
    note_summary: String(body.note_summary || body.notes || '').slice(0, 2500),
    private_sensitive_data_warning: 'Do not save full SSNs, EINs, bank/account numbers, full notices, transcripts, or uploaded document contents in workpaper summaries.',
    checklist_state: body.checklist_state && typeof body.checklist_state === 'object' ? body.checklist_state : {},
    last_saved_at: now,
    updated_at: now
  };
}

function recordReleaseContinuityCheck({ store, staff = {}, body = {}, req = null } = {}) {
  const audit = buildReleaseContinuityAudit({ store, env: process.env });
  const now = new Date().toISOString();
  const status = String(body.status || 'recorded').slice(0, 80);
  const record = store.insert('release_integrity_checks', {
    release_version: APP_VERSION,
    status,
    actor_id: staff.id || '',
    actor_role: staff.role || '',
    actor_email: staff.email || '',
    checklist: {
      accounts_checked: Boolean(body.accounts_checked),
      drafts_checked: Boolean(body.drafts_checked),
      documents_checked: Boolean(body.documents_checked),
      quotes_payments_checked: Boolean(body.quotes_payments_checked),
      staff_queue_checked: Boolean(body.staff_queue_checked),
      professional_work_checked: Boolean(body.professional_work_checked),
      backup_confirmed: Boolean(body.backup_confirmed),
      rollback_plan_confirmed: Boolean(body.rollback_plan_confirmed)
    },
    note: String(body.note || '').slice(0, 2000),
    storage_snapshot: audit.current_storage_snapshot,
    created_at: now,
    updated_at: now
  });
  if (store.addEvent) store.addEvent('release_continuity_check_recorded', { release_version: APP_VERSION, status, check_id: record.id }, req);
  return { record, audit };
}

function recordQuotePaymentPreservationCheck({ store, staff = {}, body = {}, req = null } = {}) {
  const now = new Date().toISOString();
  const record = store.insert('quote_payment_preservation_checks', {
    release_version: APP_VERSION,
    actor_id: staff.id || '',
    actor_role: staff.role || '',
    actor_email: staff.email || '',
    status: String(body.status || 'recorded').slice(0, 80),
    quotes_visible: Boolean(body.quotes_visible),
    payments_visible: Boolean(body.payments_visible),
    stripe_webhook_checked: Boolean(body.stripe_webhook_checked),
    referral_rewards_checked: Boolean(body.referral_rewards_checked),
    no_duplicate_payments_seen: Boolean(body.no_duplicate_payments_seen),
    note: String(body.note || '').slice(0, 2000),
    snapshot_counts: {
      quotes: safeCount(store, 'quotes'),
      payments: safeCount(store, 'payments'),
      referral_rewards: safeCount(store, 'referral_rewards'),
      payment_quote_events: safeCount(store, 'payment_quote_events')
    },
    created_at: now,
    updated_at: now
  });
  if (store.addEvent) store.addEvent('quote_payment_preservation_check_recorded', { release_version: APP_VERSION, status: record.status, check_id: record.id }, req);
  return record;
}

module.exports = {
  HOMEPAGE_STABILITY_RULE,
  RELEASE_DATA_PRESERVATION_GATES,
  SAVE_RESUME_CONTINUITY_MAP,
  QUOTE_PAYMENT_PRESERVATION,
  DEPLOYMENT_RELEASE_CHECK_SEQUENCE,
  buildReleaseContinuityAudit,
  buildProfessionalWorkDraftPayload,
  recordReleaseContinuityCheck,
  recordQuotePaymentPreservationCheck
};
