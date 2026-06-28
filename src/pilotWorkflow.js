const STATUS_LABELS = {
  started: 'Started — we received your tax concern.',
  client_done_uploading_ready_for_triage: 'Ready for staff look — you marked that uploads are done for now.',
  submitted_for_human_tax_review: 'Waiting for human tax review.',
  payment_requested_for_review: 'Paid review requested — payment still needs confirmation.',
  paid_review_ready_for_assignment: 'Paid review recorded — ready for reviewer assignment.',
  assigned_for_professional_review: 'Assigned for professional review.',
  under_human_tax_review: 'Under human tax review.',
  released_to_client: 'Reviewed summary available.'
};

const CUSTOMER_STATUS_MESSAGES = [
  {
    key: 'received',
    trigger: (c) => Boolean(c.id),
    message: 'We received your tax concern and created a starting summary.'
  },
  {
    key: 'notice_calm',
    trigger: (c) => ['notice-help', 'tax-debt'].includes(String(c.pathway || '')),
    message: 'Do not ignore a tax notice, but do not panic. The next safe step is to identify the agency, deadline, year, and amount before anyone responds.'
  },
  {
    key: 'sample_upload_only',
    trigger: (c) => String(c.upload_policy_status || '').includes('redacted') || String(c.upload_mode || '').includes('redacted'),
    message: 'Your upload was treated as redacted/sample material for demo or private-pilot testing. Real sensitive tax documents remain blocked until production gates are complete.'
  },
  {
    key: 'human_review_required',
    trigger: (c) => c.risk_level === 'high' || String(c.review_gate || '').includes('review') || String(c.status || '').includes('review'),
    message: 'A human tax review is needed before anything is filed, signed, sent to the IRS/NYS/NYC, or used for a tax-debt decision.'
  },
  {
    key: 'missing_information',
    trigger: (c) => (c.missing_items || []).length > 0,
    message: 'The dashboard shows items that may still be missing. Staff or a professional reviewer will confirm what is actually required.'
  },
  {
    key: 'release_guardrail',
    trigger: () => true,
    message: 'No automated summary is a final tax filing, legal advice, payment-plan recommendation, or agency response.'
  }
];

const STAFF_REVIEW_STATUSES = [
  { key: 'intake_received', label: 'Intake received', plain: 'New case needs basic triage: agency, tax year, deadline, pathway, and risk level.' },
  { key: 'document_sample_review', label: 'Document/sample review', plain: 'Uploaded files or client-done-uploading status need document classification and source check.' },
  { key: 'missing_information_needed', label: 'Missing information needed', plain: 'Client likely needs a follow-up question, missing document request, or clearer tax-year/agency facts.' },
  { key: 'preparer_or_pro_review_needed', label: 'Preparer/professional review needed', plain: 'Route to PTIN preparer, accountant/bookkeeper, CPA, EA, or tax attorney based on risk and service fit.' },
  { key: 'client_approval_needed', label: 'Client approval needed', plain: 'Client must approve facts/no-guarantee/release before any reviewed output is delivered.' },
  { key: 'ready_to_release_or_blocked', label: 'Ready to release / blocked', plain: 'Check payment, compliance checklist, professional verification, and release gate.' }
];

