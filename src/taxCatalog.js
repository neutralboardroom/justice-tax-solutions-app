const TAX_FORM_CATALOG = [
  { agency: 'IRS', id: '1040', title: 'U.S. Individual Income Tax Return', category: 'individual-return', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'IRS', id: '1040-SR', title: 'U.S. Tax Return for Seniors', category: 'individual-return', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule 1', title: 'Additional Income and Adjustments to Income', category: 'individual-return', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule 2', title: 'Additional Taxes', category: 'individual-return', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule 3', title: 'Additional Credits and Payments', category: 'individual-return', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule A', title: 'Itemized Deductions', category: 'deductions', status: 'mvp-organizer', priority: 2, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule B', title: 'Interest and Ordinary Dividends', category: 'income', status: 'mvp-organizer', priority: 2, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule C', title: 'Profit or Loss From Business', category: 'self-employed', status: 'mvp-organizer', priority: 1, workflow: 'gig-worker' },
  { agency: 'IRS', id: 'Schedule SE', title: 'Self-Employment Tax', category: 'self-employed', status: 'mvp-organizer', priority: 1, workflow: 'gig-worker' },
  { agency: 'IRS', id: 'Schedule D', title: 'Capital Gains and Losses', category: 'investment', status: 'planned-next', priority: 3, workflow: 'return-help' },
  { agency: 'IRS', id: 'Schedule E', title: 'Supplemental Income and Loss', category: 'rental/pass-through', status: 'planned-next', priority: 3, workflow: 'return-help' },
  { agency: 'IRS', id: '8812', title: 'Credits for Qualifying Children and Other Dependents', category: 'credits', status: 'mvp-organizer', priority: 2, workflow: 'return-help' },
  { agency: 'IRS', id: '8863', title: 'Education Credits', category: 'credits', status: 'mvp-organizer', priority: 2, workflow: 'return-help' },
  { agency: 'IRS', id: '8962', title: 'Premium Tax Credit', category: 'credits/health', status: 'mvp-organizer', priority: 2, workflow: 'return-help' },
  { agency: 'IRS', id: '8889', title: 'Health Savings Accounts', category: 'credits/health', status: 'planned-next', priority: 3, workflow: 'return-help' },
  { agency: 'IRS', id: '1040-X', title: 'Amended U.S. Individual Income Tax Return', category: 'amended', status: 'mvp-organizer', priority: 1, workflow: 'amended-prior-year' },
  { agency: 'IRS', id: '4868', title: 'Application for Automatic Extension', category: 'extension', status: 'mvp-organizer', priority: 2, workflow: 'return-help' },
  { agency: 'IRS', id: '9465', title: 'Installment Agreement Request', category: 'tax-debt', status: 'mvp-organizer', priority: 1, workflow: 'tax-debt' },
  { agency: 'IRS', id: '433-A/F/B', title: 'Collection Information Statements', category: 'tax-debt', status: 'mvp-organizer', priority: 1, workflow: 'tax-debt' },
  { agency: 'IRS', id: '656', title: 'Offer in Compromise', category: 'tax-debt', status: 'screening-only', priority: 1, workflow: 'tax-debt' },
  { agency: 'IRS', id: '2848', title: 'Power of Attorney and Declaration of Representative', category: 'representation', status: 'professional-gated', priority: 2, workflow: 'professional-review' },
  { agency: 'IRS', id: '8821', title: 'Tax Information Authorization', category: 'authorization', status: 'professional-gated', priority: 2, workflow: 'professional-review' },
  { agency: 'NYS', id: 'IT-201', title: 'Resident Income Tax Return', category: 'ny-individual', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'NYS', id: 'IT-203', title: 'Nonresident and Part-Year Resident Income Tax Return', category: 'ny-individual', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'NYS', id: 'IT-2', title: 'Summary of W-2 Statements', category: 'ny-individual', status: 'mvp-organizer', priority: 1, workflow: 'return-help' },
  { agency: 'NYS', id: 'IT-196', title: 'New York Resident, Nonresident, and Part-Year Resident Itemized Deductions', category: 'ny-deductions', status: 'planned-next', priority: 2, workflow: 'return-help' },
  { agency: 'NYS', id: 'IT-201-X', title: 'Amended Resident Income Tax Return', category: 'ny-amended', status: 'mvp-organizer', priority: 2, workflow: 'amended-prior-year' },
  { agency: 'NYS', id: 'IT-203-X', title: 'Amended Nonresident/Part-Year Return', category: 'ny-amended', status: 'mvp-organizer', priority: 2, workflow: 'amended-prior-year' },
  { agency: 'NYS', id: 'IT-370', title: 'Extension of Time to File', category: 'ny-extension', status: 'planned-next', priority: 3, workflow: 'return-help' },
  { agency: 'NYS', id: 'DTF-5', title: 'Statement of Financial Condition', category: 'ny-tax-debt', status: 'screening-only', priority: 1, workflow: 'tax-debt' },
  { agency: 'NYS', id: 'IPA', title: 'Installment Payment Agreement workflow', category: 'ny-tax-debt', status: 'mvp-organizer', priority: 1, workflow: 'tax-debt' },
  { agency: 'NYC', id: 'NYC-202', title: 'Unincorporated Business Tax Return for Individuals', category: 'nyc-business', status: 'planned-next', priority: 2, workflow: 'small-business' },
  { agency: 'NYC', id: 'NYC-204', title: 'Unincorporated Business Tax Return for Partnerships', category: 'nyc-business', status: 'planned-next', priority: 3, workflow: 'small-business' },
  { agency: 'NYC', id: 'CR-A', title: 'Commercial Rent Tax Annual Return', category: 'nyc-business', status: 'planned-next', priority: 3, workflow: 'small-business' },
  { agency: 'NYC', id: 'NYC DOF Notice', title: 'NYC Department of Finance notice/debt workflow', category: 'nyc-tax-debt', status: 'mvp-organizer', priority: 1, workflow: 'notice-help' }
];

