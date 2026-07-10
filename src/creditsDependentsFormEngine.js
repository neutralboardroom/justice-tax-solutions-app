const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');

const VERSION = '0.1.75';
const TAX_YEAR = 2025;
const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'assets', 'official-forms', 'irs-individual-income-tax');
const MANIFEST_PATH = path.join(BASE, 'manifest.json');

const SOURCES = Object.freeze({
  'SCHEDULE-EIC': {
    formNumber: 'SCHEDULE-EIC', title: '2025 Schedule EIC (Form 1040) — Earned Income Credit', taxYear: 2025,
    officialUrl: 'https://www.irs.gov/pub/irs-pdf/f1040sei.pdf',
    localRelativePath: 'assets/official-forms/irs-individual-income-tax/f1040sei Earned Income Credit.pdf'
  },
  '8332': {
    formNumber: '8332', title: 'Form 8332 — Release/Revocation of Release of Claim to Exemption for Child by Custodial Parent', revision: 'December 2025',
    officialUrl: 'https://www.irs.gov/pub/irs-pdf/f8332.pdf',
    localRelativePath: 'assets/official-forms/irs-individual-income-tax/f8332 Release-Revocation of Release of Claim to Exemption for Child by Custodial Parent.pdf'
  },
  '8862': {
    formNumber: '8862', title: 'Form 8862 — Information To Claim Certain Credits After Disallowance', revision: 'December 2025',
    officialUrl: 'https://www.irs.gov/pub/irs-pdf/f8862.pdf', instructionsUrl: 'https://www.irs.gov/pub/irs-pdf/i8862.pdf',
    localRelativePath: 'assets/official-forms/irs-individual-income-tax/f8862 Information To Claim Certain Credits After Disallowance.pdf'
  },
  '8867': {
    formNumber: '8867', title: 'Form 8867 — Paid Preparer’s Due Diligence Checklist', revision: 'November 2024', instructionsRevision: 'November 2025',
    officialUrl: 'https://www.irs.gov/pub/irs-pdf/f8867.pdf', instructionsUrl: 'https://www.irs.gov/pub/irs-pdf/i8867.pdf',
    localRelativePath: 'assets/official-forms/irs-individual-income-tax/f8867 Paid Preparer#U2019s Due Diligence Checklist.pdf'
  },
  '8880': {
    formNumber: '8880', title: '2025 Form 8880 — Credit for Qualified Retirement Savings Contributions', taxYear: 2025,
    officialUrl: 'https://www.irs.gov/pub/irs-pdf/f8880.pdf',
    localRelativePath: 'assets/official-forms/irs-individual-income-tax/f8880 Credit for Qualified Retirement Savings Contributions.pdf'
  }
});

const FORM_POLICIES = Object.freeze({
  'SCHEDULE-EIC': {
    status: 'controlled_qualifying_child_organizer_and_sample_output',
    audience: 'customer_with_staff_and_professional_review',
    purpose: 'Collect and map qualifying-child facts after EIC eligibility and the credit amount are determined through a separate approved calculation/review process.',
    prohibited: ['Do not calculate or promise EIC from Schedule EIC alone.', 'Do not infer qualifying-child status from a name or relationship.', 'Do not expose SSNs in logs, analytics, URLs, or referral views.', 'Do not call a generated PDF filed or accepted.']
  },
  '8332': {
    status: 'organizer_only_signature_controlled',
    audience: 'customer_with_professional_review',
    purpose: 'Organize a proposed release or revocation for one child at a time.',
    prohibited: ['Do not insert the custodial parent’s signature.', 'Do not decide custody or tax-benefit entitlement.', 'Do not generate final attachment-ready output without human review and signature controls.']
  },
  '8862': {
    status: 'professional_review_intake_only',
    audience: 'customer_intake_then_professional',
    purpose: 'Identify credits previously reduced or disallowed and gather the facts needed for a professional to decide whether Form 8862 is required and supportable.',
    prohibited: ['Do not state that a taxpayer may reclaim a credit merely because Form 8862 is completed.', 'Do not bypass a prior disallowance period or eligibility restriction.', 'Do not produce final filing output without professional approval.']
  },
  '8867': {
    status: 'preparer_due_diligence_workflow_only',
    audience: 'paid_preparer_or_qualified_reviewer',
    purpose: 'Document paid-preparer due diligence for covered credits and head-of-household status.',
    prohibited: ['Do not present Form 8867 as a normal customer-completed form.', 'Do not let AI attest that due diligence was performed.', 'Do not insert preparer certification without the responsible preparer’s review.']
  },
  '8880': {
    status: 'controlled_simple_savers_credit_calculation_and_sample_output',
    audience: 'customer_with_professional_review',
    purpose: 'Calculate a narrow 2025 saver’s credit lane from user-supplied whole-dollar amounts and a separately verified credit-limit worksheet result.',
    prohibited: ['Do not infer student, dependent, age, distribution, contribution, or filing-status facts.', 'Do not calculate the credit-limit worksheet inside this first lane.', 'Do not call a generated PDF filed, approved, or accepted.']
  }
});

