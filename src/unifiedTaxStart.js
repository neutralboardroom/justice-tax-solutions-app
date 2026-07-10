const PATHS = [
  {
    key: 'personal-return-filing',
    label: 'File a Personal Tax Return',
    summaryTitle: 'Personal Filing Readiness Summary',
    cta: 'Start a Personal Return',
    publicCopy: 'Need to file now? Start your current-year or prior-year personal return with guided intake and review options.',
    includes: ['current-year federal return', 'prior-year personal return', 'W-2 income', '1099/self-employment/gig income', 'Schedule C questions', 'NYS/NYC return help where applicable', 'review before filing'],
    safeStatus: 'Filing intake and readiness checklist only until preparer/professional review, payment, and filing controls are configured.'
  },
  {
    key: 'business-return-filing',
    label: 'File a Business Tax Return',
    summaryTitle: 'Business Filing Readiness Summary',
    cta: 'Start a Business Return',
    publicCopy: 'Business owner, contractor, LLC, S corp, partnership, corporation, or gig worker? Start a guided business tax intake and see what documents and review level may be needed.',
    includes: ['Schedule C', 'single-member LLC', 'partnership', 'S corporation', 'C corporation', 'bookkeeping cleanup', 'payroll/sales-tax routing', 'business tax notices'],
    safeStatus: 'Business filing intake and routing only; complex business, payroll, sales-tax, or amended business return work requires appropriate professional review and operational readiness.'
  },
  {
    key: 'past-return-review',
    label: 'Review Past Returns',
    summaryTitle: 'Prior-Year Return Review / Amendment Opportunity Summary',
    cta: 'Review My Past Returns',
    publicCopy: 'Already filed? Upload recent personal or business tax returns and see whether an amended return may be worth considering. If amending may help, we explain your options and any paid preparation or professional review choices before you decide.',
    includes: ['possible missed deductions', 'possible missed credits', 'filing-status concerns', 'dependent or child-related credit questions', 'education credit questions', 'W-2/1099/income-reporting issues', 'self-employment or business expenses', 'vehicle/home office/depreciation/asset questions', 'NYS/NYC/state/local issues', 'business return or Schedule C review', 'Form 1040-X readiness'],
    safeStatus: 'Free screening only at the starting point. Amended-return preparation/filing is paid only if the user chooses it, operational support is available, and review supports it. No refund, savings, or agency acceptance is guaranteed.'
  },
  {
    key: 'free-truth-check',
    label: 'Upload a Tax Notice — Free Truth Check',
    summaryTitle: 'Tax Problem Truth Check Summary',
    cta: 'Start Free Tax Problem Truth Check',
    publicCopy: 'Upload a redacted/sample notice or describe an IRS, NYS, NYC, personal, business, payroll, or sales-tax issue and get a free plain-language next-step summary before you panic, ignore it, or overpay.',
    includes: ['IRS notices', 'NYS notices', 'NYC Department of Finance notices', 'business tax notices', 'CP2000', 'balance due', 'penalties', 'refund holds', 'levy/lien/garnishment warnings'],
    safeStatus: 'Free plain-language organizer summary only; not a final tax determination and not legal advice.'
  },
  {
    key: 'fix-tax-problem',
    label: 'Fix a Tax Problem',
    summaryTitle: 'Tax Problem Organization Summary',
    cta: 'Fix a Tax Problem',
    publicCopy: 'Get organized around tax debt, unfiled returns, penalties, notices, business tax problems, payroll/sales-tax concerns, or IRS/NYS/NYC issues.',
    includes: ['tax debt', 'unfiled returns', 'payment plans', 'penalty abatement review', 'offer-in-compromise screening', 'collection risk', 'business tax problems', 'professional review routing'],
    safeStatus: 'Triage and routing only; no settlement, penalty removal, payment-plan approval, collection hold, or government outcome is guaranteed.'
  },
  {
    key: 'not-sure',
    label: 'I am not sure',
    summaryTitle: 'Tax Starting Point Summary',
    cta: 'Help Me Choose',
    publicCopy: 'Start with the return, business records, letter, or question. We help organize the next step.',
    includes: ['unknown tax document', 'mixed filing/problem issue', 'anxiety-driven tax questions', 'need a callback', 'need to know which path fits'],
    safeStatus: 'Plain-language routing only; staff/professional review may be needed before action.'
  }
];

