const CONTROLLED_PUBLIC_LAUNCH_POLICY = {
  version: '0.1.56',
  name: 'Final Controlled Public Launch Closeout + Deployment Preparation',
  current_mode: 'controlled_public_review_plus_invited_no_sensitive_real_users',
  core_rule: 'Useful for first real users only when no real sensitive taxpayer documents are uploaded or pasted.',
  not_ready_for: [
    'broad paid advertising',
    'real unredacted taxpayer document uploads',
    'final official IRS/NYS/NYC form output',
    'e-file or agency-submission claims',
    'automatic live scheduling claims',
    'guaranteed tax outcomes',
    'unrestricted professional review promises'
  ],
  public_message: 'Do not panic, but do not ignore tax notices. Start with safe facts, no file, or a redacted/sample document only.'
};

function hasEnv(env, key) {
  return Boolean(String((env || process.env)[key] || '').trim());
}

function envFlag(env, key) {
  return ['1', 'true', 'yes', 'on'].includes(String((env || process.env)[key] || '').toLowerCase());
}

function buildGate(key, label, ready, allowedNow, missing = [], notes = []) {
  return {
    key,
    label,
    ready: Boolean(ready),
    allowed_now: allowedNow,
    missing,
    notes,
    status: ready ? 'ready_or_allowed_in_controlled_mode' : 'blocked_or_external_setup_required'
  };
}

function buildExternalStatus(env = process.env) {
  const liveSensitive = envFlag(env, 'ALLOW_LIVE_SENSITIVE_UPLOADS') && envFlag(env, 'ACCEPT_LIVE_SENSITIVE_DOCUMENTS');
  const sampleAllowed = String(env.ALLOW_SAMPLE_UPLOADS || 'true').toLowerCase() !== 'false';
  const stripeReady = hasEnv(env, 'STRIPE_SECRET_KEY') && hasEnv(env, 'STRIPE_WEBHOOK_SECRET');
  const emailReady = hasEnv(env, 'SMTP_HOST') || hasEnv(env, 'RESEND_API_KEY') || hasEnv(env, 'SENDGRID_API_KEY') || hasEnv(env, 'POSTMARK_SERVER_TOKEN');
  const databaseReady = hasEnv(env, 'DATABASE_URL');
  const storageReady = ['s3', 'r2', 'gcs', 'azure'].includes(String(env.DOCUMENT_STORAGE_PROVIDER || '').toLowerCase()) || hasEnv(env, 'PRIVATE_DOCUMENT_BUCKET');
  const malwareReady = ['clamav', 'cloudmersive', 'metascan', 'virus_total', 'configured'].includes(String(env.MALWARE_SCAN_PROVIDER || '').toLowerCase()) || hasEnv(env, 'MALWARE_SCAN_API_KEY');
  const staffMfaReady = envFlag(env, 'STAFF_MFA_REQUIRED') || envFlag(env, 'MFA_REQUIRED');
  const publicBaseUrl = hasEnv(env, 'PUBLIC_BASE_URL');
  return {
    public_base_url_configured: publicBaseUrl,
    database_ready: databaseReady,
    stripe_live_ready: stripeReady,
    production_email_ready: emailReady,
    private_document_storage_ready: storageReady,
    malware_scanning_ready: malwareReady,
    staff_mfa_or_equivalent_marked_ready: staffMfaReady,
    sample_uploads_allowed: sampleAllowed,
    live_sensitive_uploads_enabled: liveSensitive,
    safe_flag_posture: !liveSensitive && sampleAllowed,
    secret_display_rule: 'Only boolean configuration status may be shown. Never show token, key, password, staff code, JWT, admin token, encryption key, or webhook secret values.'
  };
}

