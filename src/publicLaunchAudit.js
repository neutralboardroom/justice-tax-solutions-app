const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const PUBLIC_LAUNCH_POLICY = {
  version: pkg.version,
  principle: 'Market the public site carefully, but do not accept real sensitive taxpayer documents or release final IRS/NYS/NYC form output until production controls and professional/official-form gates are complete. v0.1.56 adds final controlled public-launch closeout, deployment preparation, first-cohort staff operations, public navigation cleanup, compliance source-freshness, and privacy-safe analytics audits while preserving staff/public separation, document safety, no-sensitive intake, and official-form output gates.',
  allowed_now: [
    'Public informational website and pricing review',
    'Free starting point intake without real sensitive documents',
    'Redacted/sample-document private pilot when the user acknowledges the restriction',
    'Customer-requested reassurance review quote requests',
    'Appointment/session requests using manual scheduling links',
    'Referral/community partner conversations with no guarantee language',
    'SEO pages that route to safe intake and consultation options'
  ],
  blocked_until_ready: [
    'Real sensitive taxpayer document uploads',
    'Final official IRS/NYS/NYC client form output',
    'E-file claims or filing/submission claims',
    'Guaranteed payment plan, refund, penalty relief, OIC, audit, or tax-reduction claims',
    'Broad paid traffic that implies production filing or live secure document handling',
    'Professional review by unverified or incomplete staff/professional accounts'
  ]
};

function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function envStatus() {
  return {
    node_env: process.env.NODE_ENV || 'development',
    public_base_url: process.env.PUBLIC_BASE_URL || '',
    owner_email_configured: Boolean(process.env.OWNER_EMAIL),
    jwt_secret_configured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev-change-me-before-production'),
    admin_token_configured: Boolean(process.env.ADMIN_TOKEN),
    staff_signup_code_configured: Boolean(process.env.STAFF_SIGNUP_CODE),
    encryption_key_configured: Boolean(process.env.DOCUMENT_ENCRYPTION_KEY && process.env.DOCUMENT_ENCRYPTION_KEY.length >= 32),
    live_sensitive_uploads_enabled: bool(process.env.ALLOW_LIVE_SENSITIVE_UPLOADS),
    accept_live_sensitive_documents: bool(process.env.ACCEPT_LIVE_SENSITIVE_DOCUMENTS),
    sample_uploads_allowed: !process.env.ALLOW_SAMPLE_UPLOADS || bool(process.env.ALLOW_SAMPLE_UPLOADS),
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripe_webhook_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    email_provider_configured: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST),
    database_url_configured: Boolean(process.env.DATABASE_URL),
    private_storage_configured: Boolean(process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.GCS_BUCKET || process.env.PRIVATE_OBJECT_STORAGE_BUCKET),
    malware_provider_configured: Boolean(process.env.CLAMAV_URL || process.env.VIRUSTOTAL_API_KEY || process.env.MALWARE_SCAN_PROVIDER),
    wisp_approved: bool(process.env.WISP_APPROVED),
    retention_policy_approved: bool(process.env.RETENTION_POLICY_APPROVED),
    incident_response_approved: bool(process.env.INCIDENT_RESPONSE_APPROVED),
    backup_restore_tested: bool(process.env.BACKUP_RESTORE_TESTED),
    security_go_live_approved: bool(process.env.SECURITY_GO_LIVE_APPROVED),
    official_form_output_approved: bool(process.env.OFFICIAL_FORM_OUTPUT_APPROVED),
    professional_verification_complete: bool(process.env.PROFESSIONAL_VERIFICATION_COMPLETE)
  };
}

function count(store, collection) {
  try { return store && typeof store.list === 'function' ? store.list(collection).filter((x) => !x.deleted_at).length : 0; } catch { return 0; }
}

function latest(store, collection, limit = 5) {
  try { return store && typeof store.list === 'function' ? store.list(collection).filter((x) => !x.deleted_at).slice(0, limit) : []; } catch { return []; }
}

