function boolEnv(name, env = process.env) {
  return String(env[name] || '').toLowerCase() === 'true';
}

function hasRealValue(name, env = process.env) {
  const value = String(env[name] || '').trim();
  if (!value) return false;
  return !/^(dev|test|change-me|placeholder|your-|example|demo|replace_with)/i.test(value);
}

function latestStatus(store, key) {
  if (!store || !store.list) return null;
  const all = [
    ...store.list('production_security_events', (e) => e.status_key === key && !e.deleted_at),
    ...store.list('security_plan_events', (e) => e.status_key === key && !e.deleted_at),
    ...store.list('production_config_events', (e) => e.status_key === key && !e.deleted_at)
  ];
  return all.sort((a, b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0))[0] || null;
}

const SENSITIVE_DATA_CLASSES = [
  {
    key: 'public_marketing',
    label: 'Public marketing and pricing content',
    examples: ['service descriptions', 'general pricing', 'public FAQs'],
    handling: 'May appear on public pages after compliance copy review.',
    liveRisk: 'low'
  },
  {
    key: 'account_identity',
    label: 'Account and contact information',
    examples: ['name', 'email', 'phone', 'login/session records'],
    handling: 'Protect with secure sessions, password hashing, access controls, and no public exposure.',
    liveRisk: 'medium'
  },
  {
    key: 'tax_concern_text',
    label: 'Tax concern descriptions and AI summaries',
    examples: ['notice description', 'tax debt details', 'unfiled-year narrative'],
    handling: 'Do not include in email. Show inside authenticated dashboard/staff workbench only.',
    liveRisk: 'high'
  },
  {
    key: 'sensitive_taxpayer_documents',
    label: 'Sensitive taxpayer documents',
    examples: ['IRS/NYS/NYC notices', 'W-2/1099', 'returns', 'transcripts', 'bank/account numbers', 'SSNs/ITINs'],
    handling: 'Blocked from public/live upload until managed database, private storage, malware scanning, MFA/access controls, WISP, retention, incident response, and reviewer procedures are complete.',
    liveRisk: 'critical'
  },
  {
    key: 'professional_credentials',
    label: 'Professional credential records',
    examples: ['PTIN', 'NYTPRIN', 'EA/CPA/attorney credentials', 'verification notes'],
    handling: 'Staff-only. Use credential status, expiration, and review-scope controls before assigning paid work.',
    liveRisk: 'high'
  }
];

