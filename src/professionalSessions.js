const crypto = require('crypto');
const { buildFormCompletionPlan } = require('./formAutomation');
const { buildFieldFillPlan } = require('./documentIntelligence');
const { buildReviewPlan } = require('./proReview');
const { buildCustomerStatusCopy } = require('./pilotWorkflow');
const { estimateLiveConsultation } = require('./consultationMarket');
const { recommendReviewLevel, estimatePrice } = require('./pricingCatalog');

const REVIEW_LEVELS = ['ai_completion_only', 'ptin_preparer_review', 'enrolled_agent_review', 'cpa_review', 'tax_attorney_review'];
const ROLE_LABELS = {
  ai_completion_only: 'AI Completion Only',
  ptin_preparer_review: 'PTIN Preparer Review',
  enrolled_agent_review: 'Enrolled Agent Review',
  cpa_review: 'CPA Review',
  tax_attorney_review: 'Tax Attorney Review'
};

const PROFESSIONAL_SESSION_POLICY = {
  positioning: 'Justice Tax Solutions should be AI-first and human-minimal, but the customer may choose a professional session for reassurance, confidence, explanation, or a second look even when the facts do not strictly require one.',
  requiredVsRequested: [
    { key: 'required_by_risk', label: 'Required professional review', rule: 'Use when paid-preparer rules, tax debt/collection risk, accounting complexity, legal-advice sensitivity, professional representation, or official-form release gates require PTIN, EA, CPA, or attorney involvement.' },
    { key: 'customer_requested_reassurance', label: 'Customer-requested reassurance review', rule: 'Use when the customer wants a professional to confirm the AI-prepared forms, explain the result, answer questions, or help them feel confident before printing, signing, filing, or responding.' },
    { key: 'completion_with_professional', label: 'Full online completion with a professional', rule: 'Use when the customer wants a PTIN preparer, EA, CPA, or tax attorney to complete the online session with the AI-prepared agenda and forms already organized.' }
  ],
  guardrails: [
    'Do not downgrade a customer who asks for a higher review level for reassurance.',
    'Do not market AI-only as professional review, legal advice, representation, or a guaranteed filing outcome.',
    'Show why a higher level is required or optional before charging the upgrade.',
    'Keep official-form output gated until the PDF is captured, mapped, sample-filled, checked, and verified.',
    'Use tax attorney review only for attorney-sensitive legal advice or strategy, and make any separate attorney engagement clear.'
  ]
};

