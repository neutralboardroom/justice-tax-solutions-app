const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { IRS_9465_CAPTURE_PROFILE, inspectCaptured9465Pdf, build9465PdfCaptureReadiness } = require('./form9465VisualQa');
const { build9465OverlayTemplate } = require('./form9465FillEngine');
const { build9465CaptureUploadFallbackPlan, build9465CoordinateLockChecklist, build9465CoordinateLockBoard } = require('./form9465CoordinateLock');
const { build9465OperationalCaptureTest, build9465TrueCoordinateQaWorkflow, build9465FinalReleaseReadinessFromOperationalQa } = require('./form9465OperationalQa');
const { build9465FinalOutputGateAudit } = require('./form9465FinalRelease');

const VERSION = '0.1.38';

const FORM_9465_CAPTURE_COMPLETION_POLICY = {
  version: VERSION,
  goal: 'Make the IRS Form 9465 official PDF capture/upload workflow operationally complete enough for staff rehearsal, coordinate-lock simulation, and approval-gate testing without accidentally enabling final client IRS output.',
  principle: 'Simulation and staff rehearsal are not substitutes for actual official PDF capture/upload, checksum, visual coordinate lock against the real PDF, sample-fill QA, client verification, professional release, and production-security approval.',
  client_output_rule: 'Final client-facing IRS Form 9465 output must remain blocked unless every actual release gate passes. Simulation approvals may prepare staff, but they may not authorize client output.',
  supported_paths: [
    'official IRS URL capture when outbound HTTPS is available',
    'staff/admin official PDF upload fallback with attestations when URL capture fails',
    'coordinate-lock simulation for staff training and workflow rehearsal',
    'staff approval-gate board that separates simulation approval from actual release approval'
  ]
};

const CAPTURE_COMPLETION_STATUS_VALUES = [
  'official_pdf_capture_completed',
  'official_pdf_upload_completed',
  'source_checksum_reviewed',
  'simulation_started',
  'simulated_page_1_coordinates_locked',
  'simulated_page_2_coordinates_locked',
  'simulated_sample_overlay_reviewed',
  'simulation_staff_approved',
  'simulation_rejected',
  'actual_coordinate_lock_ready_for_review',
  'actual_coordinate_lock_staff_approved',
  'release_gate_rehearsal_completed',
  'blocked_needs_official_pdf',
  'blocked_needs_coordinate_rework'
];

function text(value = '', max = 800) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function bool(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1 || value === '1';
}

function hashPayload(value = {}) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex').slice(0, 32);
}

