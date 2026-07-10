/**
 * Justice Tax Solutions v0.1.68
 * IRS Tax Debt Resolution Form Engine — controlled Phase 1.
 * Official PDFs are captured and checksum-tracked, but no form is marked
 * submission-ready until field mapping, sample generation, visual QA,
 * client verification, and professional release gates are complete.
 */
const path = require('path');
const fs = require('fs');

const VERSION = '0.1.68';
const MANIFEST_PATH = path.join(__dirname, '..', 'assets', 'official-forms', 'irs-tax-debt-resolution', 'manifest.json');

const READINESS_STAGES = [
  'pdf_captured',
  'source_verified',
  'field_inventory_complete',
  'mapping_in_progress',
  'sample_generated',
  'visual_qa_complete',
  'client_verified',
  'professional_approved',
  'controlled_ready'
];

const FORM_CATALOG = {
  '2848': { title: 'Power of Attorney and Declaration of Representative', lane: 'professional_representation', review: 'professional_required' },
  '8821': { title: 'Tax Information Authorization', lane: 'records_authorization', review: 'staff_or_professional' },
  '4506': { title: 'Request for Copy of Tax Return', lane: 'records_retrieval', review: 'staff_review' },
  '4506-T': { title: 'Request for Transcript of Tax Return', lane: 'records_retrieval', review: 'staff_review' },
  '9465': { title: 'Installment Agreement Request', lane: 'payment_plan', review: 'professional_recommended' },
  '13844': { title: 'Application for Reduced User Fee for Installment Agreements', lane: 'payment_plan_fee_review', review: 'professional_recommended' },
  '433-F': { title: 'Collection Information Statement', lane: 'financial_disclosure', review: 'professional_required' },
  '433-A': { title: 'Collection Information Statement for Wage Earners and Self-Employed Individuals', lane: 'financial_disclosure', review: 'professional_required' },
  '433-A(OIC)': { title: 'Collection Information Statement for Offer in Compromise', lane: 'offer_in_compromise', review: 'professional_required' },
  '656': { title: 'Offer in Compromise', lane: 'offer_in_compromise', review: 'professional_required' },
  '656-B': { title: 'Offer in Compromise Booklet', lane: 'offer_in_compromise_guidance', review: 'professional_required' },
  '656-L': { title: 'Offer in Compromise — Doubt as to Liability', lane: 'offer_in_compromise_liability', review: 'tax_attorney_or_qualified_professional' },
  '656-PPV': { title: 'Offer in Compromise — Periodic Payment Voucher', lane: 'offer_in_compromise_payment', review: 'professional_required' },
  '13711': { title: 'Request for Appeal of Offer in Compromise', lane: 'offer_in_compromise_appeal', review: 'tax_attorney_or_qualified_professional' },
  '843': { title: 'Claim for Refund and Request for Abatement', lane: 'penalty_or_refund_claim', review: 'professional_required' },
  '12153': { title: 'Request for a Collection Due Process or Equivalent Hearing', lane: 'collection_due_process', review: 'tax_attorney_or_qualified_professional' },
  '9423': { title: 'Collection Appeal Request', lane: 'collection_appeal', review: 'tax_attorney_or_qualified_professional' }
};

