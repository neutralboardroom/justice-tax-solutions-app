const PLATFORM_POLISH_PRINCIPLES = [
  'Make the first public decision simple: file personal, file business, review past returns, free Truth Check, fix a problem, or not sure.',
  'Use calm plain-English copy and avoid fear-based tax-resolution language.',
  'Keep prior-return review prominent while avoiding any refund, savings, or amendment-result guarantee.',
  'Explain the free starting point before paid filing, amendment preparation, business tax work, bookkeeping cleanup, or professional review.',
  'Keep live sensitive uploads, official final forms, e-file, agency submission, direct debit, and refund bank products clearly blocked until real gates pass.',
  'Separate public user language from staff/owner readiness dashboards and secret/environment status pages.'
];

function buildFullPlatformPolishAudit({ version = '0.1.59' } = {}) {
  const checks = [
    { key: 'homepage_path_clarity', label: 'Homepage shows personal filing, business filing, prior-return review, free Truth Check, and tax-problem paths.', status: 'improved' },
    { key: 'prior_return_prominence', label: 'Prior-return review/amendment screening remains a major feature across public UX.', status: 'preserved_and_polished' },
    { key: 'free_vs_paid_clarity', label: 'Free Truth Check and amendment screening are separated from paid filing, preparation, and professional review.', status: 'improved' },
    { key: 'customer_dashboard_next_steps', label: 'Dashboard explains what the user can do next, what is missing, and what remains blocked.', status: 'improved' },
    { key: 'staff_queue_language', label: 'Staff workbench emphasizes path classification, urgency, privacy, professional routing, and no final-output release.', status: 'improved' },
    { key: 'public_safe_copy', label: 'Public copy avoids guarantees, government confusion, fake e-file, fake secure upload, and fake professional claims.', status: 'preserved' },
    { key: 'spanish_touchpoints', label: 'Spanish entry points and bilingual caution language remain visible and better integrated.', status: 'preserved_and_polished' },
    { key: 'html_hygiene', label: 'FAQ markup and public-facing stale version labels were cleaned where found.', status: 'improved' }
  ];
  return {
    version,
    title: 'Full-platform UX and language polish audit',
    conclusion: 'The platform is clearer for controlled public review and invited first users, but it remains in controlled mode for sensitive data, official forms, e-file, payments, and professional operations.',
    principles: PLATFORM_POLISH_PRINCIPLES,
    checks,
    go_no_go: {
      public_site_review: 'go_after_deployment_smoke_test',
      invited_no_sensitive_users: 'controlled_go',
      broad_marketing: 'not_yet',
      live_sensitive_uploads: 'blocked',
      final_official_form_output: 'blocked',
      efile_agency_submission: 'blocked',
      refund_transfer_advance: 'future_only'
    }
  };
}

function buildCustomerLanguagePolishChecklist() {
  return {
    heading: 'Customer-facing language checklist',
    use: [
      'Start with the return, the business records, the letter, or the question.',
      'Your first Truth Check is free.',
      'Already filed? A second look may uncover something worth correcting.',
      'An amendment may be worth considering, but no result is guaranteed.',
      'Paid filing, amendment preparation, business tax help, or professional review is explained before you choose.',
      'Deadlines matter; verify deadlines against original notices and official sources.'
    ],
    avoid: [
      'We will get you more money back.',
      'Guaranteed refund or savings.',
      'We are the IRS, NYS, NYC, a CPA firm, EA firm, or law firm.',
      'E-file, agency submission, Refund Transfer, refund advance, or direct debit is live.',
      'Upload full SSNs, bank data, transcripts, or unredacted notices in the controlled launch.'
    ]
  };
}

function buildPublicJourneyPolishMap() {
  return [
    { path: 'File a Personal Tax Return', best_for: 'Current-year or prior-year W-2, 1099, gig-worker, dependent, credit, and review-before-filing needs.', next_step: 'Personal Filing Readiness Summary' },
    { path: 'File a Business Tax Return', best_for: 'Schedule C, LLC, partnership, S corp, corporation, bookkeeping, payroll/sales-tax routing, and business records.', next_step: 'Business Filing Readiness Summary' },
    { path: 'Review Past Returns', best_for: 'Recent filed personal or business returns that may have missed credits, deductions, income items, business expenses, or filing issues.', next_step: 'Prior-Year Return Review / Amendment Opportunity Summary' },
    { path: 'Free Tax Problem Truth Check', best_for: 'IRS/NYS/NYC notices, CP2000, balance due, refund hold, missing return, levy/lien, payroll/sales-tax notices, or not-sure letters.', next_step: 'Tax Problem Truth Check Summary' },
    { path: 'Fix a Tax Problem', best_for: 'Tax debt, penalties, unfiled returns, payment plans, collection risks, and professional routing.', next_step: 'Tax Problem / Urgency Triage Summary' },
    { path: 'I am not sure', best_for: 'Users who only know they have a tax document, return, business issue, or anxiety and need sorting.', next_step: 'Plain-language classification and next-step checklist' }
  ];
}

function buildStaffDashboardPolishMap() {
  return {
    lanes: [
      'Classify selected path before giving advice or pricing.',
      'Check urgency and deadline words before routine follow-up.',
      'Protect sensitive data; use no-file or redacted/sample mode while live upload gates are blocked.',
      'Route personal filing, business filing, amendment review, and tax-problem matters separately.',
      'Escalate payroll, sales-tax, trust-fund, criminal, court, levy, lien, and large amendment/refund matters appropriately.',
      'Keep email/analytics free of SSNs, EINs, bank data, full notice text, payroll records, and uploaded file contents.'
    ],
    queue_fields: [
      'selected_path', 'personal_business_or_both', 'entity_type', 'tax_year_or_period', 'agency', 'notice_type', 'urgency_level', 'amount_range', 'deadline_flag', 'documents_safe_status', 'professional_review_route', 'free_summary_delivered', 'paid_option_requested'
    ]
  };
}

function buildSitewideSafeCopyMatrix() {
  return {
    independence: 'Justice Tax Solutions is independent and is not the IRS, NYS, NYC, or a law firm.',
    no_guarantee: 'No refund, savings, payment plan, penalty relief, settlement, amended-return benefit, business tax savings, audit result, or government outcome is guaranteed.',
    document_safety: 'Do not upload originals or unredacted sensitive taxpayer documents while live sensitive uploads are blocked.',
    filing_limits: 'Final filing, e-file, agency submission, direct debit, official form output, Refund Transfer, and refund advance products are not live unless later configured, tested, and approved.',
    professional_limits: 'PTIN, CPA, EA, accountant, bookkeeper, payroll, sales-tax, or tax attorney review depends on availability, credentials, scope, and case complexity.'
  };
}

module.exports = {
  PLATFORM_POLISH_PRINCIPLES,
  buildFullPlatformPolishAudit,
  buildCustomerLanguagePolishChecklist,
  buildPublicJourneyPolishMap,
  buildStaffDashboardPolishMap,
  buildSitewideSafeCopyMatrix
};
