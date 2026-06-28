const PDFDocument = require('pdfkit');
const { IRS_9465_CAPTURE_PROFILE, inspectCaptured9465Pdf, build9465PdfCaptureReadiness, build9465VisualFieldQaPlan } = require('./form9465VisualQa');
const { build9465FillPlan, build9465OverlayTemplate } = require('./form9465FillEngine');
const { build9465FinalOutputGateReport } = require('./form9465CoordinateLock');

const VERSION = '0.1.34';

const FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY = {
  version: VERSION,
  goal: 'Move IRS Form 9465 from internal overlay planning toward a controlled official-sample-output workflow: compare sample output values against the official two-page IRS layout, record visual pass/fail results, and keep final client output blocked until source, checksum, coordinates, overflow, signatures, client verification, professional release, and production gates pass.',
  current_scope: 'Internal QA sample output and visual overlay comparison workflow only. This does not create a final client filing copy.',
  output_modes: [
    'preview_json: field-by-field values, coordinates, and blockers for staff review',
    'comparison_packet_pdf: internal visual comparison packet showing page zones, sample values, blocked values, and signoff checklist',
    'official_pdf_output_future: fill or overlay the captured official IRS PDF after coordinates are locked and a PDF manipulation engine/provider is approved'
  ],
  final_client_output_rule: 'Never release a client-facing Form 9465 until the official PDF is captured/uploaded, checksum recorded, visual coordinates locked, sample official output reviewed, signature/date fields blank, direct-debit values client-confirmed or blank, client values verified, professional release signoff recorded, and production security/payment gates allow release.'
};

const OFFICIAL_SAMPLE_STATUS_VALUES = [
  'not_started',
  'official_pdf_loaded',
  'comparison_packet_generated',
  'page_1_overlay_compared',
  'page_2_overlay_compared',
  'overflow_review_passed',
  'signature_blank_review_passed',
  'direct_debit_review_passed',
  'sample_output_passed',
  'blocked_needs_rework',
  'ready_for_release_review'
];

const VISUAL_COMPARISON_ZONES = [
  { page: 1, zone_key: 'header_and_tips', label: 'Header, IRS identifiers, tips', purpose: 'Verify sample output does not cover official header/tip text.' },
  { page: 1, zone_key: 'identity_address', label: 'Lines 1a-4 identity, address, phone', purpose: 'Verify taxpayer/spouse/address/phone fields fit within page 1 line boxes.' },
  { page: 1, zone_key: 'amounts_payment_lines', label: 'Lines 5-12 amounts and payment day', purpose: 'Verify money/date values align with the right-side entry boxes and do not overflow.' },
  { page: 1, zone_key: 'direct_debit_payroll', label: 'Lines 13-14 direct debit and payroll deduction', purpose: 'Verify bank fields remain blank unless explicitly client-confirmed; low-income/payroll boxes align.' },
  { page: 1, zone_key: 'signatures', label: 'Signature/date area', purpose: 'Verify signature/date fields stay blank for client signing.' },
  { page: 2, zone_key: 'part_ii_trigger_intro', label: 'Part II trigger notes', purpose: 'Verify Part II is only populated when trigger facts require it.' },
  { page: 2, zone_key: 'part_ii_household_income', label: 'Lines 15-22 household/income', purpose: 'Verify household and income values align with Part II fields and checkbox groups.' },
  { page: 2, zone_key: 'part_ii_expenses', label: 'Lines 23-27 vehicle/insurance/court/dependent care', purpose: 'Verify expense counts and dollar fields align and conditional blanks are preserved.' }
];

function safeText(value = '', max = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function latestEvents(store, qaType) {
  return store && store.list ? store.list('form_output_qa_events', (e) => !e.deleted_at && e.form_number === '9465' && e.qa_type === qaType).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))) : [];
}

function statusExists(store, qaType, statuses = []) {
  const wanted = new Set(statuses);
  return latestEvents(store, qaType).some((e) => wanted.has(e.status));
}

