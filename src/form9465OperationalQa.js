const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { IRS_9465_CAPTURE_PROFILE, inspectCaptured9465Pdf, build9465PdfCaptureReadiness } = require('./form9465VisualQa');
const { build9465OverlayTemplate, build9465FillPlan, create9465SampleFilledOverlayPdfBuffer } = require('./form9465FillEngine');
const { build9465CoordinateLockChecklist, build9465CoordinateLockBoard } = require('./form9465CoordinateLock');
const { build9465FinalOutputGateAudit } = require('./form9465FinalRelease');

const VERSION = '0.1.37';

const FORM_9465_OPERATIONAL_QA_POLICY = {
  version: VERSION,
  goal: 'Turn the IRS Form 9465 capture/upload and coordinate-lock workflow into an operational test path that staff can run before any client-ready IRS output is released.',
  scope: [
    'verify that official IRS Form 9465 source/capture/upload records exist',
    'confirm checksum and PDF inspection metadata are present',
    'run a true-coordinate QA workflow with measured coordinates, tolerances, and visual reviewer status',
    'record sample output, overflow, signature-blank, and direct-debit field checks',
    'keep the final client IRS output gate blocked until every release gate is recorded and approved'
  ],
  no_false_claims: 'A passed operational test does not by itself make Form 9465 client-output-ready. It only moves the form closer to final release after official PDF, coordinate, visual, client, professional, payment, and production security gates pass.',
  manual_first: 'The platform can test captured/uploaded PDFs and staff-measured coordinates now. Automated OCR/render comparison can be added later, but the workflow must not pretend automated visual approval exists until it is implemented and tested.'
};

const TRUE_COORDINATE_QA_STATUS_VALUES = [
  'measurement_started',
  'coordinates_measured',
  'sample_overlay_generated',
  'visual_compare_passed',
  'visual_compare_failed',
  'overflow_passed',
  'signature_blank_passed',
  'direct_debit_passed',
  'ready_for_final_release_audit',
  'blocked_needs_rework'
];

const COORDINATE_TOLERANCE_POINTS = Number(process.env.FORM_9465_COORDINATE_TOLERANCE_POINTS || 4);

