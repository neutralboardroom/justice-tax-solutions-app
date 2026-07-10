/** Justice Tax Solutions guided form engine. */
const { VERSION, QUESTIONNAIRE, recommendResolutionPath } = require('./irsResolutionFormEngine');
module.exports = {
  version: VERSION,
  questionnaire: QUESTIONNAIRE,
  determineWorkflow(answers = {}) {
    const workflows = [];
    if (answers.receivedNotice) workflows.push('tax_notice_review');
    if (answers.cannotPay || answers.owesTax || answers.goal) workflows.push('irs_tax_debt_resolution');
    if (answers.priorReturnReview) workflows.push('prior_return_review');
    return workflows.length ? workflows : ['general_tax_intake'];
  },
  getMappedFormCandidates(workflow, answers = {}) {
    if (workflow === 'irs_tax_debt_resolution' || workflow === 'collection_resolution_review') return recommendResolutionPath(answers).recommendedForms.map((f) => f.formNumber);
    if (workflow === 'prior_return_review') return ['1040-X'];
    return [];
  },
  recommendResolutionPath
};
