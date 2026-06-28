const REVIEW_LEVELS = [
  {
    key: 'ai_completion_only',
    label: 'AI Completion Only',
    publicLabel: 'AI completion only',
    startingAtCents: 3900,
    displayRange: '$39–$299',
    reviewer: 'AI-guided platform workflow with client verification',
    humanWork: 'No routine human review; exception flags can still block release or require upgrade.',
    bestFor: 'Low-risk forms, organizers, extensions, authorization forms, and known facts where the client wants a print-ready draft to review and sign themselves.',
    releaseRule: 'May prepare a client-verification draft only after the official PDF is captured, mapped, sample-filled, and gated. Not an agency submission or representation service.',
    complianceNote: 'For paid federal return preparation, the platform must route to a valid PTIN preparer level where required rather than implying an unreviewed AI can act as paid preparer.'
  },
  {
    key: 'ptin_preparer_review',
    label: 'PTIN Preparer Review',
    publicLabel: 'PTIN preparer review',
    startingAtCents: 7900,
    displayRange: '$79–$499',
    reviewer: 'Valid PTIN preparer / trained tax preparer workflow',
    humanWork: 'Targeted preparer review of AI-completed fields, required documents, signature/preparer areas, and client verification checklist.',
    bestFor: 'Simple and moderate return-prep support, extensions, amended-return basics, and low-to-medium risk print packages.',
    releaseRule: 'Reviewer signoff is required before the platform presents a paid-preparer-reviewed return package or filing-support package.',
    complianceNote: 'Paid federal return preparation requires valid PTIN involvement where required; state requirements such as NYTPRIN should also be checked.'
  },
  {
    key: 'enrolled_agent_review',
    label: 'Enrolled Agent Review',
    publicLabel: 'EA review',
    startingAtCents: 12900,
    displayRange: '$129–$799+',
    reviewer: 'Enrolled Agent review / tax controversy and IRS collection-aware review',
    humanWork: 'EA reviews tax debt, IRS notice, collection, installment agreement, OIC, transcript/authorization, and representation-sensitive workflows.',
    bestFor: 'IRS tax debt, notices, payment plans, penalty relief screening, OIC screening, transcript authorization, audit/collection concerns, and multi-year IRS issues.',
    releaseRule: 'EA review is recommended or required when the workflow involves IRS controversy, collection options, representation-sensitive decisions, or high-risk agency response strategy.',
    complianceNote: 'EAs are federally authorized tax practitioners; do not imply they are IRS employees or guarantee agency outcomes.'
  },
  {
    key: 'cpa_review',
    label: 'CPA Review',
    publicLabel: 'CPA review',
    startingAtCents: 14900,
    displayRange: '$149–$899+',
    reviewer: 'CPA review / accounting and complex return review',
    humanWork: 'CPA reviews higher-complexity return items, accounting classification, Schedule C/business income, entity issues, multi-state issues, and higher-dollar tax consequences.',
    bestFor: 'Self-employed/gig-worker returns, business income, bookkeeping cleanup flags, rentals, K-1s, entity returns, NYS/NYC business tax, and high-dollar amendments.',
    releaseRule: 'CPA review is recommended for complex accounting, business, entity, or multi-jurisdiction tax issues before release.',
    complianceNote: 'CPA review is not legal advice unless the reviewer is separately licensed and engaged as an attorney.'
  },
  {
    key: 'tax_attorney_review',
    label: 'Tax Attorney Review',
    publicLabel: 'Tax attorney review',
    startingAtCents: 24900,
    displayRange: '$249–$1,299+ / quote',
    reviewer: 'Licensed tax attorney review where separately arranged',
    humanWork: 'Attorney reviews legal-advice-sensitive issues, privilege/representation questions, tax court/appeals, fraud/criminal exposure, levies/liens with legal risk, and disputed legal positions.',
    bestFor: 'Legal advice, tax controversy with legal exposure, appeals/tax court, fraud/criminal indicators, complex settlement strategy, and issues requiring attorney-client engagement.',
    releaseRule: 'Tax attorney review is required before the platform suggests legal strategy or representation-sensitive communications.',
    complianceNote: 'Justice Tax Solutions should not imply it is a law firm. Attorney services require a separately arranged attorney relationship.'
  }
];

const LEVEL_ORDER = REVIEW_LEVELS.map((level) => level.key);
const LEVEL_LABEL_BY_KEY = Object.fromEntries(REVIEW_LEVELS.map((level) => [level.key, level.label]));