function catalogSummary() {
  const byStatus = {};
  const byAgency = {};
  for (const item of TAX_FORM_CATALOG) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byAgency[item.agency] = (byAgency[item.agency] || 0) + 1;
  }
  return { total: TAX_FORM_CATALOG.length, by_status: byStatus, by_agency: byAgency };
}

function workflowCoverage() {
  const workflows = {};
  for (const item of TAX_FORM_CATALOG) {
    workflows[item.workflow] ||= { workflow: item.workflow, total: 0, mvp: 0, planned: 0, gated: 0, forms: [] };
    workflows[item.workflow].total += 1;
    if (item.status === 'mvp-organizer') workflows[item.workflow].mvp += 1;
    if (item.status === 'planned-next') workflows[item.workflow].planned += 1;
    if (['professional-gated', 'screening-only'].includes(item.status)) workflows[item.workflow].gated += 1;
    workflows[item.workflow].forms.push(item);
  }
  return Object.values(workflows).sort((a, b) => a.workflow.localeCompare(b.workflow));
}

function ioReferenceAuditForTaxBuild() {
  return {
    source: 'Immigration Oasis v1.10.160 reference ZIP inspected locally',
    useful_patterns_to_adapt: [
      'public problem-first start page with compliance notes and language choice',
      'account creation and signed-in dashboard',
      'referral attribution lock from original QR/link to signup, case, checkout, and reward ledger',
      'tracked /r/:code redirect that logs QR/flyer scans without exposing private user data',
      'English/Spanish one-page flyer with QR code and partner/location code',
      'staff workbench split into urgent, paid, review, referral, and notification lanes',
      'final output gate: no automatic government filing; user/professional review required',
      'diagnostic/readiness endpoints that state what is supported, what is gated, and what remains unfinished',
      'non-clickable trust notes styled as clear text, not fake buttons',
      'long-text character counters and mobile-friendly start flow'
    ],
    tax_specific_changes_required: [
      'replace USCIS/free-form language with IRS/NYS/NYC and tax return/preparer compliance language',
      'add PTIN/preparer review model and New York tax-preparer registration awareness',
      'add return-preparation and notice/tax-debt workflows instead of immigration form families',
      'separate tax payments, penalties, interest, government fees, and third-party professional fees from platform fees',
      'avoid guaranteed refund, tax-debt reduction, OIC acceptance, audit outcome, or penalty relief claims',
      'treat Social Security numbers, account numbers, transcripts, W-2s, and notices as highly sensitive documents'
    ],
    v011_added_from_reference: [
      'signup/login/session basics',
      'user dashboard routes and page',
      'referral code generation on account creation',
      'locked referred-by code on signup/case creation',
      '/r/:code tracked QR/flyer redirect with scan ledger',
      'referral dashboard stats for scans, leads, accounts, cases, and rewards',
      'reward-tier ledger model with upgrade-credit/no-stacking rule',
      'staff workbench API/page skeleton',
      'tax form/workflow coverage endpoint',
      'downloadable bilingual QR flyer with stronger tax-specific compliance copy',
      'document persistence for starter build with production security warning',
      '2500-character counters for long text boxes'
    ]
  };
}

module.exports = { TAX_FORM_CATALOG, catalogSummary, workflowCoverage, ioReferenceAuditForTaxBuild };
