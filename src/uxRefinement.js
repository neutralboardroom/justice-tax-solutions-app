const UX_REFINEMENT_POLICY = {
  version: '0.1.56',
  name: 'Role-based UX polish and safe-language refinement',
  principle: 'Make the site feel calm and useful for taxpayers while keeping staff, owner, form-QA, and compliance controls clearly separated.',
  current_public_mode: 'Controlled public viewing and invited no-sensitive pilot only.',
  do_not_change: [
    'Do not enable live sensitive uploads.',
    'Do not move official IRS/NYS/NYC forms to final client output.',
    'Do not claim e-file, bank products, refund advances, direct debit, or agency submission are live.',
    'Do not imply Justice Tax Solutions is the IRS, NYS, NYC, or a law firm.',
    'Do not promise tax reduction, penalty relief, refund timing, payment-plan approval, or appeal results.'
  ]
};

const ROLE_START_MAP = [
  {
    role: 'Public taxpayer',
    primary_goal: 'Understand the problem and choose a safe first step.',
    preferred_start: '/#start',
    secondary_links: ['/taxpayer-action-center.html', '/tax-urgency-triage.html', '/safe-tax-summary-builder.html', '/document-safety-center.html'],
    copy_rule: 'Use calm language: do not panic, do not ignore notices, and do not paste private taxpayer data yet.'
  },
  {
    role: 'Signed-in client',
    primary_goal: 'See case status, missing items, next step, quote/review status, and safety limits.',
    preferred_start: '/dashboard.html',
    secondary_links: ['/after-you-start.html', '/pricing.html', '/first-user-feedback.html'],
    copy_rule: 'Show what was received, what is missing, what is blocked, and what staff will do next.'
  },
  {
    role: 'Staff reviewer',
    primary_goal: 'Triage cases, avoid sensitive-data mistakes, route review level, and record follow-up.',
    preferred_start: '/staff.html',
    secondary_links: ['/staff-cockpit.html', '/staff-pilot-ops.html', '/official-forms.html', '/production-config.html'],
    copy_rule: 'Use operational labels, not marketing labels. Show secrets only as configured/not configured.'
  },
  {
    role: 'Professional reviewer',
    primary_goal: 'Confirm scope, credentials, documents, client verification, and signoff boundaries.',
    preferred_start: '/cpa-ea-tax-attorney-review.html',
    secondary_links: ['/pricing.html', '/live-consultation.html', '/irs-authorization-workspace.html'],
    copy_rule: 'Explain PTIN, EA, CPA, and attorney review as separate levels with separate permissions.'
  },
  {
    role: 'Referral/community partner',
    primary_goal: 'Send people to a safe free starting point without collecting private tax data.',
    preferred_start: '/referral-tools.html',
    secondary_links: ['/referral-program.html', '/first-public-user-start.html', '/document-safety-center.html'],
    copy_rule: 'Partner copy should say: start free, no guarantee, no private documents yet, professional review only when assigned.'
  },
  {
    role: 'Owner/admin',
    primary_goal: 'Confirm deployment, security, professional, payment, domain, and form-output blockers.',
    preferred_start: '/controlled-public-launch-closeout.html',
    secondary_links: ['/launch-readiness.html', '/public-launch-audit.html', '/security-plan.html', '/refund-efile-bank-products.html'],
    copy_rule: 'Keep launch readiness separate from the customer path so public users are not overwhelmed.'
  }
];

function countStore(store, collection) {
  try { return Array.isArray(store.list(collection)) ? store.list(collection).length : 0; } catch (_) { return 0; }
}

function buildExperiencePolishAudit({ store, version } = {}) {
  const caseCount = store ? countStore(store, 'cases') : 0;
  const feedbackCount = store ? countStore(store, 'first_user_feedback') : 0;
  return {
    policy: UX_REFINEMENT_POLICY,
    version: version || UX_REFINEMENT_POLICY.version,
    summary: {
      headline: 'v0.1.56 focuses on usability before more form expansion.',
      readiness: 'Better for controlled public review and first invited users; still not a full sensitive-data launch.',
      cases_seen: caseCount,
      feedback_records_seen: feedbackCount
    },
    public_user_refinements: [
      'Homepage hero now gives one primary action and three clear support actions instead of a cluttered button row.',
      'New role-based start panel explains where taxpayers, signed-in clients, staff, professionals, referral partners, and the owner should go.',
      'Public language emphasizes: do not panic, do not ignore notices, do not upload or paste private taxpayer data yet.',
      'Official-form pages now state more clearly that organizers and maps are controlled QA, not final IRS output.'
    ],
    dashboard_refinements: [
      'Dashboard copy now starts with what the user should check next: status, missing items, review level, payment/quote status, and safety rules.',
      'Dashboard quick cards route users to Safe Summary, Action Center, Document Safety, pricing/review levels, and feedback.',
      'The customer dashboard avoids implying filing, e-file, direct debit, or agency submission is active.'
    ],
    staff_refinements: [
      'Staff pages now use a cleaner operational navigation and remove duplicate/overwhelming links from the main staff header.',
      'Staff workbench now starts with triage lanes: urgent risk, sensitive-data safety, review level, follow-up, and form-output gatekeeping.',
      'Staff cockpit now reinforces privacy-safe analytics and separates public funnel metrics from case facts.'
    ],
    language_guardrails: buildPublicLanguageSafetyMatrix().must_say,
    unresolved_before_broad_launch: [
      'Enable production staff authentication/MFA and access logs before real sensitive taxpayer data.',
      'Configure production email, Stripe/payment webhooks, private storage, malware scanning, WISP, retention/deletion, incident response, and backup/restore.',
      'Complete official PDF capture, field/coordinate lock, sample visual QA, client verification, professional release, and final staff approval before official output.',
      'Complete EFIN/e-file provider path and bank-product enrollment before showing Refund Transfer/refund advance as live options.'
    ],
    role_start_map: ROLE_START_MAP
  };
}

