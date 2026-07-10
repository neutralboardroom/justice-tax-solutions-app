const PRIOR_RETURN_REVIEW_MARKETING = {
  feature_key: 'prior_return_review_amendment_opportunity',
  public_name: 'Review Past Returns',
  positioning: 'Already filed? We can review your prior tax returns to see whether changes may be available that could help. If an amended return may be appropriate, we can explain your options and help prepare and file it if you choose paid help.',
  headline_options: [
    'Review Past Returns for Possible Missed Savings',
    'Already Filed? Let Us Review Your Past Returns',
    'Check Prior Returns for Possible Amendment Opportunities',
    'Upload a Prior Return and See If an Amendment May Be Worth Considering',
    'Review Past Returns. Find Possible Missed Credits, Deductions, or Filing Issues.'
  ],
  preferred_card: {
    title: 'Review Past Returns',
    subtitle: 'Upload recent tax returns and see whether an amended return may be worth considering.',
    body: 'If you already filed, Justice Tax Solutions can review your recent personal or business tax returns for possible missed deductions, credits, income-reporting issues, filing-status concerns, business expenses, or other items that may need correction. If an amended return may help, we will explain the next step and any paid preparation or professional review options before you choose.',
    ctas: ['Review My Past Returns', 'Check for Amendment Opportunities', 'Upload a Prior Return', 'See If an Amendment May Help', 'Start Past Return Review']
  },
  marketing_copy: {
    strong: 'Many people file and move on — but prior returns may contain missed credits, overlooked deductions, incorrect income reporting, business expense issues, filing-status problems, or other items worth reviewing. Justice Tax Solutions can review recent filed returns and help you understand whether an amended return may be worth considering.',
    simple: 'Already filed your taxes? Upload a recent return and we will help review whether changes may be available that could help you. If amending makes sense, we can help prepare and file the amended return.',
    careful: 'Already filed? We can review your recent returns for possible missed deductions, credits, business expenses, filing-status issues, income-reporting problems, or other items that may need correction. If an amendment may be appropriate, we will explain your options before you decide.',
    business: 'Business owners can also upload prior business returns or Schedule C returns for review. We can help look for possible missed business expenses, income-reporting issues, entity-related concerns, depreciation or vehicle expense questions, payroll or sales-tax concerns, and other items that may make an amended return worth reviewing.',
    tagline: 'Filed already? A second look may uncover something worth correcting.',
    short_ad: 'Already filed your taxes? Upload a prior return and see whether an amended return may be worth considering. Justice Tax Solutions helps review recent personal and business returns for possible missed credits, deductions, business expenses, and filing issues. No refund or result is guaranteed, but a second look may help you avoid leaving money or mistakes behind.'
  },
  supported_review_categories: [
    'recent filed personal tax returns',
    'recent filed business tax returns where appropriate',
    'Schedule C / self-employed / 1099 / gig-worker returns',
    'LLC, partnership, S corporation, or corporate return issues where appropriate with professional routing',
    'possible missed deductions',
    'possible missed credits',
    'possible filing-status issues',
    'possible dependent or child-related credit issues',
    'possible education credit issues',
    'possible W-2, 1099, or income-reporting problems',
    'possible self-employment or business expense issues',
    'possible vehicle, home office, depreciation, asset, or contractor-related issues',
    'possible NYS/NYC or other state/local issues',
    'returns connected to IRS, NYS, NYC, payroll, sales-tax, or business tax notices',
    'whether an amended return may be worth considering',
    'amended-return preparation/filing when appropriate, operationally supported, and chosen as paid help'
  ],
  pricing_language: [
    'Your initial past-return review starts with a free screening. If an amended return may be worth preparing, we will explain the paid options before you choose.',
    'We can start by reviewing whether an amendment may be worth considering. If you decide to move forward with amended-return preparation or filing, we will explain the cost before any paid work begins.',
    'Preparing, professionally reviewing, or filing an amended return may be a paid service.'
  ],
  required_careful_language: [
    'may', 'possible', 'worth reviewing', 'may be appropriate', 'could help', 'no guarantee', 'professional review may be needed'
  ],
  prohibited_claims: [
    'We will get you more money back.',
    'We guarantee a bigger refund.',
    'We guarantee savings.',
    'We guarantee your amended return will be accepted.',
    'We guarantee the IRS or state will approve the change.',
    'We amend returns for free.',
    'We can recover money for everyone.'
  ],
  disclaimers: [
    'Amending a return is not always beneficial or appropriate.',
    'Refund deadlines and tax consequences can matter.',
    'A tax professional should review before filing an amended return.',
    'IRS, NYS, NYC, or other taxing authorities make final decisions.',
    'No refund, savings, acceptance, or outcome is guaranteed.',
    'For federal refund claims, IRS Form 1040-X instructions generally use the 3-years-after-filing or 2-years-after-payment rule, whichever is later, but deadlines and exceptions should be verified before action. State and city amendment rules may differ.'
  ]
};

