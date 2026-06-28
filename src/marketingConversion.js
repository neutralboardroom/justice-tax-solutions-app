const SERVICE_PAGES = [
  {
    slug: 'irs-notice-help',
    path: '/irs-notice-help.html',
    title: 'IRS Notice Help',
    h1: 'Understand your IRS notice before you panic or pay.',
    audience: 'People who received an IRS CP notice, balance due letter, proposed change, missing return notice, penalty notice, or confusing account letter.',
    promise: 'Justice Tax Solutions helps you organize the notice, understand what it appears to ask for, identify deadlines, and decide whether AI-only help, PTIN review, EA review, CPA review, or tax attorney review is the safest next step.',
    primaryCta: 'Start with your IRS notice',
    secondaryCta: 'Request a professional review',
    pathway: 'notice',
    recommendedProduct: 'tax_notice_action_plan',
    routesTo: ['Tax Notice Quick Summary', 'Tax Notice Action Plan + Draft Response Prep', 'EA Tax Problem Review', 'Tax Attorney Review when legal issues appear'],
    conversionIntent: 'urgent_notice_help',
    sampleQuestions: ['What notice number is shown?', 'What deadline is listed?', 'Does the notice show a balance due, proposed change, missing return, or penalty?', 'Did you already respond or call the agency?'],
    riskEscalators: ['notice deadline within 14 days', 'audit/exam language', 'appeals language', 'fraud/criminal language', 'large balance', 'prior unfiled years', 'business/payroll facts'],
    disclaimers: ['We are not the IRS.', 'No outcome, penalty relief, refund, payment plan, or deadline extension is guaranteed.', 'Do not ignore agency deadlines.']
  },
  {
    slug: 'nys-tax-notice-help',
    path: '/nys-tax-notice-help.html',
    title: 'New York State Tax Notice Help',
    h1: 'Get a clear next step for a New York State tax notice.',
    audience: 'New Yorkers who received a Department of Taxation and Finance notice about income tax, residency, withholding, sales tax, assessment, penalty, or missing filing.',
    promise: 'The platform helps sort the notice, collect the missing facts, flag deadlines, and route the matter to the lowest safe review level.',
    primaryCta: 'Start with your NYS notice',
    secondaryCta: 'Request NY tax review',
    pathway: 'ny_state_tax_notice',
    recommendedProduct: 'ny_tax_notice_review',
    routesTo: ['Notice summary', 'NYS return/amended return review', 'CPA review for residency/business facts', 'Tax attorney review when legal strategy is involved'],
    conversionIntent: 'new_york_notice_help',
    sampleQuestions: ['What tax year is shown?', 'Is this about income, residency, sales tax, withholding, or a business filing?', 'Is there a deadline or assessment amount?', 'Have you moved in or out of New York?'],
    riskEscalators: ['residency dispute', 'sales/payroll tax', 'warrant/collection language', 'large assessment', 'appeals deadline', 'business entity issue'],
    disclaimers: ['We are not New York State.', 'NYS deadlines and payment obligations are separate from platform fees.']
  },
  {
    slug: 'nyc-tax-notice-help',
    path: '/nyc-tax-notice-help.html',
    title: 'NYC Tax Notice Help',
    h1: 'Understand a NYC Department of Finance tax notice or business tax issue.',
    audience: 'NYC freelancers, sole proprietors, partnerships, landlords, and businesses dealing with NYC Department of Finance notices, UBT questions, or local tax issues.',
    promise: 'Justice Tax Solutions organizes NYC tax facts, flags UBT/business issues, and routes to CPA or attorney review when needed.',
    primaryCta: 'Start with your NYC notice',
    secondaryCta: 'Review NYC business tax help',
    pathway: 'nyc_tax_notice',
    recommendedProduct: 'nyc_tax_notice_review',
    routesTo: ['NYC notice summary', 'NYC-202/NYC-204 readiness', 'CPA business/gig review', 'Tax attorney review for legal disputes'],
    conversionIntent: 'nyc_notice_ubt_help',
    sampleQuestions: ['Is the notice about UBT, property, business tax, parking, or another NYC issue?', 'Are you self-employed or a partnership?', 'What tax year and deadline appear?', 'Do you have prior-year filings?'],
    riskEscalators: ['NYC UBT', 'partnership/entity filing', 'collection/warrant language', 'multiple years', 'business records missing'],
    disclaimers: ['We are not NYC Department of Finance.', 'NYC taxes, penalties, and interest are separate.']
  },
  {
    slug: 'tax-debt-payment-plan-help',
    path: '/tax-debt-payment-plan-help.html',
    title: 'Tax Debt and Payment Plan Help',
    h1: 'Explore tax debt options without overpromises.',
    audience: 'People who owe IRS, New York State, or NYC taxes and need help understanding payment plans, collection notices, or financial disclosure forms.',
    promise: 'The platform helps estimate the next safe path, prepare an installment-agreement checklist, and flag when Form 9465, 433-F, EA review, CPA review, or attorney review may be needed.',
    primaryCta: 'Start tax debt screening',
    secondaryCta: 'Ask for EA review',
    pathway: 'tax_debt',
    recommendedProduct: 'tax_debt_options_map',
    routesTo: ['Tax Debt AI Screening', 'IRS Form 9465 help', 'IRS 433-F help', 'EA review', 'Attorney review for legal-sensitive matters'],
    conversionIntent: 'tax_debt_payment_plan',
    sampleQuestions: ['How much do you owe?', 'Which agency is involved?', 'Are you current with required filings?', 'Can you afford a monthly payment?', 'Have you received levy/lien/warrant language?'],
    riskEscalators: ['levy/lien/warrant language', 'payroll tax', 'business trust fund issue', 'cannot pay basic living costs', 'multiple unfiled years', 'fraud/criminal concern'],
    disclaimers: ['No tax debt reduction, offer-in-compromise acceptance, penalty relief, or payment plan is guaranteed.', 'Government taxes, penalties, and interest are separate.']
  },
  {
    slug: 'back-taxes-unfiled-returns',
    path: '/back-taxes-unfiled-returns.html',
    title: 'Back Taxes and Unfiled Returns',
    h1: 'Get organized when you have unfiled or prior-year tax returns.',
    audience: 'People who missed one or more tax years, received missing return notices, or need help collecting W-2/1099/self-employment records.',
    promise: 'Justice Tax Solutions turns scattered years and documents into a clear filing-readiness plan and routes each year to AI completion, PTIN review, EA review, CPA review, or attorney review when needed.',
    primaryCta: 'Start back-tax organizer',
    secondaryCta: 'Request prior-year review',
    pathway: 'unfiled_returns',
    recommendedProduct: 'prior_year_return_organizer',
    routesTo: ['Return organizer', 'PTIN review', 'CPA review for business/gig records', 'EA review if collection is active'],
    conversionIntent: 'unfiled_prior_year_returns',
    sampleQuestions: ['Which years are missing?', 'Do you have W-2s or 1099s?', 'Were you self-employed?', 'Have you received IRS/NYS/NYC notices?', 'Do you need transcript help?'],
    riskEscalators: ['multiple years', 'substitute return/SFR language', 'active collection', 'business income', 'missing records', 'large balance'],
    disclaimers: ['Filing readiness is not a guarantee of refund, balance, or agency result.']
  },
  {
    slug: 'amended-return-help',
    path: '/amended-return-help.html',
    title: 'Amended Return Help',
    h1: 'Fix a tax return mistake with a safer review path.',
    audience: 'People who need to correct income, filing status, deductions, credits, dependents, state issues, or Schedule C/business items.',
    promise: 'The platform helps identify what changed, what documents support the change, and whether IRS Form 1040-X, state amendment, PTIN review, CPA review, EA review, or attorney review is needed.',
    primaryCta: 'Start amended return review',
    secondaryCta: 'Request professional review',
    pathway: 'amended_return',
    recommendedProduct: 'amended_return_review',
    routesTo: ['1040-X organizer', 'PTIN review', 'CPA review', 'EA review for notice/collection tie-ins', 'Attorney review for legal-sensitive corrections'],
    conversionIntent: 'amended_return_help',
    sampleQuestions: ['Which year needs correction?', 'What changed?', 'Did the IRS or state already send a notice?', 'Do you have the original return?', 'Did you already receive a refund?'],
    riskEscalators: ['large refund claim', 'EITC/credit dispute', 'business expense changes', 'audit notice', 'fraud/misrepresentation concern'],
    disclaimers: ['No refund, acceptance, or processing timeline is guaranteed.']
  },
  {
    slug: 'self-employed-gig-worker-tax-help',
    path: '/self-employed-gig-worker-tax-help.html',
    title: 'Self-Employed and Gig Worker Tax Help',
    h1: 'Tax help for Uber, Lyft, DoorDash, freelancers, creators, and 1099 workers.',
    audience: 'Self-employed people and gig workers who need help organizing income, expenses, mileage, platforms, 1099s, and Schedule C questions.',
    promise: 'Justice Tax Solutions helps organize your records, identify missing items, flag deduction and estimated-tax issues, and route to CPA review when facts are complex.',
    primaryCta: 'Start gig-worker tax organizer',
    secondaryCta: 'Request CPA/gig review',
    pathway: 'self_employed_gig_worker',
    recommendedProduct: 'schedule_c_gig_worker_review',
    routesTo: ['Return organizer', 'Schedule C review', 'CPA business/gig review', 'NYS/NYC UBT review when relevant'],
    conversionIntent: 'gig_worker_schedule_c',
    sampleQuestions: ['Which platforms paid you?', 'Do you track mileage?', 'Do you have receipts or bank records?', 'Did you make estimated payments?', 'Do you operate in NYC?'],
    riskEscalators: ['no records', 'large expenses', 'NYC UBT exposure', 'sales tax issue', 'multiple platforms', 'prior-year notices'],
    disclaimers: ['Deduction eligibility depends on facts and documentation. No tax savings are guaranteed.']
  },
  {
    slug: 'irs-form-9465-help',
    path: '/irs-form-9465-help.html',
    title: 'IRS Form 9465 Help',
    h1: 'Installment agreement help for IRS Form 9465.',
    audience: 'Taxpayers who may need to request a monthly IRS installment agreement and want help organizing the required information before signing or submitting.',
    promise: 'The platform asks the key Form 9465 questions, calculates draft payment-plan fields where possible, flags 433-F triggers, and keeps the draft gated until official PDF QA and review are complete.',
    primaryCta: 'Start Form 9465 help',
    secondaryCta: 'Request EA review',
    pathway: 'irs_9465',
    recommendedProduct: 'irs_9465_ai_or_ea_review',
    routesTo: ['9465 AI draft plan', 'EA review', '433-F follow-up if required', 'Tax attorney review if legal-sensitive facts appear'],
    conversionIntent: 'irs_form_9465_installment_agreement',
    sampleQuestions: ['How much do you owe?', 'What monthly payment can you afford?', 'Are all required returns filed?', 'Do you owe over $50,000?', 'Is there levy/lien language?'],
    riskEscalators: ['balance over $50,000', 'missing returns', 'business/payroll tax', 'levy/lien', 'cannot afford minimum payment'],
    disclaimers: ['A draft installment agreement request does not guarantee IRS acceptance.']
  },
  {
    slug: 'irs-form-433-f-help',
    path: '/irs-form-433-f-help.html',
    title: 'IRS Form 433-F Help',
    h1: 'Organize financial information for IRS Form 433-F.',
    audience: 'Taxpayers who need to disclose income, expenses, assets, debts, bank accounts, vehicles, and household financial facts for IRS collection review.',
    promise: 'Justice Tax Solutions helps turn financial details into a verification checklist and a draft field plan while keeping review gates in place because 433-F is sensitive.',
    primaryCta: 'Start 433-F organizer',
    secondaryCta: 'Request EA/CPA review',
    pathway: 'irs_433_f',
    recommendedProduct: 'irs_433f_review',
    routesTo: ['433-F organizer', 'EA review', 'CPA review for business/self-employed records', 'Attorney review for legal-sensitive collection facts'],
    conversionIntent: 'irs_form_433f_collection_information',
    sampleQuestions: ['What is your monthly income?', 'What are your necessary living expenses?', 'Do you own vehicles or real estate?', 'Do you have bank/investment accounts?', 'Are you self-employed?'],
    riskEscalators: ['business ownership', 'missing bank records', 'asset transfers', 'payroll tax', 'levy/lien', 'legal collection dispute'],
    disclaimers: ['Financial disclosure forms should be checked carefully before signing or sending to the IRS.']
  },
  {
    slug: 'irs-form-1040x-help',
    path: '/irs-form-1040x-help.html',
    title: 'IRS Form 1040-X Help',
    h1: 'Amended return help for IRS Form 1040-X.',
    audience: 'Taxpayers who need to change a filed return and want a clear explanation of what changed, why, and what support documents are needed.',
    promise: 'The platform organizes the change reason, supporting documents, changed numbers, and professional review level before any client-ready amended return package is released.',
    primaryCta: 'Start 1040-X help',
    secondaryCta: 'Request amended return review',
    pathway: 'irs_1040x',
    recommendedProduct: 'irs_1040x_amended_return_review',
    routesTo: ['1040-X organizer', 'PTIN review', 'CPA review', 'EA review if notice/collection connected'],
    conversionIntent: 'irs_form_1040x_amended_return',
    sampleQuestions: ['What year are you amending?', 'What changed?', 'Do you have the original return?', 'Was there a notice?', 'Do you expect a refund or additional balance?'],
    riskEscalators: ['large refund', 'tax credit changes', 'business changes', 'audit notice', 'prior amendments'],
    disclaimers: ['No refund or acceptance guarantee. Processing times are controlled by the agency.']
  },
  {
    slug: 'live-online-tax-help',
    path: '/live-online-tax-help.html',
    title: 'Live Online Tax Help',
    h1: 'Work online with a tax professional when you want extra confidence.',
    audience: 'Customers who want AI-prepared answers plus a live PTIN preparer, EA, CPA, or tax attorney session by video, voice, phone, or in person where available.',
    promise: 'Justice Tax Solutions prepares the agenda and missing-info checklist before the session so professional time is focused and efficient.',
    primaryCta: 'Request live tax help',
    secondaryCta: 'See pricing levels',
    pathway: 'live_online_help',
    recommendedProduct: 'live_online_completion',
    routesTo: ['PTIN online completion', 'EA tax problem session', 'CPA business/gig session', 'Tax attorney strategy review'],
    conversionIntent: 'live_online_tax_completion',
    sampleQuestions: ['Do you prefer video, voice, phone, or in-person if available?', 'What do you want the professional to check?', 'Do you have a deadline?', 'Which forms or notices are involved?'],
    riskEscalators: ['attorney-sensitive facts', 'business/payroll tax', 'complex accounting', 'urgent agency deadline'],
    disclaimers: ['Appointment availability, provider type, and final price depend on facts and professional availability.']
  },
  {
    slug: 'cpa-ea-tax-attorney-review',
    path: '/cpa-ea-tax-attorney-review.html',
    title: 'CPA, EA, and Tax Attorney Review',
    h1: 'Choose the review level that matches your tax issue.',
    audience: 'Customers who want a qualified person to check the AI-prepared work or need escalation because the facts are complex or high risk.',
    promise: 'The platform starts with the lowest safe review level, but customers can request more reassurance at any time.',
    primaryCta: 'Request a professional review',
    secondaryCta: 'Compare review levels',
    pathway: 'professional_review',
    recommendedProduct: 'professional_review',
    routesTo: ['PTIN review', 'EA review', 'CPA review', 'Tax attorney review'],
    conversionIntent: 'professional_tax_review',
    sampleQuestions: ['Do you want reassurance or is review required?', 'Is this about a return, notice, debt, business tax, or legal strategy?', 'Do you prefer live online, phone, or written review?'],
    riskEscalators: ['fraud/criminal exposure', 'tax court/appeal', 'business tax', 'collection dispute', 'legal advice request'],
    disclaimers: ['Legal advice is only through a tax attorney if separately arranged.']
  },
  {
    slug: 'ayuda-impuestos-espanol',
    path: '/ayuda-impuestos-espanol.html',
    title: 'Ayuda con impuestos en español',
    h1: 'Ayuda clara para cartas de impuestos, deudas y declaraciones.',
    audience: 'Personas que prefieren comenzar en español y necesitan entender una carta del IRS, Nueva York o NYC, una deuda de impuestos o una declaración.',
    promise: 'La plataforma puede ayudar a organizar la información, explicar próximos pasos en lenguaje claro y mostrar cuándo se necesita revisión humana o profesional.',
    primaryCta: 'Empezar gratis',
    secondaryCta: 'Pedir revisión humana',
    pathway: 'spanish_tax_help',
    recommendedProduct: 'spanish_starting_point',
    routesTo: ['Resumen inicial', 'Revisión humana', 'Revisión EA/CPA/abogado de impuestos cuando sea necesario'],
    conversionIntent: 'spanish_tax_help',
    sampleQuestions: ['¿Recibió una carta?', '¿Debe impuestos?', '¿Necesita presentar o corregir una declaración?', '¿Tiene una fecha límite?'],
    riskEscalators: ['fecha límite urgente', 'carta de cobro', 'varios años sin presentar', 'negocio/trabajo independiente', 'asunto legal'],
    disclaimers: ['No somos el IRS, Nueva York, NYC, ni una firma legal. No garantizamos resultados.']
  }
];

