const TAX_DOCUMENT_TYPES = [
  { key: 'irs_notice', label: 'IRS notice or letter', examples: ['CP14','CP2000','CP504','Letter 12C','Letter 1058','LT11'], workflow: 'notice-help', priority: 1, expectedFields: ['agency','notice_number','tax_year','response_deadline','amount_due','taxpayer_name'] },
  { key: 'nys_notice', label: 'New York State tax notice', examples: ['DTF notice','assessment','statement of proposed audit change'], workflow: 'notice-help', priority: 1, expectedFields: ['agency','notice_number','tax_year','response_deadline','amount_due'] },
  { key: 'nyc_notice', label: 'NYC Department of Finance notice', examples: ['NYC DOF notice','UBT notice','commercial rent tax notice'], workflow: 'notice-help', priority: 1, expectedFields: ['agency','notice_number','tax_year','tax_type','amount_due'] },
  { key: 'w2', label: 'Form W-2', examples: ['W-2 Wage and Tax Statement'], workflow: 'return-help', priority: 1, expectedFields: ['employer_ein','wages_box_1','federal_withholding_box_2','state_wages','state_withholding','local_wages','local_withholding'] },
  { key: '1099_nec', label: 'Form 1099-NEC', examples: ['nonemployee compensation'], workflow: 'gig-worker', priority: 1, expectedFields: ['payer_tin','recipient_tin','nonemployee_compensation_box_1','federal_withholding','state_withholding'] },
  { key: '1099_k', label: 'Form 1099-K', examples: ['payment card and third party network transactions'], workflow: 'gig-worker', priority: 1, expectedFields: ['payer','gross_payment_amount','merchant_category','state_tax_withheld'] },
  { key: '1099_int_div_b', label: 'Investment/income 1099', examples: ['1099-INT','1099-DIV','1099-B','brokerage statement'], workflow: 'return-help', priority: 2, expectedFields: ['payer','interest','dividends','capital_gain_distributions','proceeds','basis'] },
  { key: '1098_t', label: 'Form 1098-T', examples: ['tuition statement'], workflow: 'return-help', priority: 2, expectedFields: ['student','qualified_tuition','scholarships','institution_ein'] },
  { key: '1095_a', label: 'Form 1095-A', examples: ['Marketplace health insurance'], workflow: 'return-help', priority: 2, expectedFields: ['policy_number','monthly_premiums','slcsp','advance_credit'] },
  { key: 'prior_return', label: 'Prior-year tax return', examples: ['1040','IT-201','IT-203','prior return PDF'], workflow: 'amended-prior-year', priority: 1, expectedFields: ['filing_status','dependents','agi','refund_or_balance','forms_filed'] },
  { key: 'financial_statement', label: 'Financial statement / tax-debt support', examples: ['bank statements','paystubs','rent','utilities','asset list'], workflow: 'tax-debt', priority: 1, expectedFields: ['income','expenses','assets','bank_balances','household_size'] },
  { key: 'business_records', label: 'Business/gig expense records', examples: ['mileage log','app summary','receipts','P&L','bookkeeping'], workflow: 'gig-worker', priority: 1, expectedFields: ['gross_receipts','mileage','vehicle_expenses','supplies','phone_internet','insurance','platform_fees'] }
];

const FIELD_FILL_TARGETS = {
  w2: [
    { target: 'IRS 1040 Line 1a wages', source: 'W-2 box 1', confidenceRule: 'requires human verification if OCR/import not from payroll provider' },
    { target: 'IRS 1040 federal withholding', source: 'W-2 box 2', confidenceRule: 'verify against W-2 image' },
    { target: 'NYS IT-2 wage summary', source: 'state/local W-2 boxes', confidenceRule: 'requires NY/local review when NYC/Yonkers wages appear' }
  ],
  '1099_nec': [
    { target: 'Schedule C gross receipts', source: '1099-NEC box 1', confidenceRule: 'compare with app summaries and bank deposits' },
    { target: 'Schedule SE trigger', source: '1099-NEC nonemployee compensation', confidenceRule: 'auto-flag for self-employment review' }
  ],
  '1099_k': [
    { target: 'Schedule C gross receipts review', source: '1099-K gross amount', confidenceRule: 'do not blindly treat gross 1099-K as taxable profit; reconcile fees/refunds/personal transactions' }
  ],
  irs_notice: [
    { target: 'Notice action plan', source: 'notice number/tax year/deadline/amount due', confidenceRule: 'deadline and notice code require human confirmation' },
    { target: 'Tax-debt workflow', source: 'balance due/collection language', confidenceRule: 'collection threats route to urgent review' }
  ],
  nys_notice: [
    { target: 'NYS action plan', source: 'notice number/tax year/deadline/amount due', confidenceRule: 'human review before response or payment recommendation' }
  ],
  nyc_notice: [
    { target: 'NYC DOF action plan', source: 'tax type/tax period/deadline/amount due', confidenceRule: 'NYC business tax issues route to professional review' }
  ],
  prior_return: [
    { target: 'Prior-year carryforward/reconciliation', source: 'prior return PDF', confidenceRule: 'manual verification until tax software import exists' }
  ],
  business_records: [
    { target: 'Schedule C expense organizer', source: 'receipts/mileage/app records', confidenceRule: 'categorization requires taxpayer confirmation and reviewer sampling' }
  ],
  financial_statement: [
    { target: '433/DTF-5/OIC pre-screen', source: 'income/expense/asset documents', confidenceRule: 'not an OIC promise; only screen eligibility and missing financial proof' }
  ]
};