function latestCaptureCompletionEvents(store) {
  if (!store || !store.list) return [];
  return store.list('form_9465_capture_completion_events', (e) => !e.deleted_at).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function latestStatus(store, statuses = []) {
  const wanted = new Set(statuses);
  return latestCaptureCompletionEvents(store).find((e) => wanted.has(e.status)) || null;
}

function findOfficial9465PdfRecord(store) {
  if (!store || !store.find) return null;
  return store.find('official_forms', (f) => {
    const num = String(f.form_number || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    return !f.deleted_at && f.agency === 'IRS' && num === '9465' && (f.sha256 || f.storage_path || f.capture_method);
  }) || null;
}

function safePublicOfficialRecord(record) {
  if (!record) return null;
  const copy = { ...record };
  if (copy.storage_path) copy.storage_path = '[redacted]';
  if (copy.local_path) copy.local_path = '[redacted]';
  return copy;
}

function coordinateLockActualSummary(store) {
  const checklist = build9465CoordinateLockChecklist(store);
  return checklist.summary || { page_1_locked: false, page_2_locked: false, all_pages_locked: false, latest_status: 'not_started' };
}

function simulationSummary(store) {
  const events = latestCaptureCompletionEvents(store);
  const page1 = events.find((e) => e.status === 'simulated_page_1_coordinates_locked');
  const page2 = events.find((e) => e.status === 'simulated_page_2_coordinates_locked');
  const sample = events.find((e) => e.status === 'simulated_sample_overlay_reviewed');
  const approved = events.find((e) => e.status === 'simulation_staff_approved');
  const rejected = events.find((e) => e.status === 'simulation_rejected');
  return {
    total_events: events.length,
    simulation_started: Boolean(events.find((e) => e.status === 'simulation_started')),
    page_1_simulated_locked: Boolean(page1),
    page_2_simulated_locked: Boolean(page2),
    sample_overlay_simulated_reviewed: Boolean(sample),
    staff_simulation_approved: Boolean(approved && !rejected),
    rejected: Boolean(rejected),
    latest_status: events[0] ? events[0].status : 'not_started',
    latest_event: events[0] || null,
    warning: 'Simulation records are training/approval-drill records only. They do not authorize actual client IRS output.'
  };
}

function build9465CaptureCompletionReadiness(store) {
  const readiness = build9465PdfCaptureReadiness(store);
  const inspection = inspectCaptured9465Pdf(store);
  const fallback = build9465CaptureUploadFallbackPlan(store);
  const operational = build9465OperationalCaptureTest(store);
  const trueCoordinate = build9465TrueCoordinateQaWorkflow(store);
  const officialRecord = findOfficial9465PdfRecord(store);
  const actualLock = coordinateLockActualSummary(store);
  const simulation = simulationSummary(store);
  const checks = [
    { key: 'official_source_seeded', label: 'Official IRS 9465 source record exists', ok: Boolean(readiness.summary && readiness.summary.source_seeded), detail: readiness.source ? readiness.source.id : '' },
    { key: 'official_pdf_record_exists', label: 'Official IRS 9465 PDF capture/upload record exists', ok: Boolean(officialRecord), detail: officialRecord ? officialRecord.id : '' },
    { key: 'checksum_recorded', label: 'SHA-256 checksum recorded for official PDF', ok: Boolean(officialRecord && officialRecord.sha256), detail: officialRecord ? officialRecord.sha256 : '' },
    { key: 'pdf_inspection_passed', label: 'Captured/uploaded PDF passed basic PDF inspection', ok: Boolean(inspection && inspection.ok), detail: inspection && inspection.status ? inspection.status : 'not inspected or missing' },
    { key: 'capture_completion_recorded', label: 'Staff recorded capture/upload completion review', ok: Boolean(latestStatus(store, ['official_pdf_capture_completed', 'official_pdf_upload_completed', 'source_checksum_reviewed'])), detail: latestStatus(store, ['official_pdf_capture_completed', 'official_pdf_upload_completed', 'source_checksum_reviewed'])?.status || '' },
    { key: 'actual_page_1_coordinates_locked', label: 'Actual page 1 coordinates locked against real official PDF', ok: Boolean(actualLock.page_1_locked), detail: actualLock.latest_status || '' },
    { key: 'actual_page_2_coordinates_locked', label: 'Actual page 2 coordinates locked against real official PDF', ok: Boolean(actualLock.page_2_locked), detail: actualLock.latest_status || '' },
    { key: 'true_coordinate_qa_ready', label: 'True-coordinate QA workflow recorded as ready for final-release audit', ok: trueCoordinate.status === 'true_coordinate_qa_ready_for_final_release_audit', detail: trueCoordinate.status },
    { key: 'simulation_drill_available', label: 'Coordinate-lock simulation drill is available for staff approval training', ok: true, detail: simulation.staff_simulation_approved ? 'simulation approved' : simulation.latest_status },
    { key: 'simulation_not_substitute_for_actual', label: 'Simulation approval does not bypass actual PDF/coordinate gates', ok: true, detail: 'always enforced' },
    { key: 'client_output_still_blocked_until_all_actual_gates_pass', label: 'Client IRS output remains blocked until all actual release gates pass', ok: true, detail: 'enforced by final output gate audit' }
  ];
  const actualChecks = checks.filter((c) => !['simulation_drill_available', 'simulation_not_substitute_for_actual', 'client_output_still_blocked_until_all_actual_gates_pass'].includes(c.key));
  const actualReady = actualChecks.every((c) => c.ok);
  return {
    version: VERSION,
    policy: FORM_9465_CAPTURE_COMPLETION_POLICY,
    status: actualReady ? 'actual_capture_upload_and_coordinate_lock_ready_for_release_audit' : 'capture_upload_or_coordinate_lock_incomplete',
    checks,
    passed: checks.filter((c) => c.ok).length,
    required_checks: checks.length,
    actual_gate_passed: actualReady,
    client_final_output_allowed: false,
    official_pdf_record: safePublicOfficialRecord(officialRecord),
    pdf_capture_readiness_summary: readiness.summary || {},
    inspection: inspection || {},
    fallback_status: fallback.status,
    operational_capture_status: operational.status,
    true_coordinate_status: trueCoordinate.status,
    actual_coordinate_lock_summary: actualLock,
    simulation_summary: simulation,
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label)
  };
}

function build9465CoordinateLockSimulationPlan(store) {
  const overlay = build9465OverlayTemplate();
  const actualChecklist = build9465CoordinateLockChecklist(store);
  const fields = (overlay.fields || []).filter((f) => f.overlay_coordinate).map((f) => ({
    field_key: f.key,
    input_key: f.input_key,
    official_line: f.official_line,
    label: f.official_label,
    page: f.overlay_coordinate.page,
    candidate_coordinate: {
      x: f.overlay_coordinate.x,
      y: f.overlay_coordinate.y,
      width: f.overlay_coordinate.width,
      height: f.overlay_coordinate.height
    },
    simulation_instruction: 'Use the sample overlay packet for rehearsal only. Do not lock actual production coordinates until the official IRS PDF is captured/uploaded and visually compared.'
  }));
  return {
    version: VERSION,
    policy: FORM_9465_CAPTURE_COMPLETION_POLICY,
    status: simulationSummary(store).staff_simulation_approved ? 'simulation_staff_approved_not_client_output_ready' : 'simulation_available_not_approved',
    simulation_summary: simulationSummary(store),
    actual_coordinate_lock_summary: actualChecklist.summary || {},
    approval_gates: [
      { key: 'simulation_started', owner: 'staff', status_to_record: 'simulation_started', client_output_effect: 'none' },
      { key: 'page_1_simulation_lock', owner: 'QA reviewer', status_to_record: 'simulated_page_1_coordinates_locked', client_output_effect: 'none' },
      { key: 'page_2_simulation_lock', owner: 'QA reviewer', status_to_record: 'simulated_page_2_coordinates_locked', client_output_effect: 'none' },
      { key: 'sample_overlay_review', owner: 'QA reviewer', status_to_record: 'simulated_sample_overlay_reviewed', client_output_effect: 'none' },
      { key: 'staff_simulation_approval', owner: 'staff manager', status_to_record: 'simulation_staff_approved', client_output_effect: 'none — actual release gates still required' }
    ],
    fields_to_rehearse: fields,
    rehearsal_status_values: CAPTURE_COMPLETION_STATUS_VALUES.filter((s) => s.startsWith('simulated') || s === 'simulation_started' || s === 'simulation_staff_approved' || s === 'simulation_rejected'),
    final_warning: 'Use simulation to train staff and confirm workflow screens. It cannot authorize actual IRS Form 9465 output for a client.'
  };
}

function record9465CaptureCompletionStatus(store, body = {}, actor = {}) {
  const status = CAPTURE_COMPLETION_STATUS_VALUES.includes(String(body.status || '')) ? String(body.status) : 'blocked_needs_official_pdf';
  const simulationOnly = status.startsWith('simulated') || status === 'simulation_started' || status === 'simulation_staff_approved' || status === 'simulation_rejected' || bool(body.simulation_only);
  const record = store.insert('form_9465_capture_completion_events', {
    event_type: 'capture_completion_status_recorded',
    status,
    simulation_only: simulationOnly,
    official_form_id: text(body.official_form_id || '', 160),
    source_id: text(body.source_id || '', 160),
    page: Number(body.page || 0) || null,
    zone_key: text(body.zone_key || '', 120),
    field_keys: Array.isArray(body.field_keys) ? body.field_keys.map((x) => text(x, 120)).filter(Boolean).slice(0, 100) : [],
    checksum_reviewed: bool(body.checksum_reviewed),
    visual_packet_id: text(body.visual_packet_id || '', 160),
    reviewer_role: text(body.reviewer_role || actor.role || 'staff', 120),
    actor_id: actor.id || 'staff',
    notes: text(body.notes || '', 1200),
    approval_hash: hashPayload({ status, simulationOnly, page: body.page || '', field_keys: body.field_keys || [], notes: body.notes || '', actor_id: actor.id || 'staff' }),
    client_output_allowed: false,
    final_output_warning: simulationOnly
      ? 'Simulation approval does not authorize final client IRS output.'
      : 'Actual capture/coordinate approval is one gate only. Final client output remains blocked until all release gates pass.'
  });
  return record;
}

function build9465StaffApprovalGateReport(store, taxCase = {}, answers = {}) {
  const capture = build9465CaptureCompletionReadiness(store);
  const simulation = simulationSummary(store);
  const finalAudit = build9465FinalOutputGateAudit(store, taxCase || {}, answers || {});
  const actualLock = coordinateLockActualSummary(store);
  const approvalChecks = [
    { key: 'source_capture_approved', label: 'Staff approved official source/capture or upload completion', ok: Boolean(latestStatus(store, ['official_pdf_capture_completed', 'official_pdf_upload_completed', 'source_checksum_reviewed'])), simulation_substitute_allowed: false },
    { key: 'actual_coordinates_locked', label: 'Actual coordinates locked against official PDF', ok: Boolean(actualLock.all_pages_locked), simulation_substitute_allowed: false },
    { key: 'operational_qa_ready', label: 'Operational QA ready for final-release audit', ok: capture.true_coordinate_status === 'true_coordinate_qa_ready_for_final_release_audit', simulation_substitute_allowed: false },
    { key: 'simulation_drill_complete', label: 'Optional staff simulation drill complete', ok: Boolean(simulation.staff_simulation_approved), simulation_substitute_allowed: false, optional: true },
    { key: 'final_release_audit_passes', label: 'Final release audit passes all required gates', ok: Boolean(finalAudit.final_client_irs_output_allowed), simulation_substitute_allowed: false },
    { key: 'simulation_not_used_for_release', label: 'Release cannot rely on simulation-only approval', ok: true, simulation_substitute_allowed: false }
  ];
  return {
    version: VERSION,
    policy: 'Staff approval gates separate training/simulation approvals from real release approvals. Simulation can never authorize client IRS output.',
    case_id: taxCase && taxCase.id ? taxCase.id : '',
    approval_checks: approvalChecks,
    passed: approvalChecks.filter((c) => c.ok || c.optional).length,
    required_checks: approvalChecks.length,
    capture_completion_summary: {
      status: capture.status,
      actual_gate_passed: capture.actual_gate_passed,
      client_final_output_allowed: capture.client_final_output_allowed
    },
    final_audit_summary: {
      passed: finalAudit.passed,
      required_gates: finalAudit.required_gates,
      final_client_irs_output_allowed: finalAudit.final_client_irs_output_allowed,
      blockers: finalAudit.blockers || []
    },
    simulation_summary: simulation,
    staff_release_recommendation: finalAudit.final_client_irs_output_allowed
      ? 'All actual gates appear passed. Staff may proceed only if production policy and professional release remain current.'
      : 'Do not release final IRS Form 9465 output. Continue capture/upload, true coordinate QA, client verification, professional release, payment, and production-security gates.',
    client_output_allowed: false
  };
}

function build9465CaptureCompletionBoard(store) {
  return {
    version: VERSION,
    policy: FORM_9465_CAPTURE_COMPLETION_POLICY,
    readiness: build9465CaptureCompletionReadiness(store),
    simulation_plan: build9465CoordinateLockSimulationPlan(store),
    staff_approval_gate_report: build9465StaffApprovalGateReport(store, {}, {}),
    recent_events: latestCaptureCompletionEvents(store).slice(0, 100),
    coordinate_lock_board: build9465CoordinateLockBoard(store),
    final_warning: 'The board is for operational readiness. It must not be used to release final client IRS output until all actual gates pass.'
  };
}

function createLine(doc, label, value) {
  doc.font('Helvetica-Bold').text(label, { continued: true });
  doc.font('Helvetica').text(` ${value == null ? '' : value}`);
}

async function create9465CaptureCompletionPacketPdfBuffer({ store, taxCase = {}, answers = {}, actor = {} } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const readiness = build9465CaptureCompletionReadiness(store);
      const simulation = build9465CoordinateLockSimulationPlan(store);
      const gate = build9465StaffApprovalGateReport(store, taxCase, answers);
      const doc = new PDFDocument({ size: 'LETTER', margin: 54, info: { Title: 'Justice Tax Solutions IRS 9465 Capture Completion Packet' } });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.font('Helvetica-Bold').fontSize(17).text('Justice Tax Solutions — IRS Form 9465 Capture Completion + Coordinate Simulation Packet');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).text('Internal QA/staff approval rehearsal only. This packet is not a final IRS form, is not a filing copy, and does not authorize client output.');
      doc.moveDown();
      createLine(doc, 'Version:', VERSION);
      createLine(doc, 'Case:', taxCase && taxCase.id ? taxCase.id : 'ad hoc / no case');
      createLine(doc, 'Actor:', actor && (actor.email || actor.id) ? (actor.email || actor.id) : 'system');
      createLine(doc, 'Capture completion status:', readiness.status);
      createLine(doc, 'Simulation status:', simulation.status);
      createLine(doc, 'Staff release recommendation:', gate.staff_release_recommendation);
      doc.moveDown();
      doc.font('Helvetica-Bold').text('Capture/upload and coordinate readiness checks');
      doc.moveDown(0.25);
      (readiness.checks || []).forEach((check) => {
        doc.font('Helvetica').fontSize(9).text(`${check.ok ? '[PASS]' : '[BLOCKED]'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
      });
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(14).text('Simulation approval gates');
      doc.moveDown(0.5);
      (simulation.approval_gates || []).forEach((gateStep) => {
        doc.font('Helvetica').fontSize(10).text(`• ${gateStep.key} — owner: ${gateStep.owner}; record: ${gateStep.status_to_record}; client output: ${gateStep.client_output_effect}`);
      });
      doc.moveDown();
      doc.font('Helvetica-Bold').text('Staff approval gate report');
      doc.moveDown(0.25);
      (gate.approval_checks || []).forEach((check) => {
        doc.font('Helvetica').fontSize(9).text(`${check.ok ? '[PASS]' : check.optional ? '[OPTIONAL]' : '[BLOCKED]'} ${check.label}`);
      });
      doc.moveDown();
      doc.font('Helvetica-Bold').text('Final warning');
      doc.font('Helvetica').text('Final client-facing IRS Form 9465 output remains blocked until the official PDF is captured/uploaded, checksummed, visually coordinate-locked against the real IRS PDF, sample-tested, client-verified, professionally released, payment-cleared, and production-security approved.');
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  FORM_9465_CAPTURE_COMPLETION_POLICY,
  CAPTURE_COMPLETION_STATUS_VALUES,
  build9465CaptureCompletionReadiness,
  build9465CoordinateLockSimulationPlan,
  record9465CaptureCompletionStatus,
  build9465StaffApprovalGateReport,
  build9465CaptureCompletionBoard,
  create9465CaptureCompletionPacketPdfBuffer
};
