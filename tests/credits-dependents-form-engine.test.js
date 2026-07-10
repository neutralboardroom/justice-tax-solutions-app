const assert = require('assert');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const engine = require('../src/creditsDependentsFormEngine');

(async () => {
  const library = engine.buildLibrary();
  assert.strictEqual(library.forms.length, 5);
  for (const source of Object.values(engine.SOURCES)) assert(fs.existsSync(require('path').join(__dirname, '..', source.localRelativePath)), `missing ${source.formNumber}`);

  const recommendation = engine.recommendForms({ qualifyingChildForEic:true, creditPreviouslyDisallowed:true, custodialParentRelease:true, retirementSavingsContributions:true });
  assert.deepStrictEqual(recommendation.customerForms.map(x=>x.formNumber), ['SCHEDULE-EIC','8862','8332','8880']);
  assert(recommendation.internalComplianceForms.some(x=>x.formNumber==='8867'));

  const eicInput = {
    taxYear: 2025, sampleMode: true, returnName: 'Sample Taxpayer', returnSsn: '000-00-1234',
    eligibilityConfirmedByQualifiedReviewer: true, eicAmountDeterminedSeparately: true,
    children: [{ firstName:'Sample', lastName:'Child', ssn:'000-00-5678', birthYear:2018, youngerThanTaxpayerOrSpouse:true, relationship:'son', monthsEntry:12, didNotFileJointReturnUnlessOnlyForRefund:true, possibleQualifyingChildOfAnotherPerson:false }]
  };
  const eicPlan = engine.buildEicCompletionPlan(eicInput);
  assert.strictEqual(eicPlan.ok, true);
  assert.strictEqual(eicPlan.review.eicAmountCalculatedHere, false);
  const eicPdf = await engine.createEicDraftPdfBuffer(eicInput);
  assert(eicPdf.length > 50000);
  const eicLoaded = await PDFDocument.load(eicPdf);
  assert.strictEqual(eicLoaded.getPageCount(), 2);
  assert.strictEqual(eicLoaded.getForm().getTextField(engine.EIC_FIELD_MAP.returnName).getText(), 'Sample Taxpayer');

  const saverInput = {
    taxYear:2025, sampleMode:true, returnName:'Sample Saver', returnSsn:'000-00-2345', filingStatus:'single', adjustedGrossIncome:24000, creditLimit:500, noForeignIncomeAdjustment:true,
    taxpayer:{eligibleAgeConfirmed:true,notClaimedAsDependent:true,notStudent:true,line1Contributions:1000,line2Deferrals:500,line4Distributions:0}
  };
  const saver = engine.calculate8880(saverInput);
  assert.strictEqual(saver.ok, true);
  assert.strictEqual(saver.calculation.line7, 1500);
  assert.strictEqual(saver.calculation.line9, 0.2);
  assert.strictEqual(saver.calculation.line10, 300);
  assert.strictEqual(saver.calculation.line12, 300);
  assert.strictEqual(saver.calculation.formRequired, true);
  const saverPdf = await engine.create8880DraftPdfBuffer(saverInput);
  assert(saverPdf.length > 40000);
  const saverLoaded = await PDFDocument.load(saverPdf);
  assert.strictEqual(saverLoaded.getPageCount(), 2);
  assert.strictEqual(saverLoaded.getForm().getTextField(engine.FORM_8880_FIELD_MAP.line12).getText(), '300');


  const jointInput = {
    taxYear:2025, sampleMode:true, returnName:'Sample Joint Savers', returnSsn:'000-00-3456', filingStatus:'married_filing_jointly', adjustedGrossIncome:40000, creditLimit:2000, noForeignIncomeAdjustment:true,
    taxpayer:{eligibleAgeConfirmed:true,notClaimedAsDependent:true,notStudent:true,line1Contributions:2000,line2Deferrals:0,line4Distributions:100},
    spouse:{eligibleAgeConfirmed:true,notClaimedAsDependent:true,notStudent:true,line1Contributions:2000,line2Deferrals:0,line4Distributions:200}
  };
  const jointSaver = engine.calculate8880(jointInput);
  assert.strictEqual(jointSaver.ok, true);
  assert.strictEqual(jointSaver.calculation.taxpayer.line4, 300);
  assert.strictEqual(jointSaver.calculation.spouse.line4, 300);
  assert.strictEqual(jointSaver.calculation.line9, 0.2);

  const blocked = engine.calculate8880({ ...saverInput, taxpayer:{...saverInput.taxpayer,notStudent:false} });
  assert.strictEqual(blocked.ok, false);
  assert(blocked.validation.unsupported.some(x=>x.includes('student-status')));
  assert.strictEqual(engine.saverRate(39500,'married_filing_jointly'),0.5);
  assert.strictEqual(engine.saverRate(39501,'married_filing_jointly'),0.2);
  assert.strictEqual(engine.saverRate(25500,'single'),0.2);
  assert.strictEqual(engine.saverRate(25501,'single'),0.1);

  console.log('Credits and dependents controlled-form engine checks passed');
})().catch(error => { console.error(error); process.exit(1); });
