const PDFDocument = require('pdfkit');

const VERSION = '0.1.60';

const IRS_1040X_OFFICIAL_SOURCE = {
  agency: 'IRS',
  form_number: '1040-X',
  title: 'Amended U.S. Individual Income Tax Return',
  revision: 'Rev. December 2025',
  instructions_revision: 'Rev. December 2025',
  source_url: 'https://www.irs.gov/pub/irs-pdf/f1040x.pdf',
  instructions_url: 'https://www.irs.gov/pub/irs-pdf/i1040x.pdf',
  about_url: 'https://www.irs.gov/forms-pubs/about-form-1040x',
  source_page_url: 'https://www.irs.gov/forms-instructions',
  pages: 2,
  instructions_pages: 13,
  status: 'official_source_identified_logical_map_ready',
  purpose: 'Used to correct a previously filed Form 1040, 1040-SR, or 1040-NR, make certain elections after the deadline, change amounts previously adjusted by the IRS, or make certain carryback claims.',
  user_fit: 'Best for individual amended-return cases after a prior return has been filed and the user needs a careful review of changed figures, explanations, support documents, state implications, deadlines, and professional review needs.',
  client_output_rule: 'Organizer only. Final client-ready Form 1040-X output remains blocked until official PDF capture/checksum, field or coordinate lock, sample visual QA, corrected Form 1040/1040-SR/1040-NR attachment review, supporting document review, deadline review, taxpayer/preparer review, signature controls, and staff/professional release are complete.'
};

const IRS_1040X_OUTPUT_POLICY = {
  status: 'controlled_organizer_and_logical_map_only',
  goal: 'Support Justice Tax Solutions prior-return review and amendment-opportunity workflows with a deeper IRS Form 1040-X organizer, logical field map, sample QA, verification, and release-gate controls without pretending final official filing output is ready.',
  current_site_mode: 'no_sensitive_public_organizer',
  allowed_now: [
    'plain-English Form 1040-X fit triage for personal amended-return cases',
    'logical official section and line map from IRS Form 1040-X Rev. December 2025 and instructions',
    'no-sensitive organizer questions using last-4 identifiers, approximate/rounded amounts, issue categories, and redacted document references',
    'changed-number grid for original amount, net change, and corrected amount by major Form 1040-X lines',
    'dependent-change organizer, explanation-of-changes organizer, support-document checklist, deadline prompts, state-return prompts, and professional-review triggers',
    'internal/staff verification sheets and QA packets using redacted or sample values'
  ],
  blocked_until_final_qa: [
    'final official IRS Form 1040-X output for signature or filing',
    'e-file, mail, upload, direct agency submission, or refund-claim submission claims',
    'full SSN/ITIN, spouse SSN/ITIN, dependent SSNs, IP PINs, bank information, or original unredacted return data collection in public mode',
    'automatic tax computation, refund guarantee, amended-return benefit guarantee, or deadline/legal conclusion',
    'signature, perjury declaration, preparer signature, PTIN output, or paid-preparer block output',
    'state/city amended-return output without a separate state/city workflow and professional release'
  ],
  professional_review_default: 'Form 1040-X should generally receive staff review and, depending on complexity, PTIN preparer, CPA, EA, or tax attorney review before final filing output or submission is allowed.',
  deadline_language: 'Refund and amendment deadlines can matter. For federal refund claims, IRS guidance generally says Form 1040-X must be filed within 3 years after the original return was filed or 2 years after the tax was paid, whichever is later, but deadlines and exceptions should be verified before action.'
};

function moneyNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function field(key, page, line, section, officialLabel, inputKey, type, required = false, extra = {}) {
  return {
    form: '1040-X',
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
    column: extra.column || '',
    max_length: extra.max_length || null,
    formatting: extra.formatting || '',
    source: extra.source || 'client_interview_and_prior_return_review',
    qa_rule: extra.qa_rule || 'client and staff must verify against the original filed return, corrected return, schedules, and supporting documents before any signature or filing step',
    sensitive: Boolean(extra.sensitive),
    signature_or_perjury: Boolean(extra.signature_or_perjury),
    final_only: Boolean(extra.final_only),
    conditional: extra.conditional || null,
    options: extra.options || null,
    official_pdf_field_name: extra.official_pdf_field_name || '',
    mapping_status: extra.mapping_status || 'logical_map_ready_needs_official_pdf_field_or_coordinate_confirmation'
  };
}

function amountTriplet(line, label, section, required = false, extra = {}) {
  return ['original', 'net_change', 'correct'].map((column) => {
    const columnLabel = column === 'original' ? 'A. Original amount reported or as previously adjusted' : column === 'net_change' ? 'B. Net change - amount of increase or decrease' : 'C. Correct amount';
    return field(`line_${line}_${column}`, 1, String(line), section, `${label} - ${columnLabel}`, `line_${line}_${column}`, 'money', required, { ...extra, column });
  });
}

