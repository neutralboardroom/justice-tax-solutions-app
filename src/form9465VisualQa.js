const fs = require('fs');
const PDFDocument = require('pdfkit');

const VERSION = '0.1.31';

const IRS_9465_CAPTURE_PROFILE = {
  agency: 'IRS',
  form_number: '9465',
  title: 'Installment Agreement Request',
  revision: 'Rev. September 2020',
  pdf_url: 'https://www.irs.gov/pub/irs-pdf/f9465.pdf',
  source_page_url: 'https://www.irs.gov/forms-pubs/about-form-9465',
  instructions_url: 'https://www.irs.gov/instructions/i9465',
  expected_pages: 2,
  expected_media: 'US Letter, portrait, 8.5 x 11 inches',
  page_coordinate_system: 'PDF points, origin bottom-left; visual QA coordinates are draft zones and must be confirmed after official PDF render.',
  source_observation: 'The public IRS PDF currently shows Form 9465 Rev. September 2020 with Part I on page 1 and Part II on page 2.',
  client_output_gate: 'Captured PDF is not usable for client signature/filing until checksum, page count, field/overlay coordinates, visual sample-fill, overflow, signature, client verification, and required reviewer release are complete.'
};

const IRS_9465_VISUAL_QA_POLICY = {
  purpose: 'Move Form 9465 from logical field mapping toward visual official-PDF QA without falsely releasing client-ready IRS output.',
  current_build_behavior: 'v0.1.31 can seed the source record, validate/dry-run/attempt official URL capture through the existing capture service, inspect captured PDF bytes for basic PDF signals, provide a page/field visual QA plan, produce an internal visual QA packet, and record staff QA events. Final client-output remains blocked.',
  first_safe_output: 'Internal QA packet and field/zone review only.',
  not_yet_allowed: [
    'final official IRS Form 9465 for client signature',
    'unverified overlay coordinates applied to a taxpayer package',
    'direct debit account/routing finalization without client confirmation',
    'signature placement by AI/system',
    'agency submission, mailing, or filing instruction as complete'
  ],
  required_before_release: [
    'official IRS PDF captured or attached',
    'SHA-256 checksum recorded',
    'page count confirmed as 2',
    'fillable AcroForm field names extracted or overlay coordinates locked',
    'sample fill inspected visually on both pages',
    'long text and money-field overflow checked',
    'checkbox placement checked',
    'signature fields intentionally blank',
    'government/officer-only areas left blank if any',
    'client verification sheet completed',
    'required professional/reviewer signoff recorded'
  ]
};

function zone(page, key, label, x, y, width, height, fields = [], notes = '') {
  return { page, key, label, approximate_pdf_points: { x, y, width, height }, fields, notes, status: 'draft_visual_zone_needs_render_confirmation' };
}