const DEMO_CASE_TEMPLATES = [
  {
    id: 'demo_notice_cp2000',
    pathway: 'notice-help',
    primary_concern: 'IRS CP2000-style underreported income notice',
    description: 'Demo case: taxpayer received a proposed balance notice for 1099 income that may already be reported on a Schedule C.',
    notice_text: 'IRS notice says proposed amount due and response deadline. This is fake demo data.',
    tax_years: '2024',
    income_types: 'W-2, 1099-NEC',
    state_city_issues: 'New York resident',
    status: 'client_done_uploading_ready_for_triage',
    client_done_uploading: true,
    payment_status: '',
    risk_level: 'high',
    agency: 'IRS',
    document_count: 1,
    documents: [{ id: 'demo_doc_notice', original_name: 'DEMO-redacted-IRS-notice.pdf', size_bytes: 120000, mime_type: 'application/pdf', classification: { label: 'IRS notice or letter' }, extraction_confidence_score: 62, extraction_confidence_label: 'medium', extracted_fields: [], ocr_required: false }]
  },
  {
    id: 'demo_tax_debt_installment',
    pathway: 'tax-debt',
    primary_concern: 'Cannot pay IRS/NYS balances',
    description: 'Demo case: client owes federal and New York balances and wants to understand payment-plan or hardship options without overpromising relief.',
    notice_text: 'No real notice. Demo balance notes only.',
    tax_years: '2022, 2023, 2024',
    income_types: 'Self-employment and W-2',
    state_city_issues: 'NYS balance and possible NYC issue',
    status: 'submitted_for_human_tax_review',
    client_done_uploading: true,
    payment_status: 'requested_not_paid',
    risk_level: 'high',
    agency: 'IRS/NYS',
    document_count: 0,
    documents: []
  },
  {
    id: 'demo_gig_worker_return',
    pathway: 'gig-worker',
    primary_concern: 'Uber/Lyft/1099 Schedule C return review',
    description: 'Demo case: gig worker needs help organizing 1099 income, mileage, expenses, and estimated-tax issues before preparer review.',
    notice_text: '',
    tax_years: '2025',
    income_types: '1099-K, 1099-NEC, app summaries, mileage log',
    state_city_issues: 'NY resident, possible NYC local tax question',
    status: 'started',
    client_done_uploading: false,
    payment_status: '',
    risk_level: 'medium',
    agency: 'IRS/NYS',
    document_count: 0,
    documents: []
  },
  {
    id: 'demo_simple_return_review',
    pathway: 'return-help',
    primary_concern: 'Prepare or review a current-year return',
    description: 'Demo case: W-2 employee with dependents wants a preparer review before filing.',
    notice_text: '',
    tax_years: '2025',
    income_types: 'W-2, 1098-T, dependent info',
    state_city_issues: 'NYS resident',
    status: 'payment_requested_for_review',
    client_done_uploading: true,
    payment_status: 'requested_not_paid',
    risk_level: 'medium',
    agency: 'IRS/NYS',
    document_count: 0,
    documents: []
  }
];

function compactList(items = [], fallback = '') {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  return list.length ? list : (fallback ? [fallback] : []);
}

function caseStatusLabel(taxCase = {}) {
  if (taxCase.status && STATUS_LABELS[taxCase.status]) return STATUS_LABELS[taxCase.status];
  if (taxCase.release_status === 'released_to_client' || taxCase.released_at) return STATUS_LABELS.released_to_client;
  if (taxCase.assigned_professional_id) return STATUS_LABELS.assigned_for_professional_review;
  if (taxCase.payment_status === 'paid') return STATUS_LABELS.paid_review_ready_for_assignment;
  if (taxCase.client_done_uploading) return STATUS_LABELS.client_done_uploading_ready_for_triage;
  if ((taxCase.documents || []).length) return 'Documents received — staff can classify and verify sources.';
  return STATUS_LABELS.started;
}

function buildCustomerStatusCopy(taxCase = {}) {
  const missing = compactList(taxCase.missing_items, 'Staff will confirm missing items after review.').slice(0, 8);
  const nextSteps = compactList(taxCase.recommended_next_steps, 'Upload or describe any tax notice, tax form, or prior return that connects to this issue.').slice(0, 6);
  const messages = CUSTOMER_STATUS_MESSAGES.filter((item) => {
    try { return item.trigger(taxCase); } catch { return false; }
  }).map((item) => ({ key: item.key, message: item.message }));
  const clientNext = taxCase.client_done_uploading
    ? 'Watch for a staff/professional follow-up or choose a review option if you are ready.'
    : 'Add what you have, then tap Done uploading for now so staff knows the file is ready to look at.';
  return {
    case_id: taxCase.id || '',
    label: caseStatusLabel(taxCase),
    short_message: messages[0] ? messages[0].message : 'We received your starting information.',
    calm_message: messages.find((m) => m.key === 'notice_calm')?.message || 'We will organize the facts first and show the next safe step.',
    next_customer_action: clientNext,
    missing_items: missing,
    recommended_next_steps: nextSteps,
    safe_to_do_now: [
      'Save the tax letter or notice envelope if you have one.',
      'Write down the deadline, tax year, agency, and amount shown.',
      'Upload redacted/sample documents only unless production secure upload is enabled.',
      'Ask for human review before filing, signing, paying, or responding.'
    ],
    messages,
    release_guardrail: 'Reviewed output is released only after the required payment, professional/reviewer checks, client approval, and compliance gate are complete.'
  };
}