function buildFinalControlledPublicLaunchCloseout({ store = null, env = process.env } = {}) {
  const status = buildExternalStatus(env);
  const professionalCount = store && store.list ? store.list('professionals', (p) => !p.deleted_at).length : 0;
  const verifiedPros = store && store.list ? store.list('professionals', (p) => !p.deleted_at && ['verified', 'approved', 'active'].includes(String(p.status || p.credential_status || '').toLowerCase())).length : 0;
  const gates = [
    buildGate('public_website_viewing', 'Public website viewing', true, 'Allowed after deployment smoke test and HTTPS/domain check.', ['Confirm live /health version after Render deploy.', 'Confirm root and www HTTPS certificate status.'], ['Public pages must keep independence/no-guarantee/no-sensitive-upload language.']),
    buildGate('invited_first_real_users', 'Invited first real users', true, 'Allowed only for no-file or redacted/sample-only starts.', ['Owner must invite a small cohort and monitor feedback.', 'Staff must review first cohort daily.'], ['Good for 5–20 controlled users, not broad marketing.']),
    buildGate('no_file_intake', 'No-file intake', true, 'Allowed now.', [], ['Best first real-user path.']),
    buildGate('redacted_sample_intake', 'Redacted/sample intake', status.sample_uploads_allowed, 'Allowed only when the user acknowledges the file is redacted/sample-only.', status.sample_uploads_allowed ? [] : ['ALLOW_SAMPLE_UPLOADS must not be false.'], ['Do not accept real notices, transcripts, W-2s, 1099s, returns, bank details, or full SSNs.']),
    buildGate('controlled_paid_pilot', 'Controlled paid pilot', false, 'Manual interest/quote recording only unless Stripe live keys, webhook, products, prices, email, and SOPs are tested.', ['Stripe live keys/webhook/products/prices not verified by ZIP.', 'Production email provider not verified by ZIP.', 'Quote/payment SOP must be approved.'], ['Safe to discuss pricing; do not imply live payment automation unless verified after deployment.']),
    buildGate('live_sensitive_uploads', 'Live sensitive taxpayer uploads', false, 'Blocked.', ['Managed DB', 'Private object storage', 'Malware scanning/quarantine', 'MFA/access controls', 'Approved WISP', 'Retention/deletion policy', 'Incident-response plan', 'Backup/restore testing', 'Owner security approval'], ['Keep ALLOW_LIVE_SENSITIVE_UPLOADS=false and ACCEPT_LIVE_SENSITIVE_DOCUMENTS=false.']),
    buildGate('official_form_output', 'Final official form output', false, 'Blocked; Form 9465 remains controlled QA only.', ['Official PDF capture/checksum/source record', 'Field/coordinate lock', 'Sample-filled PDF', 'Visual QA', 'Overflow/signature/direct-debit checks', 'Client verification', 'Required professional/staff approval', 'Production security gate'], ['Do not call generated drafts final IRS output.']),
    buildGate('efile_agency_submission', 'E-file or agency-submission claims', false, 'Blocked.', ['IRS authorized e-file provider/EFIN path must be complete and documented.', 'State/city submission rules must be configured.', 'Filing/signature/direct debit procedures must be approved.'], ['Do not claim direct IRS/NYS/NYC submission.']),
    buildGate('professional_review', 'Professional review at scale', verifiedPros > 0, verifiedPros > 0 ? 'Limited to verified professionals and documented scope.' : 'Request/triage only until roster and credentials are verified.', verifiedPros > 0 ? [] : ['Verified PTIN/EA/CPA/tax attorney roster not present in local data.'], [`Current local verified professional count: ${verifiedPros} of ${professionalCount}.`]),
    buildGate('broad_marketing', 'Broad public marketing', false, 'Blocked.', ['Domain/SSL, email, Stripe, professionals, WISP, data handling, official-form QA, and owner approval must be complete.'], ['Public website review and careful invited testing are different from broad marketing.'])
  ];
  const goNoGo = {
    public_website_viewing: 'go_after_live_smoke_test',
    invited_first_real_users: 'go_for_controlled_no_sensitive_only',
    no_file_intake: 'go',
    redacted_sample_intake: status.sample_uploads_allowed ? 'go_redacted_sample_only' : 'hold',
    controlled_paid_pilot: 'hold_until_stripe_email_sop_verified',
    broad_marketing: 'no_go',
    live_sensitive_uploads: 'no_go',
    final_official_form_output: 'no_go',
    efile_or_agency_submission_claims: 'no_go'
  };
  return {
    policy: CONTROLLED_PUBLIC_LAUNCH_POLICY,
    generated_at: new Date().toISOString(),
    external_status: status,
    current_recommended_mode: 'Deploy for public review and invite-only first users with no sensitive uploads.',
    readiness_statement: 'v0.1.56 is closer to deployment, but it does not convert the platform into a full production tax-data, official-form, payment, professional-review, or e-file system.',
    go_no_go: goNoGo,
    gates,
    first_user_limits: [
      'Invite a small cohort only; 5–20 users maximum before owner review.',
      'Prefer no-file intake. Use the Safe Summary Builder before asking for documents.',
      'Allow redacted/sample files only when the user confirms no real sensitive taxpayer data is included.',
      'Do not request full SSNs, full notices, transcripts, W-2s, 1099s, tax returns, bank details, direct debit details, or identity documents in the current mode.',
      'Escalate urgent, collection, levy, lien, garnishment, audit, tax court, criminal, payroll/sales-tax, trust-fund, large balance, or legal-risk issues.'
    ],
    after_deployment_checks: [
      'Confirm Render deploy completed from the intended Git commit.',
      'Confirm /health returns 0.1.56 on the Render URL.',
      'Smoke-test homepage, pricing, Safe Start, Action Center, Document Safety, Safe Summary, After You Start, and launch-readiness pages.',
      'Confirm custom domain and www HTTPS certificates are active before changing PUBLIC_BASE_URL to the custom domain.',
      'Confirm environment-status pages show only booleans/status labels, not secret values.',
      'Repeat no-file intake, blocked upload without acknowledgment, and redacted/sample acknowledged upload tests.',
      'Confirm Form 9465 final-output gate still says client final output is blocked.'
    ]
  };
}