function text(value = '', max = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function bool(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1 || value === '1';
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shaForObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex').slice(0, 32);
}

function latestEvents(store) {
  if (!store || !store.list) return [];
  return store.list('form_9465_true_coordinate_qa_events', (e) => !e.deleted_at).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function latestStatus(store, statuses = []) {
  const wanted = new Set(statuses);
  return latestEvents(store).find((e) => wanted.has(e.status)) || null;
}

function capturedRecord(store) {
  if (!store || !store.find) return null;
  return store.find('official_forms', (f) => !f.deleted_at && f.agency === 'IRS' && String(f.form_number || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase() === '9465' && (f.sha256 || f.storage_path)) || null;
}

function build9465OperationalCaptureTest(store) {
  const readiness = build9465PdfCaptureReadiness(store);
  const inspection = inspectCaptured9465Pdf(store);
  const captured = capturedRecord(store);
  const checks = [
    { key: 'source_record_seeded', label: 'Official IRS Form 9465 source record exists', ok: Boolean(readiness.source || (readiness.summary && readiness.summary.source_seeded)), detail: readiness.source ? readiness.source.id : '' },
    { key: 'official_pdf_record_exists', label: 'Official PDF capture/upload record exists', ok: Boolean(captured), detail: captured ? captured.id : '' },
    { key: 'checksum_recorded', label: 'SHA-256 checksum recorded', ok: Boolean(captured && captured.sha256), detail: captured ? captured.sha256 : '' },
    { key: 'source_url_recorded', label: 'Official irs.gov source URL recorded', ok: Boolean(captured && /irs\.gov/i.test(String(captured.pdf_url || captured.source_url || captured.source_page_url || ''))), detail: captured ? (captured.pdf_url || captured.source_url || captured.source_page_url || '') : '' },
    { key: 'pdf_inspection_ok', label: 'Captured/uploaded PDF inspection passes basic checks', ok: Boolean(inspection && inspection.ok), detail: inspection && inspection.status ? inspection.status : 'not inspected or missing' },
    { key: 'page_count_expected_or_review_needed', label: 'Expected two-page Form 9465 layout confirmed or flagged for review', ok: Boolean((inspection && inspection.page_count === 2) || (captured && captured.expected_pages === 2) || (captured && captured.page_count === 2)), detail: `expected ${IRS_9465_CAPTURE_PROFILE.expected_pages} pages` },
    { key: 'client_output_still_blocked', label: 'Captured/uploaded PDF remains blocked from client output until final gates pass', ok: captured ? captured.can_drive_client_output !== true : true, detail: captured ? (captured.release_status || 'not client output ready') : 'no captured PDF yet' }
  ];
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    status: checks.every((c) => c.ok) ? 'capture_or_upload_operational_test_passed_for_coordinate_qa' : 'capture_or_upload_operational_test_blocked',
    checks,
    passed: checks.filter((c) => c.ok).length,
    required_checks: checks.length,
    readiness_summary: readiness.summary || {},
    inspection: inspection || {},
    captured_pdf_record: captured ? { ...captured, storage_path: captured.storage_path ? '[redacted]' : '' } : null,
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label),
    client_output_allowed: false
  };
}

function buildMeasurementPlan() {
  const template = build9465OverlayTemplate();
  const fields = (template.fields || []).filter((f) => f.overlay_coordinate).map((f) => ({
    input_key: f.input_key,
    official_line: f.official_line,
    official_label: f.official_label,
    page: f.overlay_coordinate.page,
    candidate: {
      x: f.overlay_coordinate.x,
      y: f.overlay_coordinate.y,
      width: f.overlay_coordinate.width,
      height: f.overlay_coordinate.height
    },
    measurement_required: true,
    tolerance_points: COORDINATE_TOLERANCE_POINTS,
    reviewer_instruction: 'Render the captured official IRS PDF page at 100% or a known scale, compare the sample overlay box/value to the official field, then record observed coordinates or pass/fail notes.'
  }));
  return fields;
}

function compareMeasurement(candidate = {}, observed = {}) {
  const keys = ['x', 'y', 'width', 'height'];
  const deltas = {};
  let comparable = true;
  for (const key of keys) {
    const cand = numberOrNull(candidate[key]);
    const obs = numberOrNull(observed[key]);
    if (cand == null || obs == null) comparable = false;
    deltas[key] = cand != null && obs != null ? Number((obs - cand).toFixed(2)) : null;
  }
  const maxAbsDelta = Math.max(0, ...Object.values(deltas).filter((v) => v != null).map((v) => Math.abs(v)));
  return {
    comparable,
    deltas,
    max_abs_delta_points: maxAbsDelta,
    within_tolerance: comparable && maxAbsDelta <= COORDINATE_TOLERANCE_POINTS,
    tolerance_points: COORDINATE_TOLERANCE_POINTS
  };
}

function normalizeMeasurementRecord(record = {}) {
  const candidate = record.candidate || {};
  const observed = record.observed || {};
  const comparison = compareMeasurement(candidate, observed);
  return {
    input_key: text(record.input_key || record.field_key || '', 120),
    official_line: text(record.official_line || '', 80),
    page: Number(record.page || candidate.page || 0) || null,
    candidate: {
      x: numberOrNull(candidate.x),
      y: numberOrNull(candidate.y),
      width: numberOrNull(candidate.width),
      height: numberOrNull(candidate.height)
    },
    observed: {
      x: numberOrNull(observed.x),
      y: numberOrNull(observed.y),
      width: numberOrNull(observed.width),
      height: numberOrNull(observed.height)
    },
    visual_status: text(record.visual_status || (comparison.within_tolerance ? 'within_tolerance' : 'needs_review'), 80),
    note: text(record.note || '', 500),
    comparison
  };
}

function build9465TrueCoordinateQaWorkflow(store) {
  const captureTest = build9465OperationalCaptureTest(store);
  const lockChecklist = build9465CoordinateLockChecklist(store);
  const coordinateBoard = build9465CoordinateLockBoard(store);
  const measurements = buildMeasurementPlan();
  const events = latestEvents(store);
  const latestReady = latestStatus(store, ['ready_for_final_release_audit']);
  const passedVisual = latestStatus(store, ['visual_compare_passed']);
  const passedOverflow = latestStatus(store, ['overflow_passed']);
  const passedSignature = latestStatus(store, ['signature_blank_passed']);
  const passedDebit = latestStatus(store, ['direct_debit_passed']);
  const checks = [
    { key: 'capture_test_passed', label: 'Capture/upload operational test passed', ok: captureTest.status === 'capture_or_upload_operational_test_passed_for_coordinate_qa' },
    { key: 'measurement_plan_ready', label: 'Coordinate measurement plan exists', ok: measurements.length > 0, detail: `${measurements.length} candidate fields` },
    { key: 'coordinates_have_been_measured', label: 'Staff recorded coordinate measurements', ok: Boolean(latestStatus(store, ['coordinates_measured'])) },
    { key: 'sample_overlay_generated', label: 'Sample overlay output generated for comparison', ok: Boolean(latestStatus(store, ['sample_overlay_generated'])) },
    { key: 'visual_compare_passed', label: 'Visual comparison passed', ok: Boolean(passedVisual) },
    { key: 'overflow_passed', label: 'Overflow/formatting review passed', ok: Boolean(passedOverflow) },
    { key: 'signature_blank_passed', label: 'Signature/date blank review passed', ok: Boolean(passedSignature) },
    { key: 'direct_debit_passed', label: 'Direct-debit fields confirmed or intentionally blank', ok: Boolean(passedDebit) },
    { key: 'coordinate_lock_board_ready', label: 'Coordinate lock board is available for staff', ok: Boolean(coordinateBoard && coordinateBoard.checklist) },
    { key: 'ready_for_final_release_audit', label: 'Staff marked ready for final release audit', ok: Boolean(latestReady) }
  ];
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_OPERATIONAL_QA_POLICY,
    status: checks.every((c) => c.ok) ? 'true_coordinate_qa_ready_for_final_release_audit' : 'true_coordinate_qa_in_progress_or_blocked',
    checks,
    passed: checks.filter((c) => c.ok).length,
    required_checks: checks.length,
    capture_test: captureTest,
    coordinate_lock_summary: coordinateBoard.summary,
    measurement_plan: measurements,
    lock_checklist_summary: {
      final_output_allowed: lockChecklist.final_output_allowed,
      overlay_fields_needing_lock: (lockChecklist.overlay_fields_needing_lock || []).length
    },
    recent_events: events.slice(0, 30),
    client_output_allowed: false,
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label)
  };
}

