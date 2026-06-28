const PDFDocument = require('pdfkit');
const { IRS_9465_CAPTURE_PROFILE, inspectCaptured9465Pdf, build9465PdfCaptureReadiness } = require('./form9465VisualQa');
const { build9465FinalOutputGateReport } = require('./form9465CoordinateLock');
const { build9465OfficialSampleOutputReadiness, build9465OfficialSampleOutputPreview } = require('./form9465OfficialSample');
const { build9465PrintSignatureDraftReadiness, build9465ProfessionalReleaseGate } = require('./form9465ClientRelease');
const { buildProductionSecurityReadiness } = require('./productionSecurity');

const VERSION = '0.1.36';

const FORM_9465_FINAL_RELEASE_POLICY = {
  version: VERSION,
  name: 'IRS Form 9465 final output gate audit and client-ready draft path',
  goal: 'Create the first fully auditable path from AI-prepared Form 9465 answers to a client-ready print/signature draft, while keeping final IRS output blocked unless every official-PDF, visual QA, client verification, professional release, payment, and production-security gate has passed.',
  allowed_now: 'Gate audit, readiness reporting, internal release packets, and staff status tracking.',
  not_allowed_yet: 'Automatic final IRS filing output, e-file, direct IRS submission, or ungated client release.',
  final_output_definition: 'A client-ready print/signature draft means the client can review a completed official IRS Form 9465 draft for printing/signing only after the official PDF is captured/uploaded, checksummed, coordinate-locked, sample-tested, visually compared, client-verified, professional-released, and production gates are complete.',
  release_sequence: [
    'Official IRS Form 9465 source seeded from irs.gov.',
    'Official PDF captured or uploaded through the controlled fallback with checksum recorded.',
    'Page/field coordinates or AcroForm field names locked against the captured PDF.',
    'Sample-fill / visual overlay comparison completed for representative cases.',
    'Overflow, date, checkbox, signature/date blank, direct-debit, and government-only fields reviewed.',
    'Client verifies all values and warnings.',
    'Required professional release/signoff is recorded.',
    'Payment/quote gates are satisfied where applicable.',
    'Production security gates allow sensitive data/output handling.',
    'Staff records final release audit decision.'
  ],
  customer_language: 'This form can be prepared for your review, but you must review it carefully before signing. No payment plan, IRS acceptance, deadline, relief, or agency outcome is guaranteed.'
};

const FINAL_RELEASE_STATUS_VALUES = [
  'gate_audit_started',
  'needs_official_pdf',
  'needs_coordinate_lock',
  'needs_visual_sample_qa',
  'needs_client_verification',
  'needs_professional_release',
  'needs_payment_or_quote_clearance',
  'needs_production_security_clearance',
  'ready_for_supervised_client_draft',
  'client_ready_draft_released',
  'blocked_or_rework_needed'
];

function bool(value) { return value === true || value === 'true' || value === 'on' || value === '1' || value === 1; }
function text(value = '', max = 1000) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }

function latest(collection, store, predicate = () => true) {
  if (!store || !store.list) return null;
  return store.list(collection, (item) => !item.deleted_at && predicate(item)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
}

function latestFinalReleaseStatus(store, caseId = '') {
  return latest('form_9465_final_release_events', store, (item) => !caseId || item.case_id === caseId);
}

function paymentClearance(store, taxCase = {}) {
  const caseId = taxCase.id || '';
  const payments = store && store.list ? store.list('payments', (p) => !p.deleted_at && (!caseId || p.case_id === caseId)) : [];
  const quotes = store && store.list ? store.list('quotes', (q) => !q.deleted_at && (!caseId || q.case_id === caseId)) : [];
  const paid = payments.some((p) => ['paid', 'succeeded', 'complete', 'mock_paid'].includes(String(p.status || '').toLowerCase()));
  const approvedQuote = quotes.some((q) => ['approved', 'customer_approved', 'accepted'].includes(String(q.status || '').toLowerCase()));
  const paymentNotRequired = bool(taxCase.payment_not_required) || String(taxCase.service_level || '').toLowerCase().includes('free');
  return {
    ok: paid || approvedQuote || paymentNotRequired,
    paid,
    approved_quote: approvedQuote,
    payment_not_required: paymentNotRequired,
    payments_seen: payments.length,
    quotes_seen: quotes.length,
    note: paid ? 'Paid payment record found.' : (approvedQuote ? 'Customer-approved quote found; staff must still verify payment policy before release.' : (paymentNotRequired ? 'Case marked payment-not-required.' : 'No paid or approved quote record found.'))
  };
}

function productionOutputClearance(store) {
  const security = buildProductionSecurityReadiness(store);
  const report = security.report || security;
  const required = report.required_checks || report.checks || [];
  const summary = report.summary || {};
  const ok = Boolean(summary.live_sensitive_upload_ready || summary.production_security_ready || report.ready_for_sensitive_uploads || false);
  return {
    ok,
    status: summary.status || report.status || (ok ? 'production_security_ready' : 'production_security_not_ready'),
    blockers: (required || []).filter((c) => c.required !== false && !c.ok).map((c) => c.key || c.label).filter(Boolean).slice(0, 40),
    note: ok ? 'Production security report indicates sensitive/output release readiness.' : 'Production security is not fully approved; final IRS client output remains blocked.'
  };
}

function build9465FinalOutputGateAudit(store, taxCase = {}, answers = {}) {
  const caseId = taxCase.id || '';
  const pdfInspection = inspectCaptured9465Pdf(store);
  const captureReadiness = build9465PdfCaptureReadiness(store);
  const finalGate = build9465FinalOutputGateReport(store);
  const officialSample = build9465OfficialSampleOutputReadiness(store);
  const printReadiness = build9465PrintSignatureDraftReadiness(store, taxCase, answers);
  const professionalGate = build9465ProfessionalReleaseGate(store, taxCase, answers);
  const payment = paymentClearance(store, taxCase);
  const production = productionOutputClearance(store);
  const finalStatus = latestFinalReleaseStatus(store, caseId);
  const gateLookup = new Map((finalGate.gates || []).map((g) => [g.key, g]));
  const officialSampleLookup = new Map((officialSample.checks || []).map((g) => [g.key, g]));
  const gates = [
    { key: 'official_pdf_available', label: 'Official IRS Form 9465 PDF captured/uploaded', ok: Boolean(pdfInspection.ok) || Boolean(gateLookup.get('official_pdf_available') && gateLookup.get('official_pdf_available').ok), source: 'official_pdf_inspection' },
    { key: 'checksum_recorded', label: 'Official PDF SHA-256 checksum recorded', ok: Boolean(gateLookup.get('checksum_recorded') && gateLookup.get('checksum_recorded').ok), source: 'coordinate_lock_gate' },
    { key: 'source_url_validated', label: 'Official IRS source URL recorded/validated', ok: Boolean(captureReadiness.summary && captureReadiness.summary.source_seeded), source: 'capture_readiness' },
    { key: 'coordinates_locked', label: 'Page/field coordinates locked', ok: Boolean(gateLookup.get('coordinates_locked') && gateLookup.get('coordinates_locked').ok), source: 'coordinate_lock_gate' },
    { key: 'visual_sample_packet_generated', label: 'Official-sample visual comparison packet generated', ok: Boolean(officialSampleLookup.get('comparison_packet_generated') && officialSampleLookup.get('comparison_packet_generated').ok), source: 'official_sample_readiness' },
    { key: 'page_1_compared', label: 'Page 1 visual comparison passed/recorded', ok: Boolean(officialSampleLookup.get('page_1_compared') && officialSampleLookup.get('page_1_compared').ok), source: 'official_sample_readiness' },
    { key: 'page_2_compared', label: 'Page 2 visual comparison passed/recorded', ok: Boolean(officialSampleLookup.get('page_2_compared') && officialSampleLookup.get('page_2_compared').ok), source: 'official_sample_readiness' },
    { key: 'overflow_review_passed', label: 'Overflow/formatting review passed', ok: Boolean(officialSampleLookup.get('overflow_review_passed') && officialSampleLookup.get('overflow_review_passed').ok), source: 'official_sample_readiness' },
    { key: 'signature_blank_review_passed', label: 'Signature/date fields verified blank until taxpayer review/signing', ok: Boolean(officialSampleLookup.get('signature_blank_review_passed') && officialSampleLookup.get('signature_blank_review_passed').ok), source: 'official_sample_readiness' },
    { key: 'direct_debit_review_passed', label: 'Direct debit fields confirmed-or-blank', ok: Boolean(officialSampleLookup.get('direct_debit_review_passed') && officialSampleLookup.get('direct_debit_review_passed').ok), source: 'official_sample_readiness' },
    { key: 'client_values_verified', label: 'Client values and warnings verified', ok: Boolean(printReadiness.client_verification && printReadiness.client_verification.status === 'client_values_verified') || Boolean(professionalGate.gates && professionalGate.gates.find((g) => g.key === 'client_values_verified' && g.ok)), source: 'client_verification' },
    { key: 'professional_release_signoff', label: 'Required professional release/signoff recorded', ok: Boolean(professionalGate.gates && professionalGate.gates.find((g) => g.key === 'professional_release_signoff' && g.ok)), source: 'professional_release_gate' },
    { key: 'payment_or_quote_clearance', label: 'Payment/quote clearance verified where applicable', ok: payment.ok, source: 'payment_workflow', note: payment.note },
    { key: 'production_security_clearance', label: 'Production security gates allow live sensitive output', ok: production.ok, source: 'production_security', note: production.note },
    { key: 'staff_final_release_audit', label: 'Staff final release audit recorded', ok: Boolean(finalStatus && ['ready_for_supervised_client_draft', 'client_ready_draft_released'].includes(finalStatus.status)), source: 'final_release_events' }
  ];
  const blockers = gates.filter((g) => !g.ok).map((g) => ({ key: g.key, label: g.label, source: g.source, note: g.note || '' }));
  const supervisedDraftAllowed = gates.filter((g) => ['official_pdf_available','checksum_recorded','coordinates_locked','visual_sample_packet_generated','page_1_compared','page_2_compared','overflow_review_passed','signature_blank_review_passed','direct_debit_review_passed','client_values_verified','professional_release_signoff','payment_or_quote_clearance'].includes(g.key)).every((g) => g.ok);
  const finalClientIrsOutputAllowed = supervisedDraftAllowed && production.ok && Boolean(finalStatus && finalStatus.status === 'client_ready_draft_released');
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_FINAL_RELEASE_POLICY,
    case_id: caseId,
    gates,
    passed: gates.filter((g) => g.ok).length,
    required_gates: gates.length,
    blockers,
    supervised_client_draft_allowed: supervisedDraftAllowed,
    final_client_irs_output_allowed: finalClientIrsOutputAllowed,
    final_status: finalStatus ? { id: finalStatus.id, status: finalStatus.status, created_at: finalStatus.created_at, released_at: finalStatus.released_at || '' } : null,
    payment_clearance: payment,
    production_clearance: production,
    official_pdf_inspection: pdfInspection,
    status: finalClientIrsOutputAllowed ? 'client_ready_irs_9465_output_release_allowed' : (supervisedDraftAllowed ? 'supervised_client_draft_ready_but_production_or_final_audit_needed' : 'blocked_pending_required_gates'),
    next_best_actions: blockers.slice(0, 8).map((b) => b.label)
  };
}

