const PDFDocument = require('pdfkit');
const { IRS_9465_CAPTURE_PROFILE } = require('./form9465Output');
const { build9465CompletionPlan, build9465VerificationSheet } = require('./form9465Output');
const { build9465FinalOutputGateReport } = require('./form9465CoordinateLock');
const { build9465OfficialSampleOutputReadiness, build9465OfficialSampleOutputPreview } = require('./form9465OfficialSample');
const { build9465FillEngineReadiness } = require('./form9465FillEngine');

const VERSION = '0.1.35';

const FORM_9465_CLIENT_RELEASE_POLICY = {
  version: VERSION,
  goal: 'Add the client verification and professional release gate needed before any IRS Form 9465 print/signature draft can be released to a client.',
  scope: 'Controlled release-gate workflow only. This version does not enable final client IRS output unless all source, coordinate, client, professional, and production gates are actually complete.',
  client_verification_rule: 'The client must verify identity, address, tax periods, balances, proposed payment amount, requested payment day, direct-debit/bank details if used, signature blanks, and all Part II trigger facts before a print/signature draft is released.',
  professional_release_rule: 'A verified PTIN preparer, EA, CPA, or tax attorney must record the required scoped release signoff when the case type, pricing level, or risk requires professional review. AI-only cannot sign, file, represent, or guarantee acceptance.',
  print_signature_rule: 'A print/signature draft may be prepared only as a client-review package. Taxpayer/spouse signature and date fields must remain blank, government-only areas must remain blank, and the client must review before signing or mailing/submitting.'
};

const CLIENT_VERIFICATION_ITEMS = [
  { key: 'identity_taxpayer_name', label: 'Taxpayer name is correct', required: true, answer_key: 'taxpayer_name' },
  { key: 'identity_spouse_name', label: 'Spouse name is correct if a joint request applies', required: false, answer_key: 'spouse_name' },
  { key: 'tin_last4_or_masked', label: 'Taxpayer identifying number was verified outside the public dashboard', required: true, answer_key: 'taxpayer_tin_confirmed' },
  { key: 'current_address', label: 'Current mailing address is correct', required: true, answer_key: 'address_line1' },
  { key: 'phone_number', label: 'Phone number is correct', required: true, answer_key: 'phone' },
  { key: 'tax_periods', label: 'Tax years/periods covered by the request are correct', required: true, answer_key: 'tax_periods' },
  { key: 'amount_owed', label: 'Amount owed was reviewed against IRS notice/transcript/client record', required: true, answer_key: 'amount_owed' },
  { key: 'payment_amount', label: 'Proposed monthly payment amount is correct and affordable', required: true, answer_key: 'monthly_payment' },
  { key: 'payment_day', label: 'Requested monthly payment day is correct', required: true, answer_key: 'payment_day' },
  { key: 'direct_debit_choice', label: 'Direct debit choice is confirmed, or bank fields stay blank', required: true, answer_key: 'direct_debit_client_confirmed' },
  { key: 'part_ii_triggers', label: 'Part II trigger facts were reviewed, including amount owed and payment period', required: true, answer_key: 'part_ii_reviewed' },
  { key: 'form_433f_dependency', label: 'Form 433-F dependency warning was reviewed when applicable', required: false, answer_key: 'form_433f_reviewed' },
  { key: 'signature_blank', label: 'Signature/date fields will remain blank for client signing', required: true, answer_key: 'signature_blank_confirmed' },
  { key: 'not_final_until_review', label: 'Client understands no filing/submission should happen until all required review gates are complete', required: true, answer_key: 'not_final_until_reviewed' }
];

const RELEASE_STATUS_VALUES = [
  'not_started',
  'client_verification_sent',
  'client_values_verified',
  'client_values_need_correction',
  'professional_release_requested',
  'professional_released_for_print_signature_draft',
  'professional_release_denied',
  'print_signature_draft_generated',
  'blocked_needs_official_pdf_coordinate_lock',
  'blocked_needs_production_security',
  'blocked_needs_payment_or_quote',
  'blocked_needs_client_review'
];