const IRS_9465_PAGE_ZONES = [
  zone(1, 'page1_header_request', 'Header/request basics', 40, 680, 532, 70, ['request_for_forms', 'tax_years_or_periods'], 'Confirm header line text does not collide with IRS title block.'),
  zone(1, 'page1_identity_address', 'Taxpayer, spouse, address, and business identity', 40, 530, 532, 150, ['taxpayer_first_name_initial', 'taxpayer_last_name', 'taxpayer_ssn', 'spouse_first_name_initial', 'spouse_last_name', 'spouse_ssn', 'current_address', 'apt_number', 'city_state_zip', 'foreign_country', 'foreign_province', 'foreign_postal_code', 'new_address_since_last_return', 'business_name_closed', 'business_ein'], 'Most overflow risk is address, foreign address, and business-name length.'),
  zone(1, 'page1_phone_amounts', 'Phone numbers and lines 5 through 10', 40, 385, 532, 145, ['home_phone', 'home_best_time', 'work_phone', 'work_ext', 'work_best_time', 'line5_return_or_notice_balance', 'line6_additional_balances', 'line7_total_balance', 'line8_payment_with_request', 'line9_amount_owed_after_payment', 'line10_minimum_72_month_payment'], 'Money fields should right-align, show cents consistently, and stay inside boxes.'),
  zone(1, 'page1_payment_proposal', 'Lines 11a, 11b, 12, 13, and 14 payment proposal', 40, 150, 532, 235, ['line11a_proposed_monthly_payment', 'line11b_revised_monthly_payment', 'line11_cannot_increase_attach_433f', 'payment_day_of_month', 'direct_debit_routing', 'direct_debit_account', 'low_income_no_debit_reimbursement', 'payroll_deduction_requested'], 'Direct debit values are sensitive and must require explicit client confirmation.'),
  zone(1, 'page1_signature', 'Taxpayer and spouse signature/date area', 40, 45, 532, 95, ['taxpayer_signature', 'taxpayer_signature_date', 'spouse_signature', 'spouse_signature_date'], 'Signature fields must remain blank in system output; only client signs after review.'),
  zone(2, 'page2_part_ii_conditions', 'Part II trigger and conditions', 40, 640, 532, 105, ['part_ii_required'], 'Part II is completed only if all listed conditions apply; if over $50,000 Form 433-F is required.'),
  zone(2, 'page2_household_income', 'Lines 15 through 22 household and income details', 40, 345, 532, 295, ['county_of_primary_residence', 'marital_status', 'share_household_expenses_spouse', 'dependents_count', 'household_65_or_older_count', 'pay_frequency', 'net_income_per_pay_period', 'spouse_pay_frequency', 'spouse_net_income_per_pay_period'], 'Check radio/checkbox alignment and spouse-only conditional blanks.'),
  zone(2, 'page2_expenses', 'Lines 23 through 27 vehicles, insurance, court-ordered payments, dependent care', 40, 75, 532, 270, ['vehicle_count', 'car_payment_count', 'has_health_insurance', 'health_insurance_premiums_payroll_deducted', 'monthly_health_insurance_premiums', 'court_ordered_payments', 'court_ordered_payments_payroll_deducted', 'monthly_court_ordered_payments', 'monthly_child_dependent_care'], 'Check checkboxes and dollar amounts; do not fill skipped conditional money lines.' )
];