const LEGACY_PATH_MAP = {
  'return-help': 'personal-return-filing',
  'gig-worker': 'personal-return-filing',
  'amended-prior-year': 'past-return-review',
  'notice-help': 'free-truth-check',
  'tax-debt': 'fix-tax-problem',
  'tax-problem': 'fix-tax-problem'
};

const PROHIBITED_PUBLIC_CLAIMS = [
  'You qualify.',
  'We guarantee settlement.',
  'We can remove your penalties.',
  'We will get you more money back.',
  'We guarantee a bigger refund.',
  'We guarantee savings.',
  'We guarantee your amended return will be accepted.',
  'We guarantee the IRS or state will approve the change.',
  'We amend returns for free.',
  'We can recover money for everyone.',
  'We can stop collection immediately.',
  'You will get an offer-in-compromise.',
  'You will get a refund.',
  'You do not owe this.',
  'You should definitely amend.',
  'Amending will save you money.',
  'We guarantee business tax savings.',
  'Ignore the notice.',
  'This is legal advice.',
  'We are the IRS/NYS/NYC.',
  'We are a law firm.',
  'We are a CPA firm.',
  'We are enrolled agents.'
];

const STAFF_QUEUE_FIELDS = [
  'submission_type',
  'selected_path',
  'personal_business_both',
  'entity_type_if_business',
  'notice_type',
  'agency',
  'tax_year_or_period',
  'amount_at_issue',
  'deadline',
  'urgency_level',
  'issue_category',
  'uploaded_document_present',
  'return_documents_uploaded',
  'business_records_uploaded',
  'extracted_summary',
  'recommended_review_role',
  'callback_requested',
  'requested_outcome',
  'status',
  'next_follow_up_date',
  'truth_check_free_confirmed',
  'new_personal_return_requested',
  'new_business_return_requested',
  'prior_year_filing_requested',
  'prior_year_return_review_requested',
  'possible_amended_return_issue',
  'refund_deadline_warning',
  'federal_amendment_needed',
  'state_amendment_needed',
  'business_amendment_needed',
  'professional_review_suggested'
];

const RESOURCE_SLOTS = [
  { key: 'irs_notices', label: 'IRS notices and letters', status: 'official-url-slot' },
  { key: 'irs_payment_plans', label: 'IRS payment plans', status: 'official-url-slot' },
  { key: 'irs_account_transcripts', label: 'IRS account/transcripts', status: 'official-url-slot' },
  { key: 'irs_identity_verification', label: 'IRS identity verification', status: 'official-url-slot' },
  { key: 'irs_penalty_relief', label: 'IRS penalty relief', status: 'official-url-slot' },
  { key: 'irs_audit_exam', label: 'IRS audit/exam information', status: 'official-url-slot' },
  { key: 'irs_1040x', label: 'IRS Form 1040-X / amended returns', status: 'verified-current-source-recommended-before-final-copy' },
  { key: 'irs_business_self_employed', label: 'IRS business and self-employed resources', status: 'official-url-slot' },
  { key: 'nys_tax_notices_payments', label: 'NYS tax notices and payments', status: 'official-url-slot' },
  { key: 'nyc_dof_tax', label: 'NYC Department of Finance tax issues', status: 'official-url-slot' },
  { key: 'roles', label: 'PTIN, CPA, EA, accountant, bookkeeper, payroll, sales-tax, and tax attorney role explanation', status: 'copy-ready' }
];

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ');
}

function canonicalPath(input = {}) {
  const raw = String(input.pathway || input.selected_path || input.path || 'not-sure');
  if (PATHS.some((p) => p.key === raw)) return raw;
  return LEGACY_PATH_MAP[raw] || 'not-sure';
}

function selectedPathRecord(input = {}) {
  const key = canonicalPath(input);
  return PATHS.find((path) => path.key === key) || PATHS[PATHS.length - 1];
}

function detectPersonalBusiness(input = {}) {
  const text = normalize([input.pathway, input.description, input.noticeText, input.primaryConcern, input.incomeTypes, input.stateCityIssues, input.businessType, input.entityType].filter(Boolean).join(' '));
  const businessTerms = ['business', 'llc', 'partnership', 's corp', 's-corp', 'corporation', 'c corp', 'payroll', 'sales tax', '1099 workers', 'contractors', 'bookkeeping', 'profit and loss', 'schedule c', 'sole proprietor'];
  const personalTerms = ['w-2', 'dependent', 'spouse', 'child', 'education', 'unemployment', 'personal', '1040'];
  const business = businessTerms.some((term) => text.includes(term)) || canonicalPath(input) === 'business-return-filing';
  const personal = personalTerms.some((term) => text.includes(term)) || canonicalPath(input) === 'personal-return-filing';
  if (business && personal) return 'both';
  if (business) return 'business';
  if (personal) return 'personal';
  return 'unknown';
}

