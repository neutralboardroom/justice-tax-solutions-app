const REVIEW_ROLES = [
  { key: 'ptin_preparer', label: 'PTIN Tax Preparer', canPrepare: true, canSignReturn: true, handles: ['simple_return','prior_year','amended_return','organizer_review'] },
  { key: 'accountant', label: 'Accountant / Bookkeeper', canPrepare: true, canSignReturn: false, handles: ['schedule_c','bookkeeping','small_business','document_cleanup'] },
  { key: 'cpa', label: 'CPA', canPrepare: true, canSignReturn: true, handles: ['complex_return','business_return','new_york','audit_support','review'] },
  { key: 'ea', label: 'Enrolled Agent', canPrepare: true, canSignReturn: true, handles: ['irs_notice','tax_debt','collection','oic','representation'] },
  { key: 'tax_attorney', label: 'Tax Attorney', canPrepare: false, canSignReturn: false, handles: ['legal_advice','criminal_tax','privilege','litigation','high_risk_collection'] }
];

const REVIEW_TIERS = {
  starter_organizer: {
    key: 'starter_organizer',
    label: 'Starter Organizer',
    recommendedProduct: 'free_starting_point',
    releasePolicy: 'summary_only',
    description: 'Organizes the issue, missing documents, and next step. Does not file or respond for the taxpayer.'
  },
  notice_action_plan: {
    key: 'notice_action_plan',
    label: 'Tax Notice Action Plan',
    recommendedProduct: 'tax_notice_action_plan',
    releasePolicy: 'human_review_before_reliance',
    description: 'Reviews notice pages, deadlines, agency, issue type, and response options.'
  },
  return_review: {
    key: 'return_review',
    label: 'Tax Return Human Review',
    recommendedProduct: 'simple_return_review',
    releasePolicy: 'preparer_review_before_filing',
    description: 'Organizes tax documents and routes the return to a PTIN preparer or qualified professional before filing.'
  },
  gig_worker_review: {
    key: 'gig_worker_review',
    label: 'Gig Worker / Self-Employed Review',
    recommendedProduct: 'gig_worker_review',
    releasePolicy: 'preparer_or_accountant_review_required',
    description: 'Adds Schedule C/SE, mileage, expenses, estimates, and NY residency review.'
  },
  debt_resolution_review: {
    key: 'debt_resolution_review',
    label: 'Tax Debt / Back-Tax Review',
    recommendedProduct: 'tax_debt_notice_review',
    releasePolicy: 'professional_review_required',
    description: 'Screens for payment plan, hardship/CNC, penalty relief, OIC, and collection urgency.'
  },
  escalation_review: {
    key: 'escalation_review',
    label: 'CPA / EA / Tax Attorney Escalation',
    recommendedProduct: 'cpa_ea_tax_attorney_review',
    releasePolicy: 'qualified_professional_required',
    description: 'Escalates complex, collection, identity, business, representation, or legal-risk cases.'
  }
};

function normalizeText(value = '') { return String(value || '').toLowerCase(); }

function requiredReviewDocuments(taxCase = {}) {
  const text = normalizeText([taxCase.pathway, taxCase.description, taxCase.notice_text, taxCase.primary_concern, taxCase.income_types, taxCase.state_city_issues].join(' '));
  const docs = [];
  const add = (key, label, required = true) => { if (!docs.some((d) => d.key === key)) docs.push({ key, label, required }); };
  add('photo_id', 'Government photo ID for taxpayer identity confirmation', true);
  add('tax_years', 'Confirmed tax year or years involved', true);
  if (/notice|letter|cp\d|ltr|bill|audit|adjustment|ny state|nys|nyc/.test(text) || taxCase.pathway === 'notice-help') {
    add('notice_all_pages', 'Every page of the IRS, New York State, or NYC notice', true);
    add('deadline', 'Exact response or payment deadline from the notice', true);
  }
  if (/w-2|w2|1099|return|file|filing|refund|income/.test(text) || taxCase.pathway === 'return-help') {
    add('income_documents', 'W-2s, 1099s, brokerage, unemployment, SSA, pension, or other income documents', true);
    add('prior_return', 'Prior-year return if available', false);
  }
  if (/uber|lyft|doordash|1099|self|freelance|contractor|schedule c|business/.test(text)) {
    add('schedule_c_income', '1099/app income summaries and business income records', true);
    add('mileage_expenses', 'Mileage log, vehicle expenses, supplies, phone, insurance, and other business expense records', true);
  }
  if (/owe|debt|installment|payment plan|levy|lien|garnish|cannot pay|hardship|oic|offer/.test(text) || taxCase.pathway === 'tax-debt') {
    add('balance_due', 'Balance due by agency and year', true);
    add('financial_snapshot', 'Household income, monthly expenses, bank balances, assets, debts, and current paystubs', true);
  }
  if (/unfiled|back tax|behind|years|prior/.test(text) || taxCase.pathway === 'back-taxes') {
    add('unfiled_years', 'List of unfiled years and available wage/income transcripts or tax documents', true);
  }
  if (/amend|mistake|wrong|correct/.test(text) || taxCase.pathway === 'amended-return') {
    add('original_return', 'Original filed return and corrected documents', true);
  }
  if (/new york|nys|nyc|yonkers|resident|part-year|nonresident|moved/.test(text)) {
    add('residency_timeline', 'NY/NYC/Yonkers residency timeline, move dates, and other-state income/tax documents', true);
  }
  return docs;
}

