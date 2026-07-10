function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function present(value) {
  return Boolean(value && String(value).trim());
}

function envSnapshot() {
  return {
    public_base_url: process.env.PUBLIC_BASE_URL || '',
    custom_domain_verified: bool(process.env.CUSTOM_DOMAIN_VERIFIED),
    ssl_certificate_active: bool(process.env.SSL_CERTIFICATE_ACTIVE),
    owner_email_configured: present(process.env.OWNER_EMAIL),
    jwt_secret_configured: present(process.env.JWT_SECRET) && process.env.JWT_SECRET !== 'dev-change-me-before-production',
    admin_token_configured: present(process.env.ADMIN_TOKEN),
    staff_signup_code_configured: present(process.env.STAFF_SIGNUP_CODE),
    document_encryption_key_configured: present(process.env.DOCUMENT_ENCRYPTION_KEY) && String(process.env.DOCUMENT_ENCRYPTION_KEY).length >= 32,
    database_url_configured: present(process.env.DATABASE_URL),
    private_object_storage_configured: present(process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.GCS_BUCKET || process.env.PRIVATE_OBJECT_STORAGE_BUCKET || process.env.DOCUMENT_STORAGE_PROVIDER),
    malware_scanning_configured: present(process.env.CLAMAV_URL || process.env.VIRUSTOTAL_API_KEY || process.env.MALWARE_SCAN_PROVIDER),
    email_provider_configured: present(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST),
    stripe_live_key_configured: present(process.env.STRIPE_SECRET_KEY),
    stripe_webhook_configured: present(process.env.STRIPE_WEBHOOK_SECRET),
    staff_mfa_required: bool(process.env.STAFF_MFA_REQUIRED) || bool(process.env.REQUIRE_STAFF_MFA),
    professional_verification_complete: bool(process.env.PROFESSIONAL_VERIFICATION_COMPLETE),
    wisp_approved: bool(process.env.WISP_APPROVED),
    retention_policy_approved: bool(process.env.RETENTION_POLICY_APPROVED),
    incident_response_approved: bool(process.env.INCIDENT_RESPONSE_APPROVED),
    backup_restore_tested: bool(process.env.BACKUP_RESTORE_TESTED),
    security_go_live_approved: bool(process.env.SECURITY_GO_LIVE_APPROVED),
    allow_live_sensitive_uploads: bool(process.env.ALLOW_LIVE_SENSITIVE_UPLOADS),
    accept_live_sensitive_documents: bool(process.env.ACCEPT_LIVE_SENSITIVE_DOCUMENTS),
    official_form_output_approved: bool(process.env.OFFICIAL_FORM_OUTPUT_APPROVED),
    form_9465_release_approved: bool(process.env.FORM_9465_RELEASE_APPROVED),
    ptin_roster_reviewed: bool(process.env.PTIN_ROSTER_REVIEWED),
    ny_preparer_registration_reviewed: bool(process.env.NY_PREPARER_REGISTRATION_REVIEWED),
    nyc_consumer_rights_reviewed: bool(process.env.NYC_CONSUMER_RIGHTS_REVIEWED),
    efile_provider_approved: bool(process.env.EFILE_PROVIDER_APPROVED) || bool(process.env.EFIN_APPROVED)
  };
}

function missingFor(env, keys) {
  return keys.filter((key) => !env[key]).map((key) => key.replace(/_/g, ' '));
}

function buildPhase(key, label, readiness, allowedNow, mustFinishBeforeNext, blockedClaims) {
  return { key, label, readiness, allowed_now: allowedNow, must_finish_before_next: mustFinishBeforeNext, blocked_claims: blockedClaims };
}

