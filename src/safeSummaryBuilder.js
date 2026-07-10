function clean(value, max = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN removed]')
    .replace(/\b\d{9}\b/g, '[9-digit ID removed]')
    .replace(/\b\d{8,17}\b/g, '[long number removed]')
    .trim()
    .slice(0, max);
}

function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || value === 'on' || value === '1';
}

function includesAny(text, terms) {
  const normalized = String(text || '').toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function splitList(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map((item) => clean(item, 120))
    .filter(Boolean)
    .slice(0, 8);
}

function buildSafeTaxSummaryBuilderGuide() {
  return {
    version: '0.1.56',
    title: 'Safe tax summary builder',
    purpose: 'Help first public users create a useful tax-problem summary without posting real sensitive taxpayer data.',
    safe_summary_fields: [
      'Agency: IRS, NYS, NYC, or other tax agency.',
      'Notice or issue type without uploading the full unredacted notice.',
      'Tax year or period involved.',
      'Approximate amount or broad range, not bank details.',
      'Deadline/date printed on the notice, if known.',
      'What the user wants to understand next.',
      'Whether they have redacted documents available for later staff review.'
    ],
    never_include: [
      'Full SSN, ITIN, EIN, account transcript, IP PIN, bank account, routing number, or login credentials.',
      'Full unredacted IRS/NYS/NYC notice, tax return, W-2, 1099, payroll, sales-tax, or identity document.',
      'Signatures, direct-debit authorizations, or final agency submission instructions.',
      'A statement that the platform is filing, e-filing, representing the user, or guaranteeing a result.'
    ],
    staff_value: [
      'Gives staff enough facts to classify notice/debt/unfiled/amended/gig-worker/review cases.',
      'Reduces accidental sensitive-data entry during controlled public launch.',
      'Creates a checklist for what to gather before a paid or professional review.',
      'Flags urgent or high-risk cases before the user relies on self-service.'
    ]
  };
}

function buildSafeTaxSummary(body = {}) {
  const agency = clean(body.agency, 80) || 'Tax agency not specified';
  const issueType = clean(body.issueType, 160) || 'Tax issue not specified';
  const taxYear = clean(body.taxYear, 80) || 'Tax year/period not specified';
  const amount = clean(body.amount, 80) || 'Amount not specified';
  const deadline = clean(body.deadline, 120) || 'Deadline not specified';
  const mainConcern = clean(body.mainConcern, 900);
  const alreadyDone = splitList(body.alreadyDone);
  const questions = splitList(body.questions);
  const hasRedactedDocs = bool(body.hasRedactedDocs);
  const raw = [agency, issueType, taxYear, amount, deadline, mainConcern, alreadyDone.join(' '), questions.join(' ')].join(' ').toLowerCase();

  const urgencySignals = includesAny(raw, ['levy', 'garnish', 'garnishment', 'lien', 'seizure', 'seize', 'summons', 'court', 'tax court', 'criminal', 'fraud', 'warrant', 'today', 'tomorrow', '24 hours', '48 hours', 'same day', 'revenue officer']);
  const businessSignals = includesAny(raw, ['payroll', 'sales tax', 'trust fund', 'withholding', '941', '940', 'nys-45', 'corporation', 'partnership', 'business tax']);
  const finalActionSignals = includesAny(raw, ['file for me', 'e-file', 'efile', 'submit to irs', 'submit to nys', 'submit to nyc', 'sign form', 'direct debit', 'bank draft', 'final form']);
  const sensitiveSignals = includesAny(raw, ['ssn', 'social security', 'itin', 'ein', 'bank account', 'routing', 'w-2', '1099', 'transcript', 'ip pin', 'driver license', 'passport', 'full return']);

  let recommendedLane = 'safe_no_file_start';
  const flags = [];
  if (urgencySignals) { recommendedLane = 'staff_or_professional_review_first'; flags.push('Urgency, collection, court, criminal, or short-deadline language appears in the summary.'); }
  if (businessSignals) { recommendedLane = 'professional_review_first'; flags.push('Business, payroll, sales-tax, or trust-fund issue should not be AI-only.'); }
  if (finalActionSignals) { recommendedLane = 'blocked_for_final_action'; flags.push('Final filing, e-file, agency submission, direct-debit, or signature request is blocked until release gates pass.'); }
  if (sensitiveSignals) flags.push('Remove private taxpayer identifiers or document details before submitting.');
  if (!flags.length) flags.push('No obvious urgent, sensitive, or final-action blockers were detected from this short summary.');

  const sanitizedSummary = [
    `Agency: ${agency}`,
    `Issue: ${issueType}`,
    `Tax year/period: ${taxYear}`,
    `Approximate amount/range: ${amount}`,
    `Notice/deadline date: ${deadline}`,
    `Main concern: ${mainConcern || 'User wants help understanding what to do next.'}`,
    alreadyDone.length ? `Already tried: ${alreadyDone.join('; ')}` : 'Already tried: not provided',
    questions.length ? `Questions for review: ${questions.join('; ')}` : 'Questions for review: not provided',
    `Documents: ${hasRedactedDocs ? 'User says redacted/sample documents may be available later.' : 'No documents needed for the first safe start.'}`
  ].join('\n');

  return {
    version: '0.1.56',
    recommended_lane: recommendedLane,
    safe_to_submit_without_file: !sensitiveSignals && !finalActionSignals,
    can_use_redacted_sample_later: hasRedactedDocs && !finalActionSignals,
    sanitized_summary: sanitizedSummary,
    detected_flags: {
      urgency_signals: urgencySignals,
      business_high_risk: businessSignals,
      final_action_request: finalActionSignals,
      sensitive_data_signals: sensitiveSignals
    },
    review_guidance: flags,
    next_step: recommendedLane === 'safe_no_file_start'
      ? 'Submit this summary through the free start path with no file, then wait for the platform/staff checklist.'
      : 'Do not upload, sign, file, pay, or respond based only on this summary. Route to staff/professional review first.',
    safe_links: [
      { label: 'Start free with no file', href: '/#start' },
      { label: 'Document Safety Center', href: '/document-safety-center.html' },
      { label: 'Tax Urgency Triage', href: '/tax-urgency-triage.html' },
      { label: 'Review levels and pricing', href: '/pricing.html' }
    ],
    reminder: 'Justice Tax Solutions is independent and is not the IRS, New York State, NYC, or a law firm. This summary is not tax, accounting, or legal advice and does not calculate official deadlines.'
  };
}

function buildPublicLaunchFinalReadinessChecklist() {
  return {
    version: '0.1.56',
    title: 'Public launch final readiness checklist',
    owner_answer: 'The platform can invite real users only in controlled no-file/redacted-sample mode. Full public launch still requires external production setup and formal approvals.',
    complete_before_broad_public_launch: [
      { area: 'Domain/SSL', required: ['Deploy latest version', 'Confirm Render root and www domain verification', 'Confirm active HTTPS certificate', 'Set PUBLIC_BASE_URL to https://justicetaxsolutions.com', 'Smoke-test /health and key pages on the custom domain'] },
      { area: 'Email', required: ['Choose Resend/SendGrid/SMTP', 'Configure sender domain', 'Test verification/password reset/quote/appointment/staff notifications', 'Confirm no sensitive tax facts are sent in email bodies'] },
      { area: 'Payments', required: ['Create Stripe live products/prices', 'Configure webhook secret', 'Test checkout success/failure/refund', 'Confirm paid/unpaid status in staff view', 'Approve refund and chargeback SOP'] },
      { area: 'Professionals', required: ['Verify PTIN roster', 'Confirm EA/CPA/tax attorney scopes', 'Confirm New York preparer registration/NYTPRIN duties where applicable', 'Approve client disclosures and assignment rules'] },
      { area: 'Security/WISP', required: ['Managed production database', 'Private object storage', 'Malware scan/quarantine', 'Staff MFA/access controls', 'WISP approval', 'Retention/deletion policy', 'Incident response', 'Backup/restore test'] },
      { area: 'Official forms', required: ['Official source URL and checksum', 'Coordinate/field lock', 'Sample-filled PDF QA', 'Overflow/date/signature/direct-debit checks', 'Client verification', 'Professional signoff', 'Staff final release approval'] },
      { area: 'E-file/agency submission', required: ['Authorized e-file provider/EFIN path complete before any e-file claim', 'No agency-submission marketing until approvals and operations are complete'] }
    ],
    safe_public_now: [
      'Public pages explaining tax-problem help, pricing concepts, safety rules, review levels, and first-step intake.',
      'Free no-file or redacted/sample-only summaries for invited first users.',
      'Manual staff triage and professional-review request routing without final agency action claims.'
    ],
    keep_blocked: [
      'Real unredacted taxpayer document uploads.',
      'Final official IRS/NYS/NYC form output.',
      'E-file, filing, direct-debit, or agency-submission claims.',
      'Broad paid ads that imply tax relief guarantees or full production operations.'
    ]
  };
}

module.exports = { buildSafeTaxSummaryBuilderGuide, buildSafeTaxSummary, buildPublicLaunchFinalReadinessChecklist };