const PRICING_TIERS = {
  free_starting_point: {
    key: 'free_starting_point',
    label: 'Free Tax Starting Point',
    publicPriceCents: 0,
    referralRewardCents: 0,
    rewardRank: 0,
    reviewLevel: 'starter_only',
    customerPromise: 'Initial tax concern summary, risk flags, missing-item checklist, and recommended next path.',
    includes: ['AI-guided starting interview', 'Plain-English issue summary', 'Missing item checklist', 'No sensitive live document handling until production gates are complete'],
    exclusions: ['No filing', 'No agency submission', 'No guaranteed tax outcome']
  },
  notice_quick_summary: {
    key: 'notice_quick_summary',
    label: 'Tax Notice Quick Summary',
    publicPriceCents: 4900,
    referralRewardCents: 1000,
    rewardRank: 10,
    reviewLevel: 'ai_completion_only',
    customerPromise: 'Plain-English explanation of an IRS/NYS/NYC notice, likely urgency, and next-step checklist.',
    includes: ['Notice type classification', 'Deadline/risk flags', 'Questions to answer before responding'],
    exclusions: ['No response sent to agency', 'No representation', 'No guarantee that penalties, interest, or tax will be reduced']
  },
  notice_action_plan: {
    key: 'notice_action_plan',
    label: 'Tax Notice Action Plan + Draft Response Prep',
    publicPriceCents: 9900,
    referralRewardCents: 2500,
    rewardRank: 20,
    reviewLevel: 'ai_completion_only',
    customerPromise: 'Notice workflow with draft response checklist and form/document plan when appropriate.',
    includes: ['Notice issue tree', 'Follow-up questions', 'Draft response plan', 'Document checklist', 'Exception review only when risk is high'],
    exclusions: ['No same-day representation', 'No agency submission without client/professional verification']
  },
  return_organizer: {
    key: 'return_organizer',
    label: 'Return Organizer',
    publicPriceCents: 4900,
    referralRewardCents: 1000,
    rewardRank: 10,
    reviewLevel: 'ai_completion_only',
    customerPromise: 'Document checklist and return-readiness map before paid preparation/review.',
    includes: ['Income/document checklist', 'Filing status/dependent screening', 'Federal/state path recommendation'],
    exclusions: ['No tax return prepared or filed at this level']
  },
  simple_return_ai_draft: {
    key: 'simple_return_ai_draft',
    label: 'Simple Return AI Completion Only',
    publicPriceCents: 9900,
    referralRewardCents: 2500,
    rewardRank: 20,
    reviewLevel: 'ai_completion_only',
    customerPromise: 'AI-guided simple return draft package for client review/signature when forms are verified for output and AI-only mode is permitted.',
    includes: ['Dynamic interview', 'Missing-info follow-up', 'Draft field completion where verified', 'Client verification checklist'],
    exclusions: ['No e-file under our operation until EFIN/e-file partner path is configured', 'No PTIN preparer signoff at this level']
  },
  simple_return_ptin_review: {
    key: 'simple_return_ptin_review',
    label: 'Simple Return PTIN Preparer Review',
    publicPriceCents: 19900,
    referralRewardCents: 5000,
    rewardRank: 35,
    reviewLevel: 'ptin_preparer_review',
    customerPromise: 'PTIN preparer/accountant review for simple W-2/standard-deduction return workflows.',
    includes: ['AI-prepared draft where available', 'PTIN preparer or qualified staff review', 'Client approval gate', 'Print/signature or e-file partner path when configured'],
    exclusions: ['Government filing fees and taxes are separate']
  },
  gig_worker_cpa_review: {
    key: 'gig_worker_cpa_review',
    label: 'Self-Employed / Gig Worker CPA-Level Review',
    publicPriceCents: 49900,
    referralRewardCents: 5000,
    rewardRank: 55,
    reviewLevel: 'cpa_review',
    customerPromise: 'Schedule C, 1099, mileage, expense, NYS/NYC screening, and accounting-sensitive review for gig workers and freelancers.',
    includes: ['Income/expense interview', 'Mileage/vehicle follow-up', 'Schedule C readiness review', 'NYS/NYC screening', 'CPA-level exception review when facts are complex'],
    exclusions: ['Bookkeeping cleanup and entity returns may require quote']
  },
  tax_debt_ai_screen: {
    key: 'tax_debt_ai_screen',
    label: 'Tax Debt AI Screening + Options Map',
    publicPriceCents: 9900,
    referralRewardCents: 2500,
    rewardRank: 20,
    reviewLevel: 'ai_completion_only',
    customerPromise: 'Payment-plan, hardship, penalty-relief, and OIC possibility screening without overpromising results.',
    includes: ['Debt/agency issue tree', 'Cannot-pay interview', 'Likely missing records list', 'Professional escalation flags'],
    exclusions: ['No agency negotiation', 'No guaranteed payment plan, hardship, penalty relief, or OIC']
  },
  tax_debt_ea_review: {
    key: 'tax_debt_ea_review',
    label: 'Tax Debt / Notice EA Review',
    publicPriceCents: 39900,
    referralRewardCents: 5000,
    rewardRank: 50,
    reviewLevel: 'enrolled_agent_review',
    customerPromise: 'EA-level review for IRS/NYS/NYC debt, payment-plan, hardship, OIC, notice, or agency response workflows.',
    includes: ['AI-generated issue summary', 'Form/action plan', 'Document checklist', 'EA-level tax-resolution review when needed'],
    exclusions: ['Government payments, taxes, penalties, interest, transcripts, and third-party professional fees are separate']
  },
  tax_attorney_review: {
    key: 'tax_attorney_review',
    label: 'Tax Attorney Review',
    publicPriceCents: 59900,
    referralRewardCents: 5000,
    rewardRank: 65,
    reviewLevel: 'tax_attorney_review',
    customerPromise: 'Attorney escalation for legal-advice-sensitive tax controversy, appeals, tax court, fraud/criminal exposure, or representation strategy.',
    includes: ['Attorney routing', 'Issue summary', 'Complexity/risk notes', 'Client approval before attorney-level release'],
    exclusions: ['Separate attorney engagement may be required for legal advice or representation']
  }
};

