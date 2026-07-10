const PDFDocument = require('pdfkit');

const VERSION = '0.1.56';

const IRS_433F_OFFICIAL_SOURCE = {
  agency: 'IRS',
  form_number: '433-F',
  title: 'Collection Information Statement',
  revision: 'Rev. July 2024',
  source_url: 'https://www.irs.gov/pub/irs-pdf/f433f.pdf',
  source_page_url: 'https://www.irs.gov/forms-instructions',
  instructions_url: 'https://www.irs.gov/pub/irs-pdf/f433f.pdf#page=3',
  pages: 4,
  catalog_number: '62053J',
  status: 'official_source_identified_logical_map_ready',
  client_output_rule: 'Form 433-F may be organized through the website, but final IRS-ready output remains blocked until the official PDF is captured, checksummed, field names or overlay coordinates are verified, sample-filled PDFs pass visual QA, client values are verified, and required collection/professional review signs off.'
};

const IRS_433F_OUTPUT_POLICY = {
  goal: 'Add a controlled, user-completable IRS Form 433-F organizer and official line/section map for tax debt and installment-agreement cases without enabling unsafe final IRS submission output.',
  allowed_before_final_qa: [
    'public 433-F organizer with no-required-full-SSN mode',
    'plain-English interview and missing-information checklist',
    'source-linked logical field map by official section and page',
    'income, expense, rough net cashflow, and disclosure-completeness checks',
    'internal/staff QA packet and client verification sheet using redacted or sample values'
  ],
  blocked_until_final_qa: [
    'final official IRS Form 433-F output for client signature',
    'agency submission/mailing instruction as complete',
    'taxpayer or spouse signature placement',
    'full SSN/EIN/bank account collection unless live sensitive-data gates are enabled and approved',
    'collection strategy, OIC, payment-plan, or representation advice without required professional review'
  ],
  current_site_mode: 'organizer_only_no_sensitive_required',
  professional_review_default: 'EA review is commonly recommended for collection financial disclosures; CPA review may be needed for business/self-employed records; tax attorney review is needed for legal-sensitive collection facts.'
};

function field(key, page, section, officialLabel, inputKey, type, required = false, extra = {}) {
  return {
    key,
    page,
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
    qa_rule: extra.qa_rule || 'client must verify before print/signature',
    sensitive: Boolean(extra.sensitive),
    signature_or_perjury: Boolean(extra.signature_or_perjury),
    final_only: Boolean(extra.final_only),
    conditional: extra.conditional || null,
    official_pdf_field_name: extra.official_pdf_field_name || '',
    mapping_status: extra.mapping_status || 'logical_map_ready_needs_official_pdf_field_or_coordinate_confirmation'
  };
}

