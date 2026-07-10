const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');

const VERSION = '0.1.72';
const TAX_YEAR = 2025;
const ROOT = path.join(__dirname, '..');
const OFFICIAL_PDF = path.join(ROOT, 'assets', 'official-forms', 'irs-individual-income-tax', 'f1040 U.S. Individual Income Tax Return.pdf');
const TAX_TABLE_PATH = path.join(ROOT, 'assets', 'tax-rules', '2025-federal-income-tax-table.json');
const TAX_TABLE = JSON.parse(fs.readFileSync(TAX_TABLE_PATH, 'utf8'));

const SOURCE = Object.freeze({
  agency: 'Internal Revenue Service',
  formNumber: '1040',
  taxYear: TAX_YEAR,
  title: '2025 Form 1040 - U.S. Individual Income Tax Return',
  officialUrl: 'https://www.irs.gov/pub/irs-pdf/f1040.pdf',
  localRelativePath: path.relative(ROOT, OFFICIAL_PDF).replace(/\\/g, '/'),
  officialInstructionsUrl: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf',
  taxTableRelativePath: path.relative(ROOT, TAX_TABLE_PATH).replace(/\\/g, '/'),
  sourceBoundary: 'The packaged PDF and extracted tax table are controlled source assets. Current revision and release approval must be rechecked before real-user use.'
});

const PILOT_POLICY = Object.freeze({
  name: '2025 Form 1040 Simple W-2 Controlled Pilot',
  status: 'sample_and_internal_qa_only',
  purpose: 'A narrow, deterministic first filing lane for a calendar-year 2025 return with W-2 wages only.',
  supported: [
    'Tax year 2025 calendar-year Form 1040',
    'Single or married filing jointly',
    'One or more W-2s, aggregated from box 1 and box 2',
    'Basic standard deduction',
    'Taxable income below $100,000',
    '2025 Form 1040 tax-table lookup',
    'Refund or amount-owed calculation without direct deposit',
    'Population of controlled identity, address, filing-status, income, tax, payment, refund, and amount-owed fields'
  ],
  excluded: [
    'Dependents or dependent-related credits',
    'Earned income credit unless a qualified professional has affirmatively determined the amount is zero',
    'Age/blindness additional standard deduction',
    'Schedule 1-A or other additional deductions',
    'Itemized deductions',
    'Self-employment, capital gains, rental, pass-through, retirement, Social Security, unemployment, or other income',
    'Schedule 1, 2, or 3 amounts',
    'Digital-asset activity requiring reporting',
    'Estimated payments, refundable credits, foreign address, dual-status, nonresident-spouse election, or direct deposit',
    'Taxable income of $100,000 or more',
    'Electronic filing, signature, preparer, bank, or submission functions'
  ],
  failClosed: true,
  realUserGate: 'Blocked until production security, live-sensitive-data approval, human semantic QA, professional approval, owner release, and filing-operation controls pass.'
});

const FILING_STATUSES = Object.freeze({
  single: {
    label: 'Single',
    standardDeduction: 15750,
    tableColumn: 'single',
    checkboxField: 'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]'
  },
  married_filing_jointly: {
    label: 'Married filing jointly',
    standardDeduction: 31500,
    tableColumn: 'marriedFilingJointlyOrQualifyingSurvivingSpouse',
    checkboxField: 'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[1]'
  }
});

const FIELD_MAP = Object.freeze({
  taxpayerFirstAndMiddle: 'topmostSubform[0].Page1[0].f1_14[0]',
  taxpayerLast: 'topmostSubform[0].Page1[0].f1_15[0]',
  taxpayerSsn: 'topmostSubform[0].Page1[0].f1_16[0]',
  spouseFirstAndMiddle: 'topmostSubform[0].Page1[0].f1_17[0]',
  spouseLast: 'topmostSubform[0].Page1[0].f1_18[0]',
  spouseSsn: 'topmostSubform[0].Page1[0].f1_19[0]',
  street: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_20[0]',
  apartment: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_21[0]',
  city: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_22[0]',
  state: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_23[0]',
  zip: 'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_24[0]',
  mainHomeInUs: 'topmostSubform[0].Page1[0].c1_5[0]',
  presidentialTaxpayer: 'topmostSubform[0].Page1[0].c1_6[0]',
  presidentialSpouse: 'topmostSubform[0].Page1[0].c1_7[0]',
  digitalAssetsNo: 'topmostSubform[0].Page1[0].c1_10[1]',
  line1aWages: 'topmostSubform[0].Page1[0].f1_47[0]',
  line1zTotalEarnedIncome: 'topmostSubform[0].Page1[0].f1_57[0]',
  line9TotalIncome: 'topmostSubform[0].Page1[0].f1_73[0]',
  line11aAgi: 'topmostSubform[0].Page1[0].f1_75[0]',
  line11bAgi: 'topmostSubform[0].Page2[0].f2_01[0]',
  line12eDeduction: 'topmostSubform[0].Page2[0].f2_02[0]',
  line14TotalDeductions: 'topmostSubform[0].Page2[0].f2_05[0]',
  line15TaxableIncome: 'topmostSubform[0].Page2[0].f2_06[0]',
  line16Tax: 'topmostSubform[0].Page2[0].f2_08[0]',
  line18TaxBeforeCredits: 'topmostSubform[0].Page2[0].f2_10[0]',
  line22TaxAfterCredits: 'topmostSubform[0].Page2[0].f2_14[0]',
  line24TotalTax: 'topmostSubform[0].Page2[0].f2_16[0]',
  line25aW2Withholding: 'topmostSubform[0].Page2[0].f2_17[0]',
  line25dTotalWithholding: 'topmostSubform[0].Page2[0].f2_20[0]',
  line33TotalPayments: 'topmostSubform[0].Page2[0].f2_29[0]',
  line34Overpayment: 'topmostSubform[0].Page2[0].f2_30[0]',
  line35aRefund: 'topmostSubform[0].Page2[0].f2_31[0]',
  line37AmountOwed: 'topmostSubform[0].Page2[0].f2_35[0]',
  thirdPartyNo: 'topmostSubform[0].Page2[0].c2_17[1]'
});

