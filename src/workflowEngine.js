const TAX_PROBLEM_PLAYBOOKS = [
  {
    key: 'irs_notice_triage',
    label: 'IRS notice triage',
    triggers: ['notice-help', 'irs', 'cp14', 'cp2000', 'cp504', 'letter 1058', 'lt11', 'letter 12c'],
    urgency: 'medium-to-high',
    clientSteps: [
      'Upload every page of the IRS notice, including payment voucher, response deadline, and explanation pages.',
      'Add the tax year, amount shown, and whether you agree, disagree, or are not sure.',
      'Upload the tax return for that year if available plus W-2, 1099, and brokerage documents connected to the notice.'
    ],
    staffSteps: [
      'Confirm notice type, tax year, response deadline, balance/proposed change, and whether the notice is collection, audit, missing-information, or math/underreporter related.',
      'Compare the notice against uploaded return/income documents and create a source-linked issue list.',
      'Decide whether the client needs a return correction, notice response, payment-plan screen, or professional escalation.'
    ],
    reviewRule: 'Do not send a notice response or recommend payment without human/professional review of the complete notice and supporting documents.',
    output: 'Plain-English notice summary, urgency flags, missing document checklist, action-plan draft, and professional review recommendation.'
  },
  {
    key: 'tax_debt_resolution',
    label: 'Tax debt / cannot pay',
    triggers: ['tax-debt', 'cannot pay', 'owe', 'balance due', 'payment plan', 'installment', 'hardship', 'lien', 'levy', 'garnishment'],
    urgency: 'medium-to-urgent',
    clientSteps: [
      'Upload tax bills/notices for every agency and year involved.',
      'List unfiled years, current income, household expenses, bank balances, assets, and payment history.',
      'Tell us about liens, levies, garnishment, deadlines, or threats to seize refunds/wages/bank accounts.'
    ],
    staffSteps: [
      'Confirm filing compliance before relief screening because many debt options require missing returns to be filed first.',
      'Prepare a debt-option screen for installment agreement, hardship/currently-not-collectible, penalty relief, and offer-in-compromise prequalification.',
      'Escalate lien, levy, garnishment, or active collection deadlines to CPA/EA/tax attorney review.'
    ],
    reviewRule: 'No tax-debt reduction, payment-plan approval, penalty relief, or OIC acceptance can be promised.',
    output: 'Tax debt risk summary, filing-compliance checklist, payment/relief option screen, and escalation recommendation.'
  },
  {
    key: 'unfiled_prior_years',
    label: 'Unfiled or prior-year returns',
    triggers: ['unfiled', 'back taxes', 'not filed', 'prior year', 'late return', 'amended-prior-year'],
    urgency: 'medium',
    clientSteps: [
      'List every year that may be missing or wrong.',
      'Upload any prior returns, IRS/NYS transcripts if available, W-2s, 1099s, and agency notices.',
      'Identify years with self-employment, unemployment, investment sales, marketplace health insurance, or dependents.'
    ],
    staffSteps: [
      'Build year-by-year filing status, income-source, and document completeness table.',
      'Prioritize years with agency notices, collection risk, or refund statute deadlines.',
      'Route return preparation to PTIN preparer/accountant and tax-debt issues to resolution review.'
    ],
    reviewRule: 'Each tax year must be separately reviewed because form versions, thresholds, credits, and filing rules change by year.',
    output: 'Year-by-year catch-up plan, document gaps, return-prep queue, and debt/notice cross-reference.'
  },
  {
    key: 'gig_worker_return',
    label: 'Self-employed / gig worker taxes',
    triggers: ['gig-worker', '1099', 'uber', 'lyft', 'doordash', 'schedule c', 'mileage', 'contractor'],
    urgency: 'standard-to-medium',
    clientSteps: [
      'Upload 1099-NEC, 1099-K, app annual summaries, mileage logs, and business expense records.',
      'Separate personal and business expenses and identify vehicle, phone, insurance, supplies, fees, and home-office items.',
      'Tell us whether quarterly estimated taxes were paid.'
    ],
    staffSteps: [
      'Build Schedule C organizer from source documents and flag missing business records.',
      'Check for Schedule SE/self-employment tax, estimated-tax exposure, and New York resident/nonresident issues.',
      'Require preparer/accountant review before any return is filed or signed.'
    ],
    reviewRule: 'Expense categories and mileage require verification; no deduction should be accepted only from AI extraction.',
    output: 'Gig-worker tax organizer, source-linked expense checklist, estimated-tax warning, and return-review tier recommendation.'
  },
  {
    key: 'ny_nyc_tax_issue',
    label: 'New York State / NYC tax issue',
    triggers: ['new york', 'nys', 'nyc', 'department of finance', 'it-201', 'it-203', 'ubt', 'commercial rent tax', 'sales tax'],
    urgency: 'medium',
    clientSteps: [
      'Upload NYS/NYC notices and identify full-year, part-year, or nonresident status for each year.',
      'Provide address/residency dates, W-2 state wages, business location, and NYC/Yonkers details if relevant.',
      'For business taxes, upload entity records, sales/payroll/UBT/CRT filings, and bookkeeping summaries.'
    ],
    staffSteps: [
      'Separate federal, NYS, and NYC issues because deadlines, forms, and agencies differ.',
      'Confirm residency and local tax questions before building the return or response path.',
      'Escalate business tax, sales tax, payroll tax, UBT, CRT, or NYC DOF collections to experienced reviewer.'
    ],
    reviewRule: 'NYS/NYC forms and notices must be source-verified and tax-year-specific before client release.',
    output: 'NY/NYS/NYC issue map, local-form checklist, notice/action path, and professional-review recommendation.'
  },
  {
    key: 'simple_return_with_review',
    label: 'Tax return preparation/review',
    triggers: ['return-help', '1040', 'w-2', 'w2', 'dependent', 'child tax credit', 'education credit', '1095-a'],
    urgency: 'standard',
    clientSteps: [
      'Upload W-2s, 1099s, 1095-A, 1098-T, prior-year return, dependent details, and state/local documents.',
      'Answer filing status, dependent, residency, income, deduction, credit, and bank/direct-deposit questions.',
      'Review the missing-document checklist before requesting paid review.'
    ],
    staffSteps: [
      'Confirm document completeness and source-to-field mapping before return preparation.',
      'Route to PTIN preparer/accountant review and require client approval before release/filing.',
      'Use official form package/mapping status before generating any official PDF output.'
    ],
    reviewRule: 'Paid return preparation must use PTIN/professional workflow and client approval before filing or release.',
    output: 'Return organizer, draft source map, missing-document checklist, and preparer-review queue.'
  }
];