const SESSION_PRODUCTS = [
  {
    key: 'ai_prepared_reassurance_check',
    label: 'AI-Prepared Reassurance Check',
    level: 'ptin_preparer_review',
    priceRange: '$79-$199',
    duration: '15-30 minutes',
    requestedByCustomer: true,
    bestFor: ['client wants confidence before printing or signing', 'simple extension or authorization draft', 'low-risk return organizer review'],
    deliverable: 'Professional confirms the AI-prepared checklist, flags missing items, and explains what is and is not ready.'
  },
  {
    key: 'live_ptin_completion_room',
    label: 'Live Online PTIN Completion Room',
    level: 'ptin_preparer_review',
    priceRange: '$149-$499',
    duration: '30-60 minutes',
    requestedByCustomer: true,
    bestFor: ['simple return completion', 'paid-preparer-reviewed print package', 'amended return basics', 'state add-on paired with federal return'],
    deliverable: 'AI-prepared facts and forms reviewed live by PTIN-level professional before release/signature instructions.'
  },
  {
    key: 'live_ea_problem_room',
    label: 'Live Online EA Tax Problem Room',
    level: 'enrolled_agent_review',
    priceRange: '$249-$799+',
    duration: '45-75 minutes',
    requestedByCustomer: true,
    bestFor: ['IRS notice explanation', 'installment agreement', '433-F financial statement', 'penalty relief screening', 'OIC eligibility screening'],
    deliverable: 'EA-level professional reviews the AI issue map, questions, missing documents, and draft action plan.'
  },
  {
    key: 'live_cpa_business_room',
    label: 'Live Online CPA Business/Gig Room',
    level: 'cpa_review',
    priceRange: '$299-$899+',
    duration: '45-90 minutes',
    requestedByCustomer: true,
    bestFor: ['Schedule C', 'Uber/Lyft/1099 income', 'business expense classification', 'bookkeeping cleanup', 'NYS/NYC business tax'],
    deliverable: 'CPA-level reviewer works from the AI-prepared workpaper agenda and identifies accounting-sensitive corrections.'
  },
  {
    key: 'live_tax_attorney_strategy_room',
    label: 'Live Online Tax Attorney Strategy Room',
    level: 'tax_attorney_review',
    priceRange: '$349-$1,299+ / quote',
    duration: '30-60 minutes',
    requestedByCustomer: true,
    bestFor: ['legal strategy', 'appeals', 'tax court', 'fraud/criminal exposure', 'summons', 'privilege concerns'],
    deliverable: 'Licensed tax attorney reviews attorney-sensitive issues within the agreed engagement scope.'
  },
  {
    key: 'full_online_completion_with_professional_room',
    label: 'Full Online Completion With Professional',
    level: 'ptin_preparer_review_or_higher',
    priceRange: '$299-$1,499+ / quote',
    duration: '60-120 minutes or phased sessions',
    requestedByCustomer: true,
    bestFor: ['customers who do not want to self-complete', 'multi-form packages', 'return plus notice/debt issue', 'high-anxiety cases'],
    deliverable: 'Professional-led online completion using AI intake, source-linked forms, missing-document checklist, and release gates.'
  }
];

const AVAILABILITY_MODEL = {
  currentBuildStatus: 'workflow_scaffold_not_calendar_booking_yet',
  bookingReadinessRule: 'A session can be requested after the free intake exists. It should not be confirmed until readiness, quote, payment/upgrade approval, professional credential verification, and secure-document rules are satisfied.',
  futureSchedulingAdapters: ['Google Calendar availability', 'Calendly-style booking link', 'internal professional availability table', 'Zoom/Google Meet link generation', 'email/SMS reminders'],
  manualPilotFallback: 'During pilot, staff may manually schedule by email/phone after the request is created and the readiness checklist is reviewed.'
};