const INTERVIEW_QUESTIONS = Object.freeze([
  { id: 'taxYear', path: 'taxYear', prompt: 'Which tax year are you preparing?', type: 'number', required: true, accepted: [2025], why: 'Every form, table, and calculation is tax-year specific.' },
  { id: 'sampleMode', path: 'sampleMode', prompt: 'Is this synthetic or redacted sample data for internal testing?', type: 'boolean', required: true, accepted: [true], why: 'Real taxpayer data remains blocked until production security and release gates pass.' },
  { id: 'filingStatus', path: 'filingStatus', prompt: 'What filing status will be used?', type: 'choice', required: true, options: Object.keys(FILING_STATUSES), why: 'Filing status controls the standard deduction and tax-table column; eligibility must be verified.' },
  { id: 'taxpayerName', path: 'taxpayer.firstName', prompt: 'What is the taxpayer’s first name?', type: 'text', required: true, why: 'This populates the identity section of Form 1040.' },
  { id: 'taxpayerLastName', path: 'taxpayer.lastName', prompt: 'What is the taxpayer’s last name?', type: 'text', required: true, why: 'This populates the identity section of Form 1040.' },
  { id: 'taxpayerSsn', path: 'taxpayer.ssn', prompt: 'What synthetic SSN should be used for this sample?', type: 'ssn', required: true, why: 'The sample generator accepts only clearly synthetic SSNs while live-sensitive-data handling is blocked.' },
  { id: 'street', path: 'taxpayer.address.street', prompt: 'What is the street address?', type: 'text', required: true, why: 'Form 1040 requires a mailing address.' },
  { id: 'city', path: 'taxpayer.address.city', prompt: 'What is the city?', type: 'text', required: true, why: 'Form 1040 requires a mailing address.' },
  { id: 'state', path: 'taxpayer.address.state', prompt: 'What is the two-letter state abbreviation?', type: 'state', required: true, why: 'This pilot supports domestic addresses only.' },
  { id: 'zip', path: 'taxpayer.address.zip', prompt: 'What is the ZIP code?', type: 'zip', required: true, why: 'Form 1040 requires a mailing address.' },
  { id: 'w2s', path: 'w2s', prompt: 'Enter each W-2 box 1 wage amount and box 2 federal withholding amount in whole dollars.', type: 'repeating_w2', required: true, why: 'The pilot aggregates W-2 wages and federal withholding into Form 1040.' },
  { id: 'noDependents', path: 'eligibility.noDependents', prompt: 'Confirm that no dependents are being claimed.', type: 'boolean', required: true, accepted: [true], why: 'Dependent and related credit calculations are outside this first controlled lane.' },
  { id: 'noOtherIncome', path: 'eligibility.noOtherIncome', prompt: 'Confirm that there is no income other than W-2 wages.', type: 'boolean', required: true, accepted: [true], why: 'Other income may require schedules and different calculations.' },
  { id: 'standardDeductionOnly', path: 'eligibility.standardDeductionOnly', prompt: 'Confirm that the taxpayer is using the basic standard deduction and is not itemizing.', type: 'boolean', required: true, accepted: [true], why: 'This pilot does not prepare Schedule A or additional deduction schedules.' },
  { id: 'under65NotBlind', path: 'eligibility.noAgeOrBlindnessAdjustment', prompt: 'Confirm that neither taxpayer nor spouse requires an age or blindness adjustment.', type: 'boolean', required: true, accepted: [true], why: 'Additional standard-deduction calculations are outside this first lane.' },
  { id: 'noCredits', path: 'eligibility.noCreditsOrOtherTaxes', prompt: 'Confirm that a qualified reviewer has determined that no credits, other taxes, or estimated payments apply.', type: 'boolean', required: true, accepted: [true], why: 'Omitting a credit or other tax can make a return incorrect.' },
  { id: 'noEic', path: 'eligibility.professionalNoEicConfirmation', prompt: 'Has a qualified reviewer confirmed that earned income credit is zero for this sample?', type: 'boolean', required: true, accepted: [true], why: 'EIC eligibility is outside this narrow calculation lane and must not be silently omitted.' },
  { id: 'digitalAssetsNo', path: 'eligibility.noDigitalAssetActivity', prompt: 'Confirm that the Form 1040 digital-asset answer is No.', type: 'boolean', required: true, accepted: [true], why: 'Digital-asset reporting requires additional fact gathering and may require other forms.' },
  { id: 'noDirectDeposit', path: 'eligibility.noDirectDeposit', prompt: 'Confirm that direct-deposit bank fields will remain blank.', type: 'boolean', required: true, accepted: [true], why: 'Bank information and direct-debit controls are not enabled in this pilot.' }
]);