const TOMORROW_FORM_UPLOAD_CHECKLIST = {
  title: 'Official form upload checklist for the next build pass',
  purpose: 'Prepare IRS, New York State, and NYC official forms/instructions so the platform can catalog, source-check, and map them without mixing unofficial or outdated files into client workflows.',
  rules: [
    'Prefer one agency per ZIP: IRS, NYS, or NYC.',
    'Keep official filenames from irs.gov, tax.ny.gov, or nyc.gov whenever possible.',
    'Include instruction PDFs with each form when available.',
    'Use tax-year folders if a ZIP contains multiple years, such as 2025/IRS/1040/f1040.pdf.',
    'Do not mix random third-party PDFs with official forms unless they are clearly placed in a separate reference folder.',
    'Tell the next build the agency, tax year, source URL, and whether the ZIP is current-year, prior-year, or mixed.',
    'Upload smaller focused ZIPs first so mapping and QA can proceed form family by form family.'
  ],
  firstWave: [
    { agency: 'IRS', forms: ['9465', '433-F', '433-A', '433-B', '656', '2848', '8821', '1040-X', '4868'], reason: 'Tax-problem/debt workflows first.' },
    { agency: 'IRS', forms: ['1040', '1040-SR', 'Schedule 1', 'Schedule 2', 'Schedule 3', 'Schedule C', 'Schedule SE', '8812', '8863', '8962'], reason: 'Return help and gig-worker organizer.' },
    { agency: 'NYS', forms: ['IT-201', 'IT-203', 'IT-2', 'IT-196', 'IT-201-X', 'IT-203-X', 'IT-370', 'IT-2105'], reason: 'New York resident/nonresident and amended/extension basics.' },
    { agency: 'NYC', forms: ['NYC-202', 'NYC-202S', 'NYC-204', 'NYC-204EZ', 'NYC-221', 'NYC-EXT'], reason: 'NYC freelancer/business tax issue support.' }
  ],
  qaBeforeUse: [
    'Verify source domain and tax year/edition date.',
    'Extract fillable PDF field names where available.',
    'Create source-to-question map and source-to-PDF-field map.',
    'Run sample-fill tests for every mapped form.',
    'Check overflow, dates, checkboxes, repeated sections, signatures, preparer fields, and official-only areas.',
    'Require professional review before using any mapped form for client-facing tax output.'
  ]
};

function normalizedHaystack(taxCase = {}) {
  return [taxCase.pathway, taxCase.primary_concern, taxCase.description, taxCase.notice_text, taxCase.tax_years, taxCase.income_types, taxCase.state_city_issues, taxCase.agency, ...(taxCase.flags || []).map((f) => `${f.key} ${f.label}`)].join(' ').toLowerCase();
}

function matchedPlaybooks(taxCase = {}) {
  const haystack = normalizedHaystack(taxCase);
  const pathway = String(taxCase.pathway || '').toLowerCase();
  const matches = TAX_PROBLEM_PLAYBOOKS.filter((playbook) => playbook.triggers.some((trigger) => pathway.includes(trigger) || haystack.includes(trigger)));
  if (matches.length) return matches;
  return [TAX_PROBLEM_PLAYBOOKS.find((p) => p.key === 'simple_return_with_review') || TAX_PROBLEM_PLAYBOOKS[0]];
}