function recommendReviewTier(taxCase = {}) {
  const gate = String(taxCase.review_gate || '').toLowerCase();
  const risk = String(taxCase.risk_level || '').toLowerCase();
  const text = normalizeText([taxCase.pathway, taxCase.description, taxCase.notice_text, taxCase.primary_concern, taxCase.income_types, taxCase.state_city_issues].join(' '));
  if (gate.includes('urgent') || risk === 'high' || /levy|lien|garnish|seizure|fraud|identity|criminal|subpoena/.test(text)) return REVIEW_TIERS.escalation_review;
  if (gate.includes('tax-review') || /owe|debt|cannot pay|payment plan|oic|offer|hardship|unfiled|back tax/.test(text)) return REVIEW_TIERS.debt_resolution_review;
  if (/uber|lyft|doordash|1099|self|freelance|schedule c|business/.test(text)) return REVIEW_TIERS.gig_worker_review;
  if (/notice|letter|cp\d|ltr|audit|adjustment/.test(text)) return REVIEW_TIERS.notice_action_plan;
  if (/return|file|filing|w-2|w2|refund|deduction|credit/.test(text)) return REVIEW_TIERS.return_review;
  return REVIEW_TIERS.starter_organizer;
}

function recommendProfessionalRoles(taxCase = {}) {
  const tier = recommendReviewTier(taxCase).key;
  const risk = String(taxCase.risk_level || '').toLowerCase();
  const text = normalizeText([taxCase.pathway, taxCase.description, taxCase.notice_text, taxCase.primary_concern, taxCase.income_types, taxCase.state_city_issues].join(' '));
  const roles = [];
  const add = (key) => { const role = REVIEW_ROLES.find((r) => r.key === key); if (role && !roles.some((r) => r.key === key)) roles.push(role); };
  if (tier === 'escalation_review' || risk === 'high') { add('ea'); add('cpa'); if (/criminal|fraud|legal|court|subpoena|tax attorney/.test(text)) add('tax_attorney'); }
  else if (tier === 'debt_resolution_review') { add('ea'); add('cpa'); add('ptin_preparer'); }
  else if (tier === 'gig_worker_review') { add('accountant'); add('ptin_preparer'); add('cpa'); }
  else if (tier === 'notice_action_plan') { add('ea'); add('ptin_preparer'); }
  else if (tier === 'return_review') { add('ptin_preparer'); add('cpa'); }
  else add('ptin_preparer');
  return roles;
}

function buildReviewPlan(taxCase = {}) {
  const tier = recommendReviewTier(taxCase);
  const requiredDocuments = requiredReviewDocuments(taxCase);
  const requiredCount = requiredDocuments.filter((d) => d.required).length || 1;
  const uploadedCount = Number(taxCase.document_count || (taxCase.documents || []).length || 0);
  const readinessScore = Math.min(100, Math.round((uploadedCount / requiredCount) * 60) + (taxCase.email ? 10 : 0) + (taxCase.tax_years ? 15 : 0) + (taxCase.description || taxCase.notice_text ? 15 : 0));
  const releaseChecklist = [
    'Client/taxpayer must review summary and confirm facts before any filing or agency response.',
    'Sensitive documents must be handled through secure storage with access logs before production launch.',
    'Paid filing, signing, or tax-position work must be reviewed by a qualified preparer/professional where required.',
    'No refund, debt reduction, penalty relief, payment plan, OIC, or agency outcome is guaranteed.'
  ];
  if (tier.key !== 'starter_organizer') releaseChecklist.unshift('Payment or professional-review approval should be recorded before releasing final review output.');
  return {
    tier,
    recommendedProduct: tier.recommendedProduct,
    readinessScore,
    requiredDocuments,
    professionalRoles: recommendProfessionalRoles(taxCase),
    releaseChecklist,
    clientConsentSummary: 'I understand Justice Tax Solutions is not the IRS, New York State, NYC, or a law firm. AI may organize information, but final tax filing, signing, agency responses, or legal advice require qualified human/professional review where required.',
    reviewStatusSuggestion: readinessScore >= 70 ? 'ready_for_human_review' : 'needs_missing_documents'
  };
}

function professionalPublicView(pro = {}) {
  return {
    id: pro.id,
    name: pro.name || '',
    email: pro.email || '',
    role_key: pro.role_key || '',
    role_label: (REVIEW_ROLES.find((r) => r.key === pro.role_key) || {}).label || pro.role_label || '',
    credentials: pro.credentials || '',
    status: pro.status || 'active',
    can_sign_returns: Boolean(pro.can_sign_returns),
    can_handle_notices: Boolean(pro.can_handle_notices),
    can_handle_tax_debt: Boolean(pro.can_handle_tax_debt),
    credential_status: pro.credential_status || '',
    ptin_last4: pro.ptin_last4 || '',
    ptin_status: pro.ptin_status || '',
    ny_tprin: pro.ny_tprin || '',
    ny_preparer_registration_status: pro.ny_preparer_registration_status || '',
    license_jurisdiction: pro.license_jurisdiction || '',
    license_number: pro.license_number || '',
    ea_number: pro.ea_number || '',
    identity_verified: Boolean(pro.identity_verified),
    background_review_status: pro.background_review_status || '',
    compliance_score: Number(pro.compliance_score || 0),
    notes: pro.notes || ''
  };
}

module.exports = {
  REVIEW_ROLES,
  REVIEW_TIERS,
  requiredReviewDocuments,
  recommendReviewTier,
  recommendProfessionalRoles,
  buildReviewPlan,
  professionalPublicView
};
