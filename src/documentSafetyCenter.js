function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function present(value) {
  return Boolean(value && String(value).trim());
}

function envStatus() {
  return {
    public_base_url: process.env.PUBLIC_BASE_URL || '',
    custom_domain_verified: bool(process.env.CUSTOM_DOMAIN_VERIFIED),
    ssl_certificate_active: bool(process.env.SSL_CERTIFICATE_ACTIVE),
    database_url_configured: present(process.env.DATABASE_URL),
    private_storage_configured: present(process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.GCS_BUCKET || process.env.PRIVATE_OBJECT_STORAGE_BUCKET || process.env.DOCUMENT_STORAGE_PROVIDER),
    malware_provider_configured: present(process.env.CLAMAV_URL || process.env.VIRUSTOTAL_API_KEY || process.env.MALWARE_SCAN_PROVIDER),
    email_provider_configured: present(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST),
    stripe_configured: present(process.env.STRIPE_SECRET_KEY),
    stripe_webhook_configured: present(process.env.STRIPE_WEBHOOK_SECRET),
    staff_mfa_required: bool(process.env.STAFF_MFA_REQUIRED) || bool(process.env.REQUIRE_STAFF_MFA),
    professional_verification_complete: bool(process.env.PROFESSIONAL_VERIFICATION_COMPLETE),
    wisp_approved: bool(process.env.WISP_APPROVED),
    retention_policy_approved: bool(process.env.RETENTION_POLICY_APPROVED),
    incident_response_approved: bool(process.env.INCIDENT_RESPONSE_APPROVED),
    backup_restore_tested: bool(process.env.BACKUP_RESTORE_TESTED),
    security_go_live_approved: bool(process.env.SECURITY_GO_LIVE_APPROVED),
    live_sensitive_uploads_enabled: bool(process.env.ALLOW_LIVE_SENSITIVE_UPLOADS),
    accept_live_sensitive_documents: bool(process.env.ACCEPT_LIVE_SENSITIVE_DOCUMENTS),
    sample_uploads_allowed: !process.env.ALLOW_SAMPLE_UPLOADS || bool(process.env.ALLOW_SAMPLE_UPLOADS),
    official_form_output_approved: bool(process.env.OFFICIAL_FORM_OUTPUT_APPROVED),
    form_9465_release_approved: bool(process.env.FORM_9465_RELEASE_APPROVED),
    ptin_roster_reviewed: bool(process.env.PTIN_ROSTER_REVIEWED),
    ny_preparer_registration_reviewed: bool(process.env.NY_PREPARER_REGISTRATION_REVIEWED),
    nyc_consumer_rights_reviewed: bool(process.env.NYC_CONSUMER_RIGHTS_REVIEWED),
    efile_provider_approved: bool(process.env.IRS_EFILE_PROVIDER_APPROVED) || bool(process.env.EFIN_APPROVED)
  };
}

const DOCUMENT_SAFETY_CENTER_POLICY = {
  version: '0.1.56',
  safe_public_message: 'Use no documents or redacted/sample documents only until production security gates are approved. Do not upload real SSNs, full tax returns, W-2s, 1099s, bank information, transcripts, account numbers, or unredacted tax notices in pilot mode.',
  production_rule: 'Live sensitive taxpayer document handling requires managed database, private object storage, malware scanning, MFA/staff access controls, WISP/security approval, retention/deletion, incident response, backup/restore testing, and owner approval.',
  official_form_rule: 'Official IRS/NYS/NYC form output stays internal QA until the official PDF/source/field map/coordinate lock/sample output/professional release gates pass.'
};

const REDACTION_CHECKLIST = [
  { field: 'SSN / ITIN / EIN', safe_example: 'XXX-XX-1234 or XX-XXX1234', reason: 'Identity theft risk and high sensitivity.' },
  { field: 'Bank routing and account numbers', safe_example: 'XXXX ending 4321', reason: 'Direct debit and refund routing information should not be uploaded in pilot mode.' },
  { field: 'Full IRS/NYS/NYC account numbers', safe_example: 'Last 4 characters only', reason: 'Agency account identifiers can expose private taxpayer records.' },
  { field: 'W-2, 1099, transcript, and full return pages', safe_example: 'Use a blank sample or remove income/identity details', reason: 'Full tax records are sensitive taxpayer documents.' },
  { field: 'Notice barcode / QR code / scan code', safe_example: 'Cover barcode and scan code', reason: 'Some agency codes may connect to taxpayer-specific records.' },
  { field: 'Home address, phone, and email if not needed for the question', safe_example: 'City/state only if relevant', reason: 'Minimize personal information before production controls are approved.' },
  { field: 'Employer, customer, spouse, dependent, or business details', safe_example: 'Use generic labels such as Employer A or Dependent 1', reason: 'Third-party information should also be protected.' }
];

