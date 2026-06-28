const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { IRS_9465_CAPTURE_PROFILE, ensure9465OfficialSource, inspectCaptured9465Pdf, build9465PdfCaptureReadiness, build9465VisualFieldQaPlan, IRS_9465_OVERLAY_COORDINATE_DRAFT } = require('./form9465VisualQa');
const { build9465OverlayTemplate, build9465FillEngineReadiness } = require('./form9465FillEngine');

const VERSION = '0.1.34';

const FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY = {
  version: VERSION,
  goal: 'Make IRS Form 9465 official PDF capture practical even when server-side URL capture is blocked by DNS, firewall, government site behavior, or deployment policy. Staff can use official URL capture first, then upload the exact official IRS PDF as a fallback, checksum it, inspect it, and move into coordinate-lock review without allowing client final output.',
  preferred_order: [
    'Seed the official IRS Form 9465 source record from irs.gov.',
    'Try official URL capture in a deployment environment with outbound HTTPS enabled.',
    'If URL capture fails or is disabled, upload the exact IRS PDF downloaded from the official source page.',
    'Record source URL, source page, revision date, checksum, byte size, capture/upload method, and staff identity.',
    'Run lightweight PDF inspection and visual QA packet generation.',
    'Lock overlay coordinates page by page only after visual review against the captured official PDF.',
    'Keep final client output blocked until all release gates pass.'
  ],
  allowed_upload_fallback: true,
  allowed_source_domains: ['irs.gov', 'www.irs.gov'],
  required_upload_attestations: [
    'I downloaded this PDF from the official IRS Form 9465 page or official IRS PDF URL.',
    'I did not edit the PDF before upload.',
    'I understand the uploaded PDF is for mapping/QA only until verified and released.',
    'I recorded the source URL and revision/edition information where available.'
  ],
  client_output_rule: 'Uploaded or captured official PDFs remain mapping/QA assets only. They do not become final client output until checksum, field/coordinate lock, sample-fill QA, overflow/signature/direct-debit checks, client verification, and professional release are complete.'
};