function text(value = '', max = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function bool(value) {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1 || value === '1';
}

function moneyLike(value) {
  const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0;
}

function latest(store, collection, predicate) {
  if (!store || !store.list) return null;
  return (store.list(collection, predicate) || []).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
}

function latestClientVerification(store, caseId) {
  return latest(store, 'form_9465_client_verifications', (r) => !r.deleted_at && r.case_id === caseId);
}

function latestProfessionalRelease(store, caseId) {
  return latest(store, 'form_9465_release_events', (r) => !r.deleted_at && r.case_id === caseId && String(r.event_type || '').includes('professional_release'));
}

function collectAnswerSignals(answers = {}) {
  return {
    taxpayer_name: Boolean(text(answers.taxpayer_name || answers.name, 120)),
    spouse_name: Boolean(text(answers.spouse_name, 120)),
    taxpayer_tin_confirmed: bool(answers.taxpayer_tin_confirmed) || Boolean(text(answers.ssn_last4 || answers.taxpayer_tin_last4, 8)),
    address_line1: Boolean(text(answers.address_line1 || answers.street_address, 140)),
    phone: Boolean(text(answers.phone || answers.phone_number, 40)),
    tax_periods: Boolean(text(answers.tax_periods || answers.tax_years, 160)),
    amount_owed: moneyLike(answers.amount_owed || answers.line5_total_amount_owed),
    monthly_payment: moneyLike(answers.monthly_payment || answers.line11_proposed_monthly_payment),
    payment_day: Boolean(text(answers.payment_day || answers.line12_payment_day, 20)),
    direct_debit_client_confirmed: bool(answers.direct_debit_client_confirmed) || !bool(answers.direct_debit_requested),
    part_ii_reviewed: bool(answers.part_ii_reviewed) || bool(answers.part_ii_not_required_confirmed),
    form_433f_reviewed: bool(answers.form_433f_reviewed) || bool(answers.form_433f_not_required_confirmed),
    signature_blank_confirmed: bool(answers.signature_blank_confirmed),
    not_final_until_reviewed: bool(answers.not_final_until_reviewed)
  };
}

function build9465ClientVerificationChecklist(answers = {}, store, options = {}) {
  const signals = collectAnswerSignals(answers);
  const completionPlan = build9465CompletionPlan(answers, { clientVerified: false, professionalReleased: false });
  const verificationSheet = build9465VerificationSheet(answers, {});
  const items = CLIENT_VERIFICATION_ITEMS.map((item) => {
    const satisfied = Boolean(signals[item.answer_key]);
    const requiredNow = item.required || (item.key === 'form_433f_dependency' && completionPlan.risk_flags && completionPlan.risk_flags.some((flag) => String(flag.key || flag).includes('433')));
    return {
      ...item,
      required_now: requiredNow,
      satisfied,
      status: satisfied ? 'verified_or_answer_present' : (requiredNow ? 'needs_client_confirmation' : 'optional_or_conditional'),
      client_prompt: item.label
    };
  });
  const requiredMissing = items.filter((item) => item.required_now && !item.satisfied);
  const directDebitWarning = bool(answers.direct_debit_requested) && !bool(answers.direct_debit_client_confirmed);
  const latestRecord = options.caseId ? latestClientVerification(store, options.caseId) : null;
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_CLIENT_RELEASE_POLICY,
    status: requiredMissing.length ? 'client_verification_incomplete' : 'client_values_ready_for_attestation',
    case_id: options.caseId || '',
    items,
    required_missing: requiredMissing.map((item) => ({ key: item.key, label: item.label })),
    direct_debit_warning: directDebitWarning ? 'Direct debit fields cannot be populated unless the client explicitly confirms routing/account details and understands withdrawal terms.' : '',
    verification_sheet: verificationSheet,
    latest_verification_record: latestRecord ? { id: latestRecord.id, status: latestRecord.status, verified_at: latestRecord.verified_at || latestRecord.created_at } : null,
    client_output_allowed: false
  };
}