const ROUTING_QUESTIONS = Object.freeze([
  { id: 'qualifyingChildForEic', prompt: 'Are you considering the earned income credit with a qualifying child?', type: 'boolean_or_unsure' },
  { id: 'creditPreviouslyDisallowed', prompt: 'Was EIC, CTC/ACTC/ODC, AOTC, or another covered credit previously reduced or disallowed?', type: 'boolean_or_unsure' },
  { id: 'custodialParentRelease', prompt: 'Do you need to release or revoke a release of a claim for one child?', type: 'boolean_or_unsure' },
  { id: 'retirementSavingsContributions', prompt: 'Did you or your spouse make eligible retirement contributions or elective deferrals?', type: 'boolean_or_unsure' },
  { id: 'paidPreparerCoveredBenefit', prompt: 'Is a paid preparer preparing a return that claims EIC, AOTC, CTC/ACTC/ODC, or head-of-household status?', type: 'boolean_or_unsure', internal: true }
]);

const ORGANIZERS = Object.freeze({
  '8332': {
    questions: [
      'Is this a release for the current year, a release for future years, or a revocation of a prior release?',
      'Which single child does this form concern?',
      'What is the noncustodial parent’s name and SSN?',
      'Which tax year or future-year range is involved?',
      'Has a professional reviewed which tax benefits may be affected?',
      'Has the custodial parent reviewed the form and signing requirements?'
    ],
    requiredDocuments: ['Prior Form 8332 or similar release, if any', 'Relevant divorce/separation instrument for factual review only', 'Prior and proposed tax returns', 'Custody/residency records when relevant'],
    release: 'Signature fields remain blank; one form is required for each child.'
  },
  '8862': {
    questions: [
      'Which credit or credits were reduced or disallowed?',
      'Which tax year did the disallowance concern?',
      'What IRS notice or explanation was received?',
      'Was the disallowance caused by a math or clerical error, or by an eligibility determination?',
      'Has any 2-year or 10-year disallowance period been imposed?',
      'What facts have changed or what documentation now supports eligibility?'
    ],
    requiredDocuments: ['IRS disallowance notice', 'Prior return and relevant schedules', 'Identity, residency, relationship, education, or expense records as applicable', 'Current-year income and filing-status documents'],
    release: 'Professional review is required before deciding whether Form 8862 is required or supportable.'
  },
  '8867': {
    questions: [
      'Which covered benefit or filing status is being claimed?',
      'Which responsible paid preparer is signing the return?',
      'What information and documents were reviewed?',
      'What follow-up questions were asked when facts appeared incomplete, inconsistent, or incorrect?',
      'What contemporaneous notes and copies must be retained?',
      'Has the preparer personally reviewed and certified the checklist?'
    ],
    requiredDocuments: ['Customer interview record', 'Documents relied upon', 'Due-diligence notes', 'Applicable worksheets', 'Responsible preparer identity and PTIN record'],
    release: 'AI may organize evidence but cannot make or sign the preparer certification.'
  }
});