function buildRoleBasedStartMap() {
  return {
    title: 'Role-based start map',
    purpose: 'Reduce confusion by sending each user type to one clear starting point.',
    roles: ROLE_START_MAP,
    nav_rule: 'Public navigation should prioritize taxpayer help. Staff, owner, and QA pages should stay accessible but not dominate the public path.'
  };
}

function buildDashboardUxGuidance() {
  return {
    title: 'Customer dashboard UX guidance',
    sections: [
      { label: 'At a glance', rule: 'Show case status, next step, missing items, and whether staff review is pending.' },
      { label: 'Safety limits', rule: 'Show no-sensitive-data mode and remind users not to paste SSNs, bank info, full notices, or full returns.' },
      { label: 'Review clarity', rule: 'Separate AI organization, PTIN review, EA review, CPA review, and tax attorney review.' },
      { label: 'Payment honesty', rule: 'Show quote/payment status only; do not imply Stripe, Refund Transfer, or refund advance is live unless configured and tested.' },
      { label: 'After submission', rule: 'Explain what staff will check and when the user should seek urgent professional help.' }
    ],
    quick_links: ['/after-you-start.html', '/document-safety-center.html', '/pricing.html', '/first-user-feedback.html']
  };
}

function buildStaffUxGuidance({ store } = {}) {
  return {
    title: 'Staff UX and operations guidance',
    summary: {
      cases: store ? countStore(store, 'cases') : 0,
      feedback: store ? countStore(store, 'first_user_feedback') : 0,
      events: store ? countStore(store, 'events') : 0
    },
    lanes: [
      { label: '1. Triage urgency', action: 'Look for levy, lien, garnishment, court, summons, criminal, deadline, payroll/trust-fund, or business-tax warning signs.' },
      { label: '2. Protect data', action: 'Reject or redirect unredacted taxpayer documents until production sensitive upload gates are approved.' },
      { label: '3. Route review level', action: 'Choose AI-only organization, PTIN, EA, CPA, or tax attorney review based on issue and credential boundaries.' },
      { label: '4. Communicate safely', action: 'Send plain-English next steps without putting SSNs, account numbers, full notices, balances, or tax-return contents in outbound messages.' },
      { label: '5. Hold official output', action: 'Do not release official forms until source, field map, QA, client verification, professional signoff, payment/quote, and security gates pass.' }
    ],
    stop_inviting_more_users_if: [
      'Users repeatedly paste sensitive data despite warnings.',
      'Staff cannot review first-user cases within the promised operating window.',
      'Payment/professional-review language causes confusion.',
      'Urgent cases arrive without a clear escalation path.',
      'A security, storage, email, or staff-access issue appears.'
    ]
  };
}

function buildPublicLanguageSafetyMatrix() {
  return {
    title: 'Public-facing language safety matrix',
    must_say: [
      'Justice Tax Solutions is independent and is not the IRS, NYS, NYC, or a law firm.',
      'AI can help organize, summarize, and draft next-step information; professional review is separate when needed or requested.',
      'Do not panic, but do not ignore tax notices or deadlines.',
      'Do not upload or paste real unredacted taxpayer documents, SSNs, bank details, account numbers, or full tax returns until secure upload gates are live.',
      'Government taxes, penalties, interest, filing fees, direct payments, and agency amounts are separate.',
      'Final filing, agency submission, direct debit, e-file, official form output, Refund Transfer, and refund advance are not live unless later configured, tested, and approved.'
    ],
    must_not_say: [
      'Guaranteed tax relief, guaranteed penalty removal, guaranteed settlement, or guaranteed payment-plan approval.',
      'We are the IRS, NYS, NYC, a government agency, or a law firm.',
      'Attorney review, professional representation, e-file, direct submission, or refund bank products are included by default.',
      'Upload your complete tax return, full SSN, bank account, or unredacted tax notice in public pilot mode.',
      'Official IRS/NYS/NYC forms are final client output before source capture, field/coordinate lock, sample QA, and release gates pass.'
    ],
    preferred_replacements: [
      { risky: 'tax relief guarantee', safer: 'tax-problem organization and review-level screening' },
      { risky: 'we will settle your debt', safer: 'we can help organize facts for payment-plan, hardship, appeal, or professional review options' },
      { risky: 'efile and refund advance available now', safer: 'future e-file and refund bank-product readiness; not live yet' },
      { risky: 'upload your notice', safer: 'start with no file or a redacted/sample copy only until secure upload is approved' }
    ]
  };
}

module.exports = {
  UX_REFINEMENT_POLICY,
  buildExperiencePolishAudit,
  buildRoleBasedStartMap,
  buildDashboardUxGuidance,
  buildStaffUxGuidance,
  buildPublicLanguageSafetyMatrix
};
