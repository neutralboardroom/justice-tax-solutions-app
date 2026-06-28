function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

function getRef() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('ref') || url.searchParams.get('code') || '';
  if (fromUrl) localStorage.setItem('jts_ref', fromUrl);
  return fromUrl || localStorage.getItem('jts_ref') || '';
}

function setReferralFromUrl() {
  const ref = getRef();
  qsa('[name="referral_code"]').forEach((input) => { input.value = ref; });
  const visible = qs('[data-ref-visible]');
  if (visible && ref) visible.textContent = `Referral code applied: ${ref}`;
}

function getMarketingParams() {
  const url = new URL(window.location.href);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','landing_page','conversion_intent'];
  const params = {};
  for (const key of keys) {
    const fromUrl = url.searchParams.get(key);
    if (fromUrl) localStorage.setItem(`jts_${key}`, fromUrl);
    params[key] = fromUrl || localStorage.getItem(`jts_${key}`) || '';
  }
  if (!params.landing_page) params.landing_page = window.location.pathname;
  return params;
}

async function recordAnalyticsEvent(eventKey, payload = {}) {
  try {
    await api('/api/analytics/events', { method: 'POST', body: JSON.stringify({ event_key: eventKey, ...getMarketingParams(), payload: { ...payload, page: window.location.pathname } }) });
  } catch {}
}

function setPath(path) {
  const select = qs('[name="pathway"]');
  if (select) select.value = path;
  const form = qs('#intake');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const response = await fetch(path, { credentials: 'include', ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: false, error: text }; }
  if (!response.ok || json.ok === false) throw new Error(json.error || `Request failed: ${response.status}`);
  return json;
}

async function loadMe() {
  try {
    const json = await api('/api/me');
    const user = json.user;
    qsa('[data-auth="signed-out"]').forEach((el) => el.classList.toggle('hidden', Boolean(user)));
    qsa('[data-auth="signed-in"]').forEach((el) => el.classList.toggle('hidden', !user));
    qsa('[data-user-email]').forEach((el) => { el.textContent = user ? user.email : ''; });
    qsa('[data-user-code]').forEach((el) => { el.textContent = user ? user.referral_code : ''; });
    return user;
  } catch { return null; }
}

async function submitAuth(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#auth-output') || qs('#signup-output') || qs('#login-output');
  if (output) { output.classList.add('show'); output.textContent = mode === 'signup' ? 'Creating account...' : 'Signing in...'; }
  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.referral_code) payload.referral_code = getRef();
    const json = await api(mode === 'signup' ? '/api/signup' : '/api/login', { method: 'POST', body: JSON.stringify(payload) });
    if (output) output.innerHTML = `<p><strong>Signed in as ${escapeHtml(json.user.email)}</strong></p><p>Referral code: <strong>${escapeHtml(json.user.referral_code)}</strong></p><p><a class="button" href="/dashboard.html">Go to dashboard</a></p>`;
    await loadMe();
  } catch (error) {
    if (output) output.textContent = error.message;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST', body: JSON.stringify({}) });
  window.location.href = '/';
}

async function submitIntake(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#intake-output');
  if (output) { output.classList.add('show'); output.textContent = 'Creating your tax concern summary...'; }
  try {
    const formData = new FormData(form);
    if (!formData.get('referral_code')) formData.set('referral_code', getRef());
    const marketingParams = getMarketingParams();
    Object.entries(marketingParams).forEach(([key, value]) => { if (value && !formData.get(key)) formData.set(key, value); });
    await recordAnalyticsEvent('intake_started', { conversion_intent: formData.get('conversion_intent') || formData.get('pathway') || 'not-sure' });
    const response = await fetch('/api/intake', { method: 'POST', body: formData, credentials: 'include' });
    const json = await response.json();
    if (!json.ok) throw new Error(json.error || 'Intake failed.');
    const c = json.case;
    await recordAnalyticsEvent('intake_completed', { case_id: c.id, pathway: c.pathway, risk_level: c.risk_level });
    const riskClass = `status-${c.risk_level}`;
    if (output) output.innerHTML = `
      <h3>Tax concern summary created</h3>
      <p>Case ID: <strong>${escapeHtml(c.id)}</strong></p>
      <p>Risk level: <span class="${riskClass}">${escapeHtml(String(c.risk_level || '').toUpperCase())}</span> · Agency: <strong>${escapeHtml(c.agency)}</strong></p>
      <p><strong>Review gate:</strong> ${escapeHtml(c.review_gate || 'starter-organizer')}</p>
      ${c.review_plan ? `<p><strong>Suggested help:</strong> ${escapeHtml(c.review_plan.tier?.label || c.review_recommended_product || '')} · Readiness ${escapeHtml(String(c.review_plan.readinessScore || 0))}%</p>` : ''}
      ${c.field_fill_plan ? `<p><strong>Document/field-fill readiness:</strong> ${escapeHtml(String(c.field_fill_plan.readiness_score || c.document_readiness_score || 0))}% · ${escapeHtml(String((c.field_fill_plan.field_targets || []).length))} possible field targets</p>` : ''}
      ${c.service_fit ? `<p><strong>Suggested service fit:</strong> ${escapeHtml(c.service_fit.recommended_service?.label || '')} · ${escapeHtml(c.service_fit.reason || '')}</p>` : ''}
      ${c.client_journey ? `<p><strong>Client journey:</strong> step ${escapeHtml(String(c.client_journey.current_step || ''))} of 10 · ${escapeHtml(c.client_journey.client_message || '')}</p>` : ''}
      ${c.documents && c.documents.length ? `<p><strong>Classified uploads:</strong> ${c.documents.map(d => `${escapeHtml(d.original_name)} → ${escapeHtml(d.classification?.label || 'needs review')}`).join('<br>')}</p>` : ''}
      <p><strong>Flags:</strong> ${escapeHtml((c.flags || []).map(f => f.label).join(', ') || 'Needs review after documents are uploaded.')}</p>
      <p><strong>Missing items:</strong></p>
      <ul class="list-clean">${(c.missing_items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <p><strong>Recommended next steps:</strong></p>
      <ul class="list-clean">${(c.recommended_next_steps || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <p><strong>Navigator summary:</strong></p>
      <p>${escapeHtml(c.ai_summary?.content || '').replace(/\n/g, '<br>')}</p>
      <div class="actions"><button type="button" onclick="markDoneUploading('${escapeHtml(c.id)}')">Done uploading for now</button><button type="button" class="secondary" onclick="submitCaseForReview('${escapeHtml(c.id)}')">Submit for human tax review</button><button type="button" class="secondary" onclick="requestPaidReview('${escapeHtml(c.id)}')">Choose paid review</button><a class="button secondary" href="/dashboard.html">Dashboard</a></div>
      <p class="notice-text">Starting summary only. Human/professional review is required before filing, signing, responding to a tax agency, or relying on a tax position.</p>`;
  } catch (error) {
    if (output) output.textContent = `There was a problem: ${error.message}`;
  }
}

async function submitCaseForReview(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/submit-review`, { method: 'POST', body: JSON.stringify({ client_consent: true }) });
    alert(`Submitted for review: ${json.case.id}`);
  } catch (error) { alert(error.message); }
}

async function requestPaidReview(id) {
  try {
    const plan = await api(`/api/cases/${encodeURIComponent(id)}/review-plan`);
    const product = plan.review_plan?.recommendedProduct || 'tax_notice_action_plan';
    await api(`/api/cases/${encodeURIComponent(id)}/request-paid-review`, { method: 'POST', body: JSON.stringify({ product_type: product }) });
    const checkout = await api('/api/payments/create-checkout-session', { method: 'POST', body: JSON.stringify({ case_id: id, product_type: product }) });
    if (checkout.checkout_url) window.location.href = checkout.checkout_url;
    else alert(`Paid review request recorded: ${product}. Stripe is not configured yet, so staff must record/test the payment before release.`);
  } catch (error) { alert(error.message); }
}


async function showPaymentSummary(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/payment-summary`);
    const s = json.payment_summary || {};
    const quotes = (s.quotes || []).slice(0, 3).map((q) => `• ${q.product_label || q.product_type}: $${Math.round((q.amount_total_cents || 0)/100)} (${q.status})`).join('\n') || 'No quotes yet.';
    const payments = (s.payments || []).slice(0, 3).map((p) => `• ${p.product_type}: $${Math.round((p.amount_total_cents || 0)/100)} (${p.status})`).join('\n') || 'No payment requests yet.';
    alert(`Payment quote workflow\n\nNext payment step: ${s.nextPaymentStep || ''}\nPayment required before release: ${s.paymentRequiredBeforeRelease ? 'yes' : 'no'}\n\nQuotes:\n${quotes}\n\nPayments:\n${payments}\n\nNo-sensitive-details email policy: messages should tell you to sign in rather than putting tax facts in email.`);
  } catch (error) { alert(error.message); }
}

async function requestQuote(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/quote-request`, { method: 'POST', body: JSON.stringify({ requires_custom_quote: true, quote_note: 'Customer asked for price/scope confirmation before paid work.' }) });
    alert(`Quote request recorded.\nStatus: ${json.quote?.status || ''}\nProduct: ${json.quote?.product_label || json.quote?.product_type || ''}\nStaff can send a quote and request approval before payment.`);
  } catch (error) { alert(error.message); }
}


async function showPreSessionReadiness(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/pre-session-readiness`);
    const r = json.readiness || {};
    const route = json.routing || {};
    const missingBasics = (r.missingBasics || []).map((x) => `• ${x}`).join('\n') || 'None listed';
    const docs = (r.likelyMissingDocuments || []).slice(0, 8).map((x) => `• ${x}`).join('\n') || 'None listed';
    alert([
      `Professional session readiness: ${r.readinessScore || 0}%`,
      `Stage: ${r.stage || ''}`,
      `Route: ${route.finalLabel || route.finalLevel || ''}`,
      `Reason: ${route.plainEnglish || ''}`,
      '',
      'Missing basics:',
      missingBasics,
      '',
      'Likely documents/questions:',
      docs
    ].join('\n'));
  } catch (error) { alert(error.message); }
}

async function requestProfessionalSession(id) {
  const requested = prompt('What kind of professional help do you want? Examples: PTIN reassurance, EA tax debt help, CPA business/gig review, tax attorney strategy. You can also say you just want reassurance that the forms are correct.');
  if (!requested) return;
  try {
    const payload = { customer_requested_professional: true, requested_reason: requested, requested_level: /attorney|lawyer|legal/i.test(requested) ? 'tax_attorney_review' : /cpa|business|gig|schedule c|1099/i.test(requested) ? 'cpa_review' : /ea|debt|irs|notice|collection|oic|installment/i.test(requested) ? 'enrolled_agent_review' : 'ptin_preparer_review' };
    const json = await api(`/api/cases/${encodeURIComponent(id)}/professional-session-request`, { method: 'POST', body: JSON.stringify(payload) });
    alert([
      'Professional session request saved.',
      `Level: ${json.routing?.finalLabel || json.routing?.finalLevel || ''}`,
      `Readiness: ${json.readiness?.readinessScore || 0}%`,
      `Status: ${json.request?.status || ''}`,
      '',
      json.routing?.plainEnglish || ''
    ].join('\n'));
    await loadDashboard();
  } catch (error) { alert(error.message); }
}

async function showProfessionalSessionEstimate() {
  try {
    const json = await api('/api/platform/professional-session-estimate', { method: 'POST', body: JSON.stringify({ customer_requested_professional: true, requested_reason: 'customer wants reassurance that forms are correct', requested_level: 'ptin_preparer_review' }) });
    alert([
      'Sample reassurance estimate',
      `Level: ${json.estimate?.routing?.finalLabel || ''}`,
      `Reason: ${json.estimate?.routing?.professionalReason || ''}`,
      '',
      json.estimate?.message || ''
    ].join('\n'));
  } catch (error) { alert(error.message); }
}

async function markDoneUploading(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/done-uploading`, { method: 'POST', body: JSON.stringify({}) });
    const missing = (json.field_fill_plan?.missing_document_types || []).join(', ');
    alert(`${json.message}${missing ? `\n\nPossible missing items: ${missing}` : ''}`);
  } catch (error) { alert(error.message); }
}

async function showFieldPlan(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/field-fill-plan`);
    const targets = (json.field_fill_plan.field_targets || []).map((t, i) => `${i + 1}. ${t.target} from ${t.source} (${t.status})${t.extracted_value_preview ? ` = ${t.extracted_value_preview}` : ''}`).join('\n') || 'No field targets yet.';
    const missing = (json.field_fill_plan.missing_document_types || []).join(', ') || 'No obvious missing document type from the current rules.';
    alert(`Document/field-fill readiness: ${json.field_fill_plan.readiness_score}%\n\nMissing: ${missing}\n\nTargets:\n${targets}`);
  } catch (error) { alert(error.message); }
}

