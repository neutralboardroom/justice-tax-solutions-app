const COMPETITOR_PRICE_BENCHMARKS = [
  {
    category: 'premium consumer software plus expert network',
    competitors: ['TurboTax Expert Assist', 'TurboTax Expert Full Service'],
    model: 'DIY, expert-assisted DIY, and full-service handoff with online or in-person expert support.',
    observedPricing: ['DIY/current-season federal commonly $0-$209 with state extra', 'Expert Full Service has promoted starter pricing around $0-$129+ federal with state additional; final price depends on forms and complexity'],
    aiSignals: ['Intuit Assist AI guidance', 'document snap/import and autofill', 'AI summaries and internal expert productivity tools', 'expansion into physical TurboTax offices/storefronts'],
    adaptForJTS: ['Offer online professional completion as a premium path', 'show price estimate before professional starts', 'combine AI intake with professional session summary', 'allow problem-first tax notice/debt cases, not just return filing'],
    avoidForJTS: ['do not overuse refund guarantee language', 'do not hide price changes until late in the flow', 'do not treat tax-problem clients as standard return filers']
  },
  {
    category: 'hybrid retail and online human help',
    competitors: ['H&R Block Online', 'H&R Block Tax Pro Review', 'H&R Block offices', 'Block Advisors', 'Jackson Hewitt', 'Liberty Tax'],
    model: 'Blend online filing, live expert help, pro review, office appointments, drop-off, and business/small-business advisory.',
    observedPricing: ['H&R Block online has free/basic plus paid tiers and Tax Pro Review add-on; public prices vary by season/form', 'Jackson Hewitt is reported with flat online pricing around $25 and full-service prep starting around $49 depending on forms', 'in-person firms commonly quote after seeing forms and complexity'],
    aiSignals: ['H&R Block markets AI Tax Assist and live support in paid DIY tiers', 'consumer firms are combining AI assistance, chat, live pro help, and store/office presence'],
    adaptForJTS: ['add live online consultation/completion appointments', 'support appointment prep checklist and document readiness before session', 'create professional-room workflow for PTIN/EA/CPA/attorney sessions', 'offer problem-first paid consultations for notices/debt/back taxes'],
    avoidForJTS: ['do not make downgrade or service-level changes difficult', 'do not delete entered information when switching levels', 'do not imply every staff person is a CPA/EA/attorney']
  },
  {
    category: 'low-cost DIY challengers',
    competitors: ['FreeTaxUSA', 'TaxAct', 'TaxSlayer', 'Cash App Taxes', 'eFile.com'],
    model: 'Low price or free DIY tax filing with less hand-holding and limited professional interaction.',
    observedPricing: ['FreeTaxUSA: $0 federal and roughly $15.99 per state with paid support upgrades', 'TaxAct: 2026 reported federal tiers from $0 to $74.99 plus state around $39.99 and Xpert Assist around $25', 'Cash App Taxes: $0 federal and state for supported situations'],
    aiSignals: ['mostly price-pressure and self-service automation; some have limited live help/support upgrades'],
    adaptForJTS: ['keep a low-cost AI completion tier', 'make state/local add-ons transparent', 'make all upgrades optional and explained', 'use pricing pressure as reason to focus on anxious notice/debt/self-employed users'],
    avoidForJTS: ['do not compete only on cheapest 1040 filing', 'do not rely on low-margin state filing alone', 'do not offer unsupported forms just to appear comprehensive']
  },
  {
    category: 'tax-resolution and tax-problem firms',
    competitors: ['Optima Tax Relief', 'TaxRise', 'Community Tax', 'Anthem Tax Services', 'Tax Defense Network', 'Larson Tax Relief', 'local EA/CPA/tax attorney firms'],
    model: 'Free consultation, investigation phase, then quote for tax debt, notices, unfiled returns, liens, levies, wage garnishment, OIC, penalty relief, and state tax cases.',
    observedPricing: ['pricing is frequently quote-based after an investigation/review phase', 'OIC/debt-resolution work can be high-ticket; ethical positioning requires eligibility screening before promising outcomes'],
    aiSignals: ['less public AI emphasis, but strong opportunity for AI triage, notice classification, financial statement prep, missing-document lists, and staff workpaper assembly'],
    adaptForJTS: ['offer low-cost tax-problem diagnosis before expensive resolution', 'route debt cases to EA/CPA/attorney only when facts require it', 'build Form 9465/433-F/656 interviews with clear qualification gates', 'show safer IRS/NYS/NYC options before paid escalation'],
    avoidForJTS: ['no pennies-on-the-dollar promises', 'no Fresh Start shortcut claims', 'no settlement claims before financial eligibility analysis']
  },
  {
    category: 'newer AI and embedded tax firms',
    competitors: ['april', 'Column Tax', 'Keeper', 'FlyFin', 'TaxGPT', 'Instead', 'Filed', 'Blue J', 'CoCounsel Tax'],
    model: 'AI-assisted filing, embedded tax inside fintech/payroll/banking apps, freelancer deduction engines, and professional tax research/memo support.',
    observedPricing: ['many publish limited or partner-specific pricing; some monetize through subscriptions, CPA review, or embedded partner contracts rather than simple per-form pricing'],
    aiSignals: ['LLM tax-code interpretation, embedded filing APIs, continuous tax position insights, AI document extraction, professional research with citations'],
    adaptForJTS: ['build AI interview/field completion engine', 'maintain source-linked fields and confidence scores', 'support future embedded/referral partner API', 'add multi-AI second look for high-risk drafts'],
    avoidForJTS: ['black-box autonomous filing', 'unchecked aggressive deduction decisions', 'AI legal advice without attorney routing']
  },
  {
    category: 'government and free public options',
    competitors: ['IRS Free File', 'VITA/TCE', 'former IRS Direct File', 'paper filing', 'state free-file portals'],
    model: 'Free or low-cost alternatives for eligible taxpayers; Direct File is currently not available for filing season 2026 according to public reports.',
    observedPricing: ['$0 for qualifying public/free programs, but limited eligibility or limited support'],
    aiSignals: ['Direct File showed guided, interview-based, bilingual, mobile-first public filing design even though it is not available for 2026'],
    adaptForJTS: ['always disclose free government/public alternatives where relevant', 'borrow the simple guided/interview design', 'build Spanish-ready problem explanations later', 'do not charge for merely pointing someone to a free official option'],
    avoidForJTS: ['do not obscure free options', 'do not market as government-affiliated', 'do not charge a vulnerable user for something they can easily do free without added value']
  }
];

