function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function envSnapshot() {
  return {
    version: '0.1.56',
    node_env: process.env.NODE_ENV || 'development',
    public_base_url: process.env.PUBLIC_BASE_URL || '',
    owner_email_configured: Boolean(process.env.OWNER_EMAIL),
    jwt_secret_configured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev-change-me-before-production'),
    admin_token_configured: Boolean(process.env.ADMIN_TOKEN),
    staff_signup_code_configured: Boolean(process.env.STAFF_SIGNUP_CODE),
    document_encryption_key_configured: Boolean(process.env.DOCUMENT_ENCRYPTION_KEY && process.env.DOCUMENT_ENCRYPTION_KEY.length >= 32),
    allow_live_sensitive_uploads: bool(process.env.ALLOW_LIVE_SENSITIVE_UPLOADS),
    accept_live_sensitive_documents: bool(process.env.ACCEPT_LIVE_SENSITIVE_DOCUMENTS),
    allow_sample_uploads: !process.env.ALLOW_SAMPLE_UPLOADS || bool(process.env.ALLOW_SAMPLE_UPLOADS),
    custom_domain_verified: bool(process.env.CUSTOM_DOMAIN_VERIFIED),
    ssl_certificate_active: bool(process.env.SSL_CERTIFICATE_ACTIVE),
    database_url_configured: Boolean(process.env.DATABASE_URL),
    private_object_storage_configured: Boolean(process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.GCS_BUCKET || process.env.PRIVATE_OBJECT_STORAGE_BUCKET),
    malware_scanning_configured: Boolean(process.env.CLAMAV_URL || process.env.MALWARE_SCAN_PROVIDER || process.env.VIRUSTOTAL_API_KEY),
    email_provider_configured: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST),
    stripe_live_key_configured: Boolean(process.env.STRIPE_SECRET_KEY && /^sk_live_/i.test(process.env.STRIPE_SECRET_KEY)),
    stripe_webhook_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    staff_mfa_required: bool(process.env.STAFF_MFA_REQUIRED),
    professional_verification_complete: bool(process.env.PROFESSIONAL_VERIFICATION_COMPLETE),
    ptin_roster_reviewed: bool(process.env.PTIN_ROSTER_REVIEWED),
    ny_preparer_registration_reviewed: bool(process.env.NY_PREPARER_REGISTRATION_REVIEWED),
    wisp_approved: bool(process.env.WISP_APPROVED),
    retention_policy_approved: bool(process.env.RETENTION_POLICY_APPROVED),
    incident_response_approved: bool(process.env.INCIDENT_RESPONSE_APPROVED),
    backup_restore_tested: bool(process.env.BACKUP_RESTORE_TESTED),
    security_go_live_approved: bool(process.env.SECURITY_GO_LIVE_APPROVED),
    official_form_output_approved: bool(process.env.OFFICIAL_FORM_OUTPUT_APPROVED),
    form_9465_release_approved: bool(process.env.FORM_9465_RELEASE_APPROVED),
    efile_provider_approved: bool(process.env.EFILE_PROVIDER_APPROVED) || bool(process.env.EFIN_APPROVED)
  };
}

function missing(env, keys) {
  return keys.filter((key) => !env[key]).map((key) => key.replace(/_/g, ' '));
}

function gate(key, label, keys, readyOverride) {
  const env = envSnapshot();
  const ready = typeof readyOverride === 'boolean' ? readyOverride : keys.every((k) => env[k]);
  return { key, label, ready, missing: missing(env, keys) };
}

