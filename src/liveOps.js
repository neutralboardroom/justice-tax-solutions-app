const CLIENT_CONSENT_MODEL = [
  {
    key: 'terms_accepted',
    label: 'I agree to the Terms, Privacy Policy, Refund Policy, Disclaimer, and Security notice.',
    requiredFor: ['all_cases', 'paid_review', 'document_upload'],
    publicText: 'Required before a case is created.'
  },
  {
    key: 'not_government_acknowledged',
    label: 'I understand Justice Tax Solutions is not the IRS, New York State, NYC, or a government agency.',
    requiredFor: ['all_cases'],
    publicText: 'Prevents government-confusion risk.'
  },
  {
    key: 'no_guarantee_acknowledged',
    label: 'I understand no refund, tax reduction, payment plan, penalty relief, OIC, audit result, or agency outcome is guaranteed.',
    requiredFor: ['all_cases', 'paid_review'],
    publicText: 'Required for every tax-problem or review workflow.'
  },
  {
    key: 'ai_limitations_acknowledged',
    label: 'I understand AI may organize information but human/professional review is required before filing, signing, or responding to a tax agency.',
    requiredFor: ['all_cases', 'return_prep', 'agency_response'],
    publicText: 'Keeps AI as organizer, not unchecked preparer.'
  },
  {
    key: 'document_upload_acknowledged',
    label: 'I am uploading copies only and understand uploaded tax documents contain sensitive information.',
    requiredFor: ['document_upload'],
    publicText: 'Required when files are uploaded.'
  },
  {
    key: 'not_emergency_acknowledged',
    label: 'I understand this is not emergency same-day agency representation and I should seek immediate professional help for levy, garnishment, court, criminal, or same-day deadline emergencies.',
    requiredFor: ['high_risk', 'tax_debt', 'notice_help'],
    publicText: 'Required safety warning for urgent tax concerns.'
  }
];

const LIVE_PAYING_USER_CHECKLIST = [
  { key: 'managed_database', label: 'Render PostgreSQL or other managed database is configured and backed up.', env: 'DATABASE_URL', required: true },
  { key: 'strong_session_secret', label: 'Strong JWT/session secret is configured.', env: 'JWT_SECRET', required: true },
  { key: 'document_encryption_key', label: 'Dedicated document encryption key is configured.', env: 'DOCUMENT_ENCRYPTION_KEY', required: true },
  { key: 'private_storage', label: 'Private object storage or equivalent secure document storage is configured.', env: 'SECURE_OBJECT_STORAGE_CONFIGURED', expected: 'true', required: true },
  { key: 'malware_scanning', label: 'Malware scanning is configured for tax document uploads.', env: 'MALWARE_SCANNING_CONFIGURED', expected: 'true', required: true },
  { key: 'stripe_live_webhooks', label: 'Stripe live checkout and signed webhooks are configured.', env: 'STRIPE_WEBHOOK_SECRET', required: true },
  { key: 'owner_notifications', label: 'Owner/staff notification email or provider is configured.', env: 'OWNER_EMAIL', required: true },
  { key: 'email_delivery', label: 'Email verification/password reset delivery is configured.', anyEnv: ['SMTP_HOST', 'RESEND_API_KEY', 'SENDGRID_API_KEY'], required: true },
  { key: 'staff_approval', label: 'Staff signup code or explicit approval gate is configured.', anyEnv: ['STAFF_SIGNUP_CODE', 'REQUIRE_STAFF_APPROVAL'], required: true },
  { key: 'professional_roster', label: 'At least one verified preparer/professional is active in the roster.', runtime: 'verified_professional', required: true },
  { key: 'ptin_ny_compliance', label: 'PTIN / NYTPRIN / CPA / EA / tax attorney credential checks are enabled in the workflow.', runtime: 'compliance_workflow', required: true },
  { key: 'official_forms_mapped', label: 'Official form library has at least one verified/mapped form before official output.', runtime: 'verified_official_form_mapping', required: false },
  { key: 'ocr_provider', label: 'Production OCR/document-AI provider is configured, or manual verification-only mode is clearly enforced.', anyEnv: ['OCR_PROVIDER_CONFIGURED', 'TEXTRACT_CONFIGURED', 'GOOGLE_DOCUMENT_AI_CONFIGURED'], required: false },
  { key: 'multi_ai_vendor', label: 'At least one AI vendor key is configured; rule-based fallback remains available.', runtime: 'ai_vendor', required: false },
  { key: 'launch_mode_enabled', label: 'LIVE_PAYING_USERS_ENABLED is set only after the required checks are satisfied.', env: 'LIVE_PAYING_USERS_ENABLED', expected: 'true', required: false }
];

function envOk(item, env = process.env) {
  if (item.env) {
    const value = String(env[item.env] || '');
    if (item.expected !== undefined) return value === item.expected;
    return Boolean(value && !/^dev-|change-me|placeholder/i.test(value));
  }
  if (Array.isArray(item.anyEnv)) {
    return item.anyEnv.some((key) => {
      const value = String(env[key] || '');
      if (key === 'REQUIRE_STAFF_APPROVAL') return value === 'true';
      if (value === 'true') return true;
      return Boolean(value && !/^dev-|change-me|placeholder/i.test(value));
    });
  }
  return false;
}

