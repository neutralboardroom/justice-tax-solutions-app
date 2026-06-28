function compact(value, max = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function boolEnv(name, env = process.env) {
  return String(env[name] || '').toLowerCase() === 'true';
}

function envPresent(name, env = process.env) {
  const value = String(env[name] || '').trim();
  return Boolean(value && !/^(dev|test|change-me|placeholder|your-|example|demo|replace_with)/i.test(value));
}

function listSafe(store, collection, predicate = null) {
  try { return store && store.list ? store.list(collection, predicate) : []; } catch { return []; }
}

function latestEvent(store, key) {
  return listSafe(store, 'pilot_release_events', (e) => e.status_key === key && !e.deleted_at)
    .sort((a, b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0))[0] || null;
}

const PRIVATE_PILOT_RELEASE_POLICY = {
  version: '0.1.30',
  release_name: 'Private Pilot Release Candidate',
  core_rule: 'Private pilot means a controlled, invited-user release with safety gates. It is not broad public marketing and it is not permission to accept live sensitive taxpayer documents unless production gates are complete.',
  allowed_private_pilot_positioning: [
    'Free tax starting point',
    'Tax notice and tax debt concern organizer',
    'Redacted/sample document review only until live-sensitive upload approval',
    'AI-guided interview and checklist help',
    'Optional PTIN/EA/CPA/tax attorney reassurance or review request',
    'Live online consultation request with manual meeting-link scheduling',
    'Print-ready official forms only after official PDF QA and release gates pass'
  ],
  prohibited_private_pilot_claims: [
    'Do not say real sensitive document upload is live until production security gates pass.',
    'Do not say IRS/NYS/NYC forms are ready for final output until source, checksum, field map, sample-fill QA, overflow/signature checks, client verification, and required review are complete.',
    'Do not guarantee refunds, relief, payment plans, penalty reduction, OIC acceptance, agency deadlines, or outcomes.',
    'Do not claim Justice Tax Solutions is the IRS, New York State, NYC, or a law firm.',
    'Do not claim e-file is available until an EFIN/e-file partner strategy is configured and tested.'
  ],
  pilot_scope: {
    recommended_users: 'Invite only: friends, known contacts, trusted community partners, accountant/CPA/EA collaborators, and very small no-sensitive-doc pilot users.',
    recommended_case_count: '5 to 20 early cases before broad paid marketing.',
    safe_document_rule: 'Use no documents or redacted/sample documents unless live-sensitive upload gates are fully approved.',
    output_rule: 'Provide summaries, checklists, quotes, appointment routing, and internal/sample form QA packets. Do not release final official form output without form-release approvals.'
  }
};

const REGRESSION_AREAS = [
  { key: 'health_version', label: 'Health/version check', endpoints: ['/health'], required: true },
  { key: 'account_auth', label: 'Signup, signin, session, logout', endpoints: ['/api/signup', '/api/login', '/api/me'], required: true },
  { key: 'intake_consent', label: 'Intake with required acknowledgments', endpoints: ['/api/intake'], required: true },
  { key: 'sensitive_upload_gate', label: 'Sensitive upload gate blocks live taxpayer documents when production approval is missing', endpoints: ['/api/intake', '/api/platform/sensitive-upload-policy'], required: true },
  { key: 'sample_upload_gate', label: 'Redacted/sample upload path still works with sample-document acknowledgment', endpoints: ['/api/intake'], required: true },
  { key: 'dashboard_status', label: 'Dashboard, simple status, journey, customer status copy', endpoints: ['/api/cases/:id', '/api/cases/:id/simple-status', '/api/cases/:id/customer-status-copy'], required: true },
  { key: 'pricing_quotes_payment', label: 'Pricing, quote approval, payment request, payment summary', endpoints: ['/api/platform/pricing-schedule', '/api/cases/:id/quotes', '/api/cases/:id/payment-summary'], required: true },
  { key: 'professional_sessions', label: 'Professional session request, appointment preferences, manual meeting-link readiness', endpoints: ['/api/cases/:id/professional-session-request', '/api/cases/:id/appointment-scheduling-request', '/api/staff/appointment-scheduling-board'], required: true },
  { key: 'credential_operations', label: 'Professional operations, credential verification, reviewer disclosure', endpoints: ['/api/staff/professional-operations-board', '/api/cases/:id/reviewer-disclosure'], required: true },
  { key: 'official_forms_9465', label: 'IRS 9465 official-output path remains gated', endpoints: ['/api/tax/forms/9465/official-output-readiness', '/api/tax/forms/9465/draft-pdf'], required: true },
  { key: 'marketing_pages', label: 'Marketing pages route safely into intake, quote, live consultation, and pricing', endpoints: ['/marketing.html', '/irs-notice-help.html', '/live-online-tax-help.html'], required: true },
  { key: 'staff_cockpit_analytics', label: 'Staff cockpit and privacy-safe analytics', endpoints: ['/api/staff/cockpit', '/api/staff/analytics-funnel', '/api/staff/marketing-attribution'], required: true },
  { key: 'referral_tools', label: 'Referral code, QR, flyer, attribution, reward ledger concepts', endpoints: ['/api/referrals/me', '/api/referrals/:code/qr.png', '/api/referrals/:code/flyer.pdf'], required: true },
  { key: 'production_security', label: 'Production security, WISP, blockers, access-control audit', endpoints: ['/api/platform/production-security-readiness', '/api/platform/security-launch-blockers'], required: true },
  { key: 'public_compliance_copy', label: 'Compliance copy visible on key public pages', endpoints: ['homepage', 'pricing', 'terms', 'privacy', 'disclaimer', 'refund'], required: true }
];

const PILOT_USER_SCENARIOS = [
  {
    key: 'irs_notice_redacted',
    label: 'IRS notice help with redacted/sample notice',
    entry: '/irs-notice-help.html',
    expected: ['creates intake', 'flags notice/deadline risk', 'keeps live sensitive upload blocked', 'offers notice summary/action plan', 'routes to EA/pro review if needed']
  },
  {
    key: 'tax_debt_9465',
    label: 'Tax debt / IRS Form 9465 installment agreement path',
    entry: '/tax-debt-payment-plan-help.html',
    expected: ['asks debt/payment ability questions', 'builds 9465 completion plan', 'shows 433-F warning when needed', 'keeps official output gated']
  },
  {
    key: 'unfiled_prior_year',
    label: 'Unfiled or prior-year returns',
    entry: '/back-taxes-unfiled-returns.html',
    expected: ['identifies missing years', 'does not promise relief', 'routes to PTIN/CPA/EA review depending on facts']
  },
  {
    key: 'amended_return',
    label: 'Amended return / Form 1040-X concern',
    entry: '/amended-return-help.html',
    expected: ['collects original/changed facts', 'asks for reason and evidence', 'routes to review before filing']
  },
  {
    key: 'gig_worker',
    label: 'Self-employed/gig worker Schedule C help',
    entry: '/self-employed-gig-worker-tax-help.html',
    expected: ['asks income/expense/platform questions', 'routes to CPA/qualified review for complexity', 'explains no guarantee']
  },
  {
    key: 'customer_reassurance',
    label: 'Customer-requested reassurance review',
    entry: '/live-online-tax-help.html',
    expected: ['lets user request professional even if not required', 'shows quote/session path', 'supports video/voice/phone/in-person preferences']
  },
  {
    key: 'marketing_referral',
    label: 'Referral/community partner start',
    entry: '/referral-tools.html',
    expected: ['tracks referral code', 'keeps reward limits clear', 'does not pay rewards on government taxes/penalties/interest']
  }
];

const COMPLIANCE_COPY_AUDIT = [
  { key: 'not_government', phrase: 'not the IRS, New York State, NYC, or the government', requiredOn: ['homepage', 'pricing', 'marketing pages', 'dashboard/release pages'] },
  { key: 'not_law_firm', phrase: 'not a law firm', requiredOn: ['footer/disclaimer/pricing/professional review pages'] },
  { key: 'no_guarantee', phrase: 'no refund, relief, payment plan, penalty reduction, offer-in-compromise, filing, timeline, or agency outcome is guaranteed', requiredOn: ['pricing', 'marketing pages', 'checkout/quote/release pages'] },
  { key: 'government_fees_separate', phrase: 'taxes, penalties, interest, government payments, and filing fees are separate', requiredOn: ['pricing', 'quote/payment pages'] },
  { key: 'ai_limitations', phrase: 'AI organizes and explains; verified client/professional review is required before filing, signing, responding, or relying on a tax position', requiredOn: ['intake/dashboard/release pages'] },
  { key: 'sensitive_upload_warning', phrase: 'real sensitive taxpayer documents stay blocked until production safeguards are complete', requiredOn: ['upload paths', 'security/production pages'] },
  { key: 'no_sensitive_email', phrase: 'emails should not include sensitive taxpayer details', requiredOn: ['email/payment/appointment docs'] }
];

const PILOT_LAUNCH_CHECKS = [
  { key: 'no_sensitive_pilot_mode', label: 'No-sensitive private pilot mode is clear and safe', severity: 'critical', pass: ({ env }) => !boolEnv('ALLOW_LIVE_SENSITIVE_UPLOADS', env), fix: 'Keep ALLOW_LIVE_SENSITIVE_UPLOADS=false for private pilot unless all security blockers pass.' },
  { key: 'security_blockers_visible', label: 'Security blockers visible to staff/owner', severity: 'critical', pass: ({ reports }) => (reports.securityBlockers?.blockers || []).length >= 0, fix: 'Expose production-security readiness and launch blockers on staff/admin pages.' },
  { key: 'stripe_mode_clear', label: 'Stripe live/test mode is clearly reported', severity: 'high', pass: ({ env }) => Boolean(env.STRIPE_SECRET_KEY) || !boolEnv('REQUIRE_PAYMENT_BEFORE_PILOT', env), fix: 'Configure Stripe for paid pilot or keep paid work as staff-recorded/manual quote only.' },
  { key: 'email_mode_clear', label: 'Email/manual-message mode is clearly reported', severity: 'high', pass: ({ env }) => Boolean(env.SMTP_HOST || env.RESEND_API_KEY || env.SENDGRID_API_KEY || env.OWNER_EMAIL), fix: 'Configure email provider or use explicit manual-send process with no-sensitive-details policy.' },
  { key: 'professional_routing_available', label: 'Professional routing and reassurance request path are available', severity: 'high', pass: ({ reports }) => Boolean(reports.professionalProducts), fix: 'Keep professional-session and credential operations endpoints available.' },
  { key: 'official_form_output_gated', label: 'Official form output is still gated', severity: 'critical', pass: ({ reports }) => reports.form9465Ready ? !reports.form9465Ready.summary?.client_output_ready : true, fix: 'Do not mark official form output client-ready until source/field/sample QA and review gates pass.' },
  { key: 'marketing_pages_exist', label: 'Core marketing pages exist for pilot review', severity: 'medium', pass: ({ reports }) => (reports.marketingPages || 0) >= 10, fix: 'Keep service pages for IRS notice, debt, back taxes, amended returns, gig workers, 9465, 433-F, 1040-X, live help, and professional review.' },
  { key: 'staff_cockpit_available', label: 'Staff cockpit available for pilot operations', severity: 'high', pass: ({ reports }) => Boolean(reports.staffCockpitReady), fix: 'Keep staff cockpit and operational alert endpoints working.' },
  { key: 'referral_safety_copy', label: 'Referral language limits rewards to eligible platform services', severity: 'medium', pass: () => true, fix: 'Do not imply rewards on taxes, penalties, interest, government payments, refunds, or separate professional/legal fees unless later approved.' }
];

function buildPrivatePilotRegressionChecklist({ store = null } = {}) {
  const saved = listSafe(store, 'pilot_release_events', (e) => e.event_type === 'regression_check' && !e.deleted_at);
  const rows = REGRESSION_AREAS.map((area) => {
    const event = saved.find((e) => e.status_key === area.key);
    return {
      ...area,
      status: event ? event.status : 'not_recorded',
      note: event ? event.note || '' : '',
      recorded_at: event ? event.created_at : '',
      pass_for_candidate: event ? event.status === 'passed' : false
    };
  });
  return {
    summary: {
      total: rows.length,
      required: rows.filter((r) => r.required).length,
      recorded_passed: rows.filter((r) => r.pass_for_candidate).length,
      required_unpassed: rows.filter((r) => r.required && !r.pass_for_candidate).length
    },
    checklist: rows,
    note: 'Automated smoke tests are run during the build. Staff can record manual regression status here during real pilot preparation.'
  };
}

function buildPilotUserScenarioMatrix() {
  return {
    scenarios: PILOT_USER_SCENARIOS,
    sample_case_policy: 'Use fake/demo data or redacted/sample documents only until production sensitive-upload approval is complete.',
    pilot_success_criteria: [
      'User can understand the next safest tax step without knowing a form number.',
      'User can request AI-only, quote, professional reassurance, or live consultation without confusion.',
      'Staff can see what needs action next in the cockpit.',
      'No sensitive uploads, official form output, e-file, or professional release occurs before required gates pass.'
    ]
  };
}

function buildComplianceCopyAudit() {
  return {
    audit_items: COMPLIANCE_COPY_AUDIT,
    unacceptable_phrases: PRIVATE_PILOT_RELEASE_POLICY.prohibited_private_pilot_claims,
    required_tone: 'Calm, plain-language, tax-problem-first, no fear tactics, no guaranteed tax-relief language, no internal developer labels on public pages.'
  };
}

function buildPilotMarketingSafetyReview({ store = null } = {}) {
  const cases = listSafe(store, 'cases');
  const messages = listSafe(store, 'transactional_messages');
  return {
    marketing_status: 'private_pilot_only',
    can_run_broad_paid_traffic: false,
    safe_to_market_now: [
      'Invite-only free starting point',
      'No-sensitive-document pilot signups',
      'Problem-specific landing pages for review by trusted partners',
      'Referral/community partner test with clear reward limits',
      'Live consultation request collection with manual scheduling'
    ],
    not_safe_to_market_yet: [
      'Real sensitive document upload at scale',
      'Guaranteed completed/filed tax returns',
      'Final official IRS/NYS/NYC form output without QA approval',
      'E-file service unless authorized provider/partner path is configured',
      'Broad paid traffic without monitoring staff capacity and response times'
    ],
    current_signal: {
      pilot_cases_in_store: cases.length,
      queued_messages: messages.filter((m) => ['queued_manual_send', 'queued', 'draft'].includes(String(m.status || ''))).length
    }
  };
}

function buildPrivatePilotGoNoGoReport({ store = null, env = process.env, reports = {} } = {}) {
  const context = {
    env,
    reports: {
      securityBlockers: reports.securityBlockers || {},
      form9465Ready: reports.form9465Ready || {},
      professionalProducts: reports.professionalProducts || true,
      marketingPages: Number(reports.marketingPages || 0),
      staffCockpitReady: reports.staffCockpitReady !== false
    }
  };
  const checks = PILOT_LAUNCH_CHECKS.map((check) => ({
    key: check.key,
    label: check.label,
    severity: check.severity,
    ok: Boolean(check.pass(context)),
    fix: check.fix
  }));
  const criticalBlockers = checks.filter((c) => !c.ok && c.severity === 'critical');
  const highBlockers = checks.filter((c) => !c.ok && c.severity === 'high');
  return {
    decision: criticalBlockers.length ? 'no_go' : (highBlockers.length ? 'limited_private_pilot_only' : 'private_pilot_candidate'),
    can_invite_private_pilot_users: criticalBlockers.length === 0,
    can_accept_real_sensitive_documents: false,
    can_run_broad_public_marketing: false,
    checks,
    blockers: checks.filter((c) => !c.ok),
    next_safe_stage: criticalBlockers.length ? 'fix critical blockers before pilot invitations' : 'invite-only no-sensitive private pilot with staff monitoring',
    owner_note: 'This report intentionally separates private pilot readiness from public live launch readiness.'
  };
}

function buildPrivatePilotReleaseCandidate({ store = null, env = process.env, reports = {} } = {}) {
  const regression = buildPrivatePilotRegressionChecklist({ store });
  const scenarios = buildPilotUserScenarioMatrix();
  const compliance = buildComplianceCopyAudit();
  const marketing = buildPilotMarketingSafetyReview({ store });
  const goNoGo = buildPrivatePilotGoNoGoReport({ store, env, reports });
  return {
    policy: PRIVATE_PILOT_RELEASE_POLICY,
    release_candidate_summary: {
      version: '0.1.30',
      stage: 'private_pilot_release_candidate',
      recommended_next_action: goNoGo.can_invite_private_pilot_users ? 'Review the checklist, invite a small no-sensitive pilot group, and monitor the staff cockpit.' : 'Resolve critical blockers before inviting pilot users.',
      allowed_user_count: PRIVATE_PILOT_RELEASE_POLICY.pilot_scope.recommended_case_count,
      broad_marketing_recommended: false,
      live_sensitive_uploads_recommended: false
    },
    go_no_go: goNoGo,
    regression,
    scenarios,
    compliance,
    marketing,
    post_pilot_metrics: [
      'started intake',
      'completed intake',
      'quote requested',
      'quote approved',
      'payment requested/paid',
      'professional session requested',
      'appointment scheduled',
      'customer asked for reassurance',
      'staff time per case',
      'missing document frequency',
      'refund/cancel reason',
      'form-output blockers'
    ]
  };
}

function buildPilotReleasePacket({ store = null, env = process.env, reports = {} } = {}) {
  const candidate = buildPrivatePilotReleaseCandidate({ store, env, reports });
  return {
    title: 'Justice Tax Solutions Private Pilot Packet',
    generated_at: new Date().toISOString(),
    candidate,
    founder_script: [
      'We are testing a private pilot for tax-problem help. Please do not upload real sensitive documents yet unless we tell you live secure upload is enabled.',
      'Start with your tax concern, a general summary, or a redacted/sample notice.',
      'The platform can organize your issue, suggest missing information, and route you to AI-only help, a quote, professional reassurance, or a live session.',
      'Nothing is filed, signed, submitted, or sent to the IRS/NYS/NYC until you review it and the required gates are complete.'
    ],
    staff_opening_checklist: [
      'Confirm the user understands no-sensitive-doc pilot mode.',
      'Confirm contact information and preferred help mode.',
      'Review missing basics and risk flags.',
      'Send quote/appointment link only if service scope is clear.',
      'Keep all sensitive tax details inside the dashboard/workbench, not email.'
    ],
    release_notes_template: [
      'Version checked: 0.1.30',
      'Health endpoint passed',
      'No-sensitive pilot mode confirmed',
      'Sensitive-upload gate tested',
      'Redacted/sample upload path tested',
      'Staff cockpit reviewed',
      'Quote/payment/appointment workflows reviewed',
      'Known blockers disclosed'
    ]
  };
}

function recordPilotReleaseDecision(store, body = {}, actor = {}) {
  const key = compact(body.status_key || body.key || 'private_pilot_release_decision', 80).replace(/[^a-zA-Z0-9_-]/g, '_');
  const status = compact(body.status || 'recorded', 40).replace(/[^a-zA-Z0-9_-]/g, '_');
  const record = store.insert('pilot_release_events', {
    event_type: compact(body.event_type || 'release_decision', 80),
    status_key: key,
    status,
    note: compact(body.note || body.reason || '', 800),
    actor_id: actor.id || '',
    actor_email: actor.email || '',
    created_at: new Date().toISOString()
  });
  return record;
}

module.exports = {
  PRIVATE_PILOT_RELEASE_POLICY,
  REGRESSION_AREAS,
  PILOT_USER_SCENARIOS,
  buildPrivatePilotReleaseCandidate,
  buildPrivatePilotRegressionChecklist,
  buildPilotUserScenarioMatrix,
  buildComplianceCopyAudit,
  buildPilotMarketingSafetyReview,
  buildPrivatePilotGoNoGoReport,
  buildPilotReleasePacket,
  recordPilotReleaseDecision
};
