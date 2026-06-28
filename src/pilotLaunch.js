const LIVE_PILOT_PHASES = [
  {
    key: 'internal_demo',
    label: 'Internal demo only',
    clientPromise: 'Show the experience with sample data and non-sensitive documents only.',
    allowed: ['homepage', 'signup/signin', 'referral QR/flyer', 'sample intake', 'staff workflow demo', 'official form cataloging'],
    blocked: ['live taxpayer documents', 'paid final review', 'agency response', 'e-file', 'tax return signing']
  },
  {
    key: 'private_pilot_no_sensitive_uploads',
    label: 'Private pilot without sensitive uploads',
    clientPromise: 'Let selected users describe the issue and receive a starting checklist; documents are collected outside the platform until storage is production-ready.',
    allowed: ['client intake', 'case triage', 'service-fit estimate', 'referral tracking', 'staff task board', 'professional review assignment planning'],
    blocked: ['SSN/TIN documents', 'W-2/1099 uploads', 'official response/final tax advice without pro review']
  },
  {
    key: 'controlled_paid_pilot',
    label: 'Controlled paid pilot',
    clientPromise: 'Accept limited paid review cases after security, payment, professional, and operating controls are configured.',
    allowed: ['paid tax notice review', 'return organizer review', 'reviewed client summary', 'referral reward tracking'],
    blocked: ['public launch at scale', 'automated filing', 'unverified official form output', 'high-risk same-day representation']
  },
  {
    key: 'public_live_launch',
    label: 'Public live launch',
    clientPromise: 'Public paid platform for tax concerns and reviewed tax return help with live operational controls.',
    allowed: ['public paid intake', 'secure document upload', 'professional review', 'payments/referrals', 'official form mapping after QA'],
    blocked: ['anything not supported by verified forms, professional scope, or agency credentials']
  }
];

const IMPROVEMENT_AUDIT = [
  { area: 'Production data', severity: 'blocker', issue: 'Local JSON storage is useful for testing but not acceptable for live taxpayer data.', do_now: 'Keep the JSON adapter for demos, add a clear pilot gate, and require managed PostgreSQL before live sensitive documents.', production_requirement: 'Render PostgreSQL or equivalent database with backups, access controls, and migration discipline.' },
  { area: 'Document security', severity: 'blocker', issue: 'Encrypted local storage exists, but live taxpayer files need object storage, malware scanning, retention rules, and access review.', do_now: 'Add a sensitive-document gate and staff/client warnings before production storage is configured.', production_requirement: 'Private object storage, malware scanning, least-privilege staff roles, audit logs, and deletion/retention policy.' },
  { area: 'Professional review', severity: 'blocker', issue: 'The workflow supports professionals, but live paid review requires verified PTIN/NYTPRIN/CPA/EA/attorney records and clear scope.', do_now: 'Add credential checklist and pilot case limits before release.', production_requirement: 'Verified professional roster, reviewer assignment rules, engagement scope, client approval, and sign/release checklist.' },
  { area: 'Tax forms and calculations', severity: 'blocker', issue: 'Official form ZIP ingestion is ready, but official form output cannot be trusted until each form is mapped, sample-filled, and reviewed.', do_now: 'Keep all form output as draft/organizer until mapping QA is complete.', production_requirement: 'Official source verification, field maps, calculation tests, sample PDFs, and tax-year version control.' },
  { area: 'Payments and refunds', severity: 'blocker', issue: 'Stripe scaffolding exists, but live checkout/webhook/refund/reward behavior must be tested with live keys.', do_now: 'Add launch checklist and make payment release gates explicit.', production_requirement: 'Live Stripe keys, webhook secret, test charges/refunds, reward status rules, and refund policy shown before payment.' },
  { area: 'Customer UX', severity: 'important', issue: 'The language is now simpler, but users still need a single “where am I?” page and staff need a daily launch board.', do_now: 'Add founder next-action page, pilot board, and simple case status language.', production_requirement: 'Client journey clarity, no jargon, mobile checks, and low-friction return paths for existing users.' },
  { area: 'Security plan', severity: 'blocker', issue: 'Tax pros need an operational security plan, not only code features.', do_now: 'Add WISP/security-plan checklist and operating-policy tracker in the app.', production_requirement: 'Written Information Security Plan, incident response, staff training, password/MFA policy, vendor inventory, and access reviews.' },
  { area: 'Notifications', severity: 'important', issue: 'Account recovery hooks exist, but live users need real email delivery for reset, verification, case updates, and review reminders.', do_now: 'Add email-delivery checklist and template inventory.', production_requirement: 'Transactional email provider, SPF/DKIM/DMARC, support inbox, delivery logging, and templates reviewed for plain language.' }
];