function officialPdfReady(store) {
  const inspection = inspectCaptured9465Pdf(store);
  return Boolean(inspection && inspection.ok);
}

function build9465VisualOverlayComparisonPlan(store) {
  const visualPlan = build9465VisualFieldQaPlan();
  const overlay = build9465OverlayTemplate();
  const fieldsByPage = { 1: [], 2: [] };
  for (const field of overlay.fields || []) {
    const page = field.overlay_coordinate && Number(field.overlay_coordinate.page);
    if (page === 1 || page === 2) fieldsByPage[page].push(field);
  }
  const zones = VISUAL_COMPARISON_ZONES.map((zone) => {
    const candidates = (fieldsByPage[zone.page] || []).filter((field) => {
      const section = String(field.section || '').toLowerCase();
      if (zone.zone_key === 'identity_address') return ['1a', '1b', '2', '3', '4'].some((line) => String(field.official_line || '').startsWith(line));
      if (zone.zone_key === 'amounts_payment_lines') return ['5', '6', '7', '8', '9', '10', '11', '12'].some((line) => String(field.official_line || '').startsWith(line));
      if (zone.zone_key === 'direct_debit_payroll') return ['13', '14'].some((line) => String(field.official_line || '').startsWith(line));
      if (zone.zone_key === 'signatures') return section.includes('signature') || String(field.value_type || '') === 'signature';
      if (zone.zone_key === 'part_ii_household_income') return ['15', '16', '17', '18', '19', '20', '21', '22'].some((line) => String(field.official_line || '').startsWith(line));
      if (zone.zone_key === 'part_ii_expenses') return ['23', '24', '25', '26', '27'].some((line) => String(field.official_line || '').startsWith(line));
      return false;
    });
    return {
      ...zone,
      field_count: candidates.length,
      candidate_fields: candidates.slice(0, 20).map((field) => ({
        key: field.key,
        input_key: field.input_key,
        line: field.official_line,
        label: field.official_label,
        strategy: field.fill_strategy,
        coordinate: field.overlay_coordinate,
        output_rule: field.output_rule
      })),
      review_steps: [
        'Open the official IRS Form 9465 PDF and the generated sample/comparison packet side by side.',
        'Confirm each populated value is in the intended official line/box and does not cover printed form text.',
        'Mark this zone passed only if alignment, overflow, checkbox state, and blank-required fields are acceptable.',
        'Mark needs rework if any value touches official text, misses a box, overflows, or violates signature/direct-debit rules.'
      ]
    };
  });
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY,
    official_pdf_inspection: inspectCaptured9465Pdf(store),
    visual_plan_summary: visualPlan.summary || {},
    overlay_summary: {
      field_count: overlay.field_count,
      overlay_candidate_count: overlay.overlay_candidate_count,
      unmapped_count: overlay.unmapped_count
    },
    page_size_points: { width: 612, height: 792, note: 'US Letter coordinate system used for overlay candidates; final coordinates must be visually locked against the captured official PDF.' },
    zones,
    final_client_output_allowed: false
  };
}

