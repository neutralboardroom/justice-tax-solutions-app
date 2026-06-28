const AI_FIRST_FORM_COMPLETION_POLICY = {
  version: '0.1.27',
  position: 'AI-first form completion with client verification and exception-based professional review.',
  goal: 'Ask the right questions, request missing details only when needed, map answers to official fields, validate formatting, prepare print-ready draft data, and minimize manual staff work without pretending high-risk tax work can be fully unsupervised.',
  default_mode: 'guided_ai_completion',
  client_output_rule: 'A form can be prepared for printing and client signature only after the official PDF is captured, the field map is verified, sample fills pass QA, required client answers are complete, and required client/professional verification gates are satisfied.',
  human_minimization_rule: 'Human review should be exception-based: required for high-risk facts, tax/legal judgment, conflicting data, missing source documents, low AI confidence, professional credential/signature areas, or any agency response/filing action that requires a qualified reviewer.',
  non_negotiable_gates: [
    'Client must verify all taxpayer facts before signature or submission.',
    'Government-only, IRS/NYS/NYC office-only, and unsupported preparer-only areas stay blank unless a verified workflow controls them.',
    'AI may draft explanations and completed-field candidates, but it must not guarantee refunds, relief, acceptance, eligibility, or agency outcomes.',
    'Print-ready output remains blocked when official PDF mapping, sample-fill QA, overflow checks, date/money formatting, signature/preparer areas, or client verification are incomplete.'
  ]
};

const FORM_COMPLETION_PIPELINE = [
  { step: 1, key: 'select_form_or_problem', owner: 'platform', output: 'recommended form/workflow based on notice, debt, amendment, return, or representation need' },
  { step: 2, key: 'dynamic_interview', owner: 'AI interview engine', output: 'only the questions needed for the selected form and user facts' },
  { step: 3, key: 'conditional_followups', owner: 'AI interview engine', output: 'extra questions triggered by spouse, business, prior-year, cannot-pay, representative, or amended-return facts' },
  { step: 4, key: 'source_linked_field_candidates', owner: 'document intelligence + client answers', output: 'field candidates with source/confidence/verification status' },
  { step: 5, key: 'validation_and_missing_info', owner: 'platform rules', output: 'format checks, impossible-value checks, missing required answers, overflow risk, signature/preparer warnings' },
  { step: 6, key: 'draft_field_map', owner: 'mapping engine', output: 'official PDF field-value draft, not final output' },
  { step: 7, key: 'sample_fill_and_pdf_qa', owner: 'automation + staff/pro review where required', output: 'test filled PDF checked for placement, overflow, checkboxes, dates, money, calculations, blank fields' },
  { step: 8, key: 'client_verification', owner: 'client', output: 'client confirms all facts before printing/signature' },
  { step: 9, key: 'exception_review', owner: 'PTIN/CPA/EA/tax attorney when required', output: 'review notes or clearance for high-risk/manual items only' },
  { step: 10, key: 'print_ready_draft', owner: 'platform', output: 'completed draft prepared for printing and client signature, with blocked fields clearly excluded' }
];