function detectEntityType(input = {}) {
  const text = normalize([input.entityType, input.businessType, input.description, input.noticeText, input.primaryConcern].filter(Boolean).join(' '));
  if (text.includes('s corp') || text.includes('s-corp')) return 'S corporation';
  if (text.includes('c corp') || text.includes('corporation')) return 'C corporation / corporation';
  if (text.includes('partnership') || text.includes('multi member')) return 'partnership / multi-member LLC';
  if (text.includes('single member') || text.includes('single-member') || text.includes('sole proprietor') || text.includes('schedule c')) return 'sole proprietor / single-member LLC / Schedule C';
  if (text.includes('llc')) return 'LLC - type needs clarification';
  return 'not sure / not provided';
}

function detectIssueCategories(input = {}) {
  const text = normalize([input.pathway, input.description, input.noticeText, input.primaryConcern, input.incomeTypes, input.stateCityIssues].filter(Boolean).join(' '));
  const categories = [];
  const add = (key, label, terms) => { if (terms.some((term) => text.includes(term))) categories.push({ key, label }); };
  add('new_personal_return', 'New personal return filing', ['personal return', 'w-2', '1040', 'file a return', 'file my return']);
  add('new_business_return', 'New business return filing', ['business return', 'llc', 'partnership', 's corp', 'c corp', 'schedule c', 'business taxes']);
  add('prior_year_filing', 'Prior-year return filing', ['prior year', 'back year', 'late return', 'unfiled', 'not filed']);
  add('return_review', 'Return review before filing', ['review before filing', 'check my return', 'return review']);
  add('past_return_review', 'Past return review', ['already filed', 'past return', 'prior filed', 'filed return']);
  add('amendment_review', 'Possible amended-return review', ['amend', 'amended', '1040x', '1040-x', 'mistake', 'missed deduction', 'missed credit']);
  add('notice', 'Notice explanation', ['notice', 'letter', 'cp2000', 'cp ', 'bill', 'proposed']);
  add('balance_due', 'Balance due / tax bill', ['balance due', 'owe', 'tax bill', 'cannot pay']);
  add('collection', 'Collection risk', ['levy', 'lien', 'garnish', 'garnishment', 'warrant', 'seize', 'summons']);
  add('payroll_sales_tax', 'Payroll or sales-tax issue', ['payroll', 'trust fund', 'sales tax', 'withholding']);
  if (!categories.length) categories.push({ key: canonicalPath(input), label: selectedPathRecord(input).label });
  return categories;
}

function buildDocumentChecklist(input = {}) {
  const path = canonicalPath(input);
  const personalBusiness = detectPersonalBusiness(input);
  const items = ['Tax year or tax period involved', 'Any IRS/NYS/NYC notice number, date, deadline, and amount if there is a notice', 'Description of what you are trying to file, fix, review, amend, or understand'];
  if (path === 'personal-return-filing' || personalBusiness === 'personal' || personalBusiness === 'both') items.push('W-2s, 1099s, self-employment/gig summaries, dependents, education, credits, estimated tax, and state/city filing facts');
  if (path === 'business-return-filing' || personalBusiness === 'business' || personalBusiness === 'both') items.push('Entity type, bookkeeping status, profit and loss, balance sheet if needed, payroll/sales-tax facts, contractor/1099 facts, assets, vehicles, inventory, and home-office facts');
  if (path === 'past-return-review') items.push('Copies of filed personal or business returns for the years to review, any notices, corrected documents, and the reason you think something may have been missed');
  if (path === 'free-truth-check' || path === 'fix-tax-problem') items.push('A redacted/sample copy of the notice if allowed, or a no-file description with agency, year, amount, deadline, and what the notice says');
  return items;
}