async function showCaseExtraction(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}`);
    const docs = (json.documents || []).map((d) => {
      const profile = d.extraction_profile || {};
      const fields = (profile.extracted_fields || d.extracted_fields || []).map((f) => `    - ${f.label || f.key}: ${f.value || f.corrected_value || ''} (${f.confidence_label || 'low'}, ${f.status || 'needs verification'})`).join('\n');
      return `• ${d.original_name}: ${d.classification?.label || 'needs review'} · extraction ${profile.extraction_confidence_score || d.extraction_confidence_score || 0}% · ${profile.extraction_status || d.extraction_status || 'not attempted'}\n${fields || '    no extracted fields yet'}`;
    }).join('\n\n') || 'No documents uploaded.';
    alert(`Extraction is a verification-only starter layer. Do not file or respond based only on extracted values.\n\n${docs}`);
  } catch (error) { alert(error.message); }
}

async function submitReferral(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#referral-output');
  if (output) { output.classList.add('show'); output.textContent = 'Creating referral tools...'; }
  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const json = await api('/api/referrals', { method: 'POST', body: JSON.stringify(payload) });
    renderReferral(json.referral, output);
  } catch (error) {
    if (output) output.textContent = `There was a problem: ${error.message}`;
  }
}

function renderReferral(r, target) {
  if (!target || !r) return;
  target.innerHTML = `
    <h3>Referral tools ready</h3>
    <p>Referral code: <strong>${escapeHtml(r.code)}</strong></p>
    <p>Tracked link: <a href="${escapeAttr(r.tracked_start_link || r.link)}" target="_blank" rel="noopener">${escapeHtml(r.tracked_start_link || r.link)}</a></p>
    <img class="qr-preview" src="${escapeAttr(r.qr_url)}" alt="Referral QR code for ${escapeAttr(r.code)}">
    <div class="actions">
      <a class="button" href="${escapeAttr(r.flyer_url)}" target="_blank" rel="noopener">Open flyer PDF</a>
      <a class="button secondary" href="${escapeAttr(r.qr_url)}?download=1" target="_blank" rel="noopener">Download QR code</a>
      <a class="button secondary" href="/referral-tools.html?code=${encodeURIComponent(r.code)}">Referral dashboard</a>
    </div>
    <p class="notice-text">Rewards apply only to eligible paid platform/professional-review fees. Taxes, penalties, interest, refunds, chargebacks, and separate third-party professional fees do not qualify.</p>`;
}

async function loadReferralDashboard() {
  const code = getRef() || new URL(window.location.href).searchParams.get('code');
  const box = qs('#referral-dashboard');
  if (!box) return;
  try {
    let json;
    let guide = { guide: {} };
    try { guide = await api('/api/platform/referral-partner-guide'); } catch {}
    if (code) json = await api(`/api/referrals/${encodeURIComponent(code)}`);
    else json = await api('/api/referrals/me');
    if (json.referral) { renderReferral(json.referral, box); if (guide.guide?.public_explanation) box.insertAdjacentHTML('beforeend', `<div class="card"><h3>Partner guide</h3><p>${escapeHtml(guide.guide.public_explanation)}</p><ul class="list-clean">${(guide.guide.partner_steps || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`); }
    else if (json.referralCode) {
      box.innerHTML = `
        <h3>Your referral tools</h3>
        <div class="stat-row"><div class="stat"><strong>${json.helperStats.scans}</strong>Scans</div><div class="stat"><strong>${json.helperStats.accounts}</strong>Accounts</div><div class="stat"><strong>${json.helperStats.cases}</strong>Cases</div><div class="stat"><strong>$${Math.round((json.summary.totalEarnedCents || 0)/100)}</strong>Tracked rewards</div></div>
        <p>Code: <strong>${escapeHtml(json.referralCode)}</strong></p>
        <p>Tracked link: <a href="${escapeAttr(json.trackedStartLink)}" target="_blank" rel="noopener">${escapeHtml(json.trackedStartLink)}</a></p>
        <img class="qr-preview" src="${escapeAttr(json.qrCodeImageUrl)}" alt="Referral QR code">
        <div class="actions"><a class="button" href="${escapeAttr(json.flyerPdfUrl)}" target="_blank">Print flyer</a><a class="button secondary" href="${escapeAttr(json.qrCodeImageUrl)}?download=1" target="_blank">Download QR</a></div>${guide.guide?.public_explanation ? `<div class="notice-text"><strong>Partner guide:</strong> ${escapeHtml(guide.guide.public_explanation)}</div>` : ''}`;
    }
  } catch (error) {
    box.innerHTML = `<p>${escapeHtml(error.message)}</p><p><a class="button" href="/signup.html">Create account</a></p>`;
  }
}

async function showReleaseSummary(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/release-summary`);
    const notes = (json.notes || []).map((n) => `- ${n.note_type}: ${n.body}`).join('\n') || 'No released notes yet.';
    alert(`${json.message}\n\n${notes}`);
  } catch (error) { alert(error.message); }
}

async function showSimpleStatus(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/simple-status`);
    const st = json.simple_status || {};
    const progress = (st.progress || []).map((step) => `${step.done ? '✓' : '•'} ${step.label}: ${step.clientText}`).join('\n');
    const missing = (st.missing_items || []).map((x) => `• ${x}`).join('\n');
    const blockers = (st.blockers || []).map((x) => `• ${x}`).join('\n') || 'No immediate client blockers listed.';
    alert(`${st.title}\nStatus: ${st.plain_status}\nAgency: ${st.agency}\n\nNext step:\n${st.next_step}\n\nProgress:\n${progress}\n\nMissing or needed:\n${missing}\n\nBefore paid/review release:\n${blockers}`);
  } catch (error) { alert(error.message); }
}

async function showCustomerStatus(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/customer-status-copy`);
    const st = json.customer_status || {};
    const messages = (st.messages || []).map((m) => `• ${m.message}`).join('\n');
    const safe = (st.safe_to_do_now || []).map((x) => `• ${x}`).join('\n');
    const missing = (st.missing_items || []).map((x) => `• ${x}`).join('\n') || 'No missing items listed yet.';
    alert(`${st.label || 'Case status'}\n\n${st.short_message || ''}\n\nNext customer action:\n${st.next_customer_action || ''}\n\nMessages:\n${messages}\n\nMissing items:\n${missing}\n\nSafe to do now:\n${safe}\n\n${st.release_guardrail || ''}`);
  } catch (error) { alert(error.message); }
}

function renderCaseCard(c) {
  const riskClass = escapeAttr(c.risk_level || 'medium');
  const label = String(c.pathway || 'tax help').replace(/[-_]/g, ' ');
  const customer = c.customer_status_copy || {};
  const status = customer.label || (c.status === 'released_to_client' ? 'Reviewed summary available' : c.client_done_uploading ? 'Ready for staff look' : (c.documents && c.documents.length) ? 'Documents received' : 'Started');
  const next = customer.next_customer_action || (c.recommended_next_steps || [])[0] || 'Upload any tax letter or tax form you have, then mark Done uploading for now.';
  const missing = (customer.missing_items || c.missing_items || []).slice(0, 3).join('; ') || 'We will confirm after review.';
  const service = c.service_fit?.recommended_service?.label || c.review_plan?.tier?.label || c.review_recommended_product || c.review_gate || 'Starting summary';
  return `<div class="card case-card ${riskClass}">
    <div class="case-topline"><h3>${escapeHtml(label)}</h3><span class="status-text">${escapeHtml(status)}</span></div>
    ${customer.calm_message ? `<p class="notice-text">${escapeHtml(customer.calm_message)}</p>` : ''}
    <p><strong>Next step:</strong> ${escapeHtml(next)}</p>
    <p><strong>Agency:</strong> ${escapeHtml(c.agency || 'to be confirmed')} · <strong>Risk:</strong> ${escapeHtml(c.risk_level || 'medium')} ${c.payment_status ? `· <strong>Payment:</strong> ${escapeHtml(c.payment_status)}` : ''}</p>
    <p><strong>Suggested help:</strong> ${escapeHtml(service)}</p>
    <p class="small"><strong>May still need:</strong> ${escapeHtml(missing)}</p>
    ${customer.release_guardrail ? `<p class="small"><strong>Release rule:</strong> ${escapeHtml(customer.release_guardrail)}</p>` : ''}
    <div class="actions case-actions"><button type="button" onclick="showSimpleStatus('${escapeHtml(c.id)}')">Plain status</button><button type="button" class="secondary" onclick="showCustomerStatus('${escapeHtml(c.id)}')">Customer message</button><button type="button" class="secondary" onclick="markDoneUploading('${escapeHtml(c.id)}')">Done uploading</button><button type="button" class="secondary" onclick="showActionPlan('${escapeHtml(c.id)}')">Next steps</button><button type="button" class="secondary" onclick="showClientJourney('${escapeHtml(c.id)}')">Journey</button><button type="button" class="secondary" onclick="showFieldPlan('${escapeHtml(c.id)}')">Document map</button><button type="button" class="secondary" onclick="showCaseExtraction('${escapeHtml(c.id)}')">Document review</button><button type="button" class="secondary" onclick="submitCaseForReview('${escapeHtml(c.id)}')">Send for review</button><button type="button" class="secondary" onclick="requestPaidReview('${escapeHtml(c.id)}')">Choose paid review</button><button type="button" class="secondary" onclick="showPaymentSummary('${escapeHtml(c.id)}')">Quote approval</button><button type="button" class="secondary" onclick="requestQuote('${escapeHtml(c.id)}')">Request quote</button><button type="button" class="secondary" onclick="showPreSessionReadiness('${escapeHtml(c.id)}')">Session readiness</button><button type="button" class="secondary" onclick="requestProfessionalSession('${escapeHtml(c.id)}')">Request professional reassurance</button><button type="button" class="secondary" onclick="showAppointmentOptions('${escapeHtml(c.id)}')">Appointment options</button><button type="button" class="secondary" onclick="requestAppointmentScheduling('${escapeHtml(c.id)}')">Request scheduling</button><button type="button" class="secondary" onclick="showReleaseSummary('${escapeHtml(c.id)}')">Reviewed summary</button></div>
  </div>`;
}