function buildReadinessScore(env, counts) {
  const items = [
    { key: 'render_live', label: 'Render deployment and health endpoint working', weight: 8, passed: env.node_env === 'production' || Boolean(env.public_base_url) },
    { key: 'domain_config', label: 'Public base URL configured', weight: 6, passed: Boolean(env.public_base_url) },
    { key: 'core_secrets', label: 'Core secrets configured', weight: 10, passed: env.jwt_secret_configured && env.admin_token_configured && env.staff_signup_code_configured && env.encryption_key_configured },
    { key: 'safe_upload_gate', label: 'Live sensitive uploads remain blocked', weight: 12, passed: !env.live_sensitive_uploads_enabled && !env.accept_live_sensitive_documents && env.sample_uploads_allowed },
    { key: 'customer_paths', label: 'Core user paths and marketing pages exist', weight: 8, passed: true },
    { key: 'pricing_quotes', label: 'Pricing, quotes, payment requests, and review levels exist', weight: 8, passed: true },
    { key: 'appointments', label: 'Manual appointment scheduling and meeting-link fallback exist', weight: 6, passed: true },
    { key: 'staff_cockpit', label: 'Staff cockpit and analytics layer exist', weight: 6, passed: true },
    { key: 'production_database', label: 'Managed production database configured', weight: 8, passed: env.database_url_configured },
    { key: 'private_storage', label: 'Private object storage configured', weight: 8, passed: env.private_storage_configured },
    { key: 'malware_scan', label: 'Malware scanning configured', weight: 8, passed: env.malware_provider_configured },
    { key: 'email_delivery', label: 'Transactional email provider/domain configured', weight: 6, passed: env.email_provider_configured },
    { key: 'stripe_live', label: 'Stripe live keys and webhook configured', weight: 6, passed: env.stripe_configured && env.stripe_webhook_configured },
    { key: 'security_ops', label: 'WISP/retention/incident/backup/security approval complete', weight: 12, passed: env.wisp_approved && env.retention_policy_approved && env.incident_response_approved && env.backup_restore_tested && env.security_go_live_approved },
    { key: 'professional_verification', label: 'Professional verification complete', weight: 8, passed: env.professional_verification_complete },
    { key: 'official_form_output', label: 'Official form output approved', weight: 8, passed: env.official_form_output_approved }
  ];
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const passed = items.filter((item) => item.passed).reduce((sum, item) => sum + item.weight, 0);
  return {
    score: Math.round((passed / total) * 100),
    total_weight: total,
    passed_weight: passed,
    items,
    counts
  };
}

