const LIVE_SERVICE_LEVELS = [
  {
    key: 'free_starting_point',
    label: 'Free Tax Starting Point',
    priceLabel: '$0',
    promise: 'Plain-English tax concern summary, risk flags, and missing-document checklist.',
    maxPublicPromise: 'Organizer only. No filing, signing, agency response, or tax position reliance.',
    beforePayment: ['Client contact info', 'Required acknowledgments', 'Basic facts and tax years'],
    releaseRequirements: ['No paid release; client may request review or upload more documents.']
  },
  {
    key: 'tax_notice_action_plan',
    label: 'Tax Notice Summary + Action Plan',
    priceLabel: '$49',
    promise: 'Human-reviewed notice summary, deadline/risk review, and next-step checklist.',
    maxPublicPromise: 'Does not include agency representation or return filing unless separately arranged.',
    beforePayment: ['Clear notice image/PDF/text', 'Tax year', 'Agency', 'Client contact info'],
    releaseRequirements: ['Payment recorded', 'Notice reviewed', 'No urgent representation blocker', 'Client approval for final summary']
  },
  {
    key: 'tax_debt_notice_review',
    label: 'Tax Debt / Notice Human Review',
    priceLabel: '$249',
    promise: 'Tax-debt triage, payment-plan/OIC/hardship screening, and professional review routing.',
    maxPublicPromise: 'No tax reduction, payment plan, penalty relief, OIC, lien/levy result, or agency outcome is guaranteed.',
    beforePayment: ['Notices or balance details', 'Tax years', 'Income/basic financial facts', 'Unfiled-year disclosure'],
    releaseRequirements: ['Payment recorded', 'Professional role matched', 'Compliance checklist complete', 'Client approval']
  },
  {
    key: 'return_organizer',
    label: 'Return Organizer',
    priceLabel: '$49',
    promise: 'Document checklist and return-readiness workpaper for a tax preparer/accountant.',
    maxPublicPromise: 'Not a filed return and not final tax advice.',
    beforePayment: ['W-2/1099/prior return inventory', 'Residency facts', 'Dependent/credit screening'],
    releaseRequirements: ['Organizer reviewed for completeness', 'Source-linked missing-item list visible']
  },
  {
    key: 'simple_return_review',
    label: 'Simple Return Human Review',
    priceLabel: '$149',
    promise: 'Human-reviewed simple return path for W-2/basic federal and NY issues.',
    maxPublicPromise: 'Filing requires PTIN/preparer workflow and client approval where applicable.',
    beforePayment: ['Tax documents uploaded', 'Filing status/dependent/residency facts', 'Client confirms no hidden income/problems'],
    releaseRequirements: ['Payment recorded', 'PTIN/preparer workflow assigned if return prep is for compensation', 'Client approval', 'No missing required source docs']
  },
  {
    key: 'gig_worker_review',
    label: 'Self-Employed / Gig Worker Review',
    priceLabel: '$199',
    promise: 'Schedule C/gig-worker organizer and human review for 1099/mileage/expense issues.',
    maxPublicPromise: 'Deduction categories and mileage require source verification and professional judgment.',
    beforePayment: ['1099s', 'Mileage/vehicle records', 'Expense categories', 'NY/NYC residency/business facts'],
    releaseRequirements: ['Payment recorded', 'Expense verification checklist complete', 'Professional/preparer review', 'Client approval']
  }
];