async function loadDashboard() {
  const box = qs('#case-dashboard');
  if (!box) return;
  try {
    const me = await loadMe();
    if (!me) { box.innerHTML = '<p>Please sign in to see your cases and referral tools.</p><p><a class="button" href="/signin.html">Sign in</a> <a class="button secondary" href="/signup.html">Create account</a></p>'; return; }
    const json = await api('/api/cases');
    const ref = await api('/api/referrals/me');
    const caseHtml = (json.cases || []).length ? json.cases.map(renderCaseCard).join('') : '<div class="card"><h3>Start free when you are ready</h3><p>You do not have a tax case yet. Start with a tax letter, tax debt question, return review, or gig-worker issue.</p><p><a class="button" href="/#start">Start free</a></p></div>';
    box.innerHTML = `<div class="dashboard-intro"><div><h2>Your tax help dashboard</h2><p>See what we received, what may still be missing, and what the next safest step is.</p></div><a class="button secondary" href="/#start">Start another case</a></div><div class="grid two"><div>${caseHtml}</div><div><div class="card"><h2>Your referral tools</h2><div class="stat-row"><div class="stat"><strong>${ref.helperStats.scans}</strong>Scans</div><div class="stat"><strong>${ref.helperStats.accounts}</strong>Accounts</div><div class="stat"><strong>${ref.helperStats.cases}</strong>Cases</div><div class="stat"><strong>$${Math.round((ref.summary.totalEarnedCents || 0)/100)}</strong>Rewards</div></div><p>Referral code: <strong>${escapeHtml(ref.referralCode)}</strong></p><p class="small">Share your link or flyer so people can start free. Rewards are tracked only when a qualified paid case is recorded and not refunded.</p><div class="actions"><a class="button" href="${escapeAttr(ref.flyerPdfUrl)}" target="_blank">Print flyer</a><a class="button secondary" href="/referral-tools.html">Referral dashboard</a></div></div></div></div>`;
  } catch (error) { box.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}

async function loadStaff() {
  const box = qs('#staff-dashboard');
  if (!box) return;
  try {
    const inputToken = qs('[name="admin_token"]')?.value || '';
    if (inputToken) localStorage.setItem('jts_admin_token', inputToken);
    const token = inputToken || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const overview = await api('/api/staff/overview', { headers });
    const queue = await api('/api/staff/review-queue', { headers });
    const pros = await api('/api/staff/professionals', { headers });
    const docQueue = await api('/api/staff/document-review-queue', { headers });
    let workflow = { workflow_board: { lanes: [] } };
    let sessionBoard = { board: { summary: {}, lanes: {} } };
    let opsBoard = { board: { readiness: {}, credential_renewal_queue: [], assignment_matrix: { cases_needing_assignment: 0 } } };
    let paymentBoard = { board: { counts: {}, quoteLane: [], paymentLane: [], messageLane: [], appointmentMessagingLane: [] }, workflow: {} };
    try { workflow = await api('/api/staff/workflow-board', { headers }); } catch {}
    try { sessionBoard = await api('/api/staff/professional-session-board', { headers }); } catch {}
    try { opsBoard = await api('/api/staff/professional-operations-board', { headers }); } catch {}
    try { paymentBoard = await api('/api/staff/payment-operations-board', { headers }); } catch {}
    const readinessWarnings = (overview.readiness?.checks || []).filter(c => !c.ok).map(c => c.label).slice(0, 4).join(', ');
    const workflowRows = ((workflow.workflow_board || {}).lanes || []).map((lane) => `<div class="card"><h3>${escapeHtml(lane.label || lane.key)}</h3><p class="small">${escapeHtml(lane.plain || '')}</p>${(lane.cases || []).slice(0,6).map(c => `<div class="mini-row"><strong>${escapeHtml(c.risk_level)} · ${escapeHtml(c.pathway)}</strong><br><span>${escapeHtml(c.email || 'no email')} · ${escapeHtml(c.customer_status || c.status || '')}</span><br><span>${escapeHtml(c.next_staff_action || '')}</span></div>`).join('') || '<p>No cases in this lane.</p>'}</div>`).join('');
    const sessionSummary = sessionBoard.board?.summary || {};
    const requestedSessions = (sessionBoard.board?.lanes?.requestedNeedsCleanup || []).concat(sessionBoard.board?.lanes?.readyForConfirmation || []).slice(0,8).map(r => `<div class="mini-row"><strong>${escapeHtml(r.final_label || r.final_level || '')}</strong><br><span>${escapeHtml(r.email || 'no email')} · ${escapeHtml(r.status || '')} · readiness ${escapeHtml(String(r.readiness_score || 0))}%</span></div>`).join('') || '<p>No professional-session requests yet.</p>';
    const suggestedSessions = (sessionBoard.board?.lanes?.suggestedProfessionalReview || []).slice(0,6).map(row => `<div class="mini-row"><strong>${escapeHtml(row.routing?.finalLabel || '')}</strong><br><span>${escapeHtml(row.email || 'no email')} · ${escapeHtml(row.pathway || '')} · ${escapeHtml(row.routing?.professionalReason || '')}</span></div>`).join('') || '<p>No suggested professional-session previews.</p>';
    const ops = opsBoard.board || {};
    const opsReadiness = ops.readiness || {};
    const credentialRows = (ops.credential_renewal_queue || []).slice(0,6).map(row => `<div class="mini-row"><strong>${escapeHtml(row.professional?.name || 'Professional')}</strong><br><span>${escapeHtml(row.professional?.role_label || '')} · ${escapeHtml(row.priority || '')} · score ${escapeHtml(String(row.compliance_score || 0))}%</span><br><span>${escapeHtml((row.blocking_issues || []).join(', ') || 'credential verification monitoring')}</span></div>`).join('') || '<p>No credential renewal blockers yet.</p>';
    const roleRows = (opsReadiness.role_readiness || []).map(row => `<div class="mini-row"><strong>${escapeHtml(row.role_label || row.role)}</strong><br><span>${escapeHtml(String(row.approved_professionals || 0))} approved · ${escapeHtml(row.status || '')}</span></div>`).join('') || '<p>No role readiness data yet.</p>';
    const payCounts = paymentBoard.board?.counts || {};
    const quoteRows = (paymentBoard.board?.quoteLane || []).slice(0,6).map(q => `<div class="mini-row"><strong>${escapeHtml(q.product_type || '')} · ${escapeHtml(q.amount || '')}</strong><br><span>${escapeHtml(q.email || '')} · ${escapeHtml(q.status || '')}</span></div>`).join('') || '<p>No quotes yet.</p>';
    const paymentRows = (paymentBoard.board?.paymentLane || []).slice(0,6).map(p => `<div class="mini-row"><strong>${escapeHtml(p.product_type || '')} · ${escapeHtml(p.amount || '')}</strong><br><span>${escapeHtml(p.email || '')} · ${escapeHtml(p.status || '')}</span></div>`).join('') || '<p>No payment requests yet.</p>';
    const messageRows = (paymentBoard.board?.messageLane || []).slice(0,6).map(m => `<div class="mini-row"><strong>${escapeHtml(m.template_key || '')}</strong><br><span>${escapeHtml(m.email || '')} · ${escapeHtml(m.status || '')}</span></div>`).join('') || '<p>No queued transactional messages yet.</p>';
    const appointmentMessageRows = (paymentBoard.board?.appointmentMessagingLane || []).slice(0,6).map(a => `<div class="mini-row"><strong>${escapeHtml(a.meeting_provider || 'appointment')}</strong><br><span>${escapeHtml(a.email || '')} · ${escapeHtml(a.appointment_start || '')} · confirmation ${escapeHtml(a.confirmation_message_sent_at ? 'sent' : 'needed')}</span></div>`).join('') || '<p>No appointment confirmations needed yet.</p>';

    box.innerHTML = `<div class="stat-row"><div class="stat"><strong>${overview.lanes.urgent}</strong>Urgent</div><div class="stat"><strong>${overview.lanes.reviewRequests}</strong>Review requests</div><div class="stat"><strong>${overview.lanes.unreleased}</strong>Unreleased</div><div class="stat"><strong>${overview.lanes.referralsPending}</strong>Referral rewards</div><div class="stat"><strong>${(docQueue.cases || []).filter(c => c.client_done_uploading).length}</strong>Done uploading</div></div>${readinessWarnings ? `<p class="notice-text">Production gaps: ${escapeHtml(readinessWarnings)}</p>` : ''}<div class="card wide"><h2>Production workflow board</h2><p class="notice-text">Cases are grouped by the next safe operational action: intake, documents, missing info, professional review, client approval, and release gate.</p><div class="grid two">${workflowRows}</div><div class="actions"><button type="button" class="secondary" onclick="seedDemoData()">Seed safe demo cases</button></div></div><div class="card wide"><h2>Professional session board</h2><p class="notice-text">Professionals can be routed because the case requires it or because the customer wants reassurance and confidence.</p><div class="stat-row"><div class="stat"><strong>${escapeHtml(String(sessionSummary.requestedNeedsCleanup || 0))}</strong>Need cleanup</div><div class="stat"><strong>${escapeHtml(String(sessionSummary.readyForConfirmation || 0))}</strong>Ready</div><div class="stat"><strong>${escapeHtml(String(sessionSummary.quoteApprovalNeeded || 0))}</strong>Quote approval</div></div><div class="grid two"><div><h3>Requested sessions</h3>${requestedSessions}</div><div><h3>Suggested review sessions</h3>${suggestedSessions}</div></div></div><div class="card wide"><h2>Payment quote workflow + appointment confirmations</h2><p class="notice-text">Quote approval, payment requests, receipts, Appointment confirmations, reminders, reschedule/cancel events, and No-sensitive-details email messaging are tracked before release or professional time.</p><div class="stat-row"><div class="stat"><strong>${escapeHtml(String(payCounts.quotes_need_customer_approval || 0))}</strong>Quote approval</div><div class="stat"><strong>${escapeHtml(String(payCounts.payment_requests_unpaid || 0))}</strong>Unpaid</div><div class="stat"><strong>${escapeHtml(String(payCounts.messages_queued_manual_send || 0))}</strong>Messages queued</div><div class="stat"><strong>${escapeHtml(String(payCounts.appointment_confirmations_needed || 0))}</strong>Confirmations</div></div><div class="grid two"><div><h3>Quotes</h3>${quoteRows}</div><div><h3>Payments</h3>${paymentRows}</div><div><h3>Safe email/message queue</h3>${messageRows}</div><div><h3>Appointment messaging</h3>${appointmentMessageRows}</div></div></div><div class="card wide"><h2>Professional operations + credential verification</h2><p class="notice-text">Professional operations now checks credential verification, reviewer disclosure, assignment readiness, signoff records, and renewal monitoring before final-output release.</p><div class="stat-row"><div class="stat"><strong>${escapeHtml(String(opsReadiness.approved_professional_count || 0))}</strong>Approved pros</div><div class="stat"><strong>${escapeHtml(String(opsReadiness.assignment_summary?.cases_needing_assignment || 0))}</strong>Need assignment</div><div class="stat"><strong>${escapeHtml(String(opsReadiness.credential_renewal_queue_count || 0))}</strong>Credential queue</div></div><div class="grid two"><div><h3>Role readiness</h3>${roleRows}</div><div><h3>Credential verification queue</h3>${credentialRows}</div></div><p class="small">Client-facing reviewer disclosure is available from /api/cases/:id/reviewer-disclosure after assignment/signoff.</p></div><div class="grid two"><div><h2>Review queue</h2>${(queue.queue || []).slice(0,20).map(c => `<div class="card case-card ${escapeAttr(c.risk_level)}"><h3>${escapeHtml(c.pathway)} · ${escapeHtml(c.email || 'no email')}</h3><p>Status: ${escapeHtml(c.status)} · Risk: ${escapeHtml(c.risk_level)} · Agency: ${escapeHtml(c.agency)}</p><p>Recommended: ${escapeHtml(c.review_plan?.tier?.label || c.review_gate || '')} · Readiness ${escapeHtml(String(c.review_plan?.readinessScore || 0))}%</p><p>Assigned: ${escapeHtml(c.assigned_professional_id || 'unassigned')}</p></div>`).join('') || '<p>No cases in review queue yet.</p>'}</div><div><h2>Document review queue</h2>${(docQueue.cases || []).slice(0,10).map(c => `<div class="card case-card ${escapeAttr(c.risk_level)}"><h3>${escapeHtml(c.pathway)} · ${escapeHtml(c.email || 'no email')}</h3><p>Docs: ${escapeHtml(String(c.document_count || 0))} · Readiness: ${escapeHtml(String(c.document_readiness_score || 0))}% · Done uploading: ${c.client_done_uploading ? 'yes' : 'no'}</p><p>Missing: ${escapeHtml((c.missing_document_types || []).join(', ') || 'none flagged')}</p></div>`).join('') || '<p>No document review cases yet.</p>'}<h2>Professionals</h2>${(pros.professionals || []).slice(0,20).map(p => `<div class="card"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.role_label || p.role_key)} · ${escapeHtml(p.email)}</p><p>${escapeHtml(p.credentials || '')}</p><p>Compliance score: ${escapeHtml(String(p.compliance_score || 0))}% · PTIN: ${escapeHtml(p.ptin_status || 'not recorded')} · credential verification: ${escapeHtml(p.verification_plan?.approved_for_assignment ? 'approved' : 'not ready')}</p><p class="small">Reviewer disclosure: ${escapeHtml(p.verification_plan?.disclosure || '')}</p></div>`).join('') || '<p>No professionals created yet. Use POST /api/staff/professionals.</p>'}</div></div>`;
  } catch (error) { box.innerHTML = `<p>${escapeHtml(error.message)}</p><p class="notice-text">Use x-admin-token via API, or sign in with a staff account.</p>`; }
}



async function loadStaffCockpit() {
  const box = qs('#staff-cockpit');
  if (!box) return;
  try {
    const inputToken = qs('[name="admin_token"]')?.value || '';
    if (inputToken) localStorage.setItem('jts_admin_token', inputToken);
    const token = inputToken || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const json = await api('/api/staff/cockpit', { headers });
    const cockpit = json.cockpit || {};
    const summary = cockpit.summary || {};
    const alerts = (cockpit.alerts || []).slice(0, 10).map((a) => `<div class="mini-row"><strong>${escapeHtml(a.severity || '')}: ${escapeHtml(a.label || '')}</strong><br><span>${escapeHtml(a.action || '')}</span></div>`).join('') || '<p>No urgent operational alerts yet.</p>';
    const priority = (cockpit.lanes?.priority_cases || []).slice(0, 8).map((c) => `<div class="mini-row"><strong>${escapeHtml(c.label || c.case_id)}</strong><br><span>${escapeHtml(c.next_action || '')}</span></div>`).join('') || '<p>No high-priority cases yet.</p>';
    const quotes = (cockpit.lanes?.quote_payment || []).slice(0, 8).map((q) => `<div class="mini-row"><strong>${escapeHtml(q.amount_label || '')} · ${escapeHtml(q.product_type || '')}</strong><br><span>${escapeHtml(q.email || '')} · ${escapeHtml(q.status || '')} · ${escapeHtml(q.next_action || '')}</span></div>`).join('') || '<p>No quote/payment items yet.</p>';
    const appointments = (cockpit.lanes?.appointment_scheduling || []).slice(0, 8).map((a) => `<div class="mini-row"><strong>${escapeHtml(a.final_level || 'Professional session')}</strong><br><span>${escapeHtml(a.email || '')} · ${escapeHtml(a.status || '')} · ${escapeHtml(a.next_action || '')}</span></div>`).join('') || '<p>No appointment scheduling items yet.</p>';
    const referrals = (cockpit.lanes?.referral_attribution || []).slice(0, 8).map((r) => `<div class="mini-row"><strong>${escapeHtml(r.code || '')} · ${escapeHtml(r.partner_name || '')}</strong><br><span>${escapeHtml(String(r.scans || 0))} scans · ${escapeHtml(String(r.cases || 0))} cases · $${Math.round((r.reward_cents || 0)/100)} rewards</span></div>`).join('') || '<p>No referral attribution rows yet.</p>';
    const funnelSteps = (cockpit.funnel?.steps || []).map((step) => `<div class="stat"><strong>${escapeHtml(String(step.count || 0))}</strong>${escapeHtml(step.label || step.key)}<br><small>${escapeHtml(String(step.conversion_from_case_created_pct || 0))}% from cases</small></div>`).join('');
    box.innerHTML = `<div class="stat-row"><div class="stat"><strong>${escapeHtml(String(summary.total_cases || 0))}</strong>Total cases</div><div class="stat"><strong>${escapeHtml(String(summary.new_cases_7d || 0))}</strong>New 7 days</div><div class="stat"><strong>${escapeHtml(String(summary.high_priority_cases || 0))}</strong>Priority</div><div class="stat"><strong>${escapeHtml(summary.quote_pipeline_label || '$0')}</strong>Quote pipeline</div><div class="stat"><strong>${escapeHtml(summary.paid_revenue_label || '$0')}</strong>Paid</div></div><div class="card wide"><h2>Staff Cockpit + Analytics</h2><p class="notice-text">Privacy-safe analytics cockpit: source/campaign/referral, Started intake, completed intake, quote requests, payments, appointments, professional review, and release. No sensitive tax facts belong in analytics events.</p><div class="stat-row">${funnelSteps}</div></div><div class="grid two"><div class="card"><h3>Operational alerts</h3>${alerts}</div><div class="card"><h3>Priority cases</h3>${priority}</div><div class="card"><h3>Quotes and payments</h3>${quotes}</div><div class="card"><h3>Appointment scheduling</h3>${appointments}</div><div class="card"><h3>Referral attribution</h3>${referrals}</div><div class="card"><h3>Marketing tracking</h3><p>Tracked sources: ${escapeHtml(String(cockpit.attribution_summary?.tracked_sources || 0))}</p><p>Tracked campaigns: ${escapeHtml(String(cockpit.attribution_summary?.tracked_campaigns || 0))}</p><p>QR scans: ${escapeHtml(String(cockpit.attribution_summary?.qr_scans || 0))}</p><p class="small">Use UTM fields, referral codes, landing pages, and conversion intent on every marketing page before broad paid traffic.</p></div></div>`;
  } catch (error) { box.innerHTML = `<p>${escapeHtml(error.message)}</p><p class="notice-text">Use x-admin-token via API, or sign in with a staff account.</p>`; }
}

async function seedDemoData() {
  try {
    const token = qs('[name="admin_token"]')?.value || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const json = await api('/api/staff/demo-data/seed', { method: 'POST', headers, body: JSON.stringify({}) });
    alert(json.seeded ? `Seeded ${json.cases.length} safe demo cases.` : (json.message || 'Demo data already exists.'));
    await loadStaff();
  await loadStaffCockpit();
  } catch (error) { alert(error.message); }
}

