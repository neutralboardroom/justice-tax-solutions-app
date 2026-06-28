const crypto = require('crypto');

function boolEnv(name, env = process.env) {
  return String(env[name] || '').toLowerCase() === 'true';
}

function hasRealValue(name, env = process.env) {
  const value = String(env[name] || '').trim();
  if (!value) return false;
  return !/^(dev|test|change-me|placeholder|your-|example|demo|replace_with)/i.test(value);
}

function envValue(name, env = process.env) {
  return String(env[name] || '').trim();
}

function envAny(names = [], env = process.env) {
  return names.some((name) => hasRealValue(name, env) || boolEnv(name, env));
}

const DATABASE_ADAPTERS = [
  {
    key: 'json-local',
    label: 'Encrypted local JSON development store',
    liveUse: false,
    plain: 'Kept for local demos, redacted/sample testing, and fast build iteration. It is not the production system of record.',
    requiredEnv: ['DATA_DIR', 'UPLOAD_DIR', 'DOCUMENT_ENCRYPTION_KEY'],
    setup: ['npm install', 'npm run check', 'npm start'],
    blockers: ['Container disk may be ephemeral', 'No managed backup/restore', 'No concurrent multi-instance writes', 'Not appropriate for live taxpayer data']
  },
  {
    key: 'postgres',
    label: 'Managed PostgreSQL adapter path',
    liveUse: true,
    plain: 'Production path for cases, users, review records, referral ledgers, consent logs, scan events, and form-mapping status.',
    requiredEnv: ['DATABASE_URL'],
    setup: ['Create Render PostgreSQL', 'Set DATABASE_URL on the web service', 'Run psql "$DATABASE_URL" -f db/postgres-schema.sql', 'Smoke test /health and /api/platform/database-adapters'],
    blockers: []
  }
];