function normalized(value = '') {
  return String(value || '').toLowerCase();
}

function classifyDocument({ original_name = '', mime_type = '', extracted_text = '' } = {}) {
  const haystack = normalized(`${original_name} ${mime_type} ${extracted_text}`);
  const checks = [
    ['irs_notice', ['cp14','cp2000','cp504','letter 12c','letter 1058','lt11','internal revenue service','irs notice','department of the treasury']],
    ['nys_notice', ['nys','new york state tax','department of taxation','dtf-','notice and demand','statement of proposed audit change']],
    ['nyc_notice', ['nyc department of finance','nyc dof','unincorporated business tax','commercial rent tax','nyc-202','nyc-204']],
    ['w2', ['w-2','form w2','wage and tax statement']],
    ['1099_nec', ['1099-nec','1099 nec','nonemployee compensation']],
    ['1099_k', ['1099-k','1099 k','payment card','third party network']],
    ['1099_int_div_b', ['1099-int','1099-div','1099-b','brokerage','consolidated 1099']],
    ['1098_t', ['1098-t','tuition statement']],
    ['1095_a', ['1095-a','marketplace statement','health insurance marketplace']],
    ['prior_return', ['form 1040','it-201','it-203','tax return','1040-sr']],
    ['financial_statement', ['bank statement','paystub','rent','mortgage','utility bill','assets','liabilities']],
    ['business_records', ['mileage','uber','lyft','doordash','profit and loss','p&l','receipt','expense summary']]
  ];
  for (const [key, terms] of checks) {
    if (terms.some((term) => haystack.includes(term))) return documentTypeByKey(key, 'rules:filename/text keyword');
  }
  return { key: 'unknown_tax_document', label: 'Unknown tax document', workflow: 'not-sure', priority: 9, expectedFields: [], confidence: 'low', confidence_score: 15, classifier: 'rules:no-match' };
}

function documentTypeByKey(key, classifier = 'rules') {
  const type = TAX_DOCUMENT_TYPES.find((entry) => entry.key === key);
  if (!type) return { key, label: key, workflow: 'not-sure', expectedFields: [], confidence: 'low', confidence_score: 20, classifier };
  const score = classifier.includes('text keyword') ? 78 : 62;
  return { ...type, confidence: score >= 75 ? 'medium-high' : 'medium', confidence_score: score, classifier };
}