const LIVE_CLIENT_JOURNEY = [
  { step: 1, key: 'start', label: 'Start free', owner: 'client', description: 'Choose notice, tax debt, unfiled years, gig worker, or return help.' },
  { step: 2, key: 'acknowledge', label: 'Acknowledge limits', owner: 'client', description: 'Confirm not-government, no-guarantee, AI-limitations, document-upload, and non-emergency warnings.' },
  { step: 3, key: 'upload', label: 'Upload/capture facts', owner: 'client', description: 'Upload copies and answer plain-English questions without entering full SSNs or bank numbers in free text.' },
  { step: 4, key: 'triage', label: 'Navigator triage', owner: 'platform', description: 'Classify documents, extract suggested fields, build risk flags, missing-items list, and action plan.' },
  { step: 5, key: 'review_request', label: 'Request review', owner: 'client', description: 'Client marks uploads complete, submits for review, or requests paid review.' },
  { step: 6, key: 'payment', label: 'Payment / quote', owner: 'client/staff', description: 'Stripe or manual payment request records the selected service level.' },
  { step: 7, key: 'professional_review', label: 'Professional review', owner: 'staff/pro', description: 'PTIN/accountant/CPA/EA/tax-attorney role is assigned based on case type and risk.' },
  { step: 8, key: 'client_approval', label: 'Client approval', owner: 'client', description: 'Client reviews facts and confirms before final release or filing/agency-response workflow.' },
  { step: 9, key: 'release', label: 'Release safe output', owner: 'staff/pro', description: 'Release gate checks payment, compliance, client approval, professional readiness, and official-form limitations.' },
  { step: 10, key: 'follow_up', label: 'Follow-up', owner: 'platform/staff', description: 'Reminders for missing items, deadlines, payments, estimates, and future tax-year planning.' }
];

const OPERATING_POLICIES = [
  'Tax problems first; tax returns included but not positioned as unchecked automated filing.',
  'No final tax output is released until the relevant gate passes: client consent, payment if paid tier, document verification, professional assignment where required, and client approval.',
  'Urgent levy, garnishment, audit, criminal, same-day deadline, or agency-representation matters are escalated rather than sold as ordinary software help.',
  'AI output is organizer/support work. Field values must be source-linked and verified before they affect a return, notice response, or debt recommendation.',
  'Public claims must avoid refund guarantees, OIC guarantees, “pennies on the dollar” language, and government-affiliation confusion.'
];

function normalizeText(value = '') {
  return String(value || '').toLowerCase();
}

function problemSignals(taxCase = {}) {
  const text = [taxCase.pathway, taxCase.primary_concern, taxCase.description, taxCase.notice_text, taxCase.tax_years, taxCase.income_types, taxCase.state_city_issues, ...(taxCase.flags || []).map((f) => f.label || f.key || '')].join(' ').toLowerCase();
  return {
    hasNotice: /notice|letter|cp\d+|lt\d+|bill|irs|nys|nyc|department of finance/.test(text),
    hasDebt: /owe|debt|cannot pay|can't pay|payment plan|installment|lien|levy|garnish|seize|collection|oic|offer in compromise|penalt/.test(text),
    hasReturn: /return|1040|w-2|w2|1099|file|filing|dependent|credit|refund/.test(text),
    hasGig: /uber|lyft|doordash|instacart|gig|1099|schedule c|self[- ]?employed|contractor|mileage|expenses/.test(text),
    hasPriorYear: /prior|back year|unfiled|late|amend|1040-x|past year|did not file|haven't filed/.test(text),
    hasNY: /new york|nys|nyc|it-201|it-203|resident|nonresident|part-year|ubt|department of finance/.test(text),
    hasUrgent: /levy|garnish|seize|seizure|summons|criminal|fraud|audit tomorrow|deadline today|same day|lt11|1058|final notice/.test(text)
  };
}

function chooseServiceFit(taxCase = {}) {
  const signals = problemSignals(taxCase);
  const risk = String(taxCase.risk_level || '').toLowerCase();
  let key = 'return_organizer';
  let reason = 'The case needs organization and missing-document review before a more expensive service is selected.';
  if (signals.hasUrgent || (signals.hasDebt && risk === 'high')) {
    key = 'tax_debt_notice_review';
    reason = 'Collection/debt or urgent-risk language suggests human/professional review before any client action.';
  } else if (signals.hasNotice && !signals.hasReturn) {
    key = 'tax_notice_action_plan';
    reason = 'The main problem appears to be understanding and responding to a tax notice.';
  } else if (signals.hasGig) {
    key = 'gig_worker_review';
    reason = 'Self-employed/gig-worker facts usually need Schedule C, expense, mileage, and estimated-tax review.';
  } else if (signals.hasReturn && !signals.hasDebt && !signals.hasNotice) {
    key = 'simple_return_review';
    reason = 'The case appears mainly return-preparation/review focused.';
  } else if (signals.hasPriorYear || signals.hasNY) {
    key = signals.hasDebt ? 'tax_debt_notice_review' : 'return_organizer';
    reason = 'Prior-year or NY/NYS/NYC issues should start with an organizer and may need paid/professional review.';
  }
  const tier = LIVE_SERVICE_LEVELS.find((item) => item.key === key) || LIVE_SERVICE_LEVELS[0];
  return { recommended_service: tier, reason, signals, alternatives: LIVE_SERVICE_LEVELS.filter((item) => item.key !== tier.key).slice(0, 3) };
}