const COORDINATE_LOCK_STATUS_VALUES = [
  'candidate_reviewed',
  'needs_adjustment',
  'locked_page_1',
  'locked_page_2',
  'locked_all_pages',
  'rejected'
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeBool(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1 || value === '1';
}

function safeText(value = '', max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function validate9465OfficialPdfUpload(file = {}, body = {}) {
  const buffer = file.buffer;
  const errors = [];
  const warnings = [];
  if (!buffer || !Buffer.isBuffer(buffer)) errors.push('No PDF file buffer was provided.');
  const header = buffer && Buffer.isBuffer(buffer) ? buffer.subarray(0, 5).toString('utf8') : '';
  if (header !== '%PDF-') errors.push('Uploaded file does not start with a PDF header.');
  const name = String(file.originalname || '').toLowerCase();
  if (name && !name.endsWith('.pdf')) warnings.push('Filename does not end with .pdf; content header is the primary check.');
  const sourceUrl = safeText(body.source_url || body.pdf_url || IRS_9465_CAPTURE_PROFILE.pdf_url, 500);
  if (!/https:\/\/([^/]+\.)?irs\.gov\//i.test(sourceUrl)) errors.push('Source URL must be an official irs.gov URL for Form 9465 upload fallback.');
  const attestations = {
    official_source_attested: normalizeBool(body.official_source_attested),
    unmodified_pdf_attested: normalizeBool(body.unmodified_pdf_attested),
    mapping_only_attested: normalizeBool(body.mapping_only_attested)
  };
  for (const [key, value] of Object.entries(attestations)) {
    if (!value) errors.push(`Missing required attestation: ${key}`);
  }
  if (buffer && buffer.length > Number(process.env.OFFICIAL_FORM_UPLOAD_MAX_BYTES || 20 * 1024 * 1024)) errors.push('Uploaded PDF exceeds configured official-form upload size limit.');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    header,
    size_bytes: buffer && buffer.length ? buffer.length : 0,
    sha256: buffer && Buffer.isBuffer(buffer) ? sha256(buffer) : '',
    source_url: sourceUrl,
    attestations
  };
}

function upload9465OfficialPdfFallback(store, file = {}, body = {}, actor = {}, captureOfficialPdfBuffer) {
  const validation = validate9465OfficialPdfUpload(file, body);
  if (!validation.ok) {
    return { ok: false, status: 'upload_fallback_blocked_validation', validation, policy: FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY };
  }
  const seeded = ensure9465OfficialSource(store, actor || {});
  const source = seeded.source;
  const captured = captureOfficialPdfBuffer(store, {
    ...source,
    pdf_url: validation.source_url || source.pdf_url,
    source_page_url: safeText(body.source_page_url || source.source_page_url || IRS_9465_CAPTURE_PROFILE.source_page_url, 500),
    revision_date: safeText(body.revision_date || source.revision_date || IRS_9465_CAPTURE_PROFILE.revision, 120)
  }, file.buffer, {
    contentType: file.mimetype || 'application/pdf',
    fileName: file.originalname || 'f9465.pdf'
  });
  const officialFormId = captured.official_form && captured.official_form.id;
  if (officialFormId) {
    store.update('official_forms', officialFormId, {
      capture_method: 'staff_official_pdf_upload_fallback',
      upload_fallback_attested: true,
      upload_fallback_source_url: validation.source_url,
      revision_date: safeText(body.revision_date || IRS_9465_CAPTURE_PROFILE.revision, 120),
      coordinate_lock_status: 'not_locked',
      field_strategy_status: 'pending_coordinate_lock',
      can_drive_client_output: false,
      release_status: 'not_usable_for_client_output_until_coordinate_locked_sample_tested_client_verified_and_professionally_released'
    });
  }
  store.insert('form_9465_coordinate_lock_events', {
    event_type: 'official_pdf_upload_fallback_recorded',
    official_form_id: officialFormId || '',
    official_form_source_id: source.id,
    sha256: validation.sha256,
    size_bytes: validation.size_bytes,
    source_url: validation.source_url,
    actor_id: actor.id || 'admin-token',
    client_output_allowed: false,
    note: 'Official IRS 9465 PDF uploaded as fallback after/alongside URL capture. Mapping/QA only; final client output remains blocked.'
  });
  return {
    ok: true,
    status: 'official_pdf_upload_fallback_captured_checksum_recorded',
    validation,
    source: captured.source,
    official_form: captured.official_form,
    mapping_draft: captured.mapping_draft,
    readiness: build9465PdfCaptureReadiness(store),
    policy: FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY
  };
}

function latestCoordinateLocks(store) {
  return store.list('form_9465_coordinate_lock_events', (e) => !e.deleted_at).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function coordinateLockSummary(store) {
  const events = latestCoordinateLocks(store);
  const lockedAll = events.find((e) => e.status === 'locked_all_pages');
  const page1 = events.find((e) => e.status === 'locked_page_1' || e.status === 'locked_all_pages');
  const page2 = events.find((e) => e.status === 'locked_page_2' || e.status === 'locked_all_pages');
  const rejected = events.find((e) => e.status === 'rejected');
  return {
    total_lock_events: events.length,
    page_1_locked: Boolean(page1),
    page_2_locked: Boolean(page2),
    all_pages_locked: Boolean(lockedAll || (page1 && page2 && !rejected)),
    latest_status: events[0] ? events[0].status || events[0].event_type : 'not_started',
    latest_event: events[0] || null
  };
}

function build9465CaptureUploadFallbackPlan(store) {
  const readiness = build9465PdfCaptureReadiness(store);
  const inspection = inspectCaptured9465Pdf(store);
  const overlay = build9465OverlayTemplate();
  const lockSummary = coordinateLockSummary(store);
  const checks = [
    { key: 'official_source_seeded', label: 'Official IRS Form 9465 source seeded', ok: Boolean(readiness.summary && readiness.summary.source_seeded) || readiness.checks.some((c) => c.key === 'official_source_seeded' && c.ok) },
    { key: 'capture_or_upload_path_available', label: 'URL capture and upload fallback paths are available', ok: true },
    { key: 'captured_or_uploaded_pdf', label: 'Official PDF captured or uploaded', ok: Boolean(inspection.ok) },
    { key: 'checksum_recorded', label: 'Checksum recorded on official form record', ok: readiness.checks.some((c) => c.key === 'captured_pdf_checksum' && c.ok) },
    { key: 'overlay_template_ready', label: 'Overlay candidate template exists', ok: overlay.overlay_candidate_count > 0 },
    { key: 'page_1_coordinate_locked', label: 'Page 1 coordinates locked after visual review', ok: lockSummary.page_1_locked },
    { key: 'page_2_coordinate_locked', label: 'Page 2 coordinates locked after visual review', ok: lockSummary.page_2_locked },
    { key: 'all_coordinates_locked', label: 'All pages/coordinates locked', ok: lockSummary.all_pages_locked }
  ];
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY,
    readiness,
    inspection,
    overlay_summary: {
      field_count: overlay.field_count,
      overlay_candidate_count: overlay.overlay_candidate_count,
      unmapped_count: overlay.unmapped_count
    },
    coordinate_lock_summary: lockSummary,
    checks,
    passed: checks.filter((c) => c.ok).length,
    required_checks: checks.length,
    status: checks.every((c) => c.ok) ? 'captured_or_uploaded_and_coordinate_locked_for_next_sample_output_review' : 'not_ready_coordinate_lock_needed',
    client_final_output_allowed: false,
    next_best_actions: [
      'Seed the official 9465 source if not already seeded.',
      'Attempt official URL capture where outbound HTTPS works.',
      'If URL capture fails, upload the exact official f9465.pdf with required attestations.',
      'Generate visual QA packet and compare sample output to captured official pages.',
      'Record page-level coordinate locks only after visual review.',
      'Keep final client output blocked until sample output, overflow, signature, direct debit, client verification, and professional release gates pass.'
    ]
  };
}

function build9465CoordinateLockChecklist(store) {
  const visualPlan = build9465VisualFieldQaPlan();
  const overlay = build9465OverlayTemplate();
  const plan = build9465CaptureUploadFallbackPlan(store);
  return {
    version: VERSION,
    policy: 'Coordinates may only be locked after reviewing the captured/uploaded official IRS PDF and sample overlay output. Locks are audit records; they do not by themselves authorize final client output.',
    summary: plan.coordinate_lock_summary,
    preconditions: plan.checks,
    visual_zones: visualPlan.zones || [],
    overlay_fields_needing_lock: overlay.fields.filter((f) => f.overlay_coordinate).map((f) => ({ key: f.key, input_key: f.input_key, line: f.official_line, page: f.overlay_coordinate.page, status: f.overlay_coordinate.status })),
    lock_status_values: COORDINATE_LOCK_STATUS_VALUES,
    final_output_allowed: false
  };
}

function record9465CoordinateLockStatus(store, body = {}, actor = {}) {
  const status = COORDINATE_LOCK_STATUS_VALUES.includes(String(body.status || '')) ? String(body.status) : 'candidate_reviewed';
  const fields = Array.isArray(body.field_keys) ? body.field_keys.map((x) => safeText(x, 120)).filter(Boolean).slice(0, 100) : [];
  const record = store.insert('form_9465_coordinate_lock_events', {
    event_type: 'coordinate_lock_status_recorded',
    status,
    page: Number(body.page || 0) || null,
    zone_key: safeText(body.zone_key || '', 120),
    field_keys: fields,
    visual_sample_id: safeText(body.visual_sample_id || '', 160),
    reviewer_role: safeText(body.reviewer_role || (actor.role || 'staff'), 120),
    actor_id: actor.id || 'staff',
    notes: safeText(body.notes || '', 1200),
    client_output_allowed: false,
    final_output_warning: 'Coordinate lock is one QA gate only. Final client output remains blocked until all Form 9465 release gates pass.'
  });
  return record;
}

function build9465CoordinateLockBoard(store) {
  const events = latestCoordinateLocks(store).slice(0, 100);
  return {
    version: VERSION,
    summary: coordinateLockSummary(store),
    upload_fallback_plan: build9465CaptureUploadFallbackPlan(store),
    checklist: build9465CoordinateLockChecklist(store),
    recent_events: events,
    staff_actions: [
      'Seed official IRS source.',
      'Capture from official IRS URL or upload official PDF fallback with attestations.',
      'Inspect captured/uploaded PDF and checksum.',
      'Generate sample overlay QA packet.',
      'Compare field placement and lock page coordinates only when visually acceptable.',
      'Reject or mark needs adjustment when placement/overflow/signature/direct-debit concerns appear.'
    ]
  };
}

function build9465FinalOutputGateReport(store) {
  const fallback = build9465CaptureUploadFallbackPlan(store);
  const fillReadiness = build9465FillEngineReadiness(store);
  const lockSummary = coordinateLockSummary(store);
  const gates = [
    { key: 'official_pdf_available', label: 'Official IRS PDF captured or uploaded and inspectable', ok: Boolean(fallback.inspection && fallback.inspection.ok) },
    { key: 'checksum_recorded', label: 'Captured/uploaded official PDF checksum recorded', ok: fallback.checks.some((c) => c.key === 'checksum_recorded' && c.ok) },
    { key: 'coordinates_locked', label: 'All page coordinates locked', ok: lockSummary.all_pages_locked },
    { key: 'fill_engine_gates_tracking', label: 'Fill engine release gates are tracked', ok: Boolean(fillReadiness && fillReadiness.gates) },
    { key: 'client_values_verified', label: 'Client values verified', ok: false },
    { key: 'professional_release_signoff', label: 'Required professional release signoff recorded', ok: false },
    { key: 'production_security_allows_release', label: 'Production security/payment/release gates allow output', ok: false }
  ];
  return {
    version: VERSION,
    status: 'final_client_output_blocked',
    gates,
    passed: gates.filter((g) => g.ok).length,
    required_gates: gates.length,
    client_final_output_allowed: false,
    reason: 'v0.1.33 adds upload fallback and coordinate lock workflow. Final Form 9465 output still requires verified sample official PDF output, client verification, professional release, and production gates.'
  };
}

async function create9465CoordinateLockPacketPdfBuffer(store) {
  const board = build9465CoordinateLockBoard(store);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('Justice Tax Solutions — IRS Form 9465 Coordinate Lock Packet');
    doc.moveDown(0.5).fontSize(10).text('Internal QA only. Not an official IRS output and not client-ready.');
    doc.moveDown().fontSize(12).text(`Version: ${VERSION}`);
    doc.text(`Status: ${board.summary.latest_status}`);
    doc.text(`Page 1 locked: ${board.summary.page_1_locked ? 'yes' : 'no'}`);
    doc.text(`Page 2 locked: ${board.summary.page_2_locked ? 'yes' : 'no'}`);
    doc.text(`All pages locked: ${board.summary.all_pages_locked ? 'yes' : 'no'}`);
    doc.moveDown().fontSize(13).text('Preconditions');
    for (const check of board.upload_fallback_plan.checks) doc.fontSize(9).text(`${check.ok ? '✓' : '□'} ${check.label}`);
    doc.addPage().fontSize(13).text('Overlay fields needing lock');
    for (const field of board.checklist.overlay_fields_needing_lock.slice(0, 50)) doc.fontSize(8).text(`Page ${field.page} · ${field.line || ''} · ${field.input_key || field.key} · ${field.status}`);
    doc.addPage().fontSize(13).text('Recent coordinate events');
    for (const event of board.recent_events.slice(0, 30)) doc.fontSize(8).text(`${event.created_at || ''} · ${event.status || event.event_type} · page ${event.page || ''} · ${event.zone_key || ''} · ${event.notes || ''}`);
    doc.end();
  });
}

module.exports = {
  FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY,
  COORDINATE_LOCK_STATUS_VALUES,
  validate9465OfficialPdfUpload,
  upload9465OfficialPdfFallback,
  build9465CaptureUploadFallbackPlan,
  build9465CoordinateLockChecklist,
  record9465CoordinateLockStatus,
  build9465CoordinateLockBoard,
  build9465FinalOutputGateReport,
  create9465CoordinateLockPacketPdfBuffer
};
