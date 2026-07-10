const PDFDocument = require('pdfkit');

const VERSION = '0.1.56';

const APPEALS_ABATEMENT_POLICY = {
  status: 'controlled_organizer_and_logical_map_only',
  goal: 'Add IRS penalty abatement/refund and collection-appeal organizers that help users prepare facts safely without enabling final IRS filing, appeals representation, signature capture, or agency submission.',
  current_site_mode: 'no_sensitive_public_organizer',
  allowed_now: [
    'plain-English fit triage for Form 843, Form 9423, and Form 12153',
    'logical official section and line maps from current IRS forms/instructions',
    'no-sensitive organizer questions using last-4 identifiers, approximate amounts, and redacted notice details',
    'missing-information checklists, urgency flags, deadline prompts, and staff/professional-review triggers',
    'internal/staff verification sheets and sample QA packets using redacted or sample values'
  ],
  blocked_until_final_qa: [
    'final official IRS Form 843, 9423, or 12153 output for signature or filing',
    'IRS mail, fax, Tax Pro Account, online upload, or agency-submission claims',
    'full SSN/ITIN/EIN collection in public mode',
    'appeals representation claims unless an eligible representative is assigned and authorized',
    'deadline calculation guarantees or promises that collection will stop',
    'signature, perjury declaration, preparer, or representative signature output'
  ],
  professional_review_default: 'Penalty abatement/refund claims and collection appeals should receive staff review and likely EA/CPA/tax-attorney review before any final IRS-ready output or submission.'
};

const IRS_APPEALS_ABATEMENT_SOURCES = {
  '843': {
    agency: 'IRS',
    form_number: '843',
    title: 'Claim for Refund and Request for Abatement',
    revision: 'Rev. December 2024',
    instructions_revision: 'Rev. December 2024',
    source_url: 'https://www.irs.gov/pub/irs-pdf/f843.pdf',
    instructions_url: 'https://www.irs.gov/pub/irs-pdf/i843.pdf',
    about_url: 'https://www.irs.gov/forms-pubs/about-form-843',
    source_page_url: 'https://www.irs.gov/forms-instructions',
    pages: 2,
    status: 'official_source_identified_logical_map_ready',
    purpose: 'Used to claim a refund or request abatement of certain taxes, interest, penalties, fees, and additions to tax.',
    user_fit: 'Best for penalty abatement/refund, certain interest-abatement, and certain refund/abatement claims when another more specific form is not required.',
    do_not_use_warning: 'Do not use Form 843 when a different tax form is required, such as many income-tax refund/overpayment claims or certain payroll/excise claims.',
    client_output_rule: 'Organizer only. Final IRS-ready Form 843 output remains blocked until official PDF capture/checksum, field/coordinate lock, sample visual QA, claim computation verification, taxpayer/preparer review, signature controls, and staff/professional release pass.'
  },
  '9423': {
    agency: 'IRS',
    form_number: '9423',
    title: 'Collection Appeal Request',
    revision: 'Rev. February 2020',
    instructions_revision: 'Included on reverse side of form',
    source_url: 'https://www.irs.gov/pub/irs-pdf/f9423.pdf',
    instructions_url: 'https://www.irs.gov/pub/irs-pdf/f9423.pdf',
    about_url: '',
    source_page_url: 'https://www.irs.gov/forms-instructions',
    pages: 2,
    status: 'official_source_identified_logical_map_ready',
    purpose: 'Used for Collection Appeals Program requests involving liens, levies, seizures, and rejection/modification/termination of installment agreements.',
    user_fit: 'Best when a taxpayer disagrees with a collection action or installment-agreement action and needs a fast, properly routed CAP request.',
    client_output_rule: 'Organizer only. Final Form 9423 output remains blocked until collection action, manager conference/timing facts, supporting documents, representative authority, signature controls, and staff/professional release are verified.'
  },
  '12153': {
    agency: 'IRS',
    form_number: '12153',
    title: 'Request for a Collection Due Process or Equivalent Hearing',
    revision: 'Rev. July 2022',
    instructions_revision: 'Included in form packet',
    source_url: 'https://www.irs.gov/pub/irs-pdf/f12153.pdf',
    instructions_url: 'https://www.irs.gov/pub/irs-pdf/f12153.pdf',
    spanish_url: 'https://www.irs.gov/pub/irs-pdf/f12153sp.pdf',
    source_page_url: 'https://www.irs.gov/forms-instructions',
    pages: 4,
    status: 'official_source_identified_logical_map_ready',
    purpose: 'Used to request a Collection Due Process or Equivalent Hearing with IRS Appeals after receiving a CDP lien or levy notice.',
    user_fit: 'Best when the user has a notice offering CDP appeal rights for lien or levy action and needs to preserve/organize the hearing request path.',
    client_output_rule: 'Organizer only. Final Form 12153 output remains blocked until notice type/deadline, address, tax periods, reasons, collection alternatives, Form 433-A/433-B need, signature controls, and staff/professional release are verified.'
  }
};

function normalizeFormNumber(value) {
  return String(value || '').toLowerCase().replace(/^form\s*/, '').replace(/[^0-9]/g, '');
}

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

