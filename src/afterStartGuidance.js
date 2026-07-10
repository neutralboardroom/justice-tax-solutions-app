function bool(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function clean(value, max = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN removed]')
    .replace(/\b\d{9}\b/g, '[9-digit ID removed]')
    .replace(/\b\d{8,17}\b/g, '[long number removed]')
    .trim()
    .slice(0, max);
}

function match(text, pattern) {
  return pattern.test(String(text || '').toLowerCase());
}

function recentCases(store, max = 10) {
  try {
    if (!store || typeof store.list !== 'function') return [];
    return store.list('cases').slice(0, max).map((c) => ({
      id: c.id,
      created_at: c.created_at,
      status: c.status,
      pathway: c.pathway,
      agency: c.agency,
      risk_level: c.risk_level,
      review_gate: c.review_gate,
      payment_status: c.payment_status || 'not_requested',
      release_status: c.release_status || 'not_released',
      document_count: Array.isArray(c.documents) ? c.documents.length : 0,
      next_staff_action: c.risk_level === 'high' || c.review_gate === 'professional_required'
        ? 'Review immediately and route to EA/CPA/tax attorney as appropriate.'
        : 'Confirm no sensitive document was submitted; send safe next-step checklist.'
    }));
  } catch {
    return [];
  }
}

function buildAfterYouStartGuide() {
  return {
    version: '0.1.56',
    title: 'What happens after you start',
    purpose: 'Give real users a calm, clear post-submit path without implying filing, representation, or final tax advice.',
    current_mode: 'Controlled real-user launch: no-file or redacted/sample-only starts; staff/professional review before action.',
    user_expectations: [
      'You can start by describing the problem in plain English and using the Safe Tax Summary Builder.',
      'Do not paste or upload real unredacted taxpayer documents, full SSNs, full EINs, bank details, transcripts, full returns, W-2s, 1099s, payroll files, or account-login information yet.',
      'The platform can organize the issue, identify missing facts, and suggest safer next steps, but it does not file, e-file, sign, submit, or guarantee results.',
      'A human or qualified professional may be required before you act, respond to an agency, make a payment-plan decision, or rely on a tax position.'
    ],
    after_submit_timeline: [
      { when: 'Immediately', user_sees: 'A plain-English issue summary, risk signals, missing items, and recommended next steps.', staff_action: 'Check that no sensitive or unredacted document was submitted.' },
      { when: 'Same business day or next business day during pilot', user_sees: 'A staff follow-up may ask for missing non-sensitive facts, a redacted/sample document, or a professional review decision.', staff_action: 'Classify the case and assign AI-only organization, PTIN, EA, CPA, tax attorney, or outside urgent referral lane.' },
      { when: 'Before paid work', user_sees: 'A quote/review level should be confirmed before any paid review. Government payments, taxes, penalties, and interest are separate.', staff_action: 'Confirm price, scope, professional availability, payment status, and what is not included.' },
      { when: 'Before filing/responding/signing', user_sees: 'A final action remains blocked until release gates, professional review, client verification, and official-form QA pass.', staff_action: 'Do not release final official forms or agency response instructions until all gates pass.' }
    ],
    user_should_prepare: [
      'Agency name: IRS, NYS, NYC, or other.',
      'Notice/problem type if known, such as CP2000, CP504, balance due, unfiled year, amended return, 1099/gig work, payroll/sales tax, or identity verification.',
      'Tax year or period involved.',
      'Approximate amount or range, without bank details.',
      'Deadline or date printed on the letter, if known.',
      'What you already tried and what worries you most.',
      'Whether you can later prepare a redacted/sample copy if staff asks for it.'
    ],
    immediate_professional_review_signals: [
      'Levy, garnishment, lien, seizure, revenue officer, summons, Tax Court, court, criminal, fraud, or same-day deadline language.',
      'Business payroll, sales tax, withholding, trust-fund, 941/940/NYS-45, corporation, or partnership issues.',
      'Large balances, repeated notices, prior defaulted payment plans, audit/exam appointments, identity theft, or missing many years of returns.',
      'Requests to sign, file, e-file, submit, authorize direct debit, or represent the user before an agency.'
    ],
    safe_links: [
      { label: 'Start free with no file', href: '/#start' },
      { label: 'Safe Tax Summary Builder', href: '/safe-tax-summary-builder.html' },
      { label: 'Document Safety Center', href: '/document-safety-center.html' },
      { label: 'Tax Urgency Triage', href: '/tax-urgency-triage.html' },
      { label: 'Review levels and pricing', href: '/pricing.html' }
    ],
    reminder: 'Justice Tax Solutions is independent and is not the IRS, New York State, NYC, or a law firm. No refund, debt reduction, payment plan, penalty relief, offer-in-compromise, audit result, or government outcome is guaranteed.'
  };
}