function buildPublicLaunchRoadmap() {
  const env = envSnapshot();
  const safeUploadDefault = !env.allow_live_sensitive_uploads && !env.accept_live_sensitive_documents;
  const coreSecretsReady = ['jwt_secret_configured','admin_token_configured','staff_signup_code_configured','document_encryption_key_configured'].every((key) => env[key]);
  const domainReady = env.custom_domain_verified && env.ssl_certificate_active && /justicetaxsolutions\.com/i.test(env.public_base_url || '');
  const emailAndPaymentReady = env.email_provider_configured && env.stripe_live_key_configured && env.stripe_webhook_configured;
  const taxpayerDataReady = ['database_url_configured','private_object_storage_configured','malware_scanning_configured','staff_mfa_required','wisp_approved','retention_policy_approved','incident_response_approved','backup_restore_tested','security_go_live_approved'].every((key) => env[key]);
  const professionalReady = ['professional_verification_complete','ptin_roster_reviewed','ny_preparer_registration_reviewed','nyc_consumer_rights_reviewed'].every((key) => env[key]);
  const officialFormsReady = taxpayerDataReady && professionalReady && env.official_form_output_approved && env.form_9465_release_approved;
  const efileReady = env.efile_provider_approved;
  const publicReviewReady = safeUploadDefault;
  const privatePilotReady = publicReviewReady && coreSecretsReady;
  const controlledPaidPilotReady = privatePilotReady && domainReady && emailAndPaymentReady && professionalReady;
  const liveSensitiveDocsReady = controlledPaidPilotReady && taxpayerDataReady && env.allow_live_sensitive_uploads && env.accept_live_sensitive_documents;
  const broadPublicLaunchReady = controlledPaidPilotReady && liveSensitiveDocsReady && officialFormsReady;

  return {
    version: '0.1.56',
    headline: 'Public launch roadmap: what is safe now, what is next, and what stays blocked.',
    current_recommended_mode: publicReviewReady ? 'Public website review + invite-only no-sensitive private pilot' : 'Internal review only until safe upload defaults are restored',
    full_public_launch_ready: Boolean(broadPublicLaunchReady),
    safe_now_summary: [
      'Show the public website for review after deployment/domain/SSL smoke tests.',
      'Invite trusted pilot users only with no-file or redacted/sample-document rules.',
      'Use the Taxpayer Action Center, Urgency Triage, Notice Next Steps, and Document Safety Center as safe first-step tools.',
      'Keep all real sensitive taxpayer documents, final official form output, and e-file/agency submission claims blocked.'
    ],
    launch_phases: [
      buildPhase('phase_1_public_review', 'Phase 1 — Public website review', publicReviewReady ? 'ready_after_deployment_smoke_test' : 'blocked', ['Homepage, service pages, pricing, urgency triage, Action Center, Document Safety Center, launch readiness pages.'], missingFor(env, ['custom_domain_verified','ssl_certificate_active']).concat(safeUploadDefault ? [] : ['restore no-sensitive upload gate']), ['secure live document upload', 'final tax forms', 'e-file/agency filing']),
      buildPhase('phase_2_private_no_sensitive_pilot', 'Phase 2 — Invite-only no-sensitive pilot', privatePilotReady ? 'ready_for_invite_only' : 'blocked', ['No-file intakes, redacted/sample documents, manual staff review, issue logging, quote requests without live payment claims.'], missingFor(env, ['jwt_secret_configured','admin_token_configured','staff_signup_code_configured','document_encryption_key_configured']), ['real taxpayer files', 'automatic filing', 'guaranteed tax results']),
      buildPhase('phase_3_controlled_paid_pilot', 'Phase 3 — Controlled paid pilot', controlledPaidPilotReady ? 'ready_after_owner_approval' : 'blocked', ['Small paid cohort only after email, Stripe, professional roster, refund/quote SOP, and support workflow are tested.'], missingFor(env, ['custom_domain_verified','ssl_certificate_active','email_provider_configured','stripe_live_key_configured','stripe_webhook_configured','professional_verification_complete','ptin_roster_reviewed','ny_preparer_registration_reviewed','nyc_consumer_rights_reviewed']), ['broad paid ads', 'instant professional review', 'attorney included unless assigned']),
      buildPhase('phase_4_sensitive_document_launch', 'Phase 4 — Live sensitive-document launch', liveSensitiveDocsReady ? 'ready_after_security_owner_signoff' : 'blocked', ['Real notices/returns/transcripts only after managed database, private storage, malware scanning, MFA, WISP, retention, incident response, and backups are approved.'], missingFor(env, ['database_url_configured','private_object_storage_configured','malware_scanning_configured','staff_mfa_required','wisp_approved','retention_policy_approved','incident_response_approved','backup_restore_tested','security_go_live_approved']).concat(env.allow_live_sensitive_uploads && env.accept_live_sensitive_documents ? [] : ['live sensitive upload env flags intentionally off']), ['upload real SSNs now', 'email us tax documents', 'data security fully approved']),
      buildPhase('phase_5_official_forms_and_efile', 'Phase 5 — Official form output / e-file claims', officialFormsReady && efileReady ? 'ready_after_form_and_efin_signoff' : 'blocked', ['Only release official IRS/NYS/NYC forms after PDF/source/checksum/coordinate QA, sample-fill testing, professional signoff, and e-file/provider approvals if claiming e-file.'], missingFor(env, ['official_form_output_approved','form_9465_release_approved','efile_provider_approved']), ['client-ready IRS/NYS/NYC form output', 'e-file active', 'agency submission handled'])
    ],
    final_blockers_before_true_public_launch: [
      'Root and www custom-domain HTTPS verified; PUBLIC_BASE_URL moved to justicetaxsolutions.com.',
      'Production transactional email provider configured and tested end-to-end.',
      'Stripe live checkout and webhook tested with paid status/refund/failed-payment handling.',
      'Professional roster verified for PTIN, EA, CPA, attorney, New York/NYC scope, assignment rules, and disclosures.',
      'Managed production database, private object storage, malware scanning, staff MFA, WISP, retention/deletion, incident response, and backup/restore testing approved.',
      'IRS/NYS/NYC official form output QA completed before any client-ready forms are released.',
      'No e-file or agency-submission claim until authorized e-file provider/EFIN path is complete and tested.'
    ],
    owner_decision: broadPublicLaunchReady ? 'Ready for broader public launch after final owner review.' : 'Do not run broad public launch yet; continue public review plus no-sensitive private pilot.'
  };
}