const FOUNDER_ACTIONS = [
  { key: 'choose_pilot_mode', label: 'Choose launch mode', priority: 1, can_do_now: true, owner: 'Founder', plain: 'Decide whether the next deployment is internal demo, private pilot, controlled paid pilot, or public launch.', why: 'This prevents the site from accepting sensitive taxpayer documents before security and operations are ready.' },
  { key: 'configure_database', label: 'Set up Render PostgreSQL', priority: 2, can_do_now: false, owner: 'Founder/technical', plain: 'Create/attach a managed PostgreSQL database before using live taxpayer data.', why: 'Local JSON is not enough for production operations.' },
  { key: 'configure_private_storage', label: 'Set up private document storage', priority: 3, can_do_now: false, owner: 'Founder/technical', plain: 'Use private object storage and malware scanning before accepting W-2s, notices, returns, or IDs.', why: 'Tax documents contain highly sensitive taxpayer information.' },
  { key: 'verify_professionals', label: 'Verify professional roster', priority: 4, can_do_now: true, owner: 'Founder', plain: 'List who can review returns/notices, record PTIN/NYTPRIN/CPA/EA/attorney status, and define what each person may handle.', why: 'Paid tax work needs a clear human review and credential model.' },
  { key: 'finish_security_plan', label: 'Complete written security plan', priority: 5, can_do_now: true, owner: 'Founder/staff', plain: 'Use the built-in WISP checklist to define passwords, MFA, staff access, incident response, vendors, and data retention.', why: 'A tax platform needs written operating safeguards, not only code.' },
  { key: 'stripe_live', label: 'Configure Stripe live payments', priority: 6, can_do_now: false, owner: 'Founder/technical', plain: 'Add live Stripe keys, webhook secret, products/prices, refund handling, and reward rules.', why: 'Paid review and referral rewards should not rely on manual/mocked payments.' },
  { key: 'email_delivery', label: 'Configure transactional email', priority: 7, can_do_now: false, owner: 'Founder/technical', plain: 'Add email delivery for password resets, account verification, review updates, and upload reminders.', why: 'Live users need reliable communication.' },
  { key: 'official_forms', label: 'Upload official form ZIPs', priority: 8, can_do_now: true, owner: 'Founder/staff', plain: 'Begin with IRS tax-problem forms, then common 1040/NY/NYC forms. Keep official filenames and include instructions/source URLs.', why: 'Official forms drive future field mapping and reviewed output.' }
];

const WISP_CHECKLIST = [
  { category: 'Governance', item: 'Assign a security owner for taxpayer data.', required: true, status_key: 'security_owner_named' },
  { category: 'Data inventory', item: 'List what taxpayer data is collected, where it is stored, and who can access it.', required: true, status_key: 'data_inventory_done' },
  { category: 'Access controls', item: 'Require unique staff accounts, least-privilege roles, and staff approval before document access.', required: true, status_key: 'least_privilege_roles' },
  { category: 'MFA', item: 'Enable MFA for owner, staff, professional reviewers, email, GitHub, Render, Stripe, and storage accounts.', required: true, status_key: 'mfa_enabled' },
  { category: 'Passwords', item: 'Use a password manager and prohibit shared passwords.', required: true, status_key: 'password_manager' },
  { category: 'Transmission/storage', item: 'Use HTTPS, private storage, encryption at rest, and do not email taxpayer documents unencrypted.', required: true, status_key: 'secure_storage' },
  { category: 'Malware/file safety', item: 'Scan uploaded files before staff downloads or previews them.', required: true, status_key: 'malware_scanning' },
  { category: 'Vendors', item: 'Maintain a vendor list for hosting, email, payments, OCR, AI vendors, storage, and tax software.', required: true, status_key: 'vendor_inventory' },
  { category: 'Incident response', item: 'Create a written data incident response plan with owner, timeline, and notification steps.', required: true, status_key: 'incident_response' },
  { category: 'Training', item: 'Train staff/professionals on data handling, phishing, document access, and no off-platform sharing.', required: true, status_key: 'staff_training' },
  { category: 'Retention/deletion', item: 'Define how long documents and case records are kept and how deletion requests are handled.', required: true, status_key: 'retention_policy' },
  { category: 'Review cadence', item: 'Review access logs, staff roster, and security settings at least monthly during pilot.', required: true, status_key: 'monthly_access_review' }
];

