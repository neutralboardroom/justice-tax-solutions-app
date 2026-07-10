
const path = require('path');

const APP_VERSION = '0.1.67';

const DATA_PRESERVATION_POLICY = {
  version: APP_VERSION,
  headline: 'Deployments must never wipe customer accounts, staff/professional work, payment records, uploaded documents, or saved progress.',
  non_negotiables: [
    'Do not deploy by deleting the live data directory or upload directory.',
    'Do not package runtime data, uploads, logs, .env files, database files, or secrets inside source ZIPs.',
    'Use managed PostgreSQL or another persistent database for users, cases, drafts, payments, reviews, staff notes, professional signoffs, and audit events before full production.',
    'Use private object storage or a persistent mounted upload volume for taxpayer documents; never rely on an ephemeral deploy folder for live documents.',
    'Every schema change must be additive or migration-backed. No destructive migrations without backup, tested restore, owner approval, and a rollback plan.',
    'Before each deploy, confirm backup/restore, data directory, upload directory, database URL, object storage, and payment webhook state.',
    'After each deploy, smoke-test sign-in, dashboard case list, saved drafts, document references, quotes, payment records, staff queues, professional work queues, and save/resume APIs before announcing success.'
  ],
  preserved_record_types: [
    'public customer accounts and login credentials',
    'public customer cases and intake answers',
    'partially completed organizers, return reviews, amendment screens, and form/workflow drafts',
    'uploaded document metadata and encrypted document/object-storage references',
    'staff notes, tasks, status labels, follow-up dates, and triage decisions',
    'accountant/CPA/EA/bookkeeper/payroll/sales-tax/tax attorney review work and signoffs',
    'quotes, payment requests, Stripe/session metadata, receipts, and refund/chargeback history',
    'referral attribution, rewards, partner QR activity, and marketing attribution',
    'client approvals, acknowledgments, release events, and audit/access logs'
  ]
};

const SAVE_RESUME_MODEL = {
  headline: 'Every long workflow should be saveable, resumable, and visible on the dashboard.',
  public_customer: [
    'Save a draft from the start intake, personal filing, business filing, past-return review, Truth Check, and official-PDF/form-organizer workspaces.',
    'Show last saved time and status on the customer dashboard.',
    'Allow users to stop after any section and return later without retyping work.',
    'Keep users warned not to enter full SSNs, bank data, full unredacted notices, or complete returns while live sensitive upload gates remain blocked.'
  ],
  staff: [
    'Preserve triage status, notes, next follow-up dates, quote status, payment status, document review status, and release gates across every deployment.',
    'Staff should see whether a customer draft is incomplete, ready for review, waiting on documents, or waiting on payment/quote approval.',
    'Internal notes must stay private and should not expose sensitive facts in email, analytics, or URLs.'
  ],
  professionals: [
    'Professional reviewers need persistent assignments, workpapers/checklists, signoff state, role/credential disclosure, and release notes.',
    'Professional work must be saved even if the user pauses, payment is pending, or the platform is redeployed.',
    'No final filing, signing, official form output, e-file, or agency submission should occur from an unsaved/unreviewed draft.'
  ],
  owner_deploy: [
    'Treat deployment as source-code replacement only, never data replacement.',
    'Back up database and uploaded documents before deploy.',
    'Verify the live site version and then verify saved users/cases/drafts/payments still appear.'
  ]
};

const SENSITIVE_KEY_PATTERN = /(ssn|social|ein|tin|ip[_-]?pin|bank|routing|account_number|full_account|password|token|secret|transcript|w2|w-2|1099_full|full_notice|direct_debit)/i;
const SENSITIVE_VALUE_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b|\b\d{9,17}\b/;

function redactForDraft(value, keyPath = []) {
  if (Array.isArray(value)) return value.slice(0, 100).map((item, index) => redactForDraft(item, keyPath.concat(String(index))));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      const nextPath = keyPath.concat(key);
      if (SENSITIVE_KEY_PATTERN.test(nextPath.join('.'))) {
        output[key] = '[not saved in draft while live sensitive-data gates are blocked]';
      } else {
        output[key] = redactForDraft(child, nextPath);
      }
    }
    return output;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().slice(0, 5000);
    if (SENSITIVE_KEY_PATTERN.test(keyPath.join('.')) || SENSITIVE_VALUE_PATTERN.test(trimmed)) {
      return '[redacted from draft - enter only in secure production flow]';
    }
    return trimmed;
  }
  return value;
}

