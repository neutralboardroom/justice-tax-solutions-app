const NOTICE_ACTION_CATALOG = [
  { agency: 'IRS', notice: 'CP14', category: 'balance_due', urgency: 'medium', plainEnglish: 'The IRS says tax is owed for a filed return.', firstStep: 'Confirm tax year, balance, deadline, and whether the taxpayer agrees with the return.', commonDocs: ['full notice','filed return','proof of payments','account transcript if available'] },
  { agency: 'IRS', notice: 'CP2000', category: 'proposed_change', urgency: 'high', plainEnglish: 'The IRS proposes changes because third-party income records do not match the return.', firstStep: 'Do not simply pay or ignore; compare each proposed item to W-2s, 1099s, brokerage records, and the filed return.', commonDocs: ['complete CP2000','filed return','all W-2/1099/brokerage docs','explanation of disputed items'] },
  { agency: 'IRS', notice: 'CP504', category: 'collection', urgency: 'high', plainEnglish: 'The IRS is warning about collection action for unpaid tax.', firstStep: 'Escalate to tax-debt review and check payment plan/hardship/filing compliance.', commonDocs: ['complete notice','balance details','income/expense/assets','unfiled-year list'] },
  { agency: 'IRS', notice: 'Letter 1058/LT11', category: 'levy_rights', urgency: 'urgent', plainEnglish: 'Final notice of intent to levy and right to a hearing may have strict appeal deadlines.', firstStep: 'Urgent professional review; calendar the hearing deadline immediately.', commonDocs: ['complete letter','mailing date/envelope if available','prior notices','financial docs'] },
  { agency: 'IRS', notice: 'Letter 12C', category: 'missing_info', urgency: 'medium', plainEnglish: 'The IRS needs missing information before processing the return.', firstStep: 'Identify each requested item and respond with complete proof.', commonDocs: ['letter','return copy','requested forms/schedules/proof'] },
  { agency: 'NYS', notice: 'Notice and Demand', category: 'balance_due', urgency: 'medium', plainEnglish: 'New York State says tax, penalty, or interest is owed.', firstStep: 'Confirm tax type, year, balance, and payment/appeal options.', commonDocs: ['complete notice','return copy','proof of payments','NYS account details'] },
  { agency: 'NYS', notice: 'Statement of Proposed Audit Change', category: 'proposed_change', urgency: 'high', plainEnglish: 'New York proposes changes to a return or assessment.', firstStep: 'Compare the proposed changes to federal return, NY return, W-2/IT-2, residency facts, and credits.', commonDocs: ['complete notice','IT-201/IT-203','federal return','residency documents'] },
  { agency: 'NYC', notice: 'NYC DOF Business Tax Notice', category: 'nyc_business_tax', urgency: 'high', plainEnglish: 'NYC Department of Finance is raising an issue about a city business/non-property tax.', firstStep: 'Identify tax type such as UBT, commercial rent tax, corporation tax, or other DOF issue before responding.', commonDocs: ['complete notice','business returns','lease/rent records','entity/bookkeeping docs'] }
];

function noticeCatalogSummary() {
  const byAgency = {};
  const byUrgency = {};
  for (const item of NOTICE_ACTION_CATALOG) {
    byAgency[item.agency] = (byAgency[item.agency] || 0) + 1;
    byUrgency[item.urgency] = (byUrgency[item.urgency] || 0) + 1;
  }
  return { total: NOTICE_ACTION_CATALOG.length, by_agency: byAgency, by_urgency: byUrgency };
}

module.exports = { NOTICE_ACTION_CATALOG, noticeCatalogSummary };
