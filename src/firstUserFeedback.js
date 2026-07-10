function bool(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function clean(value, max = 700) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN removed]')
    .replace(/\b\d{2}-?\d{7}\b/g, '[EIN-like number removed]')
    .replace(/\b\d{8,17}\b/g, '[long number removed]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone removed]')
    .trim()
    .slice(0, max);
}

function includesAny(text, words) {
  const t = String(text || '').toLowerCase();
  return words.some((word) => t.includes(word));
}

function listRecentFeedback(store, max = 25) {
  try {
    if (!store || typeof store.list !== 'function') return [];
    return store.list('first_user_feedback').slice(0, max).map((item) => ({
      id: item.id,
      created_at: item.created_at,
      lane: item.lane,
      page_or_step: item.page_or_step,
      user_type: item.user_type,
      confusion_level: item.confusion_level,
      sensitive_data_attempt: item.sensitive_data_attempt,
      urgent_or_high_risk_signal: item.urgent_or_high_risk_signal,
      payment_or_professional_confusion: item.payment_or_professional_confusion,
      next_staff_action: item.next_staff_action
    }));
  } catch {
    return [];
  }
}

function buildFirstUserFeedbackGuide() {
  return {
    version: '0.1.56',
    title: 'First-user feedback loop',
    purpose: 'Capture confusion, safety issues, and launch friction from invited real users before broad public launch.',
    user_message: 'After you try the safe start, summary builder, urgency triage, or review-level pages, tell us what was confusing without sharing private taxpayer information.',
    what_to_share: [
      'Which page or step confused you.',
      'Whether you understood not to upload or paste unredacted tax documents yet.',
      'Whether you knew what staff would do next.',
      'Whether review levels and pricing were clear.',
      'Whether you saw any wording that sounded like a promise, filing service, IRS/NYS/NYC service, or law firm.'
    ],
    do_not_share: [
      'SSNs, EINs, ITINs, bank or routing numbers, tax transcripts, full returns, W-2s, 1099s, payroll files, account login information, or unredacted notice text.',
      'Screenshots or documents with private taxpayer facts.',
      'Exact agency account numbers or full addresses.'
    ],
    staff_should_watch_for: [
      'A user thought the site was the IRS, New York State, NYC, or a law firm.',
      'A user believed AI-only output was final tax advice or a final agency response.',
      'A user expected to upload real documents despite the warnings.',
      'A user was confused by payment, professional review, deadlines, or after-start expectations.',
      'A user had levy, lien, garnishment, court, criminal, payroll/sales-tax, trust-fund, or same-day deadline signals.'
    ],
    launch_rule: 'Do not invite a larger public cohort until staff reviews feedback from the first 5 to 20 real users and fixes any repeated confusion or safety issue.'
  };
}