function buildDeploymentPreparationChecklist(env = process.env) {
  const status = buildExternalStatus(env);
  return {
    title: 'v0.1.56 deployment preparation checklist',
    package_target: 'justice-tax-solutions-v0.1.56.zip',
    local_package_checks: [
      { key: 'zip_extracts_cleanly', label: 'ZIP extracts cleanly', owner: 'builder', required_before_deploy: true },
      { key: 'version_consistency', label: 'package.json, package-lock, README, tests, and health version are 0.1.56', owner: 'builder', required_before_deploy: true },
      { key: 'npm_check', label: 'npm run check passes from source and extracted ZIP', owner: 'builder', required_before_deploy: true },
      { key: 'npm_audit', label: 'npm audit --audit-level=moderate has no reported vulnerabilities', owner: 'builder', required_before_deploy: true },
      { key: 'no_secrets', label: 'No .env, node_modules, uploads, logs, runtime DB, captured PDFs, or secrets in ZIP', owner: 'builder', required_before_deploy: true }
    ],
    external_deployment_checks: [
      { key: 'render_service', label: 'Render service points to neutralboardroom/justice-tax-solutions-app and deploy succeeds', ready: false },
      { key: 'custom_domain_ssl', label: 'Root and www custom domains are verified and SSL certificate is active', ready: false },
      { key: 'public_base_url', label: 'PUBLIC_BASE_URL updated to final custom HTTPS URL after certificate works', ready: status.public_base_url_configured },
      { key: 'database', label: 'Managed production PostgreSQL configured before live sensitive taxpayer data', ready: status.database_ready },
      { key: 'email', label: 'Production transactional email configured and tested', ready: status.production_email_ready },
      { key: 'stripe', label: 'Stripe live products/prices/keys/webhook tested before charging real users', ready: status.stripe_live_ready },
      { key: 'private_storage', label: 'Private object storage and lifecycle/retention configured before live documents', ready: status.private_document_storage_ready },
      { key: 'malware', label: 'Malware scanning/quarantine configured before live documents', ready: status.malware_scanning_ready },
      { key: 'staff_access', label: 'MFA or equivalent staff/professional access control verified', ready: status.staff_mfa_or_equivalent_marked_ready }
    ],
    do_not_change_in_render_yet: [
      'ALLOW_LIVE_SENSITIVE_UPLOADS must stay false.',
      'ACCEPT_LIVE_SENSITIVE_DOCUMENTS must stay false.',
      'Do not enable e-file, direct submission, direct debit, final official forms, or broad marketing flags unless the missing controls are complete and Roger clearly approves.'
    ],
    first_live_smoke_test_order: [
      '/health',
      '/',
      '/pricing.html',
      '/first-public-user-start.html',
      '/taxpayer-action-center.html',
      '/document-safety-center.html',
      '/safe-tax-summary-builder.html',
      '/after-you-start.html',
      '/launch-readiness.html',
      '/controlled-public-launch-closeout.html',
      '/api/platform/final-controlled-launch-closeout',
      '/api/platform/deployment-preparation-checklist'
    ]
  };
}