const EIC_FIELD_MAP = Object.freeze({
  returnName: 'topmostSubform[0].Page1[0].f1_01[0]',
  returnSsn: 'topmostSubform[0].Page1[0].f1_02[0]',
  children: [
    {
      name: 'topmostSubform[0].Page1[0].f1_03[0]', ssn: 'topmostSubform[0].Page1[0].f1_06[0]',
      yearDigits: ['topmostSubform[0].Page1[0].Year1_ReadOrder[0].f1_09[0]','topmostSubform[0].Page1[0].Year1_ReadOrder[0].f1_10[0]','topmostSubform[0].Page1[0].Year1_ReadOrder[0].f1_11[0]','topmostSubform[0].Page1[0].Year1_ReadOrder[0].f1_12[0]'],
      studentYes: 'topmostSubform[0].Page1[0].Line4a_Child1_ReadOrder[0].Yes_ReadOrder[0].c1_1[0]', studentNo: 'topmostSubform[0].Page1[0].Line4a_Child1_ReadOrder[0].c1_1[0]',
      disabledYes: 'topmostSubform[0].Page1[0].Line4b_Child1_ReadOrder[0].Yes_ReadOrder[0].c1_4[0]', disabledNo: 'topmostSubform[0].Page1[0].Line4b_Child1_ReadOrder[0].c1_4[0]',
      relationship: 'topmostSubform[0].Page1[0].f1_21[0]', months: 'topmostSubform[0].Page1[0].Line6_Child1_ReadOrder[0].f1_24[0]'
    },
    {
      name: 'topmostSubform[0].Page1[0].f1_04[0]', ssn: 'topmostSubform[0].Page1[0].f1_07[0]',
      yearDigits: ['topmostSubform[0].Page1[0].Year2_ReadOrder[0].f1_13[0]','topmostSubform[0].Page1[0].Year2_ReadOrder[0].f1_14[0]','topmostSubform[0].Page1[0].Year2_ReadOrder[0].f1_15[0]','topmostSubform[0].Page1[0].Year2_ReadOrder[0].f1_16[0]'],
      studentYes: 'topmostSubform[0].Page1[0].Line4a_Child2_ReadOrder[0].Yes_ReadOrder[0].c1_2[0]', studentNo: 'topmostSubform[0].Page1[0].Line4a_Child2_ReadOrder[0].c1_2[0]',
      disabledYes: 'topmostSubform[0].Page1[0].Line4b_Child2_ReadOrder[0].Yes_ReadOrder[0].c1_5[0]', disabledNo: 'topmostSubform[0].Page1[0].Line4b_Child2_ReadOrder[0].c1_5[0]',
      relationship: 'topmostSubform[0].Page1[0].f1_22[0]', months: 'topmostSubform[0].Page1[0].Line6_Child2_ReadOrder[0].f1_25[0]'
    },
    {
      name: 'topmostSubform[0].Page1[0].f1_05[0]', ssn: 'topmostSubform[0].Page1[0].f1_08[0]',
      yearDigits: ['topmostSubform[0].Page1[0].f1_17[0]','topmostSubform[0].Page1[0].f1_18[0]','topmostSubform[0].Page1[0].f1_19[0]','topmostSubform[0].Page1[0].f1_20[0]'],
      studentYes: 'topmostSubform[0].Page1[0].Line4a_Child3_Yes_ReadOrder[0].c1_3[0]', studentNo: 'topmostSubform[0].Page1[0].c1_3[0]',
      disabledYes: 'topmostSubform[0].Page1[0].Line4b_Child3_Yes_ReadOrder[0].c1_6[0]', disabledNo: 'topmostSubform[0].Page1[0].c1_6[0]',
      relationship: 'topmostSubform[0].Page1[0].f1_23[0]', months: 'topmostSubform[0].Page1[0].f1_26[0]'
    }
  ]
});

const FORM_8880_FIELD_MAP = Object.freeze({
  returnName: 'topmostSubform[0].Page1[0].f1_1[0]', returnSsn: 'topmostSubform[0].Page1[0].f1_2[0]',
  line1Taxpayer: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow1[0].f1_3[0]', line1Spouse: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow1[0].f1_4[0]',
  line2Taxpayer: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow2[0].f1_5[0]', line2Spouse: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow2[0].f1_6[0]',
  line3Taxpayer: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow3[0].f1_7[0]', line3Spouse: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow3[0].f1_8[0]',
  line4Taxpayer: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow4[0].f1_9[0]', line4Spouse: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow4[0].f1_10[0]',
  line5Taxpayer: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow5[0].f1_11[0]', line5Spouse: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow5[0].f1_12[0]',
  line6Taxpayer: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow6[0].f1_13[0]', line6Spouse: 'topmostSubform[0].Page1[0].Table_Ln1-6[0].BodyRow6[0].f1_14[0]',
  line7: 'topmostSubform[0].Page1[0].f1_15[0]', line8: 'topmostSubform[0].Page1[0].f1_16[0]', line9: 'topmostSubform[0].Page1[0].f1_17[0]',
  line10: 'topmostSubform[0].Page1[0].f1_18[0]', line11: 'topmostSubform[0].Page1[0].f1_19[0]', line12: 'topmostSubform[0].Page1[0].f1_20[0]'
});

function wholeDollar(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && Number.isInteger(number) ? number : null;
}
function clean(value, max = 100) { return String(value || '').trim().slice(0, max); }
function syntheticSsn(value) { const digits = String(value || '').replace(/\D/g, ''); return digits.length === 9 && (digits.startsWith('000') || digits.startsWith('999')); }
function sourcePath(key) { return path.join(ROOT, SOURCES[key].localRelativePath); }

function buildLibrary() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const forms = Object.values(SOURCES).map(source => ({
    ...source,
    policy: FORM_POLICIES[source.formNumber],
    documents: manifest.forms.filter(item => item.formNumber === source.formNumber),
    releaseStatus: 'captured_and_technically_inventoried_release_blocked'
  }));
  return {
    version: VERSION,
    title: 'IRS Credits and Dependents Controlled Form Collection',
    forms,
    releaseBoundary: 'Official PDFs and field inventories are present, but real-user output remains blocked pending human semantic verification, calculation/eligibility validation, visual QA, professional approval, owner release, and production-security approval.'
  };
}

