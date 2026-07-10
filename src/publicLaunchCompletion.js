function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function present(value) {
  return Boolean(value && String(value).trim());
}

function envStatus() {
  return {
    node_env: process.env.NODE_ENV || 'development',
    public_base_url: process.env.PUBLIC_BASE_URL || '',
    owner_email_configured: present(process.env.OWNER_EMAIL),
    jwt_secret_configured: present(process.env.JWT_SECRET) && process.env.JWT_SECRET !== 'dev-change-me-before-production',
    admin_token_configured: present(process.env.ADMIN_TOKEN),
    staff_signup_code_configured: present(process.env.STAFF_SIGNUP_CODE),
    encryption_key_configured: present(process.env.DOCUMENT_ENCRYPTION_KEY) && String(process.env.DOCUMENT_ENCRYPTION_KEY).length >= 32,
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
    official_9465_release_approved: bool(process.env.FORM_9465_RELEASE_APPROVED),
    custom_domain_verified: bool(process.env.CUSTOM_DOMAIN_VERIFIED),
    ssl_certificate_active: bool(process.env.SSL_CERTIFICATE_ACTIVE),
    ny_preparer_registration_reviewed: bool(process.env.NY_PREPARER_REGISTRATION_REVIEWED),
    nyc_consumer_rights_reviewed: bool(process.env.NYC_CONSUMER_RIGHTS_REVIEWED),
    ptin_roster_reviewed: bool(process.env.PTIN_ROSTER_REVIEWED)
  };
}

function envOk(env, keys) {
  return keys.every((key) => Boolean(env[key]));
}

function count(store, collection) {
  try {
    return store && typeof store.list === 'function' ? store.list(collection).filter((item) => !item.deleted_at).length : 0;
  } catch {
    return 0;
  }
}

const PUBLIC_LAUNCH_COMPLETION_POLICY = {
  version: '0.1.56',
  purpose: 'Show exactly what remains before Justice Tax Solutions can move from public review/private pilot to controlled paid pilot, live sensitive-document handling, official form output, and broad public marketing.',
  safe_default: 'Public site, free starting point, tax-urgency triage, no-sensitive intake, redacted/sample-document private pilot, consultation requests, and manual quote review can be tested. Real sensitive taxpayer documents and final official tax-form output remain blocked until the gates pass.',
  forbidden_public_claims_until_ready: [
    'Secure live tax-document upload is ready',
    'Official IRS/NYS/NYC forms are final and client-output-ready',
    'E-file or agency submission is active',
    'Tax relief, refund, payment plan, penalty relief, audit, or offer-in-compromise outcome is guaranteed',
    'Attorney review is included without an assigned attorney engagement',
    'AI-only review is the same as professional review'
  ]
};

const COMPLIANCE_REFERENCE_MATRIX = [
  {
    source: 'IRS Publication 4557 / Safeguarding Taxpayer Data',
    platform_control: 'WISP, MFA, encryption, access logs, malware scanning, backups, incident response, and staff training before live taxpayer documents',
    status_key: 'wisp_approved',
    launch_effect: 'Blocks live sensitive taxpayer document handling until approved and operationally tested.'
  },
  {
    source: 'IRS PTIN requirements',
    platform_control: 'Anyone preparing or assisting with compensated federal return preparation needs valid PTIN handling in the professional roster when signing/preparer work is performed',
    status_key: 'ptin_roster_reviewed',
    launch_effect: 'Blocks paid return-preparation/review claims until the roster and scope are reviewed.'
  },
  {
    source: 'New York State tax preparer registration/CPE rules',
    platform_control: 'New York return-preparer/facilitator registration, fee, CPE, posting, NYTPRIN, and e-file mandate review where applicable',
    status_key: 'ny_preparer_registration_reviewed',
    launch_effect: 'Blocks New York return-preparation marketing beyond safe intake/review routing until reviewed.'
  },
  {
    source: 'New York City consumer-rights handout requirement through NYS guidance',
    platform_control: 'NYC consumer bill of rights workflow for NYC tax-return clients where applicable',
    status_key: 'nyc_consumer_rights_reviewed',
    launch_effect: 'Blocks NYC return-preparer operational launch until public/client handout workflow is reviewed.'
  }
];

function buildGate({ key, label, launchMode, ready, required, missing, allowedNow, blockedUntilReady, ownerAction }) {
  return { key, label, launch_mode: launchMode, ready: Boolean(ready), required, missing, allowed_now: allowedNow, blocked_until_ready: blockedUntilReady, owner_action: ownerAction };
}