function build9465OfficialSampleOutputPreview(answers = {}, store) {
  const fillPlan = build9465FillPlan(answers, {});
  const comparison = build9465VisualOverlayComparisonPlan(store);
  const finalGate = build9465FinalOutputGateReport(store);
  const populatedFields = (fillPlan.field_outputs || []).filter((f) => f.output_value_preview && !f.blocked_reasons.length);
  const blockedFields = (fillPlan.field_outputs || []).filter((f) => f.blocked_reasons.length);
  const pagePopulated = { 1: 0, 2: 0, unmapped: 0 };
  for (const field of populatedFields) {
    const page = field.overlay_coordinate && Number(field.overlay_coordinate.page);
    if (page === 1 || page === 2) pagePopulated[page] += 1;
    else pagePopulated.unmapped += 1;
  }
  const blockers = Array.from(new Set([
    ...(fillPlan.output_gate ? fillPlan.output_gate.blockers || [] : []),
    ...(finalGate.gates || []).filter((g) => !g.ok).map((g) => g.key),
    'official_sample_visual_comparison_must_be_passed',
    'final_client_output_disabled_in_v0_1_34'
  ]));
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY,
    official_pdf_ready: officialPdfReady(store),
    fill_plan_ok: Boolean(fillPlan.completion_plan && fillPlan.completion_plan.ok),
    preview_status: 'internal_official_sample_preview_only_not_client_output',
    page_populated_counts: pagePopulated,
    output_counts: fillPlan.output_counts,
    populated_fields_preview: populatedFields.slice(0, 80).map((f) => ({ line: f.official_line, input_key: f.input_key, value: f.output_value_preview, coordinate: f.overlay_coordinate, strategy: f.fill_strategy })),
    blocked_fields: blockedFields.slice(0, 80).map((f) => ({ line: f.official_line, input_key: f.input_key, blocked_reasons: f.blocked_reasons, strategy: f.fill_strategy })),
    comparison_plan: comparison,
    final_gate: finalGate,
    output_gate: {
      internal_comparison_packet_allowed: Boolean(fillPlan.output_gate && fillPlan.output_gate.internal_sample_overlay_allowed),
      official_client_pdf_allowed: false,
      blockers
    }
  };
}

function build9465OfficialSampleOutputReadiness(store) {
  const capture = build9465PdfCaptureReadiness(store);
  const inspection = inspectCaptured9465Pdf(store);
  const finalGate = build9465FinalOutputGateReport(store);
  const comparisonEvents = latestEvents(store, 'official_sample_output');
  const checks = [
    { key: 'official_source_seeded', label: 'Official IRS Form 9465 source seeded', ok: Boolean(capture.summary && capture.summary.source_seeded) || (capture.checks || []).some((c) => c.key === 'official_source_seeded' && c.ok) },
    { key: 'official_pdf_available', label: 'Official IRS 9465 PDF captured or uploaded', ok: Boolean(inspection.ok) },
    { key: 'checksum_recorded', label: 'Official PDF checksum recorded', ok: (capture.checks || []).some((c) => c.key === 'captured_pdf_checksum' && c.ok) },
    { key: 'coordinate_lock_complete', label: 'Page 1 and Page 2 coordinates locked', ok: (finalGate.gates || []).some((g) => g.key === 'coordinates_locked' && g.ok) },
    { key: 'comparison_packet_generated', label: 'Official-sample visual comparison packet generated', ok: statusExists(store, 'official_sample_output', ['comparison_packet_generated', 'sample_output_passed', 'ready_for_release_review']) },
    { key: 'page_1_compared', label: 'Page 1 overlay visually compared', ok: statusExists(store, 'official_sample_output', ['page_1_overlay_compared', 'sample_output_passed', 'ready_for_release_review']) },
    { key: 'page_2_compared', label: 'Page 2 overlay visually compared', ok: statusExists(store, 'official_sample_output', ['page_2_overlay_compared', 'sample_output_passed', 'ready_for_release_review']) },
    { key: 'overflow_review_passed', label: 'Overflow / formatting review passed', ok: statusExists(store, 'official_sample_output', ['overflow_review_passed', 'sample_output_passed', 'ready_for_release_review']) },
    { key: 'signature_blank_review_passed', label: 'Signature and date fields verified blank', ok: statusExists(store, 'official_sample_output', ['signature_blank_review_passed', 'sample_output_passed', 'ready_for_release_review']) },
    { key: 'direct_debit_review_passed', label: 'Direct debit fields verified confirmed-or-blank', ok: statusExists(store, 'official_sample_output', ['direct_debit_review_passed', 'sample_output_passed', 'ready_for_release_review']) },
    { key: 'client_verification_ready', label: 'Client verification workflow ready', ok: (finalGate.gates || []).some((g) => g.key === 'client_values_verified' && g.ok) },
    { key: 'professional_release_ready', label: 'Professional release signoff ready', ok: (finalGate.gates || []).some((g) => g.key === 'professional_release_signoff' && g.ok) },
    { key: 'production_release_ready', label: 'Production security/payment gates allow output', ok: (finalGate.gates || []).some((g) => g.key === 'production_security_allows_release' && g.ok) }
  ];
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY,
    checks,
    passed: checks.filter((c) => c.ok).length,
    required_checks: checks.length,
    status: checks.every((c) => c.ok) ? 'ready_for_final_release_review' : 'not_ready_official_sample_comparison_or_release_gates_needed',
    official_pdf_inspection: inspection,
    comparison_event_count: comparisonEvents.length,
    latest_comparison_events: comparisonEvents.slice(0, 20),
    client_final_output_allowed: false,
    next_best_actions: [
      'Capture or upload the official IRS Form 9465 PDF if not already available.',
      'Generate the official-sample visual comparison packet with representative test answers.',
      'Compare the packet to the official IRS PDF page by page and record page/overflow/signature/direct-debit QA statuses.',
      'Do not enable final client PDF output until client verification, professional release, and production gates pass.'
    ]
  };
}