function normalizeLevel(level = '') {
  const clean = String(level || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (['ai','ai_only','ai_completion','ai_completion_only'].includes(clean)) return 'ai_completion_only';
  if (['ptin','human','human_review','ptin_review','preparer','preparer_review','ptin_preparer_review'].includes(clean)) return 'ptin_preparer_review';
  if (['ea','enrolled_agent','ea_review','enrolled_agent_review'].includes(clean)) return 'enrolled_agent_review';
  if (['cpa','cpa_review'].includes(clean)) return 'cpa_review';
  if (['attorney','tax_attorney','tax_attorney_review','lawyer','legal'].includes(clean)) return 'tax_attorney_review';
  return REVIEW_LEVELS.includes(clean) ? clean : 'ptin_preparer_review';
}

function rank(level = '') { return Math.max(0, REVIEW_LEVELS.indexOf(normalizeLevel(level))); }
function highestLevel(a, b) { return rank(a) >= rank(b) ? normalizeLevel(a) : normalizeLevel(b); }

function inferMinimumLevel(c = {}) {
  const text = `${c.pathway || ''} ${c.concern || ''} ${c.describe || ''} ${c.description || ''} ${(c.flags || []).map((f) => f.label || f.key || '').join(' ')}`.toLowerCase();
  if (/tax court|appeal|criminal|fraud|summons|privilege|legal advice|levy legal|lien legal/.test(text)) return 'tax_attorney_review';
  if (/schedule c|1099|gig|uber|lyft|business|bookkeeping|rental|k-1|partnership|nyc-202|nyc-204|ubt/.test(text)) return 'cpa_review';
  if (/tax debt|cannot pay|installment|433-f|9465|656|offer in compromise|oic|penalty|collection|transcript|irs notice/.test(text)) return 'enrolled_agent_review';
  if (/return|1040|1040-x|amended|file|filing|prepare/.test(text)) return 'ptin_preparer_review';
  if (String(c.risk_level || '').toLowerCase() === 'high') return 'enrolled_agent_review';
  return 'ai_completion_only';
}

function selectedFormsFromCase(c = {}) {
  const values = [c.form_number, c.selected_form, c.target_form, c.form, c.forms_needed, c.tax_form].filter(Boolean).join(' ');
  const found = [];
  for (const token of ['9465','433-F','433F','2848','8821','1040-X','1040X','4868','656','1040','Schedule C','IT-201','IT-203','IT-201-X','NYC-202','NYC-202S','NYC-204']) {
    if (values.toLowerCase().includes(token.toLowerCase())) found.push(token.replace('433F','433-F').replace('1040X','1040-X'));
  }
  if (!found.length && String(c.pathway || '').includes('tax-debt')) found.push('9465');
  if (!found.length && String(c.pathway || '').includes('return')) found.push('1040');
  if (!found.length && String(c.pathway || '').includes('notice')) found.push('8821');
  return [...new Set(found)];
}

function buildProfessionalSessionProducts() {
  return {
    policy: PROFESSIONAL_SESSION_POLICY,
    serviceLevels: SESSION_PRODUCTS,
    availabilityModel: AVAILABILITY_MODEL,
    customerChoiceMessage: 'A customer can request a professional even when the AI-only path might be technically available. The platform should show the extra cost and scope, then honor the requested higher reassurance/review level.'
  };
}

function buildSessionRouting({ caseData = {}, requestedLevel = '', customerRequestedProfessional = false, requestedReason = '' } = {}) {
  const minimum = inferMinimumLevel(caseData);
  const requested = requestedLevel ? normalizeLevel(requestedLevel) : (customerRequestedProfessional ? 'ptin_preparer_review' : '');
  const finalLevel = requested ? highestLevel(minimum, requested) : minimum;
  const requiredByRisk = rank(minimum) > 0;
  const reassurance = Boolean(customerRequestedProfessional || requestedReason);
  return {
    minimumLevel: minimum,
    requestedLevel: requested || '',
    finalLevel,
    finalLabel: ROLE_LABELS[finalLevel] || finalLevel,
    professionalReason: requiredByRisk ? 'required_by_case_facts_or_release_gate' : (reassurance ? 'customer_requested_reassurance_or_confidence_review' : 'not_required_for_low_risk_ai_only_path'),
    customerRequestedProfessional: reassurance,
    doNotDowngrade: reassurance && requested ? 'Customer asked for a professional/higher level; do not automatically downgrade just because the case might be low risk.' : '',
    plainEnglish: requiredByRisk
      ? `Based on the current facts, ${ROLE_LABELS[minimum] || minimum} appears to be the lowest safe professional level.`
      : reassurance
        ? `A professional is optional based on current facts, but the customer requested reassurance/review, so route to ${ROLE_LABELS[finalLevel] || finalLevel}.`
        : 'AI-only may be possible if the official form mapping is verified, facts remain low risk, and the client verifies the final draft.'
  };
}

function missingDocumentsForCase(c = {}) {
  const text = `${c.pathway || ''} ${c.concern || ''} ${c.describe || ''} ${c.description || ''}`.toLowerCase();
  const docs = ['government-issued ID if required for professional verification', 'current mailing address and phone/email confirmation'];
  if (/notice|letter|irs|nys|nyc/.test(text)) docs.push('complete tax notice/letter with all pages and deadline dates');
  if (/debt|cannot pay|installment|433|9465|oic|656/.test(text)) docs.push('most recent tax balance/notice', 'monthly income and expense details', 'bank/asset/debt summary');
  if (/return|1040|amended|1040-x/.test(text)) docs.push('W-2/1099 income documents', 'prior return if amending or reviewing', 'dependent/spouse information where applicable');
  if (/gig|self|schedule c|business|uber|lyft|1099|nyc/.test(text)) docs.push('1099 platform statements', 'mileage log or vehicle summary', 'business expense records', 'NYS/NYC residency/business location facts');
  return [...new Set(docs)];
}

function buildPreSessionReadiness(c = {}, options = {}) {
  const fieldPlan = c.field_fill_plan || buildFieldFillPlan(c, c.documents || []);
  const missingDocuments = missingDocumentsForCase(c);
  const selectedForms = selectedFormsFromCase(c);
  const base = [];
  if (!c.name) base.push('client name');
  if (!c.email) base.push('client email');
  if (!c.pathway) base.push('starting path');
  if (!c.describe && !c.description && !c.concern) base.push('plain-English tax concern description');
  if (!c.client_done_uploading && Number(c.document_count || 0) === 0) base.push('documents or redacted/sample documents if allowed');
  const readinessScore = Math.max(10, Math.min(100,
    30
    + (c.name ? 10 : 0)
    + (c.email ? 10 : 0)
    + (c.pathway ? 10 : 0)
    + ((c.describe || c.description || c.concern) ? 15 : 0)
    + (Number(c.document_count || 0) > 0 ? 15 : 0)
    + (c.client_done_uploading ? 10 : 0)
    + Math.round(Number(fieldPlan.readiness_score || 0) * 0.1)
  ));
  return {
    readinessScore,
    stage: readinessScore >= 80 ? 'ready_to_schedule_or_confirm' : readinessScore >= 55 ? 'needs_staff_or_client_cleanup_before_session' : 'not_ready_for_confirmed_session',
    selectedForms,
    missingBasics: base,
    likelyMissingDocuments: missingDocuments,
    fieldPlanReadiness: fieldPlan.readiness_score || 0,
    preSessionQuestions: buildPreSessionQuestions(c, options),
    safeBookingMessage: readinessScore >= 80
      ? 'The case looks ready for staff to confirm a professional session, subject to payment/quote approval and credential matching.'
      : 'The customer may request a session, but staff should collect missing basics/documents before confirming the appointment.'
  };
}

function buildPreSessionQuestions(c = {}, options = {}) {
  const questions = [
    'What do you want the professional to accomplish during the session?',
    'Are you requesting professional reassurance even if AI-only might be available?',
    'Do you want a draft to print/sign, a filing-support review, a tax notice action plan, or just an explanation?'
  ];
  const text = `${c.pathway || ''} ${c.concern || ''} ${c.describe || ''} ${c.description || ''}`.toLowerCase();
  if (/notice|irs|nys|nyc/.test(text)) questions.push('What is the exact notice number, notice date, deadline, tax year, and agency?');
  if (/debt|cannot pay|installment|oic|433|9465|656/.test(text)) questions.push('How much is owed, which years, and is there any levy, garnishment, lien, or urgent deadline?');
  if (/return|1040|amended/.test(text)) questions.push('Which tax year, filing status, income forms, dependents, state/local returns, and prior return details apply?');
  if (/gig|self|business|schedule c|uber|lyft/.test(text)) questions.push('What business/gig income, expenses, mileage, home office, equipment, and platform statements are available?');
  if (options.requestedReason) questions.push(`Customer reassurance/request note: ${String(options.requestedReason).slice(0, 300)}`);
  return questions;
}

function buildProfessionalAgenda(c = {}, options = {}) {
  const selectedForms = selectedFormsFromCase(c);
  const routing = buildSessionRouting({ caseData: c, requestedLevel: options.requestedLevel, customerRequestedProfessional: options.customerRequestedProfessional, requestedReason: options.requestedReason });
  const readiness = buildPreSessionReadiness(c, options);
  const customerStatus = buildCustomerStatusCopy(c);
  const formPlans = selectedForms.slice(0, 5).map((formNumber) => buildFormCompletionPlan(c, formNumber));
  return {
    caseSummary: {
      id: c.id || '',
      pathway: c.pathway || '',
      riskLevel: c.risk_level || '',
      status: c.status || '',
      customerNeed: c.describe || c.description || c.concern || '',
      customerStatusMessage: customerStatus.headline || customerStatus.status || ''
    },
    routing,
    readiness,
    agenda: [
      'Confirm scope: reassurance review, live completion, filing-support review, or tax-problem strategy.',
      'Confirm identity/contact basics and tax years/forms involved.',
      'Review AI-prepared summary and missing-document checklist.',
      'Review official-form readiness: captured/mapped/sample-tested fields only.',
      'Ask unresolved follow-up questions triggered by answers/documents.',
      'Mark what can be completed now, what must wait, and what needs higher-level escalation.',
      'Explain client signature/filing/agency-response next steps without guaranteeing outcomes.'
    ],
    formPlans,
    professionalNotesTemplate: [
      'What facts did the professional verify?',
      'What fields/forms are ready, blocked, or need correction?',
      'What client decisions or signatures are still required?',
      'What deadline/risk flags should staff track?',
      'Should this remain at the requested level or escalate to EA/CPA/tax attorney?'
    ],
    releaseGuardrails: PROFESSIONAL_SESSION_POLICY.guardrails
  };
}

function estimateProfessionalSession(input = {}) {
  const requestedLevel = normalizeLevel(input.requested_level || input.review_level || input.level || '');
  const caseData = input.case || { pathway: input.pathway, concern: input.concern, describe: input.description || input.describe, risk_level: input.risk_level, form_number: input.form_number };
  const routing = buildSessionRouting({ caseData, requestedLevel, customerRequestedProfessional: input.customer_requested_professional !== false, requestedReason: input.requested_reason || '' });
  const liveEstimate = estimateLiveConsultation({ service_key: input.service_key || '', pathway: caseData.pathway || '', complexity: input.complexity || caseData.risk_level || '', requested_level: routing.finalLevel });
  const price = estimatePrice({ product_type: input.product_type || input.form_number || '', requested_level: routing.finalLevel, complexity: input.complexity || '' });
  return {
    routing,
    liveEstimate,
    priceEstimate: price,
    quoteApprovalRequired: true,
    message: 'The customer may choose a higher professional level for reassurance. Show the estimate and scope before charging or confirming the session.'
  };
}

function createSessionRequest(store, c = {}, user = {}, body = {}) {
  const options = {
    requestedLevel: body.requested_level || body.review_level || body.level || '',
    customerRequestedProfessional: body.customer_requested_professional !== false,
    requestedReason: body.requested_reason || body.reason || body.customer_note || ''
  };
  const routing = buildSessionRouting({ caseData: c, ...options });
  const readiness = buildPreSessionReadiness(c, options);
  const id = `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const request = store.insert('professional_session_requests', {
    id,
    case_id: c.id || '',
    user_id: user.id || '',
    email: c.email || user.email || '',
    name: c.name || user.name || '',
    requested_level: options.requestedLevel || routing.finalLevel,
    final_level: routing.finalLevel,
    final_label: routing.finalLabel,
    professional_reason: routing.professionalReason,
    customer_requested_professional: Boolean(options.customerRequestedProfessional),
    requested_reason: String(options.requestedReason || '').slice(0, 1000),
    preferred_times: String(body.preferred_times || '').slice(0, 1000),
    session_goal: String(body.session_goal || '').slice(0, 1000),
    status: readiness.readinessScore >= 80 ? 'requested_ready_for_staff_confirmation' : 'requested_needs_pre_session_cleanup',
    readiness_score: readiness.readinessScore,
    readiness_stage: readiness.stage,
    quote_status: 'quote_or_upgrade_approval_needed',
    payment_status: c.payment_status || 'not_paid',
    scheduling_status: 'not_scheduled',
    created_source: 'client_or_staff_request'
  });
  if (c.id) store.update('cases', c.id, {
    professional_session_requested: true,
    professional_session_requested_at: new Date().toISOString(),
    professional_session_level: routing.finalLevel,
    professional_session_status: request.status,
    customer_requested_professional: Boolean(options.customerRequestedProfessional)
  });
  return { request, routing, readiness, agenda: buildProfessionalAgenda(c, options) };
}

function buildSessionBoard(store) {
  const cases = store.list('cases', (c) => !c.deleted_at).slice(0, 500);
  const requests = store.list('professional_session_requests', (r) => !r.deleted_at).slice(0, 500);
  const requestCaseIds = new Set(requests.map((r) => r.case_id));
  const suggested = cases.filter((c) => !requestCaseIds.has(c.id) && (c.customer_requested_professional || c.professional_session_requested || String(c.status || '').includes('review') || c.payment_status === 'paid' || c.risk_level === 'high')).slice(0, 100);
  const lanes = {
    requestedNeedsCleanup: requests.filter((r) => r.status === 'requested_needs_pre_session_cleanup'),
    readyForConfirmation: requests.filter((r) => r.status === 'requested_ready_for_staff_confirmation'),
    quoteApprovalNeeded: requests.filter((r) => r.quote_status === 'quote_or_upgrade_approval_needed'),
    scheduledOrInProgress: requests.filter((r) => ['scheduled','in_progress'].includes(String(r.scheduling_status || ''))),
    suggestedProfessionalReview: suggested.map((c) => ({ case_id: c.id, email: c.email, name: c.name, pathway: c.pathway, risk_level: c.risk_level, payment_status: c.payment_status, routing: buildSessionRouting({ caseData: c }), readiness: buildPreSessionReadiness(c) }))
  };
  return { summary: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, v.length])), lanes, policy: PROFESSIONAL_SESSION_POLICY };
}

function buildProfessionalRoom(c = {}, options = {}) {
  const agenda = buildProfessionalAgenda(c, options);
  const reviewPlan = c.review_plan || buildReviewPlan(c);
  const fieldPlan = c.field_fill_plan || buildFieldFillPlan(c, c.documents || []);
  return {
    roomStatus: agenda.readiness.readinessScore >= 80 ? 'ready_for_professional_preview' : 'preview_available_but_pre_session_cleanup_needed',
    agenda,
    reviewPlan,
    fieldPlan,
    documents: (c.documents || []).map((d) => ({ id: d.id, original_name: d.original_name, classification: d.classification, extraction_status: d.extraction_status || d.extraction_profile?.extraction_status || '', verification_status: d.verification_status || '' })),
    quoteApprovalGate: {
      required: true,
      reason: 'Professional sessions requested for reassurance or required by risk should not be confirmed until the client approves the quote/upgrade and scope.',
      status: c.professional_session_quote_approved ? 'approved' : 'needs_client_quote_or_upgrade_approval'
    },
    professionalChecklist: [
      'Confirm customer requested reassurance or risk-based review reason.',
      'Confirm credential level matches scope.',
      'Review AI-prepared answers and source-linked fields.',
      'Confirm official-form mapping/output gate status before promising print-ready forms.',
      'Document corrections and unresolved client questions.',
      'Escalate to higher level if facts exceed scope.'
    ]
  };
}

module.exports = {
  PROFESSIONAL_SESSION_POLICY,
  SESSION_PRODUCTS,
  AVAILABILITY_MODEL,
  buildProfessionalSessionProducts,
  buildSessionRouting,
  buildPreSessionReadiness,
  buildProfessionalAgenda,
  estimateProfessionalSession,
  createSessionRequest,
  buildSessionBoard,
  buildProfessionalRoom,
  normalizeLevel
};