function buildLiveReadiness({ store, configuredVendors = [] } = {}) {
  const professionals = store && store.list ? store.list('professionals', (p) => !p.deleted_at) : [];
  const verifiedProfessionalCount = professionals.filter((p) => ['verified', 'approved', 'active'].includes(String(p.credential_status || p.status || '').toLowerCase()) || Number(p.compliance_score || 0) >= 70).length;
  const mappings = store && store.list ? store.list('official_form_mappings', (m) => !m.deleted_at) : [];
  const verifiedMappings = mappings.filter((m) => ['verified', 'sample_tested', 'approved_for_limited_use'].includes(String(m.mapping_status || '').toLowerCase()));
  const checks = LIVE_PAYING_USER_CHECKLIST.map((item) => {
    let ok = false;
    if (item.runtime === 'verified_professional') ok = verifiedProfessionalCount > 0;
    else if (item.runtime === 'compliance_workflow') ok = true;
    else if (item.runtime === 'verified_official_form_mapping') ok = verifiedMappings.length > 0;
    else if (item.runtime === 'ai_vendor') ok = Array.isArray(configuredVendors) && configuredVendors.length > 0;
    else ok = envOk(item);
    return { ...item, ok };
  });
  const required = checks.filter((c) => c.required);
  const blocking = required.filter((c) => !c.ok);
  const advisory = checks.filter((c) => !c.required && !c.ok);
  const liveFlag = process.env.LIVE_PAYING_USERS_ENABLED === 'true';
  return {
    ready_for_live_paying_users: blocking.length === 0 && liveFlag,
    safe_for_limited_private_pilot: blocking.filter((c) => !['private_storage', 'malware_scanning'].includes(c.key)).length === 0,
    live_flag_enabled: liveFlag,
    required_passed: required.length - blocking.length,
    required_total: required.length,
    blocking,
    advisory,
    checks,
    launch_policy: liveFlag && blocking.length ? 'LIVE_PAYING_USERS_ENABLED is true but required checks are still failing. Treat as not live-ready.' : (blocking.length ? 'Do not accept live sensitive tax documents or paid filing/review cases yet.' : 'Required checks are satisfied; enable live mode only after owner/professional operating procedures are confirmed.'),
    professional_count: professionals.length,
    verified_professional_count: verifiedProfessionalCount,
    verified_mapping_count: verifiedMappings.length
  };
}

function normalizeBool(value) {
  return value === true || value === 'true' || value === 'on' || value === '1' || value === 'yes';
}

function consentFromBody(body = {}, hasDocuments = false) {
  const consent = {
    terms_accepted: normalizeBool(body.terms_accepted || body.accept_terms || body.agree_terms),
    not_government_acknowledged: normalizeBool(body.not_government_acknowledged || body.not_government || body.no_government),
    no_guarantee_acknowledged: normalizeBool(body.no_guarantee_acknowledged || body.no_guarantee),
    ai_limitations_acknowledged: normalizeBool(body.ai_limitations_acknowledged || body.ai_limitations),
    document_upload_acknowledged: normalizeBool(body.document_upload_acknowledged || body.document_consent || body.upload_consent),
    not_emergency_acknowledged: normalizeBool(body.not_emergency_acknowledged || body.not_emergency)
  };
  consent.has_documents = Boolean(hasDocuments);
  consent.accepted_at = new Date().toISOString();
  return consent;
}

function consentValidation(consent = {}, { hasDocuments = false, pathway = '', riskLevel = '' } = {}) {
  const required = ['terms_accepted', 'not_government_acknowledged', 'no_guarantee_acknowledged', 'ai_limitations_acknowledged'];
  const path = String(pathway || '').toLowerCase();
  const urgentPath = /notice|debt|back|unfiled|levy|lien|tax-debt/.test(path) || String(riskLevel || '').toLowerCase() === 'high';
  if (hasDocuments) required.push('document_upload_acknowledged');
  if (urgentPath) required.push('not_emergency_acknowledged');
  const missing = required.filter((key) => !consent[key]);
  return { ok: missing.length === 0, required, missing, consent_model: CLIENT_CONSENT_MODEL };
}

function buildCaseClientReadiness(taxCase = {}) {
  const blockers = [];
  const warnings = [];
  const consent = taxCase.client_consent || {};
  const validation = consentValidation(consent, { hasDocuments: Number(taxCase.document_count || 0) > 0, pathway: taxCase.pathway, riskLevel: taxCase.risk_level });
  if (!validation.ok) blockers.push(`Missing required acknowledgments: ${validation.missing.join(', ')}`);
  if (!taxCase.email) blockers.push('Client email missing.');
  if (!taxCase.tax_years && /return|debt|notice|back|prior|amended/.test(String(taxCase.pathway || '').toLowerCase())) warnings.push('Tax year should be confirmed before professional review.');
  if (Number(taxCase.document_count || 0) === 0 && taxCase.pathway !== 'not-sure') warnings.push('No documents uploaded yet; review may be limited to a preliminary organizer.');
  if (String(taxCase.risk_level || '').toLowerCase() === 'high') warnings.push('High-risk case. Do not rely on automated output; route to qualified human/professional review.');
  if (!taxCase.client_done_uploading) warnings.push('Client has not marked document upload complete.');
  return {
    case_id: taxCase.id || '',
    ready_for_paid_review_request: blockers.length === 0,
    ready_for_release_review: blockers.length === 0 && Boolean(taxCase.payment_status === 'paid') && Boolean(taxCase.client_approval_status === 'approved'),
    blockers,
    warnings,
    consent_validation: validation,
    next_step: blockers.length ? 'Resolve blockers before taking payment or releasing final output.' : 'Case can proceed to paid review or professional assignment, subject to payment, staff review, and compliance gates.'
  };
}

module.exports = {
  CLIENT_CONSENT_MODEL,
  LIVE_PAYING_USER_CHECKLIST,
  buildLiveReadiness,
  consentFromBody,
  consentValidation,
  buildCaseClientReadiness
};