function staffLaneForCase(taxCase = {}) {
  if (taxCase.release_status === 'released_to_client' || taxCase.status === 'released_to_client') return 'ready_to_release_or_blocked';
  if (taxCase.payment_status === 'paid' || taxCase.client_final_approval_at) return 'ready_to_release_or_blocked';
  if (taxCase.assigned_professional_id || taxCase.status === 'submitted_for_human_tax_review' || taxCase.risk_level === 'high' || String(taxCase.status || '').includes('review')) return 'preparer_or_pro_review_needed';
  if ((taxCase.missing_items || []).length || !(taxCase.documents || []).length) return 'missing_information_needed';
  if ((taxCase.documents || []).length || taxCase.client_done_uploading) return 'document_sample_review';
  return 'intake_received';
}

function nextStaffAction(taxCase = {}) {
  const lane = staffLaneForCase(taxCase);
  if (lane === 'document_sample_review') return 'Classify uploaded files, check extraction confidence, and ask for missing documents if needed.';
  if (lane === 'missing_information_needed') return 'Send a plain-language missing-info request and keep the case out of release lanes.';
  if (lane === 'preparer_or_pro_review_needed') return 'Assign the right reviewer: PTIN preparer for return prep, CPA/EA for tax debt/notice, tax attorney for legal-risk matters.';
  if (lane === 'ready_to_release_or_blocked') return 'Run payment, client approval, credential, compliance, and release-gate checks before any release.';
  return 'Confirm agency, tax year, deadline, pathway, risk level, and service fit.';
}

function buildStaffWorkflowBoard({ store } = {}) {
  const cases = store && store.list ? store.list('cases', (c) => !c.deleted_at).slice(0, 300) : [];
  const lanes = STAFF_REVIEW_STATUSES.map((lane) => ({ ...lane, cases: [] }));
  for (const taxCase of cases) {
    const laneKey = staffLaneForCase(taxCase);
    const lane = lanes.find((entry) => entry.key === laneKey) || lanes[0];
    lane.cases.push({
      case_id: taxCase.id,
      email: taxCase.email || '',
      pathway: taxCase.pathway || '',
      risk_level: taxCase.risk_level || 'medium',
      status: taxCase.status || 'started',
      payment_status: taxCase.payment_status || '',
      assigned_professional_id: taxCase.assigned_professional_id || '',
      document_count: taxCase.document_count || (taxCase.documents || []).length || 0,
      next_staff_action: nextStaffAction(taxCase),
      customer_status: buildCustomerStatusCopy(taxCase).label,
      created_at: taxCase.created_at || ''
    });
  }
  const totals = Object.fromEntries(lanes.map((lane) => [lane.key, lane.cases.length]));
  return {
    version: '0.1.16',
    title: 'Production workflow board',
    plain: 'Cases are grouped by the next safe operational action rather than by internal code status alone.',
    totals,
    lanes,
    rules: [
      'No release before payment/client approval/compliance/professional gates where required.',
      'High-risk, tax-debt, legal-risk, and agency-response matters require qualified reviewer routing.',
      'Document extraction is source-linked evidence support only and never a filing decision by itself.'
    ]
  };
}