function create9465ClientVerificationRecord(store, taxCase = {}, answers = {}, payload = {}, actor = {}) {
  const checklist = build9465ClientVerificationChecklist(answers, store, { caseId: taxCase.id });
  const clientAttested = bool(payload.client_attested) || bool(payload.client_values_verified) || bool(payload.all_items_verified);
  const requiresCorrection = bool(payload.needs_correction) || checklist.required_missing.length > 0;
  const status = requiresCorrection ? 'client_values_need_correction' : (clientAttested ? 'client_values_verified' : 'client_verification_sent');
  const record = store.insert('form_9465_client_verifications', {
    id: `9465client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    case_id: taxCase.id || '',
    user_id: actor.id || taxCase.user_id || '',
    status,
    client_attested: clientAttested && !requiresCorrection,
    required_missing: checklist.required_missing,
    corrected_fields_requested: text(payload.corrected_fields_requested || '', 1500),
    client_notes: text(payload.client_notes || payload.notes || '', 1500),
    verified_items: checklist.items.filter((item) => item.satisfied).map((item) => item.key),
    unchecked_required_items: checklist.required_missing.map((item) => item.key),
    verified_at: clientAttested && !requiresCorrection ? new Date().toISOString() : '',
    created_at: new Date().toISOString()
  });
  if (taxCase.id) {
    store.update('cases', taxCase.id, {
      form_9465_client_verification_status: status,
      form_9465_client_verification_id: record.id,
      form_9465_client_verified_at: record.verified_at || '',
      release_status: status === 'client_values_verified' ? 'client_values_verified_pending_professional_release' : 'client_values_need_correction'
    });
  }
  return { record, checklist };
}

function professionalSignoffAllowsRelease(signoff = {}) {
  return Boolean(signoff && signoff.final_release_allowed) || ['professional_released_for_print_signature_draft', 'release_gate_review_ready'].includes(String(signoff.status || signoff.signoff_type || ''));
}

function build9465ProfessionalReleaseGate(store, taxCase = {}, answers = {}) {
  const caseId = taxCase.id || '';
  const clientVerification = latestClientVerification(store, caseId);
  const releaseEvent = latestProfessionalRelease(store, caseId);
  const signoffs = store && store.list ? store.list('professional_signoffs', (s) => !s.deleted_at && s.case_id === caseId) : [];
  const finalReleaseSignoff = signoffs.find((s) => professionalSignoffAllowsRelease(s));
  const finalGate = build9465FinalOutputGateReport(store);
  const fillEngine = build9465FillEngineReadiness(store);
  const officialSample = build9465OfficialSampleOutputReadiness(store);
  const officialPreview = build9465OfficialSampleOutputPreview(answers, store);
  const requiredProfessional = taxCase.assigned_professional_role || taxCase.assigned_professional_role_key || 'PTIN/EA/CPA/tax attorney as routed';
  const gates = [
    { key: 'client_values_verified', label: 'Client verified Form 9465 values and warnings', ok: Boolean(clientVerification && clientVerification.status === 'client_values_verified') },
    { key: 'professional_assigned', label: 'Professional assigned where required/requested', ok: Boolean(taxCase.assigned_professional_id || taxCase.assigned_professional_name) },
    { key: 'professional_release_signoff', label: 'Professional release signoff recorded', ok: Boolean(finalReleaseSignoff || (releaseEvent && releaseEvent.status === 'professional_released_for_print_signature_draft')) },
    { key: 'official_pdf_capture_or_upload', label: 'Official IRS Form 9465 PDF captured/uploaded and checksum recorded', ok: Boolean(finalGate.gates && finalGate.gates.find((g) => g.key === 'official_pdf_available' && g.ok) && finalGate.gates.find((g) => g.key === 'checksum_recorded' && g.ok)) },
    { key: 'coordinates_locked', label: 'Coordinate lock complete', ok: Boolean(finalGate.gates && finalGate.gates.find((g) => g.key === 'coordinates_locked' && g.ok)) },
    { key: 'fill_engine_ready', label: 'Fill engine has passed release review', ok: Boolean(fillEngine.gates && fillEngine.gates.find((g) => g.key === 'professional_release_signoff' && g.ok)) },
    { key: 'official_sample_ready', label: 'Official sample visual comparison passed', ok: Boolean(officialSample.client_final_output_allowed) },
    { key: 'production_release_allowed', label: 'Production security/payment/release gates allow release', ok: false }
  ];
  const blockers = gates.filter((g) => !g.ok).map((g) => g.key);
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_CLIENT_RELEASE_POLICY,
    case_id: caseId,
    required_professional_level: requiredProfessional,
    client_verification: clientVerification ? { id: clientVerification.id, status: clientVerification.status, verified_at: clientVerification.verified_at } : null,
    professional_release_event: releaseEvent ? { id: releaseEvent.id, status: releaseEvent.status, professional_id: releaseEvent.professional_id, released_at: releaseEvent.released_at || releaseEvent.created_at } : null,
    professional_signoff: finalReleaseSignoff ? { id: finalReleaseSignoff.id, signoff_type: finalReleaseSignoff.signoff_type, professional_role_label: finalReleaseSignoff.professional_role_label, signed_at: finalReleaseSignoff.signed_at } : null,
    gates,
    blockers,
    print_signature_draft_allowed: gates.filter((g) => ['client_values_verified', 'professional_assigned', 'professional_release_signoff'].includes(g.key)).every((g) => g.ok),
    final_client_irs_output_allowed: false,
    official_preview_status: officialPreview.preview_status,
    release_message: blockers.length ? 'Form 9465 remains blocked from final client IRS output. Staff may prepare an internal or controlled print/signature review packet only when client verification and professional release are present.' : 'Client/professional release gates are satisfied, but final client IRS output still depends on production and official-PDF gates.'
  };
}

function record9465ProfessionalReleaseStatus(store, taxCase = {}, payload = {}, actor = {}) {
  const allowed = new Set(RELEASE_STATUS_VALUES);
  const status = allowed.has(String(payload.status || '')) ? String(payload.status) : 'professional_release_requested';
  const record = store.insert('form_9465_release_events', {
    id: `9465release_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    case_id: taxCase.id || '',
    event_type: status.includes('professional_release') ? 'professional_release' : 'release_gate_status',
    status,
    professional_id: text(payload.professional_id || taxCase.assigned_professional_id || '', 120),
    professional_role: text(payload.professional_role || taxCase.assigned_professional_role || taxCase.assigned_professional_role_key || '', 120),
    release_scope: text(payload.release_scope || 'IRS Form 9465 print/signature draft readiness review only.', 1500),
    limitations: text(payload.limitations || 'Release does not guarantee IRS acceptance, installment agreement approval, account resolution, or agency outcome. Client must review before signing/submission.', 2000),
    notes: text(payload.notes || '', 2000),
    client_output_allowed: false,
    print_signature_draft_allowed: status === 'professional_released_for_print_signature_draft',
    released_at: status === 'professional_released_for_print_signature_draft' ? new Date().toISOString() : '',
    staff_id: actor.id || 'staff',
    created_at: new Date().toISOString()
  });
  if (taxCase.id) {
    store.update('cases', taxCase.id, {
      form_9465_professional_release_status: status,
      form_9465_professional_release_event_id: record.id,
      form_9465_print_signature_draft_allowed: record.print_signature_draft_allowed,
      release_status: status === 'professional_released_for_print_signature_draft' ? 'professional_released_for_print_signature_draft_pending_final_output_gates' : status
    });
  }
  return record;
}