function build9465ClientReadyDraftPath(store, taxCase = {}, answers = {}) {
  const audit = build9465FinalOutputGateAudit(store, taxCase, answers);
  const preview = build9465OfficialSampleOutputPreview(answers, store);
  const stepGroups = [
    { key: 'source_and_pdf', label: 'Source/PDF control', steps: ['Seed official IRS source', 'Capture or upload official PDF', 'Record checksum', 'Inspect PDF pages'] },
    { key: 'coordinate_and_visual_qa', label: 'Coordinate and visual QA', steps: ['Lock page 1 coordinates', 'Lock page 2 coordinates', 'Generate sample output packet', 'Pass visual and overflow review'] },
    { key: 'client_and_professional', label: 'Client and professional release', steps: ['Client verifies values and warnings', 'Professional signs off for print/signature draft', 'Payment/quote is cleared if required'] },
    { key: 'production_and_final_release', label: 'Production and final output release', steps: ['Production security permits output', 'Staff records final release audit', 'Only then release client-ready print/signature draft'] }
  ];
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    status: audit.status,
    case_id: taxCase.id || '',
    step_groups: stepGroups,
    audit_summary: {
      passed: audit.passed,
      required_gates: audit.required_gates,
      blocker_count: audit.blockers.length,
      supervised_client_draft_allowed: audit.supervised_client_draft_allowed,
      final_client_irs_output_allowed: audit.final_client_irs_output_allowed
    },
    blockers: audit.blockers,
    preview_counts: preview.page_populated_counts || {},
    populated_fields_preview: (preview.populated_fields_preview || []).slice(0, 30),
    blocked_fields_preview: (preview.blocked_fields || []).slice(0, 30),
    release_language: FORM_9465_FINAL_RELEASE_POLICY.customer_language,
    client_next_step: audit.final_client_irs_output_allowed ? 'Review the completed Form 9465 draft carefully before printing/signing/submission.' : 'Continue through the missing gates before any client-ready IRS Form 9465 draft is released.'
  };
}