const IRS_9465_OVERLAY_COORDINATE_DRAFT = [
  { page: 1, line: 'Header', field: 'request_for_forms', x: 275, y: 646, width: 285, height: 12, kind: 'text' },
  { page: 1, line: 'Header', field: 'tax_years_or_periods', x: 305, y: 633, width: 255, height: 12, kind: 'text' },
  { page: 1, line: '1a', field: 'taxpayer_first_name_initial', x: 64, y: 612, width: 164, height: 18, kind: 'text' },
  { page: 1, line: '1a', field: 'taxpayer_last_name', x: 230, y: 612, width: 212, height: 18, kind: 'text' },
  { page: 1, line: '1a', field: 'taxpayer_ssn', x: 447, y: 612, width: 112, height: 18, kind: 'ssn' },
  { page: 1, line: '1a', field: 'current_address', x: 64, y: 555, width: 420, height: 18, kind: 'text' },
  { page: 1, line: '1a', field: 'apt_number', x: 486, y: 555, width: 73, height: 18, kind: 'text' },
  { page: 1, line: '1a', field: 'city_state_zip', x: 64, y: 525, width: 495, height: 18, kind: 'text' },
  { page: 1, line: '5', field: 'line5_return_or_notice_balance', x: 475, y: 403, width: 84, height: 14, kind: 'money' },
  { page: 1, line: '6', field: 'line6_additional_balances', x: 475, y: 386, width: 84, height: 14, kind: 'money' },
  { page: 1, line: '7', field: 'line7_total_balance', x: 475, y: 369, width: 84, height: 14, kind: 'money_calculated' },
  { page: 1, line: '8', field: 'line8_payment_with_request', x: 475, y: 352, width: 84, height: 14, kind: 'money' },
  { page: 1, line: '9', field: 'line9_amount_owed_after_payment', x: 475, y: 335, width: 84, height: 14, kind: 'money_calculated' },
  { page: 1, line: '10', field: 'line10_minimum_72_month_payment', x: 475, y: 318, width: 84, height: 14, kind: 'money_calculated' },
  { page: 1, line: '11a', field: 'line11a_proposed_monthly_payment', x: 475, y: 252, width: 84, height: 18, kind: 'money' },
  { page: 1, line: '11b', field: 'line11b_revised_monthly_payment', x: 475, y: 214, width: 84, height: 18, kind: 'money' },
  { page: 1, line: '12', field: 'payment_day_of_month', x: 478, y: 142, width: 80, height: 14, kind: 'number_1_to_28' },
  { page: 1, line: '13a', field: 'direct_debit_routing', x: 105, y: 107, width: 115, height: 14, kind: 'routing_number' },
  { page: 1, line: '13b', field: 'direct_debit_account', x: 300, y: 107, width: 135, height: 14, kind: 'account_number' },
  { page: 2, line: '15', field: 'county_of_primary_residence', x: 238, y: 635, width: 180, height: 14, kind: 'text' },
  { page: 2, line: '17', field: 'dependents_count', x: 482, y: 505, width: 77, height: 14, kind: 'number' },
  { page: 2, line: '18', field: 'household_65_or_older_count', x: 482, y: 462, width: 77, height: 14, kind: 'number' },
  { page: 2, line: '20', field: 'net_income_per_pay_period', x: 482, y: 355, width: 77, height: 14, kind: 'money' },
  { page: 2, line: '22', field: 'spouse_net_income_per_pay_period', x: 482, y: 246, width: 77, height: 14, kind: 'money' },
  { page: 2, line: '23', field: 'vehicle_count', x: 482, y: 210, width: 77, height: 14, kind: 'number' },
  { page: 2, line: '24', field: 'car_payment_count', x: 482, y: 174, width: 77, height: 14, kind: 'number' },
  { page: 2, line: '25c', field: 'monthly_health_insurance_premiums', x: 482, y: 92, width: 77, height: 14, kind: 'money' },
  { page: 2, line: '26c', field: 'monthly_court_ordered_payments', x: 482, y: 28, width: 77, height: 14, kind: 'money' },
  { page: 2, line: '27', field: 'monthly_child_dependent_care', x: 482, y: 8, width: 77, height: 14, kind: 'money' }
].map((item) => ({ ...item, coordinate_status: 'draft_from_visual_review_needs_actual_pdf_render_confirmation' }));