const SERVICE_LEVELS = REVIEW_LEVELS.map((level) => ({
  key: level.key,
  label: level.label,
  startingAtCents: level.startingAtCents,
  publicDisplay: level.displayRange,
  bestFor: level.bestFor,
  humanWork: level.humanWork,
  reviewer: level.reviewer,
  releaseRule: level.releaseRule
}));

const FORM_PRICING_MATRIX = [
  { form: '9465', agency: 'IRS', title: 'Installment Agreement Request', category: 'tax_debt', aiCompletionCents: 9900, ptinReviewCents: 19900, enrolledAgentReviewCents: 29900, cpaReviewCents: 39900, taxAttorneyReviewCents: 59900, referralRewardCents: 2500, complexity: 'low_to_medium', defaultLevel: 'ai_completion_only', minimumLevel: 'ai_completion_only', outputGate: 'verified_pdf_map_required', notes: 'Good first paid AI-form product once field map and sample-fill QA are complete; EA review if tax debt facts become complex.' },
  { form: '433-F', agency: 'IRS', title: 'Collection Information Statement', category: 'tax_debt_financial', aiCompletionCents: 19900, ptinReviewCents: 29900, enrolledAgentReviewCents: 39900, cpaReviewCents: 49900, taxAttorneyReviewCents: 79900, referralRewardCents: 5000, complexity: 'medium_to_high', defaultLevel: 'enrolled_agent_review', minimumLevel: 'ptin_preparer_review', outputGate: 'professional_exception_review_common', notes: 'Financial disclosure; escalate asset transfers, business income, equity, or hardship claims.' },
  { form: '2848', agency: 'IRS', title: 'Power of Attorney and Declaration of Representative', category: 'authorization', aiCompletionCents: 7900, ptinReviewCents: 14900, enrolledAgentReviewCents: 24900, cpaReviewCents: 29900, taxAttorneyReviewCents: 49900, referralRewardCents: 2500, complexity: 'medium', defaultLevel: 'enrolled_agent_review', minimumLevel: 'ptin_preparer_review', outputGate: 'representative_credentials_required', notes: 'Only use when a valid representative relationship and scope are verified.' },
  { form: '8821', agency: 'IRS', title: 'Tax Information Authorization', category: 'authorization', aiCompletionCents: 7900, ptinReviewCents: 12900, enrolledAgentReviewCents: 19900, cpaReviewCents: 24900, taxAttorneyReviewCents: 39900, referralRewardCents: 2500, complexity: 'low_to_medium', defaultLevel: 'ai_completion_only', minimumLevel: 'ai_completion_only', outputGate: 'scope_and_period_verification_required', notes: 'Useful for transcript/information access workflow; verify tax matters and years.' },
  { form: '1040-X', agency: 'IRS', title: 'Amended U.S. Individual Income Tax Return', category: 'amended_return', aiCompletionCents: 19900, ptinReviewCents: 29900, enrolledAgentReviewCents: 39900, cpaReviewCents: 49900, taxAttorneyReviewCents: 79900, referralRewardCents: 5000, complexity: 'medium_to_high', defaultLevel: 'ptin_preparer_review', minimumLevel: 'ptin_preparer_review', outputGate: 'original_and_corrected_amounts_required', notes: 'Price depends heavily on reason for amendment and schedules affected.' },
  { form: '4868', agency: 'IRS', title: 'Application for Automatic Extension of Time To File', category: 'extension', aiCompletionCents: 3900, ptinReviewCents: 7900, enrolledAgentReviewCents: 12900, cpaReviewCents: 14900, taxAttorneyReviewCents: 24900, referralRewardCents: 1000, complexity: 'low', defaultLevel: 'ai_completion_only', minimumLevel: 'ai_completion_only', outputGate: 'tax_estimate_warning_required', notes: 'Must explain extension to file is not extension to pay.' },
  { form: '656', agency: 'IRS', title: 'Offer in Compromise', category: 'tax_resolution', aiCompletionCents: 29900, ptinReviewCents: 49900, enrolledAgentReviewCents: 79900, cpaReviewCents: 89900, taxAttorneyReviewCents: 129900, referralRewardCents: 5000, complexity: 'high', defaultLevel: 'enrolled_agent_review', minimumLevel: 'enrolled_agent_review', outputGate: 'qualified_professional_review_required', notes: 'Never promise acceptance or pennies-on-the-dollar result.' },
  { form: '1040', agency: 'IRS', title: 'U.S. Individual Income Tax Return', category: 'return_prep', aiCompletionCents: 9900, ptinReviewCents: 19900, enrolledAgentReviewCents: 29900, cpaReviewCents: 34900, taxAttorneyReviewCents: 59900, referralRewardCents: 5000, complexity: 'simple_to_high', defaultLevel: 'ptin_preparer_review', minimumLevel: 'ptin_preparer_review', outputGate: 'year_specific_forms_and_ptin_review_required_when_paid_prep', notes: 'Use add-ons for Schedule C, itemized deductions, credits, and state returns.' },
  { form: 'Schedule C', agency: 'IRS', title: 'Profit or Loss From Business', category: 'self_employed', aiCompletionCents: 14900, ptinReviewCents: 29900, enrolledAgentReviewCents: 39900, cpaReviewCents: 49900, taxAttorneyReviewCents: 79900, referralRewardCents: 5000, complexity: 'medium_to_high', defaultLevel: 'cpa_review', minimumLevel: 'ptin_preparer_review', outputGate: 'income_expense_documentation_required', notes: 'Critical gig-worker workflow; mileage, platform statements, and expense support needed.' },
  { form: 'IT-201', agency: 'NYS', title: 'Resident Income Tax Return', category: 'state_return', aiCompletionCents: 9900, ptinReviewCents: 14900, enrolledAgentReviewCents: 24900, cpaReviewCents: 29900, taxAttorneyReviewCents: 49900, referralRewardCents: 2500, complexity: 'low_to_medium', defaultLevel: 'ptin_preparer_review', minimumLevel: 'ptin_preparer_review', outputGate: 'federal_return_dependency_required', notes: 'Usually add-on to federal return; NYC/Yonkers screening required.' },
  { form: 'IT-203', agency: 'NYS', title: 'Nonresident and Part-Year Resident Income Tax Return', category: 'state_return', aiCompletionCents: 14900, ptinReviewCents: 24900, enrolledAgentReviewCents: 34900, cpaReviewCents: 39900, taxAttorneyReviewCents: 69900, referralRewardCents: 5000, complexity: 'medium_to_high', defaultLevel: 'cpa_review', minimumLevel: 'ptin_preparer_review', outputGate: 'residency_allocation_review_required', notes: 'Higher review need due to residency/source-income allocation.' },
  { form: 'IT-201-X', agency: 'NYS', title: 'Amended Resident Income Tax Return', category: 'amended_state_return', aiCompletionCents: 14900, ptinReviewCents: 24900, enrolledAgentReviewCents: 34900, cpaReviewCents: 39900, taxAttorneyReviewCents: 69900, referralRewardCents: 5000, complexity: 'medium', defaultLevel: 'ptin_preparer_review', minimumLevel: 'ptin_preparer_review', outputGate: 'federal_or_state_change_reason_required', notes: 'Coordinate with federal 1040-X when applicable.' },
  { form: 'NYC-202', agency: 'NYC', title: 'UBT Return for Individuals', category: 'nyc_business_tax', aiCompletionCents: 19900, ptinReviewCents: 34900, enrolledAgentReviewCents: 44900, cpaReviewCents: 59900, taxAttorneyReviewCents: 89900, referralRewardCents: 5000, complexity: 'medium_to_high', defaultLevel: 'cpa_review', minimumLevel: 'ptin_preparer_review', outputGate: 'business_income_allocation_review_required', notes: 'Freelancer/self-employed NYC workflow; allocation and estimated tax issues common.' },
  { form: 'NYC-202S', agency: 'NYC', title: 'UBT Return for Individuals - Short Form', category: 'nyc_business_tax', aiCompletionCents: 14900, ptinReviewCents: 24900, enrolledAgentReviewCents: 34900, cpaReviewCents: 44900, taxAttorneyReviewCents: 69900, referralRewardCents: 5000, complexity: 'medium', defaultLevel: 'cpa_review', minimumLevel: 'ptin_preparer_review', outputGate: 'eligibility_for_short_form_required', notes: 'Must screen whether short-form eligibility applies.' },
  { form: 'NYC-204', agency: 'NYC', title: 'UBT Return for Partnerships', category: 'nyc_business_tax', aiCompletionCents: 29900, ptinReviewCents: 49900, enrolledAgentReviewCents: 69900, cpaReviewCents: 79900, taxAttorneyReviewCents: 119900, referralRewardCents: 5000, complexity: 'high', defaultLevel: 'cpa_review', minimumLevel: 'cpa_review', outputGate: 'professional_review_required', notes: 'Partnership/entity work should be quote-controlled.' }
];