function buildMistakesToAvoid(pathKey = 'not-sure') {
  const common = ['Do not ignore time-sensitive notices.', 'Do not paste full SSNs, bank account numbers, full notices, full returns, W-2s, or 1099s into public text boxes.', 'Do not assume a refund, penalty relief, payment plan, amendment benefit, or government acceptance is guaranteed.'];
  if (pathKey === 'past-return-review') return [...common, 'Do not file an amended return just because something looks different; review deadlines, state impact, income changes, and professional guidance first.'];
  if (pathKey === 'business-return-filing') return [...common, 'Do not mix payroll, sales-tax, income-tax, and bookkeeping issues without routing specialized issues for review.'];
  if (pathKey === 'free-truth-check' || pathKey === 'fix-tax-problem') return [...common, 'Do not pay, sign, call, or respond before checking the notice date, response deadline, tax year, and agency instructions.'];
  return common;
}

function reviewRole(input = {}) {
  const text = normalize([input.pathway, input.description, input.noticeText, input.primaryConcern, input.incomeTypes, input.stateCityIssues, input.entityType, input.businessType].filter(Boolean).join(' '));
  if (['levy','lien','garnish','court','criminal','fraud','trust fund','summons'].some((term) => text.includes(term))) return 'urgent professional review / tax attorney or appropriate specialist may be needed';
  if (['payroll','sales tax','partnership','s corp','corporation','c corp','bookkeeping'].some((term) => text.includes(term))) return 'CPA/accountant/bookkeeper/payroll/sales-tax specialist review may be needed';
  if (['tax debt','payment plan','offer in compromise','oic','collection'].some((term) => text.includes(term))) return 'EA/CPA/tax professional review may be needed';
  if (['file return','personal return','w-2','1099','schedule c'].some((term) => text.includes(term))) return 'PTIN preparer or tax preparation review may be needed before filing';
  return 'general intake first; professional review level depends on facts';
}

function buildPersonalFilingReadiness(input = {}) {
  return {
    title: 'Personal Filing Readiness Summary',
    status: 'intake-ready-not-filed',
    year_or_period: String(input.taxYears || input.tax_year || '').trim() || 'not provided',
    current_or_prior_year: /prior|back|late|unfiled/i.test([input.description, input.primaryConcern, input.taxYears].join(' ')) ? 'prior-year or late filing may be involved' : 'current-year or ordinary filing intake may be involved',
    likely_return_type: /schedule c|self|1099|gig|contractor/i.test([input.description, input.incomeTypes, input.primaryConcern].join(' ')) ? 'personal return with self-employment / Schedule C questions' : 'personal return category needs confirmation',
    readiness_checklist: ['Confirm tax year and filing status', 'Gather W-2, 1099, self-employment, dependent, credit, education, unemployment, and state/city facts where relevant', 'Confirm whether the year was already filed or rejected', 'Choose PTIN/preparer/professional review before filing'],
    no_guarantee: 'No refund amount, tax savings, filing result, or acceptance is guaranteed.'
  };
}

function buildBusinessFilingReadiness(input = {}) {
  const entity = detectEntityType(input);
  const needsCleanup = /no bookkeeping|messy|cleanup|missing|not done|no p&l|no profit/i.test([input.description, input.primaryConcern, input.noticeText].join(' '));
  return {
    title: 'Business Filing Readiness Summary',
    status: 'business-intake-routing-only',
    entity_type: entity,
    year_or_period: String(input.taxYears || input.tax_year || '').trim() || 'not provided',
    bookkeeping_cleanup_warning: needsCleanup ? 'Bookkeeping cleanup may be needed before return preparation or review.' : 'Bookkeeping status still needs confirmation.',
    payroll_sales_tax_warning: /payroll|sales tax|withholding|trust fund/i.test([input.description, input.noticeText, input.primaryConcern].join(' ')) ? 'Payroll or sales-tax issues may require specialized professional review before action.' : 'Ask whether payroll or sales-tax applies.',
    documents_needed: ['Entity type and ownership facts', 'Business income and expense records', 'Profit and loss statement', 'Balance sheet if needed', 'Payroll/sales-tax/1099 contractor facts if applicable', 'Prior business returns or notices if relevant'],
    no_guarantee: 'No business tax savings, filing result, payroll/sales-tax outcome, or government acceptance is guaranteed.'
  };
}

