const fs=require('fs'); const path=require('path');
const VERSION='0.1.75';
const BASE=path.join(__dirname,'..','assets','official-forms','irs-individual-income-tax');
const MANIFEST=path.join(BASE,'manifest.json');
const CATALOG={
 '1040':{title:'U.S. Individual Income Tax Return',lane:'individual_return',review:'professional_recommended'},
 '1040-SR':{title:'U.S. Tax Return for Seniors',lane:'individual_return_senior',review:'professional_recommended'},
 '1040-S1':{title:'Schedule 1 — Additional Income and Adjustments',lane:'additional_income_adjustments',review:'professional_recommended'},
 '1040-S2':{title:'Schedule 2 — Additional Taxes',lane:'additional_taxes',review:'professional_required'},
 '1040-S3':{title:'Schedule 3 — Additional Credits and Payments',lane:'credits_payments',review:'professional_recommended'},
 '1040-S8':{title:'Schedule 8812 — Credits for Qualifying Children and Other Dependents',lane:'dependent_credits',review:'professional_recommended'},
 '1040-SA':{title:'Schedule A — Itemized Deductions',lane:'itemized_deductions',review:'professional_recommended'},
 '1040-SB':{title:'Schedule B — Interest and Ordinary Dividends',lane:'interest_dividends',review:'professional_recommended'},
 '1040-SC':{title:'Schedule C — Profit or Loss From Business',lane:'self_employment_business',review:'professional_required'},
 '1040-SD':{title:'Schedule D — Capital Gains and Losses',lane:'capital_gains',review:'professional_required'},
 '1040-SE':{title:'Schedule E — Supplemental Income and Loss',lane:'rental_pass_through_income',review:'professional_required'},
 '1040-SSE':{title:'Schedule SE — Self-Employment Tax',lane:'self_employment_tax',review:'professional_required'},
 '1040-X':{title:'Amended U.S. Individual Income Tax Return',lane:'amended_return',review:'professional_required'},
 '1098-T':{title:'Tuition Statement',lane:'education_document',review:'staff_or_professional'},
 '2441':{title:'Child and Dependent Care Expenses',lane:'dependent_care_credit',review:'professional_recommended'},
 '8863':{title:'Education Credits',lane:'education_credits',review:'professional_recommended'},
 'SCHEDULE-EIC':{title:'Schedule EIC — Qualifying Child Information',lane:'earned_income_credit_child_information',review:'professional_required'},
 '8332':{title:'Release/Revocation of Claim for Child',lane:'custodial_parent_release',review:'professional_required'},
 '8862':{title:'Claim Certain Credits After Disallowance',lane:'credit_after_disallowance',review:'professional_required'},
 '8867':{title:'Paid Preparer Due Diligence Checklist',lane:'preparer_due_diligence',review:'preparer_only'},
 '8880':{title:'Credit for Qualified Retirement Savings Contributions',lane:'retirement_savings_credit',review:'professional_recommended'}
};
const QUESTIONS=[
 {id:'filing_goal',prompt:'What do you need to do?',type:'choice',options:['file_current_return','file_prior_year','amend_return','review_before_filing','not_sure']},
 {id:'age_65_plus',prompt:'Were you born before the IRS age cutoff for Form 1040-SR for this tax year?',type:'boolean_or_unsure'},
 {id:'w2_income',prompt:'Do you have W-2 wage income?',type:'boolean'},
 {id:'self_employment',prompt:'Do you have 1099, gig, freelance, or sole-proprietor income?',type:'boolean'},
 {id:'interest_dividends',prompt:'Do you have taxable interest or ordinary dividends?',type:'boolean'},
 {id:'capital_gains',prompt:'Did you sell investments or other capital assets?',type:'boolean'},
 {id:'rental_or_pass_through',prompt:'Do you have rental, royalty, partnership, S corporation, estate, or trust income?',type:'boolean'},
 {id:'itemize',prompt:'Do you expect to itemize deductions?',type:'boolean_or_unsure'},
 {id:'dependents',prompt:'Are you claiming qualifying children or other dependents?',type:'boolean'},
 {id:'dependent_care',prompt:'Did you pay qualifying child or dependent care expenses so you could work?',type:'boolean'},
 {id:'education',prompt:'Did you or a dependent have eligible higher-education expenses or receive Form 1098-T?',type:'boolean'},
 {id:'additional_income_adjustments',prompt:'Do you have additional income or adjustments not reported directly on Form 1040?',type:'boolean_or_unsure'},
 {id:'additional_taxes',prompt:'Do you have additional taxes that may require Schedule 2?',type:'boolean_or_unsure'},
 {id:'additional_credits',prompt:'Do you have nonrefundable credits or other payments that may require Schedule 3?',type:'boolean_or_unsure'},
 {id:'eic_qualifying_child',prompt:'Are you considering earned income credit with a qualifying child?',type:'boolean_or_unsure'},
 {id:'credit_disallowed_before',prompt:'Was EIC, child-related credit, or education credit previously reduced or disallowed?',type:'boolean_or_unsure'},
 {id:'custodial_parent_release',prompt:'Do you need a release or revocation for a child claimed by a noncustodial parent?',type:'boolean_or_unsure'},
 {id:'retirement_savings_credit',prompt:'Did you or your spouse make eligible retirement contributions or elective deferrals?',type:'boolean_or_unsure'}
];
function uniq(a){return [...new Set(a)]}
function recommend(a={}){
 const forms=[a.age_65_plus===true?'1040-SR':'1040']; const warnings=[];
 if(a.filing_goal==='amend_return') forms.push('1040-X');
 if(a.additional_income_adjustments===true||a.additional_income_adjustments==='yes') forms.push('1040-S1');
 if(a.additional_taxes===true||a.additional_taxes==='yes') forms.push('1040-S2');
 if(a.additional_credits===true||a.additional_credits==='yes') forms.push('1040-S3');
 if(a.itemize===true||a.itemize==='yes') forms.push('1040-SA');
 if(a.interest_dividends) forms.push('1040-SB');
 if(a.self_employment) forms.push('1040-SC','1040-SSE');
 if(a.capital_gains) forms.push('1040-SD');
 if(a.rental_or_pass_through) forms.push('1040-SE');
 if(a.dependents) forms.push('1040-S8');
 if(a.dependent_care) forms.push('2441');
 if(a.education) forms.push('8863','1098-T');
 if(a.eic_qualifying_child===true) forms.push('SCHEDULE-EIC');
 if(a.credit_disallowed_before===true) forms.push('8862');
 if(a.custodial_parent_release===true) forms.push('8332');
 if(a.retirement_savings_credit===true) forms.push('8880');
 if(a.self_employment||a.capital_gains||a.rental_or_pass_through||a.filing_goal==='amend_return'||a.eic_qualifying_child===true||a.credit_disallowed_before===true||a.custodial_parent_release===true) warnings.push('Professional review is recommended or required before final release.');
 const internalComplianceForms = (a.eic_qualifying_child===true || a.dependents===true || a.education===true) ? [{formNumber:'8867',...CATALOG['8867']}] : [];
 return {version:VERSION,status:'controlled_recommendation_only',recommendedForms:uniq(forms).map(formNumber=>({formNumber,...CATALOG[formNumber]})),internalComplianceForms,warnings,nextSteps:['Confirm the tax year and filing status.','Gather all income, deduction, credit, and prior-return documents.','Complete only the schedules that apply.','Route complex or amended returns for professional review.','Do not treat a draft as filed or accepted by the IRS.']};
}
function summary(){const m=JSON.parse(fs.readFileSync(MANIFEST,'utf8')); const by={}; for(const d of m.forms){if(!d.formNumber)continue; by[d.formNumber] ||= {formNumber:d.formNumber,...(CATALOG[d.formNumber]||{}),documents:[],readiness:'pdf_captured'}; by[d.formNumber].documents.push(d)} return {version:VERSION,category:'IRS Individual Income Tax',formCount:Object.keys(by).length,documentCount:m.forms.length,forms:Object.values(by),releaseBoundary:'Captured PDFs, automated field inventories, and sample outputs remain controlled assets until human semantic verification, visual QA, professional approval, owner approval, and production security gates pass.'}}
module.exports={VERSION,CATALOG,QUESTIONS,recommend,summary};