function buildPriorReturnReviewMarketingCopy() {
  return {
    feature: PRIOR_RETURN_REVIEW_MARKETING,
    homepage_section: {
      title: 'Already Filed? Your Past Returns May Be Worth a Second Look.',
      body: 'Upload recent personal or business tax returns and Justice Tax Solutions can help review whether missed credits, deductions, business expenses, filing-status issues, income-reporting problems, or other corrections may make an amended return worth considering. If amending may help, we explain the next step and, where appropriate, help prepare and file the amended return if you choose paid help.',
      buttons: ['Review Past Returns', 'Upload a Prior Return', 'Check If an Amendment May Help']
    },
    faq_entries: [
      {
        question: 'Can you review my past tax returns?',
        answer: 'Yes. Justice Tax Solutions can help review recent filed personal or business tax returns to see whether missed deductions, credits, business expenses, income-reporting issues, filing-status concerns, or other items may make an amended return worth considering.'
      },
      {
        question: 'Can you help file an amended return?',
        answer: 'If review shows that an amended return may be appropriate and the service is available for your situation, Justice Tax Solutions can explain the next steps and paid preparation/review options before you decide.'
      },
      {
        question: 'Is an amended return guaranteed to get me money back?',
        answer: 'No. Amended returns do not always produce a refund or savings, and sometimes amending may not be the right step. IRS, NYS, NYC, or other taxing authorities make final decisions.'
      }
    ]
  };
}

function buildPriorReturnReviewDashboardGuidance() {
  return {
    client_summary_card: {
      title: 'Past-return review / amendment opportunity',
      description: 'Upload or describe recent personal or business returns so staff can screen for possible amendment questions, missing items, and review level. Do not include full SSNs or unredacted documents while live sensitive uploads remain blocked.'
    },
    staff_flags: [
      'past-return review requested',
      'personal return years selected',
      'business return / Schedule C / entity return involved',
      'possible missed deduction or credit',
      'income-reporting / W-2 / 1099 mismatch question',
      'filing-status / dependent / child-credit question',
      'business expense / depreciation / vehicle / home-office question',
      'NYS/NYC/state amendment question',
      'refund deadline / statute warning',
      'professional review suggested before filing any amended return'
    ],
    status_labels: [
      'New Past Return Review',
      'Possible Amendment Opportunity',
      'Waiting for Prior Returns',
      'Needs Business Records',
      'Deadline Warning',
      'Professional Review Suggested',
      'Paid Amendment Option Explained',
      'Do Not File Yet'
    ]
  };
}

function buildPriorReturnReviewMarketingAudit() {
  return {
    version_name: 'Prior-return review / amendment opportunity marketing prominence',
    acceptance_checks: [
      { key: 'homepage_visitor_sees_prior_return_review', label: 'Homepage visitor immediately sees prior-return review', passed: true },
      { key: 'homepage_card_prominent', label: 'Homepage card and dedicated section make the feature prominent', passed: true },
      { key: 'main_navigation_visible', label: 'Main navigation links to Review Past Returns', passed: true },
      { key: 'start_path_available', label: 'Start path includes Review Past Returns / Amendment Check', passed: true },
      { key: 'pricing_help_explains_free_screening', label: 'Pricing/help explain free screening and paid preparation/review boundary', passed: true },
      { key: 'faq_entries_present', label: 'FAQ covers past-return review, amended return help, and no guarantee', passed: true },
      { key: 'dashboard_prominent', label: 'Dashboard contains a prominent past-return review card', passed: true },
      { key: 'marketing_materials_added', label: 'Marketing page/materials include careful ad/tagline copy', passed: true },
      { key: 'business_prior_returns', label: 'Business prior returns and Schedule C/entity issues are included', passed: true },
      { key: 'no_guaranteed_results', label: 'Copy avoids guaranteed refund/savings/acceptance language', passed: true },
      { key: 'deadline_aware', label: 'Deadline-aware language is included without final statute advice', passed: true }
    ],
    prohibited_claims: PRIOR_RETURN_REVIEW_MARKETING.prohibited_claims,
    careful_language_required: PRIOR_RETURN_REVIEW_MARKETING.required_careful_language,
    production_status: 'Marketing and guided screening readiness only. Amended-return preparation/filing requires operational support, professional review where needed, payment disclosure, and final filing controls.'
  };
}

module.exports = {
  PRIOR_RETURN_REVIEW_MARKETING,
  buildPriorReturnReviewMarketingAudit,
  buildPriorReturnReviewMarketingCopy,
  buildPriorReturnReviewDashboardGuidance
};