function buildClientChecklist(taxCase = {}) {
  const playbooks = matchedPlaybooks(taxCase);
  const base = [
    'Confirm your name, email, tax year(s), agency, and primary concern.',
    'Upload clear copies of all tax notices and tax documents connected to the issue.',
    'Do not enter full SSNs, bank numbers, or private identifiers into free-text boxes.'
  ];
  const items = [...base, ...(taxCase.missing_items || []), ...playbooks.flatMap((p) => p.clientSteps || [])];
  return Array.from(new Set(items)).map((text, index) => ({ id: `client_${index + 1}`, text, status: 'open', source: index < base.length ? 'standard' : 'playbook' }));
}

function buildStaffTasks(taxCase = {}) {
  const playbooks = matchedPlaybooks(taxCase);
  const tasks = [];
  tasks.push({ key: 'triage', label: 'Triage case and confirm agency/year/deadline/risk level', lane: 'triage', priority: taxCase.risk_level === 'high' ? 'urgent' : 'normal' });
  if ((taxCase.documents || []).length) tasks.push({ key: 'document_review', label: 'Review document classifications and extraction confidence', lane: 'documents', priority: 'normal' });
  if (taxCase.client_done_uploading) tasks.push({ key: 'done_uploading_review', label: 'Client marked done uploading; verify missing-item checklist before review', lane: 'documents', priority: 'normal' });
  if (taxCase.review_request_id || String(taxCase.status || '').includes('review')) tasks.push({ key: 'review_assignment', label: 'Assign PTIN/accountant/CPA/EA/tax attorney reviewer as appropriate', lane: 'review', priority: 'normal' });
  if (taxCase.payment_status === 'paid') tasks.push({ key: 'paid_case_release_gate', label: 'Check client approval, compliance checklist, and reviewer readiness before release', lane: 'release', priority: 'normal' });
  for (const playbook of playbooks) {
    for (const [idx, step] of (playbook.staffSteps || []).entries()) tasks.push({ key: `${playbook.key}_${idx + 1}`, label: step, lane: playbook.key, priority: playbook.urgency && playbook.urgency.includes('urgent') ? 'urgent' : 'normal' });
  }
  return tasks.map((task, index) => ({ id: `task_${index + 1}`, status: 'open', ...task }));
}

function buildCaseActionPlan(taxCase = {}) {
  const playbooks = matchedPlaybooks(taxCase);
  const clientChecklist = buildClientChecklist(taxCase);
  const staffTasks = buildStaffTasks(taxCase);
  const risk = taxCase.risk_level || 'needs review';
  const firstPlaybook = playbooks[0] || TAX_PROBLEM_PLAYBOOKS[0];
  return {
    version: '0.1.8',
    case_id: taxCase.id || '',
    headline: `${firstPlaybook.label}: action plan`,
    risk_level: risk,
    matched_playbooks: playbooks.map((p) => ({ key: p.key, label: p.label, urgency: p.urgency, reviewRule: p.reviewRule, output: p.output })),
    client_checklist: clientChecklist,
    staff_tasks: staffTasks,
    next_safe_step: risk === 'high' ? 'Do not respond, pay, sign, or file until a human/professional reviewer checks the case.' : 'Complete uploads/checklist, then submit for human tax review if the issue is not simple.',
    release_rule: 'No official tax form, agency response, tax-debt recommendation, or filing output should be released until payment/client approval/professional compliance gates pass where required.',
    form_upload_dependency: 'Official form ZIPs can be uploaded tomorrow. Until form mapping is verified, official forms remain catalog/mapping assets only.'
  };
}

function mergeTaskBoard({ cases = [], manualTasks = [] } = {}) {
  const generated = [];
  for (const c of cases) {
    for (const task of buildStaffTasks(c)) generated.push({ ...task, case_id: c.id, case_status: c.status, pathway: c.pathway, risk_level: c.risk_level, generated: true });
  }
  const manual = (manualTasks || []).filter((t) => !t.deleted_at).map((t) => ({ ...t, generated: false }));
  const lanes = ['triage', 'documents', 'review', 'release', 'irs_notice_triage', 'tax_debt_resolution', 'unfiled_prior_years', 'gig_worker_return', 'ny_nyc_tax_issue', 'simple_return_with_review', 'manual'];
  return lanes.map((lane) => ({ lane, tasks: [...manual, ...generated].filter((task) => String(task.lane || 'manual') === lane) }));
}

module.exports = { TAX_PROBLEM_PLAYBOOKS, TOMORROW_FORM_UPLOAD_CHECKLIST, matchedPlaybooks, buildCaseActionPlan, buildClientChecklist, buildStaffTasks, mergeTaskBoard };
