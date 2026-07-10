function cleanText(value, max = 140) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseAmount(value) {
  const raw = String(value || '').replace(/[^0-9.]/g, '');
  const num = Number(raw || 0);
  return Number.isFinite(num) ? num : 0;
}

function parseDays(deadline) {
  const text = String(deadline || '').toLowerCase();
  const explicit = text.match(/(\d+)\s*(day|days)/);
  if (explicit) return Number(explicit[1]);
  if (/today|same day|now|immediate/.test(text)) return 0;
  if (/tomorrow|next day|24/.test(text)) return 1;
  const date = Date.parse(deadline || '');
  if (!Number.isNaN(date)) return Math.ceil((date - Date.now()) / (24 * 60 * 60 * 1000));
  return null;
}

const TAXPAYER_ACTION_CENTER_POLICY = {
  version: '0.1.56',
  purpose: 'Give public visitors a calm, practical first-step center before they upload, pay, call an agency, or choose a review tier.',
  safe_mode: 'No real sensitive taxpayer documents. Users should start with no file or redacted/sample copies only until production security approval is complete.',
  public_value_rule: 'Add guidance only when it reduces confusion, improves safe intake, or helps route users to the lowest safe professional level. Do not imply filing, representation, tax advice, or guaranteed outcomes.'
};

const PUBLIC_ACTION_PATHS = [
  { key: 'notice_received', label: 'I received a tax notice', best_start: '/tax-notice-next-steps.html', user_question: 'What agency sent it, what year is listed, what is the deadline, and does it ask for payment, documents, identity verification, or a response?', gather_first: ['agency name', 'notice number', 'tax year/period', 'date on letter', 'response deadline', 'amount due or changed refund', 'envelope if mailing date matters'], likely_review: 'AI organization first; EA/CPA/tax attorney review when urgent, high-dollar, audit, collection, business, or legal-risk flags appear.', do_not_upload_yet: ['unredacted notice', 'full SSN', 'bank information', 'transcripts', 'full return', 'W-2/1099 copies'] },
  { key: 'tax_debt_payment_plan', label: 'I owe taxes or cannot pay', best_start: '/tax-debt-payment-plan-help.html', user_question: 'How much is owed, which agency, which tax years, and is there any levy, lien, garnishment, warrant, or final notice language?', gather_first: ['agency', 'balance by year', 'latest notice date', 'monthly amount you can safely pay', 'income source', 'rent/mortgage and basic living expenses', 'prior payment plan history'], likely_review: 'AI/payment-plan screening first; EA review for IRS collection; CPA review for business facts; attorney review for legal strategy, fraud, summons, or court exposure.', do_not_upload_yet: ['bank statements', 'pay stubs with full SSN/account details', 'unredacted wage garnishment notice', 'complete return package'] },
  { key: 'unfiled_back_returns', label: 'I have unfiled or back tax returns', best_start: '/back-taxes-unfiled-returns.html', user_question: 'Which years are missing, did you have W-2, 1099, self-employed, unemployment, retirement, or investment income, and did any agency already contact you?', gather_first: ['missing tax years', 'filing status for each year', 'income types', 'state residency/move history', 'dependents', 'business/gig work details', 'agency letters if any'], likely_review: 'PTIN/CPA review before paid return preparation; EA/attorney review if collection, substitute-for-return, audit, or legal-risk issues appear.', do_not_upload_yet: ['full W-2/1099 package', 'transcripts', 'old tax returns with SSNs', 'bank records'] },
  { key: 'amended_return', label: 'I may need to amend a return', best_start: '/amended-return-help.html', user_question: 'What changed after filing: income, dependent, filing status, deduction, credit, residency, or business expense?', gather_first: ['original filing year', 'what changed', 'agency notice if any', 'refund/payment effect', 'documents supporting the change', 'state return impact'], likely_review: 'AI issue summary first; PTIN/CPA review for amended return work; attorney review if the change involves fraud, legal position, or audit strategy.', do_not_upload_yet: ['complete original return', 'full SSNs', 'unredacted source documents'] },
  { key: 'self_employed_gig_worker', label: 'I am self-employed or a gig worker', best_start: '/self-employed-gig-worker-tax-help.html', user_question: 'What platforms or clients paid you, do you have 1099s, what expenses/mileage records exist, and are estimated taxes missing?', gather_first: ['income platforms/clients', 'gross income estimate', 'expense categories', 'mileage or vehicle use', 'home office facts', 'estimated payments', 'NYC/NYS business facts if applicable'], likely_review: 'CPA review is often safer when expenses, Schedule C, NYC/NYS business taxes, or higher-dollar consequences are involved.', do_not_upload_yet: ['full 1099 package', 'bank statements', 'platform exports with personal IDs', 'receipts with card numbers'] },
  { key: 'professional_reassurance', label: 'I want a person to check this', best_start: '/cpa-ea-tax-attorney-review.html', user_question: 'Do you want a PTIN preparer, EA, CPA, or tax attorney review, and what outcome do you want reviewed before you act?', gather_first: ['main concern', 'deadline', 'agency', 'tax year', 'what you already prepared', 'what you want checked', 'preferred appointment method'], likely_review: 'Customer-requested reassurance can be offered even when AI-only organization might otherwise be enough; scope and price should be clear first.', do_not_upload_yet: ['unredacted documents unless production upload is approved and staff requests them through the secure process'] }
];