function buildPostSubmitExpectationCheck(body = {}) {
  const combined = [body.issue, body.agency, body.notice, body.deadline, body.amount, body.whatNext].map((v) => clean(v, 300)).join(' ').toLowerCase();
  const wantsFinalAction = match(combined, /e-?file|file for me|submit|send to irs|send to nys|send to nyc|sign|signature|direct debit|bank draft|final form|power of attorney|represent/);
  const urgentRaw = match(combined, /levy|garnish|garnishment|lien|seizure|summons|tax court|court|criminal|fraud|revenue officer|today|tomorrow|24 hours|48 hours|same day/);
  const urgencyNegated = match(combined, /no levy|not a levy|without levy|no garnishment|not garnished|no lien|not a lien|not urgent|deadline next month|due next month/);
  const urgent = urgentRaw && !urgencyNegated;
  const business = match(combined, /payroll|sales tax|trust fund|withholding|941|940|nys-45|corporation|partnership/);
  const sensitive = match(combined, /ssn|social security|itin|ein|bank account|routing|full return|transcript|w-2|1099|paystub|driver license|passport|unredacted/) || bool(body.plannedSensitiveUpload);
  const paidExpectation = match(combined, /paid|payment|pay for|checkout|stripe|charge|refund|attorney|lawyer|cpa|\bea\b|enrolled agent|ptin/);

  const lane = wantsFinalAction ? 'blocked_final_action'
    : urgent ? 'urgent_professional_review_first'
    : business ? 'professional_review_first'
    : sensitive ? 'remove_sensitive_details_before_starting'
    : paidExpectation ? 'quote_and_scope_confirmation_needed'
    : 'safe_no_file_follow_up';

  const next = [];
  if (wantsFinalAction) next.push('Do not file, sign, e-file, submit to an agency, authorize direct debit, or treat any output as final until release gates pass.');
  if (urgent) next.push('Ask for staff/professional review promptly and do not wait on AI-only self-service if a real deadline is near.');
  if (business) next.push('Use professional review first for payroll, sales-tax, trust-fund, corporation, partnership, or withholding issues.');
  if (sensitive) next.push('Remove private taxpayer identifiers and use no file or redacted/sample-only mode during the controlled launch.');
  if (paidExpectation) next.push('Confirm quote, review level, scope, and professional availability before paid work starts.');
  if (!next.length) next.push('Start with no file or a safe summary, then wait for the checklist and any staff follow-up before acting.');

  return {
    version: '0.1.56',
    lane,
    safe_for_controlled_real_user_start: lane === 'safe_no_file_follow_up',
    needs_staff_review_before_action: lane !== 'safe_no_file_follow_up',
    detected_signals: {
      final_action_request: wantsFinalAction,
      urgency_or_collection_signal: urgent,
      business_tax_signal: business,
      sensitive_data_signal: sensitive,
      paid_or_professional_expectation: paidExpectation
    },
    recommended_next_steps: next,
    message_to_user: lane === 'safe_no_file_follow_up'
      ? 'This looks appropriate for a controlled no-file start. Submit only safe summary facts, then wait for the next-step checklist.'
      : 'Pause before uploading, paying, signing, filing, or responding. Use staff/professional review first.',
    safe_follow_up_links: [
      { label: 'Build a safe summary', href: '/safe-tax-summary-builder.html' },
      { label: 'Check urgency', href: '/tax-urgency-triage.html' },
      { label: 'Document safety rules', href: '/document-safety-center.html' },
      { label: 'Review levels', href: '/pricing.html' }
    ]
  };
}

function buildFirstCaseFollowupBoard({ store } = {}) {
  const cases = recentCases(store, 12);
  return {
    version: '0.1.56',
    title: 'First-case follow-up board',
    purpose: 'Help staff follow real users safely after they start, without sending sensitive details by email or releasing final tax work too early.',
    current_case_count_seen_by_local_store: cases.length,
    recent_cases: cases,
    staff_follow_up_sla: [
      'Check new real-user starts at least once each business day during the first pilot cohort.',
      'If any sensitive/unredacted upload appears, do not process it as normal work; quarantine/delete according to the approved policy and ask for a redacted/sample version only after security review.',
      'Send only no-sensitive-detail emails. Tell the user to sign in or book a call rather than putting tax facts in email.',
      'Escalate urgency, collection, court, criminal, audit, payroll/sales-tax, trust-fund, and high-dollar issues before any self-service next step.',
      'Do not release final forms, agency responses, signatures, direct-debit instructions, or filing/e-file guidance until the release gates pass.'
    ],
    user_follow_up_templates: [
      { name: 'Safe start received', body: 'We received your starting summary. Please do not email or upload unredacted tax documents yet. Staff will review the safe summary and tell you what non-sensitive facts or redacted/sample items may be useful next.' },
      { name: 'Professional review needed', body: 'Your issue may require PTIN/EA/CPA/tax attorney review before you act. We will confirm the recommended review level, price/scope, and what is not included before paid work begins.' },
      { name: 'Urgent issue warning', body: 'Because your issue may involve a deadline, collection, court, criminal, or business-tax risk, do not wait for AI-only self-service. Consider contacting an appropriate tax professional immediately.' }
    ],
    go_no_go_for_next_20_users: {
      can_invite_next_cohort: cases.length < 20,
      must_review_before_next_cohort: [
        'Any sensitive upload attempts',
        'Any user confusion about IRS/NYS/NYC/law-firm independence',
        'Any user who thought AI-only output was a final filing or agency response',
        'Any unanswered urgent case or paid-review confusion'
      ]
    }
  };
}

module.exports = {
  buildAfterYouStartGuide,
  buildPostSubmitExpectationCheck,
  buildFirstCaseFollowupBoard
};