const IRS_433F_FIELD_MAP = [
  field('taxpayer_name_address', 1, 'Name(s) and Address', 'Name(s) and Address', 'taxpayer_name_address', 'long_text', true, { max_length: 240 }),
  field('taxpayer_ssn_itin', 1, 'Name(s) and Address', 'Your Social Security Number or Individual Taxpayer Identification Number', 'taxpayer_ssn_itin', 'ssn_or_itin', false, { sensitive: true, final_only: true, formatting: '###-##-#### or ITIN', required_for_final_output: true }),
  field('spouse_ssn_itin', 1, 'Name(s) and Address', "Your Spouse's Social Security Number or Individual Taxpayer Identification Number", 'spouse_ssn_itin', 'ssn_or_itin', false, { sensitive: true, final_only: true, conditional: 'spouse_or_joint_tax_debt', required_for_final_output: false }),
  field('taxpayer_id_last4', 1, 'Name(s) and Address', 'Last 4 identifier for current no-sensitive organizer only', 'taxpayer_id_last4', 'text', false, { formatting: '####', source: 'client_interview_safe_mode', required_for_final_output: false }),
  field('address_different_from_last_return', 1, 'Name(s) and Address', 'If address provided above is different than last return filed, please check here', 'address_different_from_last_return', 'checkbox', false),
  field('county_of_residence', 1, 'Name(s) and Address', 'County of Residence', 'county_of_residence', 'text', true),
  field('taxpayer_home_phone', 1, 'Telephone numbers', 'Your telephone numbers - Home', 'taxpayer_home_phone', 'phone', false),
  field('taxpayer_work_phone', 1, 'Telephone numbers', 'Your telephone numbers - Work', 'taxpayer_work_phone', 'phone', false),
  field('taxpayer_cell_phone', 1, 'Telephone numbers', 'Your telephone numbers - Cell', 'taxpayer_cell_phone', 'phone', true),
  field('spouse_home_phone', 1, 'Telephone numbers', "Spouse's telephone numbers - Home", 'spouse_home_phone', 'phone', false),
  field('spouse_work_phone', 1, 'Telephone numbers', "Spouse's telephone numbers - Work", 'spouse_work_phone', 'phone', false),
  field('spouse_cell_phone', 1, 'Telephone numbers', "Spouse's telephone numbers - Cell", 'spouse_cell_phone', 'phone', false),
  field('household_under_65_count', 1, 'Household', 'Number of people in household who can be claimed on this year return - Under 65', 'household_under_65_count', 'number', true),
  field('household_65_over_count', 1, 'Household', 'Number of people in household who can be claimed on this year return - 65 and Over', 'household_65_over_count', 'number', true),
  field('self_employed_or_self_employment_income', 1, 'Self-employment', 'If you or your spouse are self employed or have self employment income', 'self_employed_or_self_employment_income', 'yes_no', true),
  field('business_name', 1, 'Self-employment', 'Name of Business', 'business_name', 'text', false, { conditional: 'self_employed_or_self_employment_income=yes' }),
  field('business_ein', 1, 'Self-employment', 'Business EIN', 'business_ein', 'ein', false, { sensitive: true, formatting: '##-#######', conditional: 'self_employed_or_self_employment_income=yes' }),
  field('business_type', 1, 'Self-employment', 'Type of Business', 'business_type', 'text', false, { conditional: 'self_employed_or_self_employment_income=yes' }),
  field('business_employee_count', 1, 'Self-employment', 'Number of Employees (not counting owner)', 'business_employee_count', 'number', false, { conditional: 'self_employed_or_self_employment_income=yes' }),

  ...repeatRows('bank', 2, ['institution_name_address','account_number','account_type','current_balance_value','is_business_account'], 1, 'A. Accounts / Lines of Credit', 'Personal bank accounts', ['Name and Address of Institution','Account Number','Type of Account','Current Balance/Value','Check if Business Account'], ['text','account_number','text','money','checkbox'], { account_number: { sensitive: true, final_only: true } }),
  ...repeatRows('investment', 2, ['institution_name_address','account_number','account_type','current_balance_value','is_business_account'], 1, 'A. Accounts / Lines of Credit', 'Investments', ['Name and Address of Institution','Account Number','Type of Account','Current Balance/Value','Check if Business Account'], ['text','account_number','text','money','checkbox'], { account_number: { sensitive: true, final_only: true } }),
  ...repeatRows('digital_asset', 2, ['currency_type','wallet_exchange_name','setup_email','asset_locations','amount_value_usd'], 1, 'A. Accounts / Lines of Credit', 'Digital assets / cryptocurrency', ['Type of Digital Currency','Name of Digital Assets Wallet, Exchange or DCE','Email Address Used to Set-up With DCE','Location(s) of Digital Assets','Digital Assets Amount and Value in US dollars as of today'], ['text','text','email','text','money'], { setup_email: { sensitive: true } }),
  ...repeatRows('real_estate', 2, ['description_location_county','monthly_payment','financing','current_value','balance_owed','equity','primary_residence','other','year_purchased','purchase_price','year_refinanced','refinance_amount'], 1, 'B. Real Estate', 'Real estate', ['Description/Location/County','Monthly Payment(s)','Financing','Current Value','Balance Owed','Equity','Primary Residence','Other','Year Purchased','Purchase Price','Year Refinanced','Refinance Amount'], ['text','money','text','money','money','money','checkbox','checkbox','year','money','year','money']),
  ...repeatRows('other_asset', 2, ['description','monthly_payment','year_purchased','final_payment_month_year','current_value','balance_owed','equity'], 1, 'C. Other Assets', 'Cars, boats, recreational vehicles, life insurance, business assets', ['Description','Monthly Payment','Year Purchased','Final Payment (mo/yr)','Current Value','Balance Owed','Equity'], ['text','money','year','text','money','money','money']),
  ...repeatRows('credit_card', 2, ['type','credit_limit','balance_owed','minimum_monthly_payment'], 1, 'D. Credit Cards', 'Credit cards', ['Type','Credit Limit','Balance Owed','Minimum Monthly Payment'], ['text','money','money','money']),

  ...repeatRows('accounts_receivable', 3, ['name','address','amount_owed'], 2, 'E. Business Information', 'E1. Accounts Receivable owed to you or your business', ['Name','Address','Amount Owed'], ['text','text','money']),
  field('accounts_receivable_additional_sheets_total', 2, 'E. Business Information', 'List total amount owed from additional sheets', 'accounts_receivable_additional_sheets_total', 'money', false),
  field('accounts_receivable_available_to_irs_now', 2, 'E. Business Information', 'Total amount of accounts receivable available to pay to IRS now', 'accounts_receivable_available_to_irs_now', 'money', false),
  field('merchant_account_name_on_account', 2, 'E. Business Information', 'E2. Name of individual or business on account', 'merchant_account_name_on_account', 'text', false),
  ...repeatRows('merchant_account', 3, ['card_type','issuing_bank_name_address','merchant_account_number'], 2, 'E. Business Information', 'E2. Credit card/merchant accounts', ['Credit Card','Issuing Bank Name and Address','Merchant Account Number'], ['text','text','account_number'], { merchant_account_number: { sensitive: true, final_only: true } }),

  field('taxpayer_current_employer', 2, 'F. Employment Information', 'Your current Employer (name and address)', 'taxpayer_current_employer', 'long_text', false),
  field('taxpayer_pay_frequency', 2, 'F. Employment Information', 'How often are you paid - taxpayer', 'taxpayer_pay_frequency', 'select', false, { options: ['Weekly','Biweekly','Semi-monthly','Monthly'] }),
  field('taxpayer_gross_per_pay_period', 2, 'F. Employment Information', 'Gross per pay period - taxpayer', 'taxpayer_gross_per_pay_period', 'money', false),
  field('taxpayer_federal_tax_per_pay_period', 2, 'F. Employment Information', 'Taxes per pay period (Fed) - taxpayer', 'taxpayer_federal_tax_per_pay_period', 'money', false),
  field('taxpayer_state_tax_per_pay_period', 2, 'F. Employment Information', 'Taxes per pay period (State) - taxpayer', 'taxpayer_state_tax_per_pay_period', 'money', false),
  field('taxpayer_local_tax_per_pay_period', 2, 'F. Employment Information', 'Taxes per pay period (Local) - taxpayer', 'taxpayer_local_tax_per_pay_period', 'money', false),
  field('taxpayer_time_at_current_employer', 2, 'F. Employment Information', 'How long at current employer - taxpayer', 'taxpayer_time_at_current_employer', 'text', false),
  field('spouse_current_employer', 2, 'F. Employment Information', "Spouse's current Employer (name and address)", 'spouse_current_employer', 'long_text', false),
  field('spouse_pay_frequency', 2, 'F. Employment Information', 'How often are you paid - spouse', 'spouse_pay_frequency', 'select', false, { options: ['Weekly','Biweekly','Semi-monthly','Monthly'] }),
  field('spouse_gross_per_pay_period', 2, 'F. Employment Information', 'Gross per pay period - spouse', 'spouse_gross_per_pay_period', 'money', false),
  field('spouse_federal_tax_per_pay_period', 2, 'F. Employment Information', 'Taxes per pay period (Fed) - spouse', 'spouse_federal_tax_per_pay_period', 'money', false),
  field('spouse_state_tax_per_pay_period', 2, 'F. Employment Information', 'Taxes per pay period (State) - spouse', 'spouse_state_tax_per_pay_period', 'money', false),
  field('spouse_local_tax_per_pay_period', 2, 'F. Employment Information', 'Taxes per pay period (Local) - spouse', 'spouse_local_tax_per_pay_period', 'money', false),
  field('spouse_time_at_current_employer', 2, 'F. Employment Information', 'How long at current employer - spouse', 'spouse_time_at_current_employer', 'text', false),

  field('alimony_income', 2, 'G. Non-wage Household Income', 'Alimony Income', 'alimony_income', 'money', false),
  field('child_support_income', 2, 'G. Non-wage Household Income', 'Child Support Income', 'child_support_income', 'money', false),
  field('net_self_employment_income', 2, 'G. Non-wage Household Income', 'Net Self Employment Income', 'net_self_employment_income', 'money', false),
  field('net_rental_income', 2, 'G. Non-wage Household Income', 'Net Rental Income', 'net_rental_income', 'money', false),
  field('unemployment_income', 2, 'G. Non-wage Household Income', 'Unemployment Income', 'unemployment_income', 'money', false),
  field('pension_income', 2, 'G. Non-wage Household Income', 'Pension Income', 'pension_income', 'money', false),
  field('interest_dividends_income', 2, 'G. Non-wage Household Income', 'Interest/Dividends Income', 'interest_dividends_income', 'money', false),
  field('social_security_income', 2, 'G. Non-wage Household Income', 'Social Security Income', 'social_security_income', 'money', false),
  field('other_income_description', 2, 'G. Non-wage Household Income', 'Other income - description', 'other_income_description', 'text', false),
  field('other_income_amount', 2, 'G. Non-wage Household Income', 'Other income - monthly amount', 'other_income_amount', 'money', false),

  ...expenseFields(),

  field('taxpayer_signature', 2, 'Signature', 'Your signature', 'taxpayer_signature', 'signature', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true, mapping_status: 'must_remain_blank_until_client_signs_after_review' }),
  field('spouse_signature', 2, 'Signature', "Spouse's signature", 'spouse_signature', 'signature', false, { signature_or_perjury: true, final_only: true, conditional: 'spouse_or_joint_tax_debt', mapping_status: 'must_remain_blank_until_client_signs_after_review' }),
  field('signature_date', 2, 'Signature', 'Date', 'signature_date', 'date', false, { signature_or_perjury: true, final_only: true, required_for_final_output: true, mapping_status: 'must_remain_blank_until_client_signs_after_review' })
];