const EMAIL_TEMPLATE_INVENTORY = [
  { key: 'verify_email', label: 'Verify your email', trigger: 'signup/request verification', status: 'template_needed', clientTone: 'short, reassuring, security-focused' },
  { key: 'reset_password', label: 'Reset your password', trigger: 'password reset request', status: 'template_needed', clientTone: 'simple, no sensitive tax details' },
  { key: 'case_created', label: 'We received your starting request', trigger: 'new case', status: 'template_needed', clientTone: 'plain next step and no guarantee language' },
  { key: 'documents_needed', label: 'Documents we may still need', trigger: 'action plan generated or staff review', status: 'template_needed', clientTone: 'checklist-style, no jargon' },
  { key: 'paid_review_requested', label: 'You requested human review', trigger: 'paid review request', status: 'template_needed', clientTone: 'clear scope, payment, and review timing' },
  { key: 'review_released', label: 'Your reviewed summary is ready', trigger: 'release to client', status: 'template_needed', clientTone: 'safe summary language and dashboard link' },
  { key: 'referral_reward_status', label: 'Referral reward update', trigger: 'eligible paid referral/reward status change', status: 'template_needed', clientTone: 'clear eligibility and refund/chargeback limits' }
];

function envBool(name) {
  return process.env[name] === 'true' || Boolean(process.env[name] && !['false','0','no','off'].includes(String(process.env[name]).toLowerCase()));
}

function buildLivePilotGate({ store } = {}) {
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasPrivateStorage = envBool('SECURE_OBJECT_STORAGE_CONFIGURED');
  const hasMalware = envBool('MALWARE_SCANNING_CONFIGURED');
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const hasEmail = envBool('EMAIL_DELIVERY_CONFIGURED') || Boolean(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.POSTMARK_SERVER_TOKEN);
  const hasOcr = envBool('OCR_PROVIDER_CONFIGURED') || envBool('TEXTRACT_CONFIGURED') || envBool('GOOGLE_DOCUMENT_AI_CONFIGURED');
  const professionals = store && store.list ? store.list('professionals').filter((p) => !p.deleted_at) : [];
  const verifiedPros = professionals.filter((p) => p.status === 'verified' || p.verified_at).length;
  const verifiedMappings = store && store.list ? store.list('official_form_mappings').filter((m) => !m.deleted_at && ['qa_passed','verified','ready_for_reviewed_output'].includes(String(m.status || m.mapping_status || '').toLowerCase())).length : 0;
  const wispEvents = store && store.list ? store.list('security_plan_events').filter((e) => !e.deleted_at) : [];
  const wispPassed = new Set(wispEvents.filter((e) => e.status === 'complete' || e.completed_at).map((e) => e.status_key));
  const requiredWispPassed = WISP_CHECKLIST.filter((item) => item.required && wispPassed.has(item.status_key)).length;
  const checks = [
    { key: 'managed_database', label: 'Managed database is configured', ok: hasDb, requiredFor: ['controlled_paid_pilot','public_live_launch'] },
    { key: 'private_storage', label: 'Private document storage is configured', ok: hasPrivateStorage, requiredFor: ['controlled_paid_pilot','public_live_launch'] },
    { key: 'malware_scanning', label: 'Uploaded-file malware scanning is configured', ok: hasMalware, requiredFor: ['controlled_paid_pilot','public_live_launch'] },
    { key: 'stripe_live_webhook', label: 'Live Stripe key and webhook are configured', ok: hasStripe, requiredFor: ['controlled_paid_pilot','public_live_launch'] },
    { key: 'email_delivery', label: 'Transactional email delivery is configured', ok: hasEmail, requiredFor: ['controlled_paid_pilot','public_live_launch'] },
    { key: 'ocr_provider', label: 'Production OCR/document extraction provider is configured', ok: hasOcr, requiredFor: ['public_live_launch'] },
    { key: 'verified_professionals', label: 'At least one professional reviewer is verified', ok: verifiedPros > 0, requiredFor: ['controlled_paid_pilot','public_live_launch'], count: verifiedPros },
    { key: 'official_form_qa', label: 'At least one official form mapping passed QA', ok: verifiedMappings > 0, requiredFor: ['public_live_launch'], count: verifiedMappings },
    { key: 'written_security_plan', label: 'Written security plan checklist is substantially complete', ok: requiredWispPassed >= WISP_CHECKLIST.filter((x) => x.required).length, requiredFor: ['controlled_paid_pilot','public_live_launch'], passed: requiredWispPassed, total: WISP_CHECKLIST.filter((x) => x.required).length }
  ];
  const phaseStatus = LIVE_PILOT_PHASES.map((phase) => {
    const blockers = checks.filter((c) => (c.requiredFor || []).includes(phase.key) && !c.ok);
    return { ...phase, allowed_now: blockers.length === 0, blockers };
  });
  const recommended = phaseStatus.find((p) => p.allowed_now && p.key === 'public_live_launch')
    || phaseStatus.find((p) => p.allowed_now && p.key === 'controlled_paid_pilot')
    || phaseStatus.find((p) => p.allowed_now && p.key === 'private_pilot_no_sensitive_uploads')
    || phaseStatus[0];
  return {
    recommended_phase: recommended,
    phase_status: phaseStatus,
    checks,
    policy: 'Do not accept live sensitive taxpayer uploads or final paid tax work until the phase gate supports it. Keep demo/pilot language clear.'
  };
}