function buildPublicLaunchCompletionAudit({ store } = {}) {
  const env = envStatus();
  const coreSecretsReady = envOk(env, ['jwt_secret_configured', 'admin_token_configured', 'staff_signup_code_configured', 'encryption_key_configured']);
  const safeUploadGateReady = !env.live_sensitive_uploads_enabled && !env.accept_live_sensitive_documents && env.sample_uploads_allowed;
  const domainReady = env.custom_domain_verified && env.ssl_certificate_active && /justicetaxsolutions\.com/i.test(env.public_base_url || '');
  const publicViewingReady = Boolean(env.public_base_url) && safeUploadGateReady;
  const privatePilotReady = publicViewingReady && coreSecretsReady;
  const paidPilotReady = privatePilotReady && env.stripe_configured && env.stripe_webhook_configured && env.email_provider_configured && env.professional_verification_complete;
  const securityControlsReady = env.database_url_configured && env.private_storage_configured && env.malware_provider_configured && env.staff_mfa_required && env.wisp_approved && env.retention_policy_approved && env.incident_response_approved && env.backup_restore_tested && env.security_go_live_approved;
  const sensitiveDocsReady = securityControlsReady && env.live_sensitive_uploads_enabled && env.accept_live_sensitive_documents;
  const returnPrepComplianceReady = env.ptin_roster_reviewed && env.ny_preparer_registration_reviewed && env.nyc_consumer_rights_reviewed;
  const officialOutputReady = sensitiveDocsReady && env.official_form_output_approved && env.professional_verification_complete && returnPrepComplianceReady;
  const broadMarketingReady = paidPilotReady && sensitiveDocsReady && officialOutputReady && domainReady;

  const gates = [
    buildGate({
      key: 'public_site_review',
      label: 'Public website review',
      launchMode: publicViewingReady ? 'available_with_safe_language' : 'blocked_until_domain_and_upload_gate',
      ready: publicViewingReady,
      required: ['PUBLIC_BASE_URL', 'live sensitive uploads blocked', 'sample/redacted upload mode visible', 'core pages smoke-tested'],
      missing: [!env.public_base_url && 'PUBLIC_BASE_URL', !safeUploadGateReady && 'safe upload gate'].filter(Boolean),
      allowedNow: ['Homepage, pricing, service pages, referral pages, public launch audit, and free starting point can be reviewed.'],
      blockedUntilReady: ['Do not say secure live document upload or final filing is ready.'],
      ownerAction: 'Finish root/www HTTPS verification, then update PUBLIC_BASE_URL to the custom domain.'
    }),
    buildGate({
      key: 'private_no_sensitive_pilot',
      label: 'Private pilot with no real sensitive documents',
      launchMode: privatePilotReady ? 'available_for_invite_only_testing' : 'blocked_until_core_secrets_and_public_site',
      ready: privatePilotReady,
      required: ['core secrets', 'staff signup code', 'document encryption key', 'redacted/sample-document acknowledgment', 'staff issue log'],
      missing: [!coreSecretsReady && 'core secrets', !publicViewingReady && 'public viewing gate'].filter(Boolean),
      allowedNow: ['Invite trusted testers to use free intake, no-file cases, and redacted/sample documents only.'],
      blockedUntilReady: ['No unredacted notices, tax returns, SSNs, bank data, wage statements, transcripts, or live taxpayer files.'],
      ownerAction: 'Use a written pilot script and make testers confirm sample/redacted-document rules.'
    }),
    buildGate({
      key: 'controlled_paid_pilot',
      label: 'Controlled paid pilot',
      launchMode: paidPilotReady ? 'available_after_owner_review' : 'blocked_until_payments_email_professionals',
      ready: paidPilotReady,
      required: ['Stripe live key', 'Stripe webhook', 'transactional email provider', 'verified professional roster', 'refund/quote SOP'],
      missing: [!env.stripe_configured && 'Stripe live key', !env.stripe_webhook_configured && 'Stripe webhook', !env.email_provider_configured && 'transactional email', !env.professional_verification_complete && 'verified professional roster'].filter(Boolean),
      allowedNow: ['Manual quote requests and consultation requests can be tested without charging cards.'],
      blockedUntilReady: ['Do not run broad ads or promise paid turnaround until payment/email/follow-up operations are verified.'],
      ownerAction: 'Configure live Stripe, webhook, email provider, and professional assignment procedures before taking paid pilot users.'
    }),
    buildGate({
      key: 'live_sensitive_documents',
      label: 'Live sensitive taxpayer documents',
      launchMode: sensitiveDocsReady ? 'available_after_final_security_approval' : 'blocked',
      ready: sensitiveDocsReady,
      required: ['managed PostgreSQL', 'private object storage', 'malware scanning/quarantine', 'staff MFA', 'WISP', 'retention/deletion policy', 'incident response', 'backup/restore test', 'security go-live approval', 'live upload flags intentionally enabled'],
      missing: [!env.database_url_configured && 'managed PostgreSQL', !env.private_storage_configured && 'private storage', !env.malware_provider_configured && 'malware scanning', !env.staff_mfa_required && 'staff MFA', !env.wisp_approved && 'WISP', !env.retention_policy_approved && 'retention/deletion policy', !env.incident_response_approved && 'incident response', !env.backup_restore_tested && 'backup/restore test', !env.security_go_live_approved && 'security approval', !env.live_sensitive_uploads_enabled && 'ALLOW_LIVE_SENSITIVE_UPLOADS', !env.accept_live_sensitive_documents && 'ACCEPT_LIVE_SENSITIVE_DOCUMENTS'].filter(Boolean),
      allowedNow: ['Keep blocked. Use no-file and redacted/sample-document flows.'],
      blockedUntilReady: ['Unredacted notices, tax returns, SSNs/ITINs, bank data, transcripts, W-2/1099s, and real taxpayer uploads.'],
      ownerAction: 'Complete security controls and written approval before enabling live upload flags.'
    }),
    buildGate({
      key: 'official_tax_form_output',
      label: 'Final official IRS/NYS/NYC form output',
      launchMode: officialOutputReady ? 'available_after_form_by_form_release' : 'controlled_qa_only',
      ready: officialOutputReady,
      required: ['official source URL', 'PDF checksum', 'field/coordinate lock', 'sample-filled visual QA', 'overflow and signature/date checks', 'professional release', 'client verification', 'payment/quote clearance', 'production security gate', 'form-by-form approval'],
      missing: [!env.official_form_output_approved && 'official form output approval', !env.professional_verification_complete && 'professional verification', !returnPrepComplianceReady && 'PTIN/NYS/NYC compliance review', !sensitiveDocsReady && 'sensitive document security gate'].filter(Boolean),
      allowedNow: ['Show readiness, interviews, planning, and controlled QA warnings.'],
      blockedUntilReady: ['Client-ready official tax-form PDFs, e-file, agency submission, or “ready to file” language.'],
      ownerAction: 'Approve forms one at a time only after official PDF capture, QA, professional signoff, and client verification.'
    }),
    buildGate({
      key: 'broad_public_marketing',
      label: 'Broad public marketing / paid ads',
      launchMode: broadMarketingReady ? 'ready_for_small_budget_launch_review' : 'limited_safe_start_only',
      ready: broadMarketingReady,
      required: ['custom domain HTTPS', 'paid pilot ops', 'sensitive document gate if marketing document upload', 'official form gate if marketing form output', 'analytics/follow-up staffing', 'support SLA'],
      missing: [!domainReady && 'custom domain HTTPS + PUBLIC_BASE_URL', !paidPilotReady && 'paid pilot ops', !sensitiveDocsReady && 'sensitive document gate', !officialOutputReady && 'official form output gate'].filter(Boolean),
      allowedNow: ['Organic/public review, community conversations, referral partner demos, and careful “free starting point” messaging.'],
      blockedUntilReady: ['High-volume paid traffic implying immediate secure upload, fast filing, guaranteed outcomes, or production-scale service.'],
      ownerAction: 'Start with small organic/referral outreach, not broad paid ads, until operations and security gates pass.'
    })
  ];

  const complete = gates.filter((g) => g.ready).length;
  const total = gates.length;
  const blockers = gates.flatMap((g) => g.ready ? [] : g.missing.map((m) => ({ gate: g.key, missing: m })));

  return {
    policy: PUBLIC_LAUNCH_COMPLETION_POLICY,
    completion_score: Math.round((complete / total) * 100),
    gate_count: total,
    gates_ready: complete,
    recommended_current_mode: broadMarketingReady ? 'broad_public_launch_review' : privatePilotReady ? 'limited_public_site_plus_invite_only_no_sensitive_private_pilot' : publicViewingReady ? 'public_site_review_only' : 'internal_review_until_domain_and_core_gates_pass',
    plain_english_answer: {
      public_site: publicViewingReady ? 'Can be shown carefully with no-sensitive-upload warnings.' : 'Not yet; finish domain/base URL and upload gate checks.',
      private_pilot: privatePilotReady ? 'Yes, invite-only and no real sensitive documents.' : 'Not yet; core secrets and safe public gate must pass.',
      paid_pilot: paidPilotReady ? 'Possible after owner review and manual SOP confirmation.' : 'Not yet; payment, email, and professional verification remain blocked.',
      live_sensitive_documents: sensitiveDocsReady ? 'Possible only after final owner/security approval.' : 'No. Keep real sensitive taxpayer documents blocked.',
      official_form_output: officialOutputReady ? 'Possible form-by-form after QA.' : 'No. Controlled QA only.',
      broad_marketing: broadMarketingReady ? 'Ready for small-budget review.' : 'No broad paid marketing yet.'
    },
    gates,
    blockers,
    compliance_reference_matrix: COMPLIANCE_REFERENCE_MATRIX,
    user_value_added_in_v042: [
      'A Taxpayer Action Center that routes visitors to notice, debt, unfiled-return, amended-return, gig-worker, and professional-reassurance paths.',
      'A review-level self-check that helps visitors understand when AI-only organization is not enough and when PTIN, EA, CPA, or tax attorney review may be safer.',
      'Clearer no-sensitive-upload rules before visitors upload, pay, call, or respond.'
    ],
    operating_counts: {
      users: count(store, 'users'),
      cases: count(store, 'cases'),
      professionals: count(store, 'professionals'),
      quotes: count(store, 'quotes'),
      payments: count(store, 'payments')
    },
    next_owner_sequence: [
      'Confirm Render root and www certificates are active, then switch PUBLIC_BASE_URL to https://justicetaxsolutions.com.',
      'Run full smoke tests on custom domain and Render URL.',
      'Configure transactional email and live Stripe webhook before paid pilot.',
      'Create/approve WISP, retention/deletion, incident response, backup/restore, staff MFA, and private storage/malware scanning before real documents.',
      'Use the tax-urgency triage as public routing guidance only; do not treat it as official deadline calculation, legal advice, or agency-response advice.',
      'Verify PTIN/professional roster and NY/NYS/NYC preparer obligations before return-preparation marketing.',
      'Release official forms one form at a time after source checksum, coordinate/field QA, sample-filled visual checks, professional release, and client verification.'
    ]
  };
}

