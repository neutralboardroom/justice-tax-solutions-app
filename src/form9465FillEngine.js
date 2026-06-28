const PDFDocument = require('pdfkit');
const { IRS_9465_FIELD_MAP, build9465CompletionPlan, build9465VerificationSheet } = require('./form9465Output');
const { IRS_9465_CAPTURE_PROFILE, IRS_9465_OVERLAY_COORDINATE_DRAFT, build9465PdfCaptureReadiness, build9465VisualSampleQa } = require('./form9465VisualQa');

const VERSION = '0.1.34';

const FORM_9465_FILL_ENGINE_POLICY = {
  version: VERSION,
  goal: 'Prepare the first real IRS Form 9465 fill/overlay engine path while keeping final client-facing official output blocked until the official PDF is captured, checksum recorded, exact field or overlay placement passes visual QA, the client verifies values, and required professional release is recorded.',
  first_version_scope: [
    'normalize Form 9465 interview answers into printable field values',
    'join calculated fields from the AI completion plan with overlay coordinate candidates',
    'prepare AcroForm-vs-overlay decision logic',
    'generate internal sample overlay PDFs for visual QA',
    'create a release-gate report for staff and professionals',
    'record fill-engine QA statuses without allowing final output by default'
  ],
  not_yet_allowed: [
    'final unstamped IRS Form 9465 for client signature',
    'electronic filing or automatic IRS submission',
    'placing taxpayer/spouse signatures',
    'filling direct-debit bank fields without explicit client confirmation',
    'overriding Form 433-F dependency warnings',
    'using a draft coordinate map without visual staff/professional signoff'
  ],
  human_minimization_model: 'The AI and platform complete all safe deterministic fields, ask missing/conditional questions, calculate lines 7/9/10, and route only unresolved risk, missing information, visual QA failures, client verification failures, or professional judgment items to staff, PTIN, EA, CPA, or tax attorney review.'
};

const FORM_9465_RELEASE_GATES = [
  { key: 'official_source_seeded', label: 'Official IRS 9465 source seeded', required: true },
  { key: 'official_pdf_captured', label: 'Official IRS 9465 PDF captured or uploaded from official source', required: true },
  { key: 'checksum_recorded', label: 'SHA-256 checksum recorded', required: true },
  { key: 'field_strategy_locked', label: 'AcroForm fields or overlay coordinates locked', required: true },
  { key: 'sample_output_generated', label: 'Sample filled output generated', required: true },
  { key: 'visual_overlay_qa_passed', label: 'Visual overlay/field QA passed for all pages', required: true },
  { key: 'overflow_qa_passed', label: 'Text overflow and money/date/checkbox formatting QA passed', required: true },
  { key: 'signature_blank_verified', label: 'Signature/date fields remain blank for client signing', required: true },
  { key: 'direct_debit_confirmed_or_blank', label: 'Direct-debit routing/account fields are client-confirmed or blank', required: true },
  { key: 'client_values_verified', label: 'Client verified all output values', required: true },
  { key: 'professional_release_signoff', label: 'Required professional/staff release signoff recorded', required: true },
  { key: 'production_security_allows_release', label: 'Production security/payment/release gates allow client output', required: true }
];

function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1 || value === '1';
}

function truncate(value, max = 120) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function formatValueForOutput(field, value, answers = {}, plan = {}) {
  if (value == null || value === '') return '';
  const type = field.value_type || field.kind || 'text';
  if (type.includes('money')) return money(value);
  if (type === 'checkbox') return normalizeBoolean(value) ? 'X' : '';
  if (type === 'ssn') return truncate(value, 15);
  if (type === 'ein') return truncate(value, 12);
  if (type === 'routing_number' || type === 'account_number') {
    if (!normalizeBoolean(answers.direct_debit_client_confirmed)) return '';
    return truncate(value, 30);
  }
  if (type === 'signature') return '';
  if (type === 'date' && String(field.source || '').includes('client_signs')) return '';
  return truncate(value, field.max_length || 120);
}