const IRS_433F_SAMPLE_CASES = [
  {
    key: 'wage_earner_streamlined_check',
    label: 'Wage earner with IRS balance and simple assets',
    purpose: 'Test basic identity, income, expenses, bank, vehicle, and Form 9465 dependency checks without real sensitive data.',
    answers: {
      taxpayer_name_address: 'Sample Taxpayer, 123 Main Street, Albany, NY 12207',
      taxpayer_id_last4: '1234',
      county_of_residence: 'Albany',
      taxpayer_cell_phone: '555-0100',
      household_under_65_count: '2',
      household_65_over_count: '0',
      self_employed_or_self_employment_income: 'no',
      bank_1_institution_name_address: 'Sample Bank',
      bank_1_account_type: 'Checking',
      bank_1_current_balance_value: '1200',
      other_asset_1_description: '2016 sedan',
      other_asset_1_current_value: '6500',
      other_asset_1_balance_owed: '2000',
      taxpayer_current_employer: 'Sample Employer, Albany NY',
      taxpayer_pay_frequency: 'Biweekly',
      taxpayer_gross_per_pay_period: '2200',
      taxpayer_federal_tax_per_pay_period: '210',
      taxpayer_state_tax_per_pay_period: '85',
      taxpayer_local_tax_per_pay_period: '0',
      h1_food_actual: '550',
      h1_housekeeping_actual: '80',
      h1_clothing_actual: '90',
      h1_personal_care_actual: '60',
      h1_misc_actual: '75',
      h2_vehicle_operating_actual: '310',
      h3_rent_actual: '1450',
      h3_utilities_actual: '280',
      h3_phone_cable_internet_actual: '160',
      h4_health_insurance_actual: '240',
      h4_out_of_pocket_health_actual: '60'
    }
  },
  {
    key: 'self_employed_business_review',
    label: 'Self-employed taxpayer needing business review',
    purpose: 'Triggers business, accounts receivable, merchant account, P&L, and professional review warnings.',
    answers: {
      taxpayer_name_address: 'Sample Freelancer, 456 Market Avenue, Brooklyn, NY 11201',
      taxpayer_id_last4: '6789',
      county_of_residence: 'Kings',
      taxpayer_cell_phone: '555-0111',
      household_under_65_count: '1',
      household_65_over_count: '0',
      self_employed_or_self_employment_income: 'yes',
      business_name: 'Sample Design Studio',
      business_type: 'Graphic design',
      business_employee_count: '0',
      net_self_employment_income: '3100',
      bank_1_institution_name_address: 'Business Bank',
      bank_1_account_type: 'Checking',
      bank_1_current_balance_value: '2400',
      merchant_account_name_on_account: 'Sample Design Studio',
      merchant_account_1_card_type: 'Visa/Mastercard',
      merchant_account_1_issuing_bank_name_address: 'Sample Processor',
      accounts_receivable_1_name: 'Sample Client',
      accounts_receivable_1_address: 'New York, NY',
      accounts_receivable_1_amount_owed: '1800',
      h1_food_actual: '600',
      h2_vehicle_operating_actual: '260',
      h3_rent_actual: '2200',
      h3_utilities_actual: '330',
      h5_estimated_tax_payments_actual: '200'
    }
  }
];

function repeatRows(prefix, count, suffixes, page, section, group, labels, types, extraBySuffix = {}) {
  const out = [];
  for (let row = 1; row <= count; row += 1) {
    suffixes.forEach((suffix, idx) => {
      const extra = extraBySuffix[suffix] || {};
      out.push(field(`${prefix}_${row}_${suffix}`, page, section, `${group} row ${row} - ${labels[idx]}`, `${prefix}_${row}_${suffix}`, types[idx], false, { ...extra, repeat_group: prefix, row }));
    });
  }
  return out;
}

function expenseField(key, label, group, required = false) {
  return field(key, 2, 'H. Monthly Necessary Living Expenses', label, key, 'money', required, { repeat_group: group });
}