async function loadCompetitorIntel() {
  const box = qs('#competitor-intel');
  if (!box) return;
  try {
    const json = await api('/api/platform/competitor-intelligence');
    const groups = (json.competitor_map || []).map((group) => `<div class="card"><h2>${escapeHtml(group.group.replace(/_/g, ' '))}</h2><p><strong>Tracked:</strong> ${escapeHtml(group.companies.join(', '))}</p><p><strong>Adapt:</strong></p><ul class="list-clean">${group.what_to_adapt.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p><strong>Avoid:</strong></p><ul class="list-clean">${group.what_to_avoid.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`).join('');
    const patterns = (json.workflow_patterns || []).map((pattern) => `<div class="card"><h3>${escapeHtml(pattern.label)}</h3><p>${escapeHtml(pattern.mechanism)}</p><p class="notice-text">Status: ${escapeHtml(pattern.jts_status)} · Inspired by ${escapeHtml(pattern.inspired_by.join(', '))}</p></div>`).join('');
    box.innerHTML = `<div class="card"><h2>Summary</h2><p>${escapeHtml(json.summary.strategic_position)}</p><p>Tracked groups: ${escapeHtml(String(json.summary.total_groups))} · Companies/platforms tracked: ${escapeHtml(String(json.summary.total_companies_tracked))}</p></div>${groups}<div class="card wide"><h2>Workflow patterns added or planned</h2><div class="grid two">${patterns}</div></div>`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}


async function loadDocumentVerification() {
  const box = qs('#document-verification');
  if (!box) return;
  try {
    const inputToken = qs('[name="admin_token"]')?.value || '';
    if (inputToken) localStorage.setItem('jts_admin_token', inputToken);
    const token = inputToken || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const controls = await api('/api/tax/extraction-controls');
    const json = await api('/api/staff/document-verification-queue', { headers });
    const rows = (json.queue || []).slice(0, 60).map((row) => `<div class="card case-card ${escapeAttr(row.risk_level)}"><h3>${escapeHtml(row.document_label)} · ${escapeHtml(row.original_name || '')}</h3><p>Case: ${escapeHtml(row.case_id)} · ${escapeHtml(row.email || 'no email')} · ${escapeHtml(row.pathway || '')}</p><p>Extraction: ${escapeHtml(String(row.extraction_confidence_score || 0))}% ${escapeHtml(row.extraction_confidence_label || '')} · Status: ${escapeHtml(row.extraction_status || '')} · OCR required: ${row.ocr_required ? 'yes' : 'no'}</p><p>Fields needing verification: ${escapeHtml(String(row.fields_needing_verification || 0))}</p><div class="actions"><button type="button" onclick="showDocumentExtraction('${escapeAttr(row.case_id)}','${escapeAttr(row.document_id)}')">View extraction</button></div></div>`).join('') || '<p>No documents are waiting for verification yet.</p>';
    box.innerHTML = `<div class="card"><h2>Verification controls</h2><ul class="list-clean">${(controls.controls || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul><p class="notice-text">Production OCR configured: ${controls.production_ocr_provider_configured ? 'yes' : 'no'}</p></div><div class="stat-row"><div class="stat"><strong>${(json.queue || []).length}</strong>Documents</div><div class="stat"><strong>${(json.queue || []).filter(r => r.ocr_required).length}</strong>Need OCR</div><div class="stat"><strong>${(json.queue || []).reduce((sum, r) => sum + Number(r.fields_needing_verification || 0), 0)}</strong>Fields to verify</div></div>${rows}`;
  } catch (error) { box.innerHTML = `<p>${escapeHtml(error.message)}</p><p class="notice-text">Use x-admin-token via API, or sign in with a staff account.</p>`; }
}

async function showDocumentExtraction(caseId, documentId) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/extraction`);
    const d = json.document || {};
    const profile = d.extraction_profile || {};
    const fields = (profile.extracted_fields || d.extracted_fields || []).map((f) => `- ${f.label || f.key}: ${f.value || ''} (${f.confidence_label || 'low'}; ${f.status || 'needs verification'})`).join('\n') || 'No fields extracted yet.';
    const preview = (d.extracted_text_preview || profile.extracted_text_preview || '').slice(0, 1200);
    alert(`${d.original_name}\n${d.classification?.label || 'needs review'}\nExtraction confidence: ${profile.extraction_confidence_score || 0}%\n\nFields:\n${fields}\n\nText preview:\n${preview}`);
  } catch (error) { alert(error.message); }
}


async function showActionPlan(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/action-plan`);
    const plan = json.action_plan || {};
    const playbooks = (plan.matched_playbooks || []).map((p) => `- ${p.label}: ${p.urgency}\n  ${p.reviewRule}`).join('\n') || 'No playbooks matched yet.';
    const checklist = (plan.client_checklist || []).slice(0, 12).map((item) => `- ${item.text}`).join('\n') || 'No checklist yet.';
    const tasks = (plan.staff_tasks || []).slice(0, 12).map((task) => `- [${task.lane}] ${task.label}`).join('\n') || 'No staff tasks yet.';
    alert(`${plan.headline || 'Action plan'}\nRisk: ${plan.risk_level || 'needs review'}\n\nMatched playbooks:\n${playbooks}\n\nClient checklist:\n${checklist}\n\nStaff/pro tasks:\n${tasks}\n\nNext safe step: ${plan.next_safe_step || ''}`);
  } catch (error) { alert(error.message); }
}


async function showClientJourney(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/client-journey`);
    const journey = json.client_journey || {};
    const fit = json.service_fit || journey.recommended_service_fit || {};
    const steps = (journey.journey || []).map((step) => `${step.step}. ${step.label} — ${step.status}`).join('\n');
    const questions = (journey.next_questions || []).map((q) => `- ${q.text}`).join('\n') || 'No follow-up questions generated.';
    const blockers = (journey.blockers || []).map((b) => `- ${b}`).join('\n') || 'No blockers reported.';
    alert(`Client journey step ${journey.current_step || ''}/10\n\nRecommended service: ${fit.recommended_service?.label || ''}\nReason: ${fit.reason || ''}\n\nSteps:\n${steps}\n\nNext questions:\n${questions}\n\nBlockers:\n${blockers}\n\n${journey.release_guardrail || ''}`);
  } catch (error) { alert(error.message); }
}

async function sendCaseMessage(id) {
  const body = prompt('Message to staff/professional review team:');
  if (!body) return;
  try {
    await api(`/api/cases/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
    alert('Message saved to the case.');
  } catch (error) { alert(error.message); }
}

