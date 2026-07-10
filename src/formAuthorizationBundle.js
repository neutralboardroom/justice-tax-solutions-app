const PDFDocument = require('pdfkit');

const VERSION = '0.1.56';

const AUTHORIZATION_OUTPUT_POLICY = {
  goal: 'Add controlled, user-completable organizers and logical field maps for IRS authorization forms without enabling unsafe final IRS submission, representation, or signature output.',
  current_site_mode: 'organizer_only_no_sensitive_required',
  allowed_before_final_qa: [
    'plain-English Form 2848 and Form 8821 fit guidance',
    'no-sensitive organizer mode using last-4 identifiers or placeholders',
    'logical official section and line maps from IRS forms/instructions',
    'missing-information checklist and professional-credential triggers',
    'internal/staff verification sheets and draft QA packets using redacted or sample values'
  ],
  blocked_until_final_qa: [
    'final official IRS Form 2848 or Form 8821 output for taxpayer signature',
    'IRS submission, fax, mail, upload, Tax Pro Account, or CAF-recording claims',
    'full SSN/ITIN/EIN collection in public mode',
    'taxpayer or representative electronic signature workflow',
    'representation claims unless the representative is eligible and assigned',
    'requesting confidential tax information from the IRS until authorization and identity controls are complete'
  ],
  professional_review_default: 'Form 2848 should be reviewed by staff and an eligible representative before release; Form 8821 should be reviewed before any designee is authorized to receive confidential tax information.'
};

const IRS_AUTHORIZATION_SOURCES = {
  '2848': {
    agency: 'IRS',
    form_number: '2848',
    title: 'Power of Attorney and Declaration of Representative',
    revision: 'Rev. January 2021',
    instructions_revision: 'Rev. September 2021',
    source_url: 'https://www.irs.gov/pub/irs-pdf/f2848.pdf',
    instructions_url: 'https://www.irs.gov/pub/irs-pdf/i2848.pdf',
    source_page_url: 'https://www.irs.gov/forms-instructions',
    pages: 2,
    status: 'official_source_identified_logical_map_ready',
    purpose: 'Authorizes an eligible individual to represent a taxpayer before the IRS for listed matters and periods.',
    client_output_rule: 'Form 2848 may be organized through the website, but final IRS-ready output remains blocked until official PDF capture/checksum, field/coordinate lock, sample QA, client verification, representative eligibility review, signature controls, and staff/professional release pass.'
  },
  '8821': {
    agency: 'IRS',
    form_number: '8821',
    title: 'Tax Information Authorization',
    revision: 'Rev. January 2021',
    instructions_revision: 'Rev. September 2021',
    source_url: 'https://www.irs.gov/pub/irs-pdf/f8821.pdf',
    instructions_url: 'https://www.irs.gov/pub/irs-pdf/i8821.pdf',
    source_page_url: 'https://www.irs.gov/forms-instructions',
    pages: 1,
    status: 'official_source_identified_logical_map_ready',
    purpose: 'Authorizes listed designee(s) to inspect and/or receive confidential tax information, but does not authorize IRS representation.',
    client_output_rule: 'Form 8821 may be organized through the website, but final IRS-ready output remains blocked until official PDF capture/checksum, field/coordinate lock, sample QA, client verification, designee review, signature controls, and staff release pass.'
  }
};

function field(form, key, page, line, section, officialLabel, inputKey, type, required = false, extra = {}) {
  return {
    form,
    key,
    page,
    line,
    section,
    official_label: officialLabel,
    input_key: inputKey,
    value_type: type,
    required_for_organizer: Boolean(required),
    required_for_final_output: Boolean(extra.required_for_final_output === undefined ? required : extra.required_for_final_output),
    repeat_group: extra.repeat_group || '',
    row: extra.row || null,
    max_length: extra.max_length || null,
    formatting: extra.formatting || '',
    source: extra.source || 'client_interview',
    qa_rule: extra.qa_rule || 'client and staff must verify before print/signature',
    sensitive: Boolean(extra.sensitive),
    signature_or_perjury: Boolean(extra.signature_or_perjury),
    final_only: Boolean(extra.final_only),
    conditional: extra.conditional || null,
    official_pdf_field_name: extra.official_pdf_field_name || '',
    mapping_status: extra.mapping_status || 'logical_map_ready_needs_official_pdf_field_or_coordinate_confirmation'
  };
}

function repeatFields(form, prefix, count, names, page, line, section, labels, types, extraByName = {}) {
  const out = [];
  for (let i = 1; i <= count; i += 1) {
    names.forEach((name, idx) => {
      out.push(field(form, `${prefix}_${i}_${name}`, page, line, `${section} ${i}`, labels[idx], `${prefix}_${i}_${name}`, types[idx], false, {
        repeat_group: prefix,
        row: i,
        ...(extraByName[name] || {})
      }));
    });
  }
  return out;
}