const PRODUCTION_SECURITY_CONTROLS = [
  {
    key: 'managed_database',
    label: 'Managed PostgreSQL configured and migrated',
    severity: 'critical',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['DATABASE_URL'],
    passWhen: (env) => hasRealValue('DATABASE_URL', env),
    fix: 'Create Render PostgreSQL or another managed database, set DATABASE_URL, and run db/postgres-schema.sql before real cases scale.'
  },
  {
    key: 'private_object_storage',
    label: 'Private object storage configured for taxpayer documents',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads'],
    env: ['DOCUMENT_STORAGE_PROVIDER', 'SECURE_OBJECT_STORAGE_CONFIGURED'],
    passWhen: (env) => boolEnv('SECURE_OBJECT_STORAGE_CONFIGURED', env) && ['s3', 'r2', 'gcs'].includes(String(env.DOCUMENT_STORAGE_PROVIDER || '').toLowerCase()),
    fix: 'Configure S3/R2/GCS private storage with least-privilege credentials, encryption, lifecycle rules, and no public bucket access.'
  },
  {
    key: 'malware_scanning',
    label: 'Malware scanning and quarantine workflow configured',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads'],
    env: ['MALWARE_SCANNING_CONFIGURED', 'MALWARE_SCANNING_PROVIDER'],
    passWhen: (env) => boolEnv('MALWARE_SCANNING_CONFIGURED', env) || ['clamav', 'opswat', 'cloud-native'].includes(String(env.MALWARE_SCANNING_PROVIDER || '').toLowerCase()),
    fix: 'Configure a real scanner and keep all live uploads quarantined until clean before staff preview/download.'
  },
  {
    key: 'strong_encryption_keys',
    label: 'Strong session and document encryption secrets configured',
    severity: 'critical',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['JWT_SECRET', 'DOCUMENT_ENCRYPTION_KEY', 'AUDIT_HASH_SALT'],
    passWhen: (env) => hasRealValue('JWT_SECRET', env) && hasRealValue('DOCUMENT_ENCRYPTION_KEY', env) && String(env.DOCUMENT_ENCRYPTION_KEY || '').length >= 32,
    fix: 'Use long random secrets for JWT_SECRET, DOCUMENT_ENCRYPTION_KEY, and AUDIT_HASH_SALT. Do not reuse development placeholders.'
  },
  {
    key: 'staff_mfa_access_controls',
    label: 'Staff/professional MFA or equivalent access control required',
    severity: 'critical',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['STAFF_MFA_REQUIRED', 'MFA_REQUIRED', 'REQUIRE_STAFF_APPROVAL'],
    passWhen: (env) => (boolEnv('STAFF_MFA_REQUIRED', env) || boolEnv('MFA_REQUIRED', env)) && String(env.REQUIRE_STAFF_APPROVAL || '').toLowerCase() !== 'false',
    fix: 'Require staff approval plus MFA or a documented compensating control before staff/professionals access taxpayer data.'
  },
  {
    key: 'professional_verification',
    label: 'Professional credential verification and review scope recorded',
    severity: 'critical',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['PROFESSIONAL_VERIFICATION_COMPLETE'],
    passWhen: (env, store) => boolEnv('PROFESSIONAL_VERIFICATION_COMPLETE', env) || (store && store.list && store.list('professionals', (p) => ['verified','approved','active'].includes(String(p.credential_status || p.status || '').toLowerCase())).length > 0),
    fix: 'Verify PTIN/NYTPRIN/EA/CPA/attorney records, allowed review scope, and expiration/renewal status before assigning paid review.'
  },
  {
    key: 'wisp_approved',
    label: 'Written Information Security Plan approved',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads'],
    env: ['WISP_APPROVED'],
    passWhen: (env, store) => boolEnv('WISP_APPROVED', env) || ((latestStatus(store, 'wisp_approved') || {}).status === 'complete'),
    fix: 'Finalize WISP operating procedures, owners, safeguards, incident response, training, vendor controls, retention, and review cadence.'
  },
  {
    key: 'retention_deletion_policy',
    label: 'Data retention, deletion, and legal-hold policy approved',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads'],
    env: ['DATA_RETENTION_POLICY_APPROVED'],
    passWhen: (env, store) => boolEnv('DATA_RETENTION_POLICY_APPROVED', env) || ((latestStatus(store, 'retention_deletion_policy') || {}).status === 'complete'),
    fix: 'Approve how long cases/documents are retained, when they are deleted, who can approve deletion, and how audit logs are preserved.'
  },
  {
    key: 'backup_restore_tested',
    label: 'Backup and restore plan tested',
    severity: 'high',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['BACKUP_RESTORE_TESTED'],
    passWhen: (env, store) => boolEnv('BACKUP_RESTORE_TESTED', env) || ((latestStatus(store, 'backup_restore_tested') || {}).status === 'complete'),
    fix: 'Document backup frequency, restore test date, data owner, and recovery procedure for database and private object storage.'
  },
  {
    key: 'incident_response_plan',
    label: 'Incident-response and breach-escalation plan approved',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads'],
    env: ['INCIDENT_RESPONSE_PLAN_APPROVED'],
    passWhen: (env, store) => boolEnv('INCIDENT_RESPONSE_PLAN_APPROVED', env) || ((latestStatus(store, 'incident_response_plan') || {}).status === 'complete'),
    fix: 'Define incident triage, owner alerts, containment, evidence preservation, customer notification review, and post-incident controls.'
  },
  {
    key: 'email_no_sensitive_details',
    label: 'Transactional email provider and no-sensitive-details policy ready',
    severity: 'high',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['SMTP_HOST', 'RESEND_API_KEY', 'SENDGRID_API_KEY', 'EMAIL_DOMAIN_AUTHENTICATED', 'SPF_DKIM_DMARC_CONFIGURED'],
    passWhen: (env) => (hasRealValue('SMTP_HOST', env) || hasRealValue('RESEND_API_KEY', env) || hasRealValue('SENDGRID_API_KEY', env)) && (boolEnv('EMAIL_DOMAIN_AUTHENTICATED', env) || boolEnv('SPF_DKIM_DMARC_CONFIGURED', env)),
    fix: 'Configure authenticated transactional email and keep all tax details inside the signed-in dashboard, not in email bodies/subjects.'
  },
  {
    key: 'stripe_live_webhook',
    label: 'Stripe live checkout and webhook verified',
    severity: 'high',
    requiredFor: ['controlled_paid_pilot', 'public_live_sensitive_uploads'],
    env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    passWhen: (env) => hasRealValue('STRIPE_SECRET_KEY', env) && hasRealValue('STRIPE_WEBHOOK_SECRET', env),
    fix: 'Set live Stripe keys, webhook secret, return URLs, and test paid/failed/refund paths before paid marketing.'
  },
  {
    key: 'official_form_output_gates',
    label: 'Official form output gates remain enforced',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads', 'print_ready_forms'],
    env: ['OFFICIAL_FORM_OUTPUT_APPROVED'],
    passWhen: (env, store) => boolEnv('OFFICIAL_FORM_OUTPUT_APPROVED', env) || (store && store.list && store.list('official_form_mappings', (m) => String(m.client_output_ready || m.release_status || '').includes('ready')).length > 0),
    fix: 'Do not release print-ready official forms until source capture, checksum, field maps, sample-fill QA, overflow/signature checks, client verification, and required professional review pass.'
  },
  {
    key: 'security_go_live_approval',
    label: 'Owner/admin security go-live approval recorded',
    severity: 'critical',
    requiredFor: ['public_live_sensitive_uploads'],
    env: ['SECURITY_GO_LIVE_APPROVED'],
    passWhen: (env, store) => boolEnv('SECURITY_GO_LIVE_APPROVED', env) || ((latestStatus(store, 'security_go_live_approval') || {}).status === 'complete'),
    fix: 'Record explicit owner/admin approval after all controls, staff training, and final smoke tests pass.'
  }
];