function recommendForms(answers = {}) {
  const customerForms = [];
  const internalForms = [];
  if (answers.qualifyingChildForEic === true) customerForms.push('SCHEDULE-EIC');
  if (answers.creditPreviouslyDisallowed === true) customerForms.push('8862');
  if (answers.custodialParentRelease === true) customerForms.push('8332');
  if (answers.retirementSavingsContributions === true) customerForms.push('8880');
  if (answers.paidPreparerCoveredBenefit === true || answers.qualifyingChildForEic === true) internalForms.push('8867');
  const warnings = [];
  if (answers.creditPreviouslyDisallowed === true) warnings.push('A prior disallowance can involve special restrictions; professional review is required before claiming the credit again.');
  if (answers.custodialParentRelease === true) warnings.push('Form 8332 affects only specified tax benefits and requires the custodial parent’s valid signature; legal/custody questions may require separate advice.');
  if (answers.qualifyingChildForEic === true) warnings.push('Schedule EIC reports qualifying-child information only after EIC eligibility and the credit amount are determined separately.');
  return {
    version: VERSION,
    status: 'controlled_recommendation_only',
    customerForms: customerForms.map(key => ({ ...SOURCES[key], policy: FORM_POLICIES[key] })),
    internalComplianceForms: internalForms.map(key => ({ ...SOURCES[key], policy: FORM_POLICIES[key] })),
    warnings,
    nextSteps: ['Confirm the tax year and filing status.', 'Gather the original tax documents and any IRS disallowance notice.', 'Answer only the questions relevant to the selected workflow.', 'Require customer verification and qualified professional review before final output.']
  };
}

function organizer(formNumber) {
  const key = String(formNumber || '').toUpperCase();
  if (!ORGANIZERS[key]) throw new Error('No organizer is available for that form.');
  return { version: VERSION, source: SOURCES[key], policy: FORM_POLICIES[key], ...ORGANIZERS[key] };
}

function normalizeEic(raw = {}) {
  return {
    taxYear: Number(raw.taxYear || 0), sampleMode: raw.sampleMode === true,
    returnName: clean(raw.returnName, 80), returnSsn: clean(raw.returnSsn, 20),
    eligibilityConfirmedByQualifiedReviewer: raw.eligibilityConfirmedByQualifiedReviewer === true,
    eicAmountDeterminedSeparately: raw.eicAmountDeterminedSeparately === true,
    children: Array.isArray(raw.children) ? raw.children.slice(0, 3).map(child => ({
      firstName: clean(child.firstName, 30), lastName: clean(child.lastName, 40), ssn: clean(child.ssn, 20), birthYear: Number(child.birthYear || 0),
      youngerThanTaxpayerOrSpouse: child.youngerThanTaxpayerOrSpouse === true,
      under24StudentAndYounger: child.under24StudentAndYounger,
      permanentlyAndTotallyDisabled: child.permanentlyAndTotallyDisabled,
      relationship: clean(child.relationship, 40), monthsEntry: Number(child.monthsEntry || 0),
      didNotFileJointReturnUnlessOnlyForRefund: child.didNotFileJointReturnUnlessOnlyForRefund === true,
      possibleQualifyingChildOfAnotherPerson: child.possibleQualifyingChildOfAnotherPerson === true
    })) : []
  };
}

function validateEic(raw = {}) {
  const input = normalizeEic(raw); const missing = []; const errors = []; const unsupported = [];
  if (input.taxYear !== TAX_YEAR) unsupported.push('Only 2025 Schedule EIC is supported in this controlled lane.');
  if (!input.sampleMode) unsupported.push('Only synthetic sample data is allowed until production sensitive-data and release gates pass.');
  if (!input.returnName) missing.push('returnName');
  if (!syntheticSsn(input.returnSsn)) errors.push('A clearly synthetic nine-digit SSN beginning with 000 or 999 is required for sample output.');
  if (!input.eligibilityConfirmedByQualifiedReviewer) missing.push('eligibilityConfirmedByQualifiedReviewer');
  if (!input.eicAmountDeterminedSeparately) missing.push('eicAmountDeterminedSeparately');
  if (!input.children.length) missing.push('children');
  input.children.forEach((child, index) => {
    const tag = `children[${index}]`;
    if (!child.firstName || !child.lastName) missing.push(`${tag}.name`);
    if (!syntheticSsn(child.ssn)) errors.push(`${tag}.ssn must be a clearly synthetic nine-digit SSN beginning with 000 or 999.`);
    if (!Number.isInteger(child.birthYear) || child.birthYear < 1900 || child.birthYear > 2025) errors.push(`${tag}.birthYear must be a valid four-digit year.`);
    if (!child.relationship) missing.push(`${tag}.relationship`);
    if (!Number.isInteger(child.monthsEntry) || child.monthsEntry < 7 || child.monthsEntry > 12) errors.push(`${tag}.monthsEntry must be the Schedule EIC entry from 7 through 12 after applying the form instructions.`);
    if (!child.didNotFileJointReturnUnlessOnlyForRefund) unsupported.push(`${tag}: joint-return eligibility requires separate review.`);
    if (child.possibleQualifyingChildOfAnotherPerson) unsupported.push(`${tag}: multiple-person qualifying-child/tiebreaker rules require professional review.`);
    const canSkipAgeLines = child.birthYear > 2006 && child.youngerThanTaxpayerOrSpouse;
    if (!canSkipAgeLines) {
      if (typeof child.under24StudentAndYounger !== 'boolean') missing.push(`${tag}.under24StudentAndYounger`);
      if (child.under24StudentAndYounger === false && typeof child.permanentlyAndTotallyDisabled !== 'boolean') missing.push(`${tag}.permanentlyAndTotallyDisabled`);
      if (child.under24StudentAndYounger === false && child.permanentlyAndTotallyDisabled === false) unsupported.push(`${tag}: answers do not support the Schedule EIC age/disability test.`);
    }
  });
  return { version: VERSION, input, ok: !missing.length && !errors.length && !unsupported.length, missing, errors, unsupported };
}