const RETURN_ADD_ONS = [
  { key: 'state_return_addon', label: 'State return add-on', cents: 9900, trigger: 'NYS or other state return needed' },
  { key: 'nyc_local_addon', label: 'NYC/Yonkers/local add-on', cents: 7900, trigger: 'NYC/Yonkers/local tax screening positive' },
  { key: 'schedule_c_addon', label: 'Schedule C / gig-work add-on', cents: 14900, trigger: '1099/gig/self-employment income' },
  { key: 'itemized_deductions_addon', label: 'Itemized deductions add-on', cents: 7900, trigger: 'Itemized deductions likely or requested' },
  { key: 'prior_year_addon', label: 'Prior-year return add-on', cents: 9900, trigger: 'Unfiled/prior year per year for simple cases' },
  { key: 'rush_review_addon', label: 'Rush / urgent review add-on', cents: 9900, trigger: 'Urgent deadline, if staff capacity allows; no same-day guarantee' }
];

const PRICING_RULES = {
  noGuarantee: 'No refund amount, tax debt reduction, payment plan, penalty relief, offer-in-compromise, audit result, or agency outcome is guaranteed.',
  separateCosts: 'Taxes, penalties, interest, government payments, filing charges, transcript fees, refunds, chargebacks, and separate third-party professional/legal fees are not included.',
  aiFirstHumanMinimal: 'AI should ask the full interview, request missing information, prepare field candidates, run validation checks, and escalate only exception/high-risk items.',
  clientVerification: 'Every client-facing draft requires client verification before signing, filing, or agency response.',
  professionalGate: 'Paid federal return preparation requires valid PTIN involvement where required; IRS controversy/collection workflows should route to EA/CPA/attorney when facts require it; legal advice requires licensed attorney involvement if separately arranged.',
  aiOnlyBoundary: 'AI Completion Only is a low-cost draft/organizer tier. It should not be marketed as professional review, representation, legal advice, guaranteed filing, or guaranteed tax result.',
  customQuoteTriggers: ['multiple tax years', 'business/entity return', 'large tax debt', 'lien/levy/garnishment', 'audit/exam', 'appeals/tax court', 'foreign income/assets', 'cryptocurrency', 'complex rental or partnership/K-1 issues', 'missing records/bookkeeping cleanup', 'urgent deadline without enough facts', 'fraud/criminal exposure']
};