function buildOwnerPublicLaunchChecklist() {
  const env = envSnapshot();
  const items = [
    ['domain_ssl', 'Verify justicetaxsolutions.com and www HTTPS in Render; update PUBLIC_BASE_URL.', ['custom_domain_verified','ssl_certificate_active']],
    ['email', 'Configure transactional email and test verification/reset/quote/appointment/staff messages.', ['email_provider_configured']],
    ['payments', 'Configure Stripe live keys, prices, checkout, webhook, paid status, and refund/failed-payment SOP.', ['stripe_live_key_configured','stripe_webhook_configured']],
    ['professionals', 'Verify professional roster, role scope, PTIN/EA/CPA/attorney credentials, New York/NYC compliance, and disclosures.', ['professional_verification_complete','ptin_roster_reviewed','ny_preparer_registration_reviewed','nyc_consumer_rights_reviewed']],
    ['security', 'Approve WISP/data safeguards, managed DB, private storage, malware scan, MFA, retention, incident response, and backups.', ['database_url_configured','private_object_storage_configured','malware_scanning_configured','staff_mfa_required','wisp_approved','retention_policy_approved','incident_response_approved','backup_restore_tested','security_go_live_approved']],
    ['official_forms', 'Finish official PDF/source/checksum/coordinate/sample-fill/professional release QA before client-ready form output.', ['official_form_output_approved','form_9465_release_approved']],
    ['efile_claims', 'Complete authorized e-file provider/EFIN path before e-file or agency-submission claims.', ['efile_provider_approved']]
  ];
  return {
    version: '0.1.56',
    current_mode: 'owner_closeout_checklist_for_public_launch',
    items: items.map(([key, label, keys]) => ({ key, label, done: keys.every((k) => env[k]), missing: missingFor(env, keys) })),
    recommended_next_three: [
      'Deploy the latest ZIP and verify /health plus the root/www custom domain certificate.',
      'Keep public copy in no-sensitive pilot mode until security/payment/professional gates are green.',
      'Run one complete no-file and one redacted/sample-document pilot case from homepage start through staff review and quote request.'
    ],
    staff_instruction: 'Use this checklist before inviting non-test users. Do not override upload, payment, professional, official-form, or security gates just because the public site works.'
  };
}

module.exports = { buildPublicLaunchRoadmap, buildOwnerPublicLaunchChecklist };