function buildUploadSafetyGuide(policy = {}) {
  const liveEnabled = Boolean(policy.accept_live_sensitive_documents);
  return {
    version: '0.1.16',
    title: liveEnabled ? 'Live sensitive upload gates appear enabled' : 'Redacted/sample uploads only until production gates pass',
    live_sensitive_documents_allowed: liveEnabled,
    current_policy: policy.policy || '',
    explain_to_customer: liveEnabled
      ? 'Secure document upload is marked enabled, but staff should still verify storage, malware scan, access logs, and procedures before asking for sensitive documents.'
      : 'For demo or private pilot, remove or black out SSNs, full account numbers, full EINs, bank routing/account numbers, signatures, and any document you would not want stored in a test system.',
    examples_allowed_in_demo: [
      'A fake/sample IRS or NYS notice used for testing.',
      'A redacted notice with name, SSN, account number, barcode, and address removed.',
      'A document list or summary typed by the client without full private identifiers.'
    ],
    examples_blocked_until_live_secure: [
      'Full W-2, 1099, 1098, 1095-A, transcript, return, or IRS/NYS/NYC notice with SSN/TIN visible.',
      'Bank account or direct-deposit information.',
      'Unredacted identity documents, signatures, or full tax transcripts.'
    ],
    staff_rules: [
      'Do not ask pilot users to upload real sensitive taxpayer documents until production gates pass.',
      'Quarantine any uploaded file that is not malware-scanned or clearly redacted/sample material.',
      'Do not download or forward taxpayer documents outside the permission-gated platform.'
    ]
  };
}

function buildLaunchStageChecklist({ productionReadiness = {}, liveReadiness = {}, productionConfig = {}, policy = {}, store = null } = {}) {
  const cases = store && store.list ? store.list('cases', (c) => !c.deleted_at) : [];
  const professionals = store && store.list ? store.list('professionals', (p) => !p.deleted_at) : [];
  const officialForms = store && store.list ? store.list('official_forms', (f) => !f.deleted_at) : [];
  const verifiedPros = professionals.filter((p) => ['active','verified','approved'].includes(String(p.status || p.credential_status || '').toLowerCase()) || Number(p.compliance_score || 0) >= 70);
  const mappedForms = officialForms.filter((f) => f.mapping_status === 'mapped_verified');
  const readinessChecks = productionReadiness.checks || [];
  const checkOk = (key) => readinessChecks.find((c) => c.key === key)?.ok === true;
  const envBlockers = (productionConfig.blockers || []).map((b) => typeof b === 'string' ? b : b.label || String(b));
  const stageTemplates = [
    {
      key: 'internal_demo',
      label: 'Internal demo only',
      customer_scope: 'Founder/staff can click through with fake or redacted/sample data only.',
      required: ['App starts and /health returns ok', 'Required consents are in place', 'Sensitive-upload gate is present'],
      blockers: [],
      allowed_now: true,
      next_actions: ['Seed safe demo cases if you want a fuller staff walkthrough.', 'Review mobile homepage/dashboard/staff pages before showing partners.']
    },
    {
      key: 'private_pilot_no_sensitive_uploads',
      label: 'Private pilot without sensitive uploads',
      customer_scope: 'Known testers can create accounts and use redacted/sample documents or no uploads.',
      required: ['Sample upload acknowledgment works', 'Staff can see cases and task board', 'Referral attribution works', 'Clear no-government/no-guarantee/no-emergency language is visible'],
      blockers: [policy.sample_uploads_allowed === false ? 'Redacted/sample uploads are disabled.' : ''].filter(Boolean),
      allowed_now: policy.sample_uploads_allowed !== false,
      next_actions: ['Use a small set of known testers.', 'Tell testers not to upload real SSNs, notices, W-2s, 1099s, transcripts, or returns.']
    },
    {
      key: 'controlled_paid_pilot',
      label: 'Controlled paid pilot',
      customer_scope: 'Small paid pilot with manual staff oversight and professional review before release.',
      required: ['Live Stripe/webhook tested', 'Staff approval controls configured', 'At least one verified reviewer', 'Transactional email or owner fallback configured', 'Clear refund/release gates'],
      blockers: [
        checkOk('stripe') ? '' : 'Stripe live key and webhook are not fully configured.',
        checkOk('staff_permissions') ? '' : 'Staff signup/approval controls are not fully configured.',
        verifiedPros.length ? '' : 'No verified PTIN/CPA/EA/tax attorney reviewer is recorded.',
        checkOk('email_recovery') ? '' : 'Transactional email/provider fallback is not configured.'
      ].filter(Boolean),
      allowed_now: checkOk('stripe') && checkOk('staff_permissions') && verifiedPros.length > 0 && checkOk('email_recovery'),
      next_actions: ['Add/verify reviewer credentials.', 'Test a payment from checkout through webhook to dashboard status.', 'Use manual release approval for every case.']
    },
    {
      key: 'public_live_launch',
      label: 'Public live launch',
      customer_scope: 'Public marketing, live sensitive taxpayer documents, and broad paid services.',
      required: ['Managed PostgreSQL', 'Private object storage', 'Malware scanning', 'Authenticated transactional email', 'Professional/MFA access controls', 'WISP/operating procedures', 'Official form mapping QA where forms are used'],
      blockers: [
        checkOk('database') ? '' : 'Managed PostgreSQL is not configured.',
        policy.private_storage_ready ? '' : 'Private object storage is not configured.',
        policy.malware_scanning_ready ? '' : 'Malware scanning is not configured.',
        checkOk('email_recovery') ? '' : 'Transactional email is not ready.',
        checkOk('staff_permissions') ? '' : 'Staff/professional approval controls need production setup.',
        policy.accept_live_sensitive_documents ? '' : 'Live sensitive taxpayer uploads remain blocked.',
        mappedForms.length ? '' : 'No official forms are mapped_verified yet for client output.'
      ].filter(Boolean).concat(envBlockers.slice(0, 8)),
      allowed_now: Boolean(liveReadiness.ready_for_live_paying_users && policy.accept_live_sensitive_documents && mappedForms.length > 0),
      next_actions: ['Complete WISP/Publication 4557-style safeguards.', 'Run official form mapping QA by agency/year/form.', 'Run end-to-end payment, email, storage, scan, access-log, and release tests.']
    }
  ];
  const decorated = stageTemplates.map((stage) => {
    const completed = stage.required.filter((_, idx) => stage.allowed_now || idx < 2);
    const readinessPercent = Math.round((completed.length / Math.max(1, stage.required.length)) * 100);
    return { ...stage, completed, readiness_percent: readinessPercent, blocker_count: stage.blockers.length };
  });
  const recommended = decorated.find((s) => !s.allowed_now) || decorated[decorated.length - 1];
  return {
    version: '0.1.16',
    title: 'Pilot and live launch checklist',
    cases_in_storage: cases.length,
    verified_professionals: verifiedPros.length,
    mapped_verified_forms: mappedForms.length,
    recommended_next_mode: recommended.key === 'internal_demo' ? decorated[0] : decorated[Math.max(0, decorated.findIndex((s) => s.key === recommended.key) - 1)] || decorated[0],
    stages: decorated,
    exact_founder_blockers: decorated.flatMap((stage) => stage.blockers.map((b) => ({ stage: stage.key, blocker: b }))).slice(0, 40),
    safety_rule: 'Do not blur internal-demo readiness with paid-pilot or public-production readiness.'
  };
}