const WISP_READINESS_CHECKLIST = [
  { key: 'wisp_approved', category: 'Governance', item: 'Written Information Security Plan approved and reviewed by the owner.' },
  { key: 'staff_mfa_access_controls', category: 'Access', item: 'Staff/professional access requires approval, least privilege, and MFA or equivalent compensating control.' },
  { key: 'data_inventory', category: 'Data inventory', item: 'Sensitive taxpayer data classes and storage locations are documented.' },
  { key: 'private_object_storage', category: 'Documents', item: 'Live taxpayer documents use private object storage, encryption, access logs, and short-lived access.' },
  { key: 'malware_scanning', category: 'Documents', item: 'Uploads are quarantined and malware-scanned before staff preview/download.' },
  { key: 'email_no_sensitive_details', category: 'Communications', item: 'Email templates contain no sensitive taxpayer facts and direct users to the dashboard.' },
  { key: 'retention_deletion_policy', category: 'Retention', item: 'Retention, deletion, and legal-hold procedure is approved.' },
  { key: 'backup_restore_tested', category: 'Continuity', item: 'Database/object-storage backups and restore process are tested.' },
  { key: 'incident_response_plan', category: 'Incident response', item: 'Incident response, owner alert, and containment procedure is approved.' },
  { key: 'professional_verification', category: 'Professional operations', item: 'PTIN/NYTPRIN/EA/CPA/attorney credential checks and review scopes are recorded.' },
  { key: 'security_go_live_approval', category: 'Launch approval', item: 'Owner/admin approval is recorded before enabling live sensitive upload mode.' }
];

function controlStatus(control, store = null, env = process.env) {
  const event = latestStatus(store, control.key);
  const envOk = control.passWhen ? Boolean(control.passWhen(env, store)) : false;
  const eventOk = event && event.status === 'complete';
  const ok = Boolean(envOk || eventOk);
  return {
    key: control.key,
    label: control.label,
    severity: control.severity,
    requiredFor: control.requiredFor,
    ok,
    source: eventOk ? 'staff_event' : (envOk ? 'environment_or_data' : 'missing'),
    latest_status: event ? { status: event.status, note: event.note || '', updated_at: event.updated_at || event.created_at || '' } : null,
    env: control.env,
    fix: control.fix
  };
}