const USER_SAFE_START_STEPS = [
  'Read the tax notice or problem summary without panicking and write down the agency, notice number, tax year, date, amount, and deadline.',
  'Use the free starting point without uploading real sensitive documents.',
  'If you must show an example, upload only a redacted/sample version and confirm it does not contain SSNs, bank details, full returns, transcripts, W-2s, 1099s, or unredacted notices.',
  'Use the review-level self-check when there is a deadline, large amount, levy/lien/threat, audit, business tax issue, payroll/sales tax issue, fraud allegation, or legal-risk language.',
  'Do not sign, mail, e-file, call an agency with final statements, or make a large payment based only on AI organization; use professional review when facts are risky.'
];

function buildDocumentSafetyCenter() {
  const env = envStatus();
  const liveSensitiveReady = env.database_url_configured && env.private_storage_configured && env.malware_provider_configured && env.staff_mfa_required && env.wisp_approved && env.retention_policy_approved && env.incident_response_approved && env.backup_restore_tested && env.security_go_live_approved && env.live_sensitive_uploads_enabled && env.accept_live_sensitive_documents;
  return {
    policy: DOCUMENT_SAFETY_CENTER_POLICY,
    current_mode: liveSensitiveReady ? 'live_sensitive_documents_possible_after_final_owner_review' : 'no_sensitive_documents_redacted_sample_only',
    user_message: liveSensitiveReady ? 'Production controls are marked ready, but staff should still verify each upload workflow before asking the public for real documents.' : DOCUMENT_SAFETY_CENTER_POLICY.safe_public_message,
    what_not_to_upload_now: [
      'Real SSNs, ITINs, EINs, dependent SSNs, or full identity documents',
      'Full tax returns, transcripts, W-2s, 1099s, K-1s, payroll reports, sales-tax records, or bank statements',
      'Unredacted IRS, NYS, or NYC tax notices',
      'Bank routing/account numbers or direct-debit information',
      'Photos of IDs, Social Security cards, passports, or full utility bills',
      'Anything that would seriously harm the taxpayer if exposed'
    ],
    safe_alternatives_now: [
      'No-file intake describing the problem in your own words',
      'A redacted/sample notice with names, ID numbers, barcodes, addresses, account numbers, and dollar details removed if not needed',
      'A short typed summary of the tax year, agency, deadline, and rough amount',
      'A staff/professional callback request when the issue is urgent or too sensitive to summarize online'
    ],
    redaction_checklist: REDACTION_CHECKLIST,
    user_safe_start_steps: USER_SAFE_START_STEPS,
    staff_acceptance_check: [
      'Confirm the user acknowledged redacted/sample-only mode.',
      'Reject or delete accidental sensitive uploads according to the retention/deletion policy once approved.',
      'Do not forward documents by normal email.',
      'Do not store taxpayer records in personal cloud folders or chat messages.',
      'Escalate accidental sensitive uploads to the incident-response path.'
    ],
    launch_gate_snapshot: {
      managed_database: env.database_url_configured,
      private_storage: env.private_storage_configured,
      malware_scan: env.malware_provider_configured,
      staff_mfa: env.staff_mfa_required,
      wisp_approved: env.wisp_approved,
      retention_policy: env.retention_policy_approved,
      incident_response: env.incident_response_approved,
      backup_restore_tested: env.backup_restore_tested,
      owner_security_approval: env.security_go_live_approved,
      live_sensitive_upload_flags: env.live_sensitive_uploads_enabled && env.accept_live_sensitive_documents
    }
  };
}