function buildDraftPayload({ user, body = {}, existing = null }) {
  const now = new Date().toISOString();
  const data = redactForDraft(body.data || body.answers || body.form_values || {});
  const title = String(body.title || body.pathway || body.workflow || (existing && existing.title) || 'Saved tax work draft').slice(0, 120);
  const workflow = String(body.workflow || body.pathway || (existing && existing.workflow) || 'general-tax-work').slice(0, 80);
  const caseId = String(body.case_id || body.caseId || (existing && existing.case_id) || '').slice(0, 120);
  return {
    user_id: user.id,
    user_email: user.email,
    case_id: caseId,
    title,
    workflow,
    page_path: String(body.page_path || body.pagePath || (existing && existing.page_path) || '').slice(0, 220),
    status: String(body.status || (existing && existing.status) || 'draft_saved').slice(0, 80),
    last_completed_section: String(body.last_completed_section || body.section || (existing && existing.last_completed_section) || '').slice(0, 160),
    progress_percent: Math.max(0, Math.min(100, Number(body.progress_percent || (existing && existing.progress_percent) || 0))),
    data,
    data_redaction_notice: 'Draft saving intentionally redacts likely SSNs, EINs, bank/account numbers, tokens, passwords, and other high-risk values while live sensitive upload/data gates remain blocked.',
    updated_at: now,
    last_saved_at: now
  };
}

function publicDraft(draft = {}) {
  return {
    id: draft.id,
    case_id: draft.case_id || '',
    title: draft.title || 'Saved tax work draft',
    workflow: draft.workflow || 'general-tax-work',
    page_path: draft.page_path || '',
    status: draft.status || 'draft_saved',
    last_completed_section: draft.last_completed_section || '',
    progress_percent: Number(draft.progress_percent || 0),
    last_saved_at: draft.last_saved_at || draft.updated_at || draft.created_at,
    created_at: draft.created_at,
    data: draft.data || {},
    data_redaction_notice: draft.data_redaction_notice || ''
  };
}

function buildPersistenceReadiness({ store, env = process.env } = {}) {
  const summary = store.storageSummary ? store.storageSummary() : {};
  const hasManagedDb = Boolean(env.DATABASE_URL);
  const hasExternalObjectStorage = env.SECURE_OBJECT_STORAGE_CONFIGURED === 'true';
  const dataPathRisk = Boolean(summary.data_inside_app_directory || summary.uploads_inside_app_directory);
  const counts = summary.counts || {};
  return {
    version: APP_VERSION,
    persistence_status: hasManagedDb && hasExternalObjectStorage && !dataPathRisk ? 'strong_production_path' : hasManagedDb ? 'database_present_storage_needs_finalization' : 'development_or_pilot_storage_only',
    managed_database_configured: hasManagedDb,
    secure_object_storage_configured: hasExternalObjectStorage,
    data_path_inside_release_folder: Boolean(summary.data_inside_app_directory),
    upload_path_inside_release_folder: Boolean(summary.uploads_inside_app_directory),
    runtime_counts: {
      users: counts.users || 0,
      cases: counts.cases || 0,
      documents: counts.documents || 0,
      payments: counts.payments || 0,
      work_progress_drafts: counts.work_progress_drafts || 0,
      case_progress_saves: counts.case_progress_saves || 0,
      review_requests: counts.review_requests || 0,
      review_notes: counts.review_notes || 0,
      professional_signoffs: counts.professional_signoffs || 0
    },
    warnings: [
      !hasManagedDb ? 'DATABASE_URL is not configured. Local JSON is acceptable for development/pilot testing only; production needs managed persistent database storage.' : '',
      !hasExternalObjectStorage ? 'SECURE_OBJECT_STORAGE_CONFIGURED is not true. Live taxpayer documents should use private object storage or a persistent encrypted upload volume.' : '',
      dataPathRisk ? 'DATA_DIR or UPLOAD_DIR appears inside the app release folder. A clean deploy could wipe data unless the deployment preserves those folders externally.' : '',
      'Do not clean-deploy over live runtime storage. Source ZIPs should exclude runtime data; live deployments should preserve persistent database/object storage.'
    ].filter(Boolean)
  };
}