const FORM_INTERVIEW_LIBRARY = {
  '9465': {
    agency: 'IRS',
    form_number: '9465',
    title: 'Installment Agreement Request',
    workflow: 'tax_debt_payment_plan',
    purpose: 'Request a monthly IRS installment agreement when the taxpayer cannot pay the full amount now.',
    preferred_source_record: 'IRS 9465 current PDF',
    signature: { required: true, client_signs: true, preparer_signature_area: 'leave blank unless a verified professional workflow controls it' },
    ai_completion_goal: 'Collect debt, proposed payment, payment date, contact, banking/payroll deduction choices, and compliance facts needed to draft the form.',
    questions: [
      q('taxpayer_name', 'Taxpayer full legal name', 'text', true, 'Personal information'),
      q('spouse_name', 'Spouse name, if this is a joint tax debt', 'text', false, 'Personal information'),
      q('ssn_last4', 'Last 4 digits of SSN or ITIN for matching only', 'text', true, 'Personal information', { pattern: '^\\d{4}$', warning: 'Use last 4 only in demo mode. Full SSN requires live sensitive-upload gates.' }),
      q('mailing_address', 'Current mailing address', 'address', true, 'Contact'),
      q('phone', 'Best phone number', 'phone', true, 'Contact'),
      q('tax_years_owed', 'Which tax year or years do you owe for?', 'multi_year', true, 'Debt details'),
      q('amount_owed_estimate', 'About how much do you owe, including tax, penalties, and interest if known?', 'money', true, 'Debt details'),
      q('can_pay_full_now', 'Can you pay the full balance now?', 'yes_no', true, 'Payment ability'),
      q('proposed_monthly_payment', 'What monthly payment can you realistically make?', 'money', true, 'Payment proposal', { show_if: { key: 'can_pay_full_now', equals: 'no' } }),
      q('preferred_payment_day', 'What day of the month should the IRS payment be due?', 'day_of_month', true, 'Payment proposal', { show_if: { key: 'can_pay_full_now', equals: 'no' } }),
      q('direct_debit', 'Do you want to use direct debit from a bank account?', 'yes_no', true, 'Payment method'),
      q('bank_routing_last4', 'Last 4 digits of routing number for staff checklist only', 'text', false, 'Payment method', { show_if: { key: 'direct_debit', equals: 'yes' } }),
      q('bank_account_last4', 'Last 4 digits of bank account number for staff checklist only', 'text', false, 'Payment method', { show_if: { key: 'direct_debit', equals: 'yes' } }),
      q('unfiled_returns', 'Do you have any unfiled tax returns?', 'yes_no', true, 'Compliance'),
      q('pending_bankruptcy', 'Are you currently in bankruptcy?', 'yes_no', true, 'Risk screen')
    ],
    computed_followups: [
      follow('can_pay_full_now', 'yes', 'You may not need Form 9465 if you can pay in full. The platform should suggest pay-in-full options and confirm whether a payment plan is still desired.'),
      follow('unfiled_returns', 'yes', 'IRS payment-plan eligibility may require filing missing returns first. Add unfiled-return workflow.'),
      follow('pending_bankruptcy', 'yes', 'Escalate to tax attorney/bankruptcy-aware reviewer before agency action.'),
      follow('amount_owed_estimate', 'gt_50000', 'Higher balances may require extra financial disclosure and professional review.')
    ],
    output_fields: ['taxpayer_name','spouse_name','mailing_address','phone','tax_years_owed','amount_owed_estimate','proposed_monthly_payment','preferred_payment_day','direct_debit']
  },
  '2848': {
    agency: 'IRS',
    form_number: '2848',
    title: 'Power of Attorney and Declaration of Representative',
    workflow: 'representative_authorization',
    purpose: 'Authorize an eligible representative to act before the IRS for listed matters and years.',
    signature: { required: true, client_signs: true, representative_declaration_required: true },
    ai_completion_goal: 'Collect taxpayer, representative, tax matters, periods, acts authorized, and notices/communications choices.',
    questions: [
      q('taxpayer_name', 'Taxpayer or business name', 'text', true, 'Taxpayer'),
      q('taxpayer_id_last4', 'Last 4 digits of SSN/EIN/ITIN for matching only', 'text', true, 'Taxpayer', { pattern: '^\\d{4}$' }),
      q('taxpayer_address', 'Taxpayer mailing address', 'address', true, 'Taxpayer'),
      q('taxpayer_phone', 'Taxpayer phone number', 'phone', false, 'Taxpayer'),
      q('representative_name', 'Representative name', 'text', true, 'Representative'),
      q('representative_role', 'Representative credential type', 'select', true, 'Representative', { options: ['CPA','EA','Attorney','PTIN preparer','Other/needs review'] }),
      q('representative_ptin_or_caf', 'Representative CAF/PTIN/license identifier if known', 'text', false, 'Representative'),
      q('tax_matters', 'What tax forms or tax matters should the representative handle?', 'text_list', true, 'Authorization scope'),
      q('tax_periods', 'Which tax years or periods should be included?', 'multi_year', true, 'Authorization scope'),
      q('specific_acts', 'Are any special acts authorized or excluded?', 'long_text', false, 'Authorization scope'),
      q('notices_to_representative', 'Should IRS notices be sent to the representative too?', 'yes_no', true, 'Notices'),
      q('prior_poa_revoke', 'Should prior IRS powers of attorney be revoked?', 'yes_no', true, 'Prior authorizations')
    ],
    computed_followups: [
      follow('representative_role', 'Other/needs review', 'Representative eligibility must be reviewed before output.'),
      follow('specific_acts', 'non_empty', 'Special acts should be reviewed by qualified staff/professional before release.'),
      follow('tax_periods', 'missing', 'The form cannot be completed without exact tax periods.')
    ],
    output_fields: ['taxpayer_name','taxpayer_id_last4','taxpayer_address','representative_name','representative_role','tax_matters','tax_periods','notices_to_representative','prior_poa_revoke']
  },
  '8821': {
    agency: 'IRS',
    form_number: '8821',
    title: 'Tax Information Authorization',
    workflow: 'tax_information_authorization',
    purpose: 'Authorize disclosure of tax information to a named appointee without granting power to act for the taxpayer.',
    signature: { required: true, client_signs: true, appointee_does_not_represent: true },
    ai_completion_goal: 'Collect taxpayer, appointee, tax matters, years, disclosure scope, and revocation instructions.',
    questions: [
      q('taxpayer_name', 'Taxpayer or business name', 'text', true, 'Taxpayer'),
      q('taxpayer_id_last4', 'Last 4 digits of SSN/EIN/ITIN for matching only', 'text', true, 'Taxpayer', { pattern: '^\\d{4}$' }),
      q('taxpayer_address', 'Taxpayer address', 'address', true, 'Taxpayer'),
      q('appointee_name', 'Appointee name', 'text', true, 'Appointee'),
      q('appointee_contact', 'Appointee address, phone, or fax', 'long_text', true, 'Appointee'),
      q('tax_information', 'Which tax forms or tax information may be disclosed?', 'text_list', true, 'Disclosure scope'),
      q('tax_periods', 'Which years or periods are covered?', 'multi_year', true, 'Disclosure scope'),
      q('specific_use', 'What is the reason or use for the authorization?', 'long_text', false, 'Disclosure scope'),
      q('revoke_prior_8821', 'Should prior Form 8821 authorizations be revoked?', 'yes_no', true, 'Prior authorizations')
    ],
    computed_followups: [
      follow('tax_information', 'missing', 'The authorization must identify the information being disclosed.'),
      follow('tax_periods', 'missing', 'The authorization must identify tax periods.'),
      follow('specific_use', 'non_empty', 'Specific-use language should be checked for scope and clarity.')
    ],
    output_fields: ['taxpayer_name','taxpayer_id_last4','taxpayer_address','appointee_name','appointee_contact','tax_information','tax_periods','revoke_prior_8821']
  },
  '433-F': {
    agency: 'IRS',
    form_number: '433-F',
    title: 'Collection Information Statement',
    workflow: 'financial_disclosure_collection',
    purpose: 'Collect personal/business financial details for IRS collection review.',
    signature: { required: true, client_signs: true, high_sensitivity: true },
    ai_completion_goal: 'Ask financial questions in sections, calculate obvious totals, flag missing/contradictory information, and escalate complex or high-risk facts.',
    questions: [
      q('taxpayer_name', 'Taxpayer full name', 'text', true, 'Taxpayer'),
      q('filing_status', 'Filing status', 'select', true, 'Household', { options: ['Single','Married filing jointly','Married filing separately','Head of household','Qualifying surviving spouse','Unsure'] }),
      q('household_size', 'How many people live in your household?', 'number', true, 'Household'),
      q('employment_status', 'Employment status', 'select', true, 'Income', { options: ['W-2 employee','Self-employed','Gig worker/1099','Unemployed','Retired','Other'] }),
      q('monthly_wages', 'Monthly wages or salary after taxes', 'money', false, 'Income'),
      q('monthly_self_employment_income', 'Monthly net self-employment or gig income', 'money', false, 'Income'),
      q('other_monthly_income', 'Other monthly income', 'money', false, 'Income'),
      q('bank_accounts', 'List bank accounts and approximate balances', 'long_text', true, 'Assets'),
      q('vehicles', 'List vehicles, loans, and approximate values', 'long_text', false, 'Assets'),
      q('real_estate', 'Do you own real estate?', 'yes_no', true, 'Assets'),
      q('real_estate_details', 'Real estate address, mortgage, and approximate value', 'long_text', false, 'Assets', { show_if: { key: 'real_estate', equals: 'yes' } }),
      q('monthly_housing', 'Monthly rent or mortgage', 'money', true, 'Expenses'),
      q('monthly_utilities', 'Monthly utilities', 'money', true, 'Expenses'),
      q('monthly_food_clothing', 'Monthly food, clothing, and household expenses', 'money', true, 'Expenses'),
      q('monthly_transportation', 'Monthly transportation expenses', 'money', true, 'Expenses'),
      q('monthly_medical', 'Monthly medical expenses', 'money', false, 'Expenses'),
      q('court_ordered_payments', 'Court-ordered payments such as child support', 'money', false, 'Expenses'),
      q('assets_transferred', 'Have you transferred or sold any major assets recently?', 'yes_no', true, 'Risk screen')
    ],
    computed_followups: [
      follow('employment_status', 'Self-employed', 'Request Schedule C/gig income detail and business bank/account records.'),
      follow('employment_status', 'Gig worker/1099', 'Ask for platform income, mileage/expenses, and 1099 records.'),
      follow('assets_transferred', 'yes', 'Escalate for review before IRS collection submission.'),
      follow('real_estate', 'yes', 'Real estate equity and mortgage details should be verified before output.')
    ],
    output_fields: ['taxpayer_name','filing_status','household_size','employment_status','monthly_wages','monthly_self_employment_income','other_monthly_income','bank_accounts','vehicles','real_estate_details','monthly_housing','monthly_utilities','monthly_food_clothing','monthly_transportation','monthly_medical','court_ordered_payments']
  },
  '1040-X': {
    agency: 'IRS',
    form_number: '1040-X',
    title: 'Amended U.S. Individual Income Tax Return',
    workflow: 'amended_return',
    purpose: 'Amend a previously filed individual federal income tax return.',
    signature: { required: true, client_signs: true, preparer_signature_area: 'professional workflow only' },
    ai_completion_goal: 'Find what changed, ask for original return numbers, corrected numbers, explanation, refund/balance impact, and required schedules/documents.',
    questions: [
      q('tax_year', 'What tax year are you amending?', 'year', true, 'Amendment basics'),
      q('original_return_filed', 'Was the original return already filed and accepted?', 'yes_no', true, 'Amendment basics'),
      q('amendment_reason', 'What needs to be changed?', 'long_text', true, 'Change explanation'),
      q('change_categories', 'Which areas changed?', 'multi_select', true, 'Change categories', { options: ['Income','Deductions','Credits','Filing status','Dependents','Withholding/payments','Self-employment/Schedule C','Other'] }),
      q('original_agi', 'Original adjusted gross income if known', 'money', false, 'Original amounts'),
      q('corrected_agi', 'Corrected adjusted gross income if known', 'money', false, 'Corrected amounts'),
      q('original_tax', 'Original total tax if known', 'money', false, 'Original amounts'),
      q('corrected_tax', 'Corrected total tax if known', 'money', false, 'Corrected amounts'),
      q('original_refund_or_balance', 'Original refund or balance due if known', 'money', false, 'Original amounts'),
      q('new_documents_available', 'Do you have documents supporting the change?', 'yes_no', true, 'Documents'),
      q('state_return_impact', 'Could this change affect NYS/NYC or another state return?', 'yes_no_unsure', true, 'State impact'),
      q('irs_notice_related', 'Is this amendment related to an IRS notice or letter?', 'yes_no', true, 'Notice screen')
    ],
    computed_followups: [
      follow('original_return_filed', 'no', 'This may not be a Form 1040-X workflow. Ask whether a first original return should be prepared instead.'),
      follow('change_categories', 'Filing status', 'Filing status changes can be restricted after deadline; escalate for review.'),
      follow('change_categories', 'Dependents', 'Dependent changes require eligibility questions and documentation.'),
      follow('state_return_impact', 'yes', 'Add NYS/NYC/state amendment workflow.'),
      follow('state_return_impact', 'unsure', 'Add state impact screening before final output.'),
      follow('irs_notice_related', 'yes', 'Link notice response workflow and deadline tracking.')
    ],
    output_fields: ['tax_year','amendment_reason','change_categories','original_agi','corrected_agi','original_tax','corrected_tax','original_refund_or_balance']
  },
  'IT-201': {
    agency: 'NYS',
    form_number: 'IT-201',
    title: 'Resident Income Tax Return',
    workflow: 'ny_resident_return',
    purpose: 'Prepare a New York resident personal income tax return draft after federal return and state inputs are ready.',
    signature: { required: true, client_signs: true, efile_or_print_signature_rules: 'requires final NYS year-specific instructions and professional/e-file workflow' },
    ai_completion_goal: 'Collect NY residency, federal return data, NY additions/subtractions, credits, withholding, NYC/Yonkers details, and signature/payment preferences.',
    questions: [
      q('tax_year', 'Tax year', 'year', true, 'Return basics'),
      q('federal_return_ready', 'Is the federal return completed or ready for review?', 'yes_no', true, 'Return basics'),
      q('ny_resident_all_year', 'Were you a New York resident for the full year?', 'yes_no', true, 'Residency'),
      q('nyc_resident', 'Were you a NYC resident during the tax year?', 'yes_no', true, 'NYC/Yonkers'),
      q('yonkers_resident_or_income', 'Were you a Yonkers resident or did you have Yonkers income?', 'yes_no_unsure', true, 'NYC/Yonkers'),
      q('ny_withholding', 'New York State/City withholding amount if known', 'money', false, 'Payments'),
      q('credits_claimed', 'Which NY credits might apply?', 'multi_select', false, 'Credits', { options: ['Earned income','Child/dependent care','College tuition','Household credit','Property tax/rent','Other/unsure'] })
    ],
    computed_followups: [
      follow('federal_return_ready', 'no', 'Complete or review federal return first because NY return depends on federal figures.'),
      follow('ny_resident_all_year', 'no', 'Suggest IT-203 nonresident/part-year workflow instead.'),
      follow('yonkers_resident_or_income', 'unsure', 'Ask Yonkers residency/source-income questions before output.')
    ],
    output_fields: ['tax_year','nyc_resident','yonkers_resident_or_income','ny_withholding','credits_claimed']
  },
  'NYC-202': {
    agency: 'NYC',
    form_number: 'NYC-202',
    title: 'Unincorporated Business Tax Return for Individuals',
    workflow: 'nyc_ubt_individual',
    purpose: 'Prepare a NYC UBT draft for an individual unincorporated business when required.',
    signature: { required: true, client_signs: true, preparer_signature_area: 'professional workflow only' },
    ai_completion_goal: 'Screen NYC business activity, income, deductions, allocation, estimated payments, and filing threshold before draft output.',
    questions: [
      q('tax_year', 'Tax year', 'year', true, 'Business basics'),
      q('business_name', 'Business or trade name', 'text', true, 'Business basics'),
      q('business_address', 'Business address', 'address', true, 'Business basics'),
      q('nyc_business_activity', 'Did the business operate in NYC?', 'yes_no', true, 'NYC activity'),
      q('gross_income', 'Gross business income', 'money', true, 'Income'),
      q('business_expenses', 'Total business expenses', 'money', true, 'Deductions'),
      q('nyc_allocation_needed', 'Did the business have activity both inside and outside NYC?', 'yes_no_unsure', true, 'Allocation'),
      q('estimated_tax_paid', 'NYC UBT estimated tax payments made', 'money', false, 'Payments')
    ],
    computed_followups: [
      follow('nyc_business_activity', 'no', 'UBT may not apply; screen for NYC nexus before output.'),
      follow('nyc_allocation_needed', 'yes', 'Allocation requires additional schedule questions and likely professional review.'),
      follow('nyc_allocation_needed', 'unsure', 'Ask more activity-location questions before output.')
    ],
    output_fields: ['tax_year','business_name','business_address','gross_income','business_expenses','estimated_tax_paid']
  }
};