function buildFirstUserFeedbackRecord(body = {}) {
  const page = clean(body.page_or_step || body.page || body.step, 160) || 'Not specified';
  const whatWorked = clean(body.what_worked || body.worked, 900);
  const confusing = clean(body.what_was_confusing || body.confusing, 1000);
  const expectedNext = clean(body.expected_next_step || body.next, 900);
  const improvement = clean(body.suggested_improvement || body.improvement, 900);
  const userType = clean(body.user_type || body.role, 100) || 'first_user';
  const confusionLevel = clean(body.confusion_level || body.level, 60) || 'not_specified';
  const combined = [page, whatWorked, confusing, expectedNext, improvement, userType, confusionLevel].join(' ').toLowerCase();

  const sensitiveSignal = bool(body.sensitive_data_attempt) || includesAny(combined, ['ssn', 'social security', 'ein', 'itin', 'bank account', 'routing', 'full return', 'transcript', 'w-2', '1099', 'driver license', 'passport', 'unredacted', 'upload real']);
  const urgencySignal = bool(body.urgent_issue) || includesAny(combined, ['levy', 'garnish', 'garnishment', 'lien', 'seizure', 'summons', 'tax court', 'court', 'criminal', 'fraud', 'payroll', 'sales tax', 'trust fund', 'same day', 'today', 'tomorrow']);
  const paymentConfusion = bool(body.payment_confusion) || includesAny(combined, ['pay', 'payment', 'stripe', 'refund', 'checkout', 'charge', 'attorney', 'lawyer', 'cpa', 'ea', 'enrolled agent', 'ptin', 'professional']);
  const governmentConfusion = bool(body.government_confusion) || includesAny(combined, ['irs website', 'new york state website', 'nyc website', 'government site', 'law firm', 'lawyer service']);
  const finalActionConfusion = bool(body.final_action_confusion) || includesAny(combined, ['file for me', 'e-file', 'efile', 'submit to irs', 'submit to nys', 'submit to nyc', 'final form', 'sign for me', 'direct debit']);

  let lane = 'ordinary_launch_feedback';
  if (sensitiveSignal) lane = 'sensitive_data_safety_followup';
  if (urgencySignal) lane = 'urgent_or_high_risk_staff_review';
  if (paymentConfusion) lane = 'pricing_or_professional_scope_followup';
  if (governmentConfusion || finalActionConfusion) lane = 'trust_claim_or_final_action_copy_fix';

  const nextStaffAction = lane === 'ordinary_launch_feedback'
    ? 'Review during daily first-user feedback review; fix copy or UX only if repeated by more than one user.'
    : 'Review before inviting the next user cohort; update copy, routing, or staff SOP if the signal is confirmed.';

  return {
    version: '0.1.56',
    lane,
    page_or_step: page,
    user_type: userType,
    confusion_level: confusionLevel,
    what_worked: whatWorked,
    what_was_confusing: confusing,
    expected_next_step: expectedNext,
    suggested_improvement: improvement,
    sensitive_data_attempt: sensitiveSignal,
    urgent_or_high_risk_signal: urgencySignal,
    payment_or_professional_confusion: paymentConfusion,
    government_or_law_firm_confusion: governmentConfusion,
    final_action_confusion: finalActionConfusion,
    safe_to_continue_inviting_users: !(sensitiveSignal || urgencySignal || governmentConfusion || finalActionConfusion),
    next_staff_action: nextStaffAction,
    user_message: sensitiveSignal
      ? 'Thanks. Please do not send private tax data in feedback. Staff should review this before the next user cohort.'
      : 'Thanks. Your feedback was saved without private taxpayer details and will help improve the first-user launch.'
  };
}

function buildFirstUserFeedbackBoard({ store } = {}) {
  const recent = listRecentFeedback(store, 25);
  const blockers = recent.filter((item) => item.sensitive_data_attempt || item.urgent_or_high_risk_signal || item.payment_or_professional_confusion || item.lane === 'trust_claim_or_final_action_copy_fix');
  return {
    version: '0.1.56',
    title: 'First-user feedback board',
    purpose: 'Use this board before expanding from invited real users to broader public traffic.',
    recent_feedback_count: recent.length,
    blocker_or_review_items_count: blockers.length,
    can_invite_next_small_cohort: blockers.length === 0 && recent.length < 20,
    recent_feedback: recent,
    review_before_next_cohort: blockers,
    daily_staff_review_steps: [
      'Read every feedback item from the first 5 to 20 users.',
      'Fix repeated confusion before inviting a broader cohort.',
      'Pause invitations if users tried to upload sensitive data or believed the platform files, e-files, represents them, or guarantees results.',
      'Confirm the homepage, Safe Start, Safe Summary, Document Safety, After You Start, pricing, and review-level pages answer the confusion raised.',
      'Record go/no-go decision before increasing traffic.'
    ],
    public_launch_decision_rule: 'Move beyond invited pilot only after domain/SSL, email, Stripe, professionals, security/WISP, official form QA, e-file claims, and first-user feedback blockers are cleared.'
  };
}

module.exports = {
  buildFirstUserFeedbackGuide,
  buildFirstUserFeedbackRecord,
  buildFirstUserFeedbackBoard
};