function buildNextQuestions(taxCase = {}) {
  const signals = problemSignals(taxCase);
  const questions = [];
  if (signals.hasNotice) {
    questions.push('What exact notice or letter number appears near the top of the letter?');
    questions.push('What deadline or response date appears on the notice?');
    questions.push('Does the notice show an amount due, proposed change, or missing document request?');
  }
  if (signals.hasDebt) {
    questions.push('Which tax years do you owe for, and approximately how much is due for each year?');
    questions.push('Have you received levy, lien, wage garnishment, bank levy, or final notice language?');
    questions.push('Are all required returns filed, or are any years still unfiled?');
  }
  if (signals.hasReturn || signals.hasGig) {
    questions.push('Do you have all W-2, 1099, 1095-A, 1098-T, brokerage, and prior-year return documents?');
    questions.push('Did you live or work in New York City, New York State, another state, or more than one state?');
  }
  if (signals.hasGig) {
    questions.push('Do you have mileage logs, vehicle expense records, platform annual summaries, and business-expense records?');
  }
  if (!questions.length) questions.push('What agency, tax year, deadline, and amount are involved, if any?');
  return questions.slice(0, 8).map((text, index) => ({ id: `question_${index + 1}`, text, status: 'open' }));
}

function buildClientJourney(taxCase = {}) {
  const fit = chooseServiceFit(taxCase);
  const blockers = [];
  const warnings = [];
  const documents = Array.isArray(taxCase.documents) ? taxCase.documents : [];
  if (!taxCase.email) blockers.push('Client email is missing.');
  if (!taxCase.client_consent || taxCase.consent_status !== 'accepted') blockers.push('Required acknowledgments are missing or not recorded.');
  if (documents.some((d) => d.ocr_required || (d.extraction_profile && d.extraction_profile.ocr_required))) warnings.push('One or more uploaded files may need OCR/manual document review.');
  if (fit.signals.hasUrgent) blockers.push('Urgent/collection language detected. Escalate before selling ordinary software-style help.');
  if (!taxCase.tax_years && (fit.signals.hasNotice || fit.signals.hasDebt || fit.signals.hasReturn)) warnings.push('Tax year is not clear.');
  const currentStep = taxCase.release_status === 'released_to_client' ? 9
    : taxCase.client_approval_status === 'approved' ? 8
    : taxCase.assigned_professional_id ? 7
    : String(taxCase.payment_status || '').includes('paid') ? 6
    : taxCase.review_request_id || String(taxCase.status || '').includes('review') ? 5
    : taxCase.client_done_uploading ? 4
    : documents.length ? 3
    : 2;
  return {
    current_step: currentStep,
    journey: LIVE_CLIENT_JOURNEY.map((step) => ({ ...step, status: step.step < currentStep ? 'complete' : (step.step === currentStep ? 'current' : 'upcoming') })),
    recommended_service_fit: fit,
    next_questions: buildNextQuestions(taxCase),
    blockers,
    warnings,
    client_message: blockers.length ? 'This case needs staff/professional attention before paid release.' : 'Continue uploads/checklist and request review when ready.',
    release_guardrail: 'Final output is blocked until payment/client approval/professional/compliance gates pass where required.'
  };
}