const MARKETING_CONVERSION_STRATEGY = {
  versionLabel: 'v0.1.28 Marketing Conversion Pages',
  positioning: 'Tax help when you need more than software: notices, tax debt, back taxes, amended returns, gig-worker returns, and optional professional reassurance.',
  notPositionedAs: ['generic free tax software clone', 'tax relief guarantee shop', 'government agency', 'law firm'],
  primaryFunnels: [
    { key: 'notice', label: 'Notice help', entryPages: ['irs-notice-help', 'nys-tax-notice-help', 'nyc-tax-notice-help'], startPath: 'Upload a Tax Notice' },
    { key: 'debt', label: 'Debt/payment plan help', entryPages: ['tax-debt-payment-plan-help', 'irs-form-9465-help', 'irs-form-433-f-help'], startPath: 'Get Help With Tax Debt or Back Taxes' },
    { key: 'return_fix', label: 'File/fix/review returns', entryPages: ['back-taxes-unfiled-returns', 'amended-return-help', 'irs-form-1040x-help', 'self-employed-gig-worker-tax-help'], startPath: 'Prepare or Review a Tax Return' },
    { key: 'professional_help', label: 'Professional reassurance', entryPages: ['live-online-tax-help', 'cpa-ea-tax-attorney-review'], startPath: 'Request professional review' },
    { key: 'spanish', label: 'Spanish starting point', entryPages: ['ayuda-impuestos-espanol'], startPath: 'Empezar gratis' }
  ],
  conversionRules: [
    'Each page should offer one free starting action and one professional reassurance action.',
    'Each page must disclose that Justice Tax Solutions is not IRS, NYS, NYC, or a law firm.',
    'No page may guarantee refunds, relief, payment plans, penalty removal, offer-in-compromise acceptance, filing outcome, or agency response timing.',
    'Pages should route anxious users to simple plain-language starts rather than asking for form numbers first.',
    'Marketing pages may collect intent and route the user into the existing intake; they must not bypass sensitive-upload, payment, client verification, professional signoff, or release gates.'
  ]
};