function build9465PrintSignatureDraftReadiness(store, taxCase = {}, answers = {}) {
  const checklist = build9465ClientVerificationChecklist(answers, store, { caseId: taxCase.id });
  const gate = build9465ProfessionalReleaseGate(store, taxCase, answers);
  const blockers = Array.from(new Set([
    ...checklist.required_missing.map((item) => `client_missing_${item.key}`),
    ...gate.blockers
  ]));
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_CLIENT_RELEASE_POLICY,
    case_id: taxCase.id || '',
    client_verification_status: checklist.status,
    professional_release_status: gate.professional_release_event ? gate.professional_release_event.status : 'not_recorded',
    print_signature_draft_allowed: Boolean(checklist.required_missing.length === 0 && gate.print_signature_draft_allowed),
    final_client_irs_output_allowed: false,
    blockers,
    next_actions: blockers.length ? blockers.map((b) => `Resolve ${b.replace(/_/g, ' ')}.`) : ['Generate a controlled print/signature draft packet for client review only. Do not submit until final official output gates pass.'],
    checklist,
    professional_gate: gate
  };
}

async function create9465PrintSignatureDraftPacketPdfBuffer({ answers = {}, store, taxCase = {}, actor = {} } = {}) {
  const readiness = build9465PrintSignatureDraftReadiness(store, taxCase, answers);
  const preview = build9465OfficialSampleOutputPreview(answers, store);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 44 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('Justice Tax Solutions — IRS Form 9465 Print/Signature Draft Release Packet');
    doc.moveDown(0.4).fontSize(9).fillColor('#8b1e1e').text('CONTROLLED REVIEW PACKET — NOT A FINAL IRS FILING COPY — CLIENT MUST REVIEW BEFORE SIGNING OR SUBMITTING');
    doc.moveDown(0.4).fillColor('#111').fontSize(10).text(`Version: ${VERSION}`);
    doc.text(`Case: ${taxCase.id || 'ad hoc sample'}`);
    doc.text(`Print/signature draft allowed by client/professional gates: ${readiness.print_signature_draft_allowed ? 'yes' : 'no'}`);
    doc.text(`Final client IRS output allowed: NO`);
    doc.moveDown().fontSize(12).text('Client verification status', { underline: true });
    for (const item of readiness.checklist.items) {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).fillColor(item.satisfied ? '#0d5c38' : (item.required_now ? '#8b1e1e' : '#555')).text(`${item.satisfied ? '✓' : (item.required_now ? '□' : '–')} ${item.label}`);
    }
    doc.addPage().fillColor('#111').fontSize(12).text('Professional release gate', { underline: true });
    for (const gate of readiness.professional_gate.gates) {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).fillColor(gate.ok ? '#0d5c38' : '#8b1e1e').text(`${gate.ok ? '✓' : '□'} ${gate.label}`);
    }
    doc.moveDown().fillColor('#111').fontSize(12).text('Preview values for staff/client review', { underline: true });
    (preview.populated_fields_preview || []).slice(0, 80).forEach((field) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(7.5).text(`Line ${field.line || ''} · ${field.input_key || ''}: ${field.value || ''}`);
    });
    doc.addPage().fontSize(12).text('Release limitations and signing instructions', { underline: true });
    [
      'This packet is for review and controlled print/signature readiness only.',
      'Signature and date fields must remain blank until the taxpayer/spouse personally reviews the final printed form.',
      'Direct debit routing/account information must be explicitly confirmed by the client or left blank.',
      'Government-only/officer-only sections must stay blank.',
      'No approval, payment-plan acceptance, relief, deadline, refund, or agency outcome is guaranteed.',
      'Do not submit to the IRS until the official PDF output, coordinate lock, professional release, client review, payment/security, and operating gates are complete.'
    ].forEach((line) => doc.fontSize(9).text(`• ${line}`));
    if (actor && actor.email) doc.moveDown().fontSize(8).text(`Generated by: ${actor.email}`);
    doc.end();
  });
}