function q(key, label, type, required, section, extra = {}) {
  return { key, label, type, required: Boolean(required), section, ...extra };
}

function follow(key, trigger, action) {
  return { key, trigger, action };
}

function normalizeFormNumber(value = '') {
  const cleaned = String(value || '').trim().toUpperCase().replace(/^FORM\s+/, '').replace(/_/g, '-');
  const compact = cleaned.replace(/[^A-Z0-9]/g, '');
  if (compact === '1040X') return '1040-X';
  if (compact === '433F') return '433-F';
  if (compact === 'IT201') return 'IT-201';
  if (compact === 'NYC202') return 'NYC-202';
  return cleaned;
}

function getInterview(formNumber = '') {
  const key = normalizeFormNumber(formNumber);
  return FORM_INTERVIEW_LIBRARY[key] || null;
}

function visibleQuestions(interview, answers = {}) {
  if (!interview) return [];
  return (interview.questions || []).filter((question) => {
    if (!question.show_if) return true;
    const actual = normalizedAnswer(answers[question.show_if.key]);
    return actual === normalizedAnswer(question.show_if.equals);
  });
}

function normalizedAnswer(value) {
  return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
}

function hasAnswer(value) {
  if (Array.isArray(value)) return value.length > 0;
  return String(value === undefined || value === null ? '' : value).trim() !== '';
}