function normalizeFormNumber(value = '') {
  return String(value || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function find9465Source(store) {
  if (!store || !store.find) return null;
  return store.find('official_form_sources', (s) => !s.deleted_at && s.agency === 'IRS' && normalizeFormNumber(s.form_number) === '9465') || null;
}

function find9465CapturedPdf(store) {
  if (!store || !store.find) return null;
  return store.find('official_forms', (f) => !f.deleted_at && f.agency === 'IRS' && normalizeFormNumber(f.form_number) === '9465' && (f.storage_path || f.sha256)) || null;
}

function ensure9465OfficialSource(store, actor = {}) {
  const existing = find9465Source(store);
  if (existing) return { created: false, source: existing };
  const now = new Date().toISOString();
  const source = store.insert('official_form_sources', {
    agency: IRS_9465_CAPTURE_PROFILE.agency,
    form_number: IRS_9465_CAPTURE_PROFILE.form_number,
    title: IRS_9465_CAPTURE_PROFILE.title,
    tax_year: 'current',
    revision_date: IRS_9465_CAPTURE_PROFILE.revision,
    pdf_url: IRS_9465_CAPTURE_PROFILE.pdf_url,
    source_page_url: IRS_9465_CAPTURE_PROFILE.source_page_url,
    instructions_url: IRS_9465_CAPTURE_PROFILE.instructions_url,
    source_status: 'official_source_seeded_for_capture',
    pdf_capture_status: 'not_captured',
    checksum_status: 'not_recorded',
    mapping_status: 'visual_qa_coordinate_draft_ready_needs_pdf_capture',
    field_extraction_status: 'not_started',
    can_drive_client_output: false,
    release_status: 'not_usable_for_client_output_until_pdf_captured_mapped_sample_tested_client_verified_and_released',
    added_by: actor.id || 'system',
    added_from: 'v0.1.31_9465_visual_qa_source_seed',
    notes: 'Seeded for IRS Form 9465 official PDF capture and visual field QA. Final client output remains blocked.'
  });
  if (store.insert) {
    store.insert('official_source_audits', {
      official_form_source_id: source.id,
      event_type: 'form_9465_source_seeded_for_visual_qa',
      agency: 'IRS',
      form_number: '9465',
      source_url: IRS_9465_CAPTURE_PROFILE.pdf_url,
      client_output_allowed: false,
      note: 'Official IRS 9465 source seeded; PDF capture/checksum and visual QA still required.'
    });
  }
  return { created: true, source };
}

function inspectPdfBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return { ok: false, reason: 'no_buffer' };
  const header = buffer.subarray(0, 5).toString('utf8');
  const textProbe = buffer.subarray(0, Math.min(buffer.length, 500000)).toString('latin1');
  const pageTypeMatches = textProbe.match(/\/Type\s*\/Page\b/g) || [];
  const acroForm = /\/AcroForm\b/.test(textProbe);
  const fields = /\/Fields\b/.test(textProbe);
  const possibleFieldNames = Array.from(textProbe.matchAll(/\/T\s*\(([^)]{1,120})\)/g)).slice(0, 200).map((m) => m[1]);
  return {
    ok: header === '%PDF-',
    header,
    size_bytes: buffer.length,
    inferred_page_object_count: pageTypeMatches.length,
    has_acroform_reference: acroForm,
    has_fields_reference: fields,
    possible_field_names_count: possibleFieldNames.length,
    possible_field_names_sample: possibleFieldNames.slice(0, 40),
    field_extraction_note: acroForm && fields ? 'PDF appears to expose AcroForm signals; extract exact names with a dedicated PDF form-field library or visual review.' : 'No reliable AcroForm field list detected by lightweight byte scan; overlay-coordinate mode may be required.'
  };
}

function inspectCaptured9465Pdf(store) {
  const captured = find9465CapturedPdf(store);
  if (!captured) return { ok: false, status: 'no_captured_pdf_record', message: 'No captured or uploaded IRS Form 9465 PDF record found yet.' };
  const result = { ok: false, status: 'record_found_not_readable', official_form: { ...captured, storage_path: undefined }, inspection: null };
  try {
    if (!captured.storage_path || !fs.existsSync(captured.storage_path)) {
      result.status = 'record_found_missing_local_file';
      result.message = 'A captured official form record exists, but the local file is unavailable in this runtime.';
      return result;
    }
    const buffer = fs.readFileSync(captured.storage_path);
    const inspection = inspectPdfBuffer(buffer);
    result.ok = inspection.ok;
    result.status = inspection.ok ? 'captured_pdf_inspected' : 'captured_file_not_pdf';
    result.inspection = inspection;
    return result;
  } catch (error) {
    result.status = 'inspection_failed';
    result.error = error.message;
    return result;
  }
}

