const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const engine = require('../src/form1040SimpleW2');

const fixturePath = path.join(__dirname, 'fixtures', 'form1040-simple-w2-sample.json');
const sample = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

(async () => {
  assert.strictEqual(engine.VERSION, '0.1.72');
  assert.strictEqual(engine.TAX_YEAR, 2025);

  const example = engine.lookupTax(25300, 'married_filing_jointly');
  assert.strictEqual(example.tax, 2562, 'Official 2025 tax-table example must equal $2,562.');

  const result = engine.calculate(sample);
  assert.strictEqual(result.ok, true, JSON.stringify(result.validation));
  assert.deepStrictEqual(
    {
      wages: result.calculation.wages,
      deduction: result.calculation.standardDeduction,
      taxableIncome: result.calculation.taxableIncome,
      tax: result.calculation.line16Tax,
      withholding: result.calculation.federalIncomeTaxWithheld,
      refund: result.calculation.refund,
      amountOwed: result.calculation.amountOwed
    },
    { wages: 80000, deduction: 31500, taxableIncome: 48500, tax: 5346, withholding: 6000, refund: 654, amountOwed: 0 }
  );

  const realDataAttempt = JSON.parse(JSON.stringify(sample));
  realDataAttempt.sampleMode = false;
  realDataAttempt.taxpayer.ssn = '123-45-6789';
  assert.strictEqual(engine.validate(realDataAttempt).ok, false);
  assert(engine.validate(realDataAttempt).errors.some((value) => value.includes('Real taxpayer data is blocked')));

  const unsupported = JSON.parse(JSON.stringify(sample));
  unsupported.eligibility.noDependents = false;
  assert.strictEqual(engine.validate(unsupported).ok, false);
  assert(engine.validate(unsupported).unsupported.some((value) => value.includes('Dependents')));

  const draft = await engine.createDraftPdfBuffer(sample);
  assert(draft.length > 100000, 'Generated sample PDF should contain the official two-page form.');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jts-1040-')), 'sample.pdf');
  fs.writeFileSync(tmp, draft);
  const pdf = await PDFDocument.load(draft);
  assert.strictEqual(pdf.getPageCount(), 2);
  const form = pdf.getForm();
  const readText = (name) => form.getTextField(name).getText() || '';
  assert.strictEqual(readText(engine.FIELD_MAP.taxpayerFirstAndMiddle), 'Sample A');
  assert.strictEqual(readText(engine.FIELD_MAP.line1aWages), '80000');
  assert.strictEqual(readText(engine.FIELD_MAP.line15TaxableIncome), '48500');
  assert.strictEqual(readText(engine.FIELD_MAP.line16Tax), '5346');
  assert.strictEqual(readText(engine.FIELD_MAP.line35aRefund), '654');
  assert.strictEqual(readText('topmostSubform[0].Page2[0].RoutingNo[0].f2_32[0]'), '', 'Routing number must remain blank.');
  assert.strictEqual(readText('topmostSubform[0].Page2[0].AccountNo[0].f2_33[0]'), '', 'Bank account number must remain blank.');
  assert.strictEqual(readText('topmostSubform[0].Page2[0].f2_37[0]'), '', 'Taxpayer occupation/signature-area text must remain blank.');
  assert.strictEqual(readText('topmostSubform[0].Page2[0].f2_44[0]'), '', 'Preparer name must remain blank.');
  assert.strictEqual(readText('topmostSubform[0].Page2[0].f2_47[0]'), '', 'PTIN must remain blank.');
  assert.strictEqual(form.getCheckBox(engine.FILING_STATUSES.married_filing_jointly.checkboxField).isChecked(), true);
  assert.strictEqual(form.getCheckBox(engine.FIELD_MAP.digitalAssetsNo).isChecked(), true);
  assert.strictEqual(form.getCheckBox(engine.FIELD_MAP.thirdPartyNo).isChecked(), true);

  const readiness = engine.buildReadiness({
    deterministicCalculationTestsPassed: true,
    automatedSamplePdfGenerated: true,
    automatedRenderPassed: true
  });
  assert.strictEqual(readiness.readyForSyntheticSampleQa, true);
  assert.strictEqual(readiness.readyForRealUserData, false);
  assert(readiness.blockers.includes('professionalApprovalRecorded'));
  assert(readiness.blockers.includes('productionSensitiveDataGatePassed'));

  console.log('Form 1040 simple W-2 controlled-pilot checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