function cleanText(value, maxLength = 80) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function wholeDollar(value) {
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) && number >= 0 ? number : null;
}

function getPath(source, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => (value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined), source);
}

function syntheticSsn(value) {
  const normalized = String(value || '').replace(/\D/g, '');
  return ['000000000', '000000001', '999999999'].includes(normalized);
}

function normalizeInput(raw = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const w2s = Array.isArray(input.w2s) ? input.w2s.map((item = {}) => ({
    employerName: cleanText(item.employerName || item.employer_name || '', 120),
    box1Wages: wholeDollar(item.box1Wages ?? item.box_1_wages),
    box2FederalIncomeTaxWithheld: wholeDollar(item.box2FederalIncomeTaxWithheld ?? item.box_2_federal_income_tax_withheld)
  })) : [];
  return {
    taxYear: Number(input.taxYear || input.tax_year || 0),
    sampleMode: input.sampleMode === true || input.sample_mode === true || input.sample_mode === 'true',
    filingStatus: cleanText(input.filingStatus || input.filing_status || '', 50),
    taxpayer: {
      firstName: cleanText(input.taxpayer?.firstName || input.taxpayer?.first_name || '', 35),
      middleInitial: cleanText(input.taxpayer?.middleInitial || input.taxpayer?.middle_initial || '', 1),
      lastName: cleanText(input.taxpayer?.lastName || input.taxpayer?.last_name || '', 35),
      ssn: cleanText(input.taxpayer?.ssn || '', 20),
      address: {
        street: cleanText(input.taxpayer?.address?.street || '', 80),
        apartment: cleanText(input.taxpayer?.address?.apartment || input.taxpayer?.address?.apt || '', 12),
        city: cleanText(input.taxpayer?.address?.city || '', 45),
        state: cleanText(input.taxpayer?.address?.state || '', 2).toUpperCase(),
        zip: cleanText(input.taxpayer?.address?.zip || input.taxpayer?.address?.postalCode || '', 10)
      }
    },
    spouse: {
      firstName: cleanText(input.spouse?.firstName || input.spouse?.first_name || '', 35),
      middleInitial: cleanText(input.spouse?.middleInitial || input.spouse?.middle_initial || '', 1),
      lastName: cleanText(input.spouse?.lastName || input.spouse?.last_name || '', 35),
      ssn: cleanText(input.spouse?.ssn || '', 20)
    },
    mainHomeInUSMoreThanHalfYear: input.mainHomeInUSMoreThanHalfYear === true || input.main_home_in_us_more_than_half_year === true,
    presidentialElection: {
      taxpayer: input.presidentialElection?.taxpayer === true,
      spouse: input.presidentialElection?.spouse === true
    },
    w2s,
    eligibility: {
      noDependents: input.eligibility?.noDependents === true,
      noOtherIncome: input.eligibility?.noOtherIncome === true,
      standardDeductionOnly: input.eligibility?.standardDeductionOnly === true,
      noAgeOrBlindnessAdjustment: input.eligibility?.noAgeOrBlindnessAdjustment === true,
      noCreditsOrOtherTaxes: input.eligibility?.noCreditsOrOtherTaxes === true,
      professionalNoEicConfirmation: input.eligibility?.professionalNoEicConfirmation === true,
      noDigitalAssetActivity: input.eligibility?.noDigitalAssetActivity === true,
      noDirectDeposit: input.eligibility?.noDirectDeposit === true,
      domesticAddressOnly: input.eligibility?.domesticAddressOnly !== false,
      notDependentOfAnotherTaxpayer: input.eligibility?.notDependentOfAnotherTaxpayer !== false,
      noDualStatusOrNonresidentElection: input.eligibility?.noDualStatusOrNonresidentElection !== false
    }
  };
}