function build9465ReleaseGateBoard(store) {
  const clientRecords = store && store.list ? store.list('form_9465_client_verifications', (r) => !r.deleted_at).slice(0, 100) : [];
  const releaseEvents = store && store.list ? store.list('form_9465_release_events', (r) => !r.deleted_at).slice(0, 100) : [];
  const cases = store && store.list ? store.list('cases', (c) => !c.deleted_at).slice(0, 100) : [];
  const byStatus = releaseEvents.reduce((acc, e) => { acc[e.status || 'unknown'] = (acc[e.status || 'unknown'] || 0) + 1; return acc; }, {});
  return {
    version: VERSION,
    form: IRS_9465_CAPTURE_PROFILE,
    policy: FORM_9465_CLIENT_RELEASE_POLICY,
    summary: {
      client_verification_records: clientRecords.length,
      release_events: releaseEvents.length,
      by_release_status: byStatus,
      cases_with_9465_release_tracking: cases.filter((c) => c.form_9465_client_verification_status || c.form_9465_professional_release_status).length,
      final_client_irs_output_allowed: false
    },
    board_columns: ['client_verification_sent', 'client_values_verified', 'professional_release_requested', 'professional_released_for_print_signature_draft', 'blocked_needs_official_pdf_coordinate_lock', 'blocked_needs_production_security'],
    client_records: clientRecords.map((r) => ({ id: r.id, case_id: r.case_id, status: r.status, verified_at: r.verified_at, required_missing_count: (r.required_missing || []).length })),
    release_events: releaseEvents.map((r) => ({ id: r.id, case_id: r.case_id, status: r.status, professional_id: r.professional_id, print_signature_draft_allowed: r.print_signature_draft_allowed, created_at: r.created_at })),
    final_output_gate: build9465FinalOutputGateReport(store)
  };
}

module.exports = {
  FORM_9465_CLIENT_RELEASE_POLICY,
  CLIENT_VERIFICATION_ITEMS,
  RELEASE_STATUS_VALUES,
  build9465ClientVerificationChecklist,
  create9465ClientVerificationRecord,
  build9465ProfessionalReleaseGate,
  record9465ProfessionalReleaseStatus,
  build9465PrintSignatureDraftReadiness,
  create9465PrintSignatureDraftPacketPdfBuffer,
  build9465ReleaseGateBoard
};