function buildProductionSecurityReadiness({ store = null, env = process.env } = {}) {
  const controls = PRODUCTION_SECURITY_CONTROLS.map((control) => controlStatus(control, store, env));
  const critical = controls.filter((c) => c.severity === 'critical');
  const high = controls.filter((c) => c.severity === 'high');
  const criticalBlockers = critical.filter((c) => !c.ok);
  const highBlockers = high.filter((c) => !c.ok);
  const canAcceptLiveSensitiveDocuments = criticalBlockers.length === 0 && highBlockers.length === 0 && boolEnv('ALLOW_SENSITIVE_DOCUMENT_UPLOADS', env) && boolEnv('LIVE_PAYING_USERS_ENABLED', env);
  const canRunNoSensitivePrivatePilot = controls.find((c) => c.key === 'strong_encryption_keys')?.ok && controls.find((c) => c.key === 'staff_mfa_access_controls')?.ok;
  return {
    version: '0.1.27',
    stage: canAcceptLiveSensitiveDocuments ? 'live_sensitive_upload_controls_ready_pending_final_operating_review' : (canRunNoSensitivePrivatePilot ? 'private_pilot_no_sensitive_uploads_possible' : 'internal_demo_or_no_sensitive_private_pilot_only'),
    ready_for_live_sensitive_taxpayer_documents: canAcceptLiveSensitiveDocuments,
    ready_for_no_sensitive_private_pilot: Boolean(canRunNoSensitivePrivatePilot),
    live_sensitive_upload_flag_enabled: boolEnv('ALLOW_SENSITIVE_DOCUMENT_UPLOADS', env),
    live_mode_enabled: boolEnv('LIVE_PAYING_USERS_ENABLED', env),
    critical_passed: critical.length - criticalBlockers.length,
    critical_total: critical.length,
    high_passed: high.length - highBlockers.length,
    high_total: high.length,
    controls,
    blockers: [...criticalBlockers, ...highBlockers].map((c) => ({ key: c.key, label: c.label, severity: c.severity, fix: c.fix })),
    policy: 'Do not enable real sensitive taxpayer document uploads until every critical/high control is complete and explicit owner/admin security go-live approval is recorded. Redacted/sample uploads can remain available for private testing only.'
  };
}

function buildSensitiveDataHandlingRunbook({ env = process.env } = {}) {
  return {
    version: '0.1.27',
    title: 'Sensitive taxpayer data handling runbook',
    data_classes: SENSITIVE_DATA_CLASSES,
    lifecycle: [
      { step: 1, key: 'intake', rule: 'Collect the minimum information needed for screening; use plain consent and no-guarantee acknowledgments.' },
      { step: 2, key: 'upload_gate', rule: 'Block live sensitive documents unless production gates pass; allow only redacted/sample files when acknowledged.' },
      { step: 3, key: 'quarantine', rule: 'Record metadata/checksum and quarantine every live upload until the scanner returns clean.' },
      { step: 4, key: 'staff_access', rule: 'Require staff/professional role permission, approval, MFA/equivalent control, clean scan, and access logging before preview/download.' },
      { step: 5, key: 'ai_extraction', rule: 'AI/OCR extractions are source-linked suggestions only; never use unverified values for filing, forms, or payment/debt advice.' },
      { step: 6, key: 'professional_review', rule: 'Route paid prep, debt/notice, accounting, representation, or legal-sensitive issues to the correct verified review level.' },
      { step: 7, key: 'client_verification', rule: 'Client must review summaries/forms before signing, filing, or agency response.' },
      { step: 8, key: 'retention_deletion', rule: 'Apply retention/deletion/legal-hold policy; keep audit logs without exposing sensitive content.' }
    ],
    email_rule: 'No SSNs, account numbers, notice images, tax transcript data, refund/debt figures, or detailed tax facts in email subject/body. Tell users to sign in to the dashboard.',
    current_live_upload_flag: boolEnv('ALLOW_SENSITIVE_DOCUMENT_UPLOADS', env),
    current_live_mode: boolEnv('LIVE_PAYING_USERS_ENABLED', env)
  };
}