function record9465OfficialSampleQaStatus(store, payload = {}, staff = {}) {
  const allowed = new Set(OFFICIAL_SAMPLE_STATUS_VALUES);
  const status = allowed.has(String(payload.status || '')) ? String(payload.status) : 'not_started';
  const record = store.insert('form_output_qa_events', {
    form_number: '9465',
    agency: 'IRS',
    qa_type: 'official_sample_output',
    status,
    official_form_id: safeText(payload.official_form_id, 120),
    official_source_id: safeText(payload.official_source_id, 120),
    sample_case_key: safeText(payload.sample_case_key, 80),
    page: safeText(payload.page, 20),
    zone_key: safeText(payload.zone_key, 120),
    notes: safeText(payload.notes, 2000),
    staff_id: staff.id || 'staff',
    client_output_allowed: false,
    created_at: new Date().toISOString()
  });
  return record;
}

function build9465OfficialSampleQaBoard(store) {
  const events = latestEvents(store, 'official_sample_output');
  const byStatus = events.reduce((acc, e) => { acc[e.status || 'unknown'] = (acc[e.status || 'unknown'] || 0) + 1; return acc; }, {});
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY,
    summary: { events: events.length, by_status: byStatus, client_final_output_allowed: false },
    readiness: build9465OfficialSampleOutputReadiness(store),
    comparison_plan: build9465VisualOverlayComparisonPlan(store),
    board_columns: ['comparison_packet_generated', 'page_1_overlay_compared', 'page_2_overlay_compared', 'overflow_review_passed', 'signature_blank_review_passed', 'direct_debit_review_passed', 'sample_output_passed', 'ready_for_release_review', 'blocked_needs_rework'],
    latest_events: events.slice(0, 50),
    staff_actions: [
      'Generate a comparison packet using a representative sample case.',
      'Review page 1 and page 2 against the official IRS PDF.',
      'Record page comparison, overflow, signature blank, and direct-debit QA statuses.',
      'Keep output blocked if any field needs coordinate adjustment or professional/client verification is missing.'
    ]
  };
}