function buildRealUserLaunchReadiness() {
  const env = envSnapshot();
  const safeNoSensitive = !env.allow_live_sensitive_uploads && !env.accept_live_sensitive_documents && env.allow_sample_uploads;
  const coreSecrets = env.jwt_secret_configured && env.admin_token_configured && env.staff_signup_code_configured && env.document_encryption_key_configured;
  const domain = env.custom_domain_verified && env.ssl_certificate_active && /justicetaxsolutions\.com/i.test(env.public_base_url || '');
  const paymentOps = env.email_provider_configured && env.stripe_live_key_configured && env.stripe_webhook_configured;
  const professionals = env.professional_verification_complete && env.ptin_roster_reviewed && env.ny_preparer_registration_reviewed;
  const security = env.database_url_configured && env.private_object_storage_configured && env.malware_scanning_configured && env.staff_mfa_required && env.wisp_approved && env.retention_policy_approved && env.incident_response_approved && env.backup_restore_tested && env.security_go_live_approved;
  const officialForms = security && professionals && env.official_form_output_approved && env.form_9465_release_approved;
  return {
    version: '0.1.56',
    headline: 'Real-user readiness is limited to a controlled, no-sensitive launch until external production gates are complete.',
    real_users_allowed_now: Boolean(safeNoSensitive && coreSecrets),
    recommended_real_user_mode: safeNoSensitive && coreSecrets ? 'Invite real users into a no-file or redacted/sample-document pilot only.' : 'Do not invite real users until core secrets and no-sensitive upload defaults are confirmed.',
    not_allowed_yet: [
      'Uploading real unredacted taxpayer documents, notices, returns, transcripts, SSNs, EINs, bank details, or payroll files.',
      'Charging live payments before Stripe, webhook, email, refund/failed-payment SOP, and staff follow-up are tested.',
      'Promising PTIN/EA/CPA/tax attorney review before the roster and assignments are verified.',
      'Releasing final official IRS/NYS/NYC forms or claiming e-file/agency submission.',
      'Running broad paid marketing that suggests full production readiness.'
    ],
    gates: [
      { key: 'safe_no_sensitive_mode', label: 'No-sensitive upload gate', ready: safeNoSensitive, missing: safeNoSensitive ? [] : ['live sensitive upload flags must stay off and sample uploads must be allowed'] },
      gate('core_secrets', 'Core secrets for real accounts', ['jwt_secret_configured','admin_token_configured','staff_signup_code_configured','document_encryption_key_configured'], coreSecrets),
      gate('custom_domain', 'Custom domain and HTTPS', ['custom_domain_verified','ssl_certificate_active'], domain),
      gate('email_and_payments', 'Email + Stripe paid-pilot operations', ['email_provider_configured','stripe_live_key_configured','stripe_webhook_configured'], paymentOps),
      gate('professional_roster', 'Verified professional roster and NY scope', ['professional_verification_complete','ptin_roster_reviewed','ny_preparer_registration_reviewed'], professionals),
      gate('taxpayer_data_security', 'Taxpayer-data security for sensitive documents', ['database_url_configured','private_object_storage_configured','malware_scanning_configured','staff_mfa_required','wisp_approved','retention_policy_approved','incident_response_approved','backup_restore_tested','security_go_live_approved'], security),
      gate('official_forms', 'Official form output release', ['official_form_output_approved','form_9465_release_approved'], officialForms),
      gate('efile', 'E-file / EFIN approval before e-file claims', ['efile_provider_approved'], env.efile_provider_approved)
    ],
    user_facing_commitment_now: [
      'We can help real users organize a tax concern, understand possible next steps, and request review without uploading sensitive documents.',
      'Users should start with plain-language facts: agency, notice number, date, deadline, tax year, approximate amount, and what they are worried about.',
      'Users may use redacted/sample documents only if they acknowledge the pilot safety rule.',
      'Staff must route urgent, legal-risk, collection, audit, payroll/sales-tax, business, high-dollar, or signature/filing matters to professional review.'
    ],
    owner_decision: safeNoSensitive && coreSecrets ? 'Ready for first real users only under controlled no-sensitive pilot rules.' : 'Not ready to invite real users until core secrets and safe upload gate are verified.'
  };
}

