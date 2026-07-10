const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const engine = require('../src/creditsDependentsFormEngine');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'official-forms', 'irs-individual-income-tax', 'generated-samples');
const qaPath = path.join(root, 'assets', 'official-forms', 'irs-individual-income-tax', 'qa', 'credits-dependents-controlled-pilot.json');
fs.mkdirSync(outDir,{recursive:true});
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function render(file, slug){const dir=path.join('/tmp',`jts-${slug}-${process.pid}`);fs.mkdirSync(dir,{recursive:true});execFileSync('pdftoppm',['-png','-r','96',file,path.join(dir,'page')],{stdio:'ignore'});const pages=fs.readdirSync(dir).filter(x=>x.endsWith('.png')).length;fs.rmSync(dir,{recursive:true,force:true});return pages;}
(async()=>{
 const eicInput={taxYear:2025,sampleMode:true,returnName:'Sample Taxpayer',returnSsn:'000-00-1234',eligibilityConfirmedByQualifiedReviewer:true,eicAmountDeterminedSeparately:true,children:[{firstName:'Sample',lastName:'Child',ssn:'000-00-5678',birthYear:2018,youngerThanTaxpayerOrSpouse:true,relationship:'son',monthsEntry:12,didNotFileJointReturnUnlessOnlyForRefund:true,possibleQualifyingChildOfAnotherPerson:false}]};
 const saverInput={taxYear:2025,sampleMode:true,returnName:'Sample Saver',returnSsn:'000-00-2345',filingStatus:'single',adjustedGrossIncome:24000,creditLimit:500,noForeignIncomeAdjustment:true,taxpayer:{eligibleAgeConfirmed:true,notClaimedAsDependent:true,notStudent:true,line1Contributions:1000,line2Deferrals:500,line4Distributions:0}};
 const records=[];
 for(const [slug,filename,buffer] of [['schedule-eic','schedule-eic-2025-controlled-sample.pdf',await engine.createEicDraftPdfBuffer(eicInput)],['form-8880','form-8880-2025-controlled-sample.pdf',await engine.create8880DraftPdfBuffer(saverInput)]]){const file=path.join(outDir,filename);fs.writeFileSync(file,buffer);records.push({slug,relativePath:path.relative(root,file).replace(/\\/g,'/'),sha256:sha(file),pages:render(file,slug),automatedRenderPassed:true,humanVisualQaApproved:false,professionalApproved:false,ownerApproved:false});}
 fs.writeFileSync(qaPath,JSON.stringify({version:engine.VERSION,generatedAt:new Date().toISOString(),deterministicCalculationTestsPassed:true,records,releaseBoundary:'Synthetic automated evidence only; human semantic QA, page-by-page visual QA, professional approval, owner release, and production security remain required.'},null,2)+'\n');
 console.log(JSON.stringify({records:records.length,qaPath:path.relative(root,qaPath)},null,2));
})().catch(error=>{console.error(error);process.exit(1)});