async function create9465OfficialSampleOutputPacketPdfBuffer({ answers = {}, store, sampleCaseKey = 'ad_hoc' } = {}) {
  const preview = build9465OfficialSampleOutputPreview(answers, store);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 42 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#111').text('Justice Tax Solutions — IRS Form 9465 Official Sample Output Comparison');
    doc.moveDown(0.4).fontSize(9).fillColor('#8b1e1e').text('INTERNAL QA ONLY — NOT A CLIENT FILING COPY — NOT FOR IRS SUBMISSION');
    doc.moveDown(0.4).fillColor('#111').fontSize(10).text(`Version: ${VERSION}`);
    doc.text(`Sample case: ${sampleCaseKey}`);
    doc.text(`Official PDF ready: ${preview.official_pdf_ready ? 'yes' : 'no'}`);
    doc.text(`Preview status: ${preview.preview_status}`);
    doc.moveDown(0.5).fontSize(12).text('Why this packet exists', { underline: true });
    doc.fontSize(9).text(FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY.goal, { width: 520 });
    doc.moveDown().fontSize(12).text('Readiness checks', { underline: true });
    for (const check of build9465OfficialSampleOutputReadiness(store).checks) {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).fillColor(check.ok ? '#0d5c38' : '#8b1e1e').text(`${check.ok ? '✓' : '□'} ${check.label}`);
    }

    const pages = [1, 2];
    for (const page of pages) {
      doc.addPage();
      doc.fillColor('#111').fontSize(14).text(`Page ${page} visual overlay comparison checklist`, { align: 'center' });
      doc.moveDown(0.3).fontSize(8).text('Use this page while viewing the captured/uploaded official IRS PDF. Confirm every sample value appears in the correct official box/line and does not cover printed form text. This packet is not an official IRS form output.');
      doc.moveDown(0.5);
      const pageFields = (preview.populated_fields_preview || []).filter((f) => f.coordinate && Number(f.coordinate.page) === page);
      const blockedPageFields = (preview.blocked_fields || []).filter((f) => !f.coordinate || Number((f.coordinate || {}).page || page) === page).slice(0, 30);
      doc.fontSize(11).text('Populated field candidates', { underline: true });
      if (!pageFields.length) doc.fontSize(8).text('No populated fields for this page in this sample, or no coordinates are available yet.');
      for (const field of pageFields.slice(0, 60)) {
        if (doc.y > 710) doc.addPage();
        const c = field.coordinate || {};
        doc.fontSize(7.2).fillColor('#111').text(`Line ${field.line || ''} · ${field.input_key || ''} · ${field.value || ''} · x:${c.x || ''} y:${c.y || ''} w:${c.width || ''} h:${c.height || ''}`);
      }
      doc.moveDown(0.4).fontSize(11).text('Blocked / intentionally blank / review fields', { underline: true });
      for (const field of blockedPageFields) {
        if (doc.y > 710) doc.addPage();
        doc.fontSize(7.2).fillColor('#8b1e1e').text(`Line ${field.line || ''} · ${field.input_key || ''}: ${(field.blocked_reasons || []).join(', ')}`);
      }
      doc.moveDown(0.4).fontSize(11).fillColor('#111').text('Reviewer signoff for this page', { underline: true });
      ['All values sit inside intended boxes/lines.', 'No value covers IRS printed text.', 'No overflow/truncation affects meaning.', 'Checkboxes align with intended choices.', 'Signature/date fields remain blank.', 'Direct-debit fields are confirmed or blank.'].forEach((item) => doc.fontSize(8).text(`□ ${item}`));
    }

    doc.addPage();
    doc.fillColor('#111').fontSize(14).text('Final output blockers and release rule', { align: 'center' });
    doc.moveDown(0.5).fontSize(10).text('Final client output allowed: NO');
    (preview.output_gate.blockers || []).slice(0, 80).forEach((b) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).fillColor('#8b1e1e').text(`• ${b}`);
    });
    doc.moveDown().fillColor('#111').fontSize(10).text(FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY.final_client_output_rule, { width: 520 });
    doc.end();
  });
}

module.exports = {
  FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY,
  OFFICIAL_SAMPLE_STATUS_VALUES,
  build9465VisualOverlayComparisonPlan,
  build9465OfficialSampleOutputPreview,
  build9465OfficialSampleOutputReadiness,
  record9465OfficialSampleQaStatus,
  build9465OfficialSampleQaBoard,
  create9465OfficialSampleOutputPacketPdfBuffer
};