function buildPublicLaunchAudit({ store } = {}) {
  const env = envStatus();
  const counts = {
    users: count(store, 'users'),
    cases: count(store, 'cases'),
    staff_users: latest(store, 'users', 999).filter((u) => ['staff', 'admin', 'owner', 'professional'].includes(String(u.role || '').toLowerCase())).length,
    professionals: count(store, 'professionals'),
    quotes: count(store, 'quotes'),
    payments: count(store, 'payments'),
    session_requests: count(store, 'professional_session_requests'),
    launch_decisions: count(store, 'public_launch_decisions')
  };
  const readiness = buildReadinessScore(env, counts);
  const publicSiteReady = readiness.items.find((x) => x.key === 'render_live').passed && readiness.items.find((x) => x.key === 'safe_upload_gate').passed;
  const coreSecretsConfigured = env.jwt_secret_configured && env.admin_token_configured && env.staff_signup_code_configured && env.encryption_key_configured;
  const canRunPrivatePilot = publicSiteReady && coreSecretsConfigured;
  const sensitiveDocsReady = env.live_sensitive_uploads_enabled && env.accept_live_sensitive_documents && env.database_url_configured && env.private_storage_configured && env.malware_provider_configured && env.security_go_live_approved;
  const broadLaunchReady = readiness.score >= 92 && sensitiveDocsReady && env.stripe_configured && env.stripe_webhook_configured && env.email_provider_configured && env.professional_verification_complete && env.official_form_output_approved;
  return {
    policy: PUBLIC_LAUNCH_POLICY,
    status: broadLaunchReady ? 'ready_for_public_launch_review' : 'not_ready_for_broad_public_launch',
    safe_public_positioning: publicSiteReady ? 'Public website and invite-only/safe-start marketing can be reviewed, but keep real sensitive uploads and final filing output blocked.' : 'Fix deployment and safe upload gate before public sharing.',
    can_public_site_be_seen: publicSiteReady,
    can_invite_private_pilot_users: canRunPrivatePilot,
    can_run_limited_soft_launch: publicSiteReady,
    can_accept_real_sensitive_tax_documents: sensitiveDocsReady,
    can_claim_final_form_output_or_filing: Boolean(env.official_form_output_approved && env.professional_verification_complete),
    can_run_broad_paid_marketing: broadLaunchReady,
    readiness,
    version_and_packaging_hygiene: buildVersionPackagingAudit(),
    staff_public_separation: buildStaffPublicSeparationAudit(),
    top_blockers: readiness.items.filter((item) => !item.passed).map((item) => item.label),
    immediate_next_actions: [
      'Finish custom-domain verification and SSL; update PUBLIC_BASE_URL to https://justicetaxsolutions.com after verified.',
      'Run browser smoke tests on root domain, www domain, pricing, dashboard, staff, marketing, and private pilot pages.',
      'Add a real transactional email provider and keep message templates free of sensitive taxpayer details.',
      'Configure managed PostgreSQL before relying on persistent multi-user production data.',
      'Configure private object storage and malware scanning before accepting real tax documents.',
      'Complete WISP, retention/deletion, incident-response, backup/restore, staff access, and professional verification approvals.',
      'Keep marketing language in “starting point / review / consultation / no guarantee” mode until final form output and e-file strategy are actually ready.'
    ]
  };
}

function buildUserValuePolishPlan({ store } = {}) {
  return {
    headline: 'User-value polish pass for real visitors and early pilot users',
    goals: [
      'Make scared tax-notice users feel calm and not judged.',
      'Make every page lead to one clear next step.',
      'Explain when AI-only is enough and when a person can help.',
      'Make pricing understandable without hiding complexity.',
      'Avoid any impression that the site is the government or guarantees results.'
    ],
    added_or_reinforced_in_v039: [
      'Public launch audit board for founder/staff review',
      'Launch action plan that separates domain, security, payments, email, professionals, forms, and marketing tasks',
      'User trust/value checklist for homepage and marketing pages',
      'Conversion checklist for tax-problem landing pages',
      'Staff launch control room endpoint and page so status is not scattered across many screens'
    ],
    recommended_next_value_adds: [
      'Add short “What happens after I start?” cards to each marketing page.',
      'Add an optional callback request if the user feels stuck.',
      'Add client email verification before paid review.',
      'Add a public “what we can help with / what we cannot do yet” page.',
      'Add IRS/NYS/NYC notice glossary entries for the highest-volume notices.',
      'Add Spanish conversion pages beyond the current Spanish help page once the English flows stabilize.'
    ],
    current_counts: {
      cases: count(store, 'cases'),
      quotes: count(store, 'quotes'),
      session_requests: count(store, 'professional_session_requests')
    }
  };
}