const CAMPAIGN_LANDING_CHECKLIST = [
  { key: 'clear_problem_headline', label: 'Problem-specific headline that matches the ad/search intent', required: true },
  { key: 'free_start_cta', label: 'Visible free starting CTA above the fold', required: true },
  { key: 'professional_reassurance_cta', label: 'Optional human/professional reassurance CTA', required: true },
  { key: 'no_government_disclosure', label: 'Clear not-government disclosure', required: true },
  { key: 'no_guarantee_language', label: 'No refund, relief, timeline, or agency-outcome guarantees', required: true },
  { key: 'routing_to_existing_intake', label: 'CTA routes to existing intake/service-fit workflow', required: true },
  { key: 'sensitive_upload_gate', label: 'Does not bypass sensitive-document gates', required: true },
  { key: 'tracking_ready', label: 'Includes campaign/source/referral-compatible URLs', required: false },
  { key: 'mobile_readability', label: 'Readable on mobile with calm spacing', required: true },
  { key: 'pricing_expectation', label: 'Shows pricing or likely quote/review-level expectation where appropriate', required: false }
];

function listMarketingPages() {
  return SERVICE_PAGES.map(({ slug, path, title, h1, audience, primaryCta, secondaryCta, conversionIntent, recommendedProduct }) => ({ slug, path, title, h1, audience, primaryCta, secondaryCta, conversionIntent, recommendedProduct }));
}

