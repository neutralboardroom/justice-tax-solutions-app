const PDFDocument = require('pdfkit');

const VERSION = '0.1.27';

const IRS_9465_OFFICIAL_SOURCE = {
  agency: 'IRS',
  form_number: '9465',
  title: 'Installment Agreement Request',
  revision: 'Rev. September 2020',
  source_url: 'https://www.irs.gov/pub/irs-pdf/f9465.pdf',
  source_page_url: 'https://www.irs.gov/forms-pubs/about-form-9465',
  instructions_url: 'https://www.irs.gov/instructions/i9465',
  pages: 2,
  status: 'official_source_identified',
  client_output_rule: 'The official form must be captured, checksummed, field-mapped, sample-filled, overflow/signature checked, client-verified, and released by the required reviewer before client-facing final output.'
};

const IRS_9465_OUTPUT_POLICY = {
  goal: 'Create the first controlled print-draft pathway for IRS Form 9465 while keeping final official-form output gated until PDF source, field map, QA, client verification, and required professional review are complete.',
  allowed_before_final_qa: [
    'AI interview and missing-information checklist',
    'source-linked field candidate map',
    'calculation draft for lines 7, 9, and 10',
    'sample QA packet using non-sensitive or redacted data',
    'client verification sheet for review before signing'
  ],
  blocked_until_final_qa: [
    'unstamped final official IRS Form 9465 for client signature',
    'agency submission or mailing instruction as complete',
    'professional signature/preparer area completion',
    'representation or payment recommendation without required review',
    'bank account/direct debit finalization without client confirmation'
  ],
  human_minimization_model: 'AI completes all safe fields, computes simple line arithmetic, asks conditional follow-ups, and sends only blocked/high-risk/missing/exception items to staff, PTIN, EA, CPA, or tax-attorney review as appropriate.'
};

function field(key, line, label, inputKey, type, section, required = false, extra = {}) {
  return {
    key,
    official_line: line,
    official_label: label,
    input_key: inputKey,
    value_type: type,
    section,
    required: Boolean(required),
    max_length: extra.max_length || null,
    source: extra.source || 'client_interview',
    formatting: extra.formatting || '',
    qa_rule: extra.qa_rule || 'client must verify before print/signature',
    signature_or_sensitive: Boolean(extra.signature_or_sensitive),
    government_only: Boolean(extra.government_only),
    preparer_controlled: Boolean(extra.preparer_controlled),
    conditional: extra.conditional || null,
    official_pdf_field_name: extra.official_pdf_field_name || '',
    mapping_status: extra.mapping_status || 'logical_map_ready_needs_pdf_field_confirmation'
  };
}

