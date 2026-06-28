const CUSTOMER_LANGUAGE_RULES = [
  'Use plain words before tax jargon. Say tax bill or tax letter before notice, and explain abbreviations like OIC only after the plain phrase.',
  'Tell the client what happens next in one or two steps. Avoid long internal workflow names in customer-facing screens.',
  'Separate free starting help from paid human review clearly before asking for payment.',
  'Never promise a refund, settlement, penalty removal, payment plan, audit result, or agency decision.',
  'Use calm language for urgent cases: flag the risk, then give a next step.',
  'Show the client what is missing and what has been received before asking them to buy review.',
  'Keep header and hero typography compact enough for mobile screens.',
  'Do not use official-looking government language, seals, or colors that imply IRS/NYS/NYC affiliation.'
];

const SIMPLE_START_OPTIONS = [
  {
    key: 'notice-help',
    label: 'I got a tax letter',
    clientWords: 'Upload or describe the letter so we can help identify the agency, deadline, amount, tax year, and next step.',
    firstStep: 'Upload a copy if you have it, or paste the notice number and deadline.',
    paidPath: 'Tax notice summary and action plan, then human tax review if needed.'
  },
  {
    key: 'tax-debt',
    label: 'I owe taxes or cannot pay',
    clientWords: 'We help organize what you owe, what years are involved, and whether a payment plan, hardship review, penalty review, or missing-return cleanup may be needed.',
    firstStep: 'Tell us the agency, balance, years, and any collection letters.',
    paidPath: 'Tax debt / notice human review.'
  },
  {
    key: 'return-help',
    label: 'I need to file or check a return',
    clientWords: 'We organize your documents and questions before a preparer or professional reviews anything that may be filed.',
    firstStep: 'List the tax year, income forms, dependents, and whether it is federal, New York, or NYC-related.',
    paidPath: 'Return organizer, simple return review, or professional review depending on complexity.'
  },
  {
    key: 'gig-worker',
    label: 'I am self-employed or a gig worker',
    clientWords: 'We help organize 1099 income, mileage, expenses, estimated taxes, and the documents a reviewer needs.',
    firstStep: 'List your platforms or business, income forms, mileage records, and major expenses.',
    paidPath: 'Self-employed / gig worker review.'
  }
];

const CLIENT_DASHBOARD_COPY = {
  headline: 'Your tax help dashboard',
  emptyState: 'You do not have a tax case yet. Start free so we can organize the issue and tell you what may be missing.',
  caseCardIntro: 'We organize your tax issue first. Human review, filing, or agency response comes only after the right documents and approvals are in place.',
  nextStepTitle: 'Next step',
  documentTitle: 'Documents',
  reviewTitle: 'Review status',
  referralTitle: 'Your referral tools'
};

function money(cents) {
  const n = Number(cents || 0);
  return `$${(n / 100).toFixed(n % 100 === 0 ? 0 : 2)}`;
}

function readablePathway(pathway = '') {
  const found = SIMPLE_START_OPTIONS.find((item) => item.key === pathway);
  if (found) return found.label;
  if (pathway === 'amended-prior-year') return 'I need prior-year or amended return help';
  if (pathway === 'not-sure') return 'I am not sure where to start';
  return String(pathway || 'Tax help').replace(/[-_]/g, ' ');
}

function safeList(items, fallback) {
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  return arr.length ? arr : [fallback].filter(Boolean);
}

function buildSimpleCaseStatus(taxCase = {}) {
  const docs = Array.isArray(taxCase.documents) ? taxCase.documents : [];
  const missing = safeList(taxCase.missing_items, 'We will confirm missing items after reviewing your issue and documents.');
  const nextSteps = safeList(taxCase.recommended_next_steps, 'Check your dashboard and upload any tax letters or income documents you have.');
  const blockers = [];
  if (!taxCase.email && !taxCase.user_id) blockers.push('Add an email so staff can follow up.');
  if (!docs.length && ['notice-help','tax-debt','gig-worker','return-help','amended-prior-year'].includes(taxCase.pathway)) blockers.push('Upload at least one notice, tax form, prior return, or supporting document when available.');
  if (!taxCase.client_done_uploading) blockers.push('Mark “Done uploading for now” when you have added what you have.');
  if (taxCase.payment_status !== 'paid' && String(taxCase.status || '').includes('paid')) blockers.push('Payment still needs confirmation before paid review can be released.');

  const progress = [
    { key: 'started', label: 'Started', done: true, clientText: 'Your case was created.' },
    { key: 'documents', label: 'Documents added', done: docs.length > 0, clientText: docs.length ? `${docs.length} upload(s) are attached.` : 'Upload copies when you are ready.' },
    { key: 'done_uploading', label: 'Ready for staff look', done: Boolean(taxCase.client_done_uploading), clientText: taxCase.client_done_uploading ? 'You marked that you are done uploading for now.' : 'Tell us when you are done uploading for now.' },
    { key: 'human_review', label: 'Human review', done: ['submitted_for_human_tax_review','paid_review_ready_for_assignment','released_to_client','completed'].includes(taxCase.status), clientText: taxCase.status === 'released_to_client' ? 'A reviewed summary is available.' : 'Human review starts after submission/payment when required.' },
    { key: 'release', label: 'Reviewed summary', done: Boolean(taxCase.released_at || taxCase.status === 'released_to_client'), clientText: taxCase.released_at ? 'Your reviewed summary has been released.' : 'No reviewed summary has been released yet.' }
  ];

  return {
    case_id: taxCase.id || '',
    title: readablePathway(taxCase.pathway),
    plain_status: simpleStatusLabel(taxCase),
    risk_level: taxCase.risk_level || 'medium',
    agency: taxCase.agency || 'to be confirmed',
    tax_years: taxCase.tax_years || taxCase.taxYears || '',
    selected_service: taxCase.service_fit && taxCase.service_fit.recommended_service ? taxCase.service_fit.recommended_service.label : (taxCase.review_plan && taxCase.review_plan.tier ? taxCase.review_plan.tier.label : 'Starting summary'),
    next_step: nextSteps[0],
    missing_items: missing.slice(0, 8),
    documents_received: docs.map((d) => ({ id: d.id, name: d.original_name || d.file_name || 'Uploaded document', type: d.classification && d.classification.label ? d.classification.label : 'Needs review', confidence: d.extraction_profile ? d.extraction_profile.confidence_label : '' })),
    blockers,
    progress,
    safe_message: 'Do not file, sign, or respond to a tax agency based only on an automated summary. Use the reviewed summary or a qualified tax professional for final action.',
    generated_at: new Date().toISOString()
  };
}

