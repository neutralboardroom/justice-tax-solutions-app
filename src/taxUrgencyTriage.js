const TAX_URGENCY_TRIAGE_POLICY = {
  version: '0.1.56',
  purpose: 'Give public visitors a safer first read on urgency before they upload, pay, call, sign, or respond to an IRS/NYS/NYC tax notice.',
  safety_rule: 'This is routing and organization guidance only. It is not legal, tax, accounting, or filing advice and it does not calculate official deadlines. Users must verify the notice, deadline, and response options with the agency or a qualified professional.',
  current_launch_mode: 'public guidance + no-sensitive intake + redacted/sample-document pilot only',
  prohibited_claims: [
    'Do not promise relief, penalty removal, refund, payment-plan approval, offer-in-compromise acceptance, appeal success, or deadline extension.',
    'Do not tell users to ignore notices, delay collection deadlines, or rely on AI output as a filed response.',
    'Do not accept unredacted sensitive taxpayer documents until production security gates are approved.'
  ]
};

const URGENCY_KEYWORDS = [
  { key: 'levy_or_garnishment', level: 'immediate', words: ['levy', 'garnish', 'garnishment', 'seize', 'seizure', 'bank levy', 'wage levy'], reason: 'Collection-enforcement language may involve fast-moving rights or deadlines.' },
  { key: 'lien', level: 'high', words: ['lien', 'notice of federal tax lien', 'nftl'], reason: 'Tax lien language should be reviewed before deadlines pass.' },
  { key: 'final_notice', level: 'immediate', words: ['final notice', 'intent to levy', 'lt11', 'letter 1058', 'cp504', 'notice of intent'], reason: 'Final notice / intent-to-levy language can require urgent review.' },
  { key: 'summons_or_court', level: 'immediate', words: ['summons', 'subpoena', 'court', 'petition', 'tax court', 'deadline to petition'], reason: 'Court, petition, summons, or subpoena language should be escalated immediately.' },
  { key: 'fraud_or_criminal', level: 'immediate', words: ['fraud', 'criminal', 'investigation', 'special agent', 'cid', 'false return'], reason: 'Fraud or criminal-investigation language requires legal/professional review before response.' },
  { key: 'identity', level: 'high', words: ['identity verification', '5071', '4883', 'verify your identity', 'identity theft'], reason: 'Identity-verification matters should be handled carefully using official agency channels.' },
  { key: 'audit_or_exam', level: 'high', words: ['audit', 'examination', 'exam', 'cp2000', 'underreported', 'proposed changes'], reason: 'Audit, examination, and underreported-income notices should be organized before responding.' },
  { key: 'business_payroll_sales_tax', level: 'high', words: ['payroll', '941', '940', 'sales tax', 'trust fund', 'withholding', 'responsible person', 'nyc ubt', 'business tax'], reason: 'Payroll, withholding, sales-tax, trust-fund, or NYC business-tax issues are usually not simple AI-only matters.' },
  { key: 'unfiled_returns', level: 'elevated', words: ['unfiled', 'back taxes', 'substitute for return', 'sfr', 'missing return', 'nonfiler'], reason: 'Unfiled-return problems often need year-by-year records and professional review before filing.' }
];

