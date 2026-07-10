function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function envSnapshot() {
  return {
    version: '0.1.56',
    public_base_url: process.env.PUBLIC_BASE_URL || '',
    node_env: process.env.NODE_ENV || 'development',
    owner_email_configured: Boolean(process.env.OWNER_EMAIL),
    custom_domain_verified: bool(process.env.CUSTOM_DOMAIN_VERIFIED),
    ssl_certificate_active: bool(process.env.SSL_CERTIFICATE_ACTIVE),
    jwt_secret_configured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev-change-me-before-production'),
    admin_token_configured: Boolean(process.env.ADMIN_TOKEN),
    staff_signup_code_configured: Boolean(process.env.STAFF_SIGNUP_CODE),
    document_encryption_key_configured: Boolean(process.env.DOCUMENT_ENCRYPTION_KEY && process.env.DOCUMENT_ENCRYPTION_KEY.length >= 32),
    allow_live_sensitive_uploads: bool(process.env.ALLOW_LIVE_SENSITIVE_UPLOADS),
    accept_live_sensitive_documents: bool(process.env.ACCEPT_LIVE_SENSITIVE_DOCUMENTS),
    allow_sample_uploads: !process.env.ALLOW_SAMPLE_UPLOADS || bool(process.env.ALLOW_SAMPLE_UPLOADS),
    database_url_configured: Boolean(process.env.DATABASE_URL),
    private_object_storage_configured: Boolean(process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.GCS_BUCKET || process.env.PRIVATE_OBJECT_STORAGE_BUCKET),
    malware_scanning_configured: Boolean(process.env.CLAMAV_URL || process.env.MALWARE_SCAN_PROVIDER || process.env.VIRUSTOTAL_API_KEY),
    staff_mfa_required: bool(process.env.STAFF_MFA_REQUIRED),
    email_provider_configured: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST),
    stripe_live_key_configured: Boolean(process.env.STRIPE_SECRET_KEY && /^sk_live_/i.test(process.env.STRIPE_SECRET_KEY)),
    stripe_webhook_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    professional_verification_complete: bool(process.env.PROFESSIONAL_VERIFICATION_COMPLETE),
    ptin_roster_reviewed: bool(process.env.PTIN_ROSTER_REVIEWED),
    ny_preparer_registration_reviewed: bool(process.env.NY_PREPARER_REGISTRATION_REVIEWED),
    nyc_consumer_rights_reviewed: bool(process.env.NYC_CONSUMER_RIGHTS_REVIEWED),
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

function gate(key, label, keys, env, overrideReady) {
  const ready = typeof overrideReady === 'boolean' ? overrideReady : keys.every((k) => env[k]);
  return { key, label, ready, missing: missing(env, keys) };
}

function buildRealUserGoLiveGate() {
  const env = envSnapshot();
  const safeUpload = !env.allow_live_sensitive_uploads && !env.accept_live_sensitive_documents && env.allow_sample_uploads;
  const coreSecrets = env.jwt_secret_configured && env.admin_token_configured && env.staff_signup_code_configured && env.document_encryption_key_configured;
  const domainReady = env.custom_domain_verified && env.ssl_certificate_active && /justicetaxsolutions\.com/i.test(env.public_base_url || '');
  const supportReady = env.owner_email_configured;
  const emailPaymentReady = env.email_provider_configured && env.stripe_live_key_configured && env.stripe_webhook_configured;
  const proReady = env.professional_verification_complete && env.ptin_roster_reviewed && env.ny_preparer_registration_reviewed && env.nyc_consumer_rights_reviewed;
  const securityReady = env.database_url_configured && env.private_object_storage_configured && env.malware_scanning_configured && env.staff_mfa_required && env.wisp_approved && env.retention_policy_approved && env.incident_response_approved && env.backup_restore_tested && env.security_go_live_approved;
  const officialOutputReady = securityReady && proReady && env.official_form_output_approved && env.form_9465_release_approved;
  const noSensitiveRealUserReady = safeUpload && coreSecrets && supportReady;
  const controlledPaidPilotReady = noSensitiveRealUserReady && domainReady && emailPaymentReady && proReady;
  const fullLaunchReady = controlledPaidPilotReady && securityReady && officialOutputReady;

  return {
    version: '0.1.56',
    title: 'Real-user go-live gate',
    current_mode: fullLaunchReady ? 'full_public_launch_candidate' : (noSensitiveRealUserReady ? 'controlled_no_sensitive_real_user_launch' : 'internal_until_core_gates_are_green'),
    can_invite_real_users_now: Boolean(noSensitiveRealUserReady),
    can_charge_real_users_now: Boolean(controlledPaidPilotReady),
    can_accept_real_sensitive_documents_now: Boolean(controlledPaidPilotReady && securityReady && env.allow_live_sensitive_uploads && env.accept_live_sensitive_documents),
    can_release_final_official_forms_now: Boolean(officialOutputReady),
    can_claim_efile_or_agency_submission_now: Boolean(env.efile_provider_approved),
    owner_answer: fullLaunchReady
      ? 'Ready for broader public launch only after final owner review and live smoke testing.'
      : (noSensitiveRealUserReady
        ? 'Ready for first real users only as a no-file or redacted/sample-document controlled pilot. Do not enable broad paid launch, sensitive documents, final official forms, or e-file claims yet.'
        : 'Do not invite real users until core secrets, owner support email, and no-sensitive upload defaults are verified.'),
    gates: [
      gate('domain_ssl', 'Domain and HTTPS smoke-tested', ['custom_domain_verified','ssl_certificate_active'], env, domainReady),
      gate('safe_upload_posture', 'No-sensitive upload posture', ['allow_sample_uploads'], env, safeUpload),
      gate('core_account_security', 'Core account/security secrets', ['jwt_secret_configured','admin_token_configured','staff_signup_code_configured','document_encryption_key_configured'], env, coreSecrets),
      gate('support_channel', 'Owner/staff support channel', ['owner_email_configured'], env, supportReady),
      gate('email_payment', 'Transactional email + Stripe live paid pilot', ['email_provider_configured','stripe_live_key_configured','stripe_webhook_configured'], env, emailPaymentReady),
      gate('professional_compliance', 'Professional roster, PTIN, NY/NYC compliance', ['professional_verification_complete','ptin_roster_reviewed','ny_preparer_registration_reviewed','nyc_consumer_rights_reviewed'], env, proReady),
      gate('taxpayer_data_security', 'Taxpayer data security for real documents', ['database_url_configured','private_object_storage_configured','malware_scanning_configured','staff_mfa_required','wisp_approved','retention_policy_approved','incident_response_approved','backup_restore_tested','security_go_live_approved'], env, securityReady),
      gate('official_form_output', 'Official form output release', ['official_form_output_approved','form_9465_release_approved'], env, officialOutputReady),
      gate('efile_provider', 'Authorized e-file/EFIN path', ['efile_provider_approved'], env, env.efile_provider_approved)
    ],
    before_inviting_next_real_user: [
      'Deploy the latest build and confirm /health returns 0.1.56 on the Render URL and the custom domain.',
      'Run one no-file intake and one redacted/sample-document intake from a real browser, then confirm staff can view and classify each case.',
      'Confirm every public upload message says no real SSNs, bank details, full tax returns, transcripts, payroll records, or unredacted notices yet.',
      'Confirm a human will check every first-cohort case within one business day and route urgent/high-risk issues to professional review.',
      'Keep payments manual or disabled unless Stripe live checkout, webhook, receipt/refund handling, and safe transactional email are tested.'
    ]
  };
}

function buildFirstPublicUserStartGuide() {
  return {
    version: '0.1.56',
    title: 'First public user safe-start guide',
    user_message: 'You can start safely by describing the tax problem without uploading real sensitive documents. The platform can organize your concern and suggest a review path, but it is not the IRS, New York State, NYC, or a law firm, and no outcome is guaranteed.',
    safe_to_share_now: [
      'Agency name: IRS, New York State, NYC, or other.',
      'Notice or letter number, if you know it, without uploading the full unredacted notice.',
      'Tax year or approximate period involved.',
      'Approximate balance or amount in dispute.',
      'Deadline or date printed on the letter, if any.',
      'A plain-English description of what worries you most.'
    ],
    do_not_share_now: [
      'Full Social Security number, ITIN, EIN, bank account, routing number, wage/payroll details, or full identity documents.',
      'Full unredacted tax returns, transcripts, notices, collection letters, payroll/sales-tax records, or account screenshots.',
      'Passwords, IRS/NYS/NYC online account credentials, or identity-verification codes.',
      'A signed government form or final agency response unless staff/professional release gates say it is ready.'
    ],
    good_first_user_cases: [
      'Confusing IRS/NYS/NYC notice with no same-day deadline.',
      'Tax debt or payment-plan question without active levy/garnishment seizure language.',
      'Prior-year or unfiled return organization where the user needs a checklist.',
      'Amended return question where a professional can review before filing.',
      'Self-employed/gig-worker tax organizer and next-step planning.'
    ],
    professional_first_cases: [
      'Levy, garnishment, lien seizure, summons, court, criminal, fraud, or same-day deadline language.',
      'Payroll tax, sales tax, trust-fund, business-tax collection, or multi-state issues.',
      'Offer in compromise, audit/reconsideration, appeals, innocent spouse, bankruptcy, or tax attorney questions.',
      'Anything requiring a signed return, agency filing, direct-debit setup, or final form output.'
    ],
    safe_start_steps: [
      'Use the free start form with no file first whenever possible.',
      'Use the urgency triage if the notice sounds threatening or time-sensitive.',
      'Use the document safety page before attaching any sample/redacted document.',
      'Choose a review level only after the platform shows what kind of help may be needed.',
      'Wait for staff/professional confirmation before filing, signing, paying, or responding to an agency.'
    ]
  };
}

function text(value) {
  return String(value || '').toLowerCase();
}

function includesAny(haystack, words) {
  return words.some((w) => haystack.includes(w));
}

function buildPreSubmitRealUserCheck(body = {}) {
  const combined = text([body.issue, body.agency, body.notice, body.deadline, body.amount, body.documents, body.notes].join(' '));
  const wantsUpload = bool(body.hasSensitiveDocs) || bool(body.wantsUpload) || includesAny(combined, ['upload', 'attach', 'document', 'return', 'transcript', 'notice scan', 'pdf']);
  const sensitiveSignals = includesAny(combined, ['ssn', 'social security', 'itin', 'ein', 'bank account', 'routing', 'w-2', '1099', 'payroll', 'transcript', 'full return', 'tax return pdf', 'identity theft pin', 'ip pin', 'driver license', 'passport']);
  const urgencySignals = includesAny(combined, ['levy', 'garnish', 'garnishment', 'lien', 'seize', 'seizure', 'summons', 'court', 'criminal', 'fraud', 'jail', 'today', 'tomorrow', '24 hours', '48 hours', 'deadline today', 'deadline tomorrow', 'deadline in 24', 'deadline in 48', 'audit appointment', 'field audit', 'revenue officer']);
  const businessHighRisk = includesAny(combined, ['payroll tax', '941', '940', 'sales tax', 'trust fund', 'trust-fund', 'business tax', 'withholding tax', 'responsible person']);
  const finalActionSignals = includesAny(combined, ['file for me', 'e-file', 'submit to irs', 'submit to nys', 'sign form', 'direct debit', 'bank draft', 'final form', 'power of attorney']);
  const blockers = [];
  if (wantsUpload || sensitiveSignals) blockers.push('Do not upload or paste real sensitive taxpayer details in this pilot lane. Start with no file or a redacted/sample copy only.');
  if (urgencySignals) blockers.push('Urgency signals detected. This should be reviewed by staff/professional support before the user acts.');
  if (businessHighRisk) blockers.push('Business, payroll, sales-tax, or trust-fund issues should not be handled as AI-only self-service.');
  if (finalActionSignals) blockers.push('Final filing, e-file, direct-debit, signature, or agency-submission requests are blocked until official/professional release gates pass.');
  const safe = blockers.length === 0;
  return {
    version: '0.1.56',
    safe_to_submit_now: safe,
    lane: safe ? 'no_sensitive_free_start' : 'staff_or_professional_review_first',
    recommended_action: safe ? 'Use the free start form with no file and describe the problem in plain English.' : 'Use the urgency/document safety pages and request staff/professional review before uploading, signing, filing, paying, or responding.',
    detected_flags: { wants_upload: wantsUpload, sensitive_signals: sensitiveSignals, urgency_signals: urgencySignals, business_high_risk: businessHighRisk, final_action_signals: finalActionSignals },
    blockers: blockers.length ? blockers : ['No obvious urgent/sensitive/final-action blockers were detected from the short description.'],
    safe_next_links: [
      { label: 'Start free with no file', href: '/#start' },
      { label: 'Document Safety Center', href: '/document-safety-center.html' },
      { label: 'Tax Urgency Triage', href: '/tax-urgency-triage.html' },
      { label: 'Compare review levels', href: '/pricing.html' }
    ],
    reminder: 'This is not legal, tax, or accounting advice and does not calculate official deadlines. When a notice has a deadline or collection threat, verify it with the agency or an appropriate professional.'
  };
}

function buildLaunchDayRunbook() {
  return {
    version: '0.1.56',
    title: 'Launch-day runbook for first real users',
    day_zero: [
      'Deploy the latest build, verify /health, root domain, www domain, HTTPS, homepage, pricing, dashboard, launch readiness, document safety, urgency triage, and safe-start pages.',
      'Confirm live sensitive upload flags are still off unless the full production security launch has been approved.',
      'Run one no-file test case and one redacted/sample-file test case, then verify staff cockpit visibility.',
      'Confirm owner/staff notification channel and manual response process.',
      'Invite only a small cohort and tell them not to upload real unredacted taxpayer documents.'
    ],
    first_72_hours: [
      'Review every new case manually within one business day.',
      'Record confusion, blocker, quote request, professional escalation, and document-safety issue for every pilot user.',
      'Pause invitations if any real sensitive document is uploaded or if staff cannot respond promptly.',
      'Do not accept payments unless live Stripe, webhook, email receipts, refund handling, and professional assignment are tested.',
      'Do not release official tax forms or agency-response language as final output.'
    ],
    stop_launch_if: [
      'A user uploads unredacted SSNs, bank information, complete returns, transcripts, payroll/sales-tax files, or identity documents.',
      'Staff cannot view, classify, or respond to cases quickly.',
      'Domain/SSL, login, upload gate, dashboard, or staff cockpit fails in production.',
      'Users believe the platform is the IRS, NYS, NYC, a law firm, or guarantees tax relief.',
      'A payment, refund, credential, form-output, or e-file claim appears live before its gate is approved.'
    ]
  };
}

module.exports = { buildRealUserGoLiveGate, buildFirstPublicUserStartGuide, buildPreSubmitRealUserCheck, buildLaunchDayRunbook };