const REVIEW_ROUTING_RULES = [
  { trigger: 'paid federal return preparation', recommendedLevel: 'ptin_preparer_review', reason: 'Paid federal return preparation generally requires valid PTIN involvement where required.' },
  { trigger: 'IRS tax debt, collection, payment plan, OIC, penalty relief, transcript representation', recommendedLevel: 'enrolled_agent_review', reason: 'IRS collection/controversy work should be routed to an EA-level or higher reviewer when it goes beyond draft screening.' },
  { trigger: 'business income, Schedule C complexity, bookkeeping cleanup, rental, K-1, entity, NYS/NYC business tax', recommendedLevel: 'cpa_review', reason: 'Accounting-sensitive or business-tax facts need CPA-level review when complexity is more than simple.' },
  { trigger: 'appeals, tax court, fraud/criminal, legal advice, lien/levy legal strategy, attorney-client privilege', recommendedLevel: 'tax_attorney_review', reason: 'Legal-advice-sensitive matters require attorney review and possibly a separate attorney engagement.' }
];

function centsToLabel(cents = 0) {
  const value = Number(cents || 0);
  if (!value) return '$0';
  return `$${Math.round(value / 100)}`;
}

function normalizeLevel(level = '') {
  const clean = String(level || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (['ai','ai_only','ai_draft','ai_assisted_draft','ai_completion','ai_completion_only'].includes(clean)) return 'ai_completion_only';
  if (['human','human_review','ptin','ptin_review','preparer','preparer_review','ptin_preparer_review'].includes(clean)) return 'ptin_preparer_review';
  if (['ea','ea_review','enrolled_agent','enrolled_agent_review'].includes(clean)) return 'enrolled_agent_review';
  if (['cpa','cpa_review'].includes(clean)) return 'cpa_review';
  if (['attorney','lawyer','tax_attorney','tax_attorney_review','legal'].includes(clean)) return 'tax_attorney_review';
  if (LEVEL_ORDER.includes(clean)) return clean;
  return 'ai_completion_only';
}

function levelRank(level = '') {
  const idx = LEVEL_ORDER.indexOf(normalizeLevel(level));
  return idx === -1 ? 0 : idx;
}

function enforceMinimumLevel(requestedLevel, minimumLevel) {
  const requested = normalizeLevel(requestedLevel);
  const minimum = normalizeLevel(minimumLevel || 'ai_completion_only');
  return levelRank(requested) < levelRank(minimum) ? minimum : requested;
}

function priceForLevel(row, level) {
  const clean = normalizeLevel(level);
  if (clean === 'ptin_preparer_review') return row.ptinReviewCents;
  if (clean === 'enrolled_agent_review') return row.enrolledAgentReviewCents;
  if (clean === 'cpa_review') return row.cpaReviewCents;
  if (clean === 'tax_attorney_review') return row.taxAttorneyReviewCents;
  return row.aiCompletionCents;
}

function pricingTierForProduct(key = '') {
  return PRICING_TIERS[String(key || '').trim()] || null;
}

function formPricingFor(form = '') {
  const clean = String(form || '').trim().toUpperCase();
  return FORM_PRICING_MATRIX.find((row) => row.form.toUpperCase() === clean) || null;
}

function decorateFormPricing(row) {
  return {
    ...row,
    aiCompletionLabel: centsToLabel(row.aiCompletionCents),
    ptinReviewLabel: centsToLabel(row.ptinReviewCents),
    enrolledAgentReviewLabel: centsToLabel(row.enrolledAgentReviewCents),
    cpaReviewLabel: centsToLabel(row.cpaReviewCents),
    taxAttorneyReviewLabel: `${centsToLabel(row.taxAttorneyReviewCents)}+`,
    aiDraftLabel: centsToLabel(row.aiCompletionCents),
    reviewLabel: centsToLabel(row.ptinReviewCents),
    complexLabel: `${centsToLabel(row.taxAttorneyReviewCents)}+`,
    defaultLevelLabel: LEVEL_LABEL_BY_KEY[row.defaultLevel] || row.defaultLevel,
    minimumLevelLabel: LEVEL_LABEL_BY_KEY[row.minimumLevel] || row.minimumLevel,
    referralRewardLabel: centsToLabel(row.referralRewardCents)
  };
}

function buildReviewLevelPricing() {
  return {
    version: 'v0.1.27',
    model: 'Five review levels: AI completion only, PTIN preparer review, enrolled agent review, CPA review, and tax attorney review. The platform should use the lowest safe level and upgrade only when facts require it.',
    levels: REVIEW_LEVELS.map((level) => ({ ...level, startingAtLabel: centsToLabel(level.startingAtCents) })),
    routingRules: REVIEW_ROUTING_RULES,
    escalationPrinciple: 'Show the reason for any upgrade, credit prior eligible platform payments when appropriate, and request client approval before collecting a higher-tier fee.'
  };
}

function buildPublicPricingSchedule() {
  return {
    version: 'v0.1.27',
    philosophy: 'AI completes the full interview and draft wherever safe; the customer pays for the level of review actually needed: AI-only, PTIN preparer, EA, CPA, or tax attorney.',
    serviceLevels: SERVICE_LEVELS.map((level) => ({ ...level, startingAtLabel: centsToLabel(level.startingAtCents) })),
    reviewLevelPricing: buildReviewLevelPricing(),
    publicTiers: Object.values(PRICING_TIERS).map((tier) => ({ ...tier, priceLabel: centsToLabel(tier.publicPriceCents), referralRewardLabel: centsToLabel(tier.referralRewardCents) })),
    formPricingMatrix: FORM_PRICING_MATRIX.map(decorateFormPricing),
    returnAddOns: RETURN_ADD_ONS.map((addon) => ({ ...addon, priceLabel: centsToLabel(addon.cents) })),
    rules: PRICING_RULES
  };
}

function recommendReviewLevel({ formNumber = '', issueType = '', riskFlags = [], requestedLevel = 'ai_completion_only', complexity = 'standard' } = {}) {
  const form = formPricingFor(formNumber);
  const requested = normalizeLevel(requestedLevel);
  let recommended = form ? (levelRank(requested) > levelRank(form.defaultLevel) ? requested : form.defaultLevel) : requested;
  const reasons = [];
  if (form) reasons.push(`Default for ${form.agency} ${form.form}: ${LEVEL_LABEL_BY_KEY[form.defaultLevel] || form.defaultLevel}.`);
  if (levelRank(requested) > levelRank(form ? form.defaultLevel : 'ai_completion_only')) reasons.push(`Client/staff requested ${LEVEL_LABEL_BY_KEY[requested] || requested}, so the estimate will not downgrade below that level.`);
  const text = `${issueType} ${complexity} ${(Array.isArray(riskFlags) ? riskFlags.join(' ') : String(riskFlags || ''))}`.toLowerCase();
  function set(level, reason) {
    if (levelRank(level) > levelRank(recommended)) {
      recommended = normalizeLevel(level);
      reasons.push(reason);
    }
  }
  if (/1040|return prep|paid prepar|filing support|amended/.test(text)) set('ptin_preparer_review', 'Paid return preparation or amended-return facts trigger PTIN preparer review.');
  if (/tax debt|collection|installment|oic|offer in compromise|penalty|transcript|irs notice|levy|lien/.test(text)) set('enrolled_agent_review', 'IRS collection/controversy facts trigger EA-level review.');
  if (/schedule c|gig|self.employ|business|bookkeeping|rental|k-1|partnership|entity|nyc-202|nyc-204|ubt/.test(text)) set('cpa_review', 'Business/accounting-sensitive facts trigger CPA-level review.');
  if (/attorney|legal|tax court|appeal|fraud|criminal|privilege|summons/.test(text)) set('tax_attorney_review', 'Legal-advice-sensitive facts trigger tax attorney review.');
  if (complexity === 'high') set(form && form.category.includes('return') ? 'cpa_review' : 'enrolled_agent_review', 'High complexity triggers professional review above AI-only.');
  if (form) recommended = enforceMinimumLevel(recommended, form.minimumLevel);
  return {
    ok: true,
    requestedLevel: requested,
    recommendedLevel: recommended,
    recommendedLevelLabel: LEVEL_LABEL_BY_KEY[recommended],
    reasons: reasons.length ? reasons : ['No higher-risk facts were detected from the supplied inputs.'],
    requiresClientApprovalForUpgrade: levelRank(recommended) > levelRank(requestedLevel),
    professionalDisclaimer: PRICING_RULES.professionalGate
  };
}

function estimatePrice({ productType = '', formNumber = '', serviceLevel = 'ai_completion_only', reviewLevel = '', addOns = [], complexity = 'standard', issueType = '', riskFlags = [] } = {}) {
  const tier = pricingTierForProduct(productType);
  const form = formPricingFor(formNumber);
  let baseCents = 0;
  let basis = 'free_starting_point';
  const requestedLevel = normalizeLevel(reviewLevel || serviceLevel);
  const routing = recommendReviewLevel({ formNumber, issueType, riskFlags, requestedLevel, complexity });
  const finalLevel = routing.recommendedLevel;
  if (tier) {
    baseCents = Number(tier.publicPriceCents || 0);
    basis = tier.key;
  } else if (form) {
    baseCents = priceForLevel(form, finalLevel);
    basis = `${form.agency} ${form.form} ${LEVEL_LABEL_BY_KEY[finalLevel] || finalLevel}`;
  }
  const cleanAddOns = Array.isArray(addOns) ? addOns : String(addOns || '').split(',');
  const selectedAddOns = cleanAddOns.map((key) => RETURN_ADD_ONS.find((addon) => addon.key === String(key || '').trim())).filter(Boolean);
  const addOnCents = selectedAddOns.reduce((sum, addon) => sum + Number(addon.cents || 0), 0);
  const customQuote = PRICING_RULES.customQuoteTriggers.some((trigger) => String(complexity || '').toLowerCase().includes(trigger.split(' ')[0])) || String(complexity || '').toLowerCase() === 'high';
  return {
    ok: true,
    basis,
    requestedLevel,
    finalReviewLevel: finalLevel,
    finalReviewLevelLabel: LEVEL_LABEL_BY_KEY[finalLevel],
    routing,
    baseCents,
    addOnCents,
    estimatedTotalCents: baseCents + addOnCents,
    estimatedTotalLabel: centsToLabel(baseCents + addOnCents),
    selectedAddOns: selectedAddOns.map((addon) => ({ ...addon, priceLabel: centsToLabel(addon.cents) })),
    customQuoteRecommended: Boolean(customQuote || finalLevel === 'tax_attorney_review'),
    disclaimer: 'Estimate only. Final price can change if facts reveal missing years, business/entity issues, complex schedules, agency deadlines, representation needs, or professional/legal review.'
  };
}

function buildStaffPricingGuide() {
  return {
    objective: 'Minimize human work by charging around workflow complexity and review level: AI completes the interview and draft; humans review only at the lowest safe credential tier.',
    defaultOrder: ['Free start', 'AI completion only when safe', 'PTIN preparer review for paid return-prep/review work where required', 'EA review for IRS collection/controversy', 'CPA review for accounting/business complexity', 'Tax attorney review for legal-advice-sensitive matters'],
    reviewLevels: buildReviewLevelPricing(),
    customQuoteTriggers: PRICING_RULES.customQuoteTriggers,
    referralPolicy: 'Referral rewards apply only to eligible paid platform/professional-review fees and generally credit the highest eligible service for the referred customer, minus prior credited rewards. Higher professional tiers do not automatically increase the standard reward unless the referral policy is changed.',
    priceChangeControl: 'Do not surprise the client. If the case must move from a lower tier to a higher tier, show the reason, credit prior eligible payments when appropriate, and ask for approval before paid upgrade.',
    staffRules: [
      'Do not sell AI-only as professional review.',
      'Do not let paid federal return-prep output bypass PTIN requirements where they apply.',
      'Do not let IRS collection or OIC strategy be marketed as guaranteed relief.',
      'Do not let legal-advice-sensitive issues bypass tax attorney routing.',
      'Keep government payments, taxes, penalties, interest, and separate professional/legal fees separate from platform fees.'
    ]
  };
}

module.exports = {
  REVIEW_LEVELS,
  PRICING_TIERS,
  SERVICE_LEVELS,
  FORM_PRICING_MATRIX,
  RETURN_ADD_ONS,
  PRICING_RULES,
  REVIEW_ROUTING_RULES,
  centsToLabel,
  pricingTierForProduct,
  formPricingFor,
  buildPublicPricingSchedule,
  buildReviewLevelPricing,
  recommendReviewLevel,
  estimatePrice,
  buildStaffPricingGuide
};