function valueForField(field, answers = {}, plan = {}) {
  const calculations = plan.derived_calculations || {};
  const key = field.input_key || field.field || field.key;
  if (Object.prototype.hasOwnProperty.call(calculations, key)) return calculations[key];
  if (Object.prototype.hasOwnProperty.call(answers, key)) return answers[key];
  if (key === 'line7_total_balance') return calculations.line7_total_balance;
  if (key === 'line9_amount_owed_after_payment') return calculations.line9_amount_owed_after_payment;
  if (key === 'line10_minimum_72_month_payment') return calculations.line10_minimum_72_month_payment;
  return '';
}

function conditionalStatus(field, answers = {}, plan = {}) {
  const c = field.conditional || '';
  const calc = plan.derived_calculations || {};
  if (!c) return { applies: true, reason: 'always applies' };
  if (c === 'joint_return') return { applies: normalizeBoolean(answers.joint_return), reason: 'joint return only' };
  if (c === 'line11a_less_than_line10') {
    const applies = Number(answers.line11a_proposed_monthly_payment || 0) < Number(calc.line10_minimum_72_month_payment || 0);
    return { applies, reason: 'line 11a below line 10 minimum payment' };
  }
  if (c === 'direct_debit_requested') return { applies: normalizeBoolean(answers.direct_debit_requested), reason: 'direct debit requested' };
  if (c === 'part_ii_required') return { applies: Boolean(calc.part_ii_required), reason: 'Part II trigger facts apply' };
  if (c === 'part_ii_required_and_married') return { applies: Boolean(calc.part_ii_required) && String(answers.marital_status || '').toLowerCase().includes('married'), reason: 'Part II married household question' };
  return { applies: true, reason: `conditional rule needs review: ${c}` };
}

function findVisualCoordinate(fieldKey) {
  return IRS_9465_OVERLAY_COORDINATE_DRAFT.find((item) => item.field === fieldKey) || null;
}

function build9465OverlayTemplate() {
  const templateFields = IRS_9465_FIELD_MAP.map((f) => {
    const coord = findVisualCoordinate(f.input_key || f.key);
    return {
      key: f.key,
      input_key: f.input_key,
      official_line: f.official_line,
      official_label: f.official_label,
      value_type: f.value_type,
      section: f.section,
      required: f.required,
      conditional: f.conditional,
      signature_or_sensitive: f.signature_or_sensitive,
      government_only: f.government_only,
      preparer_controlled: f.preparer_controlled,
      source: f.source,
      acroform_field_name: f.official_pdf_field_name || '',
      overlay_coordinate: coord ? { page: coord.page, x: coord.x, y: coord.y, width: coord.width, height: coord.height, status: coord.coordinate_status } : null,
      fill_strategy: f.official_pdf_field_name ? 'acroform_field_preferred_needs_pdf_confirmation' : (coord ? 'overlay_candidate_needs_visual_lock' : 'no_coordinate_yet_requires_manual_mapping'),
      output_rule: f.government_only ? 'never fill government-only area' : (f.value_type === 'signature' ? 'leave blank for client signature' : 'fillable only after validation and QA')
    };
  });
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    field_count: templateFields.length,
    acroform_field_count: templateFields.filter((f) => f.acroform_field_name).length,
    overlay_candidate_count: templateFields.filter((f) => f.overlay_coordinate).length,
    unmapped_count: templateFields.filter((f) => !f.acroform_field_name && !f.overlay_coordinate).length,
    strategy: 'Prefer exact AcroForm field names if the official IRS PDF exposes them. If not, use locked overlay coordinates after visual QA. Current coordinates are candidates only until rendered against the captured official PDF.',
    fields: templateFields,
    release_status: 'not_client_output_ready'
  };
}