function build9465PdfCaptureReadiness(store) {
  const source = find9465Source(store);
  const captured = find9465CapturedPdf(store);
  const inspection = inspectCaptured9465Pdf(store);
  const sourceReady = Boolean(source);
  const capturedReady = Boolean(captured && captured.sha256);
  const pageSignalReady = Boolean(inspection.ok && (inspection.inspection.inferred_page_object_count >= 2 || capturedReady));
  const checks = [
    { key: 'official_source_seeded', label: 'Official IRS 9465 source record is seeded', ok: sourceReady, detail: source ? source.pdf_url || source.source_page_url : IRS_9465_CAPTURE_PROFILE.pdf_url },
    { key: 'official_url_capture_enabled_or_manual_available', label: 'Official URL capture or manual PDF upload path exists', ok: true, detail: 'Use /api/admin/official-form-sources/:id/capture-pdf or official ZIP/PDF upload.' },
    { key: 'captured_pdf_checksum', label: 'Captured/uploaded PDF checksum recorded', ok: capturedReady, detail: captured ? captured.sha256 || 'record found without checksum' : 'No captured/uploaded Form 9465 PDF yet.' },
    { key: 'basic_pdf_inspection', label: 'Basic PDF byte inspection completed', ok: Boolean(inspection.ok), detail: inspection.status || '' },
    { key: 'page_count_visual_confirmed', label: 'Two-page visual layout confirmed', ok: pageSignalReady, detail: pageSignalReady ? 'Captured PDF inspection indicates a PDF record is available; visual two-page review still needs staff signoff.' : 'Use official PDF screenshot/render or captured PDF render to confirm page count and layout.' },
    { key: 'visual_zone_map_ready', label: 'Visual page/zone map prepared', ok: IRS_9465_PAGE_ZONES.length >= 8, detail: `${IRS_9465_PAGE_ZONES.length} visual zones` },
    { key: 'overlay_coordinate_draft_ready', label: 'Overlay coordinate draft prepared', ok: IRS_9465_OVERLAY_COORDINATE_DRAFT.length >= 20, detail: `${IRS_9465_OVERLAY_COORDINATE_DRAFT.length} coordinate candidates` },
    { key: 'final_client_output', label: 'Final client output released', ok: false, detail: 'Still blocked until sample-fill visual QA and professional release are complete.' }
  ];
  return {
    version: VERSION,
    profile: IRS_9465_CAPTURE_PROFILE,
    source: source ? { ...source, storage_path: undefined } : null,
    captured_pdf: captured ? { ...captured, storage_path: undefined } : null,
    inspection,
    summary: { required_checks: checks.length, passed: checks.filter((c) => c.ok).length, blocked: checks.filter((c) => !c.ok).length, final_client_output_ready: false },
    checks,
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label),
    gate: IRS_9465_CAPTURE_PROFILE.client_output_gate
  };
}

function build9465VisualFieldQaPlan() {
  return {
    version: VERSION,
    profile: IRS_9465_CAPTURE_PROFILE,
    policy: IRS_9465_VISUAL_QA_POLICY,
    page_zones: IRS_9465_PAGE_ZONES,
    overlay_coordinate_draft: IRS_9465_OVERLAY_COORDINATE_DRAFT,
    qa_steps: [
      { step: 1, key: 'capture_or_attach_pdf', owner: 'staff/admin', output: 'official_forms record with SHA-256 checksum' },
      { step: 2, key: 'render_page_images', owner: 'staff/admin', output: 'page 1 and page 2 visual review references' },
      { step: 3, key: 'extract_or_lock_fields', owner: 'builder/staff', output: 'exact AcroForm field names or overlay coordinates' },
      { step: 4, key: 'generate_sample_outputs', owner: 'system', output: 'low-debt, direct-debit, and Part-II-trigger samples' },
      { step: 5, key: 'visual_overflow_review', owner: 'staff/professional', output: 'all fields remain inside boxes; skipped lines blank' },
      { step: 6, key: 'signature_and_sensitive_review', owner: 'staff/professional', output: 'signature blank; bank fields verified client-confirmed' },
      { step: 7, key: 'release_gate', owner: 'staff/professional', output: 'client-facing print/signature draft may be enabled only after signoff' }
    ],
    release_status: 'not_client_output_ready'
  };
}