function buildPublicNavigationAudit() {
  return {
    title: 'Public navigation and clutter audit',
    conclusion: 'Customer-facing navigation should route users to help paths, not internal owner checklists.',
    customer_primary_path: ['Home', 'Action Center', 'Urgency triage', 'Safe Summary', 'Pricing', 'Start free'],
    customer_support_path: ['Document Safety', 'After You Start', 'Contact', 'Feedback'],
    internal_or_owner_pages_kept_but_deemphasized: [
      '/public-launch-audit.html',
      '/public-launch-roadmap.html',
      '/real-user-launch-center.html',
      '/launch-readiness.html',
      '/controlled-public-launch-closeout.html',
      '/staff-pilot-ops.html',
      '/production-config.html',
      '/security-plan.html'
    ],
    changes_in_0_1_51: [
      'Homepage hero actions reduced to the clearest customer first steps.',
      'Internal launch/roadmap links moved lower or into readiness pages instead of the main customer hero.',
      'Launch-readiness copy clarified as owner/staff closeout rather than a customer promise.',
      'New closeout page separates what is safe for first users from what remains externally blocked.'
    ]
  };
}

function buildFirstCohortStaffOperatingGuide({ store = null } = {}) {
  const feedback = store && store.list ? store.list('first_user_feedback', (f) => !f.deleted_at) : [];
  return {
    title: 'First 5–20 user staff operating guide',
    cohort_limit: 'Invite 5–20 users, then pause for owner review before expanding.',
    acceptable_first_cases: [
      'No-file IRS/NYS/NYC notice questions with no urgent collection action.',
      'Redacted/sample notice summary where all private identifiers are removed.',
      'Unfiled or prior-year return organizer questions without uploading returns or wage documents.',
      'Gig-worker/self-employed organization questions with rough categories only, not full books or account data.',
      'Payment-plan education questions that do not ask the platform to submit directly to an agency.'
    ],
    defer_or_escalate: [
      'Levy, garnishment, lien, seizure, summons, tax court, audit appointment, criminal/fraud language, trust-fund/payroll/sales-tax exposure, identity theft, passport certification, or expiring deadline.',
      'Any request to upload full notices, returns, transcripts, W-2s, 1099s, bank information, SSNs, EINs, or identity documents before production security gates pass.',
      'Any case needing legal advice, agency representation, signed tax return preparation, e-file, direct debit, or official form release.'
    ],
    daily_staff_checklist: [
      'Review new no-file/redacted-sample submissions once per business day during the pilot.',
      'Confirm users did not paste private taxpayer details into descriptions or feedback.',
      'Send a safe follow-up that asks for categories and redacted facts, not full documents.',
      'Mark any urgent or professional-review-needed cases before suggesting next steps.',
      'Record payment interest as quote/request only unless Stripe/email/payment SOPs are live-tested.',
      'Stop inviting new users if two or more users are confused about sensitive uploads, government affiliation, filing, payments, or professional scope.'
    ],
    feedback_snapshot: {
      feedback_records: feedback.length,
      sensitive_data_attempts: feedback.filter((f) => f.sensitive_data_attempt).length,
      final_action_confusion: feedback.filter((f) => f.final_action_confusion).length,
      payment_or_professional_confusion: feedback.filter((f) => f.payment_or_professional_confusion).length
    }
  };
}