function simpleStatusLabel(taxCase = {}) {
  if (taxCase.status === 'released_to_client' || taxCase.released_at) return 'Reviewed summary available';
  if (taxCase.status === 'submitted_for_human_tax_review') return 'Waiting for human review';
  if (taxCase.payment_status === 'paid') return 'Paid review recorded';
  if (taxCase.client_done_uploading) return 'Ready for staff look';
  if ((taxCase.documents || []).length) return 'Documents received';
  return 'Started';
}

function buildCustomerExperienceReport({ store, version }) {
  const pages = ['index.html','dashboard.html','pricing.html','referral-program.html','referral-tools.html','security.html','how-it-works.html','signin.html','signup.html'];
  const cases = store ? store.list('cases', (c) => !c.deleted_at) : [];
  const issues = [];
  if (!cases.length) issues.push('No live sample cases in storage; use smoke tests or pilot data before public launch.');
  const paidCases = cases.filter((c) => c.payment_status === 'paid').length;
  const uploadedCases = cases.filter((c) => (c.documents || []).length).length;
  return {
    version,
    focus: 'Customer-facing polish, plain-language UX, live-client dashboard clarity, and low-friction start flow.',
    pages_reviewed: pages,
    language_rules: CUSTOMER_LANGUAGE_RULES,
    simple_start_options: SIMPLE_START_OPTIONS,
    dashboard_copy: CLIENT_DASHBOARD_COPY,
    pilot_metrics: { total_cases: cases.length, cases_with_uploads: uploadedCases, paid_cases: paidCases },
    remaining_polish: [
      'Replace demo/local storage with production PostgreSQL before real customer documents.',
      'Add real email notifications for client and staff next-step prompts.',
      'Add fully responsive QA screenshots before launch.',
      'Add live Stripe products and webhook testing before paid public release.',
      'Add a real OCR/document-AI provider before relying on extraction for staff productivity.',
      'Complete official form mapping QA before generating official tax forms.'
    ],
    issues_found: issues
  };
}

function prelaunchQualityChecklist() {
  return [
    { area: 'Brand and trust', item: 'Logo, favicon, colors, typography, and mobile header look professional and not government-like.', owner: 'Founder/staff', status: 'polished_baseline' },
    { area: 'Customer language', item: 'Homepage, dashboard, pricing, referral, and security pages use plain customer-facing wording.', owner: 'Founder/staff', status: 'polished_baseline' },
    { area: 'User flow', item: 'New users can start free without knowing a form number and existing users can see the next step quickly.', owner: 'Product', status: 'polished_baseline' },
    { area: 'Compliance', item: 'No guarantee language is visible before intake and payment.', owner: 'Operations/professional reviewer', status: 'in_place_needs_final_review' },
    { area: 'Payments', item: 'Stripe live mode, webhooks, products, refund rules, and receipt emails are configured.', owner: 'Operations', status: 'not_ready' },
    { area: 'Data security', item: 'PostgreSQL, private object storage, malware scanning, MFA, logs, and backups are active.', owner: 'Technical', status: 'not_ready' },
    { area: 'Professional review', item: 'PTIN/NYTPRIN/CPA/EA/attorney reviewer records and operating procedures are verified.', owner: 'Tax lead', status: 'not_ready' },
    { area: 'Official forms', item: 'IRS/NYS/NYC forms are uploaded, source-verified, field-mapped, calculation-tested, and professionally approved.', owner: 'Tax lead', status: 'not_ready' }
  ];
}

module.exports = {
  CUSTOMER_LANGUAGE_RULES,
  SIMPLE_START_OPTIONS,
  CLIENT_DASHBOARD_COPY,
  buildSimpleCaseStatus,
  buildCustomerExperienceReport,
  prelaunchQualityChecklist,
  readablePathway,
  money
};