function eicFieldValues(raw = {}) {
  const validation = validateEic(raw); if (!validation.ok) return { ...validation, values: null, checked: null };
  const input = validation.input; const values = { [EIC_FIELD_MAP.returnName]: input.returnName, [EIC_FIELD_MAP.returnSsn]: input.returnSsn.replace(/\D/g, '') }; const checked = [];
  input.children.forEach((child, index) => {
    const map = EIC_FIELD_MAP.children[index]; const year = String(child.birthYear).padStart(4, '0');
    values[map.name] = `${child.firstName} ${child.lastName}`.trim(); values[map.ssn] = child.ssn.replace(/\D/g, '');
    map.yearDigits.forEach((field, digit) => { values[field] = year[digit]; });
    values[map.relationship] = child.relationship; values[map.months] = String(child.monthsEntry);
    const canSkipAgeLines = child.birthYear > 2006 && child.youngerThanTaxpayerOrSpouse;
    if (!canSkipAgeLines) {
      checked.push(child.under24StudentAndYounger ? map.studentYes : map.studentNo);
      if (child.under24StudentAndYounger === false) checked.push(child.permanentlyAndTotallyDisabled ? map.disabledYes : map.disabledNo);
    }
  });
  return { ...validation, values, checked };
}

function buildEicCompletionPlan(raw = {}) {
  const mapped = eicFieldValues(raw);
  return {
    version: VERSION, ok: mapped.ok, source: SOURCES['SCHEDULE-EIC'], policy: FORM_POLICIES['SCHEDULE-EIC'], validation: { missing: mapped.missing, errors: mapped.errors, unsupported: mapped.unsupported },
    mapping: mapped.ok ? { textFields: mapped.values, checkedFields: mapped.checked, status: 'engineered_field_map_pending_human_semantic_and_professional_approval' } : null,
    review: { eicEligibilityCalculatedHere: false, eicAmountCalculatedHere: false, customerVerificationRequired: true, professionalReviewRequired: true, ownerReleaseRequired: true, eFileAvailable: false },
    nextSteps: mapped.ok ? ['Compare names and SSNs to Social Security records.', 'Verify relationship, age/student/disability, residency, joint-return, and tiebreaker rules.', 'Determine EIC eligibility and amount through the separately approved Form 1040/EIC calculation process.', 'Complete human semantic QA and professional approval before real-user output.'] : ['Resolve all missing, invalid, and unsupported facts.']
  };
}

function eicFieldMapReport() {
  const records = [
    { semanticKey: 'return.name', formLine: 'Header', fieldName: EIC_FIELD_MAP.returnName, source: 'Form 1040 return name', type: 'direct_answer' },
    { semanticKey: 'return.ssn', formLine: 'Header', fieldName: EIC_FIELD_MAP.returnSsn, source: 'Form 1040 SSN', type: 'direct_answer_sensitive' }
  ];
  EIC_FIELD_MAP.children.forEach((map, index) => {
    const child = index + 1;
    records.push(
      { semanticKey: `child.${child}.name`, formLine: '1', fieldName: map.name, source: 'Customer answer verified to records', type: 'direct_answer' },
      { semanticKey: `child.${child}.ssn`, formLine: '2', fieldName: map.ssn, source: 'Customer answer verified to Social Security record', type: 'direct_answer_sensitive' },
      { semanticKey: `child.${child}.birth_year`, formLine: '3', fieldName: map.yearDigits, source: 'Customer answer verified to birth record', type: 'split_year' },
      { semanticKey: `child.${child}.student_age_test`, formLine: '4a', fieldName: [map.studentYes, map.studentNo], source: 'Eligibility interview', type: 'conditional_checkbox' },
      { semanticKey: `child.${child}.disability_test`, formLine: '4b', fieldName: [map.disabledYes, map.disabledNo], source: 'Eligibility interview', type: 'conditional_checkbox' },
      { semanticKey: `child.${child}.relationship`, formLine: '5', fieldName: map.relationship, source: 'Customer answer and supporting records', type: 'direct_answer' },
      { semanticKey: `child.${child}.months`, formLine: '6', fieldName: map.months, source: 'Residency organizer after applying Schedule EIC instructions', type: 'derived_entry_professional_review' }
    );
  });
  return { version: VERSION, source: SOURCES['SCHEDULE-EIC'], policy: FORM_POLICIES['SCHEDULE-EIC'], records, mappedSemanticItems: records.length, humanSemanticVerificationApproved: false, professionalApprovalRecorded: false, ownerReleaseRecorded: false };
}