function buildAmendmentOpportunitySummary(input = {}) {
  const text = normalize([input.pathway, input.description, input.primaryConcern, input.noticeText, input.taxYears, input.entityType, input.businessType, input.stateCityIssues].filter(Boolean).join(' '));
  const issueHints = [];
  const add = (label, terms) => { if (terms.some((term) => text.includes(term))) issueHints.push(label); };
  add('possible missed deduction', ['deduction', 'expense', 'write off', 'write-off']);
  add('possible missed credit', ['credit', 'child tax', 'earned income', 'eitc', 'education', 'dependent care']);
  add('filing-status or dependent question', ['filing status', 'head of household', 'dependent', 'spouse', 'married', 'single']);
  add('income-reporting / W-2 / 1099 question', ['income', 'w-2', 'w2', '1099', 'cp2000', 'underreported']);
  add('self-employment or Schedule C expense question', ['self employ', 'schedule c', 'gig', 'contractor', 'business expense', 'home office', 'vehicle', 'mileage']);
  add('business return / entity review question', ['business return', 'llc', 'partnership', 's corp', 's-corp', 'corporation', '1120', '1065', '1120-s']);
  add('depreciation / asset / vehicle / home-office question', ['depreciation', 'asset', 'vehicle', 'mileage', 'home office', 'equipment']);
  add('payroll or sales-tax issue requiring specialist routing', ['payroll', '941', 'trust fund', 'sales tax', 'resale', 'withholding']);
  add('state/local issue', ['nys', 'new york', 'nyc', 'city', 'state', 'local']);
  add('notice tied to filed return', ['notice', 'letter', 'cp2000', 'audit', 'adjustment', 'balance due']);
  const personalBusiness = detectPersonalBusiness(input);
  return {
    title: 'Prior-Year Return Review / Amendment Opportunity Summary',
    status: 'free-screening / review-before-action',
    headline: 'Already filed? A second look may uncover something worth correcting.',
    possible_amendment_opportunity: issueHints.length ? 'possible / needs review' : 'unknown / needs prior returns and issue description',
    personal_or_business: personalBusiness,
    years_selected: String(input.taxYears || input.tax_year || '').trim() || 'not provided',
    possible_issue_categories: issueHints.length ? issueHints : ['missed income, deductions, credits, dependents, filing status, business expenses, state/local, or notice-related issues need review'],
    review_scope: [
      'recent filed personal returns',
      'recent filed business returns where appropriate',
      'Schedule C / self-employed / 1099 / gig-worker returns',
      'LLC, partnership, S corporation, or corporate return issues where appropriate with professional routing',
      'returns connected to IRS, NYS, NYC, business, payroll, or sales-tax notices'
    ],
    documents_needed: [
      'Filed federal return for each year to review',
      'Filed state/city return for each year to review, if applicable',
      'Business return, Schedule C, K-1, partnership, S corp, corporation, or bookkeeping records if business issues are involved',
      'W-2s, 1099s, corrected forms, receipts, credit records, dependent/education records, or other support for the possible change',
      'Any IRS/NYS/NYC/business/payroll/sales-tax notices for those years',
      'A short explanation of what may have been wrong, missed, or changed'
    ],
    free_screening: true,
    paid_option_boundary: 'Preparing, professionally reviewing, or filing an amended return may be a paid service. We explain cost and scope before paid work begins.',
    deadline_warning: 'Refund and amendment deadlines can matter. For federal refund claims, IRS Form 1040-X instructions generally say a claim must be filed within 3 years after the original return was filed or 2 years after the tax was paid, whichever is later, but deadlines, exceptions, and state/city rules should be verified before action.',
    no_guarantee: 'An amended return may be worth reviewing, but it is not always beneficial or appropriate. No refund, savings, acceptance, or outcome is guaranteed. IRS, NYS, NYC, or other taxing authorities make final decisions.',
    professional_review_note: 'A tax professional should review before filing an amended return, especially for business, payroll, sales-tax, refund-deadline, notice, or high-risk issues.'
  };
}