const IRS_2848_FIELD_MAP = [
  field('2848', 'taxpayer_name_address', 1, '1', 'Taxpayer information', 'Taxpayer name and address', 'taxpayer_name_address', 'long_text', true, { max_length: 240 }),
  field('2848', 'taxpayer_tin', 1, '1', 'Taxpayer information', 'Taxpayer identification number(s)', 'taxpayer_tin', 'tin', false, { sensitive: true, final_only: true, formatting: 'SSN/ITIN/EIN; not collected in public mode', required_for_final_output: true }),
  field('2848', 'taxpayer_last4', 1, '1', 'Taxpayer information', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer_last4', 'text', false, { formatting: '####', source: 'client_interview_safe_mode', required_for_final_output: false }),
  field('2848', 'daytime_phone', 1, '1', 'Taxpayer information', 'Daytime telephone number', 'daytime_phone', 'phone', true),
  field('2848', 'plan_number', 1, '1', 'Taxpayer information', 'Plan number (if applicable)', 'plan_number', 'text', false),
  ...repeatFields('2848', 'representative', 4, ['name_address', 'receive_notices', 'caf_no', 'ptin', 'telephone_no', 'fax_no', 'new_address', 'new_telephone', 'new_fax'], 1, '2', 'Representative', ['Name and address', 'Check if to be sent copies of notices and communications', 'CAF No.', 'PTIN', 'Telephone No.', 'Fax No.', 'Check if new: Address', 'Check if new: Telephone No.', 'Check if new: Fax No.'], ['long_text', 'checkbox', 'text', 'ptin', 'phone', 'phone', 'checkbox', 'checkbox', 'checkbox'], { ptin: { sensitive: true, final_only: true, required_for_final_output: true } }),
  ...repeatFields('2848', 'matter', 4, ['description', 'tax_form_number', 'years_or_periods'], 1, '3', 'Acts authorized matter row', ['Description of Matter', 'Tax Form Number', 'Year(s) or Period(s)'], ['text', 'text', 'text'], { description: { required_for_final_output: true }, tax_form_number: { required_for_final_output: true }, years_or_periods: { required_for_final_output: true } }),
  field('2848', 'specific_use_not_caf', 1, '4', 'Specific use not recorded on CAF', 'Specific use not recorded on the Centralized Authorization File (CAF)', 'specific_use_not_caf', 'checkbox', false),
  field('2848', 'access_irs_records_isp', 1, '5a', 'Additional acts authorized', 'Access my IRS records via an Intermediate Service Provider', 'access_irs_records_isp', 'checkbox', false, { conditional: 'additional_authority_requested' }),
  field('2848', 'authorize_disclosure_to_third_parties', 1, '5a', 'Additional acts authorized', 'Authorize disclosure to third parties', 'authorize_disclosure_to_third_parties', 'checkbox', false, { conditional: 'additional_authority_requested' }),
  field('2848', 'substitute_or_add_representatives', 1, '5a', 'Additional acts authorized', 'Substitute or add representative(s)', 'substitute_or_add_representatives', 'checkbox', false, { conditional: 'additional_authority_requested' }),
  field('2848', 'sign_a_return', 1, '5a', 'Additional acts authorized', 'Sign a return', 'sign_a_return', 'checkbox', false, { conditional: 'limited IRS situations only' }),
  field('2848', 'other_acts_authorized', 1, '5a', 'Additional acts authorized', 'Other acts authorized', 'other_acts_authorized', 'long_text', false, { max_length: 300 }),
  field('2848', 'specific_acts_not_authorized', 2, '5b', 'Specific acts not authorized', 'Specific acts not authorized / deletions', 'specific_acts_not_authorized', 'long_text', false, { max_length: 400 }),
  field('2848', 'retain_prior_power', 2, '6', 'Retention/revocation of prior powers', 'Retain prior power(s) of attorney', 'retain_prior_power', 'checkbox', false),
  field('2848', 'taxpayer_signature', 2, '7', 'Taxpayer declaration and signature', 'Signature', 'taxpayer_signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('2848', 'taxpayer_signature_date', 2, '7', 'Taxpayer declaration and signature', 'Date', 'taxpayer_signature_date', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('2848', 'taxpayer_title', 2, '7', 'Taxpayer declaration and signature', 'Title (if applicable)', 'taxpayer_title', 'text', false),
  field('2848', 'taxpayer_print_name', 2, '7', 'Taxpayer declaration and signature', 'Print name', 'taxpayer_print_name', 'text', false, { required_for_final_output: true }),
  field('2848', 'other_taxpayer_print_name', 2, '7', 'Taxpayer declaration and signature', 'Print name of taxpayer from line 1 if other than individual', 'other_taxpayer_print_name', 'text', false, { conditional: 'signer is not individual taxpayer' }),
  ...repeatFields('2848', 'declaration', 4, ['designation', 'licensing_jurisdiction', 'license_registration_number', 'signature', 'date'], 2, 'Part II', 'Declaration of Representative', ['Designation letter (a-r)', 'Licensing jurisdiction or authority', 'Bar/license/certification/registration/enrollment number', 'Representative signature', 'Date'], ['text', 'text', 'text', 'signature', 'date'], { signature: { signature_or_perjury: true, final_only: true, required_for_final_output: true }, date: { signature_or_perjury: true, final_only: true, required_for_final_output: true } })
];

const IRS_8821_FIELD_MAP = [
  field('8821', 'taxpayer_name_address', 1, '1', 'Taxpayer information', 'Taxpayer name and address', 'taxpayer_name_address', 'long_text', true, { max_length: 240 }),
  field('8821', 'taxpayer_tin', 1, '1', 'Taxpayer information', 'Taxpayer identification number(s)', 'taxpayer_tin', 'tin', false, { sensitive: true, final_only: true, formatting: 'SSN/ITIN/EIN; not collected in public mode', required_for_final_output: true }),
  field('8821', 'taxpayer_last4', 1, '1', 'Taxpayer information', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer_last4', 'text', false, { formatting: '####', source: 'client_interview_safe_mode', required_for_final_output: false }),
  field('8821', 'daytime_phone', 1, '1', 'Taxpayer information', 'Daytime telephone number', 'daytime_phone', 'phone', true),
  field('8821', 'plan_number', 1, '1', 'Taxpayer information', 'Plan number (if applicable)', 'plan_number', 'text', false),
  field('8821', 'additional_designee_list_attached', 1, '2', 'Designee(s)', 'Check here if list of additional designees is attached', 'additional_designee_list_attached', 'checkbox', false),
  ...repeatFields('8821', 'designee', 2, ['name_address', 'receive_notices', 'caf_no', 'ptin', 'telephone_no', 'fax_no', 'new_address', 'new_telephone', 'new_fax'], 1, '2', 'Designee', ['Name and address', 'Check if to be sent copies of notices and communications', 'CAF No.', 'PTIN', 'Telephone No.', 'Fax No.', 'Check if new: Address', 'Check if new: Telephone No.', 'Check if new: Fax No.'], ['long_text', 'checkbox', 'text', 'ptin', 'phone', 'phone', 'checkbox', 'checkbox', 'checkbox'], { ptin: { sensitive: true, final_only: true } }),
  field('8821', 'access_irs_records_isp', 1, '3', 'Tax information', 'Authorize access to IRS records via an Intermediate Service Provider', 'access_irs_records_isp', 'checkbox', false),
  ...repeatFields('8821', 'tax_info', 4, ['type', 'tax_form_number', 'years_or_periods', 'specific_matters'], 1, '3', 'Tax information row', ['Type of Tax Information', 'Tax Form Number', 'Year(s) or Period(s)', 'Specific Tax Matters'], ['text', 'text', 'text', 'text'], { type: { required_for_final_output: true }, tax_form_number: { required_for_final_output: true }, years_or_periods: { required_for_final_output: true } }),
  field('8821', 'specific_use_not_caf', 1, '4', 'Specific use not recorded on CAF', 'Specific use not recorded on the Centralized Authorization File (CAF)', 'specific_use_not_caf', 'checkbox', false),
  field('8821', 'retain_prior_authorizations', 1, '5', 'Retention/revocation of prior authorizations', 'Retain prior tax information authorization(s)', 'retain_prior_authorizations', 'checkbox', false),
  field('8821', 'taxpayer_signature', 1, '6', 'Taxpayer signature', 'Signature', 'taxpayer_signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('8821', 'taxpayer_signature_date', 1, '6', 'Taxpayer signature', 'Date', 'taxpayer_signature_date', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('8821', 'taxpayer_print_name', 1, '6', 'Taxpayer signature', 'Print Name', 'taxpayer_print_name', 'text', false, { required_for_final_output: true }),
  field('8821', 'taxpayer_title', 1, '6', 'Taxpayer signature', 'Title (if applicable)', 'taxpayer_title', 'text', false)
];

const AUTH_FIELD_MAPS = { '2848': IRS_2848_FIELD_MAP, '8821': IRS_8821_FIELD_MAP };

const AUTH_SAMPLE_CASES = {
  '2848': [
    {
      key: 'individual_collection_review',
      label: 'Individual tax-debt case needing EA/CPA representative review',
      answers: {
        taxpayer_name_address: 'Sample Client, 123 Main St, Albany, NY 12207',
        taxpayer_last4: '1234',
        daytime_phone: '555-0100',
        representative_1_name_address: 'Sample EA, Justice Tax Solutions review roster',
        matter_1_description: 'Income tax collection / payment plan support',
        matter_1_tax_form_number: '1040',
        matter_1_years_or_periods: '2022, 2023',
        declaration_1_designation: 'c',
        declaration_1_licensing_jurisdiction: 'IRS',
        taxpayer_print_name: 'Sample Client'
      }
    }
  ],
  '8821': [
    {
      key: 'transcript_review_authorization',
      label: 'Tax information access organizer for transcript/notice review',
      answers: {
        taxpayer_name_address: 'Sample Client, 123 Main St, Albany, NY 12207',
        taxpayer_last4: '1234',
        daytime_phone: '555-0100',
        designee_1_name_address: 'Justice Tax Solutions review team / assigned designee pending credential check',
        tax_info_1_type: 'Income',
        tax_info_1_tax_form_number: '1040',
        tax_info_1_years_or_periods: '2021-2023',
        tax_info_1_specific_matters: 'Account transcripts, wage/income transcripts, notice review',
        taxpayer_print_name: 'Sample Client'
      }
    }
  ]
};

function getAuthForm(formNumber) {
  const key = normalizeFormNumber(formNumber);
  const source = IRS_AUTHORIZATION_SOURCES[key];
  if (!source) throw new Error('Unsupported IRS authorization form. Supported forms: 2848, 8821.');
  return { key, source, fieldMap: AUTH_FIELD_MAPS[key] };
}

function normalizeFormNumber(value) {
  return String(value || '').toLowerCase().replace(/^form\s*/, '').replace(/[^0-9]/g, '');
}

function has(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function boolLike(value) {
  return value === true || value === 'true' || value === 'on' || value === 'yes' || value === '1';
}

function safePreview(value) {
  if (!has(value)) return '';
  let s = String(value).replace(/\s+/g, ' ').trim();
  if (/\d{3}-?\d{2}-?\d{4}/.test(s) || /\d{2}-?\d{7}/.test(s)) return '[sensitive identifier hidden]';
  if (s.length > 90) s = `${s.slice(0, 87)}...`;
  return s;
}

function buildAuthorizationFieldMapReport(formNumber) {
  const { key, source, fieldMap } = getAuthForm(formNumber);
  const sections = Array.from(new Map(fieldMap.map((f) => [f.section, fieldMap.filter((x) => x.section === f.section).length])).entries()).map(([section, field_count]) => ({ section, field_count }));
  return {
    ok: true,
    version: VERSION,
    source,
    policy: AUTHORIZATION_OUTPUT_POLICY,
    summary: {
      form: key,
      total_fields: fieldMap.length,
      sensitive_fields: fieldMap.filter((f) => f.sensitive).length,
      signature_fields: fieldMap.filter((f) => f.signature_or_perjury).length,
      final_only_fields: fieldMap.filter((f) => f.final_only).length,
      sections: sections.length,
      mapping_status: 'logical_map_ready_needs_pdf_field_or_coordinate_confirmation'
    },
    sections,
    fields: fieldMap
  };
}

function buildAuthorizationOrganizerSchema(formNumber) {
  const report = buildAuthorizationFieldMapReport(formNumber);
  return {
    ok: true,
    version: VERSION,
    form: report.source,
    policy: AUTHORIZATION_OUTPUT_POLICY,
    public_mode_warning: 'Do not enter full SSNs, ITINs, EINs, PTINs, signatures, dates, or confidential account data in public mode. Use last 4 or placeholders until production sensitive-data controls are approved.',
    fields: report.fields.filter((f) => !f.final_only).map((f) => ({
      input_key: f.input_key,
      label: f.official_label,
      section: f.section,
      type: f.value_type,
      required: f.required_for_organizer,
      sensitive: f.sensitive,
      help: f.sensitive ? 'Use last 4 or leave blank in current public mode.' : f.qa_rule
    }))
  };
}

function validateAuthorizationAnswers(formNumber, answers = {}) {
  const { key, fieldMap } = getAuthForm(formNumber);
  const missing = [];
  const warnings = [];
  const errors = [];
  fieldMap.filter((f) => f.required_for_organizer).forEach((f) => {
    if (!has(answers[f.input_key])) missing.push({ input_key: f.input_key, label: f.official_label, section: f.section });
  });
  if (!has(answers.taxpayer_last4) && !has(answers.taxpayer_tin)) warnings.push('Taxpayer identifier is not supplied. In public mode, last 4 is enough for organizer; final IRS output requires full verified TIN under approved security controls.');
  if (has(answers.taxpayer_tin) && !/^([0-9]{3}-?[0-9]{2}-?[0-9]{4}|[0-9]{2}-?[0-9]{7}|[0-9]{9})$/.test(String(answers.taxpayer_tin).trim())) errors.push({ input_key: 'taxpayer_tin', label: 'Taxpayer identification number(s)', message: 'TIN format should be SSN/ITIN/EIN-like for final output; do not collect full TIN in current public mode.' });
  if (key === '2848') {
    if (!has(answers.representative_1_name_address)) warnings.push('Representative is not identified yet. Staff must assign or verify an eligible representative before any Form 2848 release.');
    if (!has(answers.matter_1_description) || !has(answers.matter_1_tax_form_number) || !has(answers.matter_1_years_or_periods)) missing.push({ input_key: 'matter_1', label: 'At least one authorized matter/form/year row', section: 'Acts authorized' });
    if (boolLike(answers.sign_a_return)) warnings.push('Signing a return is a special additional act and should not be enabled without professional/legal review of IRS limits.');
    if (boolLike(answers.authorize_disclosure_to_third_parties)) warnings.push('Third-party disclosure authority requires careful review and client confirmation.');
  }
  if (key === '8821') {
    if (!has(answers.designee_1_name_address)) warnings.push('Designee is not identified yet. Staff must verify who will receive confidential tax information before release.');
    if (!has(answers.tax_info_1_type) || !has(answers.tax_info_1_tax_form_number) || !has(answers.tax_info_1_years_or_periods)) missing.push({ input_key: 'tax_info_1', label: 'At least one tax information/form/year row', section: 'Tax information' });
  }
  if (boolLike(answers.access_irs_records_isp)) warnings.push('Intermediate Service Provider access is sensitive and should remain off unless an approved workflow exists.');
  if (boolLike(answers.retain_prior_power) || boolLike(answers.retain_prior_authorizations)) warnings.push('Retaining prior authorizations requires attached prior authorization copies and staff review.');
  return { ok: missing.length === 0 && errors.length === 0, missing, warnings, errors };
}

function buildAuthorizationReviewTriggers(formNumber, answers = {}) {
  const { key } = getAuthForm(formNumber);
  const triggers = [];
  if (key === '2848') {
    triggers.push({ key: 'eligible_representative_required', label: 'Form 2848 authorizes IRS representation; eligible representative credentials must be verified before release.', required_before_release: true });
    if (!has(answers.declaration_1_designation)) triggers.push({ key: 'designation_missing', label: 'Representative designation/declaration is missing.', required_before_release: true });
    if (boolLike(answers.sign_a_return)) triggers.push({ key: 'sign_return_review', label: 'Authority to sign a return is limited and requires review before release.', required_before_release: true });
  }
  if (key === '8821') {
    triggers.push({ key: 'confidential_tax_information', label: 'Form 8821 authorizes access to confidential tax information; designee identity and scope must be reviewed before release.', required_before_release: true });
    if (boolLike(answers.additional_designee_list_attached)) triggers.push({ key: 'additional_designees', label: 'Additional designee list needs attachment and staff review.', required_before_release: true });
  }
  if (boolLike(answers.access_irs_records_isp)) triggers.push({ key: 'intermediate_service_provider', label: 'IRS records access via Intermediate Service Provider requires a separately approved workflow.', required_before_release: true });
  if (boolLike(answers.specific_use_not_caf)) triggers.push({ key: 'specific_use_not_caf', label: 'Specific-use-not-CAF cases must be routed to the IRS office handling the specific matter.', required_before_release: true });
  return triggers;
}

function buildAuthorizationCompletionPlan(formNumber, answers = {}, options = {}) {
  const { key, source, fieldMap } = getAuthForm(formNumber);
  const validation = validateAuthorizationAnswers(key, answers);
  const officialPdfCaptured = Boolean(options.officialPdfCaptured || options.sourceRecord?.pdf_capture_status === 'captured' || options.officialForm?.sha256);
  const mappingVerified = Boolean(options.mappingVerified || ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(options.sourceRecord?.mapping_status || options.officialForm?.mapping_status || '')));
  const qaPassed = Boolean(options.qaPassed || options.officialForm?.sample_fill_status === 'passed' || options.sourceRecord?.sample_fill_status === 'passed');
  const clientVerified = options.clientVerified === true;
  const staffReleased = options.staffReleased === true || options.professionalReleased === true;
  const productionSensitiveGate = options.productionSensitiveGate === true;
  const signatureControlsApproved = options.signatureControlsApproved === true;
  const reviewTriggers = buildAuthorizationReviewTriggers(key, answers);
  const clientAnswersComplete = validation.missing.length === 0 && validation.errors.length === 0;
  const officialClientOutputAllowed = officialPdfCaptured && mappingVerified && qaPassed && clientAnswersComplete && clientVerified && staffReleased && productionSensitiveGate && signatureControlsApproved && reviewTriggers.filter((t) => t.required_before_release).length === 0;
  const blockedReasons = [];
  if (!officialPdfCaptured) blockedReasons.push(`Official IRS Form ${key} PDF has not been captured/checksummed in the app.`);
  if (!mappingVerified) blockedReasons.push('PDF field names or overlay coordinates are not verified.');
  if (!qaPassed) blockedReasons.push('Sample-fill visual QA has not passed.');
  if (!clientAnswersComplete) blockedReasons.push('Organizer answers are missing or invalid.');
  if (!clientVerified) blockedReasons.push('Client verification of every value has not been recorded.');
  if (!staffReleased) blockedReasons.push('Staff/professional release has not been recorded.');
  if (!productionSensitiveGate) blockedReasons.push('Production sensitive-data gate is not approved for full TIN/PTIN/signature handling.');
  if (!signatureControlsApproved) blockedReasons.push('Remote/electronic signature and identity controls are not approved.');
  reviewTriggers.filter((t) => t.required_before_release).forEach((t) => blockedReasons.push(t.label));
  return {
    ok: validation.ok,
    version: VERSION,
    form: source,
    policy: AUTHORIZATION_OUTPUT_POLICY,
    organizer_status: {
      client_can_complete_organizer_now: clientAnswersComplete,
      current_site_mode: AUTHORIZATION_OUTPUT_POLICY.current_site_mode,
      answered_mapped_fields: fieldMap.filter((f) => has(answers[f.input_key])).length,
      total_mapped_fields: fieldMap.length,
      missing_required_count: validation.missing.length,
      validation_error_count: validation.errors.length,
      warning_count: validation.warnings.length
    },
    field_candidates: fieldMap.map((f) => ({
      key: f.key,
      page: f.page,
      line: f.line,
      section: f.section,
      official_label: f.official_label,
      input_key: f.input_key,
      value_present: has(answers[f.input_key]),
      value_preview: safePreview(answers[f.input_key]),
      sensitive: f.sensitive,
      signature_or_perjury: f.signature_or_perjury,
      mapping_status: f.mapping_status,
      verification_status: has(answers[f.input_key]) ? 'needs_client_verification' : 'missing_or_not_applicable'
    })),
    validation,
    review_triggers: reviewTriggers,
    output_gate: {
      official_pdf_captured: officialPdfCaptured,
      mapping_verified: mappingVerified,
      sample_fill_qa_passed: qaPassed,
      client_answers_complete: clientAnswersComplete,
      client_verification_recorded: clientVerified,
      staff_or_professional_release_recorded: staffReleased,
      production_sensitive_gate_approved: productionSensitiveGate,
      signature_controls_approved: signatureControlsApproved,
      organizer_only_allowed: clientAnswersComplete,
      official_client_output_allowed: officialClientOutputAllowed,
      current_status: officialClientOutputAllowed ? 'eligible_for_final_staff_controlled_output' : 'organizer_ready_or_blocked_until_mapping_qa_review_signature_security_gates_pass',
      blocked_reasons: blockedReasons
    },
    next_actions: buildAuthorizationNextActions(validation, { officialPdfCaptured, mappingVerified, qaPassed, clientAnswersComplete, clientVerified, staffReleased, productionSensitiveGate, signatureControlsApproved, reviewTriggers })
  };
}

function buildAuthorizationNextActions(validation, gates) {
  const actions = [];
  if (validation.missing.length) actions.push({ owner: 'client_organizer', priority: 1, action: `Answer ${validation.missing.length} required organizer question(s).`, items: validation.missing });
  if (validation.errors.length) actions.push({ owner: 'client_organizer', priority: 1, action: `Fix ${validation.errors.length} invalid value(s).`, items: validation.errors });
  if (validation.warnings.length) actions.push({ owner: 'staff_or_ai_followup', priority: 2, action: `Review ${validation.warnings.length} warning(s) and ask targeted follow-ups.`, items: validation.warnings });
  if (!gates.officialPdfCaptured) actions.push({ owner: 'mapping_qa', priority: 2, action: 'Capture/checksum the official IRS PDF from irs.gov.' });
  if (!gates.mappingVerified) actions.push({ owner: 'mapping_qa', priority: 2, action: 'Extract/confirm PDF field names or lock overlay coordinates for every mapped field.' });
  if (!gates.qaPassed) actions.push({ owner: 'mapping_qa', priority: 2, action: 'Generate and visually inspect sample-filled PDFs for overflow, checkboxes, page placement, and blank signature fields.' });
  if (!gates.productionSensitiveGate) actions.push({ owner: 'owner_security', priority: 3, action: 'Keep full TIN/PTIN/signature handling blocked until production sensitive-data controls are approved.' });
  if (!gates.signatureControlsApproved) actions.push({ owner: 'owner_security', priority: 3, action: 'Approve identity and signature controls before any signed authorization release.' });
  const review = (gates.reviewTriggers || []).filter((t) => t.required_before_release);
  if (review.length) actions.push({ owner: 'staff_or_professional', priority: 3, action: `Resolve ${review.length} authorization review trigger(s).`, items: review });
  if (!gates.clientVerified) actions.push({ owner: 'client', priority: 4, action: 'Client must verify every completed value before signature or release.' });
  if (!gates.staffReleased) actions.push({ owner: 'staff_or_professional', priority: 4, action: 'Record staff/professional release before any final official output.' });
  return actions.sort((a, b) => a.priority - b.priority);
}

function buildAuthorizationOutputReadiness(formNumber, { store } = {}) {
  const { key, source, fieldMap } = getAuthForm(formNumber);
  const sourceRecords = store && store.list ? store.list('official_form_sources', (s) => !s.deleted_at && s.agency === 'IRS' && normalizeFormNumber(s.form_number) === key) : [];
  const officialForms = store && store.list ? store.list('official_forms', (f) => !f.deleted_at && f.agency === 'IRS' && normalizeFormNumber(f.form_number) === key) : [];
  const captured = sourceRecords.filter((s) => s.pdf_capture_status === 'captured').length + officialForms.filter((f) => f.storage_path || f.sha256).length;
  const mapped = sourceRecords.filter((s) => ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(s.mapping_status || ''))).length + officialForms.filter((f) => ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(f.mapping_status || ''))).length;
  const checks = [
    { key: 'official_source_identified', label: 'Official IRS source identified', ok: true, detail: source.source_url },
    { key: 'logical_field_map', label: 'Logical official section/line map exists', ok: true, detail: `${fieldMap.length} mapped candidate fields` },
    { key: 'official_pdf_captured', label: 'Official PDF captured/checksummed inside app', ok: captured > 0, detail: captured > 0 ? `${captured} record(s)` : 'not captured yet' },
    { key: 'mapping_verified', label: 'PDF field names or overlay coordinates verified', ok: mapped > 0, detail: mapped > 0 ? `${mapped} verified record(s)` : 'logical map only' },
    { key: 'sample_visual_qa', label: 'Sample-filled visual QA passed', ok: false, detail: 'not run yet' },
    { key: 'client_verification', label: 'Client verification workflow recorded', ok: false, detail: 'blocked until final output phase' },
    { key: 'signature_identity_controls', label: 'Signature and identity controls approved', ok: false, detail: 'not approved in current controlled launch' },
    { key: 'sensitive_data_gate', label: 'Full TIN/PTIN/signature handling security approved', ok: false, detail: 'live sensitive uploads remain blocked' },
    { key: key === '2848' ? 'representative_eligibility' : 'designee_scope_review', label: key === '2848' ? 'Representative eligibility verified' : 'Designee scope and confidentiality review passed', ok: false, detail: 'staff/professional release required' }
  ];
  return {
    ok: true,
    version: VERSION,
    form: source,
    policy: AUTHORIZATION_OUTPUT_POLICY,
    summary: {
      form: key,
      total_fields: fieldMap.length,
      organizer_ready: true,
      client_output_ready: checks.every((c) => c.ok),
      passed: checks.filter((c) => c.ok).length,
      required_checks: checks.length
    },
    checks,
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label),
    source_records: sourceRecords.map((s) => ({ ...s, storage_path: undefined })),
    official_pdf_records: officialForms.map((f) => ({ ...f, storage_path: undefined })),
    release_rule: source.client_output_rule
  };
}

function buildAuthorizationSampleCases(formNumber) {
  const { key, source } = getAuthForm(formNumber);
  return { form: source, sample_cases: (AUTH_SAMPLE_CASES[key] || []).map((s) => ({ key: s.key, label: s.label, completion_plan: buildAuthorizationCompletionPlan(key, s.answers) })) };
}

function buildAuthorizationSampleFillAudit(formNumber, answers = {}, options = {}) {
  const plan = buildAuthorizationCompletionPlan(formNumber, answers, options);
  const qa = [
    { key: 'official_source', status: 'passed', note: `IRS source URL identified: ${plan.form.source_url}` },
    { key: 'logical_field_map', status: 'passed', note: `${plan.field_candidates.length} fields mapped to official sections/lines.` },
    { key: 'organizer_answers', status: plan.organizer_status.client_can_complete_organizer_now ? 'passed' : 'blocked', note: `${plan.validation.missing.length} required organizer answer(s) missing; ${plan.validation.errors.length} validation error(s).` },
    { key: 'sensitive_fields', status: 'blocked_in_public_mode', note: 'Full TIN/PTIN/signature/date fields remain final-only.' },
    { key: 'signature_fields', status: 'blank_required', note: 'Taxpayer and representative signatures/dates must remain blank until verification, identity controls, and release.' },
    { key: 'representation_or_confidentiality_review', status: 'required_before_release', note: 'Staff/professional review is required before any IRS authorization release.' },
    { key: 'final_client_output', status: plan.output_gate.official_client_output_allowed ? 'allowed_after_release' : 'blocked', note: plan.output_gate.blocked_reasons.join('; ') || 'ready' }
  ];
  return { ok: true, version: VERSION, form: plan.form, plan, qa, print_ready: plan.output_gate.official_client_output_allowed };
}

function buildAuthorizationVerificationSheet(formNumber, answers = {}, options = {}) {
  const plan = buildAuthorizationCompletionPlan(formNumber, answers, options);
  const grouped = {};
  plan.field_candidates.forEach((f) => {
    grouped[f.section] = grouped[f.section] || [];
    grouped[f.section].push({ page: f.page, line: f.line, label: f.official_label, input_key: f.input_key, value_preview: f.value_preview, present: f.value_present, verify: f.signature_or_perjury ? 'Must remain blank until final review/signature.' : 'Client and staff must confirm before final output.' });
  });
  return { ok: true, version: VERSION, form: plan.form, release_status: plan.output_gate.current_status, blocked_reasons: plan.output_gate.blocked_reasons, sections: grouped, warnings: plan.validation.warnings, errors: plan.validation.errors, missing: plan.validation.missing };
}

function createAuthorizationDraftPdfBuffer(formNumber, answers = {}, options = {}) {
  const plan = buildAuthorizationCompletionPlan(formNumber, answers, options);
  const doc = new PDFDocument({ size: 'LETTER', margin: 44, info: { Title: `IRS Form ${plan.form.form_number} Organizer QA Packet`, Author: 'Justice Tax Solutions' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(16).text('Justice Tax Solutions', { align: 'center' });
  doc.fontSize(13).text(`IRS Form ${plan.form.form_number} Organizer / QA Packet`, { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('red').text('Internal organizer/checklist only. This is not an official IRS authorization form, not an IRS submission, not a representation agreement, and not a final signature document. Final official output is blocked until official PDF, mapping, sample QA, client verification, signature/identity controls, staff/professional release, and sensitive-data gates pass.', { align: 'center' });
  doc.fillColor('black').moveDown();
  doc.fontSize(10).text(`Official source: ${plan.form.source_url}`);
  doc.text(`Organizer status: ${plan.organizer_status.client_can_complete_organizer_now ? 'Organizer answers complete' : 'Missing organizer answers'}`);
  doc.text(`Official client output: ${plan.output_gate.official_client_output_allowed ? 'allowed' : 'blocked'}`);
  doc.moveDown();
  doc.fontSize(12).text('Blocked reasons', { underline: true });
  (plan.output_gate.blocked_reasons.length ? plan.output_gate.blocked_reasons : ['No current blockers.']).forEach((item, i) => doc.fontSize(9).text(`${i + 1}. ${item}`));
  doc.addPage();
  doc.fontSize(13).text('Field candidates by official section', { underline: true });
  plan.field_candidates.forEach((f) => {
    if (doc.y > 720) doc.addPage();
    doc.fontSize(8).text(`P${f.page} L${f.line} · ${f.section} · ${f.official_label}: ${f.value_preview || '[blank / not supplied]'}`);
  });
  doc.addPage();
  doc.fontSize(13).text('QA checklist before any official output', { underline: true });
  buildAuthorizationSampleFillAudit(formNumber, answers, options).qa.forEach((item, idx) => doc.fontSize(9).text(`${idx + 1}. ${item.key}: ${item.status} - ${item.note}`));
  doc.end();
  return endPromise;
}

module.exports = {
  VERSION,
  AUTHORIZATION_OUTPUT_POLICY,
  IRS_AUTHORIZATION_SOURCES,
  IRS_2848_FIELD_MAP,
  IRS_8821_FIELD_MAP,
  buildAuthorizationFieldMapReport,
  buildAuthorizationOrganizerSchema,
  buildAuthorizationCompletionPlan,
  buildAuthorizationOutputReadiness,
  buildAuthorizationSampleCases,
  buildAuthorizationSampleFillAudit,
  buildAuthorizationVerificationSheet,
  createAuthorizationDraftPdfBuffer,
  validateAuthorizationAnswers
};