function build9465FillPlan(answers = {}, options = {}) {
  const plan = build9465CompletionPlan(answers, options);
  const overlayTemplate = build9465OverlayTemplate();
  const fieldOutputs = overlayTemplate.fields.map((field) => {
    const cond = conditionalStatus(field, answers, plan);
    const rawValue = cond.applies ? valueForField(field, answers, plan) : '';
    const outputValue = cond.applies ? formatValueForOutput(field, rawValue, answers, plan) : '';
    const blockedReasons = [];
    if (field.government_only) blockedReasons.push('government_only_never_fill');
    if (field.preparer_controlled) blockedReasons.push('preparer_controlled_requires_verified_professional_workflow');
    if (field.value_type === 'signature') blockedReasons.push('signature_must_remain_blank');
    if ((field.value_type === 'routing_number' || field.value_type === 'account_number') && normalizeBoolean(answers.direct_debit_requested) && !normalizeBoolean(answers.direct_debit_client_confirmed)) blockedReasons.push('direct_debit_field_requires_explicit_client_confirmation');
    if (field.required && cond.applies && !outputValue && !field.value_type.includes('calculated')) blockedReasons.push('missing_required_value');
    if (!field.overlay_coordinate && !field.acroform_field_name) blockedReasons.push('no_locked_field_or_coordinate');
    return {
      key: field.key,
      input_key: field.input_key,
      official_line: field.official_line,
      label: field.official_label,
      section: field.section,
      applies: cond.applies,
      conditional_reason: cond.reason,
      raw_value_present: rawValue !== '' && rawValue != null,
      output_value_preview: outputValue,
      fill_strategy: field.fill_strategy,
      overlay_coordinate: field.overlay_coordinate,
      acroform_field_name: field.acroform_field_name,
      blocked_reasons: blockedReasons,
      can_fill_in_sample: blockedReasons.length === 0 && Boolean(outputValue)
    };
  });
  const blockers = [];
  if (!plan.ok) blockers.push('completion_plan_has_validation_errors');
  if (fieldOutputs.some((f) => f.blocked_reasons.includes('missing_required_value'))) blockers.push('required_values_missing');
  if (fieldOutputs.some((f) => f.blocked_reasons.includes('direct_debit_field_requires_explicit_client_confirmation'))) blockers.push('direct_debit_fields_need_client_confirmation');
  if (fieldOutputs.some((f) => f.blocked_reasons.includes('no_locked_field_or_coordinate'))) blockers.push('some_fields_need_mapping_coordinates_or_acroform_names');
  return {
    ok: plan.ok && blockers.length === 0,
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    completion_plan: plan,
    overlay_template_summary: {
      field_count: overlayTemplate.field_count,
      overlay_candidate_count: overlayTemplate.overlay_candidate_count,
      unmapped_count: overlayTemplate.unmapped_count
    },
    field_outputs: fieldOutputs,
    output_counts: {
      fillable_in_sample: fieldOutputs.filter((f) => f.can_fill_in_sample).length,
      blocked: fieldOutputs.filter((f) => f.blocked_reasons.length).length,
      blank_or_not_applicable: fieldOutputs.filter((f) => !f.output_value_preview && !f.blocked_reasons.length).length
    },
    output_gate: {
      internal_sample_overlay_allowed: plan.output_gate && plan.output_gate.sample_or_internal_draft_allowed,
      client_final_output_allowed: false,
      release_status: 'sample_overlay_only_not_final_client_output',
      blockers: Array.from(new Set([...blockers, 'official_pdf_capture_and_visual_overlay_qa_required', 'client_verification_required', 'professional_release_required']))
    }
  };
}

function latestStatus(store, qaType, statusSet) {
  if (!store || !store.list) return null;
  const rows = store.list('form_output_qa_events', (e) => !e.deleted_at && e.form_number === '9465' && (!qaType || e.qa_type === qaType));
  return rows.find((e) => statusSet.includes(e.status)) || null;
}