const LIVE_ONLINE_SERVICE_LEVELS = [
  {
    key: 'ai_completion_only_async',
    label: 'AI Completion Only',
    publicPriceRange: '$39-$299',
    sessionType: 'No live session by default',
    humanRole: 'None by default, unless an exception is triggered or the customer requests reassurance/review',
    bestFor: ['extension draft', 'authorization draft', 'low-risk organizer', 'verified official-form draft after mapping is complete'],
    output: 'AI-prepared draft and checklist; client verifies before printing/signing.',
    guardrail: 'Not professional review, representation, legal advice, or guaranteed filing.'
  },
  {
    key: 'live_ptin_completion',
    label: 'Live Online PTIN Completion',
    publicPriceRange: '$149-$499',
    sessionType: '30-60 minute online completion/review session',
    humanRole: 'PTIN preparer where paid return preparation/review requires it',
    bestFor: ['simple return', 'amended return basics', 'extension with payment estimate', 'state add-on paired with federal return'],
    output: 'AI-prepared forms reviewed online with PTIN preparer; client sees print/signature steps or filing-support next step.',
    guardrail: 'Preparer credentials and scope must be verified before paid-preparer output.'
  },
  {
    key: 'live_ea_resolution_session',
    label: 'Live Online EA Tax Problem Session',
    publicPriceRange: '$249-$799+',
    sessionType: '45-75 minute online notice/debt/back-tax completion session',
    humanRole: 'Enrolled Agent or equivalent IRS-practice reviewer',
    bestFor: ['IRS notices', 'installment agreement', '433-F financial statement', 'penalty relief screening', 'OIC screening', 'transcript/authorization workflow'],
    output: 'AI-prepared issue map, forms, missing-info checklist, and next-action plan reviewed by EA-level professional.',
    guardrail: 'No relief outcome is guaranteed; OIC/collection actions require eligibility analysis.'
  },
  {
    key: 'live_cpa_business_completion',
    label: 'Live Online CPA Business/Gig Review',
    publicPriceRange: '$299-$899+',
    sessionType: '45-90 minute online business/gig/NYC tax session',
    humanRole: 'CPA or CPA-level reviewer',
    bestFor: ['Schedule C', 'Uber/Lyft/1099 expenses', 'bookkeeping cleanup', 'NYS/NYC UBT', 'rental/K-1/entity complexity'],
    output: 'AI-prepared return/workpaper draft with accounting-sensitive items reviewed before release.',
    guardrail: 'Complex books, entities, or multi-year work may need custom quote.'
  },
  {
    key: 'live_tax_attorney_strategy',
    label: 'Live Online Tax Attorney Strategy Review',
    publicPriceRange: '$349-$1,299+ / quote',
    sessionType: '30-60 minute legal strategy review, separate engagement may be required',
    humanRole: 'Licensed tax attorney',
    bestFor: ['appeals', 'tax court', 'fraud/criminal exposure', 'summons', 'privilege', 'legal strategy for liens/levies'],
    output: 'Attorney-reviewed issue assessment and next-step options within the engagement scope.',
    guardrail: 'Justice Tax Solutions is not a law firm; legal advice requires separately arranged licensed attorney review.'
  },
  {
    key: 'full_online_completion_with_professional',
    label: 'Full Online Tax Completion With Professional',
    publicPriceRange: '$299-$1,499+ / quote',
    sessionType: 'Professional-led online handoff: upload docs, AI prep, professional completes/reviews with client online',
    humanRole: 'PTIN, EA, CPA, or tax attorney routed by facts or requested customer reassurance level',
    bestFor: ['clients who want the entire process handled online', 'stressful notice plus return cleanup', 'multi-form tax problem bundles', 'busy self-employed clients'],
    output: 'Full online completion package: forms, print/signature instructions, client approval, and filing/support plan where allowed.',
    guardrail: 'Must pass production security, official form QA, payment, client approval, and credential gates before final output.'
  }
];