function build9465VisualSampleQa(answers = {}, completionPlan = null) {
  const line9 = Number(completionPlan && completionPlan.derived_calculations ? completionPlan.derived_calculations.line9_amount_owed_after_payment : (answers.line9_amount_owed_after_payment || 0));
  const line10 = Number(completionPlan && completionPlan.derived_calculations ? completionPlan.derived_calculations.line10_minimum_72_month_payment : (line9 ? line9 / 72 : 0));
  const line11a = Number(answers.line11a_proposed_monthly_payment || 0);
  const partII = completionPlan && completionPlan.derived_calculations ? completionPlan.derived_calculations.part_ii_required : false;
  const checks = [
    { key: 'source_pdf', status: 'needs_captured_pdf', note: 'Run against the captured IRS PDF or staff-rendered screenshots before final release.' },
    { key: 'line_7_9_10_math', status: line9 >= 0 && line10 >= 0 ? 'ready_for_visual_check' : 'needs_answer_fix', note: 'Confirm lines 7, 9, and 10 match the interview calculations and fit the money boxes.' },
    { key: 'monthly_payment', status: line11a && line10 && line11a < line10 ? 'requires_11b_or_433f_review' : 'ready_for_visual_check', note: 'If line 11a is below line 10, follow-up/revised amount or 433-F trigger must be reviewed.' },
    { key: 'part_ii', status: partII ? 'required_visual_check_page_2' : 'should_remain_blank_for_this_sample', note: partII ? 'Page 2 Part II fields must be filled and checked.' : 'Page 2 Part II fields should remain blank unless trigger facts apply.' },
    { key: 'direct_debit_sensitive_fields', status: answers.direct_debit_requested ? 'client_confirmation_required' : 'should_remain_blank', note: 'Routing/account numbers are sensitive and require explicit client verification before output.' },
    { key: 'checkbox_alignment', status: 'needs_visual_check', note: 'Check new address, cannot-increase/433-F, low-income, payroll deduction, and Part II boxes.' },
    { key: 'signature_fields', status: 'must_remain_blank', note: 'Taxpayer and spouse signature/date fields must remain blank in generated output.' },
    { key: 'overflow', status: 'needs_visual_check', note: 'Check long names, address, foreign address, business name, and county text.' }
  ];
  return { ok: true, version: VERSION, form: IRS_9465_CAPTURE_PROFILE, checks, page_zones: IRS_9465_PAGE_ZONES, coordinate_draft: IRS_9465_OVERLAY_COORDINATE_DRAFT, final_client_output_ready: false };
}