function build9465FillEngineReadiness(store) {
  const capture = build9465PdfCaptureReadiness(store);
  const overlayTemplate = build9465OverlayTemplate();
  const sampleOutput = latestStatus(store, 'fill_engine', ['sample_overlay_generated']);
  const visualPass = latestStatus(store, 'visual_field_qa', ['visual_sample_passed', 'ready_for_release_review']);
  const fillPass = latestStatus(store, 'fill_engine', ['fill_engine_visual_passed', 'release_gate_review_ready']);
  const gates = FORM_9465_RELEASE_GATES.map((gate) => {
    let ok = false;
    let detail = '';
    if (gate.key === 'official_source_seeded') { ok = Boolean(capture.source); detail = ok ? 'source record found' : 'source record missing'; }
    else if (gate.key === 'official_pdf_captured') { ok = Boolean(capture.captured_pdf); detail = ok ? 'captured/uploaded PDF record found' : 'PDF still not captured in this runtime'; }
    else if (gate.key === 'checksum_recorded') { ok = Boolean(capture.captured_pdf && capture.captured_pdf.sha256); detail = ok ? 'checksum present' : 'checksum missing'; }
    else if (gate.key === 'field_strategy_locked') { ok = overlayTemplate.unmapped_count === 0 && Boolean(fillPass); detail = fillPass ? 'fill-engine status indicates coordinates/strategy reviewed' : 'draft template exists but staff visual lock is still needed'; }
    else if (gate.key === 'sample_output_generated') { ok = Boolean(sampleOutput); detail = ok ? sampleOutput.id : 'generate sample overlay PDF'; }
    else if (gate.key === 'visual_overlay_qa_passed') { ok = Boolean(visualPass || fillPass); detail = ok ? 'visual QA pass recorded' : 'no visual QA pass recorded'; }
    else if (gate.key === 'overflow_qa_passed') { ok = Boolean(fillPass && String(fillPass.notes || '').toLowerCase().includes('overflow')); detail = ok ? 'overflow review referenced in staff note' : 'overflow review still needs explicit staff note/status'; }
    else if (gate.key === 'signature_blank_verified') { ok = Boolean(fillPass && String(fillPass.notes || '').toLowerCase().includes('signature')); detail = ok ? 'signature blank review referenced' : 'signature blank review still required'; }
    else if (gate.key === 'direct_debit_confirmed_or_blank') { ok = Boolean(fillPass && String(fillPass.notes || '').toLowerCase().includes('direct debit')); detail = ok ? 'direct debit review referenced' : 'bank-field handling review still required'; }
    else { ok = false; detail = 'requires client/professional/production release gate outside the fill engine'; }
    return { ...gate, ok, detail };
  });
  return {
    version: VERSION,
    policy: FORM_9465_FILL_ENGINE_POLICY,
    form: IRS_9465_CAPTURE_PROFILE,
    summary: {
      required_gates: gates.length,
      passed: gates.filter((g) => g.ok).length,
      blocked: gates.filter((g) => !g.ok).length,
      internal_sample_overlay_ready: true,
      client_final_output_ready: false
    },
    capture_readiness_summary: capture.summary,
    overlay_template_summary: {
      fields: overlayTemplate.field_count,
      overlay_candidates: overlayTemplate.overlay_candidate_count,
      unmapped: overlayTemplate.unmapped_count
    },
    gates,
    next_actions: gates.filter((g) => !g.ok).map((g) => g.label)
  };
}