function expenseFields() {
  return [
    expenseField('h1_food_actual', 'Food - Actual Monthly Expenses', 'food_personal_care', true),
    expenseField('h1_food_irs_allowed', 'Food - IRS Allowed', 'food_personal_care'),
    expenseField('h1_housekeeping_actual', 'Housekeeping Supplies - Actual Monthly Expenses', 'food_personal_care'),
    expenseField('h1_housekeeping_irs_allowed', 'Housekeeping Supplies - IRS Allowed', 'food_personal_care'),
    expenseField('h1_clothing_actual', 'Clothing and Clothing Services - Actual Monthly Expenses', 'food_personal_care'),
    expenseField('h1_clothing_irs_allowed', 'Clothing and Clothing Services - IRS Allowed', 'food_personal_care'),
    expenseField('h1_personal_care_actual', 'Personal Care Products & Services - Actual Monthly Expenses', 'food_personal_care'),
    expenseField('h1_personal_care_irs_allowed', 'Personal Care Products & Services - IRS Allowed', 'food_personal_care'),
    expenseField('h1_misc_actual', 'Miscellaneous - Actual Monthly Expenses', 'food_personal_care'),
    expenseField('h1_misc_irs_allowed', 'Miscellaneous - IRS Allowed', 'food_personal_care'),
    expenseField('h1_total_actual', 'Food/Personal Care Total - Actual Monthly Expenses', 'food_personal_care'),
    expenseField('h1_total_irs_allowed', 'Food/Personal Care Total - IRS Allowed', 'food_personal_care'),
    expenseField('h2_vehicle_operating_actual', 'Gas / Insurance / Licenses / Parking / Maintenance - Actual Monthly Expenses', 'transportation', true),
    expenseField('h2_vehicle_operating_irs_allowed', 'Gas / Insurance / Licenses / Parking / Maintenance - IRS Allowed', 'transportation'),
    expenseField('h2_public_transportation_actual', 'Public Transportation - Actual Monthly Expenses', 'transportation'),
    expenseField('h2_public_transportation_irs_allowed', 'Public Transportation - IRS Allowed', 'transportation'),
    expenseField('h2_total_actual', 'Transportation Total - Actual Monthly Expenses', 'transportation'),
    expenseField('h2_total_irs_allowed', 'Transportation Total - IRS Allowed', 'transportation'),
    expenseField('h3_rent_actual', 'Rent - Actual Monthly Expenses', 'housing_utilities', true),
    expenseField('h3_rent_irs_allowed', 'Rent - IRS Allowed', 'housing_utilities'),
    expenseField('h3_utilities_actual', 'Electric, Oil/Gas, Water/Trash - Actual Monthly Expenses', 'housing_utilities', true),
    expenseField('h3_utilities_irs_allowed', 'Electric, Oil/Gas, Water/Trash - IRS Allowed', 'housing_utilities'),
    expenseField('h3_phone_cable_internet_actual', 'Telephone/Cell/Cable/Internet - Actual Monthly Expenses', 'housing_utilities'),
    expenseField('h3_phone_cable_internet_irs_allowed', 'Telephone/Cell/Cable/Internet - IRS Allowed', 'housing_utilities'),
    expenseField('h3_real_estate_taxes_insurance_actual', 'Real Estate Taxes and Insurance - Actual Monthly Expenses', 'housing_utilities'),
    expenseField('h3_real_estate_taxes_insurance_irs_allowed', 'Real Estate Taxes and Insurance - IRS Allowed', 'housing_utilities'),
    expenseField('h3_maintenance_repairs_actual', 'Maintenance and Repairs - Actual Monthly Expenses', 'housing_utilities'),
    expenseField('h3_maintenance_repairs_irs_allowed', 'Maintenance and Repairs - IRS Allowed', 'housing_utilities'),
    expenseField('h3_total_actual', 'Housing & Utilities Total - Actual Monthly Expenses', 'housing_utilities'),
    expenseField('h3_total_irs_allowed', 'Housing & Utilities Total - IRS Allowed', 'housing_utilities'),
    expenseField('h4_health_insurance_actual', 'Health Insurance - Actual Monthly Expenses', 'medical'),
    expenseField('h4_health_insurance_irs_allowed', 'Health Insurance - IRS Allowed', 'medical'),
    expenseField('h4_out_of_pocket_health_actual', 'Out of Pocket Health Care Expenses - Actual Monthly Expenses', 'medical'),
    expenseField('h4_out_of_pocket_health_irs_allowed', 'Out of Pocket Health Care Expenses - IRS Allowed', 'medical'),
    expenseField('h4_total_actual', 'Medical Total - Actual Monthly Expenses', 'medical'),
    expenseField('h4_total_irs_allowed', 'Medical Total - IRS Allowed', 'medical'),
    expenseField('h5_child_dependent_care_actual', 'Child / Dependent Care - Actual Monthly Expenses', 'other'),
    expenseField('h5_estimated_tax_payments_actual', 'Estimated Tax Payments - Actual Monthly Expenses', 'other'),
    expenseField('h5_term_life_insurance_actual', 'Term Life Insurance - Actual Monthly Expenses', 'other'),
    expenseField('h5_retirement_employer_required_actual', 'Retirement (Employer Required) - Actual Monthly Expenses', 'other'),
    expenseField('h5_retirement_voluntary_actual', 'Retirement (Voluntary) - Actual Monthly Expenses', 'other'),
    expenseField('h5_union_dues_actual', 'Union Dues - Actual Monthly Expenses', 'other'),
    expenseField('h5_delinquent_state_local_taxes_actual', 'Delinquent State & Local Taxes (minimum payment) - Actual Monthly Expenses', 'other'),
    expenseField('h5_student_loans_actual', 'Student Loans (minimum payment) - Actual Monthly Expenses', 'other'),
    expenseField('h5_court_ordered_child_support_actual', 'Court Ordered Child Support - Actual Monthly Expenses', 'other'),
    expenseField('h5_court_ordered_alimony_actual', 'Court Ordered Alimony - Actual Monthly Expenses', 'other'),
    expenseField('h5_other_court_ordered_payments_actual', 'Other Court Ordered Payments - Actual Monthly Expenses', 'other'),
    field('h5_other_1_description', 2, 'H. Monthly Necessary Living Expenses', 'Other (specify) row 1 - Description', 'h5_other_1_description', 'text', false, { repeat_group: 'other' }),
    expenseField('h5_other_1_actual', 'Other (specify) row 1 - Actual Monthly Expenses', 'other'),
    field('h5_other_2_description', 2, 'H. Monthly Necessary Living Expenses', 'Other (specify) row 2 - Description', 'h5_other_2_description', 'text', false, { repeat_group: 'other' }),
    expenseField('h5_other_2_actual', 'Other (specify) row 2 - Actual Monthly Expenses', 'other'),
    field('h5_other_3_description', 2, 'H. Monthly Necessary Living Expenses', 'Other (specify) row 3 - Description', 'h5_other_3_description', 'text', false, { repeat_group: 'other' }),
    expenseField('h5_other_3_actual', 'Other (specify) row 3 - Actual Monthly Expenses', 'other'),
    expenseField('h5_total_actual', 'Other Total - Actual Monthly Expenses', 'other'),
    expenseField('h5_total_irs_allowed', 'Other Total - IRS Allowed', 'other')
  ];
}

function moneyNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function num(value) { return moneyNumber(value) || 0; }
function boolLike(value) { return ['yes','true','on','1','checked'].includes(String(value || '').toLowerCase()); }
function has(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function safePreview(value) {
  if (!has(value)) return '';
  const str = String(value).trim();
  if (/^\d{4}$/.test(str)) return `***-${str}`;
  if (/^\d{3}-?\d{2}-?\d{4}$/.test(str) || /^\d{2}-?\d{7}$/.test(str)) return '[sensitive id supplied - hidden]';
  if (str.length > 140) return `${str.slice(0, 137)}...`;
  return str;
}

function sectionSummary() {
  const bySection = {};
  IRS_433F_FIELD_MAP.forEach((f) => {
    bySection[f.section] = bySection[f.section] || { section: f.section, field_count: 0, organizer_required: 0, final_required: 0, sensitive_count: 0 };
    bySection[f.section].field_count += 1;
    if (f.required_for_organizer) bySection[f.section].organizer_required += 1;
    if (f.required_for_final_output) bySection[f.section].final_required += 1;
    if (f.sensitive) bySection[f.section].sensitive_count += 1;
  });
  return Object.values(bySection);
}

function build433FFieldMapReport() {
  return {
    version: VERSION,
    form: IRS_433F_OFFICIAL_SOURCE,
    policy: IRS_433F_OUTPUT_POLICY,
    summary: {
      total_fields: IRS_433F_FIELD_MAP.length,
      organizer_required_fields: IRS_433F_FIELD_MAP.filter((f) => f.required_for_organizer).length,
      final_output_required_fields: IRS_433F_FIELD_MAP.filter((f) => f.required_for_final_output).length,
      sensitive_or_signature_fields: IRS_433F_FIELD_MAP.filter((f) => f.sensitive || f.signature_or_perjury).length,
      pdf_field_names_confirmed: IRS_433F_FIELD_MAP.filter((f) => f.official_pdf_field_name).length,
      mapping_status: 'complete_logical_official_section_map_needs_pdf_field_or_coordinate_lock'
    },
    sections: sectionSummary(),
    fields: IRS_433F_FIELD_MAP
  };
}

function build433FOrganizerSchema() {
  const publicFields = IRS_433F_FIELD_MAP.filter((f) => !f.final_only && !['account_number','ssn_or_itin','signature'].includes(f.value_type));
  const sections = [];
  publicFields.forEach((field) => {
    let section = sections.find((s) => s.label === field.section);
    if (!section) {
      section = { label: field.section, fields: [] };
      sections.push(section);
    }
    section.fields.push({
      key: field.input_key,
      label: field.official_label,
      type: field.value_type,
      required: field.required_for_organizer,
      repeat_group: field.repeat_group,
      row: field.row,
      conditional: field.conditional,
      help: field.sensitive ? 'Sensitive final-form field. Current public mode should use redacted/last-4 or staff-controlled collection only.' : ''
    });
  });
  return {
    ok: true,
    version: VERSION,
    form: IRS_433F_OFFICIAL_SOURCE,
    current_site_mode: IRS_433F_OUTPUT_POLICY.current_site_mode,
    warning: 'Use this organizer to prepare a checklist and draft map. Do not paste full SSNs, full bank/account numbers, full notices, transcripts, or unredacted taxpayer documents in the current controlled launch.',
    sections
  };
}

function build433FDerivedCalculations(answers = {}) {
  const wageGrossMonthly = payPeriodToMonthly(answers.taxpayer_gross_per_pay_period, answers.taxpayer_pay_frequency) + payPeriodToMonthly(answers.spouse_gross_per_pay_period, answers.spouse_pay_frequency);
  const wageTaxesMonthly = payPeriodToMonthly(answers.taxpayer_federal_tax_per_pay_period, answers.taxpayer_pay_frequency) + payPeriodToMonthly(answers.taxpayer_state_tax_per_pay_period, answers.taxpayer_pay_frequency) + payPeriodToMonthly(answers.taxpayer_local_tax_per_pay_period, answers.taxpayer_pay_frequency) + payPeriodToMonthly(answers.spouse_federal_tax_per_pay_period, answers.spouse_pay_frequency) + payPeriodToMonthly(answers.spouse_state_tax_per_pay_period, answers.spouse_pay_frequency) + payPeriodToMonthly(answers.spouse_local_tax_per_pay_period, answers.spouse_pay_frequency);
  const nonWageIncome = ['alimony_income','child_support_income','net_self_employment_income','net_rental_income','unemployment_income','pension_income','interest_dividends_income','social_security_income','other_income_amount'].reduce((s, k) => s + num(answers[k]), 0);
  const monthlyIncome = Math.max(0, wageGrossMonthly - wageTaxesMonthly) + nonWageIncome;
  const foodTotal = totalOrParts(answers.h1_total_actual, ['h1_food_actual','h1_housekeeping_actual','h1_clothing_actual','h1_personal_care_actual','h1_misc_actual'], answers);
  const transportationTotal = totalOrParts(answers.h2_total_actual, ['h2_vehicle_operating_actual','h2_public_transportation_actual'], answers);
  const housingTotal = totalOrParts(answers.h3_total_actual, ['h3_rent_actual','h3_utilities_actual','h3_phone_cable_internet_actual','h3_real_estate_taxes_insurance_actual','h3_maintenance_repairs_actual'], answers);
  const medicalTotal = totalOrParts(answers.h4_total_actual, ['h4_health_insurance_actual','h4_out_of_pocket_health_actual'], answers);
  const otherTotal = totalOrParts(answers.h5_total_actual, ['h5_child_dependent_care_actual','h5_estimated_tax_payments_actual','h5_term_life_insurance_actual','h5_retirement_employer_required_actual','h5_retirement_voluntary_actual','h5_union_dues_actual','h5_delinquent_state_local_taxes_actual','h5_student_loans_actual','h5_court_ordered_child_support_actual','h5_court_ordered_alimony_actual','h5_other_court_ordered_payments_actual','h5_other_1_actual','h5_other_2_actual','h5_other_3_actual'], answers);
  const monthlyExpenses = foodTotal + transportationTotal + housingTotal + medicalTotal + otherTotal;
  const bankBalances = sumPrefixRows(answers, 'bank', 'current_balance_value', 2);
  const investmentBalances = sumPrefixRows(answers, 'investment', 'current_balance_value', 2);
  const digitalAssetBalances = sumPrefixRows(answers, 'digital_asset', 'amount_value_usd', 2);
  const realEstateEquity = sumPrefixRows(answers, 'real_estate', 'equity', 2);
  const otherAssetEquity = sumPrefixRows(answers, 'other_asset', 'equity', 2);
  const creditCardMinimums = sumPrefixRows(answers, 'credit_card', 'minimum_monthly_payment', 2);
  const creditCardBalances = sumPrefixRows(answers, 'credit_card', 'balance_owed', 2);
  return {
    wage_gross_monthly: round(wageGrossMonthly),
    wage_tax_withholding_monthly: round(wageTaxesMonthly),
    non_wage_income_monthly: round(nonWageIncome),
    total_monthly_income_estimate: round(monthlyIncome),
    food_personal_care_total: round(foodTotal),
    transportation_total: round(transportationTotal),
    housing_utilities_total: round(housingTotal),
    medical_total: round(medicalTotal),
    other_expenses_total: round(otherTotal),
    total_monthly_expense_estimate: round(monthlyExpenses),
    rough_monthly_net_after_expenses: round(monthlyIncome - monthlyExpenses),
    total_disclosed_bank_balances: round(bankBalances),
    total_disclosed_investments: round(investmentBalances),
    total_disclosed_digital_assets: round(digitalAssetBalances),
    total_disclosed_real_estate_equity: round(realEstateEquity),
    total_disclosed_other_asset_equity: round(otherAssetEquity),
    total_disclosed_credit_card_balances: round(creditCardBalances),
    total_credit_card_minimums: round(creditCardMinimums)
  };
}

function payPeriodToMonthly(amount, frequency) {
  const n = num(amount);
  const f = String(frequency || '').toLowerCase();
  if (!n) return 0;
  if (f.includes('weekly') && !f.includes('bi')) return n * 52 / 12;
  if (f.includes('bi')) return n * 26 / 12;
  if (f.includes('semi')) return n * 2;
  return n;
}

function totalOrParts(total, parts, answers) {
  const explicit = moneyNumber(total);
  if (explicit !== null) return explicit;
  return parts.reduce((s, k) => s + num(answers[k]), 0);
}

function sumPrefixRows(answers, prefix, suffix, count) {
  let total = 0;
  for (let row = 1; row <= count; row += 1) total += num(answers[`${prefix}_${row}_${suffix}`]);
  return total;
}

function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }

function validate433FAnswers(answers = {}, options = {}) {
  const missing = [];
  const warnings = [];
  const errors = [];
  const currentMode = options.currentMode || IRS_433F_OUTPUT_POLICY.current_site_mode;
  for (const f of IRS_433F_FIELD_MAP) {
    if (f.required_for_organizer && !has(answers[f.input_key])) missing.push({ key: f.input_key, label: f.official_label, section: f.section });
    if (f.value_type === 'money' && has(answers[f.input_key]) && moneyNumber(answers[f.input_key]) === null) errors.push({ key: f.input_key, error: 'Enter a valid dollar amount or leave blank.' });
    if (f.value_type === 'number' && has(answers[f.input_key]) && !Number.isFinite(Number(answers[f.input_key]))) errors.push({ key: f.input_key, error: 'Enter a number.' });
  }
  if (currentMode === 'organizer_only_no_sensitive_required') {
    ['taxpayer_ssn_itin','spouse_ssn_itin','business_ein'].forEach((k) => {
      if (has(answers[k])) warnings.push({ key: k, warning: 'Sensitive ID supplied. Current public mode should avoid full SSN/ITIN/EIN unless production sensitive-data gates are approved.' });
    });
    ['bank_1_account_number','bank_2_account_number','investment_1_account_number','investment_2_account_number','merchant_account_1_merchant_account_number','merchant_account_2_merchant_account_number','merchant_account_3_merchant_account_number'].forEach((k) => {
      if (has(answers[k])) warnings.push({ key: k, warning: 'Full account numbers should not be collected in current public mode.' });
    });
  }
  const under65 = moneyNumber(answers.household_under_65_count);
  const over65 = moneyNumber(answers.household_65_over_count);
  if (under65 !== null && under65 < 0) errors.push({ key: 'household_under_65_count', error: 'Household count cannot be negative.' });
  if (over65 !== null && over65 < 0) errors.push({ key: 'household_65_over_count', error: 'Household count cannot be negative.' });
  const selfEmployed = String(answers.self_employed_or_self_employment_income || '').toLowerCase();
  if (['yes','true','on'].includes(selfEmployed)) {
    ['business_name','business_type','net_self_employment_income'].forEach((k) => { if (!has(answers[k])) warnings.push({ key: k, warning: 'Self-employment was reported. Business details and current-year profit/loss support should be gathered before review.' }); });
  }
  if (!has(answers.bank_1_institution_name_address) && !has(answers.bank_2_institution_name_address)) warnings.push({ key: 'bank_accounts', warning: 'Form 433-F instructions expect all accounts to be listed, even if they currently have no balance.' });
  const derived = build433FDerivedCalculations(answers);
  if (derived.total_monthly_income_estimate && derived.total_monthly_expense_estimate && derived.total_monthly_expense_estimate > derived.total_monthly_income_estimate) warnings.push({ key: 'expenses_exceed_income', warning: 'Monthly expenses appear higher than income. Verify amounts and source documents before output.' });
  if (derived.total_disclosed_digital_assets > 0) warnings.push({ key: 'digital_assets', warning: 'Digital asset entries can be sensitive and should be verified carefully before any IRS submission.' });
  if (has(answers.assets_transferred_recently) && boolLike(answers.assets_transferred_recently)) warnings.push({ key: 'asset_transfer_review', warning: 'Recent asset transfers should be reviewed before collection disclosure or strategy.' });
  return { ok: errors.length === 0, missing, warnings, errors, derived };
}