const SERVICE_DESIGN_RECOMMENDATIONS = [
  {
    key: 'appointment_ready_gate',
    title: 'Appointment-ready gate before any live session',
    mechanism: 'AI checks documents, notices, years, IDs, income documents, spouse/dependent facts, debt notices, and consent forms before booking or before the professional starts.',
    why: 'Prevents professionals from wasting live time collecting basic facts.'
  },
  {
    key: 'professional_room',
    title: 'Professional room for live online completion',
    mechanism: 'One screen for AI summary, source-linked fields, uploaded docs, missing questions, official form drafts, client chat, and release blockers.',
    why: 'Combines TurboTax-style full service with TaxDome/SafeSend-style controlled delivery.'
  },
  {
    key: 'pre_session_ai_completion',
    title: 'AI completes before the professional enters',
    mechanism: 'AI interview fills all known safe fields, flags unknown/ambiguous answers, and creates a professional agenda with only unresolved issues.',
    why: 'Minimizes human work and lets professionals handle judgment instead of typing.'
  },
  {
    key: 'client_live_review_and_signature_packet',
    title: 'Client live review and signature packet',
    mechanism: 'During or after the session, the client sees a plain-English summary, exact forms prepared, signing instructions, what is not included, and what remains blocked.',
    why: 'Reduces confusion and supports print/signature workflows before e-file/filing partner integration.'
  },
  {
    key: 'transparent_upgrade_router',
    title: 'Transparent upgrade router',
    mechanism: 'If facts trigger EA, CPA, or attorney level, show the reason and price before collecting the difference.',
    why: 'Avoids competitor-style upsell frustration and supports compliance.'
  },
  {
    key: 'problem_first_full_service',
    title: 'Problem-first full service, not just 1040 full service',
    mechanism: 'Offer online completion for notices, payment plans, back taxes, amendments, state/NYC problems, and Schedule C/gig workers.',
    why: 'Differentiates JTS from generic tax software that starts with return filing.'
  }
];

const COMPETITOR_SOURCE_LEDGER = [
  { name: 'TurboTax', source: 'https://turbotax.intuit.com/personal-taxes/online/', notes: 'DIY, Expert Assist, Expert Full Service, AI-powered guidance, online/in-person expert handling, price estimate before expert starts.' },
  { name: 'H&R Block Online', source: 'https://www.hrblock.com/online-tax-filing/', notes: 'Online free/paid tiers, unlimited expert help in paid tiers, AI Tax Assist, Tax Pro Review add-on, office/pro options.' },
  { name: 'FreeTaxUSA', source: 'https://www.freetaxusa.com/', notes: '$0 federal and $15.99 state; broad form coverage and low-cost support upgrades.' },
  { name: 'Cash App Taxes', source: 'https://cash.app/taxes', notes: '$0 federal/state for supported situations, no professional tax advisor relationship.' },
  { name: 'TaxAct', source: 'https://www.kiplinger.com/taxes/tax-software/taxact-review-pricing-features-how-to-use', notes: '2026 third-party pricing benchmark, Xpert Assist add-on.' },
  { name: 'Jackson Hewitt', source: 'https://www.kiplinger.com/personal-finance/the-best-tax-prep-software-for-every-tax-situation', notes: 'Third-party benchmark: flat online and low-cost full service starting point.' },
  { name: 'IRS Dirty Dozen', source: 'https://www.irs.gov/newsroom/dirty-dozen', notes: 'Compliance guardrail against scams, misleading relief claims, and preparer misconduct.' },
  { name: 'IRS Direct File status', source: 'https://apnews.com/article/04f2d0c31bec80b55d122a0e76e08c36', notes: 'Direct File unavailable in filing season 2026; useful design lesson but not active public competitor.' },
  { name: 'april', source: 'https://www.axios.com/2023/04/03/april-ai-tax-startup-launch', notes: 'AI-powered embedded filing model inside banks/financial platforms.' }
];