function normalize8880(raw = {}) {
  const person = value => ({
    eligibleAgeConfirmed: value?.eligibleAgeConfirmed === true,
    notClaimedAsDependent: value?.notClaimedAsDependent === true,
    notStudent: value?.notStudent === true,
    line1Contributions: wholeDollar(value?.line1Contributions), line2Deferrals: wholeDollar(value?.line2Deferrals), line4Distributions: wholeDollar(value?.line4Distributions)
  });
  return {
    taxYear: Number(raw.taxYear || 0), sampleMode: raw.sampleMode === true, returnName: clean(raw.returnName, 80), returnSsn: clean(raw.returnSsn, 20),
    filingStatus: clean(raw.filingStatus, 40), adjustedGrossIncome: wholeDollar(raw.adjustedGrossIncome), creditLimit: wholeDollar(raw.creditLimit),
    noForeignIncomeAdjustment: raw.noForeignIncomeAdjustment === true,
    taxpayer: person(raw.taxpayer || {}), spouse: person(raw.spouse || {})
  };
}

function saverRate(agi, filingStatus) {
  if (!Number.isInteger(agi) || agi < 0) throw new Error('AGI must be a nonnegative whole-dollar amount.');
  if (filingStatus === 'married_filing_jointly') {
    if (agi <= 39500) return 0.5; if (agi <= 47500) return 0.2; if (agi <= 79000) return 0.1; return 0;
  }
  if (filingStatus === 'head_of_household') {
    if (agi <= 35625) return 0.5; if (agi <= 38250) return 0.2; if (agi <= 59250) return 0.1; return 0;
  }
  if (['single','married_filing_separately','qualifying_surviving_spouse'].includes(filingStatus)) {
    if (agi <= 23750) return 0.5; if (agi <= 25500) return 0.2; if (agi <= 39500) return 0.1; return 0;
  }
  throw new Error('Unsupported filing status.');
}

function validate8880(raw = {}) {
  const input = normalize8880(raw); const missing = []; const errors = []; const unsupported = [];
  if (input.taxYear !== TAX_YEAR) unsupported.push('Only 2025 Form 8880 is supported in this controlled lane.');
  if (!input.sampleMode) unsupported.push('Only synthetic sample data is allowed until production sensitive-data and release gates pass.');
  if (!input.returnName) missing.push('returnName');
  if (!syntheticSsn(input.returnSsn)) errors.push('A clearly synthetic nine-digit SSN beginning with 000 or 999 is required for sample output.');
  if (!['single','married_filing_jointly','married_filing_separately','head_of_household','qualifying_surviving_spouse'].includes(input.filingStatus)) errors.push('Unsupported filingStatus.');
  if (input.adjustedGrossIncome === null) errors.push('adjustedGrossIncome must be a nonnegative whole-dollar amount.');
  if (input.creditLimit === null) errors.push('creditLimit from the official Credit Limit Worksheet must be supplied as a nonnegative whole-dollar amount.');
  if (!input.noForeignIncomeAdjustment) unsupported.push('The line 8 foreign-income/Puerto Rico/American Samoa adjustment is outside this first Form 8880 lane.');
  const people = input.filingStatus === 'married_filing_jointly' ? [['taxpayer', input.taxpayer], ['spouse', input.spouse]] : [['taxpayer', input.taxpayer]];
  people.forEach(([label, person]) => {
    if (!person.eligibleAgeConfirmed) unsupported.push(`${label}: age eligibility has not been affirmatively confirmed.`);
    if (!person.notClaimedAsDependent) unsupported.push(`${label}: a person claimed as another taxpayer’s dependent cannot use this controlled lane.`);
    if (!person.notStudent) unsupported.push(`${label}: student-status eligibility has not been affirmatively cleared.`);
    for (const key of ['line1Contributions','line2Deferrals','line4Distributions']) if (person[key] === null) errors.push(`${label}.${key} must be a nonnegative whole-dollar amount.`);
  });
  return { version: VERSION, input, ok: !missing.length && !errors.length && !unsupported.length, missing, errors, unsupported };
}

function calculate8880(raw = {}) {
  const validation = validate8880(raw); if (!validation.ok) return { ok: false, version: VERSION, validation, calculation: null };
  const { input } = validation;
  const jointReturn = input.filingStatus === 'married_filing_jointly';
  const jointDistributions = jointReturn ? input.taxpayer.line4Distributions + input.spouse.line4Distributions : input.taxpayer.line4Distributions;
  const calcPerson = (person, line4) => {
    const line3 = person.line1Contributions + person.line2Deferrals;
    const line5 = Math.max(0, line3 - line4);
    const line6 = Math.min(line5, 2000);
    return { line1: person.line1Contributions, line2: person.line2Deferrals, line3, line4, line5, line6 };
  };
  const taxpayer = calcPerson(input.taxpayer, jointDistributions);
  const spouse = jointReturn ? calcPerson(input.spouse, jointDistributions) : { line1:0,line2:0,line3:0,line4:0,line5:0,line6:0 };
  const line7 = taxpayer.line6 + spouse.line6; const line8 = input.adjustedGrossIncome; const line9 = saverRate(line8, input.filingStatus);
  const line10 = Math.round(line7 * line9); const line11 = input.creditLimit; const line12 = Math.min(line10, line11);
  return { ok: true, version: VERSION, validation, calculation: { taxpayer, spouse, line7, line8, line9, line10, line11, line12, formRequired: line7 > 0 && line9 > 0 && line12 > 0, schedule3Line4: line12, rateSource: '2025 Form 8880 line 9 table', creditLimitSource: 'User/reviewer supplied result from the official Credit Limit Worksheet' } };
}