function buildTruthCheckSummary(input = {}) {
  const path = selectedPathRecord(input);
  const categories = detectIssueCategories(input);
  return {
    title: path.key === 'free-truth-check' ? 'Tax Problem Truth Check Summary' : 'Tax Problem Organization Summary',
    status: 'free-starting-summary',
    what_this_appears_to_be: `This appears to be a ${path.label.toLowerCase()} starting point based on the information provided.`,
    agency: String(input.agency || '').trim() || 'IRS, NYS, NYC, payroll/sales-tax agency, other taxing authority, or unknown - needs confirmation',
    personal_or_business: detectPersonalBusiness(input),
    tax_year_or_period: String(input.taxYears || input.tax_year || '').trim() || 'not provided',
    issue_categories: categories,
    why_it_matters: 'Deadlines, tax periods, agency instructions, and missing returns or records can affect safe next steps.',
    documents_to_gather: buildDocumentChecklist(input),
    mistakes_to_avoid: buildMistakesToAvoid(path.key),
    questions_to_ask: ['Which agency and tax year/period is involved?', 'Is there a response deadline?', 'Is there an amount due or proposed change?', 'Was a return already filed?', 'Could new filing, business filing, prior-year filing, return review, or amended-return review be relevant?'],
    review_role: reviewRole(input),
    cautious_language: 'This is not a final tax determination. Final decisions are made by the IRS, NYS, NYC, or other taxing authority. Deadlines and options should be verified against the original notice and official sources.'
  };
}

function buildUnifiedIntakeResult(input = {}, existingAnalysis = {}) {
  const path = selectedPathRecord(input);
  const personal = buildPersonalFilingReadiness(input);
  const business = buildBusinessFilingReadiness(input);
  const amendment = buildAmendmentOpportunitySummary(input);
  const truth = buildTruthCheckSummary(input);
  const pathKey = path.key;
  const primary = pathKey === 'personal-return-filing' ? personal : pathKey === 'business-return-filing' ? business : pathKey === 'past-return-review' ? amendment : truth;
  return {
    selected_path: path,
    primary_summary: primary,
    available_summaries: {
      personal_filing_readiness: personal,
      business_filing_readiness: business,
      prior_year_return_review_amendment: amendment,
      tax_problem_truth_check: truth
    },
    free_summary_confirmed: pathKey === 'free-truth-check' || pathKey === 'past-return-review' || pathKey === 'not-sure' || pathKey === 'fix-tax-problem',
    initial_amendment_screening_free: true,
    payment_gate_note: 'No payment is required for the basic Tax Problem Truth Check Summary or initial amendment-opportunity screening/free starting point. Paid filing, amendment preparation, response preparation, bookkeeping cleanup, tax resolution, or professional review begins only after options are explained and the user chooses deeper help.',
    staff_queue_record: buildStaffQueueRecord(input, existingAnalysis, primary),
    public_disclaimer: 'Starting organizer only. No refund, tax savings, amendment benefit, filing result, payment-plan approval, penalty relief, settlement, collection hold, business tax savings, or government outcome is guaranteed.'
  };
}

function buildStaffQueueRecord(input = {}, existingAnalysis = {}, primarySummary = {}) {
  const path = selectedPathRecord(input);
  const categories = detectIssueCategories(input);
  return {
    submission_type: path.key,
    selected_path: path.label,
    personal_business_both: detectPersonalBusiness(input),
    entity_type_if_business: detectEntityType(input),
    notice_type: /cp2000/i.test(String(input.noticeText || input.description || '')) ? 'CP2000 / income mismatch' : 'not provided / needs classification',
    agency: existingAnalysis.agency || 'Unknown / needs human review',
    tax_year_or_period: String(input.taxYears || input.tax_year || '').trim() || 'not provided',
    amount_at_issue: /\$|owe|balance|due/i.test([input.description, input.noticeText].join(' ')) ? 'mentioned / needs verification from notice' : 'not provided',
    deadline: /deadline|respond|30 days|60 days|90 days|due date/i.test([input.description, input.noticeText].join(' ')) ? 'mentioned / verify exact date' : 'not provided',
    urgency_level: existingAnalysis.risk_level || 'low',
    issue_category: categories.map((c) => c.label),
    uploaded_document_present: false,
    return_documents_uploaded: false,
    business_records_uploaded: false,
    extracted_summary: primarySummary.title || 'Starting summary',
    recommended_review_role: reviewRole(input),
    callback_requested: /callback|call|phone|speak/i.test([input.description, input.primaryConcern].join(' ')),
    requested_outcome: String(input.primaryConcern || input.description || '').slice(0, 240),
    status: 'new-intake-triage',
    next_follow_up_date: '',
    truth_check_free_confirmed: true,
    new_personal_return_requested: path.key === 'personal-return-filing',
    new_business_return_requested: path.key === 'business-return-filing',
    prior_year_filing_requested: /prior|back|late|unfiled/i.test([input.description, input.taxYears, input.primaryConcern].join(' ')),
    prior_year_return_review_requested: path.key === 'past-return-review',
    possible_amended_return_issue: path.key === 'past-return-review' || /amend|1040-x|1040x|mistake|missed/i.test([input.description, input.primaryConcern].join(' ')),
    refund_deadline_warning: path.key === 'past-return-review',
    federal_amendment_needed: 'unknown',
    state_amendment_needed: 'unknown',
    business_amendment_needed: detectPersonalBusiness(input) === 'business' || detectPersonalBusiness(input) === 'both' ? 'unknown' : 'no/unknown',
    professional_review_suggested: /high|medium/.test(existingAnalysis.risk_level || '') || /payroll|sales tax|levy|lien|garnish|attorney|cpa|ea/i.test([input.description, input.noticeText, input.primaryConcern].join(' '))
  };
}