function buildFounderNextActions({ store } = {}) {
  const gate = buildLivePilotGate({ store });
  const blocked = FOUNDER_ACTIONS.filter((a) => !a.can_do_now);
  const now = FOUNDER_ACTIONS.filter((a) => a.can_do_now);
  return {
    recommended_phase: gate.recommended_phase.label,
    do_now: now,
    needs_configuration: blocked,
    top_blockers: gate.checks.filter((c) => !c.ok).slice(0, 8),
    next_build_suggestion: 'After official IRS/NYS/NYC form ZIPs are uploaded, prioritize official-source verification, field mapping QA, sample-fill tests, and reviewer sign-off before any form output is customer-facing.'
  };
}

function buildSecurityPlanReport({ store } = {}) {
  const events = store && store.list ? store.list('security_plan_events').filter((e) => !e.deleted_at) : [];
  const latestByKey = new Map();
  for (const event of events.slice().reverse()) latestByKey.set(event.status_key, event);
  const checklist = WISP_CHECKLIST.map((item) => {
    const event = latestByKey.get(item.status_key) || null;
    const status = event ? event.status : 'not_started';
    return { ...item, status, completed_at: event ? event.completed_at : '', note: event ? event.note : '' };
  });
  const complete = checklist.filter((x) => x.status === 'complete' || x.completed_at).length;
  return {
    title: 'Security plan checklist',
    source_basis: 'Built around IRS taxpayer-data safeguarding expectations and written security plan practices for tax professionals.',
    complete,
    total: checklist.length,
    ready: complete === checklist.length,
    checklist
  };
}

function buildPilotCaseBoard({ store } = {}) {
  const cases = store && store.list ? store.list('cases').filter((c) => !c.deleted_at).slice(0, 200) : [];
  const rows = cases.map((c) => {
    const missing = Array.isArray(c.missing_items) ? c.missing_items.length : 0;
    const docs = store.list('documents').filter((d) => d.case_id === c.id && !d.deleted_at).length;
    const highRisk = ['urgent','high'].includes(String(c.risk_level || '').toLowerCase());
    const needsPro = Boolean(c.professional_review_required || c.review_plan || highRisk || c.payment_status === 'paid');
    const stage = c.status === 'released_to_client' ? 'released' : c.payment_status === 'paid' ? 'paid-review' : c.client_done_uploading ? 'ready-for-staff' : docs ? 'documents-received' : 'started';
    return { id: c.id, email: c.email, pathway: c.pathway, agency: c.agency, risk_level: c.risk_level, stage, documents: docs, missing_items: missing, needs_professional: needsPro, updated_at: c.updated_at || c.created_at };
  });
  return {
    counts: {
      total: rows.length,
      ready_for_staff: rows.filter((r) => r.stage === 'ready-for-staff').length,
      paid_review: rows.filter((r) => r.stage === 'paid-review').length,
      high_or_urgent: rows.filter((r) => ['urgent','high'].includes(String(r.risk_level || '').toLowerCase())).length,
      released: rows.filter((r) => r.stage === 'released').length
    },
    rows
  };
}

function buildEmailTemplateInventory() {
  return { templates: EMAIL_TEMPLATE_INVENTORY, production_requirement: 'Configure a transactional email provider and avoid including sensitive tax details in email bodies.' };
}

module.exports = {
  LIVE_PILOT_PHASES,
  IMPROVEMENT_AUDIT,
  FOUNDER_ACTIONS,
  WISP_CHECKLIST,
  EMAIL_TEMPLATE_INVENTORY,
  buildLivePilotGate,
  buildFounderNextActions,
  buildSecurityPlanReport,
  buildPilotCaseBoard,
  buildEmailTemplateInventory
};