function validate(raw = {}, options = {}) {
  const input = normalizeInput(raw);
  const missing = [];
  const errors = [];
  const unsupported = [];
  if (input.taxYear !== TAX_YEAR) unsupported.push('This controlled lane supports tax year 2025 only.');
  if (!FILING_STATUSES[input.filingStatus]) unsupported.push('This controlled lane supports only Single or Married filing jointly.');
  if (!input.taxpayer.firstName) missing.push('taxpayer.firstName');
  if (!input.taxpayer.lastName) missing.push('taxpayer.lastName');
  if (!input.taxpayer.ssn) missing.push('taxpayer.ssn');
  if (!input.taxpayer.address.street) missing.push('taxpayer.address.street');
  if (!input.taxpayer.address.city) missing.push('taxpayer.address.city');
  if (!/^[A-Z]{2}$/.test(input.taxpayer.address.state)) errors.push('taxpayer.address.state must be a two-letter state abbreviation.');
  if (!/^\d{5}(?:-\d{4})?$/.test(input.taxpayer.address.zip)) errors.push('taxpayer.address.zip must be a five-digit or ZIP+4 code.');
  if (!/^\d{3}-?\d{2}-?\d{4}$/.test(input.taxpayer.ssn)) errors.push('taxpayer.ssn must contain nine digits.');
  if (input.filingStatus === 'married_filing_jointly') {
    if (!input.spouse.firstName) missing.push('spouse.firstName');
    if (!input.spouse.lastName) missing.push('spouse.lastName');
    if (!input.spouse.ssn) missing.push('spouse.ssn');
    if (input.spouse.ssn && !/^\d{3}-?\d{2}-?\d{4}$/.test(input.spouse.ssn)) errors.push('spouse.ssn must contain nine digits.');
  }
  if (!input.w2s.length) missing.push('w2s');
  input.w2s.forEach((w2, index) => {
    if (w2.box1Wages === null) errors.push(`w2s[${index}].box1Wages must be a nonnegative whole-dollar amount.`);
    if (w2.box2FederalIncomeTaxWithheld === null) errors.push(`w2s[${index}].box2FederalIncomeTaxWithheld must be a nonnegative whole-dollar amount.`);
    if (w2.box1Wages !== null && w2.box2FederalIncomeTaxWithheld !== null && w2.box2FederalIncomeTaxWithheld > w2.box1Wages) {
      errors.push(`w2s[${index}].box2FederalIncomeTaxWithheld cannot exceed box 1 wages in this pilot.`);
    }
  });
  const requiredEligibility = [
    ['noDependents', 'Dependents and dependent-related credits are not supported.'],
    ['noOtherIncome', 'Income other than W-2 wages is not supported.'],
    ['standardDeductionOnly', 'Itemized or additional deductions are not supported.'],
    ['noAgeOrBlindnessAdjustment', 'Age or blindness standard-deduction adjustments are not supported.'],
    ['noCreditsOrOtherTaxes', 'Credits, other taxes, and estimated payments are not supported.'],
    ['professionalNoEicConfirmation', 'A qualified reviewer must confirm that EIC is zero before this lane can be treated as complete.'],
    ['noDigitalAssetActivity', 'Digital-asset activity is not supported.'],
    ['noDirectDeposit', 'Direct-deposit bank fields remain blocked.'],
    ['domesticAddressOnly', 'Foreign addresses are not supported.'],
    ['notDependentOfAnotherTaxpayer', 'Dependent standard-deduction rules are not supported.'],
    ['noDualStatusOrNonresidentElection', 'Dual-status and nonresident-spouse elections are not supported.']
  ];
  for (const [key, message] of requiredEligibility) if (!input.eligibility[key]) unsupported.push(message);

  const liveSensitiveAllowed = options.allowLiveSensitiveData === true;
  if (!input.sampleMode && !liveSensitiveAllowed) errors.push('Real taxpayer data is blocked. Use synthetic sample data or activate the separately approved live-sensitive-data gate.');
  if (input.sampleMode) {
    if (!syntheticSsn(input.taxpayer.ssn)) errors.push('Sample mode requires a clearly synthetic taxpayer SSN such as 000-00-0000.');
    if (input.filingStatus === 'married_filing_jointly' && !syntheticSsn(input.spouse.ssn)) errors.push('Sample mode requires a clearly synthetic spouse SSN such as 000-00-0001.');
  }

  const wages = input.w2s.reduce((sum, w2) => sum + (w2.box1Wages || 0), 0);
  const withholding = input.w2s.reduce((sum, w2) => sum + (w2.box2FederalIncomeTaxWithheld || 0), 0);
  const status = FILING_STATUSES[input.filingStatus];
  const taxableIncome = status ? Math.max(0, wages - status.standardDeduction) : null;
  if (taxableIncome !== null && taxableIncome >= 100000) unsupported.push('Taxable income of $100,000 or more requires the separate tax-computation worksheet and is outside this first pilot.');

  return {
    version: VERSION,
    input,
    ok: missing.length === 0 && errors.length === 0 && unsupported.length === 0,
    missing,
    errors,
    unsupported,
    aggregates: { wages, withholding, taxableIncome }
  };
}

function lookupTax(taxableIncome, filingStatus) {
  const amount = wholeDollar(taxableIncome);
  const status = FILING_STATUSES[filingStatus];
  if (amount === null) throw new Error('Taxable income must be a nonnegative whole-dollar amount.');
  if (!status) throw new Error('Unsupported filing status.');
  if (amount >= 100000) throw new Error('This tax-table lookup supports taxable income below $100,000.');
  let low = 0;
  let high = TAX_TABLE.rows.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const row = TAX_TABLE.rows[middle];
    if (amount < row.atLeast) high = middle - 1;
    else if (amount >= row.lessThan) low = middle + 1;
    else return { tax: row[status.tableColumn], row };
  }
  throw new Error(`No 2025 tax-table interval found for taxable income ${amount}.`);
}