function numericValue(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value || '').replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function validateAnswer(question, value) {
  const errors = [];
  const warnings = [];
  if (question.required && !hasAnswer(value)) errors.push('Required answer missing.');
  if (hasAnswer(value)) {
    if (question.pattern && !(new RegExp(question.pattern).test(String(value).trim()))) errors.push('Answer does not match required format.');
    if (question.type === 'money' && numericValue(value) === null) errors.push('Enter a money amount or leave blank if optional.');
    if (question.type === 'number' && numericValue(value) === null) errors.push('Enter a number.');
    if (question.type === 'day_of_month') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 31) errors.push('Enter a day from 1 to 31.');
    }
    if (question.type === 'year' && !/^20\d{2}$/.test(String(value).trim())) warnings.push('Confirm the tax year is four digits and matches the official form year.');
  }
  if (question.warning) warnings.push(question.warning);
  return { key: question.key, errors, warnings };
}

function evaluateFollowups(interview, answers = {}) {
  if (!interview) return [];
  return (interview.computed_followups || []).filter((rule) => {
    const value = answers[rule.key];
    const norm = normalizedAnswer(value);
    if (rule.trigger === 'missing') return !hasAnswer(value);
    if (rule.trigger === 'non_empty') return hasAnswer(value);
    if (rule.trigger === 'gt_50000') {
      const n = numericValue(value);
      return n !== null && n > 50000;
    }
    if (Array.isArray(value)) return value.map(normalizedAnswer).includes(normalizedAnswer(rule.trigger));
    return norm === normalizedAnswer(rule.trigger);
  });
}