function build433FCompletionPlan(answers = {}, options = {}) {
  const sourceRecord = options.sourceRecord || null;
  const officialForm = options.officialForm || null;
  const validation = validate433FAnswers(answers, options);
  const officialPdfCaptured = Boolean((officialForm && officialForm.sha256) || (sourceRecord && sourceRecord.pdf_capture_status === 'captured'));
  const mappingVerified = Boolean((officialForm && ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(officialForm.mapping_status || ''))) || (sourceRecord && ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(sourceRecord.mapping_status || ''))));
  const qaPassed = Boolean((officialForm && officialForm.sample_fill_status === 'passed') || (sourceRecord && sourceRecord.sample_fill_status === 'passed'));
  const clientAnswersComplete = validation.missing.length === 0 && validation.errors.length === 0;
  const professionalReleased = options.professionalReleased === true;
  const clientVerified = options.clientVerified === true;
  const productionSensitiveGate = options.productionSensitiveGate === true;
  const requiredReviewTriggers = build433FReviewTriggers(answers, validation.derived);
  const officialClientOutputAllowed = officialPdfCaptured && mappingVerified && qaPassed && clientAnswersComplete && clientVerified && professionalReleased && productionSensitiveGate && requiredReviewTriggers.filter((t) => t.required_before_release).length === 0;
  const blockedReasons = [];
  if (!officialPdfCaptured) blockedReasons.push('Official IRS PDF has not been captured/checksummed in the app.');
  if (!mappingVerified) blockedReasons.push('PDF field names or overlay coordinates are not verified.');
  if (!qaPassed) blockedReasons.push('Sample-fill visual QA has not passed.');
  if (!clientAnswersComplete) blockedReasons.push('Organizer answers are missing or have validation errors.');
  if (!clientVerified) blockedReasons.push('Client verification of every value has not been recorded.');
  if (!professionalReleased) blockedReasons.push('Required collection/professional review release has not been recorded.');
  if (!productionSensitiveGate) blockedReasons.push('Production sensitive-data gate is not approved for full SSN/EIN/account/signature handling.');
  requiredReviewTriggers.filter((t) => t.required_before_release).forEach((t) => blockedReasons.push(t.label));
  return {
    ok: validation.ok,
    version: VERSION,
    form: IRS_433F_OFFICIAL_SOURCE,
    policy: IRS_433F_OUTPUT_POLICY,
    organizer_status: {
      client_can_complete_organizer_now: clientAnswersComplete,
      current_site_mode: IRS_433F_OUTPUT_POLICY.current_site_mode,
      answered_mapped_fields: IRS_433F_FIELD_MAP.filter((f) => has(answers[f.input_key])).length,
      total_mapped_fields: IRS_433F_FIELD_MAP.length,
      missing_required_count: validation.missing.length,
      validation_error_count: validation.errors.length,
      warning_count: validation.warnings.length
    },
    derived_calculations: validation.derived,
    field_candidates: IRS_433F_FIELD_MAP.map((f) => ({
      key: f.key,
      page: f.page,
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
    validation: { missing: validation.missing, warnings: validation.warnings, errors: validation.errors },
    review_triggers: requiredReviewTriggers,
    output_gate: {
      official_pdf_captured: officialPdfCaptured,
      mapping_verified: mappingVerified,
      sample_fill_qa_passed: qaPassed,
      client_answers_complete: clientAnswersComplete,
      client_verification_recorded: clientVerified,
      professional_release_recorded: professionalReleased,
      production_sensitive_gate_approved: productionSensitiveGate,
      organizer_only_allowed: clientAnswersComplete,
      official_client_output_allowed: officialClientOutputAllowed,
      current_status: officialClientOutputAllowed ? 'eligible_for_final_staff_controlled_output' : 'organizer_ready_or_blocked_until_mapping_qa_review_security_gates_pass',
      blocked_reasons: blockedReasons
    },
    next_actions: build433FNextActions(validation, { officialPdfCaptured, mappingVerified, qaPassed, clientAnswersComplete, clientVerified, professionalReleased, productionSensitiveGate, requiredReviewTriggers })
  };
}

function build433FReviewTriggers(answers = {}, derived = {}) {
  const triggers = [
    { key: 'collection_financial_disclosure', label: 'Form 433-F is a collection financial disclosure and should receive qualified review before IRS release.', required_before_release: true }
  ];
  if (boolLike(answers.self_employed_or_self_employment_income) || num(answers.net_self_employment_income) > 0) triggers.push({ key: 'self_employment_business_review', label: 'Self-employment/business financial details need P&L/support review.', required_before_release: true });
  if (has(answers.merchant_account_name_on_account) || has(answers.accounts_receivable_1_name)) triggers.push({ key: 'business_collection_items', label: 'Accounts receivable or merchant-account details should be reviewed for business collection issues.', required_before_release: true });
  if (derived.rough_monthly_net_after_expenses < 0) triggers.push({ key: 'negative_cashflow', label: 'Expenses exceed income; verify facts and supporting documentation before release.', required_before_release: true });
  if (derived.total_disclosed_real_estate_equity > 0 || derived.total_disclosed_other_asset_equity > 0) triggers.push({ key: 'asset_equity_review', label: 'Asset/equity disclosure should be reviewed before IRS submission.', required_before_release: true });
  if (derived.total_disclosed_digital_assets > 0) triggers.push({ key: 'digital_asset_review', label: 'Digital asset disclosure should be reviewed carefully before IRS submission.', required_before_release: true });
  if (boolLike(answers.levy_lien_or_summons_language)) triggers.push({ key: 'urgent_collection_language', label: 'Levy, lien, summons, or similar collection language requires urgent professional review.', required_before_release: true });
  if (boolLike(answers.payroll_or_trust_fund_issue)) triggers.push({ key: 'trust_fund_warning', label: 'Payroll/trust-fund facts can be legal-sensitive and should be escalated.', required_before_release: true });
  return dedupe(triggers);
}

function build433FNextActions(validation, gates) {
  const actions = [];
  if (validation.missing.length) actions.push({ owner: 'client_organizer', priority: 1, action: `Answer ${validation.missing.length} required organizer question(s).`, items: validation.missing });
  if (validation.errors.length) actions.push({ owner: 'client_organizer', priority: 1, action: `Fix ${validation.errors.length} invalid number/money value(s).`, items: validation.errors });
  if (validation.warnings.length) actions.push({ owner: 'staff_or_ai_followup', priority: 2, action: `Review ${validation.warnings.length} warning(s) and ask targeted follow-ups.`, items: validation.warnings.slice(0, 10) });
  if (!gates.officialPdfCaptured) actions.push({ owner: 'mapping_qa', priority: 2, action: 'Capture/checksum the official IRS Form 433-F PDF from irs.gov.' });
  if (!gates.mappingVerified) actions.push({ owner: 'mapping_qa', priority: 2, action: 'Extract/confirm PDF field names or lock overlay coordinates for every mapped 433-F field.' });
  if (!gates.qaPassed) actions.push({ owner: 'mapping_qa', priority: 2, action: 'Generate and visually inspect sample-filled 433-F PDFs for overflow, checkboxes, page placement, and blank signature fields.' });
  if (!gates.productionSensitiveGate) actions.push({ owner: 'owner_security', priority: 3, action: 'Keep full SSN/EIN/account/signature handling blocked until production sensitive-data controls are approved.' });
  const review = (gates.requiredReviewTriggers || []).filter((t) => t.required_before_release);
  if (review.length) actions.push({ owner: 'ea_cpa_tax_attorney_review', priority: 3, action: `Resolve ${review.length} collection/professional review trigger(s).`, items: review });
  if (!gates.clientVerified) actions.push({ owner: 'client', priority: 4, action: 'Client must verify every completed value before signature or release.' });
  if (!gates.professionalReleased) actions.push({ owner: 'staff_or_professional', priority: 4, action: 'Record professional/staff release before any final official output.' });
  return actions.sort((a, b) => a.priority - b.priority);
}

function build433FOutputReadiness({ store } = {}) {
  const sourceRecords = store && store.list ? store.list('official_form_sources', (s) => !s.deleted_at && s.agency === 'IRS' && String(s.form_number || '').toUpperCase().replace(/[^0-9A-Z]/g, '') === '433F') : [];
  const officialForms = store && store.list ? store.list('official_forms', (f) => !f.deleted_at && f.agency === 'IRS' && String(f.form_number || '').toUpperCase().replace(/[^0-9A-Z]/g, '') === '433F') : [];
  const captured = sourceRecords.filter((s) => s.pdf_capture_status === 'captured').length + officialForms.filter((f) => f.storage_path || f.sha256).length;
  const mapped = sourceRecords.filter((s) => ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(s.mapping_status || ''))).length + officialForms.filter((f) => ['verified','mapped_verified','sample_fill_passed','client_output_ready'].includes(String(f.mapping_status || ''))).length;
  const checks = [
    { key: 'official_source_identified', label: 'Official IRS source identified', ok: true, detail: IRS_433F_OFFICIAL_SOURCE.source_url },
    { key: 'logical_field_map_complete', label: 'Official section/line logical field map prepared', ok: IRS_433F_FIELD_MAP.length >= 90, detail: `${IRS_433F_FIELD_MAP.length} field candidates across ${sectionSummary().length} sections` },
    { key: 'public_organizer_schema_available', label: 'Public no-sensitive organizer schema available', ok: true, detail: 'Users can complete an organizer/checklist without requiring full SSNs or account numbers.' },
    { key: 'official_pdf_captured', label: 'Official PDF captured and checksummed', ok: captured > 0, detail: `${captured} captured/attached record(s)` },
    { key: 'pdf_field_names_or_coordinates_confirmed', label: 'PDF field names or overlay coordinates confirmed', ok: mapped > 0, detail: `${mapped} mapped/verified record(s)` },
    { key: 'sample_fill_qa_complete', label: 'Sample-filled PDF visual QA complete', ok: false, detail: 'Requires official PDF capture plus visual inspection.' },
    { key: 'signature_fields_blank', label: 'Signature/date/perjury fields controlled', ok: true, detail: 'Mapped as final-only and blank until client signs after review.' },
    { key: 'professional_release_gate', label: 'Collection/professional release gate enforced', ok: true, detail: 'Completion plan always triggers qualified review before official IRS release.' },
    { key: 'sensitive_data_gate', label: 'Full SSN/EIN/account-number handling remains blocked until production approval', ok: true, detail: IRS_433F_OUTPUT_POLICY.current_site_mode }
  ];
  return {
    version: VERSION,
    form: IRS_433F_OFFICIAL_SOURCE,
    summary: { required_checks: checks.length, passed: checks.filter((c) => c.ok).length, blocked: checks.filter((c) => !c.ok).length, organizer_ready: true, client_output_ready: checks.every((c) => c.ok) },
    checks,
    next_actions: checks.filter((c) => !c.ok).map((c) => c.label),
    source_records: sourceRecords.map((s) => ({ ...s, storage_path: undefined })),
    official_pdf_records: officialForms.map((f) => ({ ...f, storage_path: undefined })),
    release_rule: IRS_433F_OFFICIAL_SOURCE.client_output_rule
  };
}

function build433FSampleCases() {
  return { form: IRS_433F_OFFICIAL_SOURCE, sample_cases: IRS_433F_SAMPLE_CASES.map((s) => ({ key: s.key, label: s.label, purpose: s.purpose, completion_plan: build433FCompletionPlan(s.answers) })) };
}

function build433FSampleFillAudit(answers = {}, options = {}) {
  const plan = build433FCompletionPlan(answers, options);
  const qa = [
    { key: 'official_source', status: 'passed', note: 'IRS source URL identified from irs.gov.' },
    { key: 'logical_field_map', status: 'passed', note: `${IRS_433F_FIELD_MAP.length} fields mapped to official sections/pages.` },
    { key: 'organizer_answers', status: plan.organizer_status.client_can_complete_organizer_now ? 'passed' : 'blocked', note: `${plan.validation.missing.length} required organizer answer(s) missing; ${plan.validation.errors.length} validation error(s).` },
    { key: 'income_expense_math', status: plan.validation.errors.length ? 'blocked' : 'ready_for_review', note: `Monthly income ${money(plan.derived_calculations.total_monthly_income_estimate)}, expenses ${money(plan.derived_calculations.total_monthly_expense_estimate)}, rough net ${money(plan.derived_calculations.rough_monthly_net_after_expenses)}.` },
    { key: 'sensitive_fields', status: 'blocked_in_public_mode', note: 'Full SSN/EIN/account-number/signature fields are final-only and must not be required in current public mode.' },
    { key: 'signature_fields', status: 'blank_required', note: 'Taxpayer/spouse signatures and date must remain blank until client signs after verification/review.' },
    { key: 'overflow_visual_check', status: 'not_run_until_official_pdf_capture', note: 'Requires filled official PDF render and visual inspection.' },
    { key: 'professional_review', status: 'required_before_release', note: '433-F collection financial disclosure should not be released to IRS without qualified review.' },
    { key: 'final_client_output', status: plan.output_gate.official_client_output_allowed ? 'allowed_after_release' : 'blocked', note: plan.output_gate.blocked_reasons.join('; ') || 'ready' }
  ];
  return { ok: true, version: VERSION, form: IRS_433F_OFFICIAL_SOURCE, plan, qa, print_ready: plan.output_gate.official_client_output_allowed };
}

function build433FVerificationSheet(answers = {}, options = {}) {
  const plan = build433FCompletionPlan(answers, options);
  const grouped = {};
  plan.field_candidates.forEach((f) => {
    grouped[f.section] = grouped[f.section] || [];
    grouped[f.section].push({ page: f.page, label: f.official_label, input_key: f.input_key, value_preview: f.value_preview, present: f.value_present, verify: f.signature_or_perjury ? 'Must remain blank until final review/signature.' : 'Client must confirm before final output.' });
  });
  return { ok: true, version: VERSION, form: IRS_433F_OFFICIAL_SOURCE, release_status: plan.output_gate.current_status, blocked_reasons: plan.output_gate.blocked_reasons, sections: grouped, warnings: plan.validation.warnings, errors: plan.validation.errors, missing: plan.validation.missing, derived_calculations: plan.derived_calculations };
}

function create433FDraftPdfBuffer(answers = {}, options = {}) {
  const plan = build433FCompletionPlan(answers, options);
  const doc = new PDFDocument({ size: 'LETTER', margin: 44, info: { Title: 'IRS Form 433-F Organizer QA Packet', Author: 'Justice Tax Solutions' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const endPromise = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(16).text('Justice Tax Solutions', { align: 'center' });
  doc.fontSize(13).text('IRS Form 433-F Organizer / QA Packet', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('red').text('Internal organizer/checklist only. This is not an official IRS Form 433-F, not an IRS submission, and not a tax-resolution guarantee. Final official output is blocked until official PDF, mapping, sample QA, client verification, professional release, and sensitive-data gates pass.', { align: 'center' });
  doc.fillColor('black').moveDown();
  doc.fontSize(10).text(`Official source: ${IRS_433F_OFFICIAL_SOURCE.source_url}`);
  doc.text(`Organizer status: ${plan.organizer_status.client_can_complete_organizer_now ? 'Organizer answers complete' : 'Missing organizer answers'}`);
  doc.text(`Official client output: ${plan.output_gate.official_client_output_allowed ? 'allowed' : 'blocked'}`);
  doc.moveDown();
  doc.fontSize(12).text('Derived financial snapshot', { underline: true });
  Object.entries(plan.derived_calculations).forEach(([key, value]) => doc.fontSize(9).text(`${key}: ${typeof value === 'number' ? money(value) : value}`));
  doc.moveDown();
  doc.fontSize(12).text('Blocked reasons', { underline: true });
  (plan.output_gate.blocked_reasons.length ? plan.output_gate.blocked_reasons : ['No current blockers.']).forEach((item, i) => doc.fontSize(9).text(`${i + 1}. ${item}`));
  doc.addPage();
  doc.fontSize(13).text('Field candidates by official section', { underline: true });
  plan.field_candidates.forEach((f) => {
    if (doc.y > 720) doc.addPage();
    doc.fontSize(8).text(`P${f.page} · ${f.section} · ${f.official_label}: ${f.value_preview || '[blank / not supplied]'}`);
  });
  doc.addPage();
  doc.fontSize(13).text('QA checklist before any official output', { underline: true });
  build433FSampleFillAudit(answers, options).qa.forEach((item, idx) => doc.fontSize(9).text(`${idx + 1}. ${item.key}: ${item.status} — ${item.note}`));
  doc.end();
  return endPromise;
}

function money(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

module.exports = {
  IRS_433F_OFFICIAL_SOURCE,
  IRS_433F_OUTPUT_POLICY,
  IRS_433F_FIELD_MAP,
  IRS_433F_SAMPLE_CASES,
  build433FFieldMapReport,
  build433FOrganizerSchema,
  build433FCompletionPlan,
  build433FOutputReadiness,
  build433FSampleCases,
  build433FSampleFillAudit,
  build433FVerificationSheet,
  create433FDraftPdfBuffer,
  validate433FAnswers,
  build433FDerivedCalculations
};