function buildOfficialFormReadinessMatrix({ store } = {}) {
  const forms = store && store.list ? store.list('official_forms', (f) => !f.deleted_at) : [];
  const statuses = ['not_started','source_verified','fields_extracted','mapping_in_progress','sample_pdf_testing','mapped_verified','deferred_not_needed','needs_newer_official_source','blocked_unofficial_or_unclear'];
  const byStatus = Object.fromEntries(statuses.map((status) => [status, forms.filter((f) => String(f.mapping_status || 'not_started') === status).length]));
  const agencies = Array.from(new Set(forms.map((f) => f.agency || 'UNKNOWN'))).sort();
  const rows = forms.map((f) => ({
    id: f.id,
    agency: f.agency || '',
    tax_year: f.tax_year || '',
    form_number: f.form_number || '',
    title: f.title || f.file_name || '',
    file_name: f.file_name || '',
    mapping_status: f.mapping_status || 'not_started',
    source_status: f.official_source_status || '',
    can_drive_client_output: Boolean(f.can_drive_client_output),
    release_status: f.release_status || 'not_usable_for_client_output_until_mapped_and_verified',
    next_mapping_step: nextFormMappingStep(f)
  }));
  return {
    version: '0.1.16',
    summary: { total: forms.length, agencies, by_status: byStatus, client_output_ready: rows.filter((r) => r.can_drive_client_output).length },
    filters: { agencies, tax_years: Array.from(new Set(forms.map((f) => String(f.tax_year || '')).filter(Boolean))).sort(), statuses },
    rows,
    qa_checklist: [
      'Verify agency, tax year, form number, title, revision/edition date, official source URL, and checksum.',
      'Extract PDF field names where possible and map every intake source field to the official PDF field.',
      'Track conditional sections, checkboxes, date formats, money fields, repeated blocks, signatures, preparer fields, and government-only areas.',
      'Generate sample-filled PDFs for realistic test cases and inspect placement, overflow, calculations, blanks, and unsupported fields.',
      'Require human/professional verification before any client-facing final form output.'
    ],
    policy: 'Official forms can support mapping and QA only until source verification, field mapping, sample-fill testing, and professional release rules are complete.'
  };
}