function buildQuestionnaire(formNumber = '', answers = {}) {
  const interview = getInterview(formNumber);
  if (!interview) {
    return {
      ok: false,
      form_number: normalizeFormNumber(formNumber),
      error: 'No AI-first interview template is available yet for this form.',
      available_forms: Object.keys(FORM_INTERVIEW_LIBRARY)
    };
  }
  const questions = visibleQuestions(interview, answers);
  const sections = [];
  for (const question of questions) {
    let section = sections.find((s) => s.label === question.section);
    if (!section) {
      section = { label: question.section, questions: [] };
      sections.push(section);
    }
    section.questions.push(question);
  }
  const followups = evaluateFollowups(interview, answers);
  return {
    ok: true,
    form: summarizeInterview(interview),
    policy: AI_FIRST_FORM_COMPLETION_POLICY,
    sections,
    followups,
    next_best_question: questions.find((question) => question.required && !hasAnswer(answers[question.key])) || questions.find((question) => !hasAnswer(answers[question.key])) || null
  };
}

function summarizeInterview(interview) {
  return {
    agency: interview.agency,
    form_number: interview.form_number,
    title: interview.title,
    workflow: interview.workflow,
    purpose: interview.purpose,
    ai_completion_goal: interview.ai_completion_goal,
    signature: interview.signature,
    required_question_count: (interview.questions || []).filter((q) => q.required).length,
    total_question_count: (interview.questions || []).length
  };
}