function buildPublicLaunchCloseoutPlan() {
  const env = envStatus();
  const domainReady = env.custom_domain_verified && env.ssl_certificate_active && /justicetaxsolutions\.com/i.test(env.public_base_url || '');
  const safeUploadGate = !env.live_sensitive_uploads_enabled && !env.accept_live_sensitive_documents && env.sample_uploads_allowed;
  const paidPilotReady = env.stripe_configured && env.stripe_webhook_configured && env.email_provider_configured && env.professional_verification_complete;
  const securityReady = env.database_url_configured && env.private_storage_configured && env.malware_provider_configured && env.staff_mfa_required && env.wisp_approved && env.retention_policy_approved && env.incident_response_approved && env.backup_restore_tested && env.security_go_live_approved;
  const returnPrepReady = env.ptin_roster_reviewed && env.ny_preparer_registration_reviewed && env.nyc_consumer_rights_reviewed;
  const officialFormsReady = securityReady && env.official_form_output_approved && env.form_9465_release_approved;
  return {
    version: '0.1.56',
    recommended_launch_mode: domainReady && safeUploadGate ? 'public_site_review_plus_invite_only_no_sensitive_pilot' : 'finish_domain_ssl_and_safe_upload_review_first',
    full_public_launch_ready: Boolean(domainReady && paidPilotReady && securityReady && returnPrepReady && officialFormsReady),
    closeout_sequence: [
      {
        gate: '1. Domain and baseline public trust',
        ready: domainReady,
        missing: [!env.custom_domain_verified && 'custom domain verification', !env.ssl_certificate_active && 'SSL certificate active', !/justicetaxsolutions\.com/i.test(env.public_base_url || '') && 'PUBLIC_BASE_URL updated to custom domain'].filter(Boolean),
        why_it_matters: 'Users should land on the real brand domain over HTTPS before public sharing or referral flyers scale.'
      },
      {
        gate: '2. Safe public/pilot upload posture',
        ready: safeUploadGate,
        missing: [env.live_sensitive_uploads_enabled && 'live sensitive uploads must stay off for pilot', env.accept_live_sensitive_documents && 'live sensitive document acceptance must stay off for pilot', !env.sample_uploads_allowed && 'redacted/sample upload mode'].filter(Boolean),
        why_it_matters: 'The platform may be shown publicly only if users are not invited to upload real taxpayer records before security gates pass.'
      },
      {
        gate: '3. Email, payments, quotes, and professional operations',
        ready: paidPilotReady,
        missing: [!env.email_provider_configured && 'transactional email provider', !env.stripe_configured && 'Stripe live key/products', !env.stripe_webhook_configured && 'Stripe webhook test', !env.professional_verification_complete && 'verified PTIN/EA/CPA/attorney roster'].filter(Boolean),
        why_it_matters: 'Paid pilot needs reliable receipts, reminders, quote approvals, refund handling, and real assigned reviewer capacity.'
      },
      {
        gate: '4. Production taxpayer-data security',
        ready: securityReady,
        missing: [!env.database_url_configured && 'managed PostgreSQL', !env.private_storage_configured && 'private object storage', !env.malware_provider_configured && 'malware scanning/quarantine', !env.staff_mfa_required && 'staff MFA', !env.wisp_approved && 'WISP/security plan approval', !env.retention_policy_approved && 'retention/deletion policy', !env.incident_response_approved && 'incident-response plan', !env.backup_restore_tested && 'backup/restore testing', !env.security_go_live_approved && 'final owner security approval'].filter(Boolean),
        why_it_matters: 'Taxpayer data protection is the central production launch blocker.'
      },
      {
        gate: '5. Tax preparer and New York compliance operations',
        ready: returnPrepReady,
        missing: [!env.ptin_roster_reviewed && 'PTIN roster/scope review', !env.ny_preparer_registration_reviewed && 'NYS preparer registration/NYTPRIN review', !env.nyc_consumer_rights_reviewed && 'NYC consumer-rights handout workflow if preparing NYC returns'].filter(Boolean),
        why_it_matters: 'Professional review and return-preparation marketing must match the actual credential, registration, handout, and signing/e-file obligations.'
      },
      {
        gate: '6. Official form output and e-file/filing claims',
        ready: officialFormsReady && env.efile_provider_approved,
        missing: [!env.official_form_output_approved && 'official form output approval', !env.form_9465_release_approved && 'Form 9465 final release approval', !env.efile_provider_approved && 'IRS e-file provider/EFIN approval before e-file claims'].filter(Boolean),
        why_it_matters: 'The public site can guide users now, but final form output, e-file, and agency-submission claims must wait for proof and approvals.'
      }
    ],
    public_copy_mode_now: [
      'Tax help for people who need more than software.',
      'Free starting point and no-sensitive intake.',
      'AI can help organize and draft; professional review can be requested or required.',
      'Independent from IRS/NYS/NYC and not a law firm.',
      'No outcome is guaranteed.',
      'Do not upload real sensitive taxpayer documents yet.'
    ],
    do_not_claim_yet: [
      'Secure live document upload is ready for real taxpayer records.',
      'Final official IRS/NYS/NYC forms are client-output-ready.',
      'Justice Tax Solutions e-files, submits to agencies, or guarantees acceptance.',
      'Tax attorney review is included unless a tax attorney is actually assigned and engaged.',
      'AI-only completion equals professional tax review.'
    ]
  };
}

module.exports = {
  DOCUMENT_SAFETY_CENTER_POLICY,
  buildDocumentSafetyCenter,
  buildPublicLaunchCloseoutPlan
};