function calculate(raw = {}, options = {}) {
  const validation = validate(raw, options);
  if (!validation.ok) return { ok: false, version: VERSION, validation, calculation: null };
  const { input, aggregates } = validation;
  const status = FILING_STATUSES[input.filingStatus];
  const taxLookup = lookupTax(aggregates.taxableIncome, input.filingStatus);
  const totalTax = taxLookup.tax;
  const totalPayments = aggregates.withholding;
  const overpayment = Math.max(0, totalPayments - totalTax);
  const amountOwed = Math.max(0, totalTax - totalPayments);
  return {
    ok: true,
    version: VERSION,
    validation,
    calculation: {
      taxYear: TAX_YEAR,
      filingStatus: input.filingStatus,
      filingStatusLabel: status.label,
      wages: aggregates.wages,
      totalIncome: aggregates.wages,
      adjustedGrossIncome: aggregates.wages,
      standardDeduction: status.standardDeduction,
      totalDeductions: status.standardDeduction,
      taxableIncome: aggregates.taxableIncome,
      line16Tax: taxLookup.tax,
      taxTableInterval: { atLeast: taxLookup.row.atLeast, lessThan: taxLookup.row.lessThan, sourcePdfPage: taxLookup.row.sourcePdfPage },
      totalTax,
      federalIncomeTaxWithheld: aggregates.withholding,
      totalPayments,
      overpayment,
      refund: overpayment,
      amountOwed,
      directDepositEnabled: false,
      signatureFieldsPopulated: false,
      preparerFieldsPopulated: false,
      filingStatusDeterminedByEngine: false,
      sourceDocumentCount: input.w2s.length
    }
  };
}

function fieldValues(raw = {}, options = {}) {
  const result = calculate(raw, options);
  if (!result.ok) return { ...result, values: null, checked: null };
  const { input } = result.validation;
  const c = result.calculation;
  const firstAndMiddle = [input.taxpayer.firstName, input.taxpayer.middleInitial].filter(Boolean).join(' ');
  const spouseFirstAndMiddle = [input.spouse.firstName, input.spouse.middleInitial].filter(Boolean).join(' ');
  const values = {
    [FIELD_MAP.taxpayerFirstAndMiddle]: firstAndMiddle,
    [FIELD_MAP.taxpayerLast]: input.taxpayer.lastName,
    [FIELD_MAP.taxpayerSsn]: input.taxpayer.ssn.replace(/\D/g, ''),
    [FIELD_MAP.street]: input.taxpayer.address.street,
    [FIELD_MAP.apartment]: input.taxpayer.address.apartment,
    [FIELD_MAP.city]: input.taxpayer.address.city,
    [FIELD_MAP.state]: input.taxpayer.address.state,
    [FIELD_MAP.zip]: input.taxpayer.address.zip,
    [FIELD_MAP.line1aWages]: String(c.wages),
    [FIELD_MAP.line1zTotalEarnedIncome]: String(c.wages),
    [FIELD_MAP.line9TotalIncome]: String(c.totalIncome),
    [FIELD_MAP.line11aAgi]: String(c.adjustedGrossIncome),
    [FIELD_MAP.line11bAgi]: String(c.adjustedGrossIncome),
    [FIELD_MAP.line12eDeduction]: String(c.standardDeduction),
    [FIELD_MAP.line14TotalDeductions]: String(c.totalDeductions),
    [FIELD_MAP.line15TaxableIncome]: String(c.taxableIncome),
    [FIELD_MAP.line16Tax]: String(c.line16Tax),
    [FIELD_MAP.line18TaxBeforeCredits]: String(c.totalTax),
    [FIELD_MAP.line22TaxAfterCredits]: String(c.totalTax),
    [FIELD_MAP.line24TotalTax]: String(c.totalTax),
    [FIELD_MAP.line25aW2Withholding]: String(c.federalIncomeTaxWithheld),
    [FIELD_MAP.line25dTotalWithholding]: String(c.federalIncomeTaxWithheld),
    [FIELD_MAP.line33TotalPayments]: String(c.totalPayments)
  };
  if (input.filingStatus === 'married_filing_jointly') {
    values[FIELD_MAP.spouseFirstAndMiddle] = spouseFirstAndMiddle;
    values[FIELD_MAP.spouseLast] = input.spouse.lastName;
    values[FIELD_MAP.spouseSsn] = input.spouse.ssn.replace(/\D/g, '');
  }
  if (c.overpayment > 0) {
    values[FIELD_MAP.line34Overpayment] = String(c.overpayment);
    values[FIELD_MAP.line35aRefund] = String(c.refund);
  }
  if (c.amountOwed > 0) values[FIELD_MAP.line37AmountOwed] = String(c.amountOwed);
  const checked = [FILING_STATUSES[input.filingStatus].checkboxField, FIELD_MAP.digitalAssetsNo, FIELD_MAP.thirdPartyNo];
  if (input.mainHomeInUSMoreThanHalfYear) checked.push(FIELD_MAP.mainHomeInUs);
  if (input.presidentialElection.taxpayer) checked.push(FIELD_MAP.presidentialTaxpayer);
  if (input.filingStatus === 'married_filing_jointly' && input.presidentialElection.spouse) checked.push(FIELD_MAP.presidentialSpouse);
  return { ...result, values, checked };
}

