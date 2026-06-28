const COMPETITOR_MAP = [
  {
    group: 'legacy_consumer_filing',
    companies: ['TurboTax', 'H&R Block Online', 'TaxAct', 'FreeTaxUSA', 'Jackson Hewitt Online', 'TaxSlayer', 'Cash App Taxes', 'Liberty Tax', 'eFile.com'],
    observed_patterns: [
      'guided interview with progress tracking',
      'document upload/photo capture and financial institution imports',
      'tiered support ranging from DIY to expert assist to full service',
      'refund/status tracking and amended-return access',
      'strong pricing pressure from free or flat-fee products'
    ],
    what_to_adapt: [
      'simple choose-a-starting-path quiz',
      'return progress bar and section completeness indicators',
      'document checklist before asking long tax questions',
      'clear escalation from organizer to paid human/professional review'
    ],
    what_to_avoid: [
      'refund-first language that can sound like a guarantee',
      'forcing users through filing flows when they actually have notices, debt, or missing-year problems',
      'opaque upgrades that make anxious users feel trapped'
    ]
  },
  {
    group: 'tax_resolution_firms',
    companies: ['Optima Tax Relief', 'TaxRise', 'Community Tax', 'Anthem Tax Services', 'Tax Defense Network', 'Larson Tax Relief'],
    observed_patterns: [
      'free consultation front door',
      'investigation phase before quoting final resolution work',
      'focus on liens, levies, wage garnishment, back taxes, penalties, payment plans, OIC, and state tax issues',
      'heavy proof/trust messaging around licensed professionals and case results'
    ],
    what_to_adapt: [
      'separate tax investigation/readiness phase from resolution promise',
      'collection-risk triage for lien/levy/garnishment language',
      'tax-debt pathway that collects filing-compliance, income, expenses, assets, and notice history before recommending any relief option'
    ],
    what_to_avoid: [
      'OIC mill language such as guaranteed pennies-on-the-dollar outcomes',
      'settlement promises before qualification and financial analysis',
      'high-pressure urgency without explaining free IRS/NYS/NYC alternatives'
    ]
  },
  {
    group: 'professional_tax_software',
    companies: ['Drake Tax', 'Intuit ProConnect', 'Lacerte', 'ProSeries', 'UltraTax CS', 'CCH Axcess', 'TaxSlayer Pro', 'ATX', 'TaxWise'],
    observed_patterns: [
      'forms-first data entry plus diagnostics',
      'source links from calculated result back to data-entry screens',
      'multi-state and e-file diagnostics',
      'prior-year carryforward and return comparison',
      'staff-level review notes and preparer sign-off'
    ],
    what_to_adapt: [
      'diagnostic checklist before release',
      'field source map showing whether a value came from user input, uploaded document, prior year, or professional override',
      'separate client-facing summary from staff/professional workpapers',
      'reviewer sign-off checklist tied to credentials/PTIN/NYTPRIN where applicable'
    ],
    what_to_avoid: [
      'hard-to-understand forms-only interface for consumers',
      'letting staff override sensitive fields without an audit trail',
      'treating e-file readiness as the same thing as tax correctness'
    ]
  },
  {
    group: 'document_automation_and_practice_management',
    companies: ['SurePrep', 'TaxCaddy', 'SafeSend', 'Canopy', 'TaxDome', 'Liscio', 'Karbon', 'IRSLogics', 'PitBullTax'],
    observed_patterns: [
      'client portal for document collection and reminders',
      'scan-and-populate/OCR with human verification before export',
      'workpaper binder indexed in tax return order',
      'proposal to onboarding to document collection to payment to delivery pipeline',
      'tax resolution case stages with notices/transcripts/tasks centralized'
    ],
    what_to_adapt: [
      'Done Uploading / ready for review button',
      'document completeness tracker by workflow',
      'field extraction confidence and verifier queue',
      'notice/transcript/tax-debt case lane separated from return-prep lane',
      'client approval and payment before final release'
    ],
    what_to_avoid: [
      'assuming OCR is accurate without verification',
      'too much staff-only complexity before consumer trust is built',
      'document chaos with no return-order index'
    ]
  },
  {
    group: 'ai_and_embedded_tax_platforms',
    companies: ['april', 'Column Tax', 'Instead', 'TaxGPT', 'Blue J', 'CoCounsel Tax', 'Filed', 'FlyFin', 'Keeper'],
    observed_patterns: [
      'AI-powered data extraction and prefill',
      'embedded/white-label tax filing inside banks, payroll, and fintech platforms',
      'tax research and memo generation with citations for professionals',
      'visible reasoning/workpaper generation',
      'AI document collection agents and reduced manual entry'
    ],
    what_to_adapt: [
      'AI as navigator plus document-classification engine, not final unchecked preparer',
      'multi-AI consensus/second-look on high-risk notice/debt cases',
      'visible source/confidence for each prefilled field',
      'professional-facing research memo draft with citation-required status',
      'future API-ready architecture for embedded partners/referral locations'
    ],
    what_to_avoid: [
      'black-box AI tax answers with no source trail',
      'claiming end-to-end autonomous filing before compliance, testing, and professional sign-off are ready',
      'letting AI decide aggressive credits, OIC, or audit responses without review'
    ]
  }
];

