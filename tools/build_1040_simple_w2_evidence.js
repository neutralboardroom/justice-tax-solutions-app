const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const engine = require('../src/form1040SimpleW2');

(async () => {
  const root = path.join(__dirname, '..');
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'form1040-simple-w2-sample.json'), 'utf8'));
  const output = path.join(root, 'assets', 'official-forms', 'irs-individual-income-tax', 'generated-samples', '1040-simple-w2-controlled-sample.pdf');
  const evidencePath = path.join(root, 'assets', 'official-forms', 'irs-individual-income-tax', 'qa', '1040-simple-w2-controlled-pilot.json');
  const buffer = await engine.createDraftPdfBuffer(fixture);
  fs.writeFileSync(output, buffer);
  const pdf = await PDFDocument.load(buffer);
  const form = pdf.getForm();
  const evidence = {
    version: engine.VERSION,
    generatedAt: new Date().toISOString(),
    scope: engine.PILOT_POLICY.name,
    status: 'sample_and_internal_qa_only',
    source: engine.SOURCE,
    fixture: 'tests/fixtures/form1040-simple-w2-sample.json',
    samplePdf: path.relative(root, output).replace(/\\/g, '/'),
    sampleSha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    pageCount: pdf.getPageCount(),
    calculation: engine.calculate(fixture).calculation,
    mappedFieldCount: engine.buildFieldMapReport().mappedFieldCount,
    automatedAssertions: {
      officialPdfLoaded: true,
      generatedPdfReloaded: true,
      expectedTwoPages: pdf.getPageCount() === 2,
      wagesField: form.getTextField(engine.FIELD_MAP.line1aWages).getText() === '80000',
      taxableIncomeField: form.getTextField(engine.FIELD_MAP.line15TaxableIncome).getText() === '48500',
      taxField: form.getTextField(engine.FIELD_MAP.line16Tax).getText() === '5346',
      refundField: form.getTextField(engine.FIELD_MAP.line35aRefund).getText() === '654',
      bankFieldsBlank: !form.getTextField('topmostSubform[0].Page2[0].RoutingNo[0].f2_32[0]').getText() && !form.getTextField('topmostSubform[0].Page2[0].AccountNo[0].f2_33[0]').getText(),
      preparerAndPtinBlank: !form.getTextField('topmostSubform[0].Page2[0].f2_44[0]').getText() && !form.getTextField('topmostSubform[0].Page2[0].f2_47[0]').getText()
    },
    renderEvidence: {
      automatedRenderPassed: false,
      renderer: null,
      pageImages: [],
      note: 'Updated by the controlled render verification step; this is not human visual approval.'
    },
    approvals: {
      humanSemanticVerificationApproved: false,
      humanVisualQaApproved: false,
      professionalApprovalRecorded: false,
      ownerReleaseRecorded: false
    },
    releaseBoundaries: {
      realUserData: false,
      signedReturn: false,
      printReadyFinal: false,
      eFile: false,
      agencySubmission: false
    }
  };
  evidence.readiness = engine.buildReadiness({
    deterministicCalculationTestsPassed: Object.values(evidence.automatedAssertions).every(Boolean),
    automatedSamplePdfGenerated: true,
    automatedRenderPassed: false
  });
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ output, evidencePath, sha256: evidence.sampleSha256 }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