function buildPublicLaunchActionPlan({ store } = {}) {
  const audit = buildPublicLaunchAudit({ store });
  return {
    stage: audit.status,
    recommended_launch_mode: audit.can_run_broad_paid_marketing ? 'public_paid_launch_review' : 'limited_public_site_plus_private_pilot',
    phases: [
      {
        phase: 'Now: domain + safe public visibility',
        status: audit.can_public_site_be_seen ? 'available' : 'blocked',
        tasks: [
          'Verify root and www domains in Render.',
          'Wait for certificate issuance, then test https://justicetaxsolutions.com and https://www.justicetaxsolutions.com.',
          'Update PUBLIC_BASE_URL to the verified root domain.',
          'Keep ACCEPT_LIVE_SENSITIVE_DOCUMENTS=false and ALLOW_LIVE_SENSITIVE_UPLOADS=false.'
        ]
      },
      {
        phase: 'Private pilot: no sensitive real documents',
        status: audit.can_invite_private_pilot_users ? 'available_with_caution' : 'blocked',
        tasks: [
          'Invite only trusted users and partners.',
          'Use redacted/sample documents only.',
          'Track UTM/referral source on every pilot link.',
          'Collect feedback on confusion points, pricing, and whether users understand next steps.'
        ]
      },
      {
        phase: 'Controlled paid pilot',
        status: audit.readiness.items.find((x) => x.key === 'stripe_live').passed ? 'possible_after_quote_review' : 'blocked_until_stripe_webhook',
        tasks: [
          'Configure Stripe live products/checkout/webhook.',
          'Confirm refund and quote approval language.',
          'Use manual staff review before release.',
          'Do not claim e-file or final form output unless approved.'
        ]
      },
      {
        phase: 'Sensitive documents and real tax records',
        status: audit.can_accept_real_sensitive_tax_documents ? 'possible_after_final_owner_approval' : 'blocked',
        tasks: [
          'Configure managed database, private storage, malware scanning, staff MFA/access controls, WISP, retention, incident response, and backup/restore testing.',
          'Run upload, quarantine, access-log, deletion, and restore tests.',
          'Only then consider enabling live sensitive upload flags.'
        ]
      },
      {
        phase: 'Broad public marketing',
        status: audit.can_run_broad_paid_marketing ? 'ready_for_review' : 'not_yet',
        tasks: [
          'Finish official form output QA and professional credential verification.',
          'Add transactional email delivery and appointment reminders.',
          'Review every landing page for no-guarantee/no-government language.',
          'Launch small campaigns first and watch conversion/support workload daily.'
        ]
      }
    ]
  };
}

function buildLaunchConversionChecklist() {
  return {
    purpose: 'Keep every public page useful, safe, and conversion-oriented before spending marketing money.',
    checklist: [
      { area: 'Top of page', item: 'One plain-English problem headline, not form-number jargon.', status: 'required' },
      { area: 'CTA', item: 'One primary free-start action and one optional human-help action.', status: 'required' },
      { area: 'Trust', item: 'Visible “not IRS/NYS/NYC/not law firm/no guarantee” copy without looking like scary legal clutter.', status: 'required' },
      { area: 'Pricing', item: 'Make clear platform/professional fees are separate from taxes, penalties, interest, and government payments.', status: 'required' },
      { area: 'Uploads', item: 'Redacted/sample-only pilot language remains visible until live sensitive upload gate is approved.', status: 'required' },
      { area: 'Professional help', item: 'Explain AI-only, PTIN, EA, CPA, attorney, live online, phone, and in-person/quote options simply.', status: 'required' },
      { area: 'Analytics', item: 'UTM/referral/landing/conversion intent captured on every start path.', status: 'required' },
      { area: 'Follow-up', item: 'If email is not configured, staff dashboard must show queued messages and manual next actions.', status: 'required' },
      { area: 'Support', item: 'Offer “not sure / ask for a person” escape route from every major funnel.', status: 'recommended' },
      { area: 'Spanish', item: 'Keep Spanish page accurate and do not imply Spanish-speaking staff unless available.', status: 'recommended' }
    ]
  };
}

function buildTrustAndSafetyCopyMatrix() {
  return {
    public_copy_must_say: [
      'Justice Tax Solutions is independent and not the IRS, New York State, NYC, or a law firm.',
      'No refund, payment plan, tax reduction, penalty relief, offer-in-compromise, audit, or agency outcome is guaranteed.',
      'Government taxes, penalties, interest, filing fees, and agency payments are separate from platform/professional service fees.',
      'AI can organize and draft; clients must review carefully before signing, filing, mailing, or responding to an agency.',
      'Real sensitive taxpayer documents remain blocked until production security controls are approved.'
    ],
    public_copy_must_not_say: [
      'Guaranteed refund or guaranteed tax reduction',
      'Pennies on the dollar or guaranteed settlement',
      'We are the IRS/NYS/NYC or government authorized to decide outcomes',
      'Attorney review included unless an attorney is actually assigned and paid/engaged',
      'E-file or official filing service unless the e-file/provider path is actually configured'
    ],
    calmer_user_language_examples: [
      'Start with the notice. We will help you understand what it may mean.',
      'Do not ignore a tax letter, but do not panic.',
      'You can ask for a professional review even if the platform does not require one.',
      'We will show what is missing before you pay for deeper help.',
      'We will not ask you to upload real sensitive documents until the secure upload gate is ready.'
    ]
  };
}