function record9465TrueCoordinateQaStatus(store, payload = {}, actor = {}) {
  const status = TRUE_COORDINATE_QA_STATUS_VALUES.includes(String(payload.status || '')) ? String(payload.status) : 'measurement_started';
  const rawMeasurements = Array.isArray(payload.measurements) ? payload.measurements.slice(0, 200) : [];
  const measurements = rawMeasurements.map(normalizeMeasurementRecord);
  const comparisonSummary = {
    measurement_count: measurements.length,
    comparable_count: measurements.filter((m) => m.comparison.comparable).length,
    within_tolerance_count: measurements.filter((m) => m.comparison.within_tolerance).length,
    needs_review_count: measurements.filter((m) => !m.comparison.within_tolerance).length,
    tolerance_points: COORDINATE_TOLERANCE_POINTS
  };
  const record = store.insert('form_9465_true_coordinate_qa_events', {
    form_number: '9465',
    agency: 'IRS',
    status,
    page: Number(payload.page || 0) || null,
    zone_key: text(payload.zone_key || '', 120),
    field_keys: Array.isArray(payload.field_keys) ? payload.field_keys.map((x) => text(x, 120)).filter(Boolean).slice(0, 100) : [],
    measurements,
    comparison_summary: comparisonSummary,
    measurement_hash: measurements.length ? shaForObject(measurements) : '',
    sample_packet_id: text(payload.sample_packet_id || '', 160),
    official_form_id: text(payload.official_form_id || '', 160),
    reviewer_role: text(payload.reviewer_role || actor.role || 'staff', 120),
    notes: text(payload.notes || '', 2500),
    staff_id: actor.id || 'staff',
    client_output_allowed: false,
    final_output_warning: 'This true-coordinate QA event is one operational gate only. Final Form 9465 client output remains blocked until every release gate passes.',
    created_at: new Date().toISOString()
  });
  return record;
}

function build9465OperationalQaBoard(store) {
  const workflow = build9465TrueCoordinateQaWorkflow(store);
  const events = latestEvents(store);
  const byStatus = events.reduce((acc, row) => { acc[row.status || 'unknown'] = (acc[row.status || 'unknown'] || 0) + 1; return acc; }, {});
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    summary: {
      status: workflow.status,
      events: events.length,
      by_status: byStatus,
      passed: workflow.passed,
      required_checks: workflow.required_checks,
      client_output_allowed: false
    },
    workflow,
    staff_actions: [
      'Confirm official IRS source/capture/upload record and checksum.',
      'Generate sample overlay output from the current fill plan.',
      'Render official PDF and sample overlay side by side.',
      'Record measured coordinates and tolerance results.',
      'Record visual compare, overflow, signature-blank, and direct-debit pass/fail statuses.',
      'Only then move to final release audit; do not bypass client/professional/security gates.'
    ],
    recent_events: events.slice(0, 50)
  };
}