function buildFieldFillPlan(taxCase = {}, documents = []) {
  const classifiedDocs = documents.map((doc) => ({ ...doc, classification: doc.classification || classifyDocument(doc) }));
  const targets = [];
  const missingDocumentTypes = new Set();
  for (const doc of classifiedDocs) {
    const key = doc.classification && doc.classification.key;
    const fillTargets = FIELD_FILL_TARGETS[key] || [];
    for (const target of fillTargets) targets.push({ document_id: doc.id || '', document_name: doc.original_name || '', document_type: key, ...target, status: 'needs_verification', extraction_confidence_score: doc.extraction_profile ? doc.extraction_profile.extraction_confidence_score : (doc.extraction_confidence_score || 0), source_verified: false });
    const extractedFields = (doc.extraction_profile && doc.extraction_profile.extracted_fields) || doc.extracted_fields || [];
    for (const field of extractedFields) {
      targets.push({
        document_id: doc.id || '',
        document_name: doc.original_name || '',
        document_type: key,
        target: field.label || field.key,
        source: field.source_hint || 'local document extraction',
        extracted_key: field.key || '',
        extracted_value_preview: field.value || '',
        confidenceRule: 'extracted value is source-linked but must be verified before use',
        status: field.status || 'needs_verification',
        extraction_confidence_score: field.confidence_score || 0,
        extraction_confidence_label: field.confidence_label || 'low',
        source_verified: false
      });
    }
  }

  const pathway = String(taxCase.pathway || 'not-sure');
  const flagKeys = new Set((taxCase.flags || []).map((flag) => flag.key));
  const presentKeys = new Set(classifiedDocs.map((doc) => doc.classification && doc.classification.key));
  if (pathway.includes('return') && !presentKeys.has('w2') && !presentKeys.has('1099_nec') && !presentKeys.has('1099_k')) missingDocumentTypes.add('income document such as W-2 or 1099');
  if (pathway.includes('debt') || flagKeys.has('cannot_pay') || flagKeys.has('collection')) missingDocumentTypes.add('financial statement / proof of income, expenses, assets, and balances');
  if (pathway.includes('notice') || flagKeys.has('notice')) {
    if (!presentKeys.has('irs_notice') && !presentKeys.has('nys_notice') && !presentKeys.has('nyc_notice')) missingDocumentTypes.add('complete tax notice or letter, every page');
  }
  if (flagKeys.has('self_employed') && !presentKeys.has('business_records')) missingDocumentTypes.add('business/gig expense records and mileage/app summaries');
  if (flagKeys.has('unfiled') && !presentKeys.has('prior_return')) missingDocumentTypes.add('prior returns or IRS/NYS transcripts for missing years');

  const verifiedCount = targets.filter((target) => target.status === 'verified').length;
  const readinessScore = Math.max(0, Math.min(100, 35 + Math.min(35, targets.length * 8) - missingDocumentTypes.size * 12 + verifiedCount * 5));
  return {
    case_id: taxCase.id || '',
    generated_at: new Date().toISOString(),
    readiness_score: readinessScore,
    classified_documents: classifiedDocs.map((doc) => ({ id: doc.id, original_name: doc.original_name, size_bytes: doc.size_bytes, mime_type: doc.mime_type, classification: doc.classification, extraction_profile: doc.extraction_profile || null, extracted_fields: (doc.extraction_profile && doc.extraction_profile.extracted_fields) || doc.extracted_fields || [] })),
    field_targets: targets,
    missing_document_types: Array.from(missingDocumentTypes),
    controls: [
      'Every extracted/prefilled value must show source and confidence.',
      'Deadline, tax year, SSN/TIN, refund/balance, and bank-account fields require human verification before filing or response.',
      'OIC/tax-debt fields are screening inputs only; no settlement promise is made.',
      'Professional override must create an audit event.',
      'Extracted values remain suggestions until client, staff, or qualified professional verification is recorded.'
    ]
  };
}

function workpaperBinderForCase(taxCase = {}, documents = []) {
  const plan = buildFieldFillPlan(taxCase, documents);
  const sections = [
    { key: '01-notices', label: '1. Notices and agency letters', match: ['irs_notice','nys_notice','nyc_notice'] },
    { key: '02-identity-prior-year', label: '2. Identity, prior returns, and tax years', match: ['prior_return'] },
    { key: '03-income', label: '3. Income documents', match: ['w2','1099_nec','1099_k','1099_int_div_b'] },
    { key: '04-credits-health-education', label: '4. Credits, health insurance, education', match: ['1098_t','1095_a'] },
    { key: '05-business-expenses', label: '5. Business/gig expenses and mileage', match: ['business_records'] },
    { key: '06-tax-debt-financials', label: '6. Tax-debt financial support', match: ['financial_statement'] },
    { key: '99-unknown-review', label: '99. Unknown / needs staff classification', match: ['unknown_tax_document'] }
  ];
  return sections.map((section) => ({
    ...section,
    documents: plan.classified_documents.filter((doc) => section.match.includes(doc.classification.key)),
    count: plan.classified_documents.filter((doc) => section.match.includes(doc.classification.key)).length
  }));
}

module.exports = { TAX_DOCUMENT_TYPES, FIELD_FILL_TARGETS, classifyDocument, buildFieldFillPlan, workpaperBinderForCase };
