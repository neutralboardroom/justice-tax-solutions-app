const STARTING_PATHS = [
  { key: 'notice-help', label: 'Upload a Tax Notice', description: 'IRS, New York State, or NYC letters, bills, proposed changes, audits, deadlines, and confusing mail.' },
  { key: 'tax-debt', label: 'Tax Debt or Back Taxes', description: 'Payment plans, hardship, penalties, liens, levies, unfiled years, or offer-in-compromise screening.' },
  { key: 'return-help', label: 'Prepare or Review a Tax Return', description: 'Current year, prior year, amended, W-2, 1099, credits, NY resident/nonresident, and review.' },
  { key: 'gig-worker', label: 'Self-Employed or Gig Worker', description: 'Uber/Lyft, delivery apps, contractors, Schedule C/SE, mileage, expenses, and estimated taxes.' },
  { key: 'amended-prior-year', label: 'Prior-Year or Amended Return', description: 'Fix a filed return or catch up on missing years.' },
  { key: 'not-sure', label: 'Not Sure / Need a Human to Look', description: 'Plain-English triage when the user does not know what tax path applies.' }
];

const FEDERAL_MVP_FORMS = ['1040','1040-SR','Schedule 1','Schedule 2','Schedule 3','Schedule A','Schedule B','Schedule C','Schedule SE','8812','8863','8962','1040-X','4868','9465','433-A/F/B','656 screening','2848/8821 gated'];
const NY_MVP_FORMS = ['IT-201','IT-203','IT-2','IT-196 planned','IT-201-X','IT-203-X','IT-370 planned','NYS installment agreement screening','DTF-5 screening'];
const NYC_MVP_WORKFLOWS = ['NYC Department of Finance notice upload','NYC tax debt/OIC inquiry routing','NYC UBT screening','NYC Commercial Rent Tax screening planned'];

const AGENCY_KEYWORDS = [
  { agency: 'IRS', patterns: ['irs', 'internal revenue service', 'cp', 'letter ', 'form 1040', 'federal tax', 'treasury'] },
  { agency: 'New York State Tax Department', patterns: ['new york state', 'nys', 'tax.ny.gov', 'dtf', 'it-201', 'it-203', 'department of taxation'] },
  { agency: 'NYC Department of Finance', patterns: ['nyc department of finance', 'department of finance', 'nyc dof', 'commercial rent tax', 'unincorporated business tax', 'ubt'] }
];

const PROBLEM_FLAGS = [
  { key: 'notice', label: 'Tax notice or letter', score: 15, terms: ['notice', 'letter', 'cp', 'bill', 'proposed', 'adjustment', 'audit', 'examination'] },
  { key: 'deadline', label: 'Deadline or response date', score: 20, terms: ['deadline', 'respond by', 'response date', '30 days', '60 days', '90 days', 'due date', 'levy date'] },
  { key: 'cannot_pay', label: 'Cannot pay balance due', score: 20, terms: ['cannot pay', 'can t pay', 'owe', 'balance due', 'payment plan', 'installment', 'hardship'] },
  { key: 'collection', label: 'Collection risk', score: 30, terms: ['levy', 'lien', 'garnish', 'garnishment', 'seize', 'seizure', 'bank account', 'wage levy'] },
  { key: 'unfiled', label: 'Unfiled or late tax years', score: 25, terms: ['unfiled', 'not filed', 'did not file', 'late return', 'back taxes', 'missing return'] },
  { key: 'self_employed', label: 'Self-employed / 1099 / gig worker', score: 15, terms: ['self employed', '1099', 'uber', 'lyft', 'doordash', 'gig', 'contractor', 'schedule c', 'business expenses', 'mileage'] },
  { key: 'amend', label: 'Amended return or correction', score: 15, terms: ['amend', 'amended', '1040x', '1040-x', 'mistake', 'correction', 'correct return'] },
  { key: 'identity', label: 'Identity/PIN/fraud concern', score: 25, terms: ['identity', 'fraud', 'pin', 'ip pin', 'someone filed', 'stolen'] },
  { key: 'refund_hold', label: 'Refund hold or offset concern', score: 15, terms: ['refund hold', 'refund frozen', 'offset', 'where is my refund'] },
  { key: 'business_tax', label: 'Business or NYC tax issue', score: 20, terms: ['sales tax', 'payroll tax', 'withholding', 'corporation tax', 'ubt', 'commercial rent tax', 'nyc-202', 'nyc-204'] }
];

function normalizeText(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ');
}

function detectAgency(text = '') {
  const normalized = normalizeText(text);
  for (const entry of AGENCY_KEYWORDS) {
    if (entry.patterns.some((pattern) => normalized.includes(pattern))) return entry.agency;
  }
  return 'Unknown / needs human review';
}