function buildCompetitorMarketResearch() {
  return {
    researchedAt: '2026-06-27',
    strategicConclusion: 'The winning model for Justice Tax Solutions should be AI-first plus optional live online professional completion: lower-cost AI completion for safe/verified tasks, PTIN review for paid return work, EA for IRS debt/notice/collection, CPA for business/gig/NYS/NYC accounting complexity, tax attorney review for legal-risk matters, and customer-requested reassurance reviews when someone simply wants a professional second look.',
    categories: COMPETITOR_PRICE_BENCHMARKS,
    sourceLedger: COMPETITOR_SOURCE_LEDGER,
    immediateProductMoves: SERVICE_DESIGN_RECOMMENDATIONS
  };
}

function buildLiveOnlineConsultationProducts() {
  return {
    positioning: 'Online tax completion with the lowest safe professional level, plus optional customer-requested reassurance review. AI prepares everything it safely can before the live session so the professional spends time on judgment, review, corrections, reassurance, and final client explanation.',
    bookingGate: {
      requiredBeforeBooking: ['client account', 'selected pathway', 'tax year(s)', 'notice/debt/return goal', 'required consents', 'document checklist or redacted demo acknowledgment', 'payment or quote approval when required'],
      requiredBeforeFinalOutput: ['official form captured/mapped/QA complete when a government form is generated', 'client verification', 'professional credential/scope match', 'payment status', 'release gate clear']
    },
    serviceLevels: LIVE_ONLINE_SERVICE_LEVELS,
    packageRules: [
      'AI-only is not live professional review.',
      'Live online completion can be sold as an upgrade, bundle, premium path, or customer-requested reassurance review once production security gates are ready.',
      'Professional sessions should start from an AI-prepared agenda and source-linked field map, whether the session is risk-required or requested for reassurance.',
      'Legal-advice-sensitive sessions require tax attorney review and separate appropriate engagement scope.',
      'No same-day representation or guaranteed outcome language.'
    ]
  };
}

function estimateLiveConsultation({ requestedLevel = 'full_online_completion_with_professional', issueType = '', complexity = 'standard', minutes = 60 } = {}) {
  const key = String(requestedLevel || '').trim() || 'full_online_completion_with_professional';
  const text = `${key} ${issueType} ${complexity}`.toLowerCase();
  let selected = LIVE_ONLINE_SERVICE_LEVELS.find((level) => level.key === key) || LIVE_ONLINE_SERVICE_LEVELS[5];
  if (/attorney|legal|tax court|fraud|criminal|appeal|summons|privilege/.test(text)) selected = LIVE_ONLINE_SERVICE_LEVELS.find((level) => level.key === 'live_tax_attorney_strategy');
  else if (/schedule c|business|bookkeeping|rental|k-1|nyc|ubt|partnership|entity|gig/.test(text)) selected = LIVE_ONLINE_SERVICE_LEVELS.find((level) => level.key === 'live_cpa_business_completion');
  else if (/irs notice|debt|collection|installment|9465|433|oic|656|penalty|lien|levy|transcript/.test(text)) selected = LIVE_ONLINE_SERVICE_LEVELS.find((level) => level.key === 'live_ea_resolution_session');
  else if (/1040|return|amended|1040-x|paid prep|state/.test(text)) selected = LIVE_ONLINE_SERVICE_LEVELS.find((level) => level.key === 'live_ptin_completion');
  const extraTime = Number(minutes || 0) > 60;
  return {
    selectedLevel: selected.key,
    selectedLabel: selected.label,
    publicPriceRange: selected.publicPriceRange,
    sessionType: selected.sessionType,
    estimatedMinutes: Number(minutes || 60),
    possibleAddOn: extraTime ? 'Extra professional time may require quote or add-on approval.' : '',
    includedOutput: selected.output,
    guardrail: selected.guardrail,
    disclaimer: 'Estimate only. Final quote depends on tax years, documents, forms, deadlines, risk flags, credential routing, and production readiness gates.'
  };
}

module.exports = {
  COMPETITOR_PRICE_BENCHMARKS,
  LIVE_ONLINE_SERVICE_LEVELS,
  SERVICE_DESIGN_RECOMMENDATIONS,
  COMPETITOR_SOURCE_LEDGER,
  buildCompetitorMarketResearch,
  buildLiveOnlineConsultationProducts,
  estimateLiveConsultation
};