function nextFormMappingStep(form = {}) {
  const status = String(form.mapping_status || 'not_started');
  if (status === 'not_started') return 'Verify official source, tax year, revision date, and checksum.';
  if (status === 'source_verified') return 'Extract fillable PDF fields and create the first field-map draft.';
  if (status === 'fields_extracted') return 'Map intake fields, conditionals, checkboxes, repeated sections, and signature/preparer blocks.';
  if (status === 'mapping_in_progress') return 'Run sample-fill PDF tests and inspect output manually.';
  if (status === 'sample_pdf_testing') return 'Mark mapped_verified only after reviewer QA confirms placement, overflow, and official-only areas.';
  if (status === 'mapped_verified') return 'Usable only after case-specific professional review and client approval.';
  if (status === 'needs_newer_official_source') return 'Replace with current official source before mapping.';
  if (status === 'blocked_unofficial_or_unclear') return 'Do not use. Resolve source authority first.';
  return 'Keep deferred unless this form becomes part of a supported workflow.';
}

function buildReferralPartnerGuide({ store } = {}) {
  const referrals = store && store.list ? store.list('referrals', (r) => !r.deleted_at) : [];
  const rewards = store && store.list ? store.list('referral_rewards', (r) => !r.deleted_at) : [];
  return {
    version: '0.1.16',
    title: 'Community partner referral guide',
    partner_count: referrals.length,
    reward_entries: rewards.length,
    public_explanation: 'Partners can share a tracked link, QR code, or English/Spanish flyer. The person starts free. Rewards apply only to eligible paid Justice Tax Solutions platform/professional-review fees and are subject to review/refund rules.',
    partner_steps: [
      'Create or retrieve the partner code.',
      'Print the flyer or share the tracked link/QR code.',
      'Tell the taxpayer they can start free and that Justice Tax Solutions is not the IRS, NYS, NYC, or a law firm.',
      'Staff verifies attribution before any reward is approved or paid.'
    ],
    staff_checks: [
      'Confirm the tracked code is attached to the signup/case/payment.',
      'Confirm the paid item is an eligible platform/professional-review fee.',
      'Exclude government taxes, penalties, interest, refunds, chargebacks, and third-party professional fees unless later included by policy.',
      'Avoid duplicate or stacked rewards beyond the highest eligible paid-service reward rule.'
    ]
  };
}

function buildDemoDataPreview() {
  return {
    version: '0.1.16',
    safe_demo_only: true,
    warning: 'These demo cases use fake facts and fake/redacted document names only. They are for staff walkthroughs and should not include real taxpayer documents.',
    templates: DEMO_CASE_TEMPLATES.map((c) => ({ id: c.id, pathway: c.pathway, primary_concern: c.primary_concern, risk_level: c.risk_level, status: c.status, documents: c.document_count }))
  };
}