function buildTaxNoticeNextStepGuide({ agency = '', notice = '', amount = '', deadline = '' } = {}) {
  const normalizedAgency = String(agency || '').toUpperCase();
  const likelyAgency = /NYS|NEW YORK STATE|DTF/.test(normalizedAgency) ? 'New York State' : /NYC|CITY/.test(normalizedAgency) ? 'New York City' : /IRS|CP|LT/.test(normalizedAgency) ? 'IRS' : 'IRS / New York State / NYC';
  return {
    headline: 'Do not panic, but do not ignore a tax notice.',
    agency: likelyAgency,
    notice_hint: String(notice || '').slice(0, 80),
    amount_hint: String(amount || '').slice(0, 80),
    deadline_hint: String(deadline || '').slice(0, 80),
    first_15_minutes: [
      'Put the notice in a safe place and keep the envelope if it shows a mailing date.',
      'Find the agency name, notice number, tax year, amount, and response deadline.',
      'Check whether the notice asks for payment, documents, identity verification, an amended return, or an explanation.',
      'Do not call a random number from an ad. Use official agency contact information or ask for professional review.',
      'Do not upload unredacted notices, full SSNs, bank information, wage statements, tax returns, or transcripts while the site is in no-sensitive pilot mode.'
    ],
    information_to_gather: [
      'Agency name and notice number',
      'Tax year or period',
      'Response deadline and date on the letter',
      'Amount due or refund adjustment, if any',
      'Whether you already filed the return for that year',
      'Whether you moved, changed jobs, had 1099/gig income, or missed a form',
      'Whether there is a levy, lien, garnishment, audit appointment, court, or criminal concern'
    ],
    urgent_escalation_flags: [
      'Same-day or next-day deadline',
      'Levy, wage garnishment, bank account hold, lien, seizure, summons, subpoena, criminal investigation, or fraud allegation',
      'Identity-theft notice or account access you did not authorize',
      'Large balance with inability to pay',
      'Audit or appeals deadline',
      'Business payroll, sales tax, trust-fund, or employee withholding issue'
    ],
    safe_platform_next_step: 'Use the free starting point with no file upload, or upload only redacted/sample copies until live sensitive upload approval is complete. Ask for EA/CPA/tax attorney review if the notice is urgent, high-dollar, collection-related, audit-related, or legally risky.',
    not_legal_or_tax_advice: 'This guide helps organize the next step. It is not a substitute for personalized tax, legal, or accounting advice.'
  };
}

module.exports = {
  PUBLIC_LAUNCH_COMPLETION_POLICY,
  COMPLIANCE_REFERENCE_MATRIX,
  buildPublicLaunchCompletionAudit,
  buildTaxNoticeNextStepGuide
};