const QUESTIONNAIRE = [
  { id: 'received_notice', prompt: 'Did you receive an IRS notice or collection letter?', type: 'boolean' },
  { id: 'all_returns_filed', prompt: 'Have all required federal tax returns been filed?', type: 'boolean_or_unsure' },
  { id: 'goal', prompt: 'What would you like help with?', type: 'choice', options: ['payment_plan','cannot_pay','offer_in_compromise','penalty_relief','collection_appeal','records_or_transcripts','professional_representation','not_sure'] },
  { id: 'collection_action', prompt: 'Has the IRS threatened or started a levy, wage garnishment, lien, or seizure?', type: 'choice', options: ['none','threatened','started','not_sure'] },
  { id: 'amount_band', prompt: 'Approximately how much is the IRS balance?', type: 'choice', options: ['under_10000','10000_to_50000','over_50000','not_sure'] },
  { id: 'individual_or_business', prompt: 'Is this an individual, business, or mixed tax matter?', type: 'choice', options: ['individual','business','both','not_sure'] },
  { id: 'needs_records', prompt: 'Do you need IRS records, transcripts, or copies before deciding what to do?', type: 'boolean' },
  { id: 'needs_representative', prompt: 'Do you want an authorized tax professional to communicate with the IRS?', type: 'boolean' }
];

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function recommendResolutionPath(answers = {}) {
  const forms = [];
  const lanes = [];
  const warnings = [];
  const goal = answers.goal || 'not_sure';

  if (answers.needs_records || goal === 'records_or_transcripts') {
    forms.push('4506-T', '8821');
    lanes.push('records_retrieval');
  }
  if (answers.needs_representative || goal === 'professional_representation') {
    forms.push('2848');
    lanes.push('professional_representation');
  }
  if (goal === 'payment_plan') {
    forms.push('9465', '13844');
    lanes.push('payment_plan');
  }
  if (goal === 'cannot_pay') {
    forms.push('433-F', answers.individual_or_business === 'business' ? '433-A' : '433-A');
    lanes.push('financial_disclosure');
  }
  if (goal === 'offer_in_compromise') {
    forms.push('656', '656-B', '433-A(OIC)');
    lanes.push('offer_in_compromise');
    warnings.push('Offer in Compromise eligibility and strategy require professional review; no acceptance is guaranteed.');
  }
  if (goal === 'penalty_relief') {
    forms.push('843');
    lanes.push('penalty_or_refund_claim');
  }
  if (goal === 'collection_appeal' || ['threatened','started'].includes(answers.collection_action)) {
    forms.push('12153', '9423');
    lanes.push('collection_appeal');
    warnings.push('Collection and hearing deadlines can be short. Verify the original notice immediately.');
  }
  if (answers.all_returns_filed === false || answers.all_returns_filed === 'no') {
    warnings.push('Many IRS resolution options require filing compliance. Missing returns should be reviewed before selecting a final resolution path.');
  }
  if (!forms.length) {
    lanes.push('irs_problem_truth_check');
    warnings.push('More information is needed before recommending a specific IRS form.');
  }

  const recommendedForms = unique(forms).map((formNumber) => ({ formNumber, ...FORM_CATALOG[formNumber] }));
  const requiredReview = recommendedForms.some((f) => String(f.review).includes('required') || String(f.review).includes('attorney'));

  return {
    version: VERSION,
    status: 'controlled_recommendation_only',
    lanes: unique(lanes),
    recommendedForms,
    requiredReview,
    warnings,
    nextSteps: [
      'Confirm the tax periods, notice numbers, deadlines, and filing-compliance status.',
      'Complete only the guided questions relevant to the selected resolution lane.',
      requiredReview ? 'Route the matter to an appropriately credentialed tax professional before release.' : 'Use staff review to confirm the form path before drafting.',
      'Do not treat a draft as submitted or approved by the IRS.'
    ]
  };
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function buildLibrarySummary() {
  const manifest = loadManifest();
  const byForm = {};
  for (const doc of manifest.forms) {
    if (!doc.formNumber) continue;
    byForm[doc.formNumber] ||= { formNumber: doc.formNumber, ...(FORM_CATALOG[doc.formNumber] || {}), documents: [], readiness: 'pdf_captured' };
    byForm[doc.formNumber].documents.push(doc);
  }
  return {
    version: VERSION,
    category: 'IRS Tax Debt & Problem Resolution',
    formCount: Object.keys(byForm).length,
    documentCount: manifest.forms.length,
    forms: Object.values(byForm),
    readinessStages: READINESS_STAGES,
    releaseBoundary: 'Captured official PDFs are controlled source assets only. Final official output, filing, and IRS submission remain blocked until all mapping and release gates pass.'
  };
}

function createMappingRecord(input = {}) {
  return {
    id: input.id || null,
    formNumber: input.formNumber || null,
    questionId: input.questionId || null,
    pdfFieldName: input.pdfFieldName || null,
    page: Number.isFinite(Number(input.page)) ? Number(input.page) : null,
    fieldType: input.fieldType || 'text',
    required: Boolean(input.required),
    condition: input.condition || null,
    validation: input.validation || null,
    status: input.status || 'mapping_in_progress',
    sampleVerified: false,
    visualQaVerified: false,
    professionalApproved: false
  };
}

function buildQaChecklist(formNumber) {
  return {
    formNumber,
    checks: [
      'Official PDF and instructions captured',
      'Official source URL and revision verified',
      'SHA-256 checksum recorded',
      'Exact AcroForm fields or overlay coordinates inventoried',
      'Plain-English questions mapped to every used field',
      'Conditional logic and repeated sections tested',
      'Sample-filled PDF generated',
      'Visual QA completed page by page',
      'Overflow, dates, checkboxes, signatures, preparer fields, and sensitive fields verified',
      'Client values verified',
      'Credentialed professional release recorded where required'
    ],
    finalOfficialOutputAllowed: false,
    efileOrAgencySubmissionAllowed: false
  };
}

module.exports = { VERSION, READINESS_STAGES, FORM_CATALOG, QUESTIONNAIRE, loadManifest, buildLibrarySummary, recommendResolutionPath, createMappingRecord, buildQaChecklist };