function form8880Values(raw = {}) {
  const result = calculate8880(raw); if (!result.ok) return { ...result, values: null };
  const { input } = result.validation; const c = result.calculation;
  const values = {
    [FORM_8880_FIELD_MAP.returnName]: input.returnName, [FORM_8880_FIELD_MAP.returnSsn]: input.returnSsn.replace(/\D/g, ''),
    [FORM_8880_FIELD_MAP.line1Taxpayer]: String(c.taxpayer.line1), [FORM_8880_FIELD_MAP.line1Spouse]: input.filingStatus === 'married_filing_jointly' ? String(c.spouse.line1) : '',
    [FORM_8880_FIELD_MAP.line2Taxpayer]: String(c.taxpayer.line2), [FORM_8880_FIELD_MAP.line2Spouse]: input.filingStatus === 'married_filing_jointly' ? String(c.spouse.line2) : '',
    [FORM_8880_FIELD_MAP.line3Taxpayer]: String(c.taxpayer.line3), [FORM_8880_FIELD_MAP.line3Spouse]: input.filingStatus === 'married_filing_jointly' ? String(c.spouse.line3) : '',
    [FORM_8880_FIELD_MAP.line4Taxpayer]: String(c.taxpayer.line4), [FORM_8880_FIELD_MAP.line4Spouse]: input.filingStatus === 'married_filing_jointly' ? String(c.spouse.line4) : '',
    [FORM_8880_FIELD_MAP.line5Taxpayer]: String(c.taxpayer.line5), [FORM_8880_FIELD_MAP.line5Spouse]: input.filingStatus === 'married_filing_jointly' ? String(c.spouse.line5) : '',
    [FORM_8880_FIELD_MAP.line6Taxpayer]: String(c.taxpayer.line6), [FORM_8880_FIELD_MAP.line6Spouse]: input.filingStatus === 'married_filing_jointly' ? String(c.spouse.line6) : '',
    [FORM_8880_FIELD_MAP.line7]: String(c.line7), [FORM_8880_FIELD_MAP.line8]: String(c.line8), [FORM_8880_FIELD_MAP.line9]: String(Math.round(c.line9 * 10)),
    [FORM_8880_FIELD_MAP.line10]: String(c.line10), [FORM_8880_FIELD_MAP.line11]: String(c.line11), [FORM_8880_FIELD_MAP.line12]: String(c.line12)
  };
  return { ...result, values };
}

function build8880CompletionPlan(raw = {}) {
  const mapped = form8880Values(raw);
  return {
    version: VERSION, ok: mapped.ok, source: SOURCES['8880'], policy: FORM_POLICIES['8880'], validation: mapped.validation, calculation: mapped.calculation,
    mapping: mapped.ok ? { textFields: mapped.values, status: 'engineered_field_map_pending_human_semantic_and_professional_approval' } : null,
    review: { customerVerificationRequired: true, creditLimitWorksheetReviewRequired: true, professionalReviewRequired: true, ownerReleaseRequired: true, eFileAvailable: false },
    nextSteps: mapped.ok ? (mapped.calculation.formRequired ? ['Verify every contribution, elective deferral, and distribution against source documents.', 'Verify age, dependent, student, filing-status, and AGI facts.', 'Recompute the Credit Limit Worksheet and line 11.', 'Carry the approved line 12 amount to Schedule 3, line 4 only after review.'] : ['No positive Form 8880 credit results from the supplied sample facts; confirm whether Form 8880 should be omitted.']) : ['Resolve all missing, invalid, and unsupported facts.']
  };
}

function form8880FieldMapReport() {
  const records = Object.entries(FORM_8880_FIELD_MAP).map(([semanticKey, fieldName]) => ({ semanticKey, fieldName, taxYear: TAX_YEAR, humanSemanticVerificationApproved: false, professionalApprovalRecorded: false, ownerReleaseRecorded: false }));
  return { version: VERSION, source: SOURCES['8880'], policy: FORM_POLICIES['8880'], records, mappedFieldCount: records.length, calculationBoundary: 'Lines 1-10 and 12 are deterministic in the narrow lane; line 11 must come from a separately reviewed official Credit Limit Worksheet.' };
}