function build9465FinalReleaseReadinessFromOperationalQa(store, taxCase = {}, answers = {}) {
  const operationalQa = build9465TrueCoordinateQaWorkflow(store);
  const finalAudit = build9465FinalOutputGateAudit(store, taxCase, answers);
  const operationalGate = operationalQa.status === 'true_coordinate_qa_ready_for_final_release_audit';
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    status: operationalGate && finalAudit.final_client_irs_output_allowed ? 'ready_to_release_client_ready_form_9465_draft' : 'blocked_before_client_ready_form_9465_draft',
    operational_qa_ready: operationalGate,
    final_gate_ready: finalAudit.final_client_irs_output_allowed,
    operational_qa: operationalQa,
    final_audit_summary: {
      passed: finalAudit.passed,
      required_gates: finalAudit.required_gates,
      blocker_count: finalAudit.blockers.length,
      final_client_irs_output_allowed: finalAudit.final_client_irs_output_allowed
    },
    blockers: [
      ...operationalQa.checks.filter((c) => !c.ok).map((c) => c.label),
      ...finalAudit.blockers
    ],
    client_output_allowed: operationalGate && finalAudit.final_client_irs_output_allowed
  };
}

async function create9465OperationalQaPacketPdfBuffer({ store, answers = {}, taxCase = {}, actor = {} } = {}) {
  const workflow = build9465TrueCoordinateQaWorkflow(store);
  const readiness = build9465FinalReleaseReadinessFromOperationalQa(store, taxCase, answers);
  const fillPlan = build9465FillPlan(answers, { caseId: taxCase.id || '' });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 44, info: { Title: 'IRS Form 9465 Operational QA Packet', Author: 'Justice Tax Solutions' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('Justice Tax Solutions — IRS Form 9465 Operational QA Packet');
    doc.moveDown(0.3).fontSize(9).fillColor('#8b1e1e').text('INTERNAL QA ONLY — NOT FINAL IRS OUTPUT');
    doc.fillColor('#111').fontSize(10).text(`Version: ${VERSION}`);
    doc.text(`Case: ${taxCase.id || 'ad hoc'}`);
    doc.text(`Operational QA status: ${workflow.status}`);
    doc.text(`Client output allowed: ${readiness.client_output_allowed ? 'yes' : 'no'}`);
    doc.moveDown().fontSize(12).text('Operational checks', { underline: true });
    workflow.checks.forEach((check) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).fillColor(check.ok ? '#0d5c38' : '#8b1e1e').text(`${check.ok ? '✓' : '□'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
    });
    doc.addPage().fillColor('#111').fontSize(12).text('Coordinate measurement plan', { underline: true });
    workflow.measurement_plan.slice(0, 80).forEach((field) => {
      if (doc.y > 720) doc.addPage();
      const c = field.candidate;
      doc.fontSize(7.5).text(`Page ${field.page} · ${field.official_line || ''} · ${field.input_key}: x ${c.x}, y ${c.y}, w ${c.width}, h ${c.height}; tolerance ±${field.tolerance_points} pt`);
    });
    doc.addPage().fontSize(12).text('Recent QA events', { underline: true });
    workflow.recent_events.slice(0, 40).forEach((event) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).text(`${event.created_at || ''} · ${event.status || ''} · page ${event.page || ''} · ${event.zone_key || ''} · ${event.notes || ''}`);
    });
    doc.addPage().fontSize(12).text('Fill-plan preview and remaining blockers', { underline: true });
    doc.fontSize(9).text(`Fillable sample values: ${fillPlan.output_counts.fillable_in_sample}`);
    doc.text(`Blocked fields: ${fillPlan.output_counts.blocked}`);
    doc.moveDown(0.5).fontSize(10).text('Release blockers');
    readiness.blockers.slice(0, 80).forEach((item) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).text(`• ${item}`);
    });
    doc.addPage().fontSize(12).text('Required warning', { underline: true });
    [
      FORM_9465_OPERATIONAL_QA_POLICY.no_false_claims,
      'Signature/date fields must remain blank for the taxpayer and spouse to sign after review.',
      'Direct-debit routing/account fields must be explicitly client-confirmed or left blank.',
      'This packet is not an official IRS filing copy and must not be sent to the IRS.',
      'Only a fully gated final output can be released to a client.'
    ].forEach((line) => doc.fontSize(9).text(`• ${line}`));
    if (actor && actor.email) doc.moveDown().fontSize(8).text(`Generated by: ${actor.email}`);
    doc.end();
  });
}

module.exports = {
  FORM_9465_OPERATIONAL_QA_POLICY,
  TRUE_COORDINATE_QA_STATUS_VALUES,
  build9465OperationalCaptureTest,
  build9465TrueCoordinateQaWorkflow,
  record9465TrueCoordinateQaStatus,
  build9465OperationalQaBoard,
  build9465FinalReleaseReadinessFromOperationalQa,
  create9465OperationalQaPacketPdfBuffer,
  create9465SampleFilledOverlayPdfBuffer
};