const WORKFLOW_PATTERNS = [
  {
    key: 'problem_first_triage',
    label: 'Problem-first triage',
    inspired_by: ['tax relief firms', 'IRS Tax Debt Help', 'Immigration Oasis start flow'],
    mechanism: 'Ask what the user is worried about before asking form-level tax questions.',
    jts_status: 'implemented-expanded-v0.1.4',
    user_value: 'Anxious users do not have to know the correct tax form or relief program before starting.'
  },
  {
    key: 'document_first_prefill',
    label: 'Document-first prefill planner',
    inspired_by: ['TurboTax My Docs', 'TaxAct mobile upload', 'SurePrep 1040SCAN', 'april/Column embedded filing'],
    mechanism: 'Classify uploaded documents, extract likely field targets, and queue low-confidence items for human verification.',
    jts_status: 'foundation-added-v0.1.4',
    user_value: 'Reduces manual entry while avoiding unchecked OCR/AI mistakes.'
  },
  {
    key: 'return_order_binder',
    label: 'Return-order workpaper binder',
    inspired_by: ['SurePrep', 'professional tax prep systems'],
    mechanism: 'Group W-2s, 1099s, credits, deductions, notices, debt forms, and approvals in a return/problem order index.',
    jts_status: 'foundation-added-v0.1.4',
    user_value: 'Staff and preparers can quickly see what is present, missing, verified, and release-blocking.'
  },
  {
    key: 'field_source_map',
    label: 'Field source map',
    inspired_by: ['Drake diagnostics/source links', 'professional review workflows', 'AI tax extraction tools'],
    mechanism: 'Each tax field tracks source: user answer, document extraction, prior-year import, professional override, or missing.',
    jts_status: 'foundation-added-v0.1.4',
    user_value: 'Builds trust and helps reviewers find why a return/notice recommendation says what it says.'
  },
  {
    key: 'anti_scam_trust_center',
    label: 'Anti-scam trust center',
    inspired_by: ['IRS Dirty Dozen', 'NYS/NYC tax preparer bill of rights'],
    mechanism: 'Explicitly rejects ghost preparers, refund guarantees, OIC-mill promises, and pressure tactics.',
    jts_status: 'implemented-expanded-v0.1.4',
    user_value: 'Differentiates Justice Tax Solutions from questionable tax-relief marketing.'
  },
  {
    key: 'professional_signoff_release_gate',
    label: 'Professional signoff and release gate',
    inspired_by: ['H&R Block Tax Pro Review', 'TaxAct Full Service', 'TaxDome/SafeSend delivery', 'NY/IRS preparer compliance'],
    mechanism: 'Case is not final-released until payment, client approval, required documents, compliance checklist, and reviewer readiness pass.',
    jts_status: 'implemented-v0.1.3-expanded-v0.1.4',
    user_value: 'Protects clients and the business before filing, signing, or responding.'
  },
  {
    key: 'live_online_professional_completion',
    label: 'Live online professional completion',
    inspired_by: ['TurboTax Expert Full Service', 'TurboTax Expert Assist', 'H&R Block Tax Pro Review', 'Block Advisors', 'Jackson Hewitt full service', 'TaxDome/SafeSend delivery'],
    mechanism: 'AI completes the intake, source-linked fields, missing-info list, and draft forms before a PTIN/EA/CPA/attorney session; the professional reviews only the exceptions and completes the online handoff.',
    jts_status: 'added-v0.1.21',
    user_value: 'Customers can get the whole tax problem or return completed online while Justice Tax Solutions keeps professional time focused on judgment, credentials, and release approval.'
  }
];