const STORAGE_PROVIDERS = [
  {
    key: 'encrypted-local',
    label: 'Encrypted local starter storage',
    liveUse: false,
    plain: 'Good enough for local testing and redacted/sample documents, not for live taxpayer document operations.',
    requiredEnv: ['DOCUMENT_ENCRYPTION_KEY'],
    blockers: ['No private bucket', 'No lifecycle policy', 'No malware quarantine workflow', 'Container disk may be ephemeral on hosting platforms']
  },
  {
    key: 's3-private',
    label: 'AWS S3 private bucket',
    liveUse: true,
    plain: 'Recommended production path if configured with private buckets, encryption, lifecycle rules, least privilege, malware scanning, and access logs.',
    requiredEnv: ['DOCUMENT_STORAGE_PROVIDER=s3', 'S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    blockers: []
  },
  {
    key: 'r2-private',
    label: 'Cloudflare R2 private bucket',
    liveUse: true,
    plain: 'Can work for production if access is private, audit logging and malware scanning are handled, and signed access is short-lived.',
    requiredEnv: ['DOCUMENT_STORAGE_PROVIDER=r2', 'R2_BUCKET', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    blockers: []
  },
  {
    key: 'gcs-private',
    label: 'Google Cloud Storage private bucket',
    liveUse: true,
    plain: 'Can work for production if private IAM, encryption, lifecycle, logging, and malware scanning are configured.',
    requiredEnv: ['DOCUMENT_STORAGE_PROVIDER=gcs', 'GCS_BUCKET', 'GOOGLE_APPLICATION_CREDENTIALS_JSON or workload identity'],
    blockers: []
  }
];

const STORAGE_ADAPTER_INTERFACE = {
  version: '0.1.27',
  active_mode: 'planning-and-gating',
  purpose: 'Keep uploads source-linked, access-logged, scan-gated, and private before live taxpayer document handling.',
  required_methods: [
    { method: 'putObject(caseId, file, metadata)', rule: 'Store encrypted/private object and return provider key, checksum, size, and quarantine status.' },
    { method: 'getObject(document, actor)', rule: 'Require permission check, clean malware status, short-lived access, and access log.' },
    { method: 'deleteOrRetainObject(document, policy)', rule: 'Support retention/legal-hold/deletion policy rather than simple public deletion.' },
    { method: 'signDownload(document, actor)', rule: 'Create short-lived signed URL only after permission and malware gate pass.' },
    { method: 'auditAccess(action, payload)', rule: 'Write non-sensitive access events without exposing storage paths or taxpayer data.' }
  ],
  live_rules: [
    'Never expose bucket keys, storage paths, or signed URLs on public pages.',
    'Never preview or download unscanned live uploads for staff.',
    'Keep local encrypted storage only for development and redacted/sample documents.',
    'Client and reviewer verification must happen before extracted values affect forms, agency responses, or payment/debt decisions.'
  ]
};

const MALWARE_SCAN_PROVIDERS = [
  { key: 'disabled', label: 'No scanner configured', liveUse: false, plain: 'Blocks live sensitive uploads. Redacted/sample uploads may be allowed for private demo only.' },
  { key: 'clamav', label: 'ClamAV service', liveUse: true, plain: 'Use a private scanner service before staff previews or downloads uploaded files.' },
  { key: 'opswat', label: 'OPSWAT / MetaDefender style API', liveUse: true, plain: 'Useful for API-based file scanning and quarantine workflows.' },
  { key: 'cloud-native', label: 'Cloud-native object storage scanner', liveUse: true, plain: 'Scan files immediately after upload, quarantine until clean, and log scan results.' }
];

const MALWARE_QUARANTINE_WORKFLOW = [
  { step: 1, key: 'upload_received', owner: 'platform', statusWhenNoProvider: 'sample_only_allowed', rule: 'Accept only redacted/sample uploads unless live gates pass.' },
  { step: 2, key: 'checksum_recorded', owner: 'platform', statusWhenNoProvider: 'available', rule: 'Record SHA-256 and basic file metadata before any staff use.' },
  { step: 3, key: 'quarantine_default', owner: 'platform', statusWhenNoProvider: 'quarantined', rule: 'Treat live sensitive uploads as quarantined until scan result is clean.' },
  { step: 4, key: 'provider_scan', owner: 'malware adapter', statusWhenNoProvider: 'blocked', rule: 'Send object/buffer to configured scanner and store provider result.' },
  { step: 5, key: 'clean_release', owner: 'staff/professional gate', statusWhenNoProvider: 'blocked', rule: 'Allow staff preview/download only after clean scan plus role permission.' },
  { step: 6, key: 'unsafe_file_response', owner: 'staff', statusWhenNoProvider: 'manual_remediation', rule: 'Block file, notify staff, do not email sensitive details, request safe replacement through the dashboard.' }
];

const EMAIL_TEMPLATES = [
  {
    key: 'verify_email',
    label: 'Verify your email',
    subject: 'Verify your Justice Tax Solutions email',
    trigger: 'Account signup or resend verification',
    plain: 'Short, calm verification email with no tax details in the subject line.',
    noSensitiveDetails: true
  },
  {
    key: 'password_reset',
    label: 'Reset your password',
    subject: 'Reset your Justice Tax Solutions password',
    trigger: 'Password reset request',
    plain: 'Security-first password reset email; never includes tax details.',
    noSensitiveDetails: true
  },
  {
    key: 'case_started',
    label: 'Your tax concern summary was started',
    subject: 'Your Justice Tax Solutions starting summary is ready',
    trigger: 'Successful intake',
    plain: 'Confirms the case was created and tells the client to review the dashboard checklist.',
    noSensitiveDetails: true
  },
  {
    key: 'document_needed',
    label: 'Document reminder',
    subject: 'A document may be needed for your tax review',
    trigger: 'Staff checklist or missing item reminder',
    plain: 'Uses generic language and points to the dashboard instead of requesting sensitive documents by email.',
    noSensitiveDetails: true
  },
  {
    key: 'review_requested',
    label: 'Human review requested',
    subject: 'Your human tax review request was received',
    trigger: 'Client requests paid or human review',
    plain: 'Explains next steps, payment/review status, and that filing or agency response requires professional review.',
    noSensitiveDetails: true
  },
  {
    key: 'review_released',
    label: 'Review summary released',
    subject: 'Your review summary is available',
    trigger: 'Staff releases approved review output',
    plain: 'Tells the client to sign in to view results; does not include sensitive tax findings in email.',
    noSensitiveDetails: true
  },
  {
    key: 'staff_urgent_case',
    label: 'Staff urgent case alert',
    subject: 'Urgent tax case needs review',
    trigger: 'High-risk notice/debt/intake event',
    plain: 'Internal alert for staff without full taxpayer details in email.',
    noSensitiveDetails: true
  },
  {
    key: 'referral_started',
    label: 'Referral started',
    subject: 'A referred client started with Justice Tax Solutions',
    trigger: 'Tracked referral start or paid eligible referral',
    plain: 'Partner-safe referral notification without taxpayer details.',
    noSensitiveDetails: true
  }
];

const TRANSACTIONAL_EMAIL_DELIVERY_POLICY = {
  allowed_providers: ['resend', 'sendgrid', 'smtp'],
  required_before_live: ['Provider key/host configured', 'SPF/DKIM/DMARC or authenticated sending domain', 'Password reset tested', 'Email verification tested', 'No sensitive taxpayer facts in email subject/body'],
  dashboard_rule: 'Email may say that an update is available, but the client should sign in to the dashboard to view tax details or documents.',
  staff_rule: 'Staff alerts should identify urgency and case ID, not full SSNs, account numbers, notice images, or detailed tax facts.'
};

const STAFF_APPROVAL_MFA_POLICY = {
  version: '0.1.27',
  staff_signup_rule: 'Staff/professional accounts should remain pending until approved by owner/admin or created by staff invite code.',
  mfa_status: 'planned_interface_not_enforced',
  recommended_mfa_order: ['owner/admin', 'staff users', 'professionals', 'community partners with referral-only access'],
  live_blockers_until_done: ['Verified professional registry', 'Least-privilege roles', 'Staff approval workflow', 'MFA or compensating control for staff/professional access', 'Audit-log review procedure'],
  permissions_rule: 'Public clients only see their own cases and documents. Staff/professionals see case materials only when role and assignment allow it.'
};

const PILOT_STAGE_GATES = [
  {
    key: 'internal_demo',
    label: 'Internal demo only',
    clientPromise: 'Use fake, redacted, or sample data only.',
    required: ['App starts', '/health ok', 'npm run check passes', 'Sensitive live uploads blocked'],
    sensitiveUploads: false,
    paidUsers: false
  },
  {
    key: 'private_pilot_no_sensitive_uploads',
    label: 'Private pilot without sensitive uploads',
    clientPromise: 'Invite-only testing with redacted/sample notices and plain-language workflows.',
    required: ['Referral/dashboard/intake tested', 'Sample-upload acknowledgment', 'Owner/staff review procedure', 'No live sensitive documents'],
    sensitiveUploads: false,
    paidUsers: false
  },
  {
    key: 'controlled_paid_pilot',
    label: 'Controlled paid pilot',
    clientPromise: 'Limited paid cases with human/professional review and strict release gates.',
    required: ['Managed PostgreSQL', 'Stripe webhook', 'Transactional email', 'Verified professional reviewer', 'Private storage and malware scanning for any sensitive upload'],
    sensitiveUploads: 'only_after_all_upload_gates_pass',
    paidUsers: true
  },
  {
    key: 'public_live_launch',
    label: 'Public live launch',
    clientPromise: 'Public-facing service with production security, support, compliance, and reviewer operations.',
    required: ['Everything in controlled paid pilot', 'Documented WISP/procedures', 'Official form QA where used', 'E-file/professional procedures', 'Support/refund/escalation operations'],
    sensitiveUploads: 'allowed_only_when_configured',
    paidUsers: true
  }
];

const RENDER_DEPLOYMENT_CHECKLIST = [
  { key: 'github_repo', label: 'Create GitHub repository', plain: 'Push the clean ZIP contents to a private repository first, then make public only if intended.', env: '' },
  { key: 'render_web_service', label: 'Create Render web service', plain: 'Use Node 20+, build command npm install, start command npm start.', env: '' },
  { key: 'render_postgres', label: 'Attach Render PostgreSQL', plain: 'Create a managed Postgres database and set DATABASE_URL on the web service. Apply db/postgres-schema.sql before live use.', env: 'DATABASE_URL' },
  { key: 'session_secret', label: 'Set JWT/session secret', plain: 'Use a long random value. Do not use the dev default.', env: 'JWT_SECRET' },
  { key: 'admin_token', label: 'Set admin token', plain: 'Use a strong owner-only token; rotate after setup.', env: 'ADMIN_TOKEN' },
  { key: 'public_url', label: 'Set public base URL', plain: 'Use the final Render URL or custom domain with HTTPS.', env: 'PUBLIC_BASE_URL' },
  { key: 'document_key', label: 'Set document encryption key', plain: 'Use a long random key even when object storage is configured.', env: 'DOCUMENT_ENCRYPTION_KEY' },
  { key: 'private_storage', label: 'Configure private object storage', plain: 'Do this before live sensitive taxpayer document uploads.', env: 'DOCUMENT_STORAGE_PROVIDER' },
  { key: 'malware_scanning', label: 'Configure malware scanning', plain: 'Do this before staff downloads or previews live uploads.', env: 'MALWARE_SCANNING_PROVIDER' },
  { key: 'email', label: 'Configure transactional email', plain: 'Use Resend, SendGrid, SMTP, or equivalent with SPF/DKIM/DMARC.', env: 'RESEND_API_KEY or SENDGRID_API_KEY or SMTP_HOST' },
  { key: 'stripe', label: 'Configure Stripe live keys and webhook', plain: 'Use live keys only after pricing, refund, and referral rules are final.', env: 'STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET' },
  { key: 'staff_mfa', label: 'Approve staff and enable staff/professional MFA plan', plain: 'Before live documents, staff/professional access must be approved and protected by MFA or an equivalent control.', env: 'STAFF_MFA_REQUIRED' },
  { key: 'live_flags', label: 'Set live flags intentionally', plain: 'Keep LIVE_PAYING_USERS_ENABLED and ALLOW_SENSITIVE_DOCUMENT_UPLOADS false until all blockers pass.', env: 'LIVE_PAYING_USERS_ENABLED / ALLOW_SENSITIVE_DOCUMENT_UPLOADS' }
];

function currentStorageProvider(env = process.env) {
  const provider = envValue('DOCUMENT_STORAGE_PROVIDER', env).toLowerCase();
  if (provider === 's3') return STORAGE_PROVIDERS.find((p) => p.key === 's3-private');
  if (provider === 'r2') return STORAGE_PROVIDERS.find((p) => p.key === 'r2-private');
  if (provider === 'gcs') return STORAGE_PROVIDERS.find((p) => p.key === 'gcs-private');
  return STORAGE_PROVIDERS.find((p) => p.key === 'encrypted-local');
}

function currentMalwareProvider(env = process.env) {
  const provider = envValue('MALWARE_SCANNING_PROVIDER', env).toLowerCase();
  if (provider === 'clamav') return MALWARE_SCAN_PROVIDERS.find((p) => p.key === 'clamav');
  if (provider === 'opswat' || provider === 'metadefender') return MALWARE_SCAN_PROVIDERS.find((p) => p.key === 'opswat');
  if (provider === 'cloud-native' || provider === 's3-event' || provider === 'object-storage') return MALWARE_SCAN_PROVIDERS.find((p) => p.key === 'cloud-native');
  if (boolEnv('MALWARE_SCANNING_CONFIGURED', env)) return { key: 'configured-external', label: 'External scanner configured', liveUse: true, plain: 'External malware scanning is marked configured by environment flag.' };
  return MALWARE_SCAN_PROVIDERS.find((p) => p.key === 'disabled');
}

function databaseAdapterStatus(env = process.env) {
  const postgresReady = hasRealValue('DATABASE_URL', env);
  const preferred = envValue('DATA_ADAPTER', env).toLowerCase() || (postgresReady ? 'postgres' : 'json-local');
  const active = preferred === 'postgres' && postgresReady ? 'postgres' : 'json-local';
  return {
    active,
    requested: preferred,
    database_url_present: postgresReady,
    schema_file: 'db/postgres-schema.sql',
    migration_command: 'psql "$DATABASE_URL" -f db/postgres-schema.sql',
    safe_for_live_sensitive_documents: active === 'postgres',
    adapters: DATABASE_ADAPTERS,
    warning: active === 'postgres' ? 'DATABASE_URL is present. Confirm migrations, backups, least-privilege credentials, and connection pooling before live launch.' : 'Local JSON storage is active. Keep live sensitive taxpayer document handling blocked.'
  };
}

function storageAdapterStatus(env = process.env) {
  const provider = currentStorageProvider(env);
  const expectedEnv = provider.requiredEnv || [];
  const configured = provider.liveUse && expectedEnv.every((entry) => {
    if (entry.includes('=')) {
      const [name, expected] = entry.split('=');
      return envValue(name.trim(), env).toLowerCase() === String(expected || '').toLowerCase();
    }
    if (entry.includes(' or ')) return entry.split(' or ').some((name) => hasRealValue(name.trim(), env));
    return hasRealValue(entry.trim(), env);
  });
  return {
    current_provider: provider,
    configured_for_private_live_storage: configured || boolEnv('SECURE_OBJECT_STORAGE_CONFIGURED', env),
    adapter_interface: STORAGE_ADAPTER_INTERFACE,
    live_blockers: provider.liveUse ? (configured ? [] : ['Provider selected but one or more required storage environment values are missing.']) : provider.blockers,
    signed_download_rule: 'Signed document access must be short-lived, permission-gated, malware-clean, and access-logged.'
  };
}

function emailProviderStatus(env = process.env) {
  const provider = hasRealValue('RESEND_API_KEY', env) ? 'resend' : hasRealValue('SENDGRID_API_KEY', env) ? 'sendgrid' : hasRealValue('SMTP_HOST', env) ? 'smtp' : '';
  const domainConfigured = boolEnv('EMAIL_DOMAIN_AUTHENTICATED', env) || boolEnv('SPF_DKIM_DMARC_CONFIGURED', env);
  return {
    configured: Boolean(provider),
    provider: provider || 'not_configured',
    domain_authenticated: domainConfigured,
    safe_for_live: Boolean(provider && domainConfigured),
    delivery_policy: TRANSACTIONAL_EMAIL_DELIVERY_POLICY,
    rule: 'Live users need reliable transactional email for verification, resets, review updates, and staff alerts. Do not put sensitive taxpayer facts in email bodies or subject lines.'
  };
}

function renderChecklistStatus(env = process.env) {
  return RENDER_DEPLOYMENT_CHECKLIST.map((item) => {
    let ok = false;
    if (!item.env) ok = false;
    else if (item.env.includes(' or ')) ok = item.env.split(' or ').some((name) => hasRealValue(name.trim(), env));
    else if (item.env.includes(' + ')) ok = item.env.split(' + ').every((name) => hasRealValue(name.trim(), env));
    else if (item.env.includes(' / ')) ok = item.env.split(' / ').some((name) => envValue(name.trim(), env));
    else ok = hasRealValue(item.env, env) || boolEnv(item.env, env);
    return { ...item, ok };
  });
}

function buildSensitiveUploadPolicy(env = process.env) {
  const liveMode = boolEnv('LIVE_PAYING_USERS_ENABLED', env);
  const allowSensitiveUploads = boolEnv('ALLOW_SENSITIVE_DOCUMENT_UPLOADS', env);
  const sampleUploadsAllowed = envValue('ALLOW_REDACTED_SAMPLE_UPLOADS', env) !== 'false';
  const storageProvider = currentStorageProvider(env);
  const storageStatus = storageAdapterStatus(env);
  const malwareProvider = currentMalwareProvider(env);
  const databaseReady = hasRealValue('DATABASE_URL', env);
  const encryptionReady = hasRealValue('DOCUMENT_ENCRYPTION_KEY', env) || hasRealValue('JWT_SECRET', env);
  const privateStorageReady = storageProvider.liveUse && storageStatus.configured_for_private_live_storage;
  const malwareReady = malwareProvider.liveUse || boolEnv('MALWARE_SCANNING_CONFIGURED', env);
  const securityOpsReady = boolEnv('SECURITY_GO_LIVE_APPROVED', env)
    && boolEnv('WISP_APPROVED', env)
    && boolEnv('DATA_RETENTION_POLICY_APPROVED', env)
    && boolEnv('INCIDENT_RESPONSE_PLAN_APPROVED', env)
    && boolEnv('BACKUP_RESTORE_TESTED', env)
    && (boolEnv('STAFF_MFA_REQUIRED', env) || boolEnv('MFA_REQUIRED', env))
    && envValue('REQUIRE_STAFF_APPROVAL', env) !== 'false';
  const acceptLiveSensitive = Boolean(liveMode && allowSensitiveUploads && databaseReady && encryptionReady && privateStorageReady && malwareReady && securityOpsReady);
  return {
    live_mode_enabled: liveMode,
    sensitive_uploads_enabled: allowSensitiveUploads,
    sample_uploads_allowed: sampleUploadsAllowed,
    private_storage_ready: privateStorageReady,
    malware_scanning_ready: malwareReady,
    security_operations_ready: securityOpsReady,
    wisp_approved: boolEnv('WISP_APPROVED', env),
    retention_policy_approved: boolEnv('DATA_RETENTION_POLICY_APPROVED', env),
    incident_response_approved: boolEnv('INCIDENT_RESPONSE_PLAN_APPROVED', env),
    backup_restore_tested: boolEnv('BACKUP_RESTORE_TESTED', env),
    security_go_live_approved: boolEnv('SECURITY_GO_LIVE_APPROVED', env),
    staff_mfa_or_equivalent_ready: boolEnv('STAFF_MFA_REQUIRED', env) || boolEnv('MFA_REQUIRED', env),
    database_ready: databaseReady,
    encryption_ready: encryptionReady,
    current_storage_provider: storageProvider,
    current_malware_provider: malwareProvider,
    storage_adapter_status: storageStatus,
    malware_quarantine_workflow: MALWARE_QUARANTINE_WORKFLOW,
    accept_live_sensitive_documents: acceptLiveSensitive,
    policy: acceptLiveSensitive ? 'Live sensitive upload gates appear configured. Still run operating-procedure review before public launch.' : 'Sensitive taxpayer documents are blocked for public/live use. Redacted sample documents may be allowed only when the client acknowledges they are not uploading real sensitive documents.',
    required_before_live_uploads: ['DATABASE_URL', 'DOCUMENT_ENCRYPTION_KEY', 'private object storage', 'malware scanning', 'staff access controls/MFA', 'approved WISP', 'retention/deletion policy', 'incident-response plan', 'backup/restore test', 'owner security go-live approval']
  };
}

function validateSensitiveUploadRequest(input = {}, bodyOrEnv = {}, maybeEnv = process.env) {
  let hasFiles = false;
  let sampleAcknowledged = false;
  let env = process.env;
  if (Array.isArray(input)) {
    const body = bodyOrEnv || {};
    hasFiles = input.length > 0;
    sampleAcknowledged = body.sample_documents_only_acknowledged === true
      || body.sample_documents_only_acknowledged === 'on'
      || body.sample_documents_only_acknowledged === 'true'
      || body.sampleDocumentAcknowledgment === true
      || body.sampleDocumentAcknowledgment === 'true';
    env = maybeEnv || process.env;
  } else {
    hasFiles = Boolean(input.hasFiles || input.has_files || input.file_count || input.files);
    sampleAcknowledged = Boolean(input.sampleAcknowledged || input.sample_acknowledged || input.sample_documents_only_acknowledged || input.sampleDocumentAcknowledgment);
    env = bodyOrEnv && typeof bodyOrEnv === 'object' && !Array.isArray(bodyOrEnv) && (bodyOrEnv.NODE_ENV || bodyOrEnv.DATABASE_URL || bodyOrEnv.DOCUMENT_STORAGE_PROVIDER) ? bodyOrEnv : maybeEnv;
  }
  const policy = buildSensitiveUploadPolicy(env);
  if (!hasFiles) return { ok: true, policy, mode: 'no_files', upload_mode: 'no_files' };
  if (policy.accept_live_sensitive_documents) return { ok: true, policy, mode: 'live_sensitive_upload_allowed', upload_mode: 'live_sensitive_upload_allowed' };
  if (policy.sample_uploads_allowed && sampleAcknowledged) {
    return { ok: true, policy, mode: 'redacted_sample_only', upload_mode: 'redacted_sample_only', warning: 'Redacted/sample upload accepted for private demo/testing. Do not upload real SSNs, full account numbers, W-2s, 1099s, notices, transcripts, or returns until production gates pass.' };
  }
  return {
    ok: false,
    policy,
    mode: 'blocked',
    upload_mode: 'blocked',
    error: 'Live sensitive taxpayer document uploads are not enabled. Please remove documents or confirm you are uploading only redacted/sample documents for demo/testing.'
  };
}

async function scanUploadBuffer(file, env = process.env) {
  const provider = currentMalwareProvider(env);
  const digest = crypto.createHash('sha256').update(file.buffer || Buffer.alloc(0)).digest('hex');
  if (provider.liveUse) {
    return {
      ok: true,
      status: 'scan_provider_configured_pending_or_clean',
      provider: provider.key,
      quarantine_status: 'pending_clean_result_before_staff_download',
      sha256: digest,
      rule: 'Production adapter placeholder. A real scanner should quarantine until the provider returns clean.'
    };
  }
  return {
    ok: false,
    status: 'not_scanned',
    provider: provider.key,
    quarantine_status: 'blocked_for_live_use',
    sha256: digest,
    rule: 'No malware scanner configured. Live sensitive uploads should be blocked; redacted/sample files can be used only for demos.'
  };
}

function staffApprovalMfaStatus(store = null, env = process.env) {
  const users = store && store.list ? store.list('users', (u) => !u.deleted_at) : [];
  const professionals = store && store.list ? store.list('professionals', (p) => !p.deleted_at) : [];
  const staffUsers = users.filter((u) => ['staff','admin','owner','professional','human_tax_specialist'].includes(String(u.role || '').toLowerCase()));
  const pendingStaff = staffUsers.filter((u) => !['approved','verified','active'].includes(String(u.staff_status || u.status || '').toLowerCase()));
  const verifiedPros = professionals.filter((p) => ['verified','approved','active'].includes(String(p.credential_status || p.status || '').toLowerCase()) || Number(p.compliance_score || 0) >= 70);
  const mfaRequired = boolEnv('STAFF_MFA_REQUIRED', env) || boolEnv('MFA_REQUIRED', env);
  return {
    policy: STAFF_APPROVAL_MFA_POLICY,
    require_staff_approval: envValue('REQUIRE_STAFF_APPROVAL', env) !== 'false',
    staff_signup_code_configured: hasRealValue('STAFF_SIGNUP_CODE', env),
    staff_mfa_required: mfaRequired,
    approved_or_active_staff_count: staffUsers.length - pendingStaff.length,
    pending_staff_count: pendingStaff.length,
    verified_professional_count: verifiedPros.length,
    ready_for_live_sensitive_documents: mfaRequired && pendingStaff.length === 0 && verifiedPros.length > 0,
    blockers: [
      ...(mfaRequired ? [] : ['Staff/professional MFA is not marked required.']),
      ...(pendingStaff.length ? ['One or more staff/professional accounts still need approval.'] : []),
      ...(verifiedPros.length ? [] : ['No verified professional reviewer is recorded.'])
    ]
  };
}

function pilotStageGateReport({ store = null, configuredVendors = [], env = process.env } = {}) {
  const uploadPolicy = buildSensitiveUploadPolicy(env);
  const db = databaseAdapterStatus(env);
  const storage = storageAdapterStatus(env);
  const email = emailProviderStatus(env);
  const staff = staffApprovalMfaStatus(store, env);
  const stripeReady = hasRealValue('STRIPE_SECRET_KEY', env) && hasRealValue('STRIPE_WEBHOOK_SECRET', env);
  const baseChecks = {
    health_check_expected: true,
    database_ready: db.safe_for_live_sensitive_documents,
    private_storage_ready: storage.configured_for_private_live_storage,
    malware_ready: uploadPolicy.malware_scanning_ready,
    email_ready: email.safe_for_live,
    stripe_ready: stripeReady,
    professional_ready: staff.verified_professional_count > 0,
    staff_mfa_ready: staff.staff_mfa_required,
    ai_vendor_ready: configuredVendors.length > 0,
    sensitive_uploads_blocked_or_ready: !uploadPolicy.sensitive_uploads_enabled || uploadPolicy.accept_live_sensitive_documents
  };
  const stageRows = PILOT_STAGE_GATES.map((stage) => {
    let blockers = [];
    if (stage.key === 'internal_demo') {
      if (!baseChecks.sensitive_uploads_blocked_or_ready) blockers.push('Sensitive-upload flags are inconsistent; keep live uploads blocked or fully configure all gates.');
    }
    if (stage.key === 'private_pilot_no_sensitive_uploads') {
      if (uploadPolicy.accept_live_sensitive_documents) blockers.push('Private no-sensitive pilot should not accept live sensitive documents.');
    }
    if (stage.key === 'controlled_paid_pilot') {
      if (!baseChecks.database_ready) blockers.push('Managed PostgreSQL/DATABASE_URL not configured.');
      if (!baseChecks.email_ready) blockers.push('Transactional email/domain authentication not ready.');
      if (!baseChecks.stripe_ready) blockers.push('Stripe live checkout/webhook not ready.');
      if (!baseChecks.professional_ready) blockers.push('No verified professional reviewer recorded.');
      if (uploadPolicy.sensitive_uploads_enabled && (!baseChecks.private_storage_ready || !baseChecks.malware_ready)) blockers.push('Sensitive uploads require private storage and malware scanning.');
    }
    if (stage.key === 'public_live_launch') {
      if (!baseChecks.database_ready) blockers.push('Managed PostgreSQL/DATABASE_URL not configured.');
      if (!baseChecks.private_storage_ready) blockers.push('Private object storage not configured.');
      if (!baseChecks.malware_ready) blockers.push('Malware scanning not configured.');
      if (!baseChecks.email_ready) blockers.push('Transactional email/domain authentication not ready.');
      if (!baseChecks.stripe_ready) blockers.push('Stripe live checkout/webhook not ready.');
      if (!baseChecks.professional_ready) blockers.push('No verified professional reviewer recorded.');
      if (!baseChecks.staff_mfa_ready) blockers.push('Staff/professional MFA or equivalent control not marked required.');
      if (!baseChecks.ai_vendor_ready) blockers.push('No AI vendor configured; fallback summaries only.');
    }
    return { ...stage, allowed_now: blockers.length === 0, blockers };
  });
  const recommended = stageRows.find((s) => !s.allowed_now) ? stageRows.slice().reverse().find((s) => s.allowed_now) || stageRows[0] : stageRows[stageRows.length - 1];
  return {
    stages: stageRows,
    recommended_stage: recommended,
    base_checks: baseChecks,
    policy: 'Do not blur demo readiness with production readiness. Move forward only when the next stage has no blockers.'
  };
}

function buildProductionConfigReport({ store = null, configuredVendors = [] } = {}) {
  const database = databaseAdapterStatus();
  const uploadPolicy = buildSensitiveUploadPolicy();
  const storage = storageAdapterStatus();
  const email = emailProviderStatus();
  const staff = staffApprovalMfaStatus(store);
  const pilot = pilotStageGateReport({ store, configuredVendors });
  const render = renderChecklistStatus();
  const blockers = [];
  if (!uploadPolicy.database_ready) blockers.push('Managed PostgreSQL/DATABASE_URL not configured.');
  if (!uploadPolicy.private_storage_ready) blockers.push('Private object storage is not configured for live taxpayer documents.');
  if (!uploadPolicy.malware_scanning_ready) blockers.push('Malware scanning provider is not configured.');
  if (!email.safe_for_live) blockers.push('Transactional email and domain authentication are not ready for live users.');
  if (!hasRealValue('STRIPE_SECRET_KEY') || !hasRealValue('STRIPE_WEBHOOK_SECRET')) blockers.push('Stripe live checkout/webhook is not fully configured.');
  if (!staff.verified_professional_count) blockers.push('No verified professional reviewer is recorded.');
  if (!staff.staff_mfa_required) blockers.push('Staff/professional MFA is not marked required yet.');
  if (!configuredVendors.length) blockers.push('No AI vendor is configured; fallback summaries only.');
  return {
    version: '0.1.27',
    stage: blockers.length ? 'production_configuration_incomplete' : 'production_configuration_ready_for_controlled_pilot',
    live_sensitive_uploads_allowed: uploadPolicy.accept_live_sensitive_documents,
    database_adapter: database,
    upload_policy: uploadPolicy,
    storage_adapter: storage,
    storage_adapters: STORAGE_PROVIDERS,
    malware_scan_providers: MALWARE_SCAN_PROVIDERS,
    malware_quarantine_workflow: MALWARE_QUARANTINE_WORKFLOW,
    email_provider: email,
    email_templates: EMAIL_TEMPLATES,
    transactional_email_delivery_policy: TRANSACTIONAL_EMAIL_DELIVERY_POLICY,
    staff_approval_mfa: staff,
    pilot_stage_gates: pilot,
    render_deployment_checklist: render,
    verified_professional_count: staff.verified_professional_count,
    ai_vendors_configured: configuredVendors,
    blockers,
    next_safe_step: blockers.length ? 'Keep the site in internal demo/private pilot mode and collect no real sensitive taxpayer documents through the platform.' : 'Run controlled paid-pilot tests with strict staff/professional review and audit logging before public launch.'
  };
}

module.exports = {
  DATABASE_ADAPTERS,
  STORAGE_PROVIDERS,
  STORAGE_ADAPTER_INTERFACE,
  MALWARE_SCAN_PROVIDERS,
  MALWARE_QUARANTINE_WORKFLOW,
  EMAIL_TEMPLATES,
  TRANSACTIONAL_EMAIL_DELIVERY_POLICY,
  STAFF_APPROVAL_MFA_POLICY,
  PILOT_STAGE_GATES,
  RENDER_DEPLOYMENT_CHECKLIST,
  boolEnv,
  hasRealValue,
  currentStorageProvider,
  currentMalwareProvider,
  databaseAdapterStatus,
  storageAdapterStatus,
  emailProviderStatus,
  renderChecklistStatus,
  buildSensitiveUploadPolicy,
  validateSensitiveUploadRequest,
  scanUploadBuffer,
  staffApprovalMfaStatus,
  pilotStageGateReport,
  buildProductionConfigReport
};