const IRS_9465_FIELD_MAP = [
  field('request_for_forms', 'Header', 'This request is for Form(s)', 'request_for_forms', 'text', 'Request basics', true, { max_length: 80 }),
  field('tax_years_or_periods', 'Header', 'Enter tax year(s) or period(s) involved', 'tax_years_or_periods', 'text', 'Request basics', true, { max_length: 100 }),
  field('taxpayer_first_name_initial', '1a', 'Your first name and initial', 'taxpayer_first_name_initial', 'text', 'Taxpayer identity', true, { max_length: 40 }),
  field('taxpayer_last_name', '1a', 'Last name', 'taxpayer_last_name', 'text', 'Taxpayer identity', true, { max_length: 40 }),
  field('taxpayer_ssn', '1a', 'Your social security number', 'taxpayer_ssn', 'ssn', 'Taxpayer identity', true, { signature_or_sensitive: true, formatting: '###-##-####' }),
  field('spouse_first_name_initial', '1a', "Spouse's first name and initial", 'spouse_first_name_initial', 'text', 'Joint filer identity', false, { conditional: 'joint_return' }),
  field('spouse_last_name', '1a', "Spouse's last name", 'spouse_last_name', 'text', 'Joint filer identity', false, { conditional: 'joint_return' }),
  field('spouse_ssn', '1a', "Spouse's social security number", 'spouse_ssn', 'ssn', 'Joint filer identity', false, { signature_or_sensitive: true, formatting: '###-##-####', conditional: 'joint_return' }),
  field('current_address', '1a', 'Current address', 'current_address', 'text', 'Address', true),
  field('apt_number', '1a', 'Apt. number', 'apt_number', 'text', 'Address', false),
  field('city_state_zip', '1a', 'City, town or post office, state, and ZIP code', 'city_state_zip', 'text', 'Address', true),
  field('foreign_country', '1a', 'Foreign country name', 'foreign_country', 'text', 'Foreign address', false),
  field('foreign_province', '1a', 'Foreign province/state/county', 'foreign_province', 'text', 'Foreign address', false),
  field('foreign_postal_code', '1a', 'Foreign postal code', 'foreign_postal_code', 'text', 'Foreign address', false),
  field('new_address_since_last_return', '1b', 'Address is new since last tax return', 'new_address_since_last_return', 'checkbox', 'Address', false),
  field('business_name_closed', '2', 'Name of your business (must no longer be operating)', 'business_name_closed', 'text', 'Business', false),
  field('business_ein', '2', 'Employer identification number (EIN)', 'business_ein', 'ein', 'Business', false, { formatting: '##-#######' }),
  field('home_phone', '3', 'Your home phone number', 'home_phone', 'phone', 'Contact', false),
  field('home_best_time', '3', 'Best time for us to call', 'home_best_time', 'text', 'Contact', false),
  field('work_phone', '4', 'Your work phone number', 'work_phone', 'phone', 'Contact', false),
  field('work_ext', '4', 'Ext.', 'work_ext', 'text', 'Contact', false),
  field('work_best_time', '4', 'Best time for us to call', 'work_best_time', 'text', 'Contact', false),
  field('line5_return_or_notice_balance', '5', 'Total amount you owe as shown on tax return(s) or notice(s)', 'line5_return_or_notice_balance', 'money', 'Amount owed', true),
  field('line6_additional_balances', '6', 'Additional balances due not reported on line 5', 'line6_additional_balances', 'money', 'Amount owed', false),
  field('line7_total_balance', '7', 'Add lines 5 and 6', 'line7_total_balance', 'money_calculated', 'Amount owed', true, { source: 'calculated' }),
  field('line8_payment_with_request', '8', 'Payment making with this request', 'line8_payment_with_request', 'money', 'Amount owed', false),
  field('line9_amount_owed_after_payment', '9', 'Amount owed after line 8', 'line9_amount_owed_after_payment', 'money_calculated', 'Amount owed', true, { source: 'calculated' }),
  field('line10_minimum_72_month_payment', '10', 'Line 9 divided by 72.0', 'line10_minimum_72_month_payment', 'money_calculated', 'Payment proposal', true, { source: 'calculated' }),
  field('line11a_proposed_monthly_payment', '11a', 'Amount you can pay each month', 'line11a_proposed_monthly_payment', 'money', 'Payment proposal', true),
  field('line11b_revised_monthly_payment', '11b', 'Revised monthly payment if line 11a is less than line 10', 'line11b_revised_monthly_payment', 'money', 'Payment proposal', false, { conditional: 'line11a_less_than_line10' }),
  field('line11_cannot_increase_attach_433f', '11 note', 'Cannot increase payment to line 10 or more; complete and attach Form 433-F', 'line11_cannot_increase_attach_433f', 'checkbox', 'Payment proposal', false, { conditional: 'line11a_less_than_line10' }),
  field('payment_day_of_month', '12', 'Date you want to make payment each month; not later than 28th', 'payment_day_of_month', 'number', 'Payment proposal', true, { formatting: '1-28' }),
  field('direct_debit_routing', '13a', 'Routing number', 'direct_debit_routing', 'routing_number', 'Direct debit', false, { signature_or_sensitive: true, conditional: 'direct_debit_requested' }),
  field('direct_debit_account', '13b', 'Account number', 'direct_debit_account', 'account_number', 'Direct debit', false, { signature_or_sensitive: true, conditional: 'direct_debit_requested' }),
  field('low_income_no_debit_reimbursement', '13c', 'Low-income taxpayers unable to make electronic payments through debit instrument', 'low_income_no_debit_reimbursement', 'checkbox', 'Direct debit', false),
  field('payroll_deduction_requested', '14', 'Payments by payroll deduction; attach Form 2159', 'payroll_deduction_requested', 'checkbox', 'Payroll deduction', false),
  field('taxpayer_signature', 'Signature', 'Your signature', 'taxpayer_signature', 'signature', 'Signature', false, { signature_or_sensitive: true, source: 'client_signs_after_review', qa_rule: 'must remain blank in AI-generated print package until client signs' }),
  field('taxpayer_signature_date', 'Signature', 'Date', 'taxpayer_signature_date', 'date', 'Signature', false, { source: 'client_signs_after_review' }),
  field('spouse_signature', 'Signature', "Spouse's signature if joint return", 'spouse_signature', 'signature', 'Signature', false, { signature_or_sensitive: true, conditional: 'joint_return', source: 'client_signs_after_review' }),
  field('spouse_signature_date', 'Signature', 'Spouse signature date', 'spouse_signature_date', 'date', 'Signature', false, { conditional: 'joint_return', source: 'client_signs_after_review' }),
  field('county_of_primary_residence', '15', 'County of primary residence', 'county_of_primary_residence', 'text', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('marital_status', '16a', 'Marital status', 'marital_status', 'select', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('share_household_expenses_spouse', '16b', 'Share household expenses with spouse', 'share_household_expenses_spouse', 'checkbox', 'Part II additional information', false, { conditional: 'part_ii_required_and_married' }),
  field('dependents_count', '17', 'Dependents able to claim this year', 'dependents_count', 'number', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('household_65_or_older_count', '18', 'People in household 65 or older', 'household_65_or_older_count', 'number', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('pay_frequency', '19', 'How often are you paid', 'pay_frequency', 'select', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('net_income_per_pay_period', '20', 'Net income per pay period', 'net_income_per_pay_period', 'money', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('spouse_pay_frequency', '21', 'How often spouse is paid', 'spouse_pay_frequency', 'select', 'Part II additional information', false, { conditional: 'part_ii_required_and_spouse' }),
  field('spouse_net_income_per_pay_period', '22', "Spouse's net income per pay period", 'spouse_net_income_per_pay_period', 'money', 'Part II additional information', false, { conditional: 'part_ii_required_and_spouse' }),
  field('vehicles_owned_count', '23', 'How many vehicles you own', 'vehicles_owned_count', 'number', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('monthly_car_payments_count', '24', 'How many car payments each month', 'monthly_car_payments_count', 'number', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('has_health_insurance', '25a', 'Health insurance', 'has_health_insurance', 'yes_no', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('health_premiums_deducted_from_paycheck', '25b', 'Premiums deducted from paycheck', 'health_premiums_deducted_from_paycheck', 'yes_no', 'Part II additional information', false, { conditional: 'part_ii_required_and_has_health_insurance' }),
  field('monthly_health_premium', '25c', 'Monthly health insurance premiums', 'monthly_health_premium', 'money', 'Part II additional information', false, { conditional: 'part_ii_required_and_premiums_not_deducted' }),
  field('court_ordered_payments', '26a', 'Court-ordered payments', 'court_ordered_payments', 'yes_no', 'Part II additional information', false, { conditional: 'part_ii_required' }),
  field('court_payments_deducted_from_paycheck', '26b', 'Court payments deducted from paycheck', 'court_payments_deducted_from_paycheck', 'yes_no', 'Part II additional information', false, { conditional: 'part_ii_required_and_court_payments' }),
  field('monthly_court_ordered_payments', '26c', 'Monthly court-ordered payments', 'monthly_court_ordered_payments', 'money', 'Part II additional information', false, { conditional: 'part_ii_required_and_court_payments_not_deducted' }),
  field('monthly_child_dependent_care', '27', 'Child/dependent care each month, excluding court-ordered support', 'monthly_child_dependent_care', 'money', 'Part II additional information', false, { conditional: 'part_ii_required' })
];

const IRS_9465_SAMPLE_CASES = [
  {
    key: 'standard_under_25000_direct_debit',
    label: 'Standard balance under $25,000 with direct debit',
    purpose: 'Should complete Part I, calculate lines 7/9/10, leave signature blank, and not require Part II.',
    answers: {
      request_for_forms: 'Form 1040', tax_years_or_periods: '2025', taxpayer_first_name_initial: 'Sample A', taxpayer_last_name: 'Taxpayer', taxpayer_ssn: '000-00-1234', current_address: '123 Sample Street', city_state_zip: 'New York, NY 10001', line5_return_or_notice_balance: '7200', line6_additional_balances: '0', line8_payment_with_request: '0', line11a_proposed_monthly_payment: '150', payment_day_of_month: '15', direct_debit_requested: 'yes', direct_debit_routing: '021000021', direct_debit_account: '000123456789'
    }
  },
  {
    key: 'over_25000_low_payment_part_ii',
    label: 'Balance over $25,000 with proposed payment below 72-month amount',
    purpose: 'Should require Part II and attach/review Form 433-F logic if payment cannot be increased.',
    answers: {
      request_for_forms: 'Form 1040', tax_years_or_periods: '2024 and 2025', taxpayer_first_name_initial: 'Sample B', taxpayer_last_name: 'Taxpayer', taxpayer_ssn: '000-00-5678', current_address: '456 Sample Ave', city_state_zip: 'Brooklyn, NY 11201', line5_return_or_notice_balance: '35000', line6_additional_balances: '0', line8_payment_with_request: '0', line11a_proposed_monthly_payment: '300', payment_day_of_month: '10', defaulted_installment_agreement_past_12_months: 'yes', county_of_primary_residence: 'Kings', marital_status: 'single', dependents_count: '1', household_65_or_older_count: '0', pay_frequency: 'Once every 2 weeks', net_income_per_pay_period: '1800', vehicles_owned_count: '1', monthly_car_payments_count: '1', has_health_insurance: 'yes', health_premiums_deducted_from_paycheck: 'no', monthly_health_premium: '350', court_ordered_payments: 'no', monthly_child_dependent_care: '200'
    }
  },
  {
    key: 'over_50000_433f_required',
    label: 'Balance over $50,000',
    purpose: 'Should block simple 9465-only release and require Form 433-F workflow/review.',
    answers: {
      request_for_forms: 'Form 1040', tax_years_or_periods: '2023, 2024, 2025', taxpayer_first_name_initial: 'Sample C', taxpayer_last_name: 'Taxpayer', taxpayer_ssn: '000-00-9999', current_address: '789 Sample Road', city_state_zip: 'Queens, NY 11101', line5_return_or_notice_balance: '61000', line6_additional_balances: '0', line8_payment_with_request: '1000', line11a_proposed_monthly_payment: '800', payment_day_of_month: '5'
    }
  }
];

function moneyNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function boolLike(value) {
  const v = String(value || '').trim().toLowerCase();
  return ['yes', 'true', '1', 'on', 'checked'].includes(v);
}

function money(value) {
  const n = moneyNumber(value);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function maskSensitive(key, value) {
  if (!hasValue(value)) return '';
  const str = String(value);
  if (/ssn/i.test(key)) return str.replace(/\d(?=\d{4})/g, '*');
  if (/account/i.test(key)) return str.length > 4 ? `****${str.slice(-4)}` : '****';
  if (/routing/i.test(key)) return str.length > 4 ? `${str.slice(0, 2)}*****${str.slice(-2)}` : '****';
  return str;
}

function normalizedAnswers(answers = {}) {
  const a = { ...(answers || {}) };
  if (!a.line5_return_or_notice_balance && a.amount_owed_estimate) a.line5_return_or_notice_balance = a.amount_owed_estimate;
  if (!a.tax_years_or_periods && a.tax_year) a.tax_years_or_periods = a.tax_year;
  if (!a.request_for_forms) a.request_for_forms = 'Form 1040';
  const line5 = moneyNumber(a.line5_return_or_notice_balance);
  const line6 = moneyNumber(a.line6_additional_balances);
  const line8 = moneyNumber(a.line8_payment_with_request);
  const line7 = Math.max(0, line5 + line6);
  const line9 = Math.max(0, line7 - line8);
  const line10 = Math.ceil((line9 / 72) * 100) / 100;
  a.line7_total_balance = line7 ? line7.toFixed(2) : '';
  a.line9_amount_owed_after_payment = line9 ? line9.toFixed(2) : '';
  a.line10_minimum_72_month_payment = line10 ? line10.toFixed(2) : '';
  return a;
}

function determinePartIIRequirement(answers = {}) {
  const a = normalizedAnswers(answers);
  const line9 = moneyNumber(a.line9_amount_owed_after_payment);
  const proposed = moneyNumber(a.line11b_revised_monthly_payment || a.line11a_proposed_monthly_payment);
  const line10 = moneyNumber(a.line10_minimum_72_month_payment);
  const defaulted = boolLike(a.defaulted_installment_agreement_past_12_months);
  const paymentBelowMinimum = proposed > 0 && line10 > 0 && proposed < line10;
  const partIIRequired = defaulted && line9 > 25000 && line9 <= 50000 && paymentBelowMinimum;
  const form433FRequired = line9 > 50000 || (paymentBelowMinimum && boolLike(a.line11_cannot_increase_attach_433f));
  const paymentMethodReview = boolLike(a.direct_debit_requested) && (!hasValue(a.direct_debit_routing) || !hasValue(a.direct_debit_account));
  return {
    line9_amount_owed: line9,
    line10_minimum_72_month_payment: line10,
    proposed_monthly_payment: proposed,
    defaulted_installment_agreement_past_12_months: defaulted,
    payment_below_72_month_amount: paymentBelowMinimum,
    part_ii_required: partIIRequired,
    form_433f_required: form433FRequired,
    payment_method_review_needed: paymentMethodReview,
    review_level_hint: line9 > 50000 || form433FRequired ? 'ea_or_tax_attorney_review_recommended' : (line9 > 25000 ? 'ea_review_recommended' : 'ptin_or_ai_with_exception_review')
  };
}

function fieldApplies(fieldDef, answers = {}, derived = {}) {
  if (!fieldDef.conditional) return true;
  const c = fieldDef.conditional;
  if (c === 'joint_return') return boolLike(answers.joint_return) || hasValue(answers.spouse_first_name_initial) || hasValue(answers.spouse_ssn);
  if (c === 'line11a_less_than_line10') return derived.payment_below_72_month_amount;
  if (c === 'direct_debit_requested') return boolLike(answers.direct_debit_requested) || hasValue(answers.direct_debit_routing) || hasValue(answers.direct_debit_account);
  if (c === 'part_ii_required') return derived.part_ii_required;
  if (c === 'part_ii_required_and_married') return derived.part_ii_required && String(answers.marital_status || '').toLowerCase().includes('married');
  if (c === 'part_ii_required_and_spouse') return derived.part_ii_required && (String(answers.marital_status || '').toLowerCase().includes('married') || hasValue(answers.spouse_ssn));
  if (c === 'part_ii_required_and_has_health_insurance') return derived.part_ii_required && boolLike(answers.has_health_insurance);
  if (c === 'part_ii_required_and_premiums_not_deducted') return derived.part_ii_required && boolLike(answers.has_health_insurance) && !boolLike(answers.health_premiums_deducted_from_paycheck);
  if (c === 'part_ii_required_and_court_payments') return derived.part_ii_required && boolLike(answers.court_ordered_payments);
  if (c === 'part_ii_required_and_court_payments_not_deducted') return derived.part_ii_required && boolLike(answers.court_ordered_payments) && !boolLike(answers.court_payments_deducted_from_paycheck);
  return true;
}

function validate9465Answers(answers = {}) {
  const a = normalizedAnswers(answers);
  const derived = determinePartIIRequirement(a);
  const missing = [];
  const warnings = [];
  const errors = [];

  for (const f of IRS_9465_FIELD_MAP) {
    if (f.required && fieldApplies(f, a, derived) && !hasValue(a[f.input_key])) missing.push({ key: f.input_key, line: f.official_line, label: f.official_label, section: f.section });
  }
  const day = Number(a.payment_day_of_month || 0);
  if (hasValue(a.payment_day_of_month) && (!Number.isFinite(day) || day < 1 || day > 28)) errors.push({ key: 'payment_day_of_month', message: 'Line 12 payment day must be between 1 and 28.' });
  if (moneyNumber(a.line9_amount_owed_after_payment) <= 0) warnings.push({ key: 'line9_amount_owed_after_payment', message: 'Line 9 is zero or negative. Confirm whether Form 9465 is the correct workflow.' });
  if (moneyNumber(a.line9_amount_owed_after_payment) > 50000) warnings.push({ key: 'form_433f_required', message: 'The amount owed after payment is over $50,000. Add Form 433-F and require collection/professional review.' });
  if (derived.payment_below_72_month_amount) warnings.push({ key: 'payment_below_72_month_amount', message: 'Proposed monthly payment is below the line 10 72-month amount. Ask whether payment can be increased and evaluate Form 433-F/Part II.' });
  if (derived.part_ii_required) warnings.push({ key: 'part_ii_required', message: 'Part II additional information is required based on default/payment/balance conditions.' });
  if (derived.payment_method_review_needed) errors.push({ key: 'direct_debit', message: 'Direct debit was requested but routing/account information is incomplete.' });
  if (boolLike(a.payroll_deduction_requested)) warnings.push({ key: 'form_2159_required', message: 'Payroll deduction requires attaching completed Form 2159.' });
  if (hasValue(a.taxpayer_signature) || hasValue(a.spouse_signature)) warnings.push({ key: 'signature_blank_rule', message: 'AI-generated drafts should not place signatures; client signs after review.' });

  return { ok: errors.length === 0 && missing.length === 0, missing, warnings, errors, derived, normalized_answers: a };
}

function build9465FieldMapReport() {
  const bySection = IRS_9465_FIELD_MAP.reduce((acc, item) => {
    acc[item.section] = acc[item.section] || [];
    acc[item.section].push(item);
    return acc;
  }, {});
  return {
    version: VERSION,
    source: IRS_9465_OFFICIAL_SOURCE,
    field_count: IRS_9465_FIELD_MAP.length,
    sections: Object.entries(bySection).map(([section, fields]) => ({ section, field_count: fields.length, fields })),
    fields: IRS_9465_FIELD_MAP,
    mapping_status: 'logical_line_level_map_ready_pdf_field_names_and_overlay_coordinates_need_final_confirmation',
    next_qa_steps: [
      'capture official IRS PDF and record checksum',
      'confirm whether the current IRS PDF has fillable AcroForm fields or requires overlay output',
      'lock field names or overlay coordinates for every line',
      'run three sample cases and inspect page placement/overflow/signature areas',
      'save a reviewer-approved field-map version before client-facing final output'
    ]
  };
}

function build9465CompletionPlan(answers = {}, options = {}) {
  const validation = validate9465Answers(answers);
  const a = validation.normalized_answers;
  const derived = validation.derived;
  const applicableFields = IRS_9465_FIELD_MAP.filter((f) => fieldApplies(f, a, derived));
  const candidateFields = applicableFields.map((f) => ({
    ...f,
    value_preview: f.signature_or_sensitive ? maskSensitive(f.input_key, a[f.input_key]) : (hasValue(a[f.input_key]) ? String(a[f.input_key]).slice(0, 140) : ''),
    value_present: hasValue(a[f.input_key]),
    source_value_key: f.input_key,
    final_value_allowed_without_client_verification: false
  }));
  const sourceRecord = options.sourceRecord || null;
  const officialForm = options.officialForm || null;
  const officialPdfCaptured = Boolean((sourceRecord && sourceRecord.pdf_capture_status === 'captured') || (officialForm && officialForm.storage_path));
  const mappingVerified = Boolean((officialForm && officialForm.mapping_status === 'mapped_verified') || (sourceRecord && sourceRecord.mapping_status === 'mapped_verified'));
  const sampleQaPassed = Boolean((officialForm && officialForm.sample_fill_status === 'passed') || (sourceRecord && sourceRecord.sample_fill_status === 'passed') || options.sampleQaPassed);
  const clientVerified = Boolean(options.clientVerified || answers.client_verified_9465 === true || answers.client_verified_9465 === 'true');
  const professionalReleased = Boolean(options.professionalReleased || answers.professional_released_9465 === true || answers.professional_released_9465 === 'true');
  const officialOutputReady = officialPdfCaptured && mappingVerified && sampleQaPassed && clientVerified && professionalReleased && validation.errors.length === 0 && validation.missing.length === 0;
  const blockedReasons = [];
  if (!officialPdfCaptured) blockedReasons.push('official_pdf_not_captured_or_attached');
  if (!mappingVerified) blockedReasons.push('official_pdf_field_map_not_verified');
  if (!sampleQaPassed) blockedReasons.push('sample_fill_qa_not_passed');
  if (!clientVerified) blockedReasons.push('client_verification_not_complete');
  if (!professionalReleased) blockedReasons.push('required_staff_or_professional_release_not_complete');
  if (validation.missing.length) blockedReasons.push('required_answers_missing');
  if (validation.errors.length) blockedReasons.push('answer_validation_errors');
  if (derived.form_433f_required) blockedReasons.push('form_433f_or_collection_review_required');

  return {
    ok: true,
    form: IRS_9465_OFFICIAL_SOURCE,
    policy: IRS_9465_OUTPUT_POLICY,
    field_map_status: build9465FieldMapReport().mapping_status,
    validation,
    derived_calculations: {
      line7_total_balance: a.line7_total_balance,
      line9_amount_owed_after_payment: a.line9_amount_owed_after_payment,
      line10_minimum_72_month_payment: a.line10_minimum_72_month_payment,
      part_ii_required: derived.part_ii_required,
      form_433f_required: derived.form_433f_required
    },
    candidate_fields: candidateFields,
    output_gate: {
      sample_or_internal_draft_allowed: validation.errors.length === 0,
      client_verification_sheet_allowed: validation.errors.length === 0,
      official_client_print_output_allowed: officialOutputReady,
      client_signature_allowed: officialOutputReady,
      blocked_reasons: Array.from(new Set(blockedReasons)),
      release_status: officialOutputReady ? 'ready_for_client_print_signature_after_final_review' : 'not_ready_for_final_client_output'
    },
    next_questions: build9465FollowUpQuestions(a, validation, derived),
    review_routing: build9465ReviewRouting(validation, derived)
  };
}

function build9465FollowUpQuestions(a, validation, derived) {
  const questions = [];
  for (const m of validation.missing.slice(0, 12)) questions.push({ key: m.key, reason: `Required for line ${m.line}`, question: `Please provide: ${m.label}.` });
  if (derived.payment_below_72_month_amount) questions.push({ key: 'line11b_revised_monthly_payment', reason: 'Line 11a is below line 10.', question: 'Can you increase your monthly payment to at least the line 10 amount? If yes, enter the revised amount for line 11b.' });
  if (derived.form_433f_required) questions.push({ key: 'form_433f_details', reason: 'Form 433-F may be required.', question: 'Do you have income, expense, bank, vehicle, and asset details available for Form 433-F?' });
  if (boolLike(a.direct_debit_requested) && (!hasValue(a.direct_debit_routing) || !hasValue(a.direct_debit_account))) questions.push({ key: 'direct_debit_account_info', reason: 'Direct debit was selected.', question: 'Provide routing and account number or switch to a non-direct-debit payment method.' });
  if (boolLike(a.payroll_deduction_requested)) questions.push({ key: 'form_2159', reason: 'Payroll deduction selected.', question: 'Upload or prepare Form 2159 Payroll Deduction Agreement.' });
  return questions;
}

function build9465ReviewRouting(validation, derived) {
  const triggers = [];
  if (derived.form_433f_required) triggers.push({ level: 'EA Review', reason: 'Form 433-F / collection financial disclosure likely required before release.' });
  if (derived.line9_amount_owed > 50000) triggers.push({ level: 'EA or Tax Attorney Review', reason: 'Balance over $50,000 should not be handled as a simple 9465-only workflow.' });
  if (validation.errors.length || validation.missing.length) triggers.push({ level: 'Staff completeness review', reason: 'Missing or invalid required values.' });
  if (derived.payment_method_review_needed) triggers.push({ level: 'Human review', reason: 'Direct debit banking information requires careful client verification.' });
  if (!triggers.length) triggers.push({ level: 'AI completion with client verification / optional PTIN review', reason: 'No blocking risk detected, pending official PDF QA and client verification.' });
  return { minimum_recommended_level: triggers[0].level, triggers };
}

function build9465OutputReadiness({ store } = {}) {
  const sourceRecords = store && store.list ? store.list('official_form_sources', (s) => !s.deleted_at && s.agency === 'IRS' && String(s.form_number || '').replace(/[^0-9]/g, '') === '9465') : [];
  const officialForms = store && store.list ? store.list('official_forms', (f) => !f.deleted_at && f.agency === 'IRS' && String(f.form_number || '').replace(/[^0-9]/g, '') === '9465') : [];
  const captured = sourceRecords.filter((s) => s.pdf_capture_status === 'captured').length + officialForms.filter((f) => f.storage_path).length;
  const mapped = sourceRecords.filter((s) => s.mapping_status === 'mapped_verified').length + officialForms.filter((f) => f.mapping_status === 'mapped_verified').length;
  const checks = [
    { key: 'official_source_identified', label: 'Official IRS source identified', ok: true, detail: IRS_9465_OFFICIAL_SOURCE.source_url },
    { key: 'official_pdf_captured', label: 'Official PDF captured and checksummed', ok: captured > 0, detail: `${captured} captured/attached record(s)` },
    { key: 'logical_field_map_ready', label: 'Line-level logical field map prepared', ok: IRS_9465_FIELD_MAP.length >= 50, detail: `${IRS_9465_FIELD_MAP.length} line/field candidates` },
    { key: 'pdf_field_names_confirmed', label: 'PDF field names or overlay coordinates confirmed', ok: mapped > 0, detail: `${mapped} mapped-verified record(s)` },
    { key: 'sample_fill_qa_complete', label: 'Sample filled PDFs inspected for overflow/signature areas', ok: false, detail: 'Run sample QA and mark only after visual inspection.' },
    { key: 'client_verification_flow', label: 'Client verification sheet available', ok: true, detail: 'Verification sheet endpoint can be generated from answers.' },
    { key: 'professional_release_gate', label: 'Professional/reviewer release gate enforced', ok: true, detail: 'Final output remains blocked without release flags.' }
  ];
  return {
    version: VERSION,
    form: IRS_9465_OFFICIAL_SOURCE,
    summary: { required_checks: checks.length, passed: checks.filter((c) => c.ok).length, blocked: checks.filter((c) => !c.ok).length, client_output_ready: checks.every((c) => c.ok) },
    checks,
    source_records: sourceRecords.map((s) => ({ ...s, storage_path: undefined })),
    official_pdf_records: officialForms.map((f) => ({ ...f, storage_path: undefined })),
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label),
    release_rule: IRS_9465_OFFICIAL_SOURCE.client_output_rule
  };
}

function build9465SampleCases() {
  return { form: IRS_9465_OFFICIAL_SOURCE, sample_cases: IRS_9465_SAMPLE_CASES.map((s) => ({ key: s.key, label: s.label, purpose: s.purpose, completion_plan: build9465CompletionPlan(s.answers) })) };
}

function build9465SampleFillAudit(answers = {}, options = {}) {
  const plan = build9465CompletionPlan(answers, options);
  const qa = [
    { key: 'official_source', status: 'passed', note: 'IRS source URL identified.' },
    { key: 'line_arithmetic', status: plan.validation.errors.some((e) => ['payment_day_of_month'].includes(e.key)) ? 'needs_fix' : 'passed', note: `Line 7=${plan.derived_calculations.line7_total_balance || 'blank'}, line 9=${plan.derived_calculations.line9_amount_owed_after_payment || 'blank'}, line 10=${plan.derived_calculations.line10_minimum_72_month_payment || 'blank'}.` },
    { key: 'required_answers', status: plan.validation.missing.length ? 'blocked' : 'passed', note: `${plan.validation.missing.length} required answer(s) missing.` },
    { key: 'conditional_part_ii', status: plan.derived_calculations.part_ii_required ? 'required' : 'not_required_for_this_sample', note: plan.derived_calculations.part_ii_required ? 'Part II should be completed and inspected.' : 'Part II can remain blank for this fact pattern.' },
    { key: 'form_433f_dependency', status: plan.derived_calculations.form_433f_required ? 'blocked_until_433f_added' : 'not_triggered', note: plan.derived_calculations.form_433f_required ? 'Add Form 433-F workflow and review.' : 'No Form 433-F trigger detected.' },
    { key: 'signature_fields', status: 'blank_required', note: 'Signature fields must remain blank until client signs after review.' },
    { key: 'overflow_visual_check', status: 'not_run_until_official_pdf_or_overlay_render', note: 'Requires visual inspection of generated page output.' },
    { key: 'final_client_output', status: plan.output_gate.official_client_print_output_allowed ? 'allowed_after_release' : 'blocked', note: plan.output_gate.blocked_reasons.join(', ') || 'ready' }
  ];
  return { ok: true, form: IRS_9465_OFFICIAL_SOURCE, plan, qa, print_ready: plan.output_gate.official_client_print_output_allowed };
}

function build9465VerificationSheet(answers = {}, options = {}) {
  const plan = build9465CompletionPlan(answers, options);
  const grouped = plan.candidate_fields.reduce((acc, f) => {
    acc[f.section] = acc[f.section] || [];
    acc[f.section].push({ line: f.official_line, label: f.official_label, value_preview: f.value_preview, present: f.value_present, verify: 'Client must confirm before print/signature.' });
    return acc;
  }, {});
  return { ok: true, form: IRS_9465_OFFICIAL_SOURCE, release_status: plan.output_gate.release_status, blocked_reasons: plan.output_gate.blocked_reasons, sections: grouped, warnings: plan.validation.warnings, errors: plan.validation.errors, missing: plan.validation.missing };
}

function create9465DraftPdfBuffer(answers = {}, options = {}) {
  const plan = build9465CompletionPlan(answers, options);
  const doc = new PDFDocument({ size: 'LETTER', margin: 44, info: { Title: 'IRS Form 9465 Draft Completion QA Packet', Author: 'Justice Tax Solutions' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(16).text('Justice Tax Solutions', { align: 'center' });
  doc.fontSize(13).text('IRS Form 9465 Draft Completion QA Packet', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('red').text('Internal/sample draft package only unless official PDF capture, mapping, sample-fill QA, client verification, and professional release are complete. This is not an IRS submission receipt and does not guarantee IRS approval.', { align: 'center' });
  doc.fillColor('black').moveDown();
  doc.fontSize(11).text(`Official source: ${IRS_9465_OFFICIAL_SOURCE.source_url}`);
  doc.text(`Release status: ${plan.output_gate.release_status}`);
  doc.text(`Blocked reasons: ${plan.output_gate.blocked_reasons.join(', ') || 'none'}`);
  doc.moveDown();
  doc.fontSize(12).text('Calculated lines', { underline: true });
  doc.fontSize(10).text(`Line 7 total balance: ${money(plan.derived_calculations.line7_total_balance)}`);
  doc.text(`Line 9 amount owed after payment: ${money(plan.derived_calculations.line9_amount_owed_after_payment)}`);
  doc.text(`Line 10 72-month amount: ${money(plan.derived_calculations.line10_minimum_72_month_payment)}`);
  doc.text(`Part II required: ${plan.derived_calculations.part_ii_required ? 'Yes' : 'No'}`);
  doc.text(`Form 433-F required/recommended: ${plan.derived_calculations.form_433f_required ? 'Yes' : 'No'}`);
  doc.moveDown();
  doc.fontSize(12).text('Client follow-up questions', { underline: true });
  (plan.next_questions.length ? plan.next_questions : [{ question: 'No immediate follow-up questions detected; still verify all values before output.' }]).forEach((q, idx) => doc.fontSize(9).text(`${idx + 1}. ${q.question} ${q.reason ? `(${q.reason})` : ''}`));

  doc.addPage();
  doc.fontSize(13).text('Line-by-line field candidates', { underline: true });
  doc.moveDown(0.5);
  plan.candidate_fields.forEach((f) => {
    if (doc.y > 720) doc.addPage();
    const v = f.value_preview || '[blank / not supplied]';
    doc.fontSize(8).text(`${f.official_line} · ${f.official_label}: ${v}`);
  });

  doc.addPage();
  doc.fontSize(13).text('QA checklist before client signature/output', { underline: true });
  build9465SampleFillAudit(answers, options).qa.forEach((item, idx) => doc.fontSize(9).text(`${idx + 1}. ${item.key}: ${item.status} — ${item.note}`));
  doc.moveDown();
  doc.fontSize(11).text('Signature rule', { underline: true });
  doc.fontSize(9).text('AI/system-generated packages must not place the taxpayer or spouse signature. Client signs only after reviewing the final official form/package and after required professional/reviewer gates are complete.');

  doc.end();
  return endPromise;
}

function record9465QaStatus(store, payload = {}, staff = {}) {
  const allowed = new Set(['not_started', 'source_captured', 'field_map_verified', 'sample_fill_passed', 'client_verification_ready', 'professional_release_ready', 'blocked_needs_rework']);
  const status = allowed.has(String(payload.status || '')) ? String(payload.status) : 'not_started';
  const record = store.insert('form_output_qa_events', {
    form_number: '9465',
    agency: 'IRS',
    status,
    sample_case_key: String(payload.sample_case_key || '').slice(0, 80),
    official_form_id: String(payload.official_form_id || '').slice(0, 120),
    official_source_id: String(payload.official_source_id || '').slice(0, 120),
    notes: String(payload.notes || '').slice(0, 2000),
    staff_id: staff.id || 'staff',
    client_output_allowed: status === 'professional_release_ready' && payload.client_output_allowed === true,
    created_at: new Date().toISOString()
  });
  return record;
}

module.exports = {
  IRS_9465_OFFICIAL_SOURCE,
  IRS_9465_OUTPUT_POLICY,
  IRS_9465_FIELD_MAP,
  IRS_9465_SAMPLE_CASES,
  build9465FieldMapReport,
  build9465CompletionPlan,
  build9465OutputReadiness,
  build9465SampleCases,
  build9465SampleFillAudit,
  build9465VerificationSheet,
  create9465DraftPdfBuffer,
  record9465QaStatus,
  validate9465Answers,
  determinePartIIRequirement
};
