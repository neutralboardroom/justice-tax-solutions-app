/** Controlled official form library foundation. */
const { VERSION, READINESS_STAGES, buildLibrarySummary } = require('./irsResolutionFormEngine');
module.exports = {
  version: VERSION,
  statuses: READINESS_STAGES,
  createRecord(input = {}) {
    return { formNumber: input.formNumber || null, agency: input.agency || null, taxYear: input.taxYear || null, revisionDate: input.revisionDate || null, sourceUrl: input.sourceUrl || null, checksum: input.checksum || null, language: input.language || 'en', status: input.status || 'not_uploaded' };
  },
  buildLibrarySummary
};