function cleanText(value, max = 600) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function parseAmount(value) {
  const text = String(value || '').replace(/,/g, '');
  const match = text.match(/-?\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : 0;
}

function parseDeadline(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return { raw: '', days_left: null, interpreted: 'No deadline supplied', date: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (/today/.test(text)) return { raw: value, days_left: 0, interpreted: 'User wrote today', date: today.toISOString().slice(0, 10) };
  if (/tomorrow/.test(text)) return { raw: value, days_left: 1, interpreted: 'User wrote tomorrow', date: new Date(today.getTime() + 86400000).toISOString().slice(0, 10) };
  const daysMatch = text.match(/(\d{1,3})\s*(day|days|business day|business days)/);
  if (daysMatch) return { raw: value, days_left: Number(daysMatch[1]), interpreted: `${daysMatch[1]} days from user wording`, date: null };
  const iso = text.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  const us = text.match(/(\d{1,2})[/-](\d{1,2})[/-]((?:20)?\d{2})/);
  let date = null;
  if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  else if (us) {
    const year = us[3].length === 2 ? Number(`20${us[3]}`) : Number(us[3]);
    date = new Date(year, Number(us[1]) - 1, Number(us[2]));
  }
  if (date && !Number.isNaN(date.getTime())) {
    date.setHours(0, 0, 0, 0);
    const days = Math.ceil((date.getTime() - today.getTime()) / 86400000);
    return { raw: value, days_left: days, interpreted: `Calendar date interpreted as ${date.toISOString().slice(0, 10)}`, date: date.toISOString().slice(0, 10) };
  }
  return { raw: value, days_left: null, interpreted: 'Deadline supplied but not machine-parsed; verify manually', date: null };
}

function levelRank(level) {
  return { routine: 0, elevated: 1, high: 2, immediate: 3 }[level] ?? 0;
}

function maxLevel(a, b) {
  return levelRank(b) > levelRank(a) ? b : a;
}

function categoryFromText(text) {
  if (/cp2000|audit|exam|examination|underreported|proposed change/.test(text)) return 'audit_or_underreporter_notice';
  if (/levy|lien|garnish|collection|cp504|lt11|1058|payment plan|installment|9465|owe|balance/.test(text)) return 'tax_debt_or_collection';
  if (/unfiled|back return|missing return|sfr|nonfiler/.test(text)) return 'unfiled_or_prior_year_returns';
  if (/1040x|amend|amended/.test(text)) return 'amended_return';
  if (/1099|schedule c|gig|self-employed|business|payroll|sales tax|941|940|ubt/.test(text)) return 'self_employed_or_business_tax';
  if (/identity|5071|4883|id verification/.test(text)) return 'identity_verification';
  return 'general_tax_notice_or_question';
}

function reviewerFor({ level, category, amount, text }) {
  if (/fraud|criminal|summons|subpoena|court|tax court|trust fund|responsible person/.test(text)) return 'Tax attorney or EA/CPA with controversy experience before responding.';
  if (category === 'audit_or_underreporter_notice') return 'EA or CPA review recommended before responding.';
  if (category === 'self_employed_or_business_tax') return 'CPA, EA, or tax attorney depending on business/payroll/collection risk.';
  if (category === 'unfiled_or_prior_year_returns') return 'PTIN preparer, EA, or CPA review before return output or filing decisions.';
  if (amount >= 100000) return 'EA/CPA/tax attorney review recommended because the balance appears very high.';
  if (amount >= 25000 || ['high', 'immediate'].includes(level)) return 'EA or CPA review recommended before action.';
  if (category === 'amended_return') return 'PTIN preparer or CPA review before filing an amended return.';
  return 'AI can help organize facts, but professional review is needed before filing, signing, or responding.';
}

function buildTaxUrgencyTriage(input = {}) {
  const issue = cleanText(input.issue || input.description || input.problem || '', 1000);
  const agency = cleanText(input.agency || '', 80);
  const notice = cleanText(input.notice || input.notice_number || input.noticeType || '', 80);
  const deadline = parseDeadline(input.deadline || input.due_date || input.date || '');
  const amount = parseAmount(input.amount || input.balance || input.tax_due || '');
  const text = `${issue} ${agency} ${notice}`.toLowerCase();
  let level = 'routine';
  const reasons = [];
  const matched = [];
  for (const signal of URGENCY_KEYWORDS) {
    if (signal.words.some((word) => text.includes(word))) {
      level = maxLevel(level, signal.level);
      matched.push(signal.key);
      reasons.push(signal.reason);
    }
  }
  if (deadline.days_left !== null) {
    if (deadline.days_left < 0) { level = maxLevel(level, 'immediate'); reasons.push('The supplied deadline appears to have already passed. Verify immediately.'); }
    else if (deadline.days_left <= 3) { level = maxLevel(level, 'immediate'); reasons.push('The supplied deadline appears to be within 3 days.'); }
    else if (deadline.days_left <= 14) { level = maxLevel(level, 'high'); reasons.push('The supplied deadline appears to be within 14 days.'); }
    else if (deadline.days_left <= 30) { level = maxLevel(level, 'elevated'); reasons.push('The supplied deadline appears to be within 30 days.'); }
  }
  if (amount >= 100000) { level = maxLevel(level, 'high'); reasons.push('The balance appears very high.'); }
  else if (amount >= 25000) { level = maxLevel(level, 'elevated'); reasons.push('The balance appears substantial.'); }
  if (!reasons.length) reasons.push('No urgent keywords or short parsed deadline were detected, but the notice still needs careful review.');
  const category = categoryFromText(text);
  return {
    policy: TAX_URGENCY_TRIAGE_POLICY,
    input_summary: { agency, notice, issue, amount, deadline },
    urgency_level: level,
    category,
    matched_signals: matched,
    reasons: Array.from(new Set(reasons)),
    suggested_review: reviewerFor({ level, category, amount, text }),
    safe_next_steps: [
      'Do not ignore the notice, but do not panic or upload unredacted sensitive documents in the current pilot mode.',
      'Write down the agency, notice/letter number, tax year, notice date, response deadline, amount, and contact instructions from the notice.',
      'Use official IRS/NYS/NYC contact channels from the notice or agency website if you need to confirm authenticity.',
      'Start with no-file intake or redacted/sample documents only until production security approval is complete.',
      'Escalate to a qualified professional before signing, filing, mailing, calling about complex facts, or taking a tax position.'
    ],
    do_not_do: [
      'Do not share full SSNs/ITINs, bank account numbers, full tax returns, wage statements, or unredacted notices in pilot mode.',
      'Do not assume a deadline was extended unless the agency or qualified professional confirms it.',
      'Do not rely on this routing check as legal, tax, accounting, filing, or agency-response advice.'
    ],
    recommended_start_path: category === 'tax_debt_or_collection' ? '/tax-debt-payment-plan-help.html' : category === 'unfiled_or_prior_year_returns' ? '/back-taxes-unfiled-returns.html' : category === 'amended_return' ? '/amended-return-help.html' : category === 'self_employed_or_business_tax' ? '/self-employed-gig-worker-tax-help.html' : '/irs-notice-help.html'
  };
}

function buildTaxUrgencyTriageGuide() {
  return {
    policy: TAX_URGENCY_TRIAGE_POLICY,
    headline: 'Figure out how urgent your tax notice may be before you act.',
    safe_mode: 'Use this as a first-step organizer only. It helps decide whether to start with AI organization, PTIN preparer review, EA/CPA review, or tax attorney escalation.',
    urgency_lanes: [
      { level: 'immediate', label: 'Immediate review', examples: ['levy/garnishment/seizure', 'summons/court/fraud/criminal language', 'deadline today/tomorrow/within 3 days'], action: 'Escalate before responding. Use official contact channels and professional review.' },
      { level: 'high', label: 'High priority', examples: ['audit/exam/CP2000', 'identity verification', 'final notice or lien language', 'deadline within 14 days'], action: 'Organize facts now and request EA/CPA or attorney review where appropriate.' },
      { level: 'elevated', label: 'Elevated', examples: ['large balance', 'deadline within 30 days', 'unfiled/prior-year return issue', 'self-employed records'], action: 'Build a checklist and avoid missing documents before choosing review level.' },
      { level: 'routine', label: 'Normal organization', examples: ['general questions', 'early-stage notice', 'no short deadline supplied'], action: 'Use the free starting point, but verify everything before filing or responding.' }
    ],
    gather_first: ['Agency', 'Notice or letter number', 'Tax year', 'Notice date', 'Response deadline', 'Amount claimed due or proposed change', 'What the agency asks you to do', 'Whether you agree or disagree and why'],
    launch_guardrail: 'The triage tool does not enable real sensitive uploads or final official tax-form output.'
  };
}

module.exports = { TAX_URGENCY_TRIAGE_POLICY, buildTaxUrgencyTriage, buildTaxUrgencyTriageGuide };