const IRS_843_FIELD_MAP = [
  field('843', 'filing_reason_tax_other', 1, 'Top checklist', 'Reason for filing', 'Abatement or refund of tax other than income, estate, or gift tax', 'filing_reason_tax_other', 'checkbox', false),
  field('843', 'filing_reason_only_843', 1, 'Top checklist', 'Reason for filing', 'Abatement or refund of tax that cannot be claimed on any form except Form 843', 'filing_reason_only_843', 'checkbox', false),
  field('843', 'filing_reason_excess_ss_medicare', 1, 'Top checklist', 'Reason for filing', 'Refund to employee of excess social security, Medicare, or RRTA tax withheld by one employer', 'filing_reason_excess_ss_medicare', 'checkbox', false),
  field('843', 'filing_reason_penalty_reasonable_cause', 1, 'Top checklist', 'Penalty', 'Abatement or refund of a penalty or addition to tax due to reasonable cause or other reason allowed under the law', 'filing_reason_penalty_reasonable_cause', 'checkbox', false),
  field('843', 'filing_reason_tfrp', 1, 'Top checklist', 'Penalty', 'Abatement or refund of penalty imposed under section 6672 (Trust Fund Recovery Penalty)', 'filing_reason_tfrp', 'checkbox', false, { conditional: 'trust_fund_recovery_penalty_issue', qa_rule: 'High-risk business/payroll issue; likely tax attorney or EA/CPA review.' }),
  field('843', 'filing_reason_erroneous_written_advice', 1, 'Top checklist', 'Penalty', 'Abatement/refund under section 6404(f) for erroneous written IRS advice', 'filing_reason_erroneous_written_advice', 'checkbox', false),
  field('843', 'filing_reason_interest_error_delay', 1, 'Top checklist', 'Interest', 'Abatement or refund of interest due to IRS error or delay under section 6404(e)(1)', 'filing_reason_interest_error_delay', 'checkbox', false),
  field('843', 'filing_reason_notice_accessibility', 1, 'Top checklist', 'Other', 'Abatement/refund because unable to read and timely respond to a standard print notice from the IRS', 'filing_reason_notice_accessibility', 'checkbox', false),
  field('843', 'filing_reason_other', 1, 'Top checklist', 'Other', 'Other reason (specify)', 'filing_reason_other', 'long_text', false, { max_length: 220 }),
  field('843', 'taxpayer_name', 1, 'Header', 'Taxpayer information', 'Name of person requesting the refund or abatement', 'taxpayer_name', 'text', true),
  field('843', 'taxpayer_tin', 1, 'Header', 'Taxpayer information', 'Social security number / EIN', 'taxpayer_tin', 'tin', false, { sensitive: true, final_only: true, required_for_final_output: true, formatting: 'SSN/ITIN/EIN; not collected in public mode' }),
  field('843', 'taxpayer_last4', 1, 'Header', 'Taxpayer information', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer_last4', 'text', false, { formatting: '####', required_for_final_output: false }),
  field('843', 'spouse_name', 1, 'Header', 'Joint return information', 'Name of spouse if filing Form 843 relating to a joint return', 'spouse_name', 'text', false),
  field('843', 'spouse_tin', 1, 'Header', 'Joint return information', 'Spouse social security number', 'spouse_tin', 'tin', false, { sensitive: true, final_only: true, required_for_final_output: false }),
  field('843', 'address', 1, 'Header', 'Address', 'Address', 'address', 'text', true),
  field('843', 'city', 1, 'Header', 'Address', 'City, town, or post office', 'city', 'text', true),
  field('843', 'state', 1, 'Header', 'Address', 'State', 'state', 'text', true),
  field('843', 'zip', 1, 'Header', 'Address', 'ZIP code', 'zip', 'text', true),
  field('843', 'foreign_address', 1, 'Header', 'Foreign address', 'Foreign country/province/postal code', 'foreign_address', 'long_text', false),
  field('843', 'return_name_address_different', 1, 'Header', 'Return information', 'Name and address shown on return if different from above', 'return_name_address_different', 'long_text', false),
  field('843', 'daytime_phone', 1, 'Header', 'Contact', 'Daytime telephone number', 'daytime_phone', 'phone', true),
  field('843', 'period_begin', 1, '1', 'Tax period or fee year', 'Beginning date', 'period_begin', 'date', true, { formatting: 'MM/DD/YYYY' }),
  field('843', 'period_end', 1, '1', 'Tax period or fee year', 'Ending date', 'period_end', 'date', true, { formatting: 'MM/DD/YYYY' }),
  field('843', 'amount_requested', 1, '2', 'Amount', 'Amount to be refunded or abated', 'amount_requested', 'currency', true),
  ...repeatFields('843', 'payment_date', 12, ['date'], 1, '3', 'Payment date', ['Date of payment'], ['date']),
  field('843', 'tax_type_employment', 1, '4a', 'Type of tax or fee', 'Employment', 'tax_type_employment', 'checkbox', false),
  field('843', 'tax_type_estate', 1, '4b', 'Type of tax or fee', 'Estate', 'tax_type_estate', 'checkbox', false),
  field('843', 'tax_type_gift', 1, '4c', 'Type of tax or fee', 'Gift', 'tax_type_gift', 'checkbox', false),
  field('843', 'tax_type_excise', 1, '4d', 'Type of tax or fee', 'Excise', 'tax_type_excise', 'checkbox', false),
  field('843', 'tax_type_income', 1, '4e', 'Type of tax or fee', 'Income', 'tax_type_income', 'checkbox', false, { qa_rule: 'Do not use Form 843 for many income-tax refund/overpayment claims where an amended return or other form is required.' }),
  field('843', 'tax_type_fee', 1, '4f', 'Type of tax or fee', 'Fee', 'tax_type_fee', 'checkbox', false),
  field('843', 'tax_type_civil_penalty', 1, '4g', 'Type of tax or fee', 'Civil penalty', 'tax_type_civil_penalty', 'checkbox', false),
  field('843', 'related_return_1040', 2, '5i', 'Related return/fee', '1040', 'related_return_1040', 'checkbox', false),
  field('843', 'related_return_941', 2, '5d', 'Related return/fee', '941', 'related_return_941', 'checkbox', false),
  field('843', 'related_return_other', 2, '5n', 'Related return/fee', 'Other (specify)', 'related_return_other', 'text', false),
  field('843', 'penalty_code_section', 2, '6', 'Penalty code section', 'Internal Revenue Code section', 'penalty_code_section', 'text', false),
  field('843', 'reason_irs_error_delay', 2, '7a', 'Reason for refund/abatement', 'Interest was assessed because of IRS errors or delays', 'reason_irs_error_delay', 'checkbox', false),
  field('843', 'reason_erroneous_written_advice', 2, '7b', 'Reason for refund/abatement', 'Penalty/addition resulted from erroneous written IRS advice', 'reason_erroneous_written_advice', 'checkbox', false),
  field('843', 'reason_reasonable_cause', 2, '7c', 'Reason for refund/abatement', 'Reasonable cause or other reason allowed under law can be shown', 'reason_reasonable_cause', 'checkbox', false),
  field('843', 'reason_none_above', 2, '7d', 'Reason for refund/abatement', 'None of the above reasons apply', 'reason_none_above', 'checkbox', false),
  field('843', 'explanation_and_computation', 2, '8', 'Explanation/computation', 'Explain why claim should be allowed and show computation of amount on line 2', 'explanation_and_computation', 'long_text', true, { max_length: 2400 }),
  field('843', 'supporting_docs_summary', 2, 'Attachment', 'Supporting facts', 'Supporting documents summary (redacted/sample only)', 'supporting_docs_summary', 'long_text', false, { max_length: 1200 }),
  field('843', 'taxpayer_signature', 2, 'Signature', 'Signature', 'Taxpayer signature', 'taxpayer_signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('843', 'taxpayer_signature_date', 2, 'Signature', 'Date', 'Taxpayer signature date', 'taxpayer_signature_date', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('843', 'spouse_signature', 2, 'Signature', 'Spouse signature', 'Spouse signature if joint return claim', 'spouse_signature', 'signature', false, { signature_or_perjury: true, final_only: true }),
  field('843', 'ip_pin', 2, 'Signature', 'IP PIN', 'Identity Protection PIN if IRS sent one', 'ip_pin', 'text', false, { sensitive: true, final_only: true }),
  field('843', 'preparer_use_only', 2, 'Paid preparer', 'Paid preparer use only', 'Paid preparer use only fields', 'preparer_use_only', 'section', false, { final_only: true, sensitive: true })
];

const IRS_9423_FIELD_MAP = [
  field('9423', 'taxpayer_name', 1, '1', 'Taxpayer information', 'Taxpayer name', 'taxpayer_name', 'text', true),
  field('9423', 'representative_name', 1, '2', 'Representative', 'Representative (attach Form 2848)', 'representative_name', 'text', false, { conditional: 'representative involved' }),
  field('9423', 'taxpayer_tin', 1, '3', 'Taxpayer information', 'SSN/EIN', 'taxpayer_tin', 'tin', false, { sensitive: true, final_only: true, required_for_final_output: true }),
  field('9423', 'taxpayer_last4', 1, '3', 'Taxpayer information', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer_last4', 'text', false, { formatting: '####' }),
  field('9423', 'business_phone', 1, '4', 'Contact', 'Taxpayer business phone', 'business_phone', 'phone', false),
  field('9423', 'home_phone', 1, '5', 'Contact', 'Taxpayer home phone', 'home_phone', 'phone', false),
  field('9423', 'representative_phone', 1, '6', 'Representative', 'Representative phone', 'representative_phone', 'phone', false),
  field('9423', 'street_address', 1, '7', 'Address', 'Street address', 'street_address', 'text', true),
  field('9423', 'city', 1, '8', 'Address', 'City', 'city', 'text', true),
  field('9423', 'state', 1, '9', 'Address', 'State', 'state', 'text', true),
  field('9423', 'zip', 1, '10', 'Address', 'ZIP code', 'zip', 'text', true),
  field('9423', 'tax_form_type', 1, '11', 'Tax information', 'Type of tax / tax form', 'tax_form_type', 'text', true),
  field('9423', 'tax_periods', 1, '12', 'Tax information', 'Tax periods being appealed', 'tax_periods', 'text', true),
  field('9423', 'tax_due_approx', 1, '13', 'Tax information', 'Tax due', 'tax_due_approx', 'currency', false, { qa_rule: 'Use approximate amount in public mode; verify before final.' }),
  field('9423', 'appeal_federal_tax_lien', 1, '14', 'Collection actions appealed', 'Federal tax lien', 'appeal_federal_tax_lien', 'checkbox', false),
  field('9423', 'appeal_levy', 1, '14', 'Collection actions appealed', 'Levy or proposed levy', 'appeal_levy', 'checkbox', false),
  field('9423', 'appeal_seizure', 1, '14', 'Collection actions appealed', 'Seizure', 'appeal_seizure', 'checkbox', false),
  field('9423', 'appeal_ia_rejection', 1, '14', 'Collection actions appealed', 'Rejection of installment agreement', 'appeal_ia_rejection', 'checkbox', false),
  field('9423', 'appeal_ia_termination', 1, '14', 'Collection actions appealed', 'Termination of installment agreement', 'appeal_ia_termination', 'checkbox', false),
  field('9423', 'appeal_ia_modification', 1, '14', 'Collection actions appealed', 'Modification of installment agreement', 'appeal_ia_modification', 'checkbox', false),
  field('9423', 'collection_manager_conference_date', 2, 'Instructions', 'Manager conference / timing', 'Manager conference date or request date', 'collection_manager_conference_date', 'date', false, { qa_rule: 'CAP timing may be very short; staff must verify conference/request dates and postmark/receipt window.' }),
  field('9423', 'explanation_and_solution', 1, '15', 'Explanation', 'Explain disagreement and how you would resolve the tax problem', 'explanation_and_solution', 'long_text', true, { max_length: 2200 }),
  field('9423', 'supporting_documents_summary', 1, '15', 'Supporting documents', 'Supporting documents summary (redacted/sample only)', 'supporting_documents_summary', 'long_text', false),
  field('9423', 'taxpayer_or_rep_signature_box', 1, '16', 'Signature', 'Taxpayer or authorized representative signature box', 'taxpayer_or_rep_signature_box', 'checkbox', false, { signature_or_perjury: true, final_only: true }),
  field('9423', 'signature', 1, '16', 'Signature', 'Taxpayer or authorized representative signature', 'signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('9423', 'date_signed', 1, '17', 'Signature', 'Date signed', 'date_signed', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('9423', 'irs_use_only', 1, '18-29', 'IRS use only', 'Revenue officer / collection manager fields', 'irs_use_only', 'section', false, { final_only: true, mapping_status: 'leave_blank_for_client_output' })
];

const IRS_12153_FIELD_MAP = [
  field('12153', 'basis_lien', 1, '1', 'Basis for hearing request', 'Filed Notice of Federal Tax Lien', 'basis_lien', 'checkbox', false),
  field('12153', 'basis_levy', 1, '1', 'Basis for hearing request', 'Notice of Proposed or Actual Levy', 'basis_levy', 'checkbox', false),
  field('12153', 'equivalent_hearing_requested', 1, '2', 'Equivalent Hearing', 'If request is not timely, request equivalent hearing', 'equivalent_hearing_requested', 'checkbox', false),
  field('12153', 'taxpayer1_name', 1, '3', 'Taxpayer 1', 'Taxpayer name', 'taxpayer1_name', 'text', true),
  field('12153', 'taxpayer1_tin', 1, '3', 'Taxpayer 1', 'Taxpayer identification number', 'taxpayer1_tin', 'tin', false, { sensitive: true, final_only: true, required_for_final_output: true }),
  field('12153', 'taxpayer1_last4', 1, '3', 'Taxpayer 1', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer1_last4', 'text', false, { formatting: '####' }),
  field('12153', 'taxpayer1_address', 1, '3', 'Taxpayer 1', 'Current address', 'taxpayer1_address', 'text', true),
  field('12153', 'taxpayer1_city', 1, '3', 'Taxpayer 1', 'City', 'taxpayer1_city', 'text', true),
  field('12153', 'taxpayer1_state', 1, '3', 'Taxpayer 1', 'State', 'taxpayer1_state', 'text', true),
  field('12153', 'taxpayer1_zip', 1, '3', 'Taxpayer 1', 'ZIP code', 'taxpayer1_zip', 'text', true),
  field('12153', 'taxpayer1_phone_type', 1, '4', 'Taxpayer 1 contact', 'Phone type home/work/cell', 'taxpayer1_phone_type', 'text', false),
  field('12153', 'taxpayer1_phone', 1, '4', 'Taxpayer 1 contact', 'Best telephone number', 'taxpayer1_phone', 'phone', true),
  field('12153', 'taxpayer1_best_time', 1, '4', 'Taxpayer 1 contact', 'Best time to call', 'taxpayer1_best_time', 'text', false),
  field('12153', 'taxpayer2_name', 1, '5', 'Taxpayer 2', 'Taxpayer name', 'taxpayer2_name', 'text', false),
  field('12153', 'taxpayer2_tin', 1, '5', 'Taxpayer 2', 'Taxpayer identification number', 'taxpayer2_tin', 'tin', false, { sensitive: true, final_only: true }),
  field('12153', 'taxpayer2_last4', 1, '5', 'Taxpayer 2', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer2_last4', 'text', false),
  field('12153', 'taxpayer2_address', 1, '5', 'Taxpayer 2', 'Current address if different', 'taxpayer2_address', 'text', false),
  ...repeatFields('12153', 'tax_item', 4, ['type_of_tax', 'tax_form_number', 'tax_period'], 1, '7', 'Tax information row', ['Type of tax', 'Tax form number', 'Tax period or periods'], ['text', 'text', 'text'], { type_of_tax: { required_for_final_output: true }, tax_form_number: { required_for_final_output: true }, tax_period: { required_for_final_output: true } }),
  field('12153', 'reason_not_liable', 2, '8', 'Reason for hearing', 'I am not liable for the tax the IRS is trying to collect', 'reason_not_liable', 'checkbox', false),
  field('12153', 'reason_innocent_spouse', 2, '8', 'Reason for hearing', 'I claim innocent spouse relief', 'reason_innocent_spouse', 'checkbox', false, { qa_rule: 'May require Form 8857 and professional review.' }),
  field('12153', 'reason_bankruptcy_discharge', 2, '8', 'Reason for hearing', 'My taxes were discharged in bankruptcy', 'reason_bankruptcy_discharge', 'checkbox', false, { qa_rule: 'Likely tax attorney/bankruptcy review trigger.' }),
  field('12153', 'reason_payments_not_applied', 2, '8', 'Reason for hearing', "I've made payments that were not applied to my taxes", 'reason_payments_not_applied', 'checkbox', false),
  field('12153', 'reason_lien_withdrawal', 2, '8', 'Reason for hearing', 'I want the Notice of Federal Tax Lien withdrawn', 'reason_lien_withdrawal', 'checkbox', false),
  field('12153', 'reason_hardship', 2, '8', 'Reason for hearing', 'Currently unable to pay due to financial hardship', 'reason_hardship', 'checkbox', false),
  field('12153', 'reason_collection_alternative', 2, '8', 'Reason for hearing', 'Unable to pay in full and would like a collection alternative', 'reason_collection_alternative', 'checkbox', false),
  field('12153', 'reason_other_comments', 2, '8', 'Reason for hearing', 'Other issues/comments', 'reason_other_comments', 'long_text', false, { max_length: 1800 }),
  field('12153', 'alternative_installment_agreement', 2, '9', 'Proposed collection alternative', 'Installment Agreement', 'alternative_installment_agreement', 'checkbox', false),
  field('12153', 'alternative_offer_in_compromise', 2, '9', 'Proposed collection alternative', 'Offer in Compromise', 'alternative_offer_in_compromise', 'checkbox', false),
  field('12153', 'alternative_currently_unable_to_pay', 2, '9', 'Proposed collection alternative', 'Currently Unable to Pay', 'alternative_currently_unable_to_pay', 'checkbox', false),
  field('12153', 'alternative_other', 2, '9', 'Proposed collection alternative', 'Other collection alternative explanation', 'alternative_other', 'long_text', false),
  field('12153', 'cdp_notice_date', 1, 'Notice', 'Notice/deadline triage', 'Date on CDP notice', 'cdp_notice_date', 'date', false, { qa_rule: 'Staff must calculate actual deadline from notice; public tool does not guarantee deadlines.' }),
  field('12153', 'mailing_address_from_notice', 1, 'Notice', 'Notice/deadline triage', 'Address for requesting a hearing shown on CDP notice', 'mailing_address_from_notice', 'long_text', false),
  field('12153', 'notice_summary', 1, 'Notice', 'Notice/deadline triage', 'Redacted notice summary', 'notice_summary', 'long_text', false, { max_length: 1200 }),
  field('12153', 'taxpayer1_signature', 2, '10', 'Signatures', "Taxpayer 1's signature", 'taxpayer1_signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('12153', 'taxpayer1_signature_date', 2, '10', 'Signatures', 'Date', 'taxpayer1_signature_date', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true }),
  field('12153', 'taxpayer2_signature', 2, '10', 'Signatures', "Taxpayer 2's signature if joint", 'taxpayer2_signature', 'signature', false, { signature_or_perjury: true, final_only: true }),
  field('12153', 'representative_signature', 2, '10', 'Signatures', "Representative's signature with executed Form 2848 if signing", 'representative_signature', 'signature', false, { signature_or_perjury: true, final_only: true, conditional: 'authorized representative signs' }),
  field('12153', 'irs_use_only', 2, 'IRS use only', 'IRS use only', 'IRS employee/received date', 'irs_use_only', 'section', false, { final_only: true, mapping_status: 'leave_blank_for_client_output' })
];

const APPEALS_FIELD_MAPS = { '843': IRS_843_FIELD_MAP, '9423': IRS_9423_FIELD_MAP, '12153': IRS_12153_FIELD_MAP };

const SAMPLE_CASES = {
  '843': [
    { label: 'Penalty abatement organizer', answers: { taxpayer_name: 'Sample Client', address: '123 Main St', city: 'Brooklyn', state: 'NY', zip: '11201', daytime_phone: '555-0100', period_begin: '01/01/2023', period_end: '12/31/2023', amount_requested: '850', filing_reason_penalty_reasonable_cause: true, tax_type_civil_penalty: true, reason_reasonable_cause: true, explanation_and_computation: 'Sample facts only: illness, records, timely correction, and computation attached.' } },
    { label: 'High-risk TFRP organizer', answers: { taxpayer_name: 'Sample Business Owner', address: '1 Business Ave', city: 'Queens', state: 'NY', zip: '11101', daytime_phone: '555-0120', period_begin: '04/01/2024', period_end: '06/30/2024', amount_requested: '12000', filing_reason_tfrp: true, tax_type_civil_penalty: true, penalty_code_section: '6672', explanation_and_computation: 'Sample only: trust fund recovery penalty dispute.' } }
  ],
  '9423': [
    { label: 'Installment agreement rejection CAP organizer', answers: { taxpayer_name: 'Sample Client', street_address: '123 Main St', city: 'Brooklyn', state: 'NY', zip: '11201', tax_form_type: '1040', tax_periods: '2023', appeal_ia_rejection: true, explanation_and_solution: 'Sample only: propose affordable monthly payment and explain why rejection is incorrect.' } },
    { label: 'Levy CAP organizer', answers: { taxpayer_name: 'Sample Client', street_address: '123 Main St', city: 'Bronx', state: 'NY', zip: '10451', tax_form_type: '1040', tax_periods: '2021-2022', appeal_levy: true, collection_manager_conference_date: '02/10/2026', explanation_and_solution: 'Sample only: financial hardship, request manager review, and propose collection alternative.' } }
  ],
  '12153': [
    { label: 'Timely CDP levy hearing organizer', answers: { basis_levy: true, taxpayer1_name: 'Sample Client', taxpayer1_address: '123 Main St', taxpayer1_city: 'Brooklyn', taxpayer1_state: 'NY', taxpayer1_zip: '11201', taxpayer1_phone: '555-0100', tax_item_1_type_of_tax: 'Income', tax_item_1_tax_form_number: '1040', tax_item_1_tax_period: '2022', reason_hardship: true, reason_collection_alternative: true, alternative_installment_agreement: true, cdp_notice_date: '02/01/2026', notice_summary: 'Sample redacted Notice CP90/LT11-type summary.' } },
    { label: 'Federal tax lien withdrawal organizer', answers: { basis_lien: true, taxpayer1_name: 'Sample Client', taxpayer1_address: '44 Example Rd', taxpayer1_city: 'New York', taxpayer1_state: 'NY', taxpayer1_zip: '10001', taxpayer1_phone: '555-0188', tax_item_1_type_of_tax: 'Income', tax_item_1_tax_form_number: '1040', tax_item_1_tax_period: '2020-2021', reason_lien_withdrawal: true, reason_other_comments: 'Sample only: explain lien withdrawal facts and proposed resolution.' } }
  ]
};

function getAppealsForm(formNumber) {
  const key = normalizeFormNumber(formNumber);
  const source = IRS_APPEALS_ABATEMENT_SOURCES[key];
  if (!source) throw new Error('Unsupported appeals/abatement form. Supported forms: 843, 9423, 12153.');
  return { key, source, fieldMap: APPEALS_FIELD_MAPS[key] };
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
  if (s.length > 100) s = `${s.slice(0, 97)}...`;
  return s;
}

function selectedKeys(answers, keys) {
  return keys.filter((k) => boolLike(answers[k]));
}

function buildAppealsAbatementFieldMapReport(formNumber) {
  const { key, source, fieldMap } = getAppealsForm(formNumber);
  const sections = Array.from(new Map(fieldMap.map((f) => [f.section, fieldMap.filter((x) => x.section === f.section).length])).entries()).map(([section, field_count]) => ({ section, field_count }));
  return {
    ok: true,
    version: VERSION,
    source,
    policy: APPEALS_ABATEMENT_POLICY,
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

function buildAppealsAbatementOrganizerSchema(formNumber) {
  const report = buildAppealsAbatementFieldMapReport(formNumber);
  return {
    ok: true,
    version: VERSION,
    form: report.source,
    policy: APPEALS_ABATEMENT_POLICY,
    public_mode_warning: 'Do not enter full SSNs, ITINs, EINs, bank/account numbers, signatures, exact private financial details, or unredacted notice text in public mode. Use last 4, approximate amounts, or redacted summaries.',
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

function validateAppealsAbatementAnswers(formNumber, answers = {}) {
  const { key, fieldMap } = getAppealsForm(formNumber);
  const missing = [];
  const warnings = [];
  const errors = [];
  fieldMap.filter((f) => f.required_for_organizer).forEach((f) => {
    if (!has(answers[f.input_key])) missing.push({ input_key: f.input_key, label: f.official_label, section: f.section });
  });
  const tinKeys = ['taxpayer_tin', 'spouse_tin', 'taxpayer1_tin', 'taxpayer2_tin'];
  tinKeys.forEach((k) => {
    if (has(answers[k]) && !/^([0-9]{3}-?[0-9]{2}-?[0-9]{4}|[0-9]{2}-?[0-9]{7}|[0-9]{9})$/.test(String(answers[k]).trim())) {
      errors.push({ input_key: k, label: k, message: 'TIN format should be SSN/ITIN/EIN-like for final output; do not collect full TIN in current public mode.' });
    }
  });
  const answerString = Object.entries(answers).map(([k, v]) => `${k}:${v}`).join(' ');
  if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(answerString) || /\b\d{2}-?\d{7}\b/.test(answerString)) warnings.push('A full SSN/EIN-like value appears in the organizer. Remove or redact it in public mode.');
  if (key === '843') {
    const reasonCount = selectedKeys(answers, ['filing_reason_tax_other','filing_reason_only_843','filing_reason_excess_ss_medicare','filing_reason_penalty_reasonable_cause','filing_reason_tfrp','filing_reason_erroneous_written_advice','filing_reason_interest_error_delay','filing_reason_notice_accessibility','filing_reason_other']).length;
    if (!reasonCount) missing.push({ input_key: 'filing_reason', label: 'Reason for filing Form 843', section: 'Top checklist' });
    const taxTypeCount = selectedKeys(answers, ['tax_type_employment','tax_type_estate','tax_type_gift','tax_type_excise','tax_type_income','tax_type_fee','tax_type_civil_penalty']).length;
    if (!taxTypeCount) warnings.push('No line 4 tax/fee type selected. Staff should verify whether Form 843 is the correct form.');
    if (boolLike(answers.tax_type_income)) warnings.push('Income-tax issues often require a different form such as an amended return rather than Form 843. Staff must verify fit.');
    if (boolLike(answers.filing_reason_tfrp) || /6672|trust fund/i.test(answerString)) warnings.push('Trust Fund Recovery Penalty language is high-risk and should be escalated to EA/CPA/tax attorney review.');
  }
  if (key === '9423') {
    const actionCount = selectedKeys(answers, ['appeal_federal_tax_lien','appeal_levy','appeal_seizure','appeal_ia_rejection','appeal_ia_termination','appeal_ia_modification']).length;
    if (!actionCount) missing.push({ input_key: 'collection_action', label: 'Collection action being appealed', section: 'Line 14' });
    if (!has(answers.collection_manager_conference_date)) warnings.push('CAP deadlines can be very short. Staff must verify manager conference/request date, postmark/receipt rules, and collection-office routing.');
    if (boolLike(answers.appeal_levy) || boolLike(answers.appeal_seizure)) warnings.push('Levy/seizure facts may be urgent. Staff should prioritize and consider professional review.');
  }
  if (key === '12153') {
    if (!boolLike(answers.basis_lien) && !boolLike(answers.basis_levy)) missing.push({ input_key: 'basis_lien_or_levy', label: 'Basis for hearing request: lien and/or levy notice', section: 'Line 1' });
    const reasonCount = selectedKeys(answers, ['reason_not_liable','reason_innocent_spouse','reason_bankruptcy_discharge','reason_payments_not_applied','reason_lien_withdrawal','reason_hardship','reason_collection_alternative']).length + (has(answers.reason_other_comments) ? 1 : 0);
    if (!reasonCount) missing.push({ input_key: 'reason_for_hearing', label: 'Reason for hearing request', section: 'Line 8' });
    if (!has(answers.cdp_notice_date)) warnings.push('CDP/EH timing depends on the notice. Staff must verify the notice date, mailing date, deadline, and correct address/fax instructions before release.');
    if (boolLike(answers.reason_innocent_spouse)) warnings.push('Innocent spouse issues may require Form 8857 and professional review.');
    if (boolLike(answers.reason_bankruptcy_discharge)) warnings.push('Bankruptcy discharge issues should be escalated to tax attorney/bankruptcy-aware review.');
    if (boolLike(answers.reason_collection_alternative) || boolLike(answers.alternative_installment_agreement) || boolLike(answers.alternative_offer_in_compromise) || boolLike(answers.alternative_currently_unable_to_pay)) warnings.push('Collection alternatives may require Form 433-A or 433-B financial information; use sensitive-data gates before collecting full details.');
  }
  return { missing, warnings, errors };
}

function buildReviewTriggers(formNumber, answers = {}, validation = null) {
  const key = normalizeFormNumber(formNumber);
  const text = Object.entries(answers).map(([k, v]) => `${k}:${v}`).join(' ').toLowerCase();
  const triggers = [];
  if (/levy|garnish|seiz|lien|cdp|lt11|cp90|cp504|1058|summons|revenue officer/.test(text)) triggers.push('urgent_collection_signal');
  if (/trust fund|6672|payroll|941|sales tax|withholding/.test(text)) triggers.push('business_or_trust_fund_signal');
  if (/bankrupt|discharge|innocent spouse|criminal|fraud/.test(text)) triggers.push('legal_or_high_risk_signal');
  if (key === '843' && (boolLike(answers.filing_reason_tfrp) || boolLike(answers.tax_type_civil_penalty))) triggers.push('penalty_or_tfrp_review');
  if (key === '9423') triggers.push('collection_appeal_timing_review');
  if (key === '12153') triggers.push('cdp_notice_deadline_review');
  if (validation && validation.warnings && validation.warnings.length) triggers.push('staff_warning_review');
  return Array.from(new Set(triggers));
}

function buildOutputGate(formNumber, answers = {}, options = {}) {
  const validation = validateAppealsAbatementAnswers(formNumber, answers);
  const blockers = [
    'Final official IRS PDF output is disabled in this build.',
    'Official PDF checksum, field names/coordinates, sample visual QA, and overflow tests are not locked.',
    'Full TIN/signature/preparer/representative fields are not collected in public mode.',
    'IRS mail/fax/upload/e-file/agency submission is not enabled.',
    'Staff/professional release is required before final taxpayer-facing output.'
  ];
  if (validation.errors.length) blockers.push('Validation errors must be resolved.');
  if (validation.missing.length) blockers.push('Required organizer items are still missing.');
  const hasStaffRelease = Boolean(options.staff_final_release_approved && options.official_pdf_qa_passed && options.client_values_verified && options.professional_release_recorded && options.production_sensitive_gate_passed);
  return {
    current_status: 'blocked_controlled_organizer_only',
    organizer_complete: validation.missing.length === 0 && validation.errors.length === 0,
    official_client_output_allowed: false,
    hypothetical_release_ready_if_all_external_gates_pass: hasStaffRelease && validation.missing.length === 0 && validation.errors.length === 0,
    blocked_reasons: blockers,
    required_external_gates: [
      'official PDF captured and checksum recorded',
      'PDF field names or overlay coordinates locked',
      'sample-filled PDF generated and visually QA reviewed',
      'overflow/date/checkbox/signature/preparer checks passed',
      'client values verified by staff',
      'professional signoff recorded where required',
      'sensitive-data production gate approved',
      'final staff release approval recorded'
    ]
  };
}

function buildAppealsAbatementCompletionPlan(formNumber, answers = {}, options = {}) {
  const { key, source, fieldMap } = getAppealsForm(formNumber);
  const validation = validateAppealsAbatementAnswers(key, answers);
  const outputGate = buildOutputGate(key, answers, options);
  const mappedValues = fieldMap.map((f) => ({
    key: f.key,
    section: f.section,
    line: f.line,
    official_label: f.official_label,
    input_key: f.input_key,
    provided: has(answers[f.input_key]),
    preview: safePreview(answers[f.input_key]),
    final_only: f.final_only,
    sensitive: f.sensitive,
    mapping_status: f.mapping_status
  }));
  const triggers = buildReviewTriggers(key, answers, validation);
  return {
    ok: true,
    version: VERSION,
    source,
    policy: APPEALS_ABATEMENT_POLICY,
    validation,
    organizer_status: {
      client_can_complete_organizer_now: validation.errors.length === 0,
      required_items_missing: validation.missing.length,
      warning_count: validation.warnings.length,
      review_triggers: triggers,
      recommended_review_level: triggers.includes('legal_or_high_risk_signal') || triggers.includes('business_or_trust_fund_signal') ? 'tax_attorney_or_senior_EA_CPA_review' : 'staff_plus_EA_CPA_review_before_release'
    },
    output_gate: outputGate,
    mapped_values: mappedValues,
    next_steps: [
      'Finish organizer with no full SSNs/EINs/signatures in public mode.',
      'Attach only redacted/sample notice summaries until sensitive uploads are approved.',
      'Staff verifies form fit, deadline/timing, correct IRS address/routing, and supporting facts.',
      'Escalate to professional review for collection, appeals, payroll/trust-fund, bankruptcy, innocent-spouse, levy/seizure, or uncertain deadline issues.',
      'Do not generate final official IRS output until all official-form and production security gates pass.'
    ]
  };
}

function buildAppealsAbatementOutputReadiness(formNumber, context = {}) {
  const report = buildAppealsAbatementFieldMapReport(formNumber);
  const form = report.source;
  const checks = [
    { key: 'official_source_identified', label: 'Official IRS source identified', passed: true, detail: form.source_url },
    { key: 'logical_field_map_ready', label: 'Logical IRS section/line field map ready', passed: true, detail: `${report.summary.total_fields} mapped fields` },
    { key: 'organizer_ready', label: 'Website organizer schema ready', passed: true, detail: 'No-sensitive public organizer mode only.' },
    { key: 'official_pdf_captured', label: 'Official PDF captured and checksum recorded', passed: false, detail: 'Not locked in this build.' },
    { key: 'pdf_field_or_coordinate_lock', label: 'PDF field names or overlay coordinates locked', passed: false, detail: 'Required before final output.' },
    { key: 'sample_visual_qa', label: 'Sample-filled visual QA passed', passed: false, detail: 'Required before final output.' },
    { key: 'signature_controls', label: 'Signature/date/preparer controls approved', passed: false, detail: 'Blocked in public mode.' },
    { key: 'professional_release', label: 'Professional/staff release recorded', passed: false, detail: 'Required for actual claims/appeals.' },
    { key: 'sensitive_data_gate', label: 'Production sensitive-data gate approved', passed: false, detail: 'Live sensitive uploads remain blocked.' },
    { key: 'agency_submission_gate', label: 'IRS submission/fax/mail workflow approved', passed: false, detail: 'No agency submission claims allowed.' }
  ];
  const passed = checks.filter((c) => c.passed).length;
  return {
    ok: true,
    version: VERSION,
    source: form,
    policy: APPEALS_ABATEMENT_POLICY,
    summary: {
      form: form.form_number,
      organizer_ready: true,
      logical_field_map_ready: true,
      client_output_ready: false,
      official_submission_ready: false,
      passed,
      required_checks: checks.length,
      total_fields: report.summary.total_fields,
      current_status: 'controlled_organizer_only_final_output_blocked'
    },
    checks,
    context_flags: {
      live_sensitive_uploads_enabled: Boolean(context.liveSensitiveUploadsEnabled),
      official_pdf_capture_available: Boolean(context.officialPdfCaptureAvailable),
      staff_final_release_available: Boolean(context.staffFinalReleaseAvailable)
    }
  };
}

function buildAppealsAbatementSampleCases(formNumber) {
  const key = normalizeFormNumber(formNumber);
  return {
    ok: true,
    version: VERSION,
    form: IRS_APPEALS_ABATEMENT_SOURCES[key],
    sample_cases: (SAMPLE_CASES[key] || []).map((sample) => ({
      label: sample.label,
      answers: sample.answers,
      completion_plan: buildAppealsAbatementCompletionPlan(key, sample.answers)
    }))
  };
}

function buildAppealsAbatementSampleFillAudit(formNumber, answers = {}, options = {}) {
  const plan = buildAppealsAbatementCompletionPlan(formNumber, answers, options);
  const qa = [];
  plan.mapped_values.forEach((m) => {
    if (m.final_only && m.provided) qa.push({ level: 'blocker', field: m.input_key, message: 'Final-only field should not be provided in public organizer mode.' });
    if (m.sensitive && m.provided) qa.push({ level: 'warning', field: m.input_key, message: 'Sensitive field must be redacted or handled only after production gate.' });
  });
  plan.validation.warnings.forEach((w) => qa.push({ level: 'warning', field: '', message: w }));
  plan.validation.errors.forEach((e) => qa.push({ level: 'error', field: e.input_key, message: e.message }));
  return {
    ok: true,
    version: VERSION,
    form: plan.source,
    print_ready: false,
    organizer_ready_for_staff_review: plan.validation.errors.length === 0 && plan.validation.missing.length === 0,
    output_gate: plan.output_gate,
    qa,
    field_preview: plan.mapped_values.filter((m) => m.provided).slice(0, 50)
  };
}

function buildAppealsAbatementVerificationSheet(formNumber, answers = {}, options = {}) {
  const plan = buildAppealsAbatementCompletionPlan(formNumber, answers, options);
  return {
    ok: true,
    version: VERSION,
    form: plan.source,
    current_status: 'internal_verification_only_not_irs_output',
    sections_to_verify: [
      'Form fit and whether a different IRS form is required',
      'Notice type, date, deadline, and correct IRS address/fax/routing',
      'Tax year/period, tax form, penalty/interest/code section, and amount computation',
      'Supporting documents are redacted/sample only unless production sensitive-data gates are approved',
      'Representative authority and Form 2848/8821 fit where applicable',
      'Signature, preparer, and perjury declaration fields remain blank until final review'
    ],
    missing: plan.validation.missing,
    warnings: plan.validation.warnings,
    errors: plan.validation.errors,
    review_triggers: plan.organizer_status.review_triggers,
    mapped_values: plan.mapped_values.filter((m) => m.provided)
  };
}

function createAppealsAbatementDraftPdfBuffer(formNumber, answers = {}, options = {}) {
  const sheet = buildAppealsAbatementVerificationSheet(formNumber, answers, options);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(16).text(`Justice Tax Solutions - IRS Form ${sheet.form.form_number} Organizer QA Packet`, { underline: true });
    doc.moveDown(0.4).fontSize(10).text('Internal/staff review packet only. Not official IRS output. Do not file or sign this packet. Do not include unredacted sensitive taxpayer data until production gates are approved.');
    doc.moveDown().fontSize(12).text(sheet.form.title);
    doc.fontSize(10).text(`Source: ${sheet.form.source_url}`);
    doc.moveDown().fontSize(11).text('Verification sections:');
    sheet.sections_to_verify.forEach((s) => doc.fontSize(9).text(`• ${s}`));
    doc.moveDown().fontSize(11).text('Warnings / missing / errors:');
    [...sheet.missing.map((m) => `Missing: ${m.section} - ${m.label}`), ...sheet.warnings.map((w) => `Warning: ${w}`), ...sheet.errors.map((e) => `Error: ${e.label || e.input_key} - ${e.message}`)].slice(0, 60).forEach((x) => doc.fontSize(9).text(`• ${x}`));
    doc.moveDown().fontSize(11).text('Provided organizer values (safe preview):');
    sheet.mapped_values.slice(0, 70).forEach((m) => doc.fontSize(8).text(`${m.section} / ${m.official_label}: ${m.preview}`));
    doc.end();
  });
}

module.exports = {
  VERSION,
  APPEALS_ABATEMENT_POLICY,
  IRS_APPEALS_ABATEMENT_SOURCES,
  buildAppealsAbatementFieldMapReport,
  buildAppealsAbatementOrganizerSchema,
  buildAppealsAbatementCompletionPlan,
  buildAppealsAbatementOutputReadiness,
  buildAppealsAbatementSampleCases,
  buildAppealsAbatementSampleFillAudit,
  buildAppealsAbatementVerificationSheet,
  createAppealsAbatementDraftPdfBuffer
};