function buildAccessControlAudit({ store = null, env = process.env } = {}) {
  const users = store && store.list ? store.list('users', (u) => !u.deleted_at) : [];
  const professionals = store && store.list ? store.list('professionals', (p) => !p.deleted_at) : [];
  const staffRoles = ['staff', 'admin', 'owner', 'professional', 'human_tax_specialist'];
  const staffUsers = users.filter((u) => staffRoles.includes(String(u.role || '').toLowerCase()));
  const pendingStaff = staffUsers.filter((u) => !['approved', 'active', 'verified'].includes(String(u.staff_status || u.status || '').toLowerCase()));
  const verifiedPros = professionals.filter((p) => ['verified', 'approved', 'active'].includes(String(p.credential_status || p.status || '').toLowerCase()) || Number(p.compliance_score || 0) >= 70);
  const unscopedPros = verifiedPros.filter((p) => !p.allowed_review_levels && !p.role && !p.professional_type);
  const accessLogs = store && store.list ? store.list('access_logs').length : 0;
  return {
    version: '0.1.27',
    staff_mfa_required: boolEnv('STAFF_MFA_REQUIRED', env) || boolEnv('MFA_REQUIRED', env),
    require_staff_approval: String(env.REQUIRE_STAFF_APPROVAL || '').toLowerCase() !== 'false',
    staff_user_count: staffUsers.length,
    pending_staff_count: pendingStaff.length,
    verified_professional_count: verifiedPros.length,
    unscoped_verified_professional_count: unscopedPros.length,
    access_log_count: accessLogs,
    blockers: [
      ...((boolEnv('STAFF_MFA_REQUIRED', env) || boolEnv('MFA_REQUIRED', env)) ? [] : ['Staff/professional MFA or equivalent control is not marked required.']),
      ...(String(env.REQUIRE_STAFF_APPROVAL || '').toLowerCase() !== 'false' ? [] : ['Staff approval is not required by configuration.']),
      ...(pendingStaff.length ? ['Some staff/professional users are not marked approved/active/verified.'] : []),
      ...(verifiedPros.length ? [] : ['No verified professional reviewer is recorded.']),
      ...(unscopedPros.length ? ['Some verified professionals do not have a clear allowed review scope.'] : [])
    ],
    least_privilege_rule: 'Staff/professional accounts should see only the case, document, payment, appointment, and review data needed for their role. Sensitive document download/preview must be permission-gated, scan-gated, and access-logged.',
    private_calendar_rule: 'Private professional calendar details stay hidden from customers; customers only see approved appointment slots, meeting links, phone instructions, or location once confirmed.'
  };
}

function buildSecurityLaunchBlockers({ store = null, env = process.env } = {}) {
  const readiness = buildProductionSecurityReadiness({ store, env });
  const access = buildAccessControlAudit({ store, env });
  return {
    version: '0.1.27',
    can_market_no_sensitive_starting_point: true,
    can_accept_redacted_sample_uploads: String(env.ALLOW_REDACTED_SAMPLE_UPLOADS || 'true').toLowerCase() !== 'false',
    can_accept_live_sensitive_uploads: readiness.ready_for_live_sensitive_taxpayer_documents,
    can_release_print_ready_forms: readiness.controls.find((c) => c.key === 'official_form_output_gates')?.ok || false,
    blockers: [...readiness.blockers, ...access.blockers.map((label) => ({ key: 'access_control_detail', label, severity: 'high', fix: 'Resolve access-control blocker before public live sensitive launch.' }))],
    next_safe_marketing_mode: readiness.ready_for_live_sensitive_taxpayer_documents ? 'controlled_live_sensitive_upload_pilot_after_final_owner_review' : 'market_free_starting_point_and_no-sensitive/private-pilot flows only',
    message: 'Market the free starting point and appointment/reassurance products before full live sensitive uploads. Do not market real document upload or print-ready official filing output until all gates pass.'
  };
}

function buildStaffSecurityGoLiveChecklist({ store = null, env = process.env } = {}) {
  const readiness = buildProductionSecurityReadiness({ store, env });
  const checklist = WISP_READINESS_CHECKLIST.map((item) => {
    const status = readiness.controls.find((c) => c.key === item.key) || controlStatus({ ...item, severity: 'high', requiredFor: [] }, store, env);
    return { ...item, status: status.ok ? 'complete_or_configured' : 'not_complete', latest_status: status.latest_status, fix: status.fix || 'Record completion or configure the required control.' };
  });
  return {
    version: '0.1.27',
    summary: {
      complete: checklist.filter((c) => c.status === 'complete_or_configured').length,
      total: checklist.length,
      ready_for_live_sensitive_uploads: readiness.ready_for_live_sensitive_taxpayer_documents
    },
    checklist,
    staff_actions: [
      'Use /api/staff/production-security/:statusKey to record security checklist status updates.',
      'Keep ALLOW_SENSITIVE_DOCUMENT_UPLOADS=false until every critical/high blocker is resolved.',
      'Run final smoke tests for blocked upload path and redacted/sample upload path before any public campaign.'
    ],
    readiness
  };
}

module.exports = {
  SENSITIVE_DATA_CLASSES,
  PRODUCTION_SECURITY_CONTROLS,
  WISP_READINESS_CHECKLIST,
  buildProductionSecurityReadiness,
  buildSensitiveDataHandlingRunbook,
  buildAccessControlAudit,
  buildSecurityLaunchBlockers,
  buildStaffSecurityGoLiveChecklist
};
