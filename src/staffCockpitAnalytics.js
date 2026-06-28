const ANALYTICS_EVENT_TAXONOMY = [
  { key: 'landing_page_view', label: 'Landing page viewed', channel: 'marketing', noSensitiveDetails: true },
  { key: 'intake_started', label: 'Intake started', channel: 'conversion', noSensitiveDetails: true },
  { key: 'case_created', label: 'Intake completed / case created', channel: 'conversion', noSensitiveDetails: true },
  { key: 'customer_quote_requested', label: 'Customer requested quote', channel: 'revenue', noSensitiveDetails: true },
  { key: 'staff_quote_created', label: 'Staff quote created', channel: 'revenue', noSensitiveDetails: true },
  { key: 'quote_customer_approved', label: 'Quote approved by customer', channel: 'revenue', noSensitiveDetails: true },
  { key: 'staff_payment_request_created_from_quote', label: 'Payment request created from quote', channel: 'revenue', noSensitiveDetails: true },
  { key: 'stripe_checkout_completed', label: 'Payment completed', channel: 'revenue', noSensitiveDetails: true },
  { key: 'professional_session_requested', label: 'Professional session requested', channel: 'appointments', noSensitiveDetails: true },
  { key: 'appointment_scheduling_requested', label: 'Appointment scheduling requested', channel: 'appointments', noSensitiveDetails: true },
  { key: 'professional_session_scheduled', label: 'Professional session scheduled', channel: 'appointments', noSensitiveDetails: true },
  { key: 'referral_qr_scan_logged', label: 'Referral QR/link scan', channel: 'referral', noSensitiveDetails: true },
  { key: 'referral_reward_created', label: 'Referral reward created', channel: 'referral', noSensitiveDetails: true },
  { key: 'case_released_to_client', label: 'Case released to client', channel: 'fulfillment', noSensitiveDetails: true }
];

const CAMPAIGN_FIELDS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','landing_page','conversion_intent','referral_code','helper_code'];