function mappingRecord(semanticKey, formLine, fieldName, source, mappingType, extra = {}) {
  return {
    semanticKey,
    formNumber: '1040',
    taxYear: TAX_YEAR,
    formLine,
    fieldName,
    source,
    mappingType,
    dataType: extra.dataType || 'text',
    validation: extra.validation || '',
    condition: extra.condition || '',
    calculated: mappingType === 'deterministic_calculation' || mappingType === 'official_tax_table_lookup',
    taxpayerProvided: mappingType === 'direct_answer' || mappingType === 'source_document_aggregate',
    professionalJudgmentRequired: Boolean(extra.professionalJudgmentRequired),
    signatureRestricted: Boolean(extra.signatureRestricted),
    humanSemanticVerificationApproved: false,
    professionalApprovalRecorded: false,
    ownerReleaseRecorded: false
  };
}

function buildFieldMapReport() {
  const records = [
    mappingRecord('taxpayer.first_and_middle_name', 'Identity', FIELD_MAP.taxpayerFirstAndMiddle, 'AI interview answer', 'direct_answer'),
    mappingRecord('taxpayer.last_name', 'Identity', FIELD_MAP.taxpayerLast, 'AI interview answer', 'direct_answer'),
    mappingRecord('taxpayer.ssn', 'Identity', FIELD_MAP.taxpayerSsn, 'AI interview answer', 'direct_answer', { validation: 'Nine digits; live sensitive-data controls required.' }),
    mappingRecord('spouse.first_and_middle_name', 'Identity', FIELD_MAP.spouseFirstAndMiddle, 'AI interview answer', 'direct_answer', { condition: 'Married filing jointly' }),
    mappingRecord('spouse.last_name', 'Identity', FIELD_MAP.spouseLast, 'AI interview answer', 'direct_answer', { condition: 'Married filing jointly' }),
    mappingRecord('spouse.ssn', 'Identity', FIELD_MAP.spouseSsn, 'AI interview answer', 'direct_answer', { condition: 'Married filing jointly', validation: 'Nine digits; live sensitive-data controls required.' }),
    mappingRecord('taxpayer.address.street', 'Address', FIELD_MAP.street, 'AI interview answer', 'direct_answer'),
    mappingRecord('taxpayer.address.apartment', 'Address', FIELD_MAP.apartment, 'AI interview answer', 'direct_answer'),
    mappingRecord('taxpayer.address.city', 'Address', FIELD_MAP.city, 'AI interview answer', 'direct_answer'),
    mappingRecord('taxpayer.address.state', 'Address', FIELD_MAP.state, 'AI interview answer', 'direct_answer', { validation: 'Two-letter domestic state abbreviation.' }),
    mappingRecord('taxpayer.address.zip', 'Address', FIELD_MAP.zip, 'AI interview answer', 'direct_answer', { validation: 'ZIP or ZIP+4.' }),
    mappingRecord('filing_status', 'Filing Status', 'controlled checkbox set', 'Taxpayer-selected status subject to review', 'direct_answer', { dataType: 'choice', professionalJudgmentRequired: true }),
    mappingRecord('digital_assets.no', 'Digital Assets', FIELD_MAP.digitalAssetsNo, 'Eligibility confirmation', 'direct_answer', { dataType: 'checkbox' }),
    mappingRecord('w2.box1_total', '1a', FIELD_MAP.line1aWages, 'Sum of W-2 box 1 whole-dollar amounts', 'source_document_aggregate', { dataType: 'integer' }),
    mappingRecord('earned_income.total', '1z', FIELD_MAP.line1zTotalEarnedIncome, 'Line 1a in this W-2-only lane', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('total_income', '9', FIELD_MAP.line9TotalIncome, 'W-2 wages only', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('adjusted_gross_income', '11a', FIELD_MAP.line11aAgi, 'Total income with no adjustments', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('adjusted_gross_income_carry', '11b', FIELD_MAP.line11bAgi, 'Carry from line 11a', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('standard_deduction', '12e', FIELD_MAP.line12eDeduction, '2025 Form 1040 basic standard deduction for supported filing status', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('total_deductions', '14', FIELD_MAP.line14TotalDeductions, 'Line 12e with lines 13a and 13b excluded by pilot gate', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('taxable_income', '15', FIELD_MAP.line15TaxableIncome, 'Line 11b minus line 14, not below zero', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('income_tax', '16', FIELD_MAP.line16Tax, '2025 official Form 1040 tax table for taxable income below $100,000', 'official_tax_table_lookup', { dataType: 'integer' }),
    mappingRecord('tax_before_credits', '18', FIELD_MAP.line18TaxBeforeCredits, 'Line 16 with line 17 excluded by pilot gate', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('tax_after_credits', '22', FIELD_MAP.line22TaxAfterCredits, 'Line 18 with credits excluded by professional-confirmation gate', 'deterministic_calculation', { dataType: 'integer', professionalJudgmentRequired: true }),
    mappingRecord('total_tax', '24', FIELD_MAP.line24TotalTax, 'Line 22 with other taxes excluded by pilot gate', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('w2.withholding_total', '25a', FIELD_MAP.line25aW2Withholding, 'Sum of W-2 box 2 whole-dollar amounts', 'source_document_aggregate', { dataType: 'integer' }),
    mappingRecord('total_withholding', '25d', FIELD_MAP.line25dTotalWithholding, 'Line 25a in this W-2-only lane', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('total_payments', '33', FIELD_MAP.line33TotalPayments, 'Line 25d with other payments and refundable credits excluded by pilot gate', 'deterministic_calculation', { dataType: 'integer' }),
    mappingRecord('overpayment', '34', FIELD_MAP.line34Overpayment, 'Line 33 minus line 24 when positive', 'deterministic_calculation', { dataType: 'integer', condition: 'Payments exceed total tax' }),
    mappingRecord('refund_requested', '35a', FIELD_MAP.line35aRefund, 'Full overpayment in this no-direct-deposit pilot', 'deterministic_calculation', { dataType: 'integer', condition: 'Overpayment exists' }),
    mappingRecord('amount_owed', '37', FIELD_MAP.line37AmountOwed, 'Line 24 minus line 33 when positive', 'deterministic_calculation', { dataType: 'integer', condition: 'Total tax exceeds payments' })
  ];
  return {
    version: VERSION,
    source: SOURCE,
    pilot: PILOT_POLICY,
    mappingStatus: 'engineered_semantic_map_pending_human_and_professional_approval',
    mappedFieldCount: records.length,
    records,
    excludedSensitiveOrAuthorityFields: ['taxpayer signature', 'spouse signature', 'preparer signature', 'PTIN', 'bank routing number', 'bank account number', 'direct debit', 'electronic filing authorization'],
    releaseBoundary: 'This map is implementation evidence, not human semantic approval, professional tax approval, owner release, or filing authorization.'
  };
}

function buildInterviewState(raw = {}, options = {}) {
  const input = normalizeInput(raw);
  const answered = INTERVIEW_QUESTIONS.filter((question) => {
    const value = getPath(input, question.path);
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
  });
  const nextQuestion = INTERVIEW_QUESTIONS.find((question) => {
    const value = getPath(input, question.path);
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || value === '' || (question.accepted && !question.accepted.includes(value));
  }) || null;
  const validation = validate(raw, options);
  return {
    version: VERSION,
    pilot: PILOT_POLICY,
    progress: {
      answered: answered.length,
      total: INTERVIEW_QUESTIONS.length,
      percent: Math.round((answered.length / INTERVIEW_QUESTIONS.length) * 100)
    },
    nextQuestion,
    validation,
    aiHelperRules: [
      'Ask only the next relevant question and explain why it is needed.',
      'Do not infer filing status, EIC eligibility, credit eligibility, or professional conclusions from incomplete facts.',
      'Do not place SSNs, names, addresses, W-2 values, or tax results in logs or analytics.',
      'Treat source documents and user answers as unverified until the customer and assigned reviewer confirm them.',
      'Do not describe a generated PDF as filed, accepted, e-filed, signed, or professionally approved.',
      'Stop and route out of this lane when an unsupported condition appears.'
    ],
    documentChecklist: ['Every Form W-2 for 2025', 'Government-issued identity records only through an approved secure workflow', 'Prior-year return for comparison when available'],
    nextAction: nextQuestion ? 'Collect the next answer.' : (validation.ok ? 'Generate an internal sample calculation and mapped draft for review.' : 'Resolve missing, invalid, or unsupported conditions before draft generation.')
  };
}

function buildCompletionPlan(raw = {}, options = {}) {
  const mapped = fieldValues(raw, options);
  return {
    version: VERSION,
    ok: mapped.ok,
    source: SOURCE,
    pilot: PILOT_POLICY,
    validation: mapped.validation,
    calculation: mapped.calculation,
    mapping: mapped.ok ? {
      textFieldCount: Object.keys(mapped.values).length,
      checkboxCount: mapped.checked.length,
      textFields: mapped.values,
      checkedFields: mapped.checked,
      fieldMapStatus: 'engineered_pending_human_semantic_and_professional_approval'
    } : null,
    review: {
      customerVerificationRequired: true,
      professionalReviewRequired: true,
      ownerReleaseRequired: true,
      signatureRequiredOutsideGenerator: true,
      eFileAvailable: false,
      agencySubmissionAvailable: false
    },
    nextSteps: mapped.ok ? [
      'Compare every W-2 box 1 and box 2 amount to the source documents.',
      'Confirm filing-status eligibility and the professional no-EIC determination.',
      'Review every populated Form 1040 line and all blank excluded lines.',
      'Record human semantic QA, page-by-page visual QA, professional approval, and owner release before any real-user pilot.',
      'Obtain taxpayer signatures and filing authorization through an approved process; this generator does not sign or file.'
    ] : ['Resolve the reported missing, invalid, and unsupported conditions.']
  };
}

function setTextField(form, fieldName, value) {
  if (value === undefined || value === null || value === '') return;
  const field = form.getTextField(fieldName);
  const text = String(value);
  field.setText(text);
  field.setFontSize(text.length > 35 ? 6 : text.length > 22 ? 7 : 8);
}

async function createDraftPdfBuffer(raw = {}, options = {}) {
  const plan = buildCompletionPlan(raw, options);
  if (!plan.ok) {
    const details = [...plan.validation.missing.map((item) => `missing:${item}`), ...plan.validation.errors, ...plan.validation.unsupported].join(' | ');
    throw new Error(`Form 1040 simple W-2 draft blocked: ${details || 'validation failed'}`);
  }
  const mapped = fieldValues(raw, options);
  const sourceBytes = fs.readFileSync(OFFICIAL_PDF);
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true, updateMetadata: true });
  const form = pdf.getForm();
  for (const [fieldName, value] of Object.entries(mapped.values)) setTextField(form, fieldName, value);
  for (const fieldName of mapped.checked) form.getCheckBox(fieldName).check();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);
  pdf.setTitle('SAMPLE - 2025 Form 1040 Simple W-2 Draft - NOT FOR FILING');
  pdf.setSubject('Justice Tax Solutions controlled sample output; not signed, filed, accepted, or professionally approved.');
  pdf.setKeywords(['sample', 'internal QA', 'not for filing', 'Form 1040', '2025']);
  pdf.setProducer(`Justice Tax Solutions v${VERSION} using pdf-lib`);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText('SAMPLE / INTERNAL QA - NOT FOR FILING', {
      x: width * 0.14,
      y: height * 0.48,
      size: 32,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.14,
      rotate: degrees(35)
    });
  }
  const bytes = await pdf.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
  return Buffer.from(bytes);
}

function buildReadiness(evidence = {}) {
  const gates = {
    officialPdfCaptured: fs.existsSync(OFFICIAL_PDF),
    officialUrlRecorded: true,
    taxYearLocked: TAX_TABLE.taxYear === TAX_YEAR,
    taxTableCoverageValidated: TAX_TABLE.rowCount === 2062 && TAX_TABLE.validationEvidence?.continuousCoverage === true,
    officialExampleValidated: TAX_TABLE.validationEvidence?.officialExample?.passed === true,
    engineeredSemanticMapPresent: buildFieldMapReport().mappedFieldCount > 0,
    deterministicCalculationTestsPassed: evidence.deterministicCalculationTestsPassed === true,
    automatedSamplePdfGenerated: evidence.automatedSamplePdfGenerated === true,
    automatedRenderPassed: evidence.automatedRenderPassed === true,
    humanSemanticVerificationApproved: evidence.humanSemanticVerificationApproved === true,
    humanVisualQaApproved: evidence.humanVisualQaApproved === true,
    professionalApprovalRecorded: evidence.professionalApprovalRecorded === true,
    ownerReleaseRecorded: evidence.ownerReleaseRecorded === true,
    productionSensitiveDataGatePassed: evidence.productionSensitiveDataGatePassed === true,
    signatureAndFilingControlsApproved: evidence.signatureAndFilingControlsApproved === true
  };
  const releaseChecks = ['humanSemanticVerificationApproved', 'humanVisualQaApproved', 'professionalApprovalRecorded', 'ownerReleaseRecorded', 'productionSensitiveDataGatePassed', 'signatureAndFilingControlsApproved'];
  const blockers = releaseChecks.filter((key) => !gates[key]);
  return {
    version: VERSION,
    pilot: PILOT_POLICY,
    gates,
    readyForSyntheticSampleQa: Object.entries(gates).filter(([key]) => !releaseChecks.includes(key)).every(([, value]) => value === true),
    readyForRealUserData: blockers.length === 0,
    blockers,
    status: blockers.length ? 'sample_and_internal_qa_only' : 'eligible_for_separately_approved_limited_real_data_pilot',
    warning: 'A passing calculation or rendered PDF does not equal human semantic QA, professional approval, owner release, signature, filing, e-file, or IRS acceptance.'
  };
}

module.exports = {
  VERSION,
  TAX_YEAR,
  SOURCE,
  PILOT_POLICY,
  FILING_STATUSES,
  FIELD_MAP,
  INTERVIEW_QUESTIONS,
  normalizeInput,
  validate,
  lookupTax,
  calculate,
  fieldValues,
  buildFieldMapReport,
  buildInterviewState,
  buildCompletionPlan,
  createDraftPdfBuffer,
  buildReadiness
};