async function loadFormsUploadChecklist() {
  const box = qs('#forms-upload-checklist');
  if (!box) return;
  try {
    const json = await api('/api/tax/forms-upload-tomorrow-checklist');
    const c = json.checklist || {};
    const rules = (c.rules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    const waves = (c.firstWave || []).map((w) => `<div class="card"><h3>${escapeHtml(w.agency)}</h3><p>${escapeHtml(w.reason)}</p><p><strong>Forms:</strong> ${escapeHtml((w.forms || []).join(', '))}</p></div>`).join('');
    const qa = (c.qaBeforeUse || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    box.innerHTML = `<div class="card"><h2>${escapeHtml(c.title || 'Official form upload checklist')}</h2><p>${escapeHtml(c.purpose || '')}</p><h3>Rules for tomorrow's ZIP uploads</h3><ul class="list-clean">${rules}</ul></div><div class="grid two">${waves}</div><div class="card"><h2>QA before any form can be used for clients</h2><ul class="list-clean">${qa}</ul><p class="notice-text">Uploaded official forms are catalog/mapping assets only until source, field mapping, sample fills, calculations, and professional review are complete.</p></div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadStaffTasks() {
  const box = qs('#staff-tasks');
  if (!box) return;
  try {
    const inputToken = qs('[name="admin_token"]')?.value || '';
    if (inputToken) localStorage.setItem('jts_admin_token', inputToken);
    const token = inputToken || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const json = await api('/api/staff/task-board', { headers });
    const lanes = (json.board || []).map((lane) => `<div class="card"><h2>${escapeHtml(lane.lane.replace(/_/g, ' '))}</h2>${(lane.tasks || []).slice(0, 30).map((task) => `<div class="mini-row"><strong>${escapeHtml(task.priority || 'normal')}</strong> ${escapeHtml(task.label || '')}<br><span>${escapeHtml(task.case_id || '')} · ${escapeHtml(task.status || 'open')}</span></div>`).join('') || '<p>No tasks in this lane.</p>'}</div>`).join('');
    box.innerHTML = `<div class="card"><h2>Open task board</h2><p>${escapeHtml(String(json.open_count || 0))} open generated/manual tasks. Generated tasks come from tax-problem playbooks; manual tasks can be added through the staff API.</p></div><div class="grid two">${lanes}</div>`;
  } catch (error) { box.innerHTML = `<p>${escapeHtml(error.message)}</p><p class="notice-text">Use x-admin-token via API, or sign in with a staff/admin account.</p>`; }
}


async function loadLiveClientFlow() {
  const box = qs('#live-client-flow');
  if (!box) return;
  try {
    const json = await api('/api/platform/live-user-journey');
    const services = (json.service_levels || []).map((tier) => `<div class="card"><h3>${escapeHtml(tier.label)} <span class="small">${escapeHtml(tier.priceLabel)}</span></h3><p>${escapeHtml(tier.promise)}</p><p class="notice-text">Limit: ${escapeHtml(tier.maxPublicPromise)}</p><p><strong>Before payment:</strong></p><ul class="list-clean">${(tier.beforePayment || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('');
    const steps = (json.client_journey || []).map((step) => `<div class="check-row ok"><strong>${escapeHtml(String(step.step))}. ${escapeHtml(step.label)}</strong><p>${escapeHtml(step.description)} <span class="small">Owner: ${escapeHtml(step.owner)}</span></p></div>`).join('');
    const policies = (json.operating_policies || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('');
    box.innerHTML = `<div class="card"><h2>Live client flow</h2><p>Justice Tax Solutions is designed around a safe client journey: start free, upload copies, triage, human/professional review, client approval, and gated release.</p><ul class="list-clean">${policies}</ul></div><div class="grid two">${services}</div><div class="card wide"><h2>10-step client journey</h2>${steps}</div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadStaffSlaBoard() {
  const box = qs('#staff-sla-board');
  if (!box) return;
  try {
    const inputToken = qs('[name="admin_token"]')?.value || '';
    if (inputToken) localStorage.setItem('jts_admin_token', inputToken);
    const token = inputToken || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const json = await api('/api/staff/sla-board', { headers });
    const board = json.board || { counts: {}, rows: [] };
    const rows = (board.rows || []).slice(0, 80).map((row) => `<div class="card case-card ${escapeAttr(row.risk_level)}"><h3>${escapeHtml(row.priority)} · ${escapeHtml(row.email || 'no email')}</h3><p>${escapeHtml(row.pathway)} · ${escapeHtml(row.status)} · age ${escapeHtml(String(row.age_hours))}h · due ${escapeHtml(row.due_at || '')}</p><p><strong>Next:</strong> ${escapeHtml(row.next_staff_action || '')}</p><p>Recommended service: ${escapeHtml(row.recommended_service_key || '')}${row.overdue ? ' · OVERDUE' : ''}</p></div>`).join('') || '<p>No open cases yet.</p>';
    box.innerHTML = `<div class="stat-row"><div class="stat"><strong>${escapeHtml(String(board.counts.total || 0))}</strong>Total</div><div class="stat"><strong>${escapeHtml(String(board.counts.urgent || 0))}</strong>Urgent</div><div class="stat"><strong>${escapeHtml(String(board.counts.review_next || 0))}</strong>Review next</div><div class="stat"><strong>${escapeHtml(String(board.counts.overdue || 0))}</strong>Overdue</div></div>${rows}`;
  } catch (error) { box.innerHTML = `<p>${escapeHtml(error.message)}</p><p class="notice-text">Use x-admin-token via API, or sign in with a staff/admin account.</p>`; }
}

function setupCounters() {
  qsa('[data-maxlength]').forEach((el) => {
    const max = Number(el.dataset.maxlength || el.getAttribute('maxlength') || 2500);
    el.setAttribute('maxlength', String(max));
    let counter = el.parentElement.querySelector(`[data-counter-for="${el.name}"]`);
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'counter';
      counter.dataset.counterFor = el.name;
      el.insertAdjacentElement('afterend', counter);
    }
    const update = () => { counter.textContent = `${Math.max(0, max - el.value.length)} characters left`; };
    el.addEventListener('input', update); update();
  });
}



async function loadCustomerExperience() {
  const box = qs('#customer-experience-audit');
  if (!box) return;
  try {
    const exp = await api('/api/platform/customer-experience');
    const pre = await api('/api/platform/prelaunch-quality-checklist');
    const rules = (exp.customer_experience?.language_rules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    const starts = (exp.customer_experience?.simple_start_options || []).map((o) => `<div class="card"><h3>${escapeHtml(o.label)}</h3><p>${escapeHtml(o.clientWords)}</p><p class="small"><strong>First step:</strong> ${escapeHtml(o.firstStep)}</p></div>`).join('');
    const checks = (pre.checklist || []).map((c) => `<div class="check-row ${String(c.status).includes('not_ready') ? 'block' : String(c.status).includes('improved') ? 'ok' : 'warn'}"><strong>${escapeHtml(c.area)} · ${escapeHtml(c.status)}</strong><p>${escapeHtml(c.item)}</p></div>`).join('');
    box.innerHTML = `<div class="card"><h2>Customer experience rules</h2><ul class="list-clean">${rules}</ul></div><div class="grid two">${starts}</div><div class="card wide"><h2>Pre-launch quality checklist</h2>${checks}</div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}


async function loadFounderNextActions() {
  const box = qs('#founder-next-actions');
  if (!box) return;
  try {
    const json = await api('/api/platform/what-needs-improvement');
    const audit = json.audit || [];
    const actions = (json.founder_next_actions || {}).do_now || [];
    const config = (json.founder_next_actions || {}).needs_configuration || [];
    const blockers = (json.founder_next_actions || {}).top_blockers || [];
    const auditHtml = audit.map((item) => `<div class="card ${item.severity === 'blocker' ? 'urgent-card' : ''}"><h3>${escapeHtml(item.area)}</h3><p><strong>Needs improvement:</strong> ${escapeHtml(item.issue)}</p><p><strong>What we can do now:</strong> ${escapeHtml(item.do_now)}</p><p class="small"><strong>Production requirement:</strong> ${escapeHtml(item.production_requirement)}</p></div>`).join('');
    const actionsHtml = actions.map((a) => `<li><strong>${escapeHtml(a.label)}</strong><br><span>${escapeHtml(a.plain)}</span><br><small>${escapeHtml(a.why)}</small></li>`).join('');
    const configHtml = config.map((a) => `<li><strong>${escapeHtml(a.label)}</strong><br><span>${escapeHtml(a.plain)}</span><br><small>${escapeHtml(a.why)}</small></li>`).join('');
    const blockerHtml = blockers.map((b) => `<li>${escapeHtml(b.label)}</li>`).join('') || '<li>No major blockers reported by the current environment, but verify operating procedures before launch.</li>';
    box.innerHTML = `<div class="card"><h2>Recommended launch mode</h2><p><strong>${escapeHtml((json.founder_next_actions || {}).recommended_phase || 'Internal demo')}</strong></p><p class="notice-text">${escapeHtml((json.live_pilot_gate || {}).policy || '')}</p></div><div class="card"><h2>Top blockers</h2><ul>${blockerHtml}</ul></div><div class="card"><h2>Things we can work on now</h2><ul>${actionsHtml}</ul></div><div class="card"><h2>Needs production configuration</h2><ul>${configHtml}</ul></div><div class="card wide"><h2>Improvement audit</h2><div class="grid two">${auditHtml}</div></div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadPilotReadiness() {
  const box = qs('#pilot-readiness');
  if (!box) return;
  try {
    const json = await api('/api/platform/live-pilot-gate');
    const gate = json.gate || {};
    const detailed = await api('/api/platform/launch-stage-checklist');
    const upload = await api('/api/platform/upload-safety-guide');
    const demo = await api('/api/platform/demo-data-preview');
    const stages = (detailed.checklist?.stages || []).map((p) => `<div class="card ${p.allowed_now ? 'ok-card' : 'urgent-card'}"><h3>${escapeHtml(p.label)}</h3><p>${escapeHtml(p.customer_scope || '')}</p><p><strong>${p.allowed_now ? 'Allowed now' : 'Not yet'} · ${escapeHtml(String(p.readiness_percent || 0))}%</strong></p>${(p.blockers || []).length ? `<p class="small"><strong>Blockers:</strong> ${(p.blockers || []).map(escapeHtml).join('; ')}</p>` : '<p class="small">No current blockers listed for this phase.</p>'}<p class="small"><strong>Next:</strong> ${(p.next_actions || []).map(escapeHtml).join(' · ')}</p></div>`).join('');
    const checks = (gate.checks || []).map((c) => `<div class="check-row ${c.ok ? 'ok' : 'block'}"><strong>${c.ok ? 'OK' : 'BLOCK'} · ${escapeHtml(c.label)}</strong><p class="small">${c.count !== undefined ? `Count: ${escapeHtml(String(c.count))}` : ''}${c.passed !== undefined ? ` Passed: ${escapeHtml(String(c.passed))}/${escapeHtml(String(c.total))}` : ''}</p></div>`).join('');
    const demoRows = (demo.demo?.templates || []).map((d) => `<li>${escapeHtml(d.primary_concern)} — ${escapeHtml(d.risk_level)} / ${escapeHtml(d.status)}</li>`).join('');
    box.innerHTML = `<div class="card"><h2>Recommended mode</h2><p><strong>${escapeHtml((detailed.checklist?.recommended_next_mode || {}).label || (gate.recommended_phase || {}).label || 'Internal demo')}</strong></p><p>${escapeHtml((detailed.checklist?.recommended_next_mode || {}).customer_scope || (gate.recommended_phase || {}).clientPromise || '')}</p><p class="notice-text">${escapeHtml(detailed.checklist?.safety_rule || gate.policy || '')}</p></div><div class="card"><h2>Upload safety</h2><p><strong>${escapeHtml(upload.guide?.title || '')}</strong></p><p>${escapeHtml(upload.guide?.explain_to_customer || '')}</p></div><div class="card wide"><h2>Launch stages</h2><div class="grid two">${stages}</div></div><div class="card wide"><h2>Safe demo cases available</h2><p class="notice-text">${escapeHtml(demo.demo?.warning || '')}</p><ul>${demoRows}</ul></div><div class="card wide"><h2>Original gate checks</h2>${checks}</div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadSecurityPlan() {
  const box = qs('#security-plan');
  if (!box) return;
  try {
    const json = await api('/api/platform/security-plan-checklist');
    const plan = json.security_plan || {};
    const rows = (plan.checklist || []).map((item) => `<div class="card"><h3>${escapeHtml(item.category)}</h3><p>${escapeHtml(item.item)}</p><p><strong>Status:</strong> ${escapeHtml(item.status || 'not_started')}</p><p class="small">Key: ${escapeHtml(item.status_key || '')}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</p></div>`).join('');
    const emails = await api('/api/platform/email-template-inventory');
    const emailRows = (((emails.email_templates || {}).templates) || []).map((t) => `<li><strong>${escapeHtml(t.label)}</strong> — ${escapeHtml(t.trigger)} <span class="small">${escapeHtml(t.clientTone)}</span></li>`).join('');
    box.innerHTML = `<div class="card"><h2>${escapeHtml(plan.title || 'Security plan')}</h2><p><strong>${escapeHtml(String(plan.complete || 0))}/${escapeHtml(String(plan.total || 0))}</strong> items complete</p><p class="notice-text">${escapeHtml(plan.source_basis || '')}</p></div><div class="card"><h2>Email templates before live launch</h2><ul>${emailRows}</ul></div><div class="card wide"><h2>Checklist</h2><div class="grid two">${rows}</div></div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadLiveReadiness() {
  const box = qs('#live-readiness');
  if (!box) return;
  try {
    const json = await api('/api/platform/live-readiness');
    const r = json.readiness || {};
    const status = r.ready_for_live_paying_users ? 'Ready for live paying users' : (r.safe_for_limited_private_pilot ? 'Limited private pilot only' : 'Not ready for live sensitive tax documents');
    const checks = (r.checks || []).map((c) => {
      const cls = c.ok ? 'ok' : (c.required ? 'block' : 'warn');
      const label = c.ok ? 'OK' : (c.required ? 'BLOCKER' : 'ADVISORY');
      return `<div class="check-row ${cls}"><strong>${escapeHtml(label)} · ${escapeHtml(c.label)}</strong><p class="small">${escapeHtml(c.key || '')}${c.env ? ` · env: ${escapeHtml(c.env)}` : ''}${c.anyEnv ? ` · env options: ${escapeHtml(c.anyEnv.join(', '))}` : ''}</p></div>`;
    }).join('');
    box.innerHTML = `<div class="card"><h2>${escapeHtml(status)}</h2><p><strong>Required checks:</strong> ${escapeHtml(String(r.required_passed || 0))}/${escapeHtml(String(r.required_total || 0))} passed</p><p><strong>Live flag:</strong> ${r.live_flag_enabled ? 'enabled' : 'disabled'}</p><p><strong>Verified professionals:</strong> ${escapeHtml(String(r.verified_professional_count || 0))}</p><p><strong>Verified official mappings:</strong> ${escapeHtml(String(r.verified_mapping_count || 0))}</p><p class="notice-text">${escapeHtml(r.launch_policy || '')}</p></div><div class="card"><h2>Blocking items</h2>${(r.blocking || []).length ? (r.blocking || []).map(c => `<p>• ${escapeHtml(c.label)}</p>`).join('') : '<p>No required blockers reported. Confirm operating procedures before enabling live mode.</p>'}</div><div class="card wide"><h2>All go-live checks</h2>${checks}</div>`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadProductionConfig() {
  const box = qs('#production-config');
  if (!box) return;
  try {
    const json = await api('/api/platform/production-config');
    const cfg = json.production_config || {};
    const policy = cfg.upload_policy || {};
    const db = cfg.database_adapter || {};
    const storageAdapter = cfg.storage_adapter || {};
    const staff = cfg.staff_approval_mfa || {};
    const pilot = cfg.pilot_stage_gates || {};
    const securityJson = await api('/api/platform/production-security-readiness');
    const runbookJson = await api('/api/platform/sensitive-data-handling-runbook');
    const accessJson = await api('/api/platform/access-control-audit');
    const launchJson = await api('/api/platform/security-launch-blockers');
    const security = securityJson.readiness || {};
    const runbook = runbookJson.runbook || {};
    const access = accessJson.audit || {};
    const launch = launchJson.blockers || {};
    const blockers = (cfg.blockers || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('') || '<li>No production configuration blockers reported. Confirm operating procedures before accepting live documents.</li>';
    const renderRows = (cfg.render_deployment_checklist || []).map((item) => `<div class="check-row ${item.ok ? 'ok' : 'warn'}"><strong>${item.ok ? 'OK' : 'TODO'} · ${escapeHtml(item.label)}</strong><p class="small">${escapeHtml(item.plain || '')}${item.env ? ` · Env: ${escapeHtml(item.env)}` : ''}</p></div>`).join('');
    const storageRows = (cfg.storage_adapters || []).map((s) => `<div class="card"><h3>${escapeHtml(s.label)}</h3><p>${escapeHtml(s.plain || '')}</p><p><strong>${s.liveUse ? 'Can support production when configured' : 'Demo/testing only'}</strong></p><p class="small">${(s.requiredEnv || []).map(escapeHtml).join(', ')}</p></div>`).join('');
    const databaseRows = ((db.adapters || [])).map((a) => `<div class="card"><h3>${escapeHtml(a.label)}</h3><p>${escapeHtml(a.plain || '')}</p><p><strong>${a.liveUse ? 'Production path' : 'Development/demo only'}</strong></p><p class="small">Setup: ${(a.setup || []).map(escapeHtml).join(' → ')}</p></div>`).join('');
    const malwareRows = (cfg.malware_quarantine_workflow || []).map((step) => `<div class="check-row ${step.statusWhenNoProvider === 'blocked' ? 'block' : 'warn'}"><strong>${escapeHtml(String(step.step))}. ${escapeHtml(step.key)}</strong><p>${escapeHtml(step.rule || '')}</p><p class="small">No-provider status: ${escapeHtml(step.statusWhenNoProvider || '')}</p></div>`).join('');
    const emailRows = (cfg.email_templates || []).map((t) => `<li><strong>${escapeHtml(t.label)}</strong> — ${escapeHtml(t.plain || '')}</li>`).join('');
    const pilotRows = ((pilot.stages || [])).map((stage) => `<div class="card ${stage.allowed_now ? 'ok-card' : 'urgent-card'}"><h3>${escapeHtml(stage.label)}</h3><p>${escapeHtml(stage.clientPromise || '')}</p><p><strong>${stage.allowed_now ? 'Allowed now' : 'Blocked for now'}</strong></p>${(stage.blockers || []).length ? `<p class="small">${(stage.blockers || []).map(escapeHtml).join('; ')}</p>` : '<p class="small">No current blockers listed for this stage.</p>'}</div>`).join('');
    const securityRows = (security.controls || []).map((control) => `<div class="check-row ${control.ok ? 'ok' : (control.severity === 'critical' ? 'block' : 'warn')}"><strong>${control.ok ? 'OK' : control.severity === 'critical' ? 'BLOCKER' : 'TODO'} · ${escapeHtml(control.label)}</strong><p class="small">${escapeHtml(control.key || '')} · source: ${escapeHtml(control.source || '')}</p>${control.ok ? '' : `<p>${escapeHtml(control.fix || '')}</p>`}</div>`).join('');
    const dataRows = (runbook.data_classes || []).map((item) => `<div class="card"><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.handling || '')}</p><p class="small">Examples: ${(item.examples || []).map(escapeHtml).join(', ')}</p><p><strong>Risk:</strong> ${escapeHtml(item.liveRisk || '')}</p></div>`).join('');
    const accessBlockers = (access.blockers || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('') || '<li>No access-control blockers reported by current data. Confirm manually before live launch.</li>';
    const launchBlockers = (launch.blockers || []).slice(0, 12).map((b) => `<li><strong>${escapeHtml(b.severity || '')}</strong> · ${escapeHtml(b.label || '')}</li>`).join('') || '<li>No security launch blockers reported. Confirm operating procedures before enabling live uploads.</li>';
    box.innerHTML = `<div class="card"><h2>${escapeHtml(cfg.stage || 'Configuration status')}</h2><p><strong>Live sensitive uploads:</strong> ${policy.accept_live_sensitive_documents ? 'enabled' : 'blocked'}</p><p><strong>Database:</strong> ${escapeHtml(db.active || 'json-local')}</p><p><strong>Storage:</strong> ${escapeHtml((policy.current_storage_provider || {}).label || '')}</p><p><strong>Malware scanning:</strong> ${escapeHtml((policy.current_malware_provider || {}).label || '')}</p><p><strong>Email:</strong> ${escapeHtml((cfg.email_provider || {}).provider || 'not configured')}</p><p><strong>Staff MFA:</strong> ${staff.staff_mfa_required ? 'marked required' : 'not marked required'}</p><p class="notice-text">${escapeHtml(cfg.next_safe_step || '')}</p></div><div class="card"><h2>v0.1.28 security gate</h2><p><strong>${escapeHtml(security.stage || '')}</strong></p><p>Critical controls: ${escapeHtml(String(security.critical_passed || 0))}/${escapeHtml(String(security.critical_total || 0))} · High controls: ${escapeHtml(String(security.high_passed || 0))}/${escapeHtml(String(security.high_total || 0))}</p><p class="notice-text">${escapeHtml(security.policy || '')}</p></div><div class="card"><h2>Security launch blockers</h2><ul>${launchBlockers}</ul><p class="small"><strong>Safe marketing mode:</strong> ${escapeHtml(launch.next_safe_marketing_mode || '')}</p></div><div class="card"><h2>Production config blockers</h2><ul>${blockers}</ul></div><div class="card wide"><h2>Production Security + Sensitive Upload Readiness</h2>${securityRows}</div><div class="card wide"><h2>Sensitive data handling classes</h2><div class="grid two">${dataRows}</div></div><div class="card wide"><h2>Access-control audit</h2><p>Staff users: ${escapeHtml(String(access.staff_user_count || 0))} · Pending staff: ${escapeHtml(String(access.pending_staff_count || 0))} · Verified professionals: ${escapeHtml(String(access.verified_professional_count || 0))}</p><ul>${accessBlockers}</ul><p class="notice-text">${escapeHtml(access.least_privilege_rule || '')}</p></div><div class="card wide"><h2>Database adapter readiness</h2><p class="notice-text">${escapeHtml(db.warning || '')}</p><div class="grid two">${databaseRows}</div></div><div class="card wide"><h2>Render deployment checklist</h2>${renderRows}</div><div class="card wide"><h2>Storage adapter plan</h2><p class="notice-text">${escapeHtml((storageAdapter.adapter_interface || {}).purpose || '')}</p><div class="grid two">${storageRows}</div></div><div class="card wide"><h2>Malware quarantine workflow</h2>${malwareRows}</div><div class="card wide"><h2>Staff approval and MFA</h2><p>${escapeHtml((staff.policy || {}).staff_signup_rule || '')}</p><p class="notice-text">${escapeHtml((staff.blockers || []).join(' ') || 'No staff/MFA blockers reported by current data.')}</p></div><div class="card wide"><h2>Pilot-stage gates</h2><div class="grid two">${pilotRows}</div></div><div class="card wide"><h2>Transactional email templates</h2><ul>${emailRows}</ul><p class="notice-text">Email should point clients to the dashboard and avoid sensitive taxpayer details in the subject or body.</p></div>`;
  } catch (error) { box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`; }
}

async function loadMarketResearch() {
  const box = qs('#market-research');
  if (!box) return;
  try {
    const json = await api('/api/platform/competitor-market-research');
    const r = json.research || {};
    const cats = (r.categories || []).map((cat) => `<div class="card"><h2>${escapeHtml(cat.category)}</h2><p><strong>Tracked:</strong> ${escapeHtml((cat.competitors || []).join(', '))}</p><p><strong>Model:</strong> ${escapeHtml(cat.model || '')}</p><p><strong>Observed pricing:</strong></p><ul class="list-clean">${(cat.observedPricing || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><p><strong>Adapt:</strong></p><ul class="list-clean">${(cat.adaptForJTS || []).slice(0,4).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('');
    const moves = (r.immediateProductMoves || []).map((m) => `<li><strong>${escapeHtml(m.title)}</strong> — ${escapeHtml(m.mechanism)}</li>`).join('');
    box.innerHTML = `<div class="card wide"><h2>Current market conclusion</h2><p>${escapeHtml(r.strategicConclusion || '')}</p><ul class="list-clean">${moves}</ul></div>${cats}`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadLiveConsultationProducts() {
  const box = qs('#live-consultation-products');
  if (!box) return;
  try {
    const json = await api('/api/platform/live-online-consultation-products');
    const products = json.products || {};
    const sessionProducts = json.professionalSessionProducts || {};
    const levels = (products.serviceLevels || []).map((level) => `<div class="card"><h2>${escapeHtml(level.label)}</h2><p><strong>${escapeHtml(level.publicPriceRange)}</strong> · ${escapeHtml(level.sessionType)}</p><p>${escapeHtml((level.bestFor || []).join(', '))}</p><p><strong>Output:</strong> ${escapeHtml(level.output || '')}</p><p class="notice-text">${escapeHtml(level.guardrail || '')}</p></div>`).join('');
    const reassurance = (sessionProducts.serviceLevels || []).map((level) => `<div class="card"><h2>${escapeHtml(level.label)}</h2><p><strong>${escapeHtml(level.priceRange)}</strong> · ${escapeHtml(level.duration)}</p><p>${escapeHtml((level.bestFor || []).join(', '))}</p><p><strong>Deliverable:</strong> ${escapeHtml(level.deliverable || '')}</p></div>`).join('');
    const reqs = (products.bookingGate?.requiredBeforeBooking || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
    const guardrails = (sessionProducts.policy?.guardrails || []).map(x => `<li>${escapeHtml(x)}</li>`).join('');
    box.innerHTML = `<div class="card wide"><h2>Service promise</h2><p>${escapeHtml(products.positioning || '')}</p><p class="notice-text">${escapeHtml(sessionProducts.customerChoiceMessage || '')}</p><h3>Before booking</h3><ul class="list-clean">${reqs}</ul><h3>Session guardrails</h3><ul class="list-clean">${guardrails}</ul><div class="actions"><button type="button" class="secondary" onclick="showProfessionalSessionEstimate()">See sample reassurance estimate</button></div></div>${levels}<div class="card wide"><h2>Customer-requested reassurance products</h2><p>A professional can join because the facts require it, or because the customer simply wants reassurance and a second look.</p></div>${reassurance}`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function loadCalendarIntegrationGuide() {
  const box = qs('#calendar-integration-guide');
  if (!box) return;
  try {
    const json = await api('/api/platform/calendar-integration-guide');
    const guide = json.guide || {};
    const providers = (guide.providers || []).map((p) => `<div class="card"><h3>${escapeHtml(p.label)}</h3><p>Status: ${escapeHtml(p.currentStatus || '')}</p><p>${escapeHtml(p.useCase || '')}</p><p class="small"><strong>Setup:</strong> ${escapeHtml((p.setup || []).join(', '))}</p></div>`).join('');
    const env = (guide.environmentPlaceholders || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
    box.innerHTML = `<div class="card wide"><h2>Calendar integration and appointment scheduling</h2><p>${escapeHtml(guide.policy?.firstBuildApproach || '')}</p><p class="notice-text"><strong>Manual meeting-link fallback:</strong> ${escapeHtml(guide.policy?.manualFallback || '')}</p><p class="notice-text">Customers see only approved booking/meeting details; private professional calendar data stays hidden.</p></div><div class="grid two">${providers}</div><div class="card wide"><h2>Future configuration placeholders</h2><ul class="list-clean">${env}</ul><p class="notice-text">Google Calendar, Calendly, Microsoft Teams/Outlook, and Zoom API sync should not be claimed until configured and tested.</p></div>`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function showAppointmentOptions(id) {
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/appointment-options`);
    const opts = json.options || {};
    const providers = (opts.providerOptions || []).map((p) => `• ${p.label}: ${p.currentStatus}`).join('\n');
    const missing = (json.readiness?.missing || []).map((x) => `• ${x}`).join('\n') || 'No missing scheduling items listed.';
    alert(`Appointment options\n\nModes: ${(opts.availableModes || []).join(', ')}\nTimezone: ${opts.defaultTimezone || ''}\n\nProviders:\n${providers}\n\nScheduling readiness: ${json.readiness?.score || 0}%\n${missing}`);
  } catch (error) { alert(error.message); }
}

async function requestAppointmentScheduling(id) {
  const mode = prompt('Preferred appointment mode? Examples: online video, online voice, phone, in person if available, no preference.', 'online video');
  if (!mode) return;
  const times = prompt('Any preferred days/times or timezone?', '');
  try {
    const json = await api(`/api/cases/${encodeURIComponent(id)}/appointment-scheduling-request`, { method: 'POST', body: JSON.stringify({ requestedHelpMode: mode, preferredTimes: times, meetingProvider: 'manual_staff_entry' }) });
    alert(`Appointment scheduling preference saved.\nStatus: ${json.appointment?.appointment_status || ''}\nProvider: ${json.appointment?.meeting_provider || ''}\nReadiness: ${json.readiness?.score || 0}%\n\nStaff can confirm with a Calendly, Google Meet, Zoom, Teams, phone, or in-person instruction later.`);
    await loadDashboard();
  } catch (error) { alert(error.message); }
}

async function loadStaffCalendarBoard(headers = {}) {
  try {
    const board = await api('/api/staff/appointment-scheduling-board', { headers });
    const configs = await api('/api/staff/professional-calendar-configs', { headers });
    return { board, configs };
  } catch { return { board: { board: { summary: {} } }, configs: { calendars: { summary: {} } } }; }
}

function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#096;'); }

window.setPath = setPath;
window.submitCaseForReview = submitCaseForReview;
window.requestPaidReview = requestPaidReview;
window.showPaymentSummary = showPaymentSummary;
window.requestQuote = requestQuote;
window.requestProfessionalSession = requestProfessionalSession;
window.showPreSessionReadiness = showPreSessionReadiness;
window.showProfessionalSessionEstimate = showProfessionalSessionEstimate;
window.showAppointmentOptions = showAppointmentOptions;
window.requestAppointmentScheduling = requestAppointmentScheduling;
window.markDoneUploading = markDoneUploading;
window.showFieldPlan = showFieldPlan;
window.showCaseExtraction = showCaseExtraction;
window.showDocumentExtraction = showDocumentExtraction;
window.showReleaseSummary = showReleaseSummary;
window.showActionPlan = showActionPlan;
window.showClientJourney = showClientJourney;
window.showSimpleStatus = showSimpleStatus;
window.showCustomerStatus = showCustomerStatus;
window.sendCaseMessage = sendCaseMessage;
window.logout = logout;
window.loadFounderNextActions = loadFounderNextActions;
window.loadPilotReadiness = loadPilotReadiness;
window.loadSecurityPlan = loadSecurityPlan;
window.loadProductionConfig = loadProductionConfig;
window.seedDemoData = seedDemoData;
window.loadStaffCockpit = loadStaffCockpit;
window.loadPrivatePilotRelease = loadPrivatePilotRelease;

document.addEventListener('DOMContentLoaded', async () => {
  setReferralFromUrl();
  setupCounters();
  recordAnalyticsEvent('landing_page_view', { title: document.title || '' });
  await loadMe();
  qsa('[data-path]').forEach((el) => el.addEventListener('click', () => setPath(el.dataset.path)));
  const intake = qs('#intake'); if (intake) intake.addEventListener('submit', submitIntake);
  const referral = qs('#referral-form'); if (referral) referral.addEventListener('submit', submitReferral);
  const signup = qs('#signup-form'); if (signup) signup.addEventListener('submit', (e) => submitAuth(e, 'signup'));
  const login = qs('#login-form'); if (login) login.addEventListener('submit', (e) => submitAuth(e, 'login'));
  loadReferralDashboard();
  loadDashboard();
  loadStaff();
  loadCompetitorIntel();
  loadMarketResearch();
  loadLiveConsultationProducts();
  loadCalendarIntegrationGuide();
  loadDocumentVerification();
  const officialUpload = qs('#official-form-upload'); if (officialUpload) officialUpload.addEventListener('submit', uploadOfficialForms);
  const sourceSeed = qs('#official-source-seed'); if (sourceSeed) sourceSeed.addEventListener('submit', seedOfficialSourceCatalog);
  const sourceRegister = qs('#official-source-register'); if (sourceRegister) sourceRegister.addEventListener('submit', registerOfficialSourceUrl);
  const sourceCapture = qs('#official-source-capture'); if (sourceCapture) sourceCapture.addEventListener('submit', captureOfficialSourcePdf);
  const privatePilotDecision = qs('#private-pilot-decision'); if (privatePilotDecision) privatePilotDecision.addEventListener('submit', recordPrivatePilotDecision);
  loadOfficialFormsDashboard();
  loadFormsUploadChecklist();
  loadStaffTasks();
  loadLiveReadiness();
  loadLiveClientFlow();
  loadStaffSlaBoard();
  loadCustomerExperience();
  loadFounderNextActions();
  loadPilotReadiness();
  loadSecurityPlan();
  loadProductionConfig();
  loadMarketingConversion();
  loadPrivatePilotRelease();
});





async function loadPrivatePilotRelease() {
  const box = qs('#private-pilot-release');
  if (!box) return;
  try {
    const inputToken = qs('[name="admin_token"]')?.value || '';
    if (inputToken) localStorage.setItem('jts_admin_token', inputToken);
    const token = inputToken || localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const candidateJson = await api('/api/platform/private-pilot-release-candidate');
    const goJson = await api('/api/platform/private-pilot-go-no-go');
    const regressionJson = await api('/api/platform/private-pilot-regression-checklist');
    const scenarioJson = await api('/api/platform/private-pilot-scenario-matrix');
    const complianceJson = await api('/api/platform/compliance-copy-audit');
    const marketingJson = await api('/api/platform/pilot-marketing-safety-review');
    let packetJson = { packet: {} };
    try { packetJson = await api('/api/staff/private-pilot-release-packet', { headers }); } catch {}
    const candidate = candidateJson.candidate || {};
    const summary = candidate.release_candidate_summary || {};
    const go = goJson.report || candidate.go_no_go || {};
    const regression = regressionJson.regression || {};
    const scenarios = scenarioJson.scenarios?.scenarios || [];
    const compliance = complianceJson.audit?.audit_items || [];
    const marketing = marketingJson.review || {};
    const checks = (go.checks || []).map((c) => `<li>${c.ok ? '✅' : '⬜'} <strong>${escapeHtml(c.label || c.key)}</strong> — ${escapeHtml(c.severity || '')}${c.ok ? '' : ` · ${escapeHtml(c.fix || '')}`}</li>`).join('');
    const regRows = (regression.checklist || []).map((r) => `<div class="mini-row"><strong>${r.pass_for_candidate ? '✅' : '⬜'} ${escapeHtml(r.label || r.key)}</strong><br><span>${escapeHtml((r.endpoints || []).join(', '))}</span></div>`).join('');
    const scenarioRows = scenarios.map((s) => `<div class="card"><h3>${escapeHtml(s.label || s.key)}</h3><p><strong>Entry:</strong> ${escapeHtml(s.entry || '')}</p><ul class="list-clean">${(s.expected || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`).join('');
    const complianceRows = compliance.map((c) => `<li><strong>${escapeHtml(c.key || '')}</strong>: ${escapeHtml(c.phrase || '')}</li>`).join('');
    const safeMarketing = (marketing.safe_to_market_now || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
    const unsafeMarketing = (marketing.not_safe_to_market_yet || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
    const scriptRows = (packetJson.packet?.founder_script || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
    box.innerHTML = `<div class="stat-row"><div class="stat"><strong>${escapeHtml(go.decision || 'review')}</strong>Decision</div><div class="stat"><strong>${go.can_invite_private_pilot_users ? 'Yes' : 'No'}</strong>Invite pilot users</div><div class="stat"><strong>${go.can_accept_real_sensitive_documents ? 'Yes' : 'No'}</strong>Real sensitive docs</div><div class="stat"><strong>${go.can_run_broad_public_marketing ? 'Yes' : 'No'}</strong>Broad marketing</div></div><div class="card wide"><h2>Private Pilot Release Candidate</h2><p>${escapeHtml(summary.recommended_next_action || '')}</p><p class="notice-text">Private pilot does not mean public live launch. This build is for controlled no-sensitive pilot use, staff testing, and trusted early-user feedback.</p><ul class="checklist">${checks}</ul></div><div class="grid two"><div class="card"><h2>Safe to market now</h2><ul class="list-clean">${safeMarketing}</ul></div><div class="card"><h2>Not safe to market yet</h2><ul class="list-clean">${unsafeMarketing}</ul></div></div><div class="card wide"><h2>Regression checklist</h2><p>Recorded passed: ${escapeHtml(String(regression.summary?.recorded_passed || 0))}/${escapeHtml(String(regression.summary?.total || 0))}. Automated build smoke tests still run separately.</p><div class="grid two">${regRows}</div></div><div class="card wide"><h2>Sample pilot scenarios</h2><div class="grid two">${scenarioRows}</div></div><div class="card wide"><h2>Compliance copy audit</h2><ul class="checklist">${complianceRows}</ul></div><div class="card wide"><h2>Founder pilot script</h2><ul class="checklist">${scriptRows || '<li>Sign in as staff/admin to load the staff release packet.</li>'}</ul></div>`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function recordPrivatePilotDecision(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#private-pilot-decision-output');
  if (output) { output.classList.add('show'); output.textContent = 'Recording private pilot decision...'; }
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const token = data.admin_token || localStorage.getItem('jts_admin_token') || '';
    if (token) localStorage.setItem('jts_admin_token', token);
    delete data.admin_token;
    const json = await api('/api/staff/private-pilot-release-decision', { method: 'POST', headers: token ? { 'x-admin-token': token } : {}, body: JSON.stringify(data) });
    if (output) output.innerHTML = `<h3>Decision recorded</h3><p>${escapeHtml(json.event?.status_key || '')}: ${escapeHtml(json.event?.status || '')}</p><p class="notice-text">Refresh the release candidate board to see the current go/no-go view.</p>`;
    await loadPrivatePilotRelease();
  } catch (error) {
    if (output) output.textContent = error.message;
  }
}

async function seedOfficialSourceCatalog(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#official-source-output');
  if (output) { output.classList.add('show'); output.textContent = 'Seeding official source catalog...'; }
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const token = data.admin_token || localStorage.getItem('jts_admin_token') || '';
    if (token) localStorage.setItem('jts_admin_token', token);
    delete data.admin_token;
    const response = await fetch('/api/admin/official-source-catalog/seed', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) }, credentials: 'include', body: JSON.stringify(data)
    });
    const json = await response.json();
    if (!json.ok) throw new Error(json.error || 'Source catalog seed failed.');
    if (output) output.innerHTML = `<h3>Sources seeded</h3><p>Inserted: ${escapeHtml(String(json.result.inserted_count || 0))} · Existing: ${escapeHtml(String(json.result.existing_count || 0))} · Selected: ${escapeHtml(String(json.result.total_selected || 0))}</p>`;
    await loadOfficialFormsDashboard();
  } catch (error) {
    if (output) output.textContent = error.message;
  }
}

async function registerOfficialSourceUrl(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#official-register-output');
  if (output) { output.classList.add('show'); output.textContent = 'Registering official source URL...'; }
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const token = data.admin_token || localStorage.getItem('jts_admin_token') || '';
    if (token) localStorage.setItem('jts_admin_token', token);
    delete data.admin_token;
    const response = await fetch('/api/admin/official-form-sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) }, credentials: 'include', body: JSON.stringify(data)
    });
    const json = await response.json();
    if (!json.ok) throw new Error(json.error || 'Source registration failed.');
    if (output) output.innerHTML = `<h3>Source registered</h3><p>${escapeHtml(json.source.agency || '')} · ${escapeHtml(json.source.form_number || '')} · ${escapeHtml(json.source.source_status || '')}</p><p class="notice-text">${escapeHtml(json.source.release_status || '')}</p>`;
    await loadOfficialFormsDashboard();
  } catch (error) {
    if (output) output.textContent = error.message;
  }
}


async function captureOfficialSourcePdf(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#official-capture-output');
  if (output) { output.classList.add('show'); output.textContent = 'Checking official URL capture plan...'; }
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const token = data.admin_token || localStorage.getItem('jts_admin_token') || '';
    if (token) localStorage.setItem('jts_admin_token', token);
    const sourceId = data.source_id || '';
    if (!sourceId) throw new Error('Enter an official source record ID first. Seed the catalog, then copy a source id from the source records below.');
    const payload = { dry_run: data.dry_run === 'true' };
    const response = await fetch(`/api/admin/official-form-sources/${encodeURIComponent(sourceId)}/capture-pdf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) }, credentials: 'include', body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.ok) throw new Error(json.error || json.status || 'Official URL capture failed.');
    if (output) output.innerHTML = `<h3>${escapeHtml(json.status || 'capture checked')}</h3><p>${escapeHtml(json.next_step || 'Official PDF captured and checksummed; mapping and professional verification are still required.')}</p><pre class="api">${escapeHtml(JSON.stringify(json.plan || json.capture || json, null, 2))}</pre>`;
    await loadOfficialFormsDashboard();
  } catch (error) {
    if (output) output.textContent = error.message;
  }
}

async function uploadOfficialForms(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const output = qs('#official-upload-output');
  if (output) { output.classList.add('show'); output.textContent = 'Uploading and cataloging official form ZIP...'; }
  try {
    const data = new FormData(form);
    const token = data.get('admin_token') || localStorage.getItem('jts_admin_token') || '';
    if (token) localStorage.setItem('jts_admin_token', token);
    const response = await fetch('/api/admin/official-form-zips', { method: 'POST', body: data, headers: token ? { 'x-admin-token': token } : {}, credentials: 'include' });
    const json = await response.json();
    if (!json.ok) throw new Error(json.error || 'Official form upload failed.');
    if (output) output.innerHTML = `<h3>Upload processed</h3><p>Packages: ${escapeHtml(String(json.results.length))} · Mapping queue count: ${escapeHtml(String(json.mapping_queue_count || 0))}</p><pre class="api">${escapeHtml(JSON.stringify(json.results, null, 2))}</pre>`;
    await loadOfficialFormsDashboard();
  loadFormsUploadChecklist();
  loadStaffTasks();
  } catch (error) {
    if (output) output.textContent = error.message;
  }
}

async function loadOfficialFormsDashboard() {
  const box = qs('#official-forms-dashboard');
  if (!box) return;
  try {
    const token = localStorage.getItem('jts_admin_token') || '';
    const headers = token ? { 'x-admin-token': token } : {};
    const guide = await api('/api/tax/official-form-upload-guide');
    const roadmap = await api('/api/tax/official-form-roadmap');
    const matrix = await api('/api/tax/official-form-readiness-matrix');
    const sourceCatalog = await api('/api/tax/official-source-catalog');
    const inventory = await api('/api/tax/official-source-inventory');
    const controlled = await api('/api/tax/official-form-controlled-mapping-plan');
    const downloadGuide = await api('/api/tax/official-form-download-vs-upload-guide');
    const discoveryGuide = await api('/api/tax/official-url-discovery-guide');
    const captureGuide = await api('/api/tax/official-url-capture-guide');
    const automationRoadmap = await api('/api/tax/form-automation-roadmap');
    const aiPolicy = await api('/api/tax/ai-form-completion-policy');
    const form9465Ready = await api('/api/tax/forms/9465/official-output-readiness');
    const form9465Map = await api('/api/tax/forms/9465/field-map');
    const form9465Samples = await api('/api/tax/forms/9465/sample-cases');
    const form9465Capture = await api('/api/tax/forms/9465/pdf-capture-readiness');
    const form9465Visual = await api('/api/tax/forms/9465/visual-field-qa-plan');
    const form9465FillReady = await api('/api/tax/forms/9465/fill-engine-readiness');
    const form9465Overlay = await api('/api/tax/forms/9465/overlay-template');
    const form9465Fallback = await api('/api/tax/forms/9465/capture-upload-fallback-plan');
    const form9465Lock = await api('/api/tax/forms/9465/coordinate-lock-checklist');
    const form9465FinalGate = await api('/api/tax/forms/9465/final-output-gate-report');
    const form9465OfficialSample = await api('/api/tax/forms/9465/official-sample-output-readiness');
    const form9465Comparison = await api('/api/tax/forms/9465/visual-overlay-comparison-plan');
    const form9465ClientRelease = await api('/api/tax/forms/9465/client-release-policy');
    const form9465PrintRelease = await api('/api/tax/forms/9465/print-signature-draft-readiness', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ answers: {} }) });
    const form9465FinalReleasePolicy = await api('/api/tax/forms/9465/final-release-policy');
    const form9465FinalAudit = await api('/api/tax/forms/9465/final-output-gate-audit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ answers: {} }) });
    const form9465ClientReadyPath = await api('/api/tax/forms/9465/client-ready-draft-path', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ answers: {} }) });
    const form9465OperationalCapture = await api('/api/tax/forms/9465/operational-capture-test');
    const form9465TrueCoordinateQa = await api('/api/tax/forms/9465/true-coordinate-qa-workflow');
    const form9465OperationalReleaseReadiness = await api('/api/tax/forms/9465/final-release-readiness-from-operational-qa');
    const form9465CaptureCompletion = await api('/api/tax/forms/9465/capture-completion-readiness');
    const form9465SimulationPlan = await api('/api/tax/forms/9465/coordinate-lock-simulation-plan');
    const form9465StaffApprovalGate = await api('/api/tax/forms/9465/staff-approval-gate-report', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ answers: {} }) });
    let queue = { queue: [] };
    let staffSources = { sources: [] };
    try { queue = await api('/api/staff/form-mapping-queue', { headers }); } catch {}
    try { staffSources = await api('/api/staff/official-form-sources', { headers }); } catch {}
    const waves = (roadmap.waves || []).map(w => `<div class="card"><h3>Wave ${escapeHtml(w.wave)}: ${escapeHtml(w.label)}</h3><p>Priority ${escapeHtml(String(w.priority))}</p><ul class="list-clean">${(w.forms || []).map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul></div>`).join('');
    const rows = (queue.queue || []).slice(0, 50).map(f => `<div class="card"><h3>${escapeHtml(f.agency)} · ${escapeHtml(f.form_number)} ${f.tax_year ? `· ${escapeHtml(f.tax_year)}` : ''}</h3><p>${escapeHtml(f.file_name)} · ${escapeHtml(f.doc_type)} · Wave ${escapeHtml(f.mapping_wave || '')}</p><p>Status: ${escapeHtml(f.mapping_status || 'not_started')} · Source: ${escapeHtml(f.official_source_status || '')}</p><p class="notice-text">${escapeHtml(f.public_use_note || '')}</p></div>`).join('') || '<p>No uploaded official PDFs yet. Seed source URLs first, then upload ZIPs or capture PDFs for field extraction.</p>';
    const sourceRows = (staffSources.sources || inventory.inventory?.sources || []).slice(0, 60).map(src => `<div class="card"><h3>${escapeHtml(src.agency || '')} · ${escapeHtml(src.form_number || '')} ${src.tax_year ? `· ${escapeHtml(src.tax_year)}` : ''}</h3><p>${escapeHtml(src.title || '')}</p><p>Status: ${escapeHtml(src.source_status || '')} · PDF: ${escapeHtml(src.pdf_capture_status || 'not_captured')} · Mapping: ${escapeHtml(src.mapping_status || '')}</p><p class="small"><strong>Source ID:</strong> ${escapeHtml(src.id || '')}</p><p class="small">${escapeHtml(src.pdf_url || src.source_page_url || '')}</p><p class="notice-text">${escapeHtml(src.release_status || '')}</p></div>`).join('') || '<p>No source records have been seeded yet. Use the source seeding form above.</p>';
    const catalogRows = (sourceCatalog.sources || []).slice(0, 24).map(src => `<li><strong>${escapeHtml(src.agency)} ${escapeHtml(src.form_number)}</strong> — ${escapeHtml(src.title || '')}</li>`).join('');
    const stages = (controlled.plan?.stages || []).map(stage => `<li><strong>${escapeHtml(stage.stage)}</strong>: ${escapeHtml(stage.description)}</li>`).join('');
    const matrixSummary = matrix.matrix?.summary || {};
    const automationForms = (automationRoadmap.roadmap?.first_wave_forms || []).map(form => `<div class="card"><h3>${escapeHtml(form.agency)} ${escapeHtml(form.form_number)}</h3><p>${escapeHtml(form.title || '')}</p><p class="notice-text">${escapeHtml(form.ai_completion_goal || '')}</p></div>`).join('');
    const pipelineRows = (automationRoadmap.roadmap?.pipeline || []).map(step => `<li><strong>${escapeHtml(String(step.step))}. ${escapeHtml(step.key)}</strong>: ${escapeHtml(step.output || '')}</li>`).join('');
    const invSummary = inventory.inventory?.summary || {};
    const qa = (matrix.matrix?.qa_checklist || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
    const f9465Summary = form9465Ready.readiness?.summary || {};
    const f9465CaptureSummary = form9465Capture.readiness?.summary || {};
    const f9465VisualZones = (form9465Visual.visual_qa_plan?.page_zones || []).map(z => `<li>Page ${escapeHtml(String(z.page))}: ${escapeHtml(z.label)} — ${escapeHtml((z.fields || []).slice(0, 4).join(', '))}</li>`).join('');
    const f9465Checks = (form9465Ready.readiness?.checks || []).map(c => `<li>${c.ok ? '✅' : '⬜'} ${escapeHtml(c.label)} — ${escapeHtml(c.detail || '')}</li>`).join('');
    const f9465FieldRows = (form9465Map.field_map?.fields || []).slice(0, 12).map(f => `<li><strong>${escapeHtml(f.official_line)} ${escapeHtml(f.official_label)}</strong> → ${escapeHtml(f.input_key)}</li>`).join('');
    const f9465Samples = (form9465Samples.samples?.sample_cases || []).map(sample => `<li><strong>${escapeHtml(sample.label)}</strong>: ${escapeHtml(sample.purpose || '')}</li>`).join('');
    const f9465FillSummary = form9465FillReady.readiness?.summary || {};
    const f9465OverlaySummary = form9465Overlay.overlay_template || {};
    const f9465FillGates = (form9465FillReady.readiness?.gates || []).map(g => `<li>${g.ok ? '✅' : '⬜'} ${escapeHtml(g.label)} — ${escapeHtml(g.detail || '')}</li>`).join('');
    const f9465FallbackPlan = form9465Fallback.plan || {};
    const f9465LockSummary = form9465Lock.checklist?.summary || {};
    const f9465FinalGateReport = form9465FinalGate.report || {};
    const f9465FallbackChecks = (f9465FallbackPlan.checks || []).map(c => `<li>${c.ok ? '✅' : '⬜'} ${escapeHtml(c.label)}</li>`).join('');
    const f9465OfficialSampleReadiness = form9465OfficialSample.readiness || {};
    const f9465OfficialSampleChecks = (f9465OfficialSampleReadiness.checks || []).slice(0, 8).map(c => `<li>${c.ok ? '✅' : '⬜'} ${escapeHtml(c.label)}</li>`).join('');
    const f9465ComparisonZones = (form9465Comparison.comparison_plan?.zones || []).map(z => `<li>Page ${escapeHtml(String(z.page))}: ${escapeHtml(z.label)} — ${escapeHtml(String(z.field_count || 0))} fields</li>`).join('');
    const f9465PrintReadiness = form9465PrintRelease.readiness || {};
    const f9465PrintBlockers = (f9465PrintReadiness.blockers || []).slice(0, 10).map(b => `<li>⬜ ${escapeHtml(String(b).replace(/_/g, ' '))}</li>`).join('');
    const f9465FinalAudit = form9465FinalAudit.audit || {};
    const f9465FinalAuditGates = (f9465FinalAudit.gates || []).slice(0, 12).map(g => `<li>${g.ok ? '✅' : '⬜'} ${escapeHtml(g.label)}${g.note ? ` — ${escapeHtml(g.note)}` : ''}</li>`).join('');
    const f9465ClientReadyPath = form9465ClientReadyPath.draft_path || {};
    const f9465OperationalCaptureTest = form9465OperationalCapture.test || {};
    const f9465TrueCoordinateWorkflow = form9465TrueCoordinateQa.workflow || {};
    const f9465OperationalChecks = (f9465TrueCoordinateWorkflow.checks || []).slice(0, 12).map(c => `<li>${c.ok ? '✅' : '⬜'} ${escapeHtml(c.label)}${c.detail ? ` — ${escapeHtml(c.detail)}` : ''}</li>`).join('');
    const f9465OperationalReadiness = form9465OperationalReleaseReadiness.readiness || {};
    const f9465CaptureCompletionReadiness = form9465CaptureCompletion.readiness || {};
    const f9465SimulationSummary = form9465SimulationPlan.simulation_plan?.simulation_summary || {};
    const f9465StaffApprovalReport = form9465StaffApprovalGate.report || {};
    const f9465CaptureCompletionChecks = (f9465CaptureCompletionReadiness.checks || []).slice(0, 12).map(c => `<li>${c.ok ? '✅' : '⬜'} ${escapeHtml(c.label)}${c.detail ? ` — ${escapeHtml(c.detail)}` : ''}</li>`).join('');
    const f9465StaffApprovalChecks = (f9465StaffApprovalReport.approval_checks || []).slice(0, 8).map(c => `<li>${c.ok ? '✅' : c.optional ? '•' : '⬜'} ${escapeHtml(c.label)}</li>`).join('');
    box.innerHTML = `<div class="card"><h2>Can we get official forms ourselves?</h2><p>${escapeHtml(discoveryGuide.guide.answer_to_owner || downloadGuide.guide.short_answer || '')}</p><p class="notice-text">${escapeHtml(downloadGuide.guide.current_build_behavior || '')}</p></div><div class="card"><h2>Official URL capture</h2><p>Capture mode: ${captureGuide.guide.enabled ? 'enabled' : 'disabled by default'}</p><p class="notice-text">${escapeHtml(captureGuide.guide.why_disabled_by_default || '')}</p><p class="small">Enable with ${escapeHtml(captureGuide.guide.env_to_enable || '')}</p></div><div class="card"><h2>Official source inventory</h2><p>Seeded source records: ${escapeHtml(String(invSummary.source_records || 0))} · Uploaded PDF records: ${escapeHtml(String(invSummary.pdf_records_ingested || 0))} · Client-output ready: ${escapeHtml(String(invSummary.client_output_ready || 0))}</p><p>Government source catalog available now: ${escapeHtml(String(sourceCatalog.summary?.catalog_total || 0))} records.</p></div><div class="card wide"><h2>IRS Form 9465 output path</h2><p>First controlled official-output workflow: ${escapeHtml(String(f9465Summary.passed || 0))}/${escapeHtml(String(f9465Summary.required_checks || 0))} checks passed · Client-output ready: ${f9465Summary.client_output_ready ? 'yes' : 'no'}</p><ul>${f9465Checks}</ul><p class="notice-text">9465 field candidates are line-level and still require official PDF capture, field/overlay confirmation, sample-fill QA, client verification, and professional release before final print/signature output.</p></div><div class="card wide"><h2>9465 official PDF capture + visual QA</h2><p>Capture/readiness: ${escapeHtml(String(f9465CaptureSummary.passed || 0))}/${escapeHtml(String(f9465CaptureSummary.required_checks || 0))} checks passed · Final output ready: ${f9465CaptureSummary.final_client_output_ready ? 'yes' : 'no'}</p><p class="notice-text">v0.1.31 adds official IRS 9465 PDF capture readiness, visual field QA zones, overlay-coordinate drafts, and a staff visual QA board. Final client output remains blocked.</p><ul>${f9465VisualZones}</ul></div><div class="card wide"><h2>9465 fill engine + sample overlay prep</h2><p>Fill-engine readiness: ${escapeHtml(String(f9465FillSummary.passed || 0))}/${escapeHtml(String(f9465FillSummary.required_gates || 0))} release gates passed · Final output ready: ${f9465FillSummary.client_final_output_ready ? 'yes' : 'no'}</p><p>Overlay template: ${escapeHtml(String(f9465OverlaySummary.field_count || 0))} fields · ${escapeHtml(String(f9465OverlaySummary.overlay_candidate_count || 0))} overlay candidates · ${escapeHtml(String(f9465OverlaySummary.unmapped_count || 0))} unmapped fields.</p><p class="notice-text">v0.1.32 adds actual PDF fill/overlay engine prep, fill-plan output values, sample filled overlay QA PDFs, and a staff fill-engine board. Final client IRS output remains blocked.</p><ul>${f9465FillGates}</ul></div><div class="card wide"><h2>9465 official PDF upload fallback + coordinate lock</h2><p>Fallback readiness: ${escapeHtml(String(f9465FallbackPlan.passed || 0))}/${escapeHtml(String(f9465FallbackPlan.required_checks || 0))} checks passed · Coordinate lock: ${f9465LockSummary.all_pages_locked ? 'all pages locked' : 'not fully locked'} · Final output: ${f9465FinalGateReport.client_final_output_allowed ? 'allowed' : 'blocked'}</p><p class="notice-text">v0.1.33 adds official IRS PDF upload fallback, checksum validation, coordinate-lock checklist/board, and final-output gate reporting. Upload fallback is staff/admin only and does not make the form client-output-ready.</p><ul>${f9465FallbackChecks}</ul></div><div class="card wide"><h2>9465 official sample output + visual comparison</h2><p>Readiness: ${escapeHtml(String(f9465OfficialSampleReadiness.passed || 0))}/${escapeHtml(String(f9465OfficialSampleReadiness.required_checks || 0))} checks passed · Final output: ${f9465OfficialSampleReadiness.client_final_output_allowed ? 'allowed' : 'blocked'}</p><p class="notice-text">v0.1.34 adds official-sample output preview, a visual overlay comparison plan, internal comparison packet generation, and staff QA status tracking. It still does not enable final client IRS output.</p><ul>${f9465OfficialSampleChecks}</ul><h3>Comparison zones</h3><ul>${f9465ComparisonZones}</ul></div><div class="card wide"><h2>9465 client verification + professional release</h2><p>Print/signature draft allowed: ${f9465PrintReadiness.print_signature_draft_allowed ? 'yes' : 'no'} · Final IRS output: ${f9465PrintReadiness.final_client_irs_output_allowed ? 'allowed' : 'blocked'}</p><p class="notice-text">v0.1.35 adds the client verification checklist, professional release gate, release board, and controlled print/signature draft packet workflow. Final IRS output remains blocked until official PDF, coordinate lock, professional signoff, client verification, and production gates pass.</p><p class="small">${escapeHtml(form9465ClientRelease.policy?.print_signature_rule || '')}</p><ul>${f9465PrintBlockers}</ul></div><div class="card wide"><h2>9465 final output gate audit + client-ready draft path</h2><p>Final gate audit: ${escapeHtml(String(f9465FinalAudit.passed || 0))}/${escapeHtml(String(f9465FinalAudit.required_gates || 0))} gates passed · Supervised draft: ${f9465FinalAudit.supervised_client_draft_allowed ? 'allowed' : 'blocked'} · Final IRS output: ${f9465FinalAudit.final_client_irs_output_allowed ? 'allowed' : 'blocked'}</p><p class="notice-text">v0.1.36 adds the final output gate audit, first client-ready draft path once PDF gates pass, final release board, and audit packet workflow. It remains blocked until official PDF, checksum, coordinate lock, visual QA, client verification, professional release, payment/quote, and production security all pass.</p><p class="small">${escapeHtml(form9465FinalReleasePolicy.policy?.customer_language || '')}</p><ul>${f9465FinalAuditGates}</ul><p class="small"><strong>Next step:</strong> ${escapeHtml(f9465ClientReadyPath.client_next_step || '')}</p></div><div class="card wide"><h2>9465 operational capture test + true coordinate QA</h2><p>Operational capture test: ${escapeHtml(String(f9465OperationalCaptureTest.passed || 0))}/${escapeHtml(String(f9465OperationalCaptureTest.required_checks || 0))} checks passed · True-coordinate QA: ${escapeHtml(String(f9465TrueCoordinateWorkflow.passed || 0))}/${escapeHtml(String(f9465TrueCoordinateWorkflow.required_checks || 0))} checks passed · Final output: ${f9465OperationalReadiness.client_output_allowed ? 'allowed' : 'blocked'}</p><p class="notice-text">v0.1.37 adds an operational capture/upload test, measured-coordinate QA workflow, tolerance checks, staff QA board, and final-release readiness from operational QA. Client IRS output remains blocked until all gates pass.</p><ul>${f9465OperationalChecks}</ul></div><div class="card wide"><h2>9465 capture completion + coordinate simulation approvals</h2><p>Capture completion: ${escapeHtml(String(f9465CaptureCompletionReadiness.passed || 0))}/${escapeHtml(String(f9465CaptureCompletionReadiness.required_checks || 0))} checks passed · Actual gate passed: ${f9465CaptureCompletionReadiness.actual_gate_passed ? 'yes' : 'no'} · Simulation approved: ${f9465SimulationSummary.staff_simulation_approved ? 'yes' : 'no'} · Client IRS output: ${f9465StaffApprovalReport.client_output_allowed ? 'allowed' : 'blocked'}</p><p class="notice-text">v0.1.38 adds capture/upload completion readiness, coordinate-lock simulation, staff approval gates, and internal completion packets. Simulation approval cannot authorize final client output.</p><ul>${f9465CaptureCompletionChecks}</ul><h3>Staff approval gates</h3><ul>${f9465StaffApprovalChecks}</ul></div><div class="card wide"><h2>9465 field candidates</h2><ul>${f9465FieldRows}</ul><h3>9465 sample QA cases</h3><ul>${f9465Samples}</ul></div><div class="card wide"><h2>AI-first form completion</h2><p>${escapeHtml(aiPolicy.policy?.goal || '')}</p><p class="notice-text">${escapeHtml(aiPolicy.policy?.human_minimization_rule || '')}</p><ol>${pipelineRows}</ol></div><div class="card wide"><h2>First-wave AI interview templates</h2><div class="grid two">${automationForms}</div></div><div class="card"><h2>Ready for official form ZIPs</h2><p>${guide.guide.ready_for_uploads ? 'Yes — the platform can accept official IRS/NYS/NYC form ZIPs and build a mapping queue.' : 'Not ready yet.'}</p><p><strong>Preferred:</strong> one agency per ZIP, keep official filenames, include instructions, and provide source page URL.</p><ul class="list-clean">${(guide.guide.what_to_upload_now || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="card"><h2>Readiness matrix</h2><p>Total uploaded forms: ${escapeHtml(String(matrixSummary.total || 0))} · Client-output ready: ${escapeHtml(String(matrixSummary.client_output_ready || 0))}</p><p class="small">Statuses: ${escapeHtml(JSON.stringify(matrixSummary.by_status || {}))}</p><p class="notice-text">${escapeHtml(matrix.matrix?.policy || '')}</p></div><div class="card wide"><h2>Controlled mapping stages</h2><ol>${stages}</ol></div><div class="card wide"><h2>Seeded source records</h2>${sourceRows}</div><div class="card wide"><h2>First official government source catalog</h2><ul>${catalogRows}</ul></div><div class="grid two">${waves}</div><div class="card wide"><h2>Form QA checklist before client output</h2><ul>${qa}</ul></div><div class="card wide"><h2>Current PDF mapping queue</h2>${rows}</div>`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>${escapeHtml(error.message)}</p></div>`;
  }
}


async function loadMarketingConversion() {
  const box = qs('#marketing-conversion');
  if (!box) return;
  try {
    const plan = await api('/api/platform/marketing-conversion-plan');
    const checklist = await api('/api/platform/campaign-landing-checklist');
    const roadmap = await api('/api/platform/seo-service-page-roadmap');
    const funnels = (plan.plan?.primaryFunnels || []).map((f) => `<div class="card"><h3>${escapeHtml(f.label)}</h3><p><strong>Start:</strong> ${escapeHtml(f.startPath)}</p><p>${(f.entryPages || []).map(slug => `<a href="/${escapeAttr(slug)}.html">${escapeHtml(slug.replace(/-/g, ' '))}</a>`).join('<br>')}</p></div>`).join('');
    const rules = (plan.plan?.conversionRules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    const checks = (checklist.checklist?.checklist || []).map((c) => `<li>${c.required ? 'Required' : 'Recommended'}: ${escapeHtml(c.label)}</li>`).join('');
    const future = (roadmap.roadmap?.futurePages || []).slice(0, 12).map((x) => `<li>${escapeHtml(x.replace(/-/g, ' '))}</li>`).join('');
    box.innerHTML = `<h2>Marketing Conversion Pages</h2><p>${escapeHtml(plan.plan?.positioning || '')}</p><div class="grid two">${funnels}</div><h3>Conversion rules</h3><ul class="checklist">${rules}</ul><h3>Campaign checklist</h3><ul class="checklist">${checks}</ul><h3>Future SEO page roadmap</h3><ul class="checklist">${future}</ul><p class="notice-text">Marketing conversion pages should route into existing intake and professional review flows. They must not bypass sensitive-upload, official-form output, payment, quote, client verification, or professional signoff gates.</p>`;
  } catch (error) {
    box.innerHTML = `<h2>Marketing Conversion Pages</h2><p>${escapeHtml(error.message)}</p>`;
  }
}
// v0.1.29 Staff Cockpit + Analytics markers: analytics-funnel, marketing-attribution, operational-alerts, privacy-safe analytics.

// v0.1.30 Private Pilot Release Candidate markers: private-pilot-release-candidate, private-pilot-go-no-go, private-pilot-regression-checklist, compliance-copy-audit, pilot-marketing-safety-review, sample pilot scenarios.
// v0.1.31 IRS Form 9465 visual QA markers: pdf-capture-readiness, visual-field-qa-plan, visual-sample-qa, visual-qa-packet, visual-qa-board, official PDF capture readiness, overlay-coordinate drafts.

// v0.1.32 IRS Form 9465 fill engine markers: 9465 fill engine, fill-engine-readiness, overlay-template, fill-plan, sample-filled-overlay-pdf, actual PDF fill/overlay engine prep.
// v0.1.33 IRS Form 9465 official PDF upload fallback markers: capture-upload-fallback-plan, coordinate-lock-checklist, final-output-gate-report, upload-official-pdf, coordinate-lock-board, coordinate-lock workflow, official PDF upload fallback.

// v0.1.34 IRS Form 9465 official sample output markers: official-sample-output-readiness, visual-overlay-comparison-plan, official-sample-output-preview, official-sample-output-packet, official-sample-qa-board, official sample output, visual overlay comparison workflow.
// v0.1.35 IRS Form 9465 release markers: client-release-policy, client-verification-checklist, professional-release-gate, print-signature-draft-readiness, print-signature-draft-packet, release-gate-board, client verification, professional release gate, print/signature draft workflow.
// v0.1.36 IRS Form 9465 final release markers: final-release-policy, final-output-gate-audit, client-ready-draft-path, client-ready-draft-packet, final-release-board, final release gate audit, client-ready draft path.
// v0.1.37 IRS Form 9465 operational QA markers: operational-capture-test, true-coordinate-qa-workflow, operational-qa-board, true-coordinate-qa-status, final-release readiness from operational QA.
// v0.1.38 IRS Form 9465 capture-completion markers: capture-completion-readiness, coordinate-lock-simulation-plan, staff-approval-gate-report, capture-completion-board, capture-completion-status.