function dependentFields(row) {
  return [
    field(`dependent_${row}_first_name`, 2, '30', `Part I Dependents - row ${row}`, 'Dependent first name', `dependent_${row}_first_name`, 'text', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_last_name`, 2, '30', `Part I Dependents - row ${row}`, 'Dependent last name', `dependent_${row}_last_name`, 'text', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_ssn`, 2, '30', `Part I Dependents - row ${row}`, 'Dependent SSN', `dependent_${row}_ssn`, 'ssn', false, { repeat_group: 'dependents', row, sensitive: true, final_only: true, required_for_final_output: false, formatting: 'Do not collect full SSN in public mode' }),
    field(`dependent_${row}_last4`, 2, '30', `Part I Dependents - row ${row}`, 'Dependent last 4 for organizer only', `dependent_${row}_last4`, 'text', false, { repeat_group: 'dependents', row, formatting: '####', required_for_final_output: false }),
    field(`dependent_${row}_relationship`, 2, '30', `Part I Dependents - row ${row}`, 'Relationship', `dependent_${row}_relationship`, 'text', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_lived_more_than_half_year`, 2, '30', `Part I Dependents - row ${row}`, 'Lived with you more than half of the return year', `dependent_${row}_lived_more_than_half_year`, 'checkbox', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_lived_in_us`, 2, '30', `Part I Dependents - row ${row}`, 'Lived in the U.S.', `dependent_${row}_lived_in_us`, 'checkbox', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_full_time_student`, 2, '30', `Part I Dependents - row ${row}`, 'Full-time student', `dependent_${row}_full_time_student`, 'checkbox', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_permanently_disabled`, 2, '30', `Part I Dependents - row ${row}`, 'Permanently and totally disabled', `dependent_${row}_permanently_disabled`, 'checkbox', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_child_tax_credit`, 2, '30', `Part I Dependents - row ${row}`, 'Child tax credit', `dependent_${row}_child_tax_credit`, 'checkbox', false, { repeat_group: 'dependents', row }),
    field(`dependent_${row}_credit_for_other_dependents`, 2, '30', `Part I Dependents - row ${row}`, 'Credit for other dependents', `dependent_${row}_credit_for_other_dependents`, 'checkbox', false, { repeat_group: 'dependents', row })
  ];
}

const IRS_1040X_FIELD_MAP = [
  field('return_year', 1, 'Header', 'Return year', 'Calendar year or fiscal year being amended', 'return_year', 'tax_year', true, { formatting: 'YYYY or fiscal month/year' }),
  field('amending_return_type', 1, 'Header', 'Return type', 'Original or corrected return type being amended', 'amending_return_type', 'select', true, { options: ['1040', '1040-SR', '1040-NR', 'older 1040-A', 'older 1040-EZ', 'not sure'] }),
  field('filed_original_return', 1, 'Header', 'Original return filed', 'Confirmation that an original return was filed before amendment', 'filed_original_return', 'yes_no', true),
  field('taxpayer_first_middle', 1, 'Header', 'Taxpayer identity', 'Your first name and middle initial', 'taxpayer_first_middle', 'text', true),
  field('taxpayer_last_name', 1, 'Header', 'Taxpayer identity', 'Last name', 'taxpayer_last_name', 'text', true),
  field('taxpayer_ssn', 1, 'Header', 'Taxpayer identity', 'Your social security number', 'taxpayer_ssn', 'ssn', false, { sensitive: true, final_only: true, required_for_final_output: true, formatting: 'Full SSN is not collected in public mode' }),
  field('taxpayer_last4', 1, 'Header', 'Taxpayer identity', 'Last 4 identifier for no-sensitive organizer', 'taxpayer_last4', 'text', false, { formatting: '####', required_for_final_output: false }),
  field('spouse_first_middle', 1, 'Header', 'Joint return identity', 'Spouse first name and middle initial', 'spouse_first_middle', 'text', false),
  field('spouse_last_name', 1, 'Header', 'Joint return identity', 'Spouse last name', 'spouse_last_name', 'text', false),
  field('spouse_ssn', 1, 'Header', 'Joint return identity', 'Spouse social security number', 'spouse_ssn', 'ssn', false, { sensitive: true, final_only: true, required_for_final_output: false }),
  field('current_address', 1, 'Header', 'Current address', 'Home address, apartment, city, state, ZIP, and foreign address fields when applicable', 'current_address', 'long_text', true, { max_length: 300 }),
  field('address_changed_since_original', 1, 'Header', 'Current address', 'Moved since original return was filed', 'address_changed_since_original', 'yes_no', false),
  field('presidential_election_campaign_taxpayer', 1, 'Header', 'Presidential Election Campaign', 'You check box', 'presidential_election_campaign_taxpayer', 'checkbox', false),
  field('presidential_election_campaign_spouse', 1, 'Header', 'Presidential Election Campaign', 'Spouse check box', 'presidential_election_campaign_spouse', 'checkbox', false),
  field('amended_filing_status', 1, 'Header', 'Amended return filing status', 'Single / Married filing jointly / MFS / HOH / QSS', 'amended_filing_status', 'select', true, { options: ['Single', 'Married filing jointly', 'Married filing separately', 'Head of household', 'Qualifying surviving spouse'] }),
  field('original_filing_status', 1, 'Header', 'Original filing status', 'Filing status on the return previously filed or adjusted', 'original_filing_status', 'select', false, { options: ['Single', 'Married filing jointly', 'Married filing separately', 'Head of household', 'Qualifying surviving spouse', 'not sure'] }),
  field('mfs_spouse_name_or_hoh_qss_child_name', 1, 'Header', 'MFS/HOH/QSS detail', 'Spouse name or child name if required by selected filing status', 'mfs_spouse_name_or_hoh_qss_child_name', 'text', false, { conditional: 'MFS, HOH, or QSS selected' }),

  ...amountTriplet('1', 'Adjusted gross income. If NOL carryback included, check box', 'Income and Deductions', true),
  field('line_1_nol_carryback_included', 1, '1', 'Income and Deductions', 'NOL carryback included checkbox', 'line_1_nol_carryback_included', 'checkbox', false, { conditional: 'NOL carryback included', qa_rule: 'Likely CPA/EA review and supporting schedule required.' }),
  ...amountTriplet('2', 'Itemized deductions or standard deduction', 'Income and Deductions', false),
  ...amountTriplet('3', 'Subtract line 2 from line 1', 'Income and Deductions', false, { source: 'calculated_or_client_verified' }),
  ...amountTriplet('4a', 'Qualified business income deduction', 'Income and Deductions', false, { conditional: 'QBI changed', qa_rule: 'Business/Schedule C/K-1 changes may require CPA/EA review.' }),
  ...amountTriplet('4b', 'Deductions for tips, overtime, car loan interest, and seniors from Schedule 1-A', 'Income and Deductions', false, { conditional: 'Schedule 1-A changed', qa_rule: 'Attach Schedule 1-A when applicable.' }),
  ...amountTriplet('5', 'Taxable income', 'Income and Deductions', false, { source: 'calculated_or_client_verified' }),
  ...amountTriplet('6', 'Tax', 'Tax Liability', false),
  field('line_6_tax_method', 1, '6', 'Tax Liability', 'Method(s) used to figure tax', 'line_6_tax_method', 'text', false),
  ...amountTriplet('7', 'Nonrefundable credits', 'Tax Liability', false),
  field('line_7_general_business_credit_carryback', 1, '7', 'Tax Liability', 'General business credit carryback included checkbox', 'line_7_general_business_credit_carryback', 'checkbox', false, { conditional: 'general business credit carryback', qa_rule: 'Business credit carryback requires professional review.' }),
  ...amountTriplet('8', 'Subtract line 7 from line 6', 'Tax Liability', false, { source: 'calculated_or_client_verified' }),
  ...amountTriplet('9', 'Reserved for future use', 'Tax Liability', false, { final_only: true, mapping_status: 'reserved_line_do_not_use' }),
  ...amountTriplet('10', 'Other taxes', 'Tax Liability', false),
  ...amountTriplet('11', 'Total tax. Add lines 8 and 10', 'Tax Liability', false, { source: 'calculated_or_client_verified' }),
  ...amountTriplet('12', 'Federal income tax withheld and excess social security and tier 1 RRTA tax withheld', 'Payments', false),
  ...amountTriplet('13', 'Estimated tax payments, including amount applied from prior year', 'Payments', false),
  ...amountTriplet('14', 'Earned income credit (EIC)', 'Payments', false),
  ...amountTriplet('15', 'Refundable credits from Schedule 8812, Forms 2439, 4136, 8863, 8885, 8962, or other', 'Payments', false),
  field('line_15_other_credit_specify', 1, '15', 'Payments', 'Other refundable credit specify', 'line_15_other_credit_specify', 'text', false),
  ...amountTriplet('16', 'Extension payment, tax paid with original return, and additional tax paid after filing', 'Payments', false),
  ...amountTriplet('17', 'Total payments', 'Payments', false, { source: 'calculated_or_client_verified' }),
  ...amountTriplet('18', 'Overpayment shown on original return or previously adjusted by IRS', 'Refund or Amount You Owe', false),
  ...amountTriplet('19', 'Subtract line 18 from line 17', 'Refund or Amount You Owe', false, { source: 'calculated_or_client_verified' }),
  field('line_20_amount_you_owe', 1, '20', 'Refund or Amount You Owe', 'Amount you owe', 'line_20_amount_you_owe', 'money', false, { source: 'calculated_or_client_verified' }),
  field('line_21_overpaid_on_this_return', 1, '21', 'Refund or Amount You Owe', 'Amount overpaid on this return', 'line_21_overpaid_on_this_return', 'money', false, { source: 'calculated_or_client_verified' }),
  field('line_22_refund_amount_requested', 1, '22', 'Refund or Amount You Owe', 'Amount of line 21 you want refunded', 'line_22_refund_amount_requested', 'money', false),
  field('line_23_apply_to_estimated_tax_amount', 1, '23', 'Refund or Amount You Owe', 'Amount of line 21 to apply to estimated tax', 'line_23_apply_to_estimated_tax_amount', 'money', false),
  field('line_23_estimated_tax_year', 1, '23', 'Refund or Amount You Owe', 'Estimated tax year to apply overpayment', 'line_23_estimated_tax_year', 'tax_year', false),

  ...amountTriplet('25', 'Dependent children who lived with you more than half of the year', 'Part I Dependents', false),
  ...amountTriplet('27', 'Other dependents', 'Part I Dependents', false),
  field('more_than_four_dependents', 2, '30', 'Part I Dependents', 'More than four dependents checkbox', 'more_than_four_dependents', 'checkbox', false),
  ...dependentFields(1),
  ...dependentFields(2),
  ...dependentFields(3),
  ...dependentFields(4),
  field('mfs_hoh_lived_apart_or_legally_separated', 2, 'Part I', 'Part I Dependents', 'MFS/HOH lived apart or legally separated checkbox', 'mfs_hoh_lived_apart_or_legally_separated', 'checkbox', false, { conditional: 'MFS or HOH status' }),
  field('explanation_of_changes', 2, 'Part II', 'Explanation of Changes', 'Why you are filing Form 1040-X', 'explanation_of_changes', 'long_text', true, { max_length: 2200 }),
  field('changed_items_summary', 2, 'Part II', 'Explanation of Changes', 'Plain-language list of changed items', 'changed_items_summary', 'long_text', true, { max_length: 1600 }),
  field('supporting_documents_list', 2, 'Part II', 'Explanation of Changes', 'Supporting documents and changed schedules/forms to attach', 'supporting_documents_list', 'long_text', false, { max_length: 1600 }),
  field('state_or_city_amendment_needed', 2, 'Part II', 'State/local follow-up', 'State or city amended return may also be needed', 'state_or_city_amendment_needed', 'yes_no_unknown', false),
  field('federal_refund_deadline_review_needed', 2, 'Part II', 'Deadline review', 'Federal refund/amendment deadline review needed', 'federal_refund_deadline_review_needed', 'yes_no_unknown', true),
  field('taxpayer_signature', 2, 'Signature', 'Sign Here', 'Your signature', 'taxpayer_signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true, mapping_status: 'must_remain_blank_until taxpayer signs after final review' }),
  field('taxpayer_signature_date', 2, 'Signature', 'Sign Here', 'Date', 'taxpayer_signature_date', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true, mapping_status: 'must_remain_blank_until taxpayer signs after final review' }),
  field('taxpayer_occupation', 2, 'Signature', 'Sign Here', 'Your occupation', 'taxpayer_occupation', 'text', false, { final_only: true }),
  field('taxpayer_ip_pin', 2, 'Signature', 'Sign Here', 'Identity Protection PIN', 'taxpayer_ip_pin', 'ip_pin', false, { sensitive: true, final_only: true, required_for_final_output: false }),
  field('spouse_signature', 2, 'Signature', 'Sign Here', 'Spouse signature if joint return', 'spouse_signature', 'signature', false, { signature_or_perjury: true, final_only: true, conditional: 'joint return', mapping_status: 'must_remain_blank_until spouse signs after final review' }),
  field('phone_number', 2, 'Signature', 'Contact', 'Phone no.', 'phone_number', 'phone', false, { sensitive: true, final_only: true }),
  field('email_address', 2, 'Signature', 'Contact', 'Email address', 'email_address', 'email', false, { sensitive: true, final_only: true }),
  field('paid_preparer_block', 2, 'Paid Preparer Use Only', 'Paid Preparer Use Only', 'Preparer name, signature, date, PTIN, self-employed checkbox, firm name, phone, address, EIN', 'paid_preparer_block', 'preparer_block', false, { final_only: true, signature_or_perjury: true, mapping_status: 'must remain blank unless a verified preparer is actually preparing/signing the final return' })
];

const IRS_1040X_SAMPLE_CASES = [
  {
    key: 'missed_education_credit_sample',
    label: 'Missed education credit review',
    purpose: 'Tests a common amendment-opportunity path with line 15 refundable/nonrefundable credit questions and support-document checklist without real sensitive data.',
    answers: {
      return_year: '2024',
      amending_return_type: '1040',
      filed_original_return: 'yes',
      taxpayer_first_middle: 'Sample A',
      taxpayer_last_name: 'Taxpayer',
      taxpayer_last4: '1234',
      current_address: '123 Main Street, Albany, NY 12207',
      amended_filing_status: 'Single',
      original_filing_status: 'Single',
      amendment_reason_categories: ['missed_credit', 'education_credit'],
      line_1_original: '42000',
      line_1_net_change: '0',
      line_1_correct: '42000',
      line_15_original: '0',
      line_15_net_change: '850',
      line_15_correct: '850',
      line_22_refund_amount_requested: '850',
      explanation_of_changes: 'Sample only: taxpayer believes education credit was omitted from the original return. Needs Form 8863/supporting document review before filing.',
      changed_items_summary: 'Possible Form 8863 education credit change.',
      supporting_documents_list: 'Sample Form 1098-T, education payment records, original filed return, corrected Form 1040 schedules.',
      federal_refund_deadline_review_needed: 'yes',
      state_or_city_amendment_needed: 'unknown'
    }
  },
  {
    key: 'schedule_c_expense_sample',
    label: 'Self-employed Schedule C expense correction',
    purpose: 'Tests business/self-employment amendment triggers, Schedule C attachment checklist, and professional review routing.',
    answers: {
      return_year: '2023',
      amending_return_type: '1040',
      filed_original_return: 'yes',
      taxpayer_first_middle: 'Sample B',
      taxpayer_last_name: 'Contractor',
      taxpayer_last4: '6789',
      current_address: '456 Market Avenue, Brooklyn, NY 11201',
      amended_filing_status: 'Head of household',
      original_filing_status: 'Head of household',
      amendment_reason_categories: ['business_expense', 'schedule_c', 'self_employment'],
      line_1_original: '76000',
      line_1_net_change: '-4200',
      line_1_correct: '71800',
      line_5_original: '62000',
      line_5_net_change: '-4200',
      line_5_correct: '57800',
      explanation_of_changes: 'Sample only: potential missed Schedule C vehicle and supplies expense. Needs books/records and corrected Schedule C review before any amendment.',
      changed_items_summary: 'Possible Schedule C expense correction and state amendment review.',
      supporting_documents_list: 'Original return, corrected Schedule C draft, receipts, mileage log, bookkeeping summary, NYS return copy.',
      federal_refund_deadline_review_needed: 'yes',
      state_or_city_amendment_needed: 'yes'
    }
  }
];

function build1040XFieldMapReport() {
  const sections = [...new Set(IRS_1040X_FIELD_MAP.map((f) => f.section))];
  return {
    version: VERSION,
    source: IRS_1040X_OFFICIAL_SOURCE,
    policy: IRS_1040X_OUTPUT_POLICY,
    field_count: IRS_1040X_FIELD_MAP.length,
    sections,
    sensitive_field_count: IRS_1040X_FIELD_MAP.filter((f) => f.sensitive).length,
    signature_or_preparer_field_count: IRS_1040X_FIELD_MAP.filter((f) => f.signature_or_perjury || f.section === 'Paid Preparer Use Only').length,
    mapping_status: 'logical_map_ready_official_pdf_field_names_or_coordinates_not_locked',
    fields: IRS_1040X_FIELD_MAP
  };
}

function build1040XOrganizerSchema() {
  return {
    version: VERSION,
    title: 'IRS Form 1040-X controlled amended-return organizer',
    source: IRS_1040X_OFFICIAL_SOURCE,
    public_mode: 'no_full_ssn_no_dependent_ssn_no_ip_pin_no_signature',
    start_questions: [
      'Which tax year are you trying to amend?',
      'Which return did you originally file: 1040, 1040-SR, 1040-NR, or not sure?',
      'Did you already file the original return for that year?',
      'Are you trying to add a missed deduction, credit, dependent, business expense, income correction, filing status change, or respond to an IRS/state notice?',
      'Do you have a copy of the original filed return and any IRS/NYS/NYC notice connected to that year?',
      'Do you want a refund claim, balance reduction, mistake correction, or professional review before deciding?',
      'Do you also need state or city amendment review?'
    ],
    sections: [
      { key: 'fit_and_deadline', title: 'Fit and deadline screening', fields: ['return_year', 'amending_return_type', 'filed_original_return', 'federal_refund_deadline_review_needed', 'state_or_city_amendment_needed'] },
      { key: 'identity_no_sensitive', title: 'Identity/contact organizer', fields: ['taxpayer_first_middle', 'taxpayer_last_name', 'taxpayer_last4', 'spouse_first_middle', 'spouse_last_name', 'current_address'] },
      { key: 'filing_status', title: 'Filing status review', fields: ['original_filing_status', 'amended_filing_status', 'mfs_spouse_name_or_hoh_qss_child_name'] },
      { key: 'amount_changes', title: 'Original / net change / corrected amount grid', fields: IRS_1040X_FIELD_MAP.filter((f) => f.column).map((f) => f.key) },
      { key: 'dependents', title: 'Dependent changes', fields: IRS_1040X_FIELD_MAP.filter((f) => f.repeat_group === 'dependents' || f.section === 'Part I Dependents').map((f) => f.key) },
      { key: 'explanation_and_documents', title: 'Explanation and supporting documents', fields: ['explanation_of_changes', 'changed_items_summary', 'supporting_documents_list'] },
      { key: 'blocked_final_fields', title: 'Final-only fields blocked until release', fields: IRS_1040X_FIELD_MAP.filter((f) => f.final_only || f.signature_or_perjury || f.sensitive).map((f) => f.key) }
    ],
    field_map: IRS_1040X_FIELD_MAP
  };
}

function buildReviewTriggers(answers = {}) {
  const joined = JSON.stringify(answers).toLowerCase();
  const triggers = [];
  const add = (key, label, role, severity = 'review') => triggers.push({ key, label, recommended_review: role, severity });
  if (joined.includes('schedule c') || joined.includes('business') || joined.includes('self') || joined.includes('1099') || joined.includes('depreciation') || joined.includes('vehicle') || joined.includes('home office')) add('business_or_schedule_c_change', 'Business, Schedule C, self-employment, depreciation, vehicle, or home-office issue may need accountant/CPA/EA review.', 'CPA/EA/accountant review', 'high');
  if (joined.includes('dependent') || joined.includes('child tax') || joined.includes('credit for other dependents') || answers.line_25_net_change || answers.line_27_net_change) add('dependent_or_child_credit_change', 'Dependent or child-credit change requires careful eligibility and support-document review.', 'PTIN/CPA/EA review', 'review');
  if (joined.includes('education') || joined.includes('8863') || joined.includes('1098-t')) add('education_credit_change', 'Education credit change may require Form 8863 and Form 1098-T/payment record review.', 'PTIN/CPA review', 'review');
  if (joined.includes('nol') || answers.line_1_nol_carryback_included) add('nol_or_carryback', 'NOL/carryback or unused-credit carryback issues are high-complexity.', 'CPA/EA/tax attorney review', 'high');
  if (joined.includes('notice') || joined.includes('cp2000') || joined.includes('audit') || joined.includes('exam')) add('notice_connected_amendment', 'Amendment connected to an IRS/NYS/NYC notice should be reviewed before any filing response.', 'EA/CPA/tax attorney review', 'high');
  if (joined.includes('filing status') || answers.original_filing_status !== answers.amended_filing_status) add('filing_status_change', 'Filing-status changes can be restricted after deadlines and need review.', 'PTIN/CPA/EA review', 'high');
  if (answers.state_or_city_amendment_needed === 'yes') add('state_city_followup', 'Federal amendment may require state/city amendment review.', 'state/local tax review', 'review');
  if (moneyNumber(answers.line_22_refund_amount_requested) > 0 || moneyNumber(answers.line_21_overpaid_on_this_return) > 0) add('refund_claim', 'Refund claims require deadline review and support documents; no refund is guaranteed.', 'PTIN/CPA/EA review', 'review');
  if (moneyNumber(answers.line_20_amount_you_owe) > 0) add('additional_tax_due', 'Additional tax due may create interest/penalty/payment-plan questions.', 'PTIN/EA review', 'review');
  if (joined.includes('deceased') || joined.includes('1310')) add('deceased_taxpayer_refund', 'Refund claim for a deceased taxpayer may require Form 1310 and estate/personal representative review.', 'CPA/EA/tax attorney review', 'high');
  return triggers;
}

function validate1040XAnswers(answers = {}) {
  const missing = [];
  const warnings = [];
  const errors = [];
  const required = ['return_year', 'amending_return_type', 'filed_original_return', 'taxpayer_first_middle', 'taxpayer_last_name', 'current_address', 'amended_filing_status', 'explanation_of_changes', 'changed_items_summary'];
  required.forEach((key) => { if (!answers[key]) missing.push(key); });
  if (String(answers.filed_original_return || '').toLowerCase() === 'no') errors.push('Form 1040-X is generally for changing a return already filed. A new or prior-year original return intake may be the better path.');
  if (answers.filed_original_return && !['yes', 'true'].includes(String(answers.filed_original_return).toLowerCase())) warnings.push('Confirm that the original return was actually filed before preparing Form 1040-X.');
  if (!answers.supporting_documents_list) warnings.push('Supporting documents and changed schedules/forms must be listed before professional release.');
  if (!answers.federal_refund_deadline_review_needed) warnings.push('Federal refund/amendment deadline review has not been documented.');
  if (answers.original_filing_status && answers.amended_filing_status && answers.original_filing_status !== answers.amended_filing_status) warnings.push('Filing-status change detected. Review deadline restrictions and original filing status before action.');
  if (moneyNumber(answers.line_22_refund_amount_requested) > 0 && !answers.federal_refund_deadline_review_needed) warnings.push('Refund amount requested but deadline review is missing.');
  const finalOnlyProvided = ['taxpayer_ssn', 'spouse_ssn', 'taxpayer_ip_pin', 'spouse_ip_pin', 'dependent_1_ssn', 'dependent_2_ssn', 'dependent_3_ssn', 'dependent_4_ssn', 'taxpayer_signature', 'spouse_signature', 'paid_preparer_block'].filter((key) => answers[key]);
  if (finalOnlyProvided.length) errors.push(`Final-only sensitive/signature/preparer fields must not be collected in public organizer mode: ${finalOnlyProvided.join(', ')}`);
  return { missing, warnings, errors };
}

function buildLineReview(answers = {}) {
  const watchedLines = ['1','2','4a','4b','6','7','10','12','13','14','15','16','18','20','21','22','23','25','27'];
  return watchedLines.map((line) => {
    const original = moneyNumber(answers[`line_${line}_original`]);
    const netChange = moneyNumber(answers[`line_${line}_net_change`]);
    const correct = moneyNumber(answers[`line_${line}_correct`]);
    const hasData = [answers[`line_${line}_original`], answers[`line_${line}_net_change`], answers[`line_${line}_correct`]].some((v) => v !== undefined && v !== null && v !== '');
    const expectedCorrect = original + netChange;
    const deltaOk = !hasData || !answers[`line_${line}_correct`] || Math.abs(expectedCorrect - correct) < 1;
    return { line, original, net_change: netChange, correct, has_data: hasData, expected_correct_from_a_plus_b: expectedCorrect, math_check: deltaOk ? 'ok_or_not_enough_data' : 'review_difference' };
  }).filter((row) => row.has_data || row.math_check === 'review_difference');
}

function build1040XCompletionPlan(answers = {}, options = {}) {
  const validation = validate1040XAnswers(answers);
  const reviewTriggers = buildReviewTriggers(answers);
  const lineReview = buildLineReview(answers);
  const supportChecklist = [
    'Original filed federal return for the year being amended',
    'Corrected Form 1040, 1040-SR, or 1040-NR showing the changed amounts',
    'All new or changed schedules and forms, such as Schedule C, Schedule 8812, Form 8863, Form 8962, or other relevant forms',
    'IRS/NYS/NYC notice connected to the year, if any, with sensitive details redacted for public mode',
    'Proof for changed deductions, credits, income, dependents, business expenses, withholding, estimated payments, or other changed items',
    'State/city return copies if the federal amendment may require a state or city amendment',
    'Deadline/revised refund claim review notes'
  ];
  const outputGate = {
    current_status: 'blocked_final_output_controlled_organizer_only',
    sample_or_internal_draft_allowed: validation.errors.length === 0,
    client_output_allowed: false,
    reasons_blocked: IRS_1040X_OUTPUT_POLICY.blocked_until_final_qa,
    gates_needed: [
      'official PDF checksum recorded',
      'field names or overlay coordinates locked',
      'sample-filled PDF visual QA passed',
      'corrected return and changed schedules attached/reviewed',
      'deadline review documented',
      'client verification completed',
      'verified preparer/professional release where required',
      'signature/preparer controls approved',
      'production sensitive-data gate approved',
      'staff final release approval recorded'
    ]
  };
  return {
    ok: validation.errors.length === 0,
    version: VERSION,
    source: IRS_1040X_OFFICIAL_SOURCE,
    validation,
    review_triggers: reviewTriggers,
    line_review: lineReview,
    support_checklist: supportChecklist,
    client_summary: {
      heading: 'IRS Form 1040-X amendment organizer summary',
      message: 'This organizer helps review whether a personal amended return may be worth preparing. It is not final IRS output, e-file, agency submission, or a guarantee of refund/savings/acceptance.',
      careful_deadline_note: IRS_1040X_OUTPUT_POLICY.deadline_language,
      professional_review_note: IRS_1040X_OUTPUT_POLICY.professional_review_default
    },
    output_gate: outputGate,
    options_used: {
      client_verified: Boolean(options.clientVerified),
      staff_released: Boolean(options.staffReleased),
      production_sensitive_gate: Boolean(options.productionSensitiveGate),
      signature_controls_approved: Boolean(options.signatureControlsApproved)
    }
  };
}

function build1040XOutputReadiness({ store } = {}) {
  return {
    version: VERSION,
    source: IRS_1040X_OFFICIAL_SOURCE,
    policy: IRS_1040X_OUTPUT_POLICY,
    readiness: 'blocked_final_client_output',
    public_organizer_ready_for_controlled_testing: true,
    logical_map_ready: true,
    final_pdf_output_ready: false,
    efile_ready: false,
    agency_submission_ready: false,
    sensitive_public_uploads_ready: false,
    official_source_library_status: store ? 'store_available_for_future_source_records' : 'store_not_checked',
    next_steps: [
      'capture/record official Form 1040-X PDF source and checksum',
      'lock official PDF field names or coordinates',
      'generate sample-filled QA overlays',
      'visually compare sample output',
      'test overflow and attachment checklist behavior',
      'verify deadline and state/city amendment prompts',
      'approve client verification and professional release workflow',
      'keep public mode no-sensitive until production gates are approved'
    ]
  };
}

function build1040XSampleCases() {
  return IRS_1040X_SAMPLE_CASES;
}

function build1040XSampleFillAudit(answers = {}, options = {}) {
  const plan = build1040XCompletionPlan(answers, options);
  const qa = [];
  if (plan.validation.errors.length) qa.push(...plan.validation.errors.map((msg) => ({ severity: 'blocker', message: msg })));
  if (plan.validation.missing.length) qa.push({ severity: 'missing', message: `Missing organizer fields: ${plan.validation.missing.join(', ')}` });
  plan.validation.warnings.forEach((message) => qa.push({ severity: 'warning', message }));
  plan.line_review.filter((row) => row.math_check === 'review_difference').forEach((row) => qa.push({ severity: 'math_review', message: `Line ${row.line} correct amount does not appear to equal original plus net change. Verify before any final output.` }));
  plan.review_triggers.forEach((trigger) => qa.push({ severity: trigger.severity, message: trigger.label }));
  qa.push({ severity: 'gate', message: 'Signature, IP PIN, SSN, dependent SSN, and paid-preparer blocks remain blank in public/internal QA mode.' });
  qa.push({ severity: 'gate', message: 'Final IRS Form 1040-X output remains blocked until official PDF, coordinate/field lock, visual QA, client verification, professional release, and staff approval pass.' });
  return { version: VERSION, print_ready: false, organizer_draft_ready: plan.ok, qa, plan };
}

function build1040XVerificationSheet(answers = {}, options = {}) {
  const plan = build1040XCompletionPlan(answers, options);
  return {
    version: VERSION,
    form: '1040-X',
    source: IRS_1040X_OFFICIAL_SOURCE,
    release_status: 'internal_verification_only_final_output_blocked',
    client_verification_items: [
      'The return year being amended is correct.',
      'The original filed return type and filing status are correct.',
      'All changed amounts are verified against the original return and corrected return.',
      'Part II explanation accurately explains every change.',
      'All supporting documents and changed schedules/forms are listed and available.',
      'Refund/amendment deadline review has been completed before action.',
      'State/city amended-return impact has been reviewed where applicable.',
      'No final signature or filing should occur until staff/professional release is complete.'
    ],
    staff_verification_items: [
      'Confirm no full SSNs, dependent SSNs, IP PINs, signatures, or preparer block data were collected in public mode.',
      'Confirm professional review routing based on review triggers.',
      'Confirm corrected Form 1040/1040-SR/1040-NR and changed schedules are attached or requested.',
      'Confirm deadline language is cautious and does not guarantee refund/savings/acceptance.',
      'Confirm final output remains blocked unless all release gates are documented.'
    ],
    validation: plan.validation,
    review_triggers: plan.review_triggers,
    line_review: plan.line_review,
    output_gate: plan.output_gate
  };
}

function create1040XDraftPdfBuffer(answers = {}, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      const plan = build1040XCompletionPlan(answers, options);
      doc.fontSize(17).text('Justice Tax Solutions - IRS Form 1040-X Organizer QA Packet', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text('Internal/redacted/sample organizer only. This is not final IRS Form 1040-X output, e-file, agency submission, legal advice, tax determination, or a guarantee of refund/savings/acceptance. Signature, SSN, IP PIN, and paid-preparer fields remain blocked until release gates pass.');
      doc.moveDown();
      doc.fontSize(12).text(`Return year: ${answers.return_year || 'Not provided'}`);
      doc.text(`Taxpayer: ${(answers.taxpayer_first_middle || '').trim()} ${(answers.taxpayer_last_name || '').trim()}`.trim() || 'Taxpayer not provided');
      doc.text(`Original return type: ${answers.amending_return_type || 'Not provided'}`);
      doc.text(`Filing status: ${answers.amended_filing_status || 'Not provided'}`);
      doc.moveDown();
      doc.fontSize(13).text('Validation', { underline: true });
      doc.fontSize(10).text(`Missing: ${plan.validation.missing.length ? plan.validation.missing.join(', ') : 'None'}`);
      doc.text(`Warnings: ${plan.validation.warnings.length ? plan.validation.warnings.join(' | ') : 'None'}`);
      doc.text(`Errors: ${plan.validation.errors.length ? plan.validation.errors.join(' | ') : 'None'}`);
      doc.moveDown();
      doc.fontSize(13).text('Changed items summary', { underline: true });
      doc.fontSize(10).text(String(answers.changed_items_summary || 'Not provided').slice(0, 1800));
      doc.moveDown();
      doc.fontSize(13).text('Part II explanation draft', { underline: true });
      doc.fontSize(10).text(String(answers.explanation_of_changes || 'Not provided').slice(0, 2200));
      doc.moveDown();
      doc.fontSize(13).text('Line review', { underline: true });
      if (!plan.line_review.length) doc.fontSize(10).text('No changed line data supplied.');
      plan.line_review.slice(0, 18).forEach((row) => doc.fontSize(9).text(`Line ${row.line}: A ${row.original} | B ${row.net_change} | C ${row.correct} | check: ${row.math_check}`));
      doc.moveDown();
      doc.fontSize(13).text('Review triggers', { underline: true });
      if (!plan.review_triggers.length) doc.fontSize(10).text('No special review triggers detected from sample answers. Staff review still required before any final output.');
      plan.review_triggers.forEach((trigger) => doc.fontSize(9).text(`- ${trigger.label} (${trigger.recommended_review})`));
      doc.addPage();
      doc.fontSize(13).text('Support checklist', { underline: true });
      plan.support_checklist.forEach((item) => doc.fontSize(10).text(`☐ ${item}`));
      doc.moveDown();
      doc.fontSize(13).text('Output gate', { underline: true });
      doc.fontSize(10).text(`Current status: ${plan.output_gate.current_status}`);
      plan.output_gate.gates_needed.forEach((item) => doc.fontSize(9).text(`☐ ${item}`));
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  IRS_1040X_OFFICIAL_SOURCE,
  IRS_1040X_OUTPUT_POLICY,
  build1040XFieldMapReport,
  build1040XOrganizerSchema,
  build1040XCompletionPlan,
  build1040XOutputReadiness,
  build1040XSampleCases,
  build1040XSampleFillAudit,
  build1040XVerificationSheet,
  create1040XDraftPdfBuffer
};
