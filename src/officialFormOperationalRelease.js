/**
 * Justice Tax Solutions v0.1.69
 * Per-form operational release gates for paid, controlled use.
 * This module never treats a captured PDF as automatically live-ready.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '0.1.69';
const INVENTORY_PATH = path.join(__dirname, '..', 'assets', 'official-forms', 'irs-tax-debt-resolution', 'field-inventory.json');

const RELEASE_CHECKS = [
  'official_source_verified',
  'checksum_verified',
  'field_inventory_complete',
  'semantic_mapping_complete',
  'sample_fill_generated',
  'visual_qa_passed',
  'overflow_and_formatting_passed',
  'signature_controls_passed',
  'client_verification_workflow_passed',
  'professional_review_workflow_passed',
  'security_controls_passed',
  'owner_release_approved'
];

function loadFieldInventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

function summarizeFieldInventory() {
  const inv = loadFieldInventory();
  const rows = [];
  for (const [formNumber, docs] of Object.entries(inv.forms || {})) {
    for (const doc of docs) {
      rows.push({
        formNumber,
        language: doc.language,
        filename: doc.filename,
        pageCount: doc.pageCount,
        acroformFieldCount: doc.acroformFieldCount,
        inventoryStatus: doc.inventoryStatus,
        sha256: doc.sha256
      });
    }
  }
  return {
    version: VERSION,
    formCount: new Set(rows.map((r) => r.formNumber)).size,
    documentCount: rows.length,
    totalAcroformFields: rows.reduce((n, r) => n + Number(r.acroformFieldCount || 0), 0),
    documents: rows
  };
}

function normalizeGateRecord(record = {}) {
  const checks = {};
  for (const key of RELEASE_CHECKS) checks[key] = Boolean((record.checks || {})[key]);
  return {
    formNumber: String(record.formNumber || '').trim(),
    language: String(record.language || 'en').trim().toLowerCase(),
    revision: String(record.revision || '').trim(),
    checks,
    mappingCoveragePercent: Math.max(0, Math.min(100, Number(record.mappingCoveragePercent || 0))),
    sampleOutputSha256: String(record.sampleOutputSha256 || '').trim(),
    visualQaReviewedBy: String(record.visualQaReviewedBy || '').trim(),
    professionalApprovedBy: String(record.professionalApprovedBy || '').trim(),
    ownerApprovedBy: String(record.ownerApprovedBy || '').trim(),
    notes: String(record.notes || '').trim().slice(0, 3000)
  };
}

function evaluateFormRelease(record = {}, securityReadiness = {}) {
  const normalized = normalizeGateRecord(record);
  const missing = RELEASE_CHECKS.filter((key) => !normalized.checks[key]);
  const securityOk = Boolean(securityReadiness.ready_for_live_sensitive_taxpayer_documents);
  if (!securityOk && !missing.includes('security_controls_passed')) missing.push('security_controls_passed');
  const mappingOk = normalized.mappingCoveragePercent === 100;
  if (!mappingOk && !missing.includes('semantic_mapping_complete')) missing.push('semantic_mapping_complete');
  const evidenceOk = Boolean(normalized.sampleOutputSha256 && normalized.visualQaReviewedBy && normalized.professionalApprovedBy && normalized.ownerApprovedBy);
  return {
    version: VERSION,
    formNumber: normalized.formNumber,
    language: normalized.language,
    paidControlledUseAllowed: missing.length === 0 && evidenceOk,
    printReadyOfficialOutputAllowed: missing.length === 0 && evidenceOk,
    efileOrAgencySubmissionAllowed: false,
    mappingCoveragePercent: normalized.mappingCoveragePercent,
    missingChecks: [...new Set(missing)],
    evidence: {
      sampleOutputSha256Present: Boolean(normalized.sampleOutputSha256),
      visualQaReviewerPresent: Boolean(normalized.visualQaReviewedBy),
      professionalApproverPresent: Boolean(normalized.professionalApprovedBy),
      ownerApproverPresent: Boolean(normalized.ownerApprovedBy)
    },
    releaseBoundary: 'Paid controlled use may begin only for an individually approved form. E-file or agency submission remains disabled until a real transmitter/submission integration is separately approved.'
  };
}

function buildPaidPilotCase(input = {}, releaseEvaluation = {}) {
  const idSeed = `${Date.now()}:${input.caseId || ''}:${input.formNumber || ''}`;
  return {
    id: `ofp_${crypto.createHash('sha256').update(idSeed).digest('hex').slice(0, 16)}`,
    caseId: String(input.caseId || '').trim(),
    formNumber: String(input.formNumber || '').trim(),
    language: String(input.language || 'en').trim(),
    serviceLevel: String(input.serviceLevel || 'guided_form_preparation').trim(),
    quotedAmountCents: Math.max(0, Number(input.quotedAmountCents || 0)),
    releaseStatus: releaseEvaluation.paidControlledUseAllowed ? 'eligible_for_controlled_paid_use' : 'blocked_pending_release_gates',
    finalOfficialOutputAllowed: Boolean(releaseEvaluation.printReadyOfficialOutputAllowed),
    agencySubmissionAllowed: false,
    missingChecks: releaseEvaluation.missingChecks || [],
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  VERSION,
  RELEASE_CHECKS,
  loadFieldInventory,
  summarizeFieldInventory,
  normalizeGateRecord,
  evaluateFormRelease,
  buildPaidPilotCase
};