function buildFirstRealUserOperatingPlan() {
  const readiness = buildRealUserLaunchReadiness();
  return {
    version: '0.1.56',
    title: 'First real-user operating plan',
    recommended_cohort: 'Start with 5 to 20 invited users who understand they should not upload real unredacted tax documents yet.',
    real_user_invitation_rule: readiness.real_users_allowed_now ? 'Invite only no-file/redacted-sample users and monitor each case manually.' : 'Do not invite users until the first two readiness gates are green.',
    user_script: [
      'Start free. Tell us what happened in plain English.',
      'Do not enter full SSNs, bank account numbers, full EINs, or private taxpayer IDs in free-text fields.',
      'Do not upload real unredacted tax documents yet. Use no file or a redacted/sample copy only.',
      'We will show a starting summary and checklist. A human or professional review may be needed before you act.',
      'For same-day deadlines, levy/garnishment, court/criminal issues, or business payroll/sales-tax problems, contact an appropriate tax professional immediately.'
    ],
    staff_sop: [
      'Check each new case within one business day during pilot.',
      'Confirm no sensitive unredacted document was uploaded. If it was, quarantine/delete per policy and ask for a redacted copy after security review.',
      'Classify the case: notice, tax debt/payment plan, unfiled/prior-year return, amended return, gig/self-employed, business/payroll/sales tax, or professional reassurance.',
      'Assign review level: AI-only organization, PTIN preparer, EA, CPA, tax attorney, or urgent outside referral.',
      'Do not release official forms, filing instructions, agency responses, or payment-plan decisions until professional/release gates pass.',
      'Record outcome, user confusion, missing copy, and any safety issue in staff notes before inviting the next cohort.'
    ],
    first_10_case_acceptance_policy: [
      { category: 'Good first users', examples: ['Confusing notice with no same-day deadline', 'Tax debt/payment plan question without levy', 'Prior-year filing organization', '1099/gig-worker organizer', 'Amended return question that can wait for review'] },
      { category: 'Needs professional escalation', examples: ['Levy/garnishment/lien seizure warning', 'Audit appointment or summons', 'Tax Court/court/criminal language', 'Business payroll/sales-tax/trust-fund issue', 'Large balance or urgent deadline'] },
      { category: 'Do not handle as self-service yet', examples: ['Unredacted sensitive uploads', 'E-file request', 'Final official form request', 'Need same-day representation', 'User wants guaranteed settlement/refund outcome'] }
    ],
    metrics_to_review_after_10_users: [
      'Did any user try to upload sensitive documents despite warnings?',
      'Did users understand the no-government/no-guarantee/no-law-firm language?',
      'Which path was most common: notice, debt, unfiled, amended, gig, or professional reassurance?',
      'How many cases needed EA/CPA/tax attorney review?',
      'Were users confused by pricing or review levels?',
      'What must be fixed before paid pilot?'
    ],
    readiness_snapshot: readiness
  };
}

function buildRealUserSafetyCheck(body = {}) {
  const text = `${body.issue || ''} ${body.agency || ''} ${body.notice || ''} ${body.deadline || ''} ${body.amount || ''} ${body.hasSensitiveDocs || ''}`.toLowerCase();
  const urgentRaw = /(intent to levy|final notice|levy|garnish|garnishment|lien|seizure|summons|court|criminal|warrant|tax court|today|tomorrow|24 hours|48 hours|same[- ]day|immediate)/i.test(text);
  const negatedUrgency = /(no levy|not a levy|without levy|no garnishment|not garnished|no lien|not a lien|not urgent|due next month|deadline next month)/i.test(text);
  const hasUrgent = urgentRaw && !negatedUrgency;
  const hasBusinessTax = /(payroll|sales tax|trust fund|withholding|941|940|nys-45|corporation|partnership|business)/i.test(text);
  const hasSensitiveIntent = /(ssn|social security|bank account|routing|full return|w-2|1099|transcript|unredacted|notice upload|upload real)/i.test(text) || bool(body.hasSensitiveDocs);
  const wantsFiling = /(efile|e-file|file for me|submit|send to irs|agency submission|final form|sign)/i.test(text);
  let lane = 'safe_start_no_sensitive';
  const reasons = [];
  if (hasUrgent) { lane = 'professional_or_urgent_review_first'; reasons.push('Urgency, collection, court, criminal, or deadline language may require prompt professional help.'); }
  if (hasBusinessTax) { lane = 'professional_review_first'; reasons.push('Business, payroll, withholding, or sales-tax issues should not be treated as simple self-service matters.'); }
  if (hasSensitiveIntent) { reasons.push('The current public pilot should not receive real unredacted taxpayer documents.'); }
  if (wantsFiling) { lane = 'blocked_for_self_service'; reasons.push('Final filing, e-file, agency submission, or signature work remains blocked until official/professional gates pass.'); }
  if (!reasons.length) reasons.push('This appears suitable for a no-file or redacted/sample-document starting summary.');
  return {
    version: '0.1.56',
    lane,
    safe_for_real_user_pilot: lane === 'safe_start_no_sensitive' && !hasSensitiveIntent,
    suggested_next_step: lane === 'safe_start_no_sensitive' ? 'Start free with no file. Add only redacted/sample documents if necessary.' : 'Start with a summary only and request human/professional review before acting.',
    reasons,
    do_not_do: [
      'Do not upload full SSNs, bank details, full tax returns, transcripts, W-2s, 1099s, payroll files, or unredacted notices yet.',
      'Do not rely on AI-only output to file, sign, pay, respond to an agency, or miss a deadline.',
      'Do not assume attorney review is included unless specifically assigned and confirmed.'
    ],
    safe_start_path: '/#start',
    review_path: '/pricing.html',
    document_safety_path: '/document-safety-center.html'
  };
}

module.exports = {
  buildRealUserLaunchReadiness,
  buildFirstRealUserOperatingPlan,
  buildRealUserSafetyCheck
};