function create9465SampleFilledOverlayPdfBuffer({ answers = {}, fillPlan = null, watermark = 'INTERNAL SAMPLE QA ONLY — NOT FINAL IRS OUTPUT' } = {}) {
  const plan = fillPlan || build9465FillPlan(answers, {});
  const doc = new PDFDocument({ size: 'LETTER', margin: 28, info: { Title: 'IRS Form 9465 Sample Filled Overlay QA', Author: 'Justice Tax Solutions' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  function drawPage(pageNum) {
    doc.fontSize(15).fillColor('#111').text(`IRS Form 9465 Sample Filled Overlay QA · Page ${pageNum}`, 40, 30, { align: 'center' });
    doc.fontSize(8).fillColor('red').text(watermark, 40, 52, { align: 'center' });
    doc.fontSize(8).fillColor('#333').text('This page is a coordinate/field-placement QA sheet, not the official IRS form. It must be compared against the captured official PDF before client output.', 42, 66, { width: 520, align: 'center' });
    doc.rect(42, 88, 528, 642).stroke('#999');
    doc.fontSize(7).fillColor('#666').text('Approximate official PDF coordinate area. Blue boxes show field candidates and previews.', 48, 94);
  }

  for (const pageNum of [1, 2]) {
    if (pageNum > 1) doc.addPage();
    drawPage(pageNum);
    const fields = plan.field_outputs.filter((f) => f.overlay_coordinate && f.overlay_coordinate.page === pageNum);
    fields.forEach((f) => {
      const c = f.overlay_coordinate;
      const x = c.x;
      const y = 792 - c.y - c.height;
      const width = c.width;
      const height = Math.max(c.height, 12);
      doc.rect(x, y, width, height).stroke('#2a5f8f');
      const preview = f.output_value_preview || (f.blocked_reasons.length ? `[blocked: ${f.blocked_reasons[0]}]` : '[blank]');
      doc.fontSize(6.5).fillColor(f.blocked_reasons.length ? '#8b1e1e' : '#111').text(preview, x + 2, y + 2, { width: Math.max(width - 4, 20), height: height + 4, ellipsis: true });
      doc.fontSize(5.5).fillColor('#666').text(`${f.official_line} ${f.input_key}`, x, y + height + 1, { width: width + 30, height: 10, ellipsis: true });
    });
    doc.fontSize(8).fillColor('#111').text('Signature/date fields must remain blank. Direct debit fields require explicit client confirmation. Government-only areas must remain blank.', 42, 742, { width: 528 });
  }

  doc.addPage();
  doc.fontSize(14).fillColor('#111').text('Fill plan QA summary', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Fillable in sample: ${plan.output_counts.fillable_in_sample}`);
  doc.text(`Blocked: ${plan.output_counts.blocked}`);
  doc.text(`Release status: ${plan.output_gate.release_status}`);
  doc.moveDown();
  doc.fontSize(12).text('Blocked / review fields', { underline: true });
  plan.field_outputs.filter((f) => f.blocked_reasons.length).slice(0, 80).forEach((f) => {
    if (doc.y > 720) doc.addPage();
    doc.fontSize(8).text(`${f.official_line} · ${f.input_key}: ${f.blocked_reasons.join(', ')}`);
  });
  doc.moveDown();
  doc.fontSize(12).text('Client verification reminders', { underline: true });
  const sheet = build9465VerificationSheet(answers, {});
  (sheet.client_must_verify || []).forEach((item) => doc.fontSize(8).text(`• ${item}`));
  doc.end();
  return endPromise;
}

function record9465FillEngineStatus(store, payload = {}, staff = {}) {
  const allowed = new Set(['not_started', 'sample_overlay_generated', 'coordinates_locked', 'fill_engine_visual_passed', 'blocked_needs_rework', 'release_gate_review_ready']);
  const status = allowed.has(String(payload.status || '')) ? String(payload.status) : 'not_started';
  const record = store.insert('form_output_qa_events', {
    form_number: '9465',
    agency: 'IRS',
    qa_type: 'fill_engine',
    status,
    official_form_id: truncate(payload.official_form_id, 120),
    official_source_id: truncate(payload.official_source_id, 120),
    sample_case_key: truncate(payload.sample_case_key, 80),
    page: truncate(payload.page, 20),
    zone_key: truncate(payload.zone_key, 120),
    notes: truncate(payload.notes, 2000),
    staff_id: staff.id || 'staff',
    client_output_allowed: false,
    created_at: new Date().toISOString()
  });
  return record;
}

function build9465FillEngineBoard(store) {
  const events = store && store.list ? store.list('form_output_qa_events', (e) => !e.deleted_at && e.form_number === '9465' && e.qa_type === 'fill_engine') : [];
  const byStatus = events.reduce((acc, e) => { acc[e.status || 'unknown'] = (acc[e.status || 'unknown'] || 0) + 1; return acc; }, {});
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_FILL_ENGINE_POLICY,
    summary: { events: events.length, by_status: byStatus, client_final_output_ready: false },
    board_columns: ['sample_overlay_generated', 'coordinates_locked', 'fill_engine_visual_passed', 'release_gate_review_ready', 'blocked_needs_rework'],
    latest_events: events.slice(0, 30).map((e) => ({ ...e, storage_path: undefined })),
    readiness: build9465FillEngineReadiness(store)
  };
}

module.exports = {
  FORM_9465_FILL_ENGINE_POLICY,
  FORM_9465_RELEASE_GATES,
  build9465OverlayTemplate,
  build9465FillPlan,
  build9465FillEngineReadiness,
  create9465SampleFilledOverlayPdfBuffer,
  record9465FillEngineStatus,
  build9465FillEngineBoard
};