function getMarketingPage(slug) {
  return SERVICE_PAGES.find((page) => page.slug === slug || page.path === slug) || null;
}

function buildMarketingConversionPlan() {
  return {
    ...MARKETING_CONVERSION_STRATEGY,
    pageCount: SERVICE_PAGES.length,
    pages: listMarketingPages(),
    nextTrackingBuild: 'v0.1.29 should add marketing analytics/events for started intake, completed intake, professional-review request, quote approval, payment, appointment booking, and referral/campaign source.'
  };
}

function buildCampaignLandingChecklist(slug = '') {
  const page = slug ? getMarketingPage(slug) : null;
  return {
    page: page ? { slug: page.slug, title: page.title, path: page.path } : null,
    checklist: CAMPAIGN_LANDING_CHECKLIST,
    rule: 'Use this before paid traffic, local outreach, referral flyers, or SEO pages go live.'
  };
}

function buildSeoServicePageRoadmap() {
  return {
    currentPages: listMarketingPages(),
    futurePages: [
      'irs-cp2000-notice-help',
      'irs-cp14-balance-due-help',
      'irs-penalty-abatement-help',
      'nys-residency-tax-notice-help',
      'nyc-ubt-freelancer-help',
      'form-4868-extension-help',
      'form-8821-tax-authorization-help',
      'form-2848-power-of-attorney-help',
      'offer-in-compromise-screening-help',
      'tax-help-for-uber-lyft-drivers',
      'tax-help-for-doordash-instacart-drivers'
    ],
    sequencing: ['Launch broad conversion pages first', 'Add form-specific pages after form output gates mature', 'Add notice-number pages after notice catalog expands', 'Add local/Spanish pages after support workflow is stable'],
    complianceNote: 'SEO pages should educate and route; they must not overpromise relief, refunds, approvals, or professional/legal representation.'
  };
}

module.exports = {
  SERVICE_PAGES,
  MARKETING_CONVERSION_STRATEGY,
  CAMPAIGN_LANDING_CHECKLIST,
  listMarketingPages,
  getMarketingPage,
  buildMarketingConversionPlan,
  buildCampaignLandingChecklist,
  buildSeoServicePageRoadmap
};