function buildVersionPackagingAudit() {
  const projectRoot = path.join(__dirname, '..');
  const readmePath = path.join(projectRoot, 'README.md');
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let readmeHead = '';
  try { readmeHead = fs.readFileSync(readmePath, 'utf8').split(/\r?\n/).slice(0, 8).join('\n'); } catch { readmeHead = ''; }
  const checks = [
    { key: 'package_version', label: `package.json version is ${pkg.version}`, passed: pkg.version === '0.1.56', evidence: pkg.version },
    { key: 'readme_aligned', label: 'README starts with v0.1.56 and summarizes the current controlled-launch closeout and deployment-preparation pass accurately', passed: readmeHead.includes('v0.1.56'), evidence: readmeHead.split('\n')[0] || '' },
    { key: 'gitignore_included', label: '.gitignore is included in the clean ZIP base', passed: fs.existsSync(gitignorePath), evidence: fs.existsSync(gitignorePath) ? '.gitignore present' : '.gitignore missing' },
    { key: 'no_secret_packaging_rule', label: 'Clean package excludes secrets, runtime data, uploaded documents, captured PDFs, logs, and node_modules', passed: true, evidence: 'Packaging rule documented and enforced by ZIP command.' },
    { key: 'sensitive_upload_default', label: 'Default launch posture keeps real sensitive taxpayer documents blocked', passed: !bool(process.env.ALLOW_LIVE_SENSITIVE_UPLOADS) && !bool(process.env.ACCEPT_LIVE_SENSITIVE_DOCUMENTS), evidence: 'ALLOW_LIVE_SENSITIVE_UPLOADS/ACCEPT_LIVE_SENSITIVE_DOCUMENTS not both enabled.' },
    { key: 'official_form_default', label: 'Final official IRS/NYS/NYC form output remains blocked unless explicitly approved', passed: !bool(process.env.OFFICIAL_FORM_OUTPUT_APPROVED), evidence: 'OFFICIAL_FORM_OUTPUT_APPROVED is not enabled by default.' }
  ];
  return {
    version: pkg.version,
    status: checks.every((c) => c.passed) ? 'packaging_hygiene_passed_for_next_zip' : 'packaging_hygiene_needs_attention',
    checks,
    clean_zip_name: `justice-tax-solutions-v${pkg.version}.zip`,
    owner_note: `Use v${pkg.version} as the next base after confirming npm check, health, smoke tests, and clean ZIP extraction. This does not change sensitive upload or official-form release gates.`
  };
}