function seedDemoData(store, helpers = {}) {
  if (!store || !store.insert || !store.find) throw new Error('Storage adapter required.');
  const now = new Date().toISOString();
  const existing = store.find('cases', (c) => c.demo_seed === 'v0.1.16' && !c.deleted_at);
  if (existing) return { seeded: false, message: 'Demo data already exists.', existing_case_id: existing.id };
  const referral = store.insert('referrals', {
    id: 'demo_ref_jts_v015',
    partner_name: 'Demo Community Partner',
    organization: 'Demo Tax Help Location',
    email: 'demo-partner@example.test',
    city_state: 'New York, NY',
    code: 'JTS-DEMO-015',
    status: 'active',
    demo_seed: 'v0.1.16'
  });
  const pro = store.insert('professionals', {
    id: 'demo_pro_reviewer_v015',
    name: 'Demo EA / Tax Reviewer',
    email: 'demo-reviewer@example.test',
    role_key: 'ea',
    role_label: 'Enrolled Agent / tax resolution reviewer',
    credentials: 'Demo credential record only — verify real credentials before live use.',
    status: 'active',
    credential_status: 'verified_demo_only',
    compliance_score: 82,
    can_handle_notices: true,
    can_handle_tax_debt: true,
    demo_seed: 'v0.1.16'
  });
  const cases = [];
  for (const template of DEMO_CASE_TEMPLATES) {
    const base = {
      ...template,
      id: `${template.id}_${Date.now()}`,
      name: 'Demo Taxpayer',
      email: `${template.id}@example.test`,
      language: 'English',
      referral_code: referral.code,
      helper_code: referral.code,
      selected_tier: 'free_starting_point',
      consent_status: 'accepted_demo_only',
      upload_mode: template.documents && template.documents.length ? 'redacted_sample_only' : 'no_files',
      upload_policy_status: template.documents && template.documents.length ? 'redacted_sample_or_no_uploads_only' : 'no_files',
      client_consent: { demo_only: true, no_real_taxpayer_data: true },
      created_at: now,
      demo_seed: 'v0.1.16'
    };
    const analyzed = helpers.analyzeCase ? helpers.analyzeCase(base) : {};
    let taxCase = { ...base, ...analyzed };
    if (helpers.buildFieldFillPlan) taxCase.field_fill_plan = helpers.buildFieldFillPlan(taxCase, taxCase.documents || []);
    taxCase.document_readiness_score = taxCase.field_fill_plan ? taxCase.field_fill_plan.readiness_score : 0;
    if (helpers.workpaperBinderForCase) taxCase.document_binder = helpers.workpaperBinderForCase(taxCase, taxCase.documents || []);
    if (helpers.buildReviewPlan) {
      taxCase.review_plan = helpers.buildReviewPlan(taxCase);
      taxCase.review_readiness_score = taxCase.review_plan.readinessScore;
      taxCase.review_recommended_product = taxCase.review_plan.recommendedProduct;
    }
    if (helpers.buildCaseActionPlan) taxCase.action_plan = helpers.buildCaseActionPlan(taxCase);
    if (helpers.chooseServiceFit) taxCase.service_fit = helpers.chooseServiceFit(taxCase);
    if (helpers.buildClientJourney) {
      taxCase.client_journey = helpers.buildClientJourney(taxCase);
      taxCase.next_questions = taxCase.client_journey.next_questions || [];
    }
    taxCase.customer_status_copy = buildCustomerStatusCopy(taxCase);
    const saved = store.insert('cases', taxCase);
    cases.push(saved);
    store.insert('tasks', {
      id: `demo_task_${saved.id}`.slice(0, 120),
      case_id: saved.id,
      lane: staffLaneForCase(saved),
      label: nextStaffAction(saved),
      status: 'open',
      priority: saved.risk_level === 'high' ? 'urgent' : 'normal',
      demo_seed: 'v0.1.16'
    });
  }
  if (store.addEvent) store.addEvent('demo_data_seeded_v0_1_16', { case_count: cases.length, referral_code: referral.code, professional_id: pro.id });
  return { seeded: true, referral, professional: pro, cases: cases.map((c) => ({ id: c.id, pathway: c.pathway, status: c.status, risk_level: c.risk_level })) };
}

module.exports = {
  STATUS_LABELS,
  CUSTOMER_STATUS_MESSAGES,
  STAFF_REVIEW_STATUSES,
  DEMO_CASE_TEMPLATES,
  buildCustomerStatusCopy,
  buildStaffWorkflowBoard,
  buildUploadSafetyGuide,
  buildLaunchStageChecklist,
  buildOfficialFormReadinessMatrix,
  buildReferralPartnerGuide,
  buildDemoDataPreview,
  seedDemoData
};