function record9465FinalReleaseAuditStatus(store, taxCase = {}, payload = {}, actor = {}) {
  const status = FINAL_RELEASE_STATUS_VALUES.includes(String(payload.status || '')) ? String(payload.status) : 'gate_audit_started';
  const audit = build9465FinalOutputGateAudit(store, taxCase, payload.answers || {});
  const releaseRequested = status === 'client_ready_draft_released';
  const releaseAllowed = releaseRequested && audit.supervised_client_draft_allowed && audit.production_clearance.ok;
  const record = store.insert('form_9465_final_release_events', {
    id: `9465final_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    case_id: taxCase.id || text(payload.case_id || '', 120),
    status: releaseRequested && !releaseAllowed ? 'blocked_or_rework_needed' : status,
    requested_status: status,
    supervised_client_draft_allowed: audit.supervised_client_draft_allowed,
    final_client_irs_output_allowed: releaseAllowed,
    blocked_release_attempt: releaseRequested && !releaseAllowed,
    blockers: audit.blockers,
    notes: text(payload.notes || '', 2500),
    staff_id: actor.id || 'staff',
    released_at: releaseAllowed ? new Date().toISOString() : '',
    created_at: new Date().toISOString()
  });
  if (taxCase.id) {
    store.update('cases', taxCase.id, {
      form_9465_final_release_status: record.status,
      form_9465_final_release_event_id: record.id,
      form_9465_final_client_irs_output_allowed: releaseAllowed,
      release_status: releaseAllowed ? 'form_9465_client_ready_draft_released' : `form_9465_${record.status}`
    });
  }
  return { record, audit };
}

function build9465FinalReleaseBoard(store) {
  const events = store && store.list ? store.list('form_9465_final_release_events', (e) => !e.deleted_at).slice(0, 100) : [];
  const cases = store && store.list ? store.list('cases', (c) => !c.deleted_at).slice(0, 100) : [];
  const byStatus = events.reduce((acc, e) => { acc[e.status || 'unknown'] = (acc[e.status || 'unknown'] || 0) + 1; return acc; }, {});
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_FINAL_RELEASE_POLICY,
    summary: {
      final_release_events: events.length,
      by_status: byStatus,
      cases_with_final_release_tracking: cases.filter((c) => c.form_9465_final_release_status).length,
      final_client_irs_output_released: events.filter((e) => e.final_client_irs_output_allowed).length
    },
    columns: FINAL_RELEASE_STATUS_VALUES,
    events: events.map((e) => ({ id: e.id, case_id: e.case_id, status: e.status, requested_status: e.requested_status, supervised_client_draft_allowed: e.supervised_client_draft_allowed, final_client_irs_output_allowed: e.final_client_irs_output_allowed, blocker_count: (e.blockers || []).length, created_at: e.created_at, released_at: e.released_at || '' })),
    cases: cases.filter((c) => c.form_9465_final_release_status).map((c) => ({ id: c.id, status: c.form_9465_final_release_status, release_status: c.release_status, final_output_allowed: c.form_9465_final_client_irs_output_allowed }))
  };
}

async function create9465ClientReadyDraftPacketPdfBuffer({ answers = {}, store, taxCase = {}, actor = {}, mode = 'audit_packet' } = {}) {
  const audit = build9465FinalOutputGateAudit(store, taxCase, answers);
  const path = build9465ClientReadyDraftPath(store, taxCase, answers);
  const preview = build9465OfficialSampleOutputPreview(answers, store);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 44 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('Justice Tax Solutions — IRS Form 9465 Final Output Gate Audit');
    doc.moveDown(0.3).fontSize(9).fillColor(audit.final_client_irs_output_allowed ? '#0d5c38' : '#8b1e1e').text(audit.final_client_irs_output_allowed ? 'CLIENT-READY DRAFT RELEASE AUDIT PASSED' : 'AUDIT / REVIEW PACKET ONLY — FINAL IRS OUTPUT BLOCKED');
    doc.fillColor('#111').fontSize(10).text(`Version: ${VERSION}`);
    doc.text(`Case: ${taxCase.id || 'ad hoc sample'}`);
    doc.text(`Mode: ${mode}`);
    doc.text(`Gates passed: ${audit.passed}/${audit.required_gates}`);
    doc.text(`Supervised client draft allowed: ${audit.supervised_client_draft_allowed ? 'yes' : 'no'}`);
    doc.text(`Final client IRS output allowed: ${audit.final_client_irs_output_allowed ? 'yes' : 'no'}`);
    doc.moveDown().fontSize(12).text('Required release gates', { underline: true });
    for (const gate of audit.gates) {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).fillColor(gate.ok ? '#0d5c38' : '#8b1e1e').text(`${gate.ok ? '✓' : '□'} ${gate.label}${gate.note ? ` — ${gate.note}` : ''}`);
    }
    doc.addPage().fillColor('#111').fontSize(12).text('Client-ready draft path', { underline: true });
    for (const group of path.step_groups) {
      if (doc.y > 690) doc.addPage();
      doc.fontSize(10).fillColor('#111').text(group.label);
      for (const step of group.steps) doc.fontSize(8).text(`• ${step}`);
      doc.moveDown(0.4);
    }
    doc.addPage().fontSize(12).text('Preview field values', { underline: true });
    (preview.populated_fields_preview || []).slice(0, 90).forEach((field) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(7.5).text(`Line ${field.line || ''} · ${field.input_key || ''}: ${field.value || ''}`);
    });
    doc.addPage().fontSize(12).text('Release limitations', { underline: true });
    [
      FORM_9465_FINAL_RELEASE_POLICY.customer_language,
      'This packet does not guarantee IRS acceptance, installment agreement approval, payment terms, account resolution, deadline protection, or any agency outcome.',
      'Signature and date fields must remain blank until the taxpayer/spouse personally reviews and signs the final printed draft.',
      'Direct-debit fields must be expressly client-confirmed or left blank.',
      'Government-only/officer-only fields must remain blank.',
      'Do not release final client IRS output until every gate in this audit passes.'
    ].forEach((line) => doc.fontSize(9).text(`• ${line}`));
    if (actor && actor.email) doc.moveDown().fontSize(8).text(`Generated by: ${actor.email}`);
    doc.end();
  });
}

module.exports = {
  FORM_9465_FINAL_RELEASE_POLICY,
  FINAL_RELEASE_STATUS_VALUES,
  build9465FinalOutputGateAudit,
  build9465ClientReadyDraftPath,
  record9465FinalReleaseAuditStatus,
  build9465FinalReleaseBoard,
  create9465ClientReadyDraftPacketPdfBuffer
};