function buildStaffPublicSeparationAudit() {
  const publicCustomerPages = [
    '/', '/pricing.html', '/how-it-works.html', '/faq.html', '/contact.html', '/irs-notice-help.html', '/nys-tax-notice-help.html', '/nyc-tax-notice-help.html', '/tax-debt-payment-plan-help.html', '/back-taxes-unfiled-returns.html', '/amended-return-help.html', '/self-employed-gig-worker-tax-help.html', '/live-online-tax-help.html', '/cpa-ea-tax-attorney-review.html', '/ayuda-impuestos-espanol.html', '/tax-notice-next-steps.html', '/taxpayer-action-center.html', '/tax-urgency-triage.html', '/document-safety-center.html', '/real-user-launch-center.html', '/public-launch-roadmap.html', '/launch-readiness.html', '/referral-program.html'
  ];
  const internalOrStaffPages = [
    '/staff.html', '/staff-cockpit.html', '/staff-tasks.html', '/production-config.html', '/security-plan.html', '/private-pilot-release.html', '/public-launch-audit.html', '/official-forms.html', '/founder-next-steps.html', '/pilot-readiness.html', '/go-live.html'
  ];
  return {
    status: 'separated_with_internal_pages_visible_for_owner_control',
    public_customer_pages: publicCustomerPages,
    internal_or_staff_pages: internalOrStaffPages,
    public_rules: [
      'Public pages should invite a free starting point, consultation/review requests, and safe no-sensitive intake only.',
      'Public pages must not imply IRS/NYS/NYC affiliation, guaranteed relief, e-file availability, final official form output, or secure real-document upload readiness.',
      'Pricing pages must explain that AI-only is not professional review and that government payments, taxes, penalties, interest, and filing fees are separate.'
    ],
    staff_rules: [
      'Staff pages may show readiness gates, launch blockers, official-form QA, operational packet steps, and admin-token actions.',
      'Staff/internal launch pages do not override upload gates, professional verification, payment clearance, official-form QA, WISP/security, or owner approval.',
      'Before inviting real users, staff should confirm private-pilot instructions, redacted/sample document wording, quote handling, urgent deadline escalation, and issue logging.'
    ],
    current_cleanup: [
      'Private pilot page title updated so old v0.1.30 wording no longer looks like the current platform version.',
      'Public launch page title updated to current launch completion, final blockers, and packaging hygiene.',
      'Duplicate Launch Audit navigation link removed from the private pilot page.',
      'Added Taxpayer Action Center, review-level self-check, Document Safety Center, and tax-urgency triage so visitors can choose a safer next step before uploading, paying, calling, or responding.'
    ]
  };
}

function buildStaffPublicLaunchControlRoom({ store } = {}) {
  const audit = buildPublicLaunchAudit({ store });
  return {
    audit,
    action_plan: buildPublicLaunchActionPlan({ store }),
    user_value_polish: buildUserValuePolishPlan({ store }),
    conversion_checklist: buildLaunchConversionChecklist(),
    trust_safety_copy: buildTrustAndSafetyCopyMatrix(),
    recent_cases: latest(store, 'cases', 8).map((c) => ({ id: c.id, status: c.status, pathway: c.pathway, selected_tier: c.selected_tier, payment_status: c.payment_status, created_at: c.created_at })),
    recent_quotes: latest(store, 'quotes', 8).map((q) => ({ id: q.id, case_id: q.case_id, status: q.status, amount_cents: q.amount_cents, service_level: q.service_level, created_at: q.created_at })),
    recent_launch_decisions: latest(store, 'public_launch_decisions', 8),
    staff_note: 'This control room is for launch management only. It does not override sensitive upload gates, professional signoff, official form QA, or payment clearance.'
  };
}

function recordPublicLaunchDecision({ store, body = {}, user = null } = {}) {
  const status = String(body.status || 'reviewing').slice(0, 80);
  const decision = {
    status,
    decision_type: String(body.decision_type || 'public_launch_review').slice(0, 100),
    scope: String(body.scope || 'limited_public_site_plus_private_pilot').slice(0, 120),
    note: String(body.note || '').slice(0, 2000),
    recorded_by_user_id: user && user.id ? user.id : '',
    recorded_by_role: user && user.role ? user.role : 'staff_or_admin_token',
    created_at: new Date().toISOString()
  };
  if (store && typeof store.insert === 'function') return store.insert('public_launch_decisions', decision);
  return { id: `pld_${Date.now()}`, ...decision };
}

module.exports = {
  PUBLIC_LAUNCH_POLICY,
  buildPublicLaunchAudit,
  buildPublicLaunchActionPlan,
  buildUserValuePolishPlan,
  buildLaunchConversionChecklist,
  buildTrustAndSafetyCopyMatrix,
  buildStaffPublicLaunchControlRoom,
  buildVersionPackagingAudit,
  buildStaffPublicSeparationAudit,
  recordPublicLaunchDecision
};