function create9465VisualQaPacketBuffer({ readiness = {}, visualPlan = {}, sampleQa = {} } = {}) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 44, info: { Title: 'IRS Form 9465 Visual Field QA Packet', Author: 'Justice Tax Solutions' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(16).text('Justice Tax Solutions', { align: 'center' });
  doc.fontSize(13).text('IRS Form 9465 Official PDF Capture + Visual Field QA Packet', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('red').text('Internal QA packet only. Not a final IRS Form 9465, not a client signature package, and not an IRS submission. Final output remains blocked until official PDF capture, field/overlay confirmation, sample-fill visual QA, client verification, and required professional release are complete.', { align: 'center' });
  doc.fillColor('black').moveDown();
  doc.fontSize(11).text(`Official source: ${IRS_9465_CAPTURE_PROFILE.pdf_url}`);
  doc.text(`Revision: ${IRS_9465_CAPTURE_PROFILE.revision}`);
  doc.text(`Readiness: ${readiness.summary ? `${readiness.summary.passed}/${readiness.summary.required_checks} checks passed` : 'not supplied'}`);
  doc.moveDown();
  doc.fontSize(12).text('Capture/readiness blockers', { underline: true });
  (readiness.checks || []).forEach((c) => doc.fontSize(9).text(`${c.ok ? 'PASS' : 'BLOCK'} · ${c.label}: ${c.detail || ''}`));

  doc.addPage();
  doc.fontSize(13).text('Page/zone visual QA plan', { underline: true });
  (visualPlan.page_zones || IRS_9465_PAGE_ZONES).forEach((z) => {
    if (doc.y > 720) doc.addPage();
    const box = z.approximate_pdf_points || {};
    doc.fontSize(9).text(`Page ${z.page} · ${z.label}`);
    doc.fontSize(8).text(`Zone: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);
    doc.text(`Fields: ${(z.fields || []).join(', ')}`);
    if (z.notes) doc.text(`Note: ${z.notes}`);
    doc.moveDown(0.3);
  });

  doc.addPage();
  doc.fontSize(13).text('Overlay coordinate candidates', { underline: true });
  IRS_9465_OVERLAY_COORDINATE_DRAFT.forEach((f) => {
    if (doc.y > 720) doc.addPage();
    doc.fontSize(8).text(`P${f.page} ${f.line} ${f.field} · x=${f.x}, y=${f.y}, w=${f.width}, h=${f.height} · ${f.kind}`);
  });

  doc.addPage();
  doc.fontSize(13).text('Sample visual QA checks', { underline: true });
  (sampleQa.checks || []).forEach((c, idx) => doc.fontSize(9).text(`${idx + 1}. ${c.key}: ${c.status} — ${c.note}`));
  doc.moveDown();
  doc.fontSize(11).text('Release rule', { underline: true });
  doc.fontSize(9).text(IRS_9465_CAPTURE_PROFILE.client_output_gate);
  doc.end();
  return endPromise;
}

function record9465VisualQaStatus(store, payload = {}, staff = {}) {
  const allowed = new Set(['not_started', 'source_seeded', 'pdf_captured', 'basic_pdf_inspected', 'coordinates_drafted', 'visual_sample_generated', 'visual_sample_passed', 'blocked_needs_rework', 'ready_for_release_review']);
  const status = allowed.has(String(payload.status || '')) ? String(payload.status) : 'not_started';
  const record = store.insert('form_output_qa_events', {
    form_number: '9465',
    agency: 'IRS',
    qa_type: 'visual_field_qa',
    status,
    official_form_id: String(payload.official_form_id || '').slice(0, 120),
    official_source_id: String(payload.official_source_id || '').slice(0, 120),
    sample_case_key: String(payload.sample_case_key || '').slice(0, 80),
    page: String(payload.page || '').slice(0, 20),
    zone_key: String(payload.zone_key || '').slice(0, 120),
    notes: String(payload.notes || '').slice(0, 2000),
    staff_id: staff.id || 'staff',
    client_output_allowed: false,
    created_at: new Date().toISOString()
  });
  return record;
}

function build9465VisualQaBoard(store) {
  const events = store && store.list ? store.list('form_output_qa_events', (e) => !e.deleted_at && e.form_number === '9465' && e.qa_type === 'visual_field_qa') : [];
  const byStatus = events.reduce((acc, e) => { acc[e.status || 'unknown'] = (acc[e.status || 'unknown'] || 0) + 1; return acc; }, {});
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    summary: { events: events.length, by_status: byStatus, final_client_output_ready: false },
    latest_events: events.slice(0, 25).map((e) => ({ ...e, storage_path: undefined })),
    board_columns: ['source_seeded', 'pdf_captured', 'basic_pdf_inspected', 'coordinates_drafted', 'visual_sample_generated', 'visual_sample_passed', 'ready_for_release_review', 'blocked_needs_rework'],
    next_actions: IRS_9465_VISUAL_QA_POLICY.required_before_release
  };
}

module.exports = {
  IRS_9465_CAPTURE_PROFILE,
  IRS_9465_VISUAL_QA_POLICY,
  IRS_9465_PAGE_ZONES,
  IRS_9465_OVERLAY_COORDINATE_DRAFT,
  ensure9465OfficialSource,
  inspectCaptured9465Pdf,
  build9465PdfCaptureReadiness,
  build9465VisualFieldQaPlan,
  build9465VisualSampleQa,
  create9465VisualQaPacketBuffer,
  record9465VisualQaStatus,
  build9465VisualQaBoard
};
