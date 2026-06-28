const crypto = require('crypto');

function safe(value = '', max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function dollars(value = 0) {
  return `$${(cents(value) / 100).toFixed(cents(value) % 100 === 0 ? 0 : 2)}`;
}

function nowIso() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

const PAYMENT_QUOTE_EMAIL_POLICY = {
  versionLabel: 'v0.1.27 payment, quote, email, and appointment confirmation workflow',
  positioning: 'Justice Tax Solutions can collect payment or quote approval for AI completion, PTIN review, EA review, CPA review, tax attorney review, live online completion, and appointment-based services without pretending taxes, penalties, interest, government payments, or separate third-party professional/legal fees are included.',
  quoteRule: 'When complexity, live professional time, rush handling, attorney-sensitive facts, or bundled services affect price, create a quote and require customer approval before paid work is confirmed.',
  paymentRule: 'Use Stripe checkout/webhooks when configured. If Stripe is not configured, record payment requests as not paid and keep release gates closed except in explicitly marked development/mock flows.',
  emailRule: 'Transactional messages must avoid sensitive taxpayer facts in subject lines and email bodies. Direct customers to sign in for details rather than exposing SSNs, tax balances, notice details, income, or uploaded-document names in email.',
  appointmentRule: 'Appointment confirmations, reminders, reschedule/cancel notes, and meeting links can be created manually first. Calendar/provider API sync is planned but not claimed until configured and tested.',
  releaseRule: 'Quote approval or payment alone never means the case is ready to file, sign, submit, or respond to an agency. Release still requires client verification, official-form output gates, and required professional signoff.'
};

const QUOTE_STATUSES = ['draft','sent','customer_approved','customer_declined','expired','converted_to_payment_request','paid','cancelled','refunded','voided'];
const PAYMENT_STATUSES = ['requested_not_paid','checkout_created','paid','failed','refunded','cancelled','disputed','manual_review'];
const MESSAGE_STATUSES = ['planned','queued_manual_send','sent_manual','sent_provider','suppressed','failed','cancelled'];

const TRANSACTIONAL_EMAIL_TEMPLATES_V2 = [
  {
    key: 'quote_ready',
    label: 'Quote ready for approval',
    subject: 'Your Justice Tax Solutions quote is ready',
    safeBody: 'Your quote is ready. Please sign in to review the service level, price, scope, and next steps before approving.',
    trigger: 'staff quote created or revised',
    noSensitiveDetails: ['Do not include SSN', 'Do not include exact tax balance', 'Do not include notice text', 'Do not include document filenames']
  },
  {
    key: 'quote_approved',
    label: 'Quote approved confirmation',
    subject: 'Your quote was approved',
    safeBody: 'We recorded your approval. Please sign in for the next step and payment or scheduling details.',
    trigger: 'customer approves quote',
    noSensitiveDetails: ['Do not include tax facts', 'Do not imply filing is complete']
  },
  {
    key: 'payment_request',
    label: 'Payment request',
    subject: 'Payment step for your tax help request',
    safeBody: 'A payment step is available for your selected service. Please sign in to review the scope and payment link.',
    trigger: 'payment request created or Stripe checkout link available',
    noSensitiveDetails: ['Do not include card details', 'Do not include tax facts']
  },
  {
    key: 'payment_receipt',
    label: 'Payment receipt',
    subject: 'Payment received by Justice Tax Solutions',
    safeBody: 'We received your platform-service payment. Please sign in to see what happens next.',
    trigger: 'Stripe webhook paid or staff-approved manual payment record',
    noSensitiveDetails: ['Do not imply government tax is paid', 'Do not imply IRS/NYS/NYC accepted anything']
  },
  {
    key: 'appointment_confirmation',
    label: 'Appointment confirmation',
    subject: 'Your tax help appointment is confirmed',
    safeBody: 'Your appointment is confirmed. Please sign in to view the time, meeting method, meeting link, and preparation checklist.',
    trigger: 'staff confirms appointment details',
    noSensitiveDetails: ['Do not include private tax facts in the email body']
  },
  {
    key: 'appointment_reminder',
    label: 'Appointment reminder',
    subject: 'Reminder: your tax help appointment',
    safeBody: 'This is a reminder for your upcoming tax help appointment. Please sign in to review the preparation checklist.',
    trigger: 'staff/manual reminder or future automation',
    noSensitiveDetails: ['Do not expose tax facts', 'Do not expose document names']
  },
  {
    key: 'appointment_reschedule_cancel',
    label: 'Appointment reschedule or cancel',
    subject: 'Update about your tax help appointment',
    safeBody: 'There is an appointment update. Please sign in to review the new status and any reschedule/cancel instructions.',
    trigger: 'reschedule, cancel, no-show, or blocked appointment',
    noSensitiveDetails: ['Do not reveal sensitive reason in email']
  },
  {
    key: 'missing_information_before_session',
    label: 'Missing information before session',
    subject: 'A few items are needed before your tax help session',
    safeBody: 'A few items are needed before your session can be productive. Please sign in to view the checklist.',
    trigger: 'pre-session readiness incomplete',
    noSensitiveDetails: ['Do not list sensitive documents in email']
  },
  {
    key: 'post_session_summary_ready',
    label: 'Post-session summary ready',
    subject: 'Your session summary is ready',
    safeBody: 'Your session summary is ready. Please sign in to review it carefully before taking any next step.',
    trigger: 'staff marks session complete and summary available',
    noSensitiveDetails: ['Do not include tax advice or tax facts in email']
  }
];

function templateByKey(key) {
  return TRANSACTIONAL_EMAIL_TEMPLATES_V2.find((tpl) => tpl.key === key) || TRANSACTIONAL_EMAIL_TEMPLATES_V2[0];
}

function emailProviderReadiness(env = process.env) {
  const providers = [
    { key: 'smtp', configured: Boolean(env.SMTP_HOST && env.SMTP_USER), notes: 'SMTP can deliver transactional email if SPF/DKIM/domain setup is complete.' },
    { key: 'resend', configured: Boolean(env.RESEND_API_KEY), notes: 'Resend API key present; domain authentication should be checked.' },
    { key: 'sendgrid', configured: Boolean(env.SENDGRID_API_KEY), notes: 'SendGrid API key present; sender authentication should be checked.' }
  ];
  const configured = providers.filter((p) => p.configured);
  return {
    configured: configured.length > 0,
    providerKeys: configured.map((p) => p.key),
    providers,
    ownerFallbackConfigured: Boolean(env.OWNER_EMAIL),
    noSensitiveDetailsPolicy: PAYMENT_QUOTE_EMAIL_POLICY.emailRule,
    productionBlocker: configured.length ? '' : 'No transactional email provider is configured; use manual staff notifications only until email is configured and authenticated.'
  };
}

function stripeReadiness({ stripeConfigured = false, webhookConfigured = false } = {}) {
  return {
    stripeConfigured: Boolean(stripeConfigured),
    webhookConfigured: Boolean(webhookConfigured),
    liveReady: Boolean(stripeConfigured && webhookConfigured && process.env.PRODUCTION_PAYMENT_CONFIGURED === 'true'),
    blockers: [
      !stripeConfigured ? 'STRIPE_SECRET_KEY is not configured.' : '',
      !webhookConfigured ? 'STRIPE_WEBHOOK_SECRET is not configured.' : '',
      process.env.PRODUCTION_PAYMENT_CONFIGURED !== 'true' ? 'PRODUCTION_PAYMENT_CONFIGURED is not true.' : ''
    ].filter(Boolean),
    note: 'Stripe checkout creation is useful only when the webhook is configured and tested; otherwise release gates should not treat payment as paid.'
  };
}

function buildPaymentQuoteEmailWorkflow({ stripeConfigured = false, webhookConfigured = false, emailEnv = process.env } = {}) {
  return {
    policy: PAYMENT_QUOTE_EMAIL_POLICY,
    quoteStatuses: QUOTE_STATUSES,
    paymentStatuses: PAYMENT_STATUSES,
    messageStatuses: MESSAGE_STATUSES,
    stripe: stripeReadiness({ stripeConfigured, webhookConfigured }),
    email: emailProviderReadiness(emailEnv),
    templates: TRANSACTIONAL_EMAIL_TEMPLATES_V2,
    customerSequence: [
      'Customer chooses AI-only, review level, live session, or full online completion.',
      'Platform estimates price and shows whether quote is required.',
      'Staff/professional creates or confirms quote when complexity or live time requires it.',
      'Customer approves quote before paid work is confirmed.',
      'Stripe checkout or staff-recorded payment request is created.',
      'Receipt/payment event updates case, referral reward eligibility, and next action.',
      'Appointment confirmation/reminders use no-sensitive-details messages and sign-in links.',
      'Release remains blocked until client verification and required professional/output gates pass.'
    ],
    staffSequence: [
      'Review case and pricing route.',
      'Create quote with service scope, exclusions, and government-fee separation.',
      'Send safe quote-ready message or payment request.',
      'Confirm payment status before professional time is scheduled if policy requires payment first.',
      'Send appointment confirmation, reminder, reschedule/cancel update, or missing-info message.',
      'Record all manual sends/events for audit.'
    ]
  };
}

function buildQuoteFromCase({ caseData = {}, user = {}, body = {}, tier = null, createdBy = {} } = {}) {
  const amount = cents(body.amount_total_cents || body.amountCents || (tier && tier.publicPriceCents) || 0);
  const product = safe(body.product_type || body.productKey || (tier && tier.key) || caseData.selected_tier || 'tax_notice_action_plan', 80);
  const requiresCustomQuote = Boolean(body.requires_custom_quote === true || body.requires_custom_quote === 'true' || amount === 0 || /quote|attorney|complex|oic|656|full_online/i.test(product));
  const quote = {
    id: id('quote'),
    case_id: caseData.id || safe(body.case_id || '', 80),
    user_id: user.id || caseData.user_id || '',
    email: safe(caseData.email || user.email || body.email || '', 180).toLowerCase(),
    product_type: product,
    product_label: safe(body.product_label || (tier && tier.label) || product, 160),
    review_level: safe(body.review_level || (tier && tier.reviewLevel) || caseData.professional_session_level || '', 80),
    amount_total_cents: amount,
    display_amount: amount ? dollars(amount) : 'Quote required',
    status: safe(body.status || (requiresCustomQuote ? 'draft' : 'sent'), 80),
    scope_summary: safe(body.scope_summary || (tier && tier.customerPromise) || 'Tax help service quote created from the selected service level.', 1200),
    included_items: Array.isArray(body.included_items) ? body.included_items.map((x) => safe(x, 240)).slice(0, 12) : ((tier && tier.includes) || []),
    excluded_items: Array.isArray(body.excluded_items) ? body.excluded_items.map((x) => safe(x, 240)).slice(0, 12) : ((tier && tier.exclusions) || ['Taxes, penalties, interest, government payments, filing charges, refunds, chargebacks, and separate third-party professional/legal fees are not included.']),
    requires_custom_quote: requiresCustomQuote,
    requires_customer_approval: true,
    customer_approved_at: '',
    customer_approved_by: '',
    expires_at: safe(body.expires_at || '', 80),
    referral_code: safe(caseData.referral_code || body.referral_code || '', 80),
    quote_note: safe(body.quote_note || body.note || '', 1200),
    no_guarantee_acknowledgment_required: true,
    government_costs_separate: true,
    created_by: createdBy.id || user.id || '',
    created_by_role: createdBy.role || user.role || 'client'
  };
  return quote;
}

function createQuoteRecord(store, args = {}) {
  const quote = buildQuoteFromCase(args);
  return store.insert('quotes', quote);
}

function approveQuote(store, quoteId = '', user = {}, body = {}) {
  const quote = store.find('quotes', (q) => q.id === quoteId && !q.deleted_at);
  if (!quote) return null;
  if (quote.user_id && user.id && quote.user_id !== user.id && !['staff','admin','owner','professional'].includes(String(user.role || ''))) return null;
  const accepted = body.accept === true || body.accepted === true || String(body.status || '').toLowerCase() === 'customer_approved';
  const status = accepted ? 'customer_approved' : 'customer_declined';
  const patch = {
    status,
    customer_approved_at: accepted ? nowIso() : quote.customer_approved_at || '',
    customer_approved_by: accepted ? (user.id || '') : quote.customer_approved_by || '',
    customer_note: safe(body.customer_note || body.note || '', 1000),
    no_guarantee_acknowledged: Boolean(body.no_guarantee_acknowledged === true || body.no_guarantee_acknowledged === 'true'),
    scope_approved: Boolean(body.scope_approved === true || body.scope_approved === 'true'),
    government_costs_separate_acknowledged: Boolean(body.government_costs_separate_acknowledged === true || body.government_costs_separate_acknowledged === 'true')
  };
  return store.update('quotes', quote.id, patch);
}

function createPaymentRequestFromQuote(store, quote = {}, actor = {}) {
  if (!quote || !quote.id) return null;
  const existing = store.find('payments', (p) => p.quote_id === quote.id && !p.deleted_at);
  if (existing) return existing;
  const payment = store.insert('payments', {
    id: id('payreq'),
    quote_id: quote.id,
    case_id: quote.case_id || '',
    email: quote.email || '',
    product_type: quote.product_type || '',
    amount_total_cents: cents(quote.amount_total_cents),
    status: 'requested_not_paid',
    referral_code: quote.referral_code || '',
    created_by_user_id: actor.id || '',
    checkout_note: 'Payment request created from an approved quote. Stripe checkout should be created separately when configured.'
  });
  store.update('quotes', quote.id, { status: 'converted_to_payment_request', payment_request_id: payment.id, converted_at: nowIso() });
  return payment;
}

function createSafeMessageEvent(store, { caseData = {}, user = {}, templateKey = 'quote_ready', target = {}, payload = {}, actor = {}, status = 'queued_manual_send' } = {}) {
  const tpl = templateByKey(templateKey);
  const event = store.insert('transactional_messages', {
    id: id('msgout'),
    case_id: caseData.id || payload.case_id || '',
    user_id: user.id || caseData.user_id || '',
    email: safe(target.email || caseData.email || user.email || payload.email || '', 180).toLowerCase(),
    template_key: tpl.key,
    template_label: tpl.label,
    subject: tpl.subject,
    safe_body: tpl.safeBody,
    status: MESSAGE_STATUSES.includes(status) ? status : 'queued_manual_send',
    provider: safe(payload.provider || 'manual_or_not_configured', 80),
    sign_in_required: true,
    no_sensitive_details: true,
    related_quote_id: payload.quote_id || '',
    related_payment_id: payload.payment_id || '',
    related_session_request_id: payload.session_request_id || '',
    scheduled_for: safe(payload.scheduled_for || '', 80),
    sent_at: status === 'sent_manual' || status === 'sent_provider' ? nowIso() : '',
    staff_note: safe(payload.staff_note || '', 1000),
    created_by: actor.id || user.id || ''
  });
  return event;
}

function createAppointmentMessage(store, sessionRequest = {}, body = {}, actor = {}) {
  const templateKey = safe(body.template_key || body.message_type || 'appointment_confirmation', 80);
  const status = safe(body.status || 'queued_manual_send', 80);
  const updatedSessionPatch = {};
  if (templateKey === 'appointment_confirmation') updatedSessionPatch.confirmation_message_sent_at = nowIso();
  if (templateKey === 'appointment_reminder') updatedSessionPatch.last_reminder_sent_at = nowIso();
  if (templateKey === 'appointment_reschedule_cancel') updatedSessionPatch.last_reschedule_cancel_message_at = nowIso();
  if (Object.keys(updatedSessionPatch).length) store.update('professional_session_requests', sessionRequest.id, updatedSessionPatch);
  return createSafeMessageEvent(store, {
    caseData: { id: sessionRequest.case_id, email: sessionRequest.email || '', user_id: sessionRequest.user_id || '' },
    templateKey,
    target: { email: sessionRequest.email || body.email || '' },
    payload: {
      session_request_id: sessionRequest.id,
      scheduled_for: body.scheduled_for || sessionRequest.appointment_start || '',
      provider: body.provider || sessionRequest.meeting_provider || 'manual_or_not_configured',
      staff_note: body.staff_note || body.note || ''
    },
    actor,
    status: MESSAGE_STATUSES.includes(status) ? status : 'queued_manual_send'
  });
}

function buildPaymentOperationsBoard(store) {
  const quotes = store.list('quotes', (q) => !q.deleted_at);
  const payments = store.list('payments', (p) => !p.deleted_at);
  const messages = store.list('transactional_messages', (m) => !m.deleted_at);
  const sessions = store.list('professional_session_requests', (r) => !r.deleted_at);
  const cases = store.list('cases', (c) => !c.deleted_at);
  const caseById = Object.fromEntries(cases.map((c) => [c.id, c]));
  return {
    counts: {
      quotes_total: quotes.length,
      quotes_need_customer_approval: quotes.filter((q) => ['draft','sent'].includes(q.status)).length,
      quotes_approved: quotes.filter((q) => q.status === 'customer_approved').length,
      payment_requests_unpaid: payments.filter((p) => ['requested_not_paid','checkout_created'].includes(p.status)).length,
      payments_paid: payments.filter((p) => p.status === 'paid').length,
      appointment_confirmations_needed: sessions.filter((s) => !s.confirmation_message_sent_at && ['scheduled','quote_approved','customer_approved','requested_ready_for_staff_confirmation'].includes(String(s.status || s.scheduling_status || ''))).length,
      messages_queued_manual_send: messages.filter((m) => m.status === 'queued_manual_send').length
    },
    quoteLane: quotes.slice(0, 100).map((q) => ({
      id: q.id,
      case_id: q.case_id,
      email: q.email,
      product_type: q.product_type,
      review_level: q.review_level,
      amount: dollars(q.amount_total_cents),
      status: q.status,
      case_status: caseById[q.case_id] ? caseById[q.case_id].status : '',
      requires_custom_quote: Boolean(q.requires_custom_quote),
      customer_approved_at: q.customer_approved_at || ''
    })),
    paymentLane: payments.slice(0, 100).map((p) => ({ id: p.id, quote_id: p.quote_id || '', case_id: p.case_id, email: p.email, product_type: p.product_type, amount: dollars(p.amount_total_cents), status: p.status, stripe_checkout_session_id: p.stripe_checkout_session_id || '' })),
    messageLane: messages.slice(0, 100).map((m) => ({ id: m.id, case_id: m.case_id, email: m.email, template_key: m.template_key, status: m.status, provider: m.provider, created_at: m.created_at })),
    appointmentMessagingLane: sessions.slice(0, 100).map((s) => ({ id: s.id, case_id: s.case_id, email: s.email || '', status: s.status, scheduling_status: s.scheduling_status || '', meeting_provider: s.meeting_provider || '', appointment_start: s.appointment_start || '', confirmation_message_sent_at: s.confirmation_message_sent_at || '', last_reminder_sent_at: s.last_reminder_sent_at || '' }))
  };
}

function buildCasePaymentSummary(store, caseId = '') {
  const quotes = store.list('quotes', (q) => q.case_id === caseId && !q.deleted_at);
  const payments = store.list('payments', (p) => p.case_id === caseId && !p.deleted_at);
  const messages = store.list('transactional_messages', (m) => m.case_id === caseId && !m.deleted_at);
  return {
    quotes,
    payments,
    messages,
    currentQuote: quotes.find((q) => ['sent','customer_approved','converted_to_payment_request'].includes(q.status)) || quotes[0] || null,
    latestPayment: payments[0] || null,
    paymentRequiredBeforeRelease: process.env.REQUIRE_PAYMENT_BEFORE_RELEASE !== 'false',
    nextPaymentStep: payments.some((p) => p.status === 'paid') ? 'payment_recorded_continue_review_gates' : (quotes.some((q) => q.status === 'customer_approved') ? 'create_or_open_payment_request' : (quotes.length ? 'customer_quote_approval_needed' : 'quote_or_checkout_needed'))
  };
}

module.exports = {
  PAYMENT_QUOTE_EMAIL_POLICY,
  QUOTE_STATUSES,
  PAYMENT_STATUSES,
  MESSAGE_STATUSES,
  TRANSACTIONAL_EMAIL_TEMPLATES_V2,
  buildPaymentQuoteEmailWorkflow,
  buildQuoteFromCase,
  createQuoteRecord,
  approveQuote,
  createPaymentRequestFromQuote,
  createSafeMessageEvent,
  createAppointmentMessage,
  buildPaymentOperationsBoard,
  buildCasePaymentSummary,
  emailProviderReadiness,
  stripeReadiness,
  dollars
};