function setText(form, name, value) {
  if (value === undefined || value === null || value === '') return;
  const field = form.getTextField(name); const text = String(value); field.setText(text); field.setFontSize(text.length > 35 ? 6 : text.length > 20 ? 7 : 8);
}
async function watermarkAndSave(pdf, title) {
  const form = pdf.getForm(); const font = await pdf.embedFont(StandardFonts.Helvetica); form.updateFieldAppearances(font);
  pdf.setTitle(`SAMPLE - ${title} - NOT FOR FILING`); pdf.setSubject('Justice Tax Solutions controlled sample output; not filed, signed, accepted, or professionally approved.');
  pdf.setProducer(`Justice Tax Solutions v${VERSION} using pdf-lib`);
  for (const page of pdf.getPages()) { const { width, height } = page.getSize(); page.drawText('SAMPLE / INTERNAL QA - NOT FOR FILING',{x:width*.12,y:height*.48,size:29,font,color:rgb(.55,.55,.55),opacity:.14,rotate:degrees(35)}); }
  return Buffer.from(await pdf.save({ useObjectStreams:false, addDefaultPage:false, updateFieldAppearances:false }));
}

async function createEicDraftPdfBuffer(raw = {}) {
  const mapped = eicFieldValues(raw); if (!mapped.ok) throw new Error(`Schedule EIC draft blocked: ${[...mapped.missing,...mapped.errors,...mapped.unsupported].join(' | ')}`);
  const pdf = await PDFDocument.load(fs.readFileSync(sourcePath('SCHEDULE-EIC')), { ignoreEncryption:true, updateMetadata:true }); const form = pdf.getForm();
  for (const [name,value] of Object.entries(mapped.values)) setText(form,name,value);
  for (const name of mapped.checked) form.getCheckBox(name).check();
  return watermarkAndSave(pdf,'2025 Schedule EIC controlled draft');
}

async function create8880DraftPdfBuffer(raw = {}) {
  const mapped = form8880Values(raw); if (!mapped.ok) throw new Error(`Form 8880 draft blocked: ${[...mapped.validation.missing,...mapped.validation.errors,...mapped.validation.unsupported].join(' | ')}`);
  if (!mapped.calculation.formRequired) throw new Error('Form 8880 draft blocked because the supplied sample facts do not produce a positive credit.');
  const pdf = await PDFDocument.load(fs.readFileSync(sourcePath('8880')), { ignoreEncryption:true, updateMetadata:true }); const form = pdf.getForm();
  for (const [name,value] of Object.entries(mapped.values)) setText(form,name,value);
  return watermarkAndSave(pdf,'2025 Form 8880 controlled draft');
}

function readiness() {
  const qaPath = path.join(BASE, 'qa', 'credits-dependents-controlled-pilot.json');
  let qa = null;
  try { qa = JSON.parse(fs.readFileSync(qaPath, 'utf8')); } catch {}
  const automatedSamplesGenerated = Boolean(qa && Array.isArray(qa.records) && qa.records.length === 2);
  const automatedRenderPassed = Boolean(automatedSamplesGenerated && qa.records.every(record => record.automatedRenderPassed === true));
  const gates = { officialFilesPresent: Object.keys(SOURCES).every(key => fs.existsSync(sourcePath(key))), officialUrlsRecorded:true, technicalInventoryPresent:true, engineeredEicMapPresent:eicFieldMapReport().mappedSemanticItems>0, engineered8880MapPresent:form8880FieldMapReport().mappedFieldCount>0, deterministic8880TestsPassed:qa?.deterministicCalculationTestsPassed===true, automatedSamplesGenerated, automatedRenderPassed, humanSemanticVerificationApproved:false, humanVisualQaApproved:false, professionalApprovalRecorded:false, ownerReleaseRecorded:false, productionSensitiveDataGatePassed:false };
  const syntheticKeys=['officialFilesPresent','officialUrlsRecorded','technicalInventoryPresent','engineeredEicMapPresent','engineered8880MapPresent','deterministic8880TestsPassed','automatedSamplesGenerated','automatedRenderPassed'];
  return { version: VERSION, gates, readyForSyntheticQa: syntheticKeys.every(key=>gates[key]===true), readyForRealUserData:false, status:'internal_and_synthetic_qa_only', blockers:Object.entries(gates).filter(([,value])=>!value).map(([key])=>key), warning:'Captured PDFs and passing code tests do not equal credit eligibility, professional approval, filing authorization, e-file, or IRS acceptance.' };
}

module.exports = {
  VERSION, TAX_YEAR, SOURCES, FORM_POLICIES, ROUTING_QUESTIONS, ORGANIZERS, EIC_FIELD_MAP, FORM_8880_FIELD_MAP,
  buildLibrary, recommendForms, organizer, validateEic, eicFieldValues, buildEicCompletionPlan, eicFieldMapReport, createEicDraftPdfBuffer,
  saverRate, validate8880, calculate8880, form8880Values, build8880CompletionPlan, form8880FieldMapReport, create8880DraftPdfBuffer, readiness
};