const FEATURE_INSPIRATION_LEDGER = [
  { feature: 'Upload-any-notice start', priority: 'highest', source_category: 'tax_resolution_firms', decision: 'Keep as primary public CTA.' },
  { feature: 'Return organizer', priority: 'high', source_category: 'consumer_filing', decision: 'Keep as secondary CTA with document-first intake.' },
  { feature: 'Done Uploading button', priority: 'high', source_category: 'practice_management', decision: 'Add readiness state so staff knows when to review.' },
  { feature: 'Document classifier', priority: 'high', source_category: 'ai_document_automation', decision: 'Add rules now; connect OCR/AI extraction later.' },
  { feature: 'Field source map', priority: 'high', source_category: 'professional_software', decision: 'Add API/data model now; UI can expand next.' },
  { feature: 'AI tax memo draft', priority: 'medium', source_category: 'ai_tax_research', decision: 'Prepare endpoint but require citations and professional review before client use.' },
  { feature: 'Transcript monitoring', priority: 'medium-later', source_category: 'tax_resolution_software', decision: 'Plan after POA/8821 workflow and secure IRS access strategy.' },
  { feature: 'Embedded filing API', priority: 'later', source_category: 'april_column_tax', decision: 'Keep architecture API-ready; do not build partner e-file now.' },
  { feature: 'Flat low-price filing', priority: 'watch', source_category: 'Jackson Hewitt/FreeTaxUSA/Cash App', decision: 'Do not compete on cheapest simple filing; compete on problems, review, NY/NYC, and trust.' },
  { feature: 'Live online professional completion', priority: 'highest', source_category: 'TurboTax Live/H&R Block hybrid/Block Advisors', decision: 'Add as premium path with AI pre-completion, appointment-ready gate, credential-based routing, and transparent upgrade pricing.' },
  { feature: 'AI pre-session professional agenda', priority: 'high', source_category: 'Intuit AI expert tooling / practice management tools', decision: 'AI should summarize unresolved issues before a professional enters the case.' },
  { feature: 'Transparent upgrade and downgrade rules', priority: 'high', source_category: 'FTC/H&R Block/TurboTax free-pricing lessons', decision: 'Make level changes clear, preserve user data, show reasons, and require approval before collecting higher fees.' }
];

function competitorSummary() {
  return {
    total_groups: COMPETITOR_MAP.length,
    total_companies_tracked: COMPETITOR_MAP.reduce((sum, group) => sum + group.companies.length, 0),
    highest_priority_adaptations: FEATURE_INSPIRATION_LEDGER.filter((item) => ['highest','high'].includes(item.priority)),
    strategic_position: 'Justice Tax Solutions should be tax-problem-first, document-first, human-reviewed, New York/NYC-aware, and anti-scam by design—not a pure TurboTax clone. v0.1.27 adds live online professional completion, customer-requested reassurance sessions, calendar/scheduling integration readiness, and production-security hardening as premium, AI-prepared, credential-routed service paths.'
  };
}

module.exports = { COMPETITOR_MAP, WORKFLOW_PATTERNS, FEATURE_INSPIRATION_LEDGER, competitorSummary };