function buildIntakeQualityGate(body = {}, files = []) {
  const issues = [];
  const advisories = [];
  const email = String(body.email || '').trim();
  const description = String(body.description || '').trim();
  const noticeText = String(body.noticeText || '').trim();
  if (!email || !email.includes('@')) issues.push({ key: 'email', label: 'Valid email is required for follow-up.' });
  if (!description && !noticeText && !files.length) issues.push({ key: 'facts_or_docs', label: 'A short description, notice text, or upload is required.' });
  if (description.length > 0 && description.length < 20 && !files.length) advisories.push({ key: 'thin_description', label: 'Description is very short; staff will likely need follow-up.' });
  if (!String(body.taxYears || '').trim()) advisories.push({ key: 'tax_years', label: 'Tax year was not provided.' });
  if (files.some((f) => Number(f.size || 0) > 15 * 1024 * 1024)) advisories.push({ key: 'large_file', label: 'Large upload detected; production should scan and store in private object storage.' });
  return { ok: issues.length === 0, issues, advisories, score: Math.max(0, 100 - issues.length * 35 - advisories.length * 10) };
}

function buildStaffSlaBoard(cases = [], now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const rows = (cases || []).filter((c) => !c.deleted_at).map((c) => {
    const created = c.created_at ? new Date(c.created_at) : now;
    const ageHours = Math.max(0, Math.round((now - created) / (60 * 60 * 1000)));
    const journey = buildClientJourney(c);
    const priority = journey.blockers.length || c.risk_level === 'high' ? 'urgent' : (String(c.status || '').includes('review') || c.client_done_uploading ? 'review_next' : 'normal');
    const dueHours = priority === 'urgent' ? 4 : (priority === 'review_next' ? 24 : 48);
    const dueAt = new Date(created.getTime() + dueHours * 60 * 60 * 1000).toISOString();
    return {
      case_id: c.id,
      email: c.email || '',
      pathway: c.pathway || '',
      status: c.status || '',
      risk_level: c.risk_level || '',
      priority,
      age_hours: ageHours,
      due_at: dueAt,
      overdue: now.getTime() > new Date(dueAt).getTime(),
      next_staff_action: journey.blockers[0] || (c.client_done_uploading ? 'Verify uploaded documents and missing-item checklist.' : 'Review triage summary and request missing documents if needed.'),
      recommended_service_key: journey.recommended_service_fit.recommended_service.key,
      warnings: journey.warnings
    };
  });
  return {
    generated_at: now.toISOString(),
    counts: {
      total: rows.length,
      urgent: rows.filter((r) => r.priority === 'urgent').length,
      review_next: rows.filter((r) => r.priority === 'review_next').length,
      overdue: rows.filter((r) => r.overdue).length
    },
    rows: rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due_at || '').localeCompare(b.due_at || ''))
  };
}

function buildLaunchPolishAudit({ store = null, configuredVendors = [] } = {}) {
  const caseCount = store ? store.list('cases').length : 0;
  const pros = store ? store.list('professionals') : [];
  const verifiedPros = pros.filter((p) => p.verified_at || p.status === 'verified').length;
  return {
    version: '0.1.16',
    public_positioning: 'Tax problems first, returns included, human/professional review when it matters.',
    policies: OPERATING_POLICIES,
    live_user_gaps_reduced: [
      'Client journey is now explicit and endpoint-driven.',
      'Service fit is generated from issue signals instead of leaving the user to guess which product to buy.',
      'Staff SLA board highlights urgent, overdue, and ready-for-review cases.',
      'Intake quality gate catches missing contact/fact basics before a weak case enters paid review.',
      'Client checklist status updates and staff contact attempts are persisted for operating discipline.'
    ],
    current_counts: { cases: caseCount, professionals: pros.length, verified_professionals: verifiedPros, ai_vendors_configured: configuredVendors.length },
    still_required_before_public_live_payments: [
      'Live Stripe webhook and refund/chargeback procedure.',
      'Managed PostgreSQL adapter enabled, not just schema-ready JSON storage.',
      'Private object storage, malware scanning, and staff MFA/approval.',
      'Verified PTIN/NYTPRIN/professional reviewer roster and written operating procedures.',
      'Official form mappings and sample-fill QA before official form output.'
    ]
  };
}

module.exports = {
  LIVE_SERVICE_LEVELS,
  LIVE_CLIENT_JOURNEY,
  OPERATING_POLICIES,
  chooseServiceFit,
  buildNextQuestions,
  buildClientJourney,
  buildIntakeQualityGate,
  buildStaffSlaBoard,
  buildLaunchPolishAudit
};