function buildFormCompletionPlan({ formNumber = '', answers = {}, taxCase = null, sourceRecord = null, officialForm = null } = {}) {
  const questionnaire = buildQuestionnaire(formNumber, answers);
  if (!questionnaire.ok) return questionnaire;
  const interview = getInterview(formNumber);
  const questions = visibleQuestions(interview, answers);
  const validations = questions.map((question) => validateAnswer(question, answers[question.key]));
  const missing_required = questions.filter((question) => question.required && !hasAnswer(answers[question.key])).map((question) => ({ key: question.key, label: question.label, section: question.section }));
  const validation_errors = validations.flatMap((item) => item.errors.map((error) => ({ key: item.key, error })));
  const validation_warnings = validations.flatMap((item) => item.warnings.map((warning) => ({ key: item.key, warning })));
  const followups = evaluateFollowups(interview, answers);
  const human_review_triggers = buildHumanReviewTriggers({ interview, answers, taxCase, followups, sourceRecord, officialForm });
  const field_candidates = (interview.output_fields || []).map((fieldKey) => ({
    field_key: fieldKey,
    value_present: hasAnswer(answers[fieldKey]),
    value_preview: safePreview(answers[fieldKey]),
    source: hasAnswer(answers[fieldKey]) ? 'client_answer_or_extracted_candidate' : 'missing',
    verification_status: hasAnswer(answers[fieldKey]) ? 'needs_client_verification' : 'missing'
  }));
  const officialPdfCaptured = Boolean((officialForm && officialForm.sha256) || (sourceRecord && sourceRecord.pdf_capture_status === 'captured'));
  const mappingVerified = Boolean((officialForm && ['verified','sample_fill_passed','client_output_ready'].includes(String(officialForm.mapping_status || ''))) || (sourceRecord && ['verified','sample_fill_passed','client_output_ready'].includes(String(sourceRecord.mapping_status || ''))));
  const qaPassed = Boolean((officialForm && officialForm.sample_fill_status === 'passed') || (sourceRecord && sourceRecord.sample_fill_status === 'passed'));
  const clientReady = missing_required.length === 0 && validation_errors.length === 0;
  const printReadyDraftAllowed = officialPdfCaptured && mappingVerified && qaPassed && clientReady && human_review_triggers.filter((t) => t.required_before_release).length === 0;
  return {
    ok: true,
    form: summarizeInterview(interview),
    policy: AI_FIRST_FORM_COMPLETION_POLICY,
    pipeline: FORM_COMPLETION_PIPELINE,
    interview_status: {
      visible_questions: questions.length,
      answered_visible_questions: questions.filter((q) => hasAnswer(answers[q.key])).length,
      missing_required_count: missing_required.length,
      validation_error_count: validation_errors.length,
      validation_warning_count: validation_warnings.length,
      client_answer_complete: clientReady
    },
    missing_required,
    validations: { errors: validation_errors, warnings: validation_warnings },
    conditional_followups: followups,
    field_candidates,
    calculated_checks: buildCalculatedChecks(interview, answers),
    human_review_triggers,
    output_gate: {
      official_pdf_captured: officialPdfCaptured,
      mapping_verified: mappingVerified,
      sample_fill_qa_passed: qaPassed,
      client_answers_complete: clientReady,
      client_verification_required: true,
      client_signature_required: Boolean(interview.signature && interview.signature.required),
      print_ready_draft_allowed: printReadyDraftAllowed,
      current_status: printReadyDraftAllowed ? 'eligible_for_print_ready_draft_after_final_client_confirmation' : 'blocked_until_missing_answers_mapping_qa_or_exception_review_are_resolved',
      blocked_reasons: buildBlockedReasons({ officialPdfCaptured, mappingVerified, qaPassed, clientReady, humanReviewTriggers: human_review_triggers })
    },
    next_actions: buildNextActions({ missing_required, validation_errors, followups, humanReviewTriggers: human_review_triggers, officialPdfCaptured, mappingVerified, qaPassed, clientReady })
  };
}

function buildCalculatedChecks(interview, answers = {}) {
  const checks = [];
  if (interview.form_number === '9465') {
    const owed = numericValue(answers.amount_owed_estimate);
    const monthly = numericValue(answers.proposed_monthly_payment);
    if (owed !== null && monthly !== null && monthly > 0) {
      checks.push({ key: 'estimated_months_to_pay', value: Math.ceil(owed / monthly), warning: Math.ceil(owed / monthly) > 72 ? 'Proposed payment may be too low for a standard streamlined plan. Ask for more details or escalate.' : '' });
    }
  }
  if (interview.form_number === '433-F') {
    const income = ['monthly_wages','monthly_self_employment_income','other_monthly_income'].reduce((sum, key) => sum + (numericValue(answers[key]) || 0), 0);
    const expenses = ['monthly_housing','monthly_utilities','monthly_food_clothing','monthly_transportation','monthly_medical','court_ordered_payments'].reduce((sum, key) => sum + (numericValue(answers[key]) || 0), 0);
    checks.push({ key: 'monthly_income_estimate', value: income });
    checks.push({ key: 'monthly_expense_estimate', value: expenses });
    checks.push({ key: 'rough_monthly_net', value: income - expenses, warning: income && expenses && expenses > income ? 'Expenses exceed income. Verify numbers and document sources before output.' : '' });
  }
  if (interview.form_number === '1040-X') {
    const originalTax = numericValue(answers.original_tax);
    const correctedTax = numericValue(answers.corrected_tax);
    if (originalTax !== null && correctedTax !== null) checks.push({ key: 'tax_change_estimate', value: correctedTax - originalTax });
  }
  return checks;
}