function buildComplianceSourceFreshness() {
  return {
    title: 'Compliance source freshness notes for launch closeout',
    source_priority_rule: 'Use official IRS, NYS, NYC, FTC, and provider documentation before enabling professional, taxpayer-data, payment, or filing claims.',
    verified_sources: [
      {
        key: 'irs_ptin_2026',
        source: 'IRS PTIN requirements for tax return preparers',
        url: 'https://www.irs.gov/tax-professionals/ptin-requirements-for-tax-return-preparers',
        platform_control: 'Keep PTIN review as a separate verified credential gate for compensated federal return preparation; do not advertise paid preparer-reviewed filing without active PTIN controls.',
        current_note: 'IRS says 2026 PTIN applications and renewals are being processed, and anyone who prepares or assists in preparing federal returns for compensation must have a valid 2026 PTIN before preparing returns.'
      },
      {
        key: 'irs_pub_4557_wisp',
        source: 'IRS Publication 4557, Safeguarding Taxpayer Data',
        url: 'https://www.irs.gov/pub/irs-pdf/p4557.pdf',
        platform_control: 'Keep live sensitive uploads blocked until WISP, safeguards, staff training/access controls, private storage, scanning, retention, incident response, and backup/restore procedures are approved.',
        current_note: 'IRS Pub. 4557 states data security is necessary for every tax professional and Authorized IRS e-file Provider and explains that tax return preparers must create and enact security plans under the FTC Safeguards Rule.'
      },
      {
        key: 'irs_efile_efin',
        source: 'IRS Become an authorized e-file provider',
        url: 'https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider',
        platform_control: 'Keep e-file and direct IRS submission claims blocked until authorized e-file provider application, suitability check, and EFIN acceptance path are complete and documented.',
        current_note: 'IRS describes the e-file provider process as access e-file application, submit application, and pass suitability check; approval results in an EFIN.'
      },
      {
        key: 'nys_tax_preparer_registration',
        source: 'NYS Tax Department tax preparer and facilitator registration',
        url: 'https://www.tax.ny.gov/tp/reg/tpreg.htm',
        platform_control: 'Keep New York preparer registration/NYTPRIN/CPE/posting/Bill-of-Rights checks in professional operations before New York return preparation or facilitation at scale.',
        current_note: 'NYS generally requires tax return preparers or facilitators to register annually unless exempt; commercial preparers can have fee/CPE requirements and must comply with posting, disclosure, NYTPRIN signature, and e-file rules.'
      }
    ],
    unresolved_before_broad_launch: [
      'Confirm whether NYC consumer-protection tax-preparer disclosure requirements apply to any physical or NYC-targeted service model.',
      'Finalize WISP/security plan and incident-response plan with responsible owner approval.',
      'Document professional credential verification and scope-of-work procedures for PTIN preparers, EAs, CPAs, and tax attorneys.',
      'Document e-file/EFIN path before any e-file, agency-submission, or direct filing claim.'
    ]
  };
}

function buildPrivacySafeAnalyticsAudit() {
  return {
    title: 'Privacy-safe analytics and logging audit',
    allowed: ['page path', 'referral code', 'campaign source/medium/name', 'case type/category', 'safe lane', 'non-sensitive readiness score', 'boolean safety flags'],
    blocked: ['SSNs', 'EINs', 'tax account numbers', 'bank information', 'full notice text', 'unredacted tax facts', 'exact balances in analytics', 'uploaded file contents', 'secret values'],
    rule: 'Analytics and staff dashboards may track routing and conversion, but not sensitive taxpayer content.'
  };
}

module.exports = {
  CONTROLLED_PUBLIC_LAUNCH_POLICY,
  buildFinalControlledPublicLaunchCloseout,
  buildDeploymentPreparationChecklist,
  buildPublicNavigationAudit,
  buildFirstCohortStaffOperatingGuide,
  buildComplianceSourceFreshness,
  buildPrivacySafeAnalyticsAudit
};