function analyzeCase(input = {}) {
  const combined = normalizeText([
    input.pathway,
    input.primaryConcern,
    input.description,
    input.noticeText,
    input.taxYears,
    input.incomeTypes,
    input.stateCityIssues,
    input.taxpayerType,
    input.selectedTier
  ].filter(Boolean).join(' '));

  const flags = [];
  let score = 0;
  for (const flag of PROBLEM_FLAGS) {
    if (flag.terms.some((term) => combined.includes(term))) {
      flags.push({ key: flag.key, label: flag.label, score: flag.score });
      score += flag.score;
    }
  }

  const agency = detectAgency(combined);
  if (agency !== 'Unknown / needs human review') score += 10;
  if (String(input.pathway || '').includes('tax-debt')) score += 15;
  if (String(input.pathway || '').includes('notice')) score += 10;

  let risk_level = 'low';
  if (score >= 60) risk_level = 'high';
  else if (score >= 30) risk_level = 'medium';

  return {
    agency,
    risk_score: Math.min(score, 100),
    risk_level,
    flags,
    missing_items: buildMissingItems(input, flags),
    recommended_next_steps: buildNextSteps(input, flags, risk_level, agency),
    review_gate: buildReviewGate(flags, risk_level),
    public_disclaimer: 'Initial organizer only. Human/professional review is required before filing, signing, responding to an agency, or relying on a tax position.'
  };
}

function buildMissingItems(input, flags) {
  const items = [];
  const flagKeys = new Set(flags.map((flag) => flag.key));
  if (flagKeys.has('notice')) items.push('Clear photo or PDF of every page of the IRS/NYS/NYC notice, including deadline and notice number.');
  if (flagKeys.has('deadline')) items.push('Exact response date/deadline shown on the notice.');
  if (flagKeys.has('cannot_pay') || flagKeys.has('collection')) items.push('Current balance due, payment history, household income, monthly expenses, bank balances, and asset information.');
  if (flagKeys.has('unfiled')) items.push('List of unfiled years and available W-2s, 1099s, transcripts, prior returns, and state notices.');
  if (flagKeys.has('self_employed')) items.push('1099s, app income summaries, mileage log, vehicle expenses, supplies, phone/internet, insurance, and business expense records.');
  if (flagKeys.has('amend')) items.push('Originally filed return, IRS/NYS adjustment notice if any, and corrected documents.');
  if (flagKeys.has('business_tax')) items.push('Business entity type, EIN if applicable, tax account notices, sales/payroll/NYC tax filings, and bookkeeping summary.');
  if (!input.email) items.push('Email address for secure follow-up and case status updates.');
  if (!input.taxYears) items.push('Tax year or years involved.');
  if (items.length === 0) items.push('Basic identity/contact details, tax year, income documents, and any agency letters connected to the concern.');
  return items;
}

function buildNextSteps(input, flags, riskLevel, agency) {
  const steps = [];
  const flagKeys = new Set(flags.map((flag) => flag.key));
  if (riskLevel === 'high') steps.push('Human tax review should happen before the taxpayer responds, pays, signs, or files anything.');
  if (flagKeys.has('deadline')) steps.push('Confirm exact deadline from the notice and calendar it immediately.');
  if (flagKeys.has('notice')) steps.push(`Classify the notice from ${agency} and prepare a plain-English action plan.`);
  if (flagKeys.has('cannot_pay')) steps.push('Screen for installment agreement, hardship/currently-not-collectible, penalty relief, and offer-in-compromise eligibility.');
  if (flagKeys.has('collection')) steps.push('Escalate collection threats such as liens, levies, garnishment, or seizures for urgent professional review.');
  if (flagKeys.has('unfiled')) steps.push('Prioritize missing returns before tax-debt resolution because many relief options require filing compliance.');
  if (flagKeys.has('self_employed')) steps.push('Build Schedule C/SE organizer and estimated-tax warning checklist.');
  if (flagKeys.has('amend')) steps.push('Compare original return against corrected documents before preparing amended-return path.');
  if (flagKeys.has('identity')) steps.push('Route identity, fraud, and PIN concerns to a specialized safety workflow before ordinary filing steps.');
  if (steps.length === 0) steps.push('Complete intake, upload documents, and route to the correct tax return or concern workflow.');
  return steps;
}

function buildReviewGate(flags, riskLevel) {
  const keys = new Set(flags.map((f) => f.key));
  if (riskLevel === 'high' || keys.has('collection') || keys.has('identity')) return 'urgent-professional-review';
  if (keys.has('cannot_pay') || keys.has('unfiled') || keys.has('business_tax')) return 'human-tax-review';
  if (keys.has('self_employed') || keys.has('amend')) return 'preparer-or-accountant-review';
  return 'starter-organizer';
}

module.exports = { STARTING_PATHS, FEDERAL_MVP_FORMS, NY_MVP_FORMS, NYC_MVP_WORKFLOWS, analyzeCase, detectAgency };