function buildHumanReviewTriggers({ interview, answers = {}, taxCase = null, followups = [], sourceRecord = null, officialForm = null } = {}) {
  const triggers = [];
  const add = (key, label, required = true) => triggers.push({ key, label, required_before_release: required });
  if (!sourceRecord && !officialForm) add('official_pdf_not_attached_to_plan', 'No captured official PDF/source record is attached to this completion plan.', false);
  if (taxCase && ['high','urgent'].includes(String(taxCase.risk_level || '').toLowerCase())) add('high_risk_case', 'Case is high-risk or urgent and should receive exception review.');
  if (interview.form_number === '9465' && numericValue(answers.amount_owed_estimate) > 50000) add('large_irs_balance', 'IRS balance appears above $50,000; extra financial disclosure/professional review may be needed.');
  if (interview.form_number === '9465' && normalizedAnswer(answers.pending_bankruptcy) === 'yes') add('bankruptcy_screen', 'Bankruptcy was reported. Tax attorney review is required before agency action.');
  if (interview.form_number === '433-F') add('financial_disclosure_statement', 'Collection financial disclosure should be reviewed before release because it can affect IRS collection action.');
  if (interview.form_number === '1040-X' && includesAnswer(answers.change_categories, 'Filing status')) add('amended_return_filing_status', 'Filing status amendment requires professional review.');
  if (interview.form_number === '1040-X' && includesAnswer(answers.change_categories, 'Dependents')) add('dependent_eligibility_change', 'Dependent eligibility changes require extra review and supporting documents.');
  if (interview.form_number === '2848' && !['cpa','ea','attorney'].includes(normalizedAnswer(answers.representative_role))) add('representative_eligibility', 'Representative eligibility must be verified before Form 2848 output.');
  if (interview.form_number === 'NYC-202' && ['yes','unsure'].includes(normalizedAnswer(answers.nyc_allocation_needed))) add('nyc_ubt_allocation', 'NYC UBT allocation requires more questions and likely professional review.');
  for (const f of followups) {
    if (/escalate|review|professional|attorney|verify/i.test(f.action || '')) add(`followup_${f.key}_${String(f.trigger).replace(/[^a-z0-9]+/gi,'_')}`, f.action, /escalate|required|before output|professional|attorney/i.test(f.action));
  }
  return dedupeByKey(triggers);
}

function includesAnswer(value, needle) {
  if (Array.isArray(value)) return value.map(normalizedAnswer).includes(normalizedAnswer(needle));
  return normalizedAnswer(value).includes(normalizedAnswer(needle));
}

function buildBlockedReasons({ officialPdfCaptured, mappingVerified, qaPassed, clientReady, humanReviewTriggers = [] }) {
  const reasons = [];
  if (!officialPdfCaptured) reasons.push('Official PDF has not been captured/checksummed for this form.');
  if (!mappingVerified) reasons.push('Official PDF field map is not verified.');
  if (!qaPassed) reasons.push('Sample-fill QA has not passed.');
  if (!clientReady) reasons.push('Required client answers or validation fixes are still missing.');
  for (const trigger of humanReviewTriggers.filter((t) => t.required_before_release)) reasons.push(trigger.label);
  return reasons;
}

function buildNextActions({ missing_required = [], validation_errors = [], followups = [], humanReviewTriggers = [], officialPdfCaptured, mappingVerified, qaPassed, clientReady }) {
  const actions = [];
  if (missing_required.length) actions.push({ owner: 'client_ai_interview', action: `Ask ${missing_required.length} missing required question(s).`, priority: 1 });
  if (validation_errors.length) actions.push({ owner: 'client_ai_interview', action: `Fix ${validation_errors.length} answer formatting/validation issue(s).`, priority: 1 });
  if (followups.length) actions.push({ owner: 'ai_interview_engine', action: 'Ask conditional follow-up questions triggered by the answers.', priority: 2, followups });
  if (!officialPdfCaptured) actions.push({ owner: 'staff_or_admin', action: 'Capture official PDF from government URL or upload exact official PDF.', priority: 2 });
  if (!mappingVerified) actions.push({ owner: 'mapping_qa', action: 'Verify PDF field map against official form fields.', priority: 2 });
  if (!qaPassed) actions.push({ owner: 'mapping_qa', action: 'Run sample-fill QA for placement, overflow, dates, money, checkboxes, signatures, and calculations.', priority: 2 });
  const requiredReview = humanReviewTriggers.filter((t) => t.required_before_release);
  if (requiredReview.length) actions.push({ owner: 'exception_review', action: `Resolve ${requiredReview.length} human/professional exception trigger(s).`, priority: 3, triggers: requiredReview });
  if (clientReady && officialPdfCaptured && mappingVerified && qaPassed && !requiredReview.length) actions.push({ owner: 'client', action: 'Final client verification and signature/printing step can be prepared.', priority: 4 });
  return actions.sort((a, b) => a.priority - b.priority);
}