function buildTaxpayerActionCenter() {
  return {
    policy: TAXPAYER_ACTION_CENTER_POLICY,
    headline: 'Start with the right next step before you upload, pay, call, or respond.',
    current_safe_launch_mode: 'Limited public site review plus invite-only no-sensitive private pilot.',
    first_rules: [
      'Do not ignore a tax notice, but do not rush into a payment or response without understanding what the agency is asking for.',
      'Use official agency contact information if you contact the IRS, New York State, or NYC directly.',
      'Use the free starting point with no file first whenever possible.',
      'Upload only redacted/sample documents while live sensitive uploads remain blocked.',
      'Ask for professional review when the matter is urgent, high-dollar, collection-related, audit-related, business-tax-related, or legally risky.'
    ],
    action_paths: PUBLIC_ACTION_PATHS,
    safest_public_cta: { label: 'Start free with no sensitive upload', href: '/#start', note: 'You can describe the situation first and decide later whether any professional review is needed.' },
    escalation_flags: [
      'levy, lien, garnishment, seizure, warrant, summons, subpoena, fraud, criminal investigation, or court/tax court language',
      'same-day, next-day, or missed deadline',
      'business payroll, sales tax, trust-fund, employee withholding, or NYC/NYS business tax issue',
      'identity theft or account access you did not authorize',
      'large balance, multi-year problem, unfiled returns, or prior defaulted payment plan',
      'you are being asked to sign, file, or respond based on advice you do not understand'
    ],
    safe_document_rule: 'Redact SSNs except last four digits, bank and routing numbers, full dates of birth, account numbers, dependent SSNs, signatures, barcodes/QR codes that expose private data, and any pages not needed for the question.'
  };
}

function buildReviewLevelSelfCheck(input = {}) {
  const issue = cleanText(input.issue || input.pathway || input.problem || '', 220).toLowerCase();
  const agency = cleanText(input.agency || '', 80);
  const notice = cleanText(input.notice || '', 100);
  const deadline = cleanText(input.deadline || '', 100);
  const amount = parseAmount(input.amount || input.balance || '');
  const days = parseDays(deadline);
  const combined = `${issue} ${agency} ${notice} ${deadline}`.toLowerCase();
  const reasons = [];
  let review = 'AI organization only / free starting point';
  let review_key = 'ai_organization';
  let urgency = 'normal';
  if (days !== null && days <= 2) { urgency = 'urgent'; reasons.push('The deadline appears to be same-day, next-day, or within two days.'); }
  else if (days !== null && days <= 14) { urgency = 'soon'; reasons.push('There appears to be a near-term response deadline.'); }
  if (/levy|lien|garnish|seiz|summons|subpoena|criminal|fraud|warrant|court|tax court|appeal/.test(combined)) { review = 'Tax attorney review or EA review depending on the exact issue'; review_key = 'attorney_or_ea_review'; urgency = urgency === 'normal' ? 'elevated' : urgency; reasons.push('The description includes collection, appeal, court, summons, fraud, or legal-risk language.'); }
  else if (/payroll|sales tax|trust fund|withholding|employee|941|940|nyc|ubt|business tax/.test(combined)) { review = 'CPA review, EA review, or tax attorney review depending on records and agency posture'; review_key = 'business_tax_professional_review'; reasons.push('Business, payroll, withholding, sales-tax, NYC UBT, or entity facts usually need professional review.'); }
  else if (/audit|exam|cp2000|underreported|identity|verify|5071|4883/.test(combined)) { review = 'EA or CPA review recommended before responding'; review_key = 'ea_or_cpa_review'; reasons.push('Audit, underreporter, or identity-verification language should be reviewed before a response is sent.'); }
  else if (/return|amend|1040x|file|filing|unfiled|back return|schedule c|1099|gig|self-employed/.test(combined)) { review = 'PTIN preparer or CPA review before paid return-preparation output'; review_key = 'ptin_or_cpa_review'; reasons.push('Return-preparation or self-employed facts require preparer/professional review before filing or signing.'); }
  if (amount >= 100000) { review = 'EA/CPA/tax attorney review recommended before action'; review_key = 'high_balance_professional_review'; urgency = urgency === 'normal' ? 'elevated' : urgency; reasons.push('The balance appears very high and should not be handled as AI-only.'); }
  else if (amount >= 25000 && review_key === 'ai_organization') { review = 'EA/CPA review recommended because the balance is substantial'; review_key = 'ea_or_cpa_review'; reasons.push('The balance appears high enough to justify human review.'); }
  if (!reasons.length) reasons.push('No urgent or high-risk words were detected, but facts still need review before filing, signing, or responding.');
  return { input_summary: { issue: cleanText(input.issue || input.pathway || input.problem || '', 220), agency, notice, amount, deadline }, urgency, suggested_review_level: review, suggested_review_key: review_key, reasons, safe_next_step: 'Start with no-file intake or redacted/sample documents only. Do not rely on this self-check as tax, accounting, or legal advice.', what_to_do_now: ['Write down the agency, notice number, tax year, amount, and deadline.', 'Check whether the issue involves collection, audit, identity verification, unfiled returns, business taxes, or a legal deadline.', 'Use the free starting point to organize facts before choosing a paid review level.', 'Escalate to a qualified professional before filing, signing, responding, or taking a tax position.'] };
}

module.exports = { TAXPAYER_ACTION_CENTER_POLICY, PUBLIC_ACTION_PATHS, buildTaxpayerActionCenter, buildReviewLevelSelfCheck };