function buildDeploymentDataPreservationChecklist({ store, env = process.env } = {}) {
  const readiness = buildPersistenceReadiness({ store, env });
  return {
    version: APP_VERSION,
    headline: 'Pre-deploy and post-deploy data-preservation checklist',
    pre_deploy: [
      { key: 'backup_database', label: 'Back up users, cases, drafts, staff work, professional work, payments, and audit records.', required: true },
      { key: 'backup_uploads', label: 'Back up uploaded document storage or confirm private object storage versioning/retention.', required: true },
      { key: 'confirm_env_dirs', label: 'Confirm DATA_DIR and UPLOAD_DIR are persistent or external to the source release folder.', required: true },
      { key: 'migration_plan', label: 'Review schema changes; ensure they are additive or migration-backed and not destructive.', required: true },
      { key: 'stripe_webhook_state', label: 'Confirm Stripe/live payment webhook settings will not create duplicate or lost payment records.', required: true },
      { key: 'rollback_plan', label: 'Have rollback package and restore steps ready before deploy.', required: true }
    ],
    deploy_rules: [
      'Do not delete data/, storage/, uploaded documents, runtime database files, or object-storage buckets during source deployment.',
      'Do not run destructive migrations automatically.',
      'Do not overwrite .env or Render environment variables from a ZIP.',
      'Do not switch JWT_SECRET/session secrets without a session-impact plan; users may be signed out but their accounts must remain intact.',
      'Never package or publish live taxpayer documents in a source ZIP.'
    ],
    post_deploy: [
      'Check /health for the expected version.',
      'Sign in as a test customer and confirm dashboard cases still appear.',
      'Open a saved draft and confirm progress is still present.',
      'Check staff workbench queues for existing cases, notes, tasks, assignments, quotes, and payment records.',
      'Confirm document metadata still points to existing encrypted files/object-storage keys without exposing private file paths to customers.',
      'Confirm payment/quote records still show correct status and Stripe webhook endpoint is still configured.',
      'Record a deployment data check event before inviting users back.'
    ],
    readiness
  };
}

function buildSaveResumeReadiness({ store } = {}) {
  const summary = store && store.storageSummary ? store.storageSummary() : { counts: {} };
  const counts = summary.counts || {};
  return {
    version: APP_VERSION,
    headline: 'Save and resume readiness',
    ready_for_controlled_testing: true,
    enabled_now: [
      'Signed-in users can save draft progress records through the work-progress draft API.',
      'Case-linked progress saves can be recorded without replacing the full case record.',
      'Dashboard/staff pages now explain that users and professionals should be able to stop and resume work.',
      'Sensitive values are redacted from draft payloads while live sensitive-data gates remain blocked.'
    ],
    next_production_steps: [
      'Move draft/progress storage to managed PostgreSQL tables before full production.',
      'Add section-level autosave to each official PDF/form workspace after official PDFs are mapped.',
      'Add document/object-storage retention, deletion, and restore procedures.',
      'Add professional reviewer workpaper autosave and final-signoff locking after role/credential gates are verified.'
    ],
    counts: {
      work_progress_drafts: counts.work_progress_drafts || 0,
      case_progress_saves: counts.case_progress_saves || 0,
      cases: counts.cases || 0,
      users: counts.users || 0
    }
  };
}

function buildDataContinuityAudit({ store, env = process.env } = {}) {
  return {
    policy: DATA_PRESERVATION_POLICY,
    save_resume_model: SAVE_RESUME_MODEL,
    persistence_readiness: buildPersistenceReadiness({ store, env }),
    deployment_checklist: buildDeploymentDataPreservationChecklist({ store, env }),
    save_resume_readiness: buildSaveResumeReadiness({ store })
  };
}

module.exports = {
  DATA_PRESERVATION_POLICY,
  SAVE_RESUME_MODEL,
  redactForDraft,
  buildDraftPayload,
  publicDraft,
  buildPersistenceReadiness,
  buildDeploymentDataPreservationChecklist,
  buildSaveResumeReadiness,
  buildDataContinuityAudit
};