function buildAutomationRoadmap() {
  return {
    policy: AI_FIRST_FORM_COMPLETION_POLICY,
    pipeline: FORM_COMPLETION_PIPELINE,
    first_wave_forms: Object.values(FORM_INTERVIEW_LIBRARY).map(summarizeInterview),
    next_build_priorities: [
      'Attach captured official PDFs to each form interview template.',
      'Extract AcroForm field names and map each field to interview answers.',
      'Add sample-fill fixtures for normal, joint, self-employed, missing-data, and high-risk cases.',
      'Add page-level overflow/checkbox/date/money/signature QA reports.',
      'Add client verification screen that shows every completed field before print/signature.',
      'Add exception-based professional review queue so humans handle only blocked/high-risk items.'
    ]
  };
}

function buildSampleFillAudit(formNumber = '', answers = {}) {
  const plan = buildFormCompletionPlan({ formNumber, answers });
  if (!plan.ok) return plan;
  return {
    ok: true,
    form: plan.form,
    sample_case_type: inferSampleCaseType(plan.form.form_number, answers),
    qa_checks: [
      { key: 'field_map_complete', status: plan.output_gate.mapping_verified ? 'passed' : 'blocked', note: 'Every official PDF field must be mapped, intentionally blank, or unsupported with reason.' },
      { key: 'required_answers_complete', status: plan.interview_status.client_answer_complete ? 'passed' : 'blocked', note: `${plan.interview_status.missing_required_count} missing required answers.` },
      { key: 'format_validation', status: plan.validations.errors.length ? 'blocked' : 'passed', note: `${plan.validations.errors.length} validation errors.` },
      { key: 'overflow_check', status: 'not_run_until_pdf_fill', note: 'Needs filled PDF render/page inspection.' },
      { key: 'checkbox_radio_check', status: 'not_run_until_pdf_fill', note: 'Needs actual official field names and filled PDF.' },
      { key: 'date_money_format_check', status: plan.validations.errors.length ? 'blocked' : 'ready_to_run', note: 'Money/date values must match agency-specific formatting.' },
      { key: 'signature_preparer_government_only_check', status: 'manual_or_rule_review_required', note: 'Signature and preparer/government-only areas must remain controlled.' }
    ],
    print_ready: plan.output_gate.print_ready_draft_allowed,
    blocked_reasons: plan.output_gate.blocked_reasons
  };
}

function buildExceptionReviewQueue({ store }) {
  const cases = store && store.list ? store.list('cases', (c) => !c.deleted_at) : [];
  return cases.map((c) => {
    const forms = inferLikelyFormsForCase(c);
    const plans = forms.map((formNumber) => buildFormCompletionPlan({ formNumber, answers: c.form_answers || c.intake_answers || {}, taxCase: c }));
    const triggers = plans.flatMap((p) => p.human_review_triggers || []).filter((t) => t.required_before_release);
    return { case_id: c.id, client: c.name || c.email || 'Client', likely_forms: forms, trigger_count: triggers.length, triggers, status: triggers.length ? 'exception_review_needed' : 'automation_can_continue_if_mapping_qa_passes' };
  }).filter((item) => item.trigger_count > 0);
}

function inferLikelyFormsForCase(c = {}) {
  const text = `${c.pathway || ''} ${c.problem_type || ''} ${c.summary || ''} ${c.description || ''}`.toLowerCase();
  const forms = [];
  if (/debt|payment|installment|cannot pay|balance/.test(text)) forms.push('9465');
  if (/power of attorney|represent|poa|2848/.test(text)) forms.push('2848');
  if (/transcript|authorization|8821|tax information/.test(text)) forms.push('8821');
  if (/collection|financial|433/.test(text)) forms.push('433-F');
  if (/amend|1040-x|mistake|correct/.test(text)) forms.push('1040-X');
  if (/new york|nys|it-201/.test(text)) forms.push('IT-201');
  if (/nyc|ubt|unincorporated/.test(text)) forms.push('NYC-202');
  return forms.length ? forms : ['9465'];
}

function inferSampleCaseType(formNumber, answers = {}) {
  if (formNumber === '9465' && numericValue(answers.amount_owed_estimate) > 50000) return 'large_balance_payment_plan';
  if (formNumber === '433-F') return 'collection_financial_disclosure';
  if (formNumber === '1040-X') return 'amended_return';
  if (formNumber === 'NYC-202') return 'nyc_business_tax';
  return 'standard_client_interview';
}

function dedupeByKey(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function safePreview(value) {
  if (!hasAnswer(value)) return '';
  if (Array.isArray(value)) return value.join(', ').slice(0, 120);
  const str = String(value).trim();
  if (/^\d{4}$/.test(str)) return `***-${str}`;
  if (str.length > 120) return `${str.slice(0, 117)}...`;
  return str;
}

module.exports = {
  AI_FIRST_FORM_COMPLETION_POLICY,
  FORM_COMPLETION_PIPELINE,
  FORM_INTERVIEW_LIBRARY,
  buildQuestionnaire,
  buildFormCompletionPlan,
  buildAutomationRoadmap,
  buildSampleFillAudit,
  buildExceptionReviewQueue,
  normalizeFormNumber
};