function buildPublicStartMap() {
  return {
    headline: 'File, fix, review, amend, and understand your taxes.',
    supporting_copy: [
      'Tax help for people and businesses who need more than software.',
      'File a new return, review past returns, or understand a tax notice.',
      'Personal and business tax help in one place.',
      'Start with the return, the business records, the letter, or the problem. We help you organize the next step.'
    ],
    paths: PATHS,
    free_truth_check: {
      is_free: true,
      includes: ['issue classification', 'agency/year/period/deadline clues when provided', 'plain-language summary', 'urgency flags', 'documents-to-gather checklist', 'mistakes-to-avoid checklist', 'questions to ask', 'review-role routing', 'possible filing/review/amendment relevance'],
      not_included: ['final tax determination', 'legal advice', 'guaranteed outcome', 'final form output', 'e-file', 'agency submission', 'refund advance', 'refund transfer']
    },
    amendment_screening: {
      initial_screening_free: true,
      paid_only_if_chosen: true,
      no_guarantee: 'Past-return review may identify possible amendment questions, but it does not guarantee a refund, savings, acceptance, or that amending is appropriate.',
      homepage_priority: 'Already filed? Your past returns may be worth a second look.',
      marketing_tagline: 'Filed already? A second look may uncover something worth correcting.'
    }
  };
}

function buildUnifiedStartReadinessAudit() {
  return {
    version_name: 'Unified Start Flow + Prior-Return Review Marketing Prominence',
    acceptance_checks: [
      { key: 'personal_return_prominent', label: 'File a Personal Tax Return is prominent', passed: true },
      { key: 'business_return_prominent', label: 'File a Business Tax Return is prominent', passed: true },
      { key: 'past_return_review_prominent', label: 'Review Past Returns is especially prominent across homepage, navigation, start path, dashboard, pricing/help, FAQ, and marketing materials', passed: true },
      { key: 'truth_check_free', label: 'Free Tax Problem Truth Check remains free', passed: true },
      { key: 'no_surprise_payment_gate', label: 'No hidden payment gate before basic starting summary', passed: true },
      { key: 'safe_language', label: 'Uses may/appears/needs verification language and avoids guarantees', passed: true },
      { key: 'business_tax_visible', label: 'Business taxes are not hidden under only gig-worker language', passed: true },
      { key: 'no_fake_e_file_or_refund_products', label: 'No fake e-file, refund-transfer, refund-advance, or bank-product activation', passed: true },
      { key: 'no_fake_professional_claims', label: 'No false CPA/EA/attorney/law/accounting-firm status', passed: true }
    ],
    staff_queue_fields: STAFF_QUEUE_FIELDS,
    resource_slots: RESOURCE_SLOTS,
    prohibited_public_claims: PROHIBITED_PUBLIC_CLAIMS,
    production_status: 'Readiness/demo/controlled-pilot mode. Filing intake and summaries are supported; final filing/submission/output still requires operational review and production gates.'
  };
}

module.exports = {
  PATHS,
  LEGACY_PATH_MAP,
  PROHIBITED_PUBLIC_CLAIMS,
  STAFF_QUEUE_FIELDS,
  RESOURCE_SLOTS,
  buildPublicStartMap,
  buildUnifiedIntakeResult,
  buildPersonalFilingReadiness,
  buildBusinessFilingReadiness,
  buildAmendmentOpportunitySummary,
  buildTruthCheckSummary,
  buildStaffQueueRecord,
  buildUnifiedStartReadinessAudit,
  canonicalPath
};
