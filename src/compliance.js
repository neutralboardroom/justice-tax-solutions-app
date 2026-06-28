const PREPARER_COMPLIANCE_REQUIREMENTS = {
  ptin_preparer: [
    'Active PTIN for the filing season is recorded before compensated federal return preparation.',
    'Identity and preparer contact information are verified.',
    'Scope of work is documented before return review begins.',
    'Client receives preparer disclosure and must approve final return before filing.'
  ],
  accountant: [
    'PTIN status is recorded if the accountant prepares or substantially assists with a compensated federal return.',
    'New York preparer registration/NYTPRIN status is recorded when New York rules require it.',
    'Engagement scope and limits are documented.',
    'Client approval is captured before any return is filed or agency response is sent.'
  ],
  cpa: [
    'CPA license jurisdiction and license status are recorded.',
    'PTIN is recorded when the CPA prepares or substantially assists with a compensated federal return.',
    'NY preparer registration exemption or NYTPRIN status is documented when applicable.',
    'Review notes identify what was checked and what was not checked.'
  ],
  ea: [
    'EA credential and status are recorded.',
    'PTIN is recorded when the EA prepares or substantially assists with a compensated federal return.',
    'Circular 230 / representation scope is documented for tax controversy matters.',
    'Client authorization forms are required before representation before an agency.'
  ],
  tax_attorney: [
    'Attorney license jurisdiction and status are recorded.',
    'Attorney engagement scope is documented separately from tax-preparation support.',
    'Legal advice is only provided by the licensed attorney.',
    'Representation authorization is required before contacting an agency on the client’s behalf.'
  ],
  human_tax_specialist: [
    'Specialist may organize facts and documents but does not sign returns or give legal advice.',
    'Escalation rules are followed when tax debt, audit, lien, levy, OIC, or legal-risk flags appear.',
    'Client-facing notes avoid guarantees and do not promise refunds, relief, or agency outcomes.',
    'Professional signoff is required before final filing/release where required.'
  ]
};

const CASE_COMPLIANCE_CHECKLIST = [
  { key: 'identity_confirmed', label: 'Client identity and contact information confirmed', requiredBeforeRelease: true },
  { key: 'tax_years_confirmed', label: 'Tax years and agencies confirmed', requiredBeforeRelease: true },
  { key: 'document_checklist_reviewed', label: 'Missing-document checklist reviewed', requiredBeforeRelease: true },
  { key: 'scope_disclosed', label: 'Client understands scope: organizer, preparation, review, filing, or agency response', requiredBeforeRelease: true },
  { key: 'no_guarantee_acknowledged', label: 'Client acknowledged no guaranteed refund, relief, payment plan, OIC, or agency outcome', requiredBeforeRelease: true },
  { key: 'ptin_or_pro_required_checked', label: 'PTIN/professional signer requirement checked for compensated return preparation', requiredBeforeRelease: true },
  { key: 'ny_preparer_rules_checked', label: 'NY preparer registration/NYTPRIN requirement checked where applicable', requiredBeforeRelease: true },
  { key: 'client_approval_captured', label: 'Client approval captured before filing, signing, or agency response', requiredBeforeRelease: true },
  { key: 'efile_or_partner_path_recorded', label: 'E-file, paper-file, or partner professional path recorded', requiredBeforeRelease: false },
  { key: 'attorney_escalation_checked', label: 'Tax-attorney escalation checked for legal advice/representation issues', requiredBeforeRelease: false }
];

function checklistForCase(taxCase = {}) {
  const flags = new Set((taxCase.flags || []).map((flag) => String(flag.key || flag).toLowerCase()));
  const pathway = String(taxCase.pathway || '').toLowerCase();
  const needsAttorney = flags.has('lien_levy_or_collection') || flags.has('offer_in_compromise_screen') || pathway.includes('tax-debt') || pathway.includes('notice');
  const needsNY = String(taxCase.state_city_issues || taxCase.agency || '').toLowerCase().includes('new york') || String(taxCase.agency || '').toLowerCase().includes('nys') || String(taxCase.agency || '').toLowerCase().includes('nyc');
  return CASE_COMPLIANCE_CHECKLIST.map((item) => ({
    ...item,
    requiredBeforeRelease: item.requiredBeforeRelease || (item.key === 'ny_preparer_rules_checked' && needsNY) || (item.key === 'attorney_escalation_checked' && needsAttorney),
    suggested: true
  }));
}

function professionalComplianceScore(pro = {}) {
  const fields = [
    'name','email','role_key','status','credential_status','ptin_status','identity_verified','background_review_status','engagement_scope'
  ];
  const completed = fields.filter((field) => Boolean(pro[field]));
  let score = Math.round((completed.length / fields.length) * 70);
  if (pro.ptin || pro.ptin_last4) score += 10;
  if (pro.ny_tprin || pro.ny_preparer_registration_status) score += 10;
  if (pro.license_number || pro.ea_number) score += 10;
  return Math.min(100, score);
}

function releaseGateStatus({ taxCase = {}, checklistItems = [], professional = null } = {}) {
  const completed = new Set((taxCase.compliance_completed_keys || []).map(String));
  const missingRequired = checklistItems.filter((item) => item.requiredBeforeRelease && !completed.has(item.key));
  const hasPayment = taxCase.payment_status === 'paid' || taxCase.payment_status === 'comped' || taxCase.payment_verified === true;
  const hasClientApproval = completed.has('client_approval_captured') || Boolean(taxCase.client_final_approval_at);
  const proScore = professional ? professionalComplianceScore(professional) : 0;
  const professionalReady = professional ? proScore >= 70 && !['suspended','inactive','blocked'].includes(String(professional.status || '').toLowerCase()) : Boolean(taxCase.assigned_professional_id);
  return {
    releasable: missingRequired.length === 0 && hasPayment && hasClientApproval && professionalReady,
    missing_required_keys: missingRequired.map((item) => item.key),
    payment_verified: hasPayment,
    client_approval_captured: hasClientApproval,
    professional_ready: professionalReady,
    professional_compliance_score: proScore,
    warning: 'A release gate helps prevent client access to final filing/response output until payment, approval, professional readiness, and required compliance checks are recorded.'
  };
}

module.exports = {
  PREPARER_COMPLIANCE_REQUIREMENTS,
  CASE_COMPLIANCE_CHECKLIST,
  checklistForCase,
  professionalComplianceScore,
  releaseGateStatus
};