function asArray(value) { return Array.isArray(value) ? value : []; }
function dollars(cents = 0) { return Math.round(Number(cents || 0)) / 100; }
function nowMs() { return Date.now(); }
function dateMs(value) { const ms = Date.parse(value || ''); return Number.isFinite(ms) ? ms : 0; }
function daysAgo(days) { return nowMs() - (Number(days || 0) * 24 * 60 * 60 * 1000); }
function isAfter(value, ms) { const t = dateMs(value); return t > 0 && t >= ms; }
function percent(part, total) { return total ? Math.round((Number(part || 0) / Number(total || 1)) * 100) : 0; }
function compact(value, max = 140) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function moneyLabel(cents = 0) { return `$${dollars(cents).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function statusIncludes(row, terms = []) { const hay = `${row.status || ''} ${row.quote_status || ''} ${row.payment_status || ''} ${row.release_status || ''}`.toLowerCase(); return terms.some((term) => hay.includes(String(term).toLowerCase())); }
function caseLabel(c) { return compact(`${c.email || 'no email'} · ${c.pathway || 'not-sure'} · ${c.status || 'started'}`, 220); }

function collect(store) {
  return {
    cases: asArray(store.list('cases', (c) => !c.deleted_at)),
    users: asArray(store.list('users', (u) => !u.deleted_at)),
    quotes: asArray(store.list('quotes', (q) => !q.deleted_at)),
    payments: asArray(store.list('payments', (p) => !p.deleted_at)),
    sessionRequests: asArray(store.list('professional_session_requests', (r) => !r.deleted_at)),
    appointmentEvents: asArray(store.list('appointment_scheduling_events', (e) => !e.deleted_at)),
    transactionalMessages: asArray(store.list('transactional_messages', (m) => !m.deleted_at)),
    appointmentMessages: asArray(store.list('appointment_message_events', (m) => !m.deleted_at)),
    referrals: asArray(store.list('referrals', (r) => !r.deleted_at)),
    qrScans: asArray(store.list('qr_scans', (s) => !s.deleted_at)),
    rewards: asArray(store.list('referral_rewards', (r) => !r.deleted_at)),
    tasks: asArray(store.list('tasks', (t) => !t.deleted_at)),
    professionals: asArray(store.list('professionals', (p) => !p.deleted_at)),
    documents: asArray(store.list('documents', (d) => !d.deleted_at)),
    events: asArray(store.list('events', (e) => !e.deleted_at))
  };
}

function sourceForCase(c = {}) {
  const source = compact(c.utm_source || c.source || (c.referral_code ? 'referral' : 'direct'), 80) || 'direct';
  const medium = compact(c.utm_medium || (c.referral_code ? 'partner' : 'unknown'), 80) || 'unknown';
  const campaign = compact(c.utm_campaign || c.campaign || c.referral_code || 'untracked', 120) || 'untracked';
  return { source, medium, campaign, referral_code: compact(c.referral_code || c.helper_code || '', 80), landing_page: compact(c.landing_page || '', 180), conversion_intent: compact(c.conversion_intent || c.pathway || '', 100) };
}

function groupCount(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function buildConversionFunnel(store) {
  const data = collect(store);
  const cases = data.cases;
  const quoteRequests = data.quotes.filter((q) => q.status === 'requested' || q.status === 'draft' || q.requires_custom_quote || q.customer_requested);
  const quotesSent = data.quotes.filter((q) => ['sent','customer_approved','converted_to_payment_request','paid'].includes(String(q.status || '')));
  const quotesApproved = data.quotes.filter((q) => ['customer_approved','converted_to_payment_request','paid'].includes(String(q.status || '')));
  const paymentRequests = data.payments.filter((p) => ['requested','checkout_created','pending','paid'].includes(String(p.status || '')));
  const paid = data.payments.filter((p) => p.status === 'paid');
  const sessions = data.sessionRequests;
  const scheduledSessions = sessions.filter((s) => ['scheduled','ready_for_session','completed'].includes(String(s.status || s.session_status || s.appointment_status || '')) || s.appointment_start || s.meeting_link);
  const releases = cases.filter((c) => c.release_status === 'released_to_client' || c.status === 'released_to_client');
  const steps = [
    { key: 'case_created', label: 'Case created', count: cases.length },
    { key: 'quote_requested', label: 'Quote requested/custom scope', count: quoteRequests.length },
    { key: 'quote_sent', label: 'Quote sent', count: quotesSent.length },
    { key: 'quote_approved', label: 'Quote approved', count: quotesApproved.length },
    { key: 'payment_requested', label: 'Payment requested', count: paymentRequests.length },
    { key: 'paid', label: 'Paid', count: paid.length },
    { key: 'professional_session_requested', label: 'Professional session requested', count: sessions.length },
    { key: 'appointment_scheduled', label: 'Appointment scheduled/ready', count: scheduledSessions.length },
    { key: 'released', label: 'Released to client', count: releases.length }
  ];
  return {
    steps: steps.map((step, idx) => ({ ...step, conversion_from_case_created_pct: percent(step.count, cases.length), conversion_from_prior_step_pct: idx === 0 ? 100 : percent(step.count, steps[idx - 1].count) })),
    revenue: {
      quote_pipeline_cents: data.quotes.reduce((sum, q) => sum + Number(q.amount_total_cents || 0), 0),
      requested_payment_cents: paymentRequests.reduce((sum, p) => sum + Number(p.amount_total_cents || 0), 0),
      paid_cents: paid.reduce((sum, p) => sum + Number(p.amount_total_cents || 0), 0),
      paid_label: moneyLabel(paid.reduce((sum, p) => sum + Number(p.amount_total_cents || 0), 0))
    },
    dropoff_notes: [
      'Use this as a directional pilot funnel until paid traffic and final email/calendar integrations are live.',
      'Quote approval, payment, professional session, and release events are intentionally separate so staff can see where users stop.',
      'Do not put sensitive tax facts into analytics events or outbound email payloads.'
    ]
  };
}

function buildMarketingAttribution(store) {
  const data = collect(store);
  const rows = data.cases.map((c) => ({ case_id: c.id, created_at: c.created_at, pathway: c.pathway, risk_level: c.risk_level, selected_tier: c.selected_tier, ...sourceForCase(c) }));
  const sources = groupCount(rows, (r) => r.source);
  const campaigns = groupCount(rows, (r) => `${r.source} / ${r.campaign}`);
  const pathways = groupCount(rows, (r) => r.pathway || r.conversion_intent || 'not-sure');
  const referralRows = data.referrals.map((r) => {
    const code = r.code || r.referral_code;
    const matchingCases = data.cases.filter((c) => String(c.referral_code || c.helper_code || '').toUpperCase() === String(code || '').toUpperCase());
    const matchingRewards = data.rewards.filter((rw) => String(rw.referral_code || '').toUpperCase() === String(code || '').toUpperCase());
    return {
      code,
      partner_name: r.partner_name || r.organization || r.email || 'Partner',
      scans: data.qrScans.filter((s) => String(s.referrer_code || '').toUpperCase() === String(code || '').toUpperCase()).length,
      cases: matchingCases.length,
      rewards_pending: matchingRewards.filter((rw) => ['pending','needs_review','held'].includes(String(rw.status || ''))).length,
      reward_cents: matchingRewards.reduce((sum, rw) => sum + Number(rw.amount_cents || rw.reward_amount_cents || 0), 0)
    };
  }).sort((a, b) => b.cases - a.cases || b.scans - a.scans);
  return {
    summary: {
      tracked_cases: rows.length,
      tracked_sources: sources.length,
      tracked_campaigns: campaigns.length,
      referral_partners: data.referrals.length,
      qr_scans: data.qrScans.length
    },
    sources,
    campaigns: campaigns.slice(0, 30),
    pathways,
    referrals: referralRows.slice(0, 50),
    missing_tracking: {
      cases_without_source: rows.filter((r) => !r.source || r.source === 'direct').length,
      cases_without_campaign: rows.filter((r) => !r.campaign || r.campaign === 'untracked').length,
      recommendation: 'Marketing pages should pass utm_source, utm_medium, utm_campaign, landing_page, conversion_intent, and referral_code into intake so paid marketing can be measured.'
    }
  };
}

function buildOperationalAlerts(store) {
  const data = collect(store);
  const alerts = [];
  const highRisk = data.cases.filter((c) => c.risk_level === 'high' && c.release_status !== 'released_to_client');
  if (highRisk.length) alerts.push({ severity: 'high', key: 'high_risk_cases', label: `${highRisk.length} high-risk case(s) need staff attention`, action: 'Review risk flags, missing documents, deadlines, and professional escalation.' });
  const sentQuotes = data.quotes.filter((q) => q.status === 'sent');
  if (sentQuotes.length) alerts.push({ severity: 'medium', key: 'quotes_waiting', label: `${sentQuotes.length} quote(s) waiting for customer approval`, action: 'Follow up without sensitive details and point users back to the dashboard.' });
  const approvedQuotes = data.quotes.filter((q) => q.status === 'customer_approved');
  if (approvedQuotes.length) alerts.push({ severity: 'medium', key: 'approved_quotes_need_payment', label: `${approvedQuotes.length} approved quote(s) need payment request or checkout follow-up`, action: 'Create payment request only after quote approval is recorded.' });
  const appointmentNeeds = data.sessionRequests.filter((r) => ['requested','needs_quote','customer_approved','awaiting_scheduling'].includes(String(r.status || r.session_status || r.appointment_status || 'requested')) && !r.appointment_start && !r.meeting_link);
  if (appointmentNeeds.length) alerts.push({ severity: 'medium', key: 'appointments_need_scheduling', label: `${appointmentNeeds.length} professional session request(s) need scheduling`, action: 'Add Calendly/Zoom/Meet/Teams link, phone instructions, or in-person location.' });
  const queuedMessages = data.transactionalMessages.filter((m) => ['queued_manual_send','queued','draft'].includes(String(m.status || '')));
  if (queuedMessages.length) alerts.push({ severity: 'low', key: 'queued_messages', label: `${queuedMessages.length} transactional message(s) queued for manual sending`, action: 'Send through configured email provider or manual staff process without sensitive tax details.' });
  const unverifiedPros = data.professionals.filter((p) => !p.verified_at && !p.approved_at && String(p.status || '').includes('approved') === false);
  if (unverifiedPros.length) alerts.push({ severity: 'medium', key: 'professional_verification', label: `${unverifiedPros.length} professional profile(s) need verification/approval`, action: 'Complete PTIN/NYTPRIN/EA/CPA/attorney credential checks before release-sensitive work.' });
  const sensitiveDocs = data.documents.filter((d) => d.upload_mode === 'live_sensitive' || d.live_sensitive_uploads_allowed);
  if (sensitiveDocs.length) alerts.push({ severity: 'high', key: 'live_sensitive_document_review', label: `${sensitiveDocs.length} live-sensitive document record(s) found`, action: 'Confirm production security gates, malware scan, access logs, retention policy, and WISP approval.' });
  return { alerts, by_severity: { high: alerts.filter((a) => a.severity === 'high').length, medium: alerts.filter((a) => a.severity === 'medium').length, low: alerts.filter((a) => a.severity === 'low').length } };
}

function buildStaffCockpit(store) {
  const data = collect(store);
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);
  const highPriorityCases = data.cases.filter((c) => c.risk_level === 'high' || statusIncludes(c, ['urgent','deadline','blocked']));
  const waitingClient = data.cases.filter((c) => statusIncludes(c, ['waiting_on_client','missing','quote_sent','payment_requested']));
  const professionalNeeded = data.cases.filter((c) => c.review_recommended_product || c.professional_review_required || c.reviewer_id || statusIncludes(c, ['review','assignment','professional']));
  const appointmentNeeded = data.sessionRequests.filter((r) => !r.appointment_start && !r.meeting_link && !['completed','cancelled','canceled'].includes(String(r.status || r.session_status || '')));
  const revenueCents = data.payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount_total_cents || 0), 0);
  const quotePipelineCents = data.quotes.filter((q) => !['customer_declined','cancelled','voided','expired'].includes(String(q.status || ''))).reduce((sum, q) => sum + Number(q.amount_total_cents || 0), 0);
  const alerts = buildOperationalAlerts(store);
  const funnel = buildConversionFunnel(store);
  const attribution = buildMarketingAttribution(store);
  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_cases: data.cases.length,
      new_cases_7d: data.cases.filter((c) => isAfter(c.created_at, since7)).length,
      new_cases_30d: data.cases.filter((c) => isAfter(c.created_at, since30)).length,
      high_priority_cases: highPriorityCases.length,
      waiting_on_client: waitingClient.length,
      professional_review_needed: professionalNeeded.length,
      appointment_needs_scheduling: appointmentNeeded.length,
      quote_pipeline_cents: quotePipelineCents,
      quote_pipeline_label: moneyLabel(quotePipelineCents),
      paid_revenue_cents: revenueCents,
      paid_revenue_label: moneyLabel(revenueCents),
      queued_messages: data.transactionalMessages.filter((m) => ['queued_manual_send','queued','draft'].includes(String(m.status || ''))).length,
      referral_cases: data.cases.filter((c) => c.referral_code || c.helper_code).length,
      alerts_high: alerts.by_severity.high,
      alerts_medium: alerts.by_severity.medium
    },
    lanes: {
      priority_cases: highPriorityCases.slice(0, 20).map((c) => ({ case_id: c.id, label: caseLabel(c), risk_level: c.risk_level, status: c.status, next_action: c.next_staff_action || c.customer_status_copy?.next_action || 'Review risk, documents, deadline, and professional routing.' })),
      waiting_on_client: waitingClient.slice(0, 20).map((c) => ({ case_id: c.id, label: caseLabel(c), status: c.status, quote_status: c.quote_status, payment_status: c.payment_status, next_action: 'Send safe no-sensitive-details reminder or dashboard link.' })),
      quote_payment: data.quotes.slice(0, 20).map((q) => ({ quote_id: q.id, case_id: q.case_id, email: q.email, product_type: q.product_type, status: q.status, amount_label: moneyLabel(q.amount_total_cents), next_action: q.status === 'customer_approved' ? 'Create payment request.' : q.status === 'sent' ? 'Follow up for customer approval.' : 'Review quote status.' })),
      appointment_scheduling: appointmentNeeded.slice(0, 20).map((r) => ({ request_id: r.id, case_id: r.case_id, email: r.email, final_level: r.final_label || r.final_level || r.requested_level, status: r.status || r.session_status || r.appointment_status || 'requested', mode: r.requested_help_mode || r.requestedHelpMode || '', next_action: 'Confirm appointment time and add Zoom/Meet/Teams/Calendly/phone/in-person details.' })),
      professional_assignment: professionalNeeded.slice(0, 20).map((c) => ({ case_id: c.id, label: caseLabel(c), recommended_product: c.review_recommended_product || c.selected_tier, reviewer_id: c.reviewer_id || '', next_action: c.reviewer_id ? 'Confirm signoff/release gate.' : 'Assign verified PTIN/EA/CPA/attorney reviewer as appropriate.' })),
      referral_attribution: attribution.referrals.slice(0, 20)
    },
    alerts: alerts.alerts,
    funnel,
    attribution_summary: attribution.summary,
    operations_notes: [
      'This cockpit is for operations and marketing measurement only; do not include sensitive tax facts in analytics payloads.',
      'Track source/campaign/referral from first landing page through intake, quote, payment, appointment, and release.',
      'Use staff boards for detailed case work; use this cockpit to see what needs action today.'
    ]
  };
}

function buildAnalyticsImplementationPlan() {
  return {
    event_policy: 'Only record non-sensitive metadata, such as route, source, campaign, event key, case id, product key, and status. Never record SSNs, bank details, tax balances, document contents, full notice text, or private tax facts in analytics events.',
    required_tracking_fields: CAMPAIGN_FIELDS,
    recommended_events: ANALYTICS_EVENT_TAXONOMY,
    next_integrations: [
      'Add privacy-safe conversion pixels only after cookie/privacy policy review.',
      'Wire Stripe webhook paid events into revenue dashboard after live webhook test.',
      'Wire appointment scheduled/completed events from Calendly/Google/Teams/Zoom when provider APIs are enabled.',
      'Add daily staff digest email once transactional email provider and no-sensitive-details templates are live.'
    ]
  };
}

function sanitizeAnalyticsPayload(payload = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(payload || {})) {
    const k = compact(key, 80).replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (!k || /ssn|social|bank|account|routing|password|token|document|notice_text|description|balance/i.test(k)) continue;
    clean[k] = typeof value === 'number' || typeof value === 'boolean' ? value : compact(value, 240);
  }
  return clean;
}

module.exports = {
  ANALYTICS_EVENT_TAXONOMY,
  CAMPAIGN_FIELDS,
  buildStaffCockpit,
  buildConversionFunnel,
  buildMarketingAttribution,
  buildOperationalAlerts,
  buildAnalyticsImplementationPlan,
  sanitizeAnalyticsPayload
};
