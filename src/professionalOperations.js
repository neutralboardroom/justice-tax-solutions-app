const { REVIEW_ROLES, buildReviewPlan, professionalPublicView } = require('./proReview');
const { PREPARER_COMPLIANCE_REQUIREMENTS, professionalComplianceScore } = require('./compliance');

function clean(value = '', max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function bool(value) {
  return value === true || value === 'true' || value === 'yes' || value === '1';
}

function lower(value = '') {
  return String(value || '').toLowerCase();
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const PROFESSIONAL_OPERATIONS_POLICY = {
  version: '0.1.27',
  purpose: 'Turn the existing PTIN/EA/CPA/tax-attorney review model into a practical operating system for real users.',
  operating_model: [
    'Start with the lowest safe review level, but never downgrade a customer who voluntarily requested a higher confidence/reassurance review.',
    'AI can organize answers, prepare form candidates, detect missing facts, and create professional agendas; it cannot replace required preparer/professional review.',
    'A professional must have an approved profile, scope, role permissions, and current credential checks before being assigned to release-sensitive work.',
    'Every final filing, agency response, print/signature package, or professional conclusion should have a recorded client approval and reviewer signoff where required.'
  ],
  client_disclosure_standard: [
    'Show the reviewer role in plain English.',
    'Show what was reviewed and what was not reviewed.',
    'Show whether the reviewer may sign returns, handle notices, tax debt, representation, accounting/business issues, or legal-advice-sensitive matters.',
    'Repeat that Justice Tax Solutions is not the IRS, New York State, NYC, or a law firm and no tax result is guaranteed.'
  ],
  not_ready_rules: [
    'Do not assign inactive, suspended, blocked, expired, or unverified professionals to final-output work.',
    'Do not allow a human tax specialist to sign returns, give legal advice, or handle representation-sensitive issues without the right professional escalation.',
    'Do not allow AI-only output to bypass official form QA, client verification, payment/quote approval, or required professional signoff.'
  ]
};

const CREDENTIAL_REQUIREMENT_MATRIX = {
  human_tax_specialist: {
    label: 'Human Tax Review Specialist',
    can_sign_returns: false,
    client_disclosure: 'Can organize facts, documents, and checklists; does not sign returns, represent taxpayers, or give legal advice.',
    required_fields: ['name','email','identity_verified','background_review_status','engagement_scope'],
    renewal_fields: [],
    release_limit: 'May release summaries/checklists only when no preparer/professional signoff is required.'
  },
  ptin_preparer: {
    label: 'PTIN Tax Preparer',
    can_sign_returns: true,
    client_disclosure: 'Can review/prepare compensated federal return work when PTIN and scope are recorded and current.',
    required_fields: ['name','email','identity_verified','ptin_last4','ptin_status','engagement_scope'],
    renewal_fields: ['ptin_expires_at'],
    release_limit: 'Can review/prepare return work within scope; escalate debt, representation, complex accounting, or legal issues.'
  },
  accountant: {
    label: 'Accountant / Bookkeeper',
    can_sign_returns: false,
    client_disclosure: 'Can support books, expenses, Schedule C organization, and document cleanup; PTIN is needed if preparing/substantially assisting with compensated federal return preparation.',
    required_fields: ['name','email','identity_verified','background_review_status','engagement_scope'],
    renewal_fields: [],
    release_limit: 'Can support accounting/document work; route return signing, representation, and legal issues to the proper professional.'
  },
  cpa: {
    label: 'CPA Review',
    can_sign_returns: true,
    client_disclosure: 'Can review complex returns, business/gig-worker issues, accounting facts, and state/city issues within license/scope.',
    required_fields: ['name','email','identity_verified','license_jurisdiction','license_number','credential_status','engagement_scope'],
    renewal_fields: ['license_expires_at','ptin_expires_at'],
    release_limit: 'Can review accounting/tax-prep issues within scope; legal advice/privilege/litigation remains tax-attorney territory.'
  },
  ea: {
    label: 'Enrolled Agent Review',
    can_sign_returns: true,
    client_disclosure: 'Can review IRS notices, collection, tax debt, payment plans, OIC screening, transcript/authorization, and representation-sensitive IRS issues within scope.',
    required_fields: ['name','email','identity_verified','ea_number','credential_status','engagement_scope'],
    renewal_fields: ['ea_expires_at','ptin_expires_at'],
    release_limit: 'Can handle IRS tax controversy/representation within scope; escalate legal-advice-sensitive issues to tax attorney.'
  },
  tax_attorney: {
    label: 'Tax Attorney Review',
    can_sign_returns: false,
    client_disclosure: 'Can provide legal strategy/advice only when a separate attorney engagement is accepted and scope is documented.',
    required_fields: ['name','email','identity_verified','license_jurisdiction','license_number','credential_status','engagement_scope'],
    renewal_fields: ['license_expires_at'],
    release_limit: 'Needed for legal advice, privilege, appeals/litigation, fraud/criminal exposure, or legal-risk tax issues.'
  }
};

const SIGNOFF_TYPES = [
  { key: 'ai_only_not_final', label: 'AI-only draft / not final output', final_release_allowed: false },
  { key: 'organizer_summary_reviewed', label: 'Organizer/checklist reviewed', final_release_allowed: true },
  { key: 'return_preparation_reviewed', label: 'Return preparation reviewed', final_release_allowed: true },
  { key: 'notice_response_reviewed', label: 'Notice/agency response reviewed', final_release_allowed: true },
  { key: 'tax_debt_options_reviewed', label: 'Tax debt/payment options reviewed', final_release_allowed: true },
  { key: 'official_form_output_reviewed', label: 'Official form output reviewed', final_release_allowed: true },
  { key: 'legal_strategy_reviewed', label: 'Tax-attorney legal strategy reviewed', final_release_allowed: true }
];

function roleSpec(roleKey = '') {
  return CREDENTIAL_REQUIREMENT_MATRIX[roleKey] || CREDENTIAL_REQUIREMENT_MATRIX.human_tax_specialist;
}

function buildCredentialVerificationPlan(pro = {}) {
  const spec = roleSpec(pro.role_key);
  const missingRequiredFields = spec.required_fields.filter((field) => {
    if (field === 'identity_verified') return !bool(pro.identity_verified);
    return !clean(pro[field]);
  });
  const renewalStatus = spec.renewal_fields.map((field) => {
    const days = daysUntil(pro[field]);
    return {
      field,
      value: pro[field] || '',
      days_until_expiration: days,
      status: days === null ? 'not_recorded' : (days < 0 ? 'expired' : (days <= 45 ? 'renewal_due_soon' : 'current'))
    };
  });
  const hasBlockingRenewal = renewalStatus.some((item) => ['expired','not_recorded'].includes(item.status) && ['ptin_expires_at','license_expires_at','ea_expires_at'].includes(item.field));
  const blockedByStatus = ['inactive','suspended','blocked','rejected'].includes(lower(pro.status));
  const score = professionalComplianceScore(pro);
  const approvedForAssignment = missingRequiredFields.length === 0 && !hasBlockingRenewal && !blockedByStatus && score >= 70;
  return {
    professional_id: pro.id || '',
    role_key: pro.role_key || '',
    role_label: spec.label,
    compliance_score: score,
    missing_required_fields: missingRequiredFields,
    renewal_status: renewalStatus,
    blocking_issues: [
      ...(blockedByStatus ? ['professional_status_blocks_assignment'] : []),
      ...(hasBlockingRenewal ? ['credential_or_ptin_expiration_not_current'] : []),
      ...(score < 70 ? ['professional_compliance_score_below_70'] : []),
      ...missingRequiredFields.map((field) => `missing_${field}`)
    ],
    approved_for_assignment: approvedForAssignment,
    approved_for_final_release: approvedForAssignment && ['active','approved','verified'].includes(lower(pro.status || 'active')),
    requirements: PREPARER_COMPLIANCE_REQUIREMENTS[pro.role_key] || [],
    disclosure: spec.client_disclosure,
    release_limit: spec.release_limit
  };
}

function professionalCredentialProfile(input = {}, actor = {}) {
  const role = REVIEW_ROLES.find((r) => r.key === input.role_key) || REVIEW_ROLES.find((r) => r.key === input.roleKey) || REVIEW_ROLES[0];
  const profile = {
    name: clean(input.name, 160),
    email: clean(input.email, 180).toLowerCase(),
    role_key: role.key,
    role_label: role.label,
    credentials: clean(input.credentials, 280),
    status: clean(input.status || 'pending_verification', 80),
    identity_verified: bool(input.identity_verified),
    background_review_status: clean(input.background_review_status || 'not_started', 80),
    credential_status: clean(input.credential_status || 'not_started', 80),
    ptin_last4: clean(input.ptin_last4 || '', 4),
    ptin_status: clean(input.ptin_status || 'not_recorded', 80),
    ptin_expires_at: clean(input.ptin_expires_at || '', 40),
    ny_tprin: clean(input.ny_tprin || '', 80),
    ny_preparer_registration_status: clean(input.ny_preparer_registration_status || 'not_recorded', 80),
    ny_tprin_expires_at: clean(input.ny_tprin_expires_at || '', 40),
    license_jurisdiction: clean(input.license_jurisdiction || '', 80),
    license_number: clean(input.license_number || '', 120),
    license_expires_at: clean(input.license_expires_at || '', 40),
    ea_number: clean(input.ea_number || '', 120),
    ea_expires_at: clean(input.ea_expires_at || '', 40),
    can_sign_returns: input.can_sign_returns !== undefined ? bool(input.can_sign_returns) : bool(role.canSignReturn),
    can_handle_notices: input.can_handle_notices !== undefined ? bool(input.can_handle_notices) : ['ea','cpa','tax_attorney','ptin_preparer'].includes(role.key),
    can_handle_tax_debt: input.can_handle_tax_debt !== undefined ? bool(input.can_handle_tax_debt) : ['ea','cpa','tax_attorney'].includes(role.key),
    can_handle_business_returns: input.can_handle_business_returns !== undefined ? bool(input.can_handle_business_returns) : ['cpa','accountant','ptin_preparer'].includes(role.key),
    can_handle_legal_advice: input.can_handle_legal_advice !== undefined ? bool(input.can_handle_legal_advice) : role.key === 'tax_attorney',
    max_complexity_level: clean(input.max_complexity_level || (role.key === 'human_tax_specialist' ? 'summary_only' : 'standard'), 80),
    states_supported: Array.isArray(input.states_supported) ? input.states_supported.map((x) => clean(x, 30)).filter(Boolean).slice(0, 20) : clean(input.states_supported || '', 250),
    service_scopes: Array.isArray(input.service_scopes) ? input.service_scopes.map((x) => clean(x, 80)).filter(Boolean).slice(0, 20) : clean(input.service_scopes || '', 600),
    engagement_scope: clean(input.engagement_scope || '', 1500),
    client_disclosure: clean(input.client_disclosure || roleSpec(role.key).client_disclosure, 1500),
    notes: clean(input.notes || '', 1500),
    verified_by: actor.id || input.verified_by || '',
    verified_at: input.verified_at || (['active','approved','verified'].includes(lower(input.status)) ? new Date().toISOString() : '')
  };
  profile.compliance_score = professionalComplianceScore(profile);
  profile.verification_plan = buildCredentialVerificationPlan(profile);
  return profile;
}

function caseRequiresRole(taxCase = {}) {
  const plan = taxCase.review_plan || buildReviewPlan(taxCase);
  const text = lower([taxCase.pathway, taxCase.description, taxCase.notice_text, taxCase.primary_concern, taxCase.income_types, taxCase.state_city_issues, taxCase.review_level_requested].join(' '));
  const requested = lower(taxCase.review_level_requested || taxCase.professional_session_level || taxCase.selected_review_level || '');
  if (requested.includes('attorney') || /fraud|criminal|subpoena|court|privilege|legal/.test(text)) return 'tax_attorney';
  if (requested.includes('cpa') || /business|partnership|s corp|k-1|rental|bookkeeping|nyc|schedule c|gig/.test(text)) return 'cpa';
  if (requested.includes('ea') || /levy|lien|collection|oic|offer|installment|payment plan|notice|transcript|2848|8821|433-f|9465/.test(text)) return 'ea';
  if (requested.includes('ptin') || /1040|1040-x|return|file|filing|amended/.test(text)) return 'ptin_preparer';
  const roles = (plan.professionalRoles || []).map((r) => r.key);
  return roles[0] || 'ptin_preparer';
}

function professionalCanHandle(pro = {}, requiredRole = '', taxCase = {}) {
  const p = { ...pro, verification_plan: buildCredentialVerificationPlan(pro) };
  if (!p.verification_plan.approved_for_assignment) return false;
  if (requiredRole === 'tax_attorney') return p.role_key === 'tax_attorney' && p.can_handle_legal_advice !== false;
  if (requiredRole === 'cpa') return ['cpa'].includes(p.role_key) || (p.role_key === 'tax_attorney' && /business|legal/.test(lower(taxCase.description || '')));
  if (requiredRole === 'ea') return ['ea','cpa','tax_attorney'].includes(p.role_key) && p.can_handle_notices !== false;
  if (requiredRole === 'ptin_preparer') return ['ptin_preparer','cpa','ea'].includes(p.role_key) && p.can_sign_returns !== false;
  return true;
}

function recommendCaseReviewer(taxCase = {}, professionals = []) {
  const requiredRole = caseRequiresRole(taxCase);
  const eligible = professionals
    .filter((pro) => !pro.deleted_at && professionalCanHandle(pro, requiredRole, taxCase))
    .map((pro) => ({
      professional: professionalPublicView(pro),
      verification: buildCredentialVerificationPlan(pro),
      match_score: professionalMatchScore(pro, requiredRole, taxCase)
    }))
    .sort((a, b) => b.match_score - a.match_score);
  return {
    case_id: taxCase.id || '',
    required_role: requiredRole,
    required_role_label: roleSpec(requiredRole).label,
    reason: assignmentReason(requiredRole, taxCase),
    eligible_count: eligible.length,
    recommended: eligible[0] || null,
    alternatives: eligible.slice(1, 5),
    if_none_available: 'Keep the case blocked from final output and either verify an appropriate professional, quote a higher review level, or refer/escalate before release.'
  };
}

function professionalMatchScore(pro = {}, requiredRole = '', taxCase = {}) {
  let score = professionalComplianceScore(pro);
  if (pro.role_key === requiredRole) score += 30;
  if (requiredRole === 'ea' && ['ea','cpa','tax_attorney'].includes(pro.role_key)) score += 20;
  if (requiredRole === 'ptin_preparer' && ['ptin_preparer','cpa','ea'].includes(pro.role_key)) score += 20;
  if (requiredRole === 'cpa' && pro.role_key === 'cpa') score += 25;
  if (requiredRole === 'tax_attorney' && pro.role_key === 'tax_attorney') score += 30;
  if (pro.can_handle_tax_debt && /debt|installment|payment|9465|433-f|oic|levy|lien/.test(lower(taxCase.description || taxCase.pathway || ''))) score += 12;
  if (pro.can_handle_business_returns && /business|schedule c|gig|1099|self/.test(lower(taxCase.description || taxCase.income_types || ''))) score += 12;
  return Math.min(150, score);
}

function assignmentReason(requiredRole = '', taxCase = {}) {
  const text = lower([taxCase.pathway, taxCase.description, taxCase.notice_text, taxCase.primary_concern, taxCase.selected_review_level, taxCase.professional_session_level].join(' '));
  if (requiredRole === 'tax_attorney') return 'Legal-advice-sensitive facts, attorney-requested review, court/fraud/criminal/privilege language, or tax-attorney reassurance request.';
  if (requiredRole === 'cpa') return 'Business, accounting, Schedule C/gig-worker, NYS/NYC, entity, or CPA-level reassurance review appears appropriate.';
  if (requiredRole === 'ea') return 'IRS notice, tax debt, payment plan, transcript/authorization, collection, or EA-level reassurance review appears appropriate.';
  if (requiredRole === 'ptin_preparer') return 'Paid return-preparation/review or PTIN-level correctness review appears appropriate.';
  return text ? 'General professional review request.' : 'Default professional routing.';
}

function buildProfessionalAssignmentMatrix(cases = [], professionals = []) {
  const openCases = cases.filter((c) => !c.deleted_at && !['closed','cancelled','released_to_client'].includes(lower(c.status)));
  return {
    total_open_cases: openCases.length,
    cases_needing_assignment: openCases.filter((c) => !c.assigned_professional_id && (lower(c.status).includes('review') || c.payment_status === 'paid' || c.risk_level === 'high' || c.customer_requested_professional)).length,
    by_required_role: ['ptin_preparer','ea','cpa','tax_attorney','human_tax_specialist'].map((role) => ({
      role,
      role_label: roleSpec(role).label,
      eligible_professionals: professionals.filter((p) => professionalCanHandle(p, role, {})).length,
      waiting_cases: openCases.filter((c) => caseRequiresRole(c) === role && !c.assigned_professional_id).map((c) => ({ id: c.id, email: c.email, pathway: c.pathway, status: c.status, created_at: c.created_at }))
    })),
    recommendations: openCases.slice(0, 50).map((c) => recommendCaseReviewer(c, professionals))
  };
}

function buildCredentialRenewalQueue(professionals = []) {
  return professionals.filter((p) => !p.deleted_at).map((pro) => {
    const verification = buildCredentialVerificationPlan(pro);
    const renewalFlags = verification.renewal_status.filter((item) => ['expired','renewal_due_soon','not_recorded'].includes(item.status));
    return {
      professional: professionalPublicView(pro),
      compliance_score: verification.compliance_score,
      blocking_issues: verification.blocking_issues,
      renewal_flags: renewalFlags,
      priority: verification.blocking_issues.length ? 'high' : (renewalFlags.length ? 'medium' : 'normal')
    };
  }).filter((row) => row.priority !== 'normal' || row.compliance_score < 90).sort((a, b) => (a.priority === 'high' ? -1 : 1) || (a.compliance_score - b.compliance_score));
}

function buildProfessionalOperationsReadiness({ professionals = [], cases = [] } = {}) {
  const verified = professionals.filter((p) => buildCredentialVerificationPlan(p).approved_for_assignment);
  const roles = ['ptin_preparer','ea','cpa','tax_attorney','human_tax_specialist'];
  const roleReadiness = roles.map((role) => ({
    role,
    role_label: roleSpec(role).label,
    approved_professionals: verified.filter((p) => p.role_key === role || professionalCanHandle(p, role, {})).length,
    status: verified.some((p) => p.role_key === role || professionalCanHandle(p, role, {})) ? 'ready_for_assignment' : 'needs_verified_professional'
  }));
  const blockers = [];
  for (const item of roleReadiness) {
    if (['ptin_preparer','ea','cpa','tax_attorney'].includes(item.role) && item.approved_professionals === 0) blockers.push(`No approved ${item.role_label} is available for cases requiring that level.`);
  }
  const assignmentMatrix = buildProfessionalAssignmentMatrix(cases, professionals);
  if (assignmentMatrix.cases_needing_assignment > 0) blockers.push(`${assignmentMatrix.cases_needing_assignment} case(s) appear to need professional assignment.`);
  return {
    status: blockers.length ? 'not_ready_for_full_paid_operations' : 'ready_for_controlled_professional_assignment',
    professional_count: professionals.length,
    approved_professional_count: verified.length,
    role_readiness: roleReadiness,
    credential_renewal_queue_count: buildCredentialRenewalQueue(professionals).length,
    assignment_summary: {
      total_open_cases: assignmentMatrix.total_open_cases,
      cases_needing_assignment: assignmentMatrix.cases_needing_assignment
    },
    blockers,
    required_next_actions: blockers.length ? blockers : ['Keep monitoring credential renewals, professional workload, signoffs, and client disclosures before release.']
  };
}

function createProfessionalSignoff(store, taxCase = {}, pro = {}, payload = {}, actor = {}) {
  const verification = buildCredentialVerificationPlan(pro);
  const signoffType = SIGNOFF_TYPES.find((item) => item.key === payload.signoff_type) || SIGNOFF_TYPES[1];
  const canRelease = verification.approved_for_final_release && signoffType.final_release_allowed && !['ai_only_not_final'].includes(signoffType.key);
  const record = store.insert('professional_signoffs', {
    id: `signoff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    case_id: taxCase.id,
    professional_id: pro.id,
    professional_name: pro.name,
    professional_role_key: pro.role_key,
    professional_role_label: pro.role_label || roleSpec(pro.role_key).label,
    signoff_type: signoffType.key,
    signoff_label: signoffType.label,
    scope_reviewed: clean(payload.scope_reviewed || '', 1500),
    limitations: clean(payload.limitations || 'This signoff is limited to the scope shown here and does not guarantee any refund, relief, payment plan, filing acceptance, or agency outcome.', 1500),
    client_visible_summary: clean(payload.client_visible_summary || `${pro.role_label || roleSpec(pro.role_key).label} reviewed the listed scope. Review does not guarantee a tax result.`, 1500),
    final_release_allowed: canRelease,
    credential_snapshot: verification,
    signed_by: actor.id || '',
    signed_at: new Date().toISOString()
  });
  store.update('cases', taxCase.id, {
    last_professional_signoff_id: record.id,
    professional_signoff_status: canRelease ? 'signed_off_for_scoped_release' : 'signoff_recorded_but_not_release_ready',
    professional_signoff_at: record.signed_at,
    release_status: canRelease ? (taxCase.release_status || 'professional_signed_off_pending_client_release') : (taxCase.release_status || '')
  });
  return record;
}

function buildClientReviewerDisclosure(taxCase = {}, professional = null, signoffs = []) {
  const pro = professional || {};
  const verification = pro.id ? buildCredentialVerificationPlan(pro) : null;
  return {
    case_id: taxCase.id || '',
    assigned_professional: pro.id ? professionalPublicView(pro) : null,
    reviewer_role_disclosure: pro.id ? roleSpec(pro.role_key).client_disclosure : 'No professional reviewer has been assigned yet.',
    reviewer_limits: pro.id ? roleSpec(pro.role_key).release_limit : 'AI-only guidance is not professional review, legal advice, or a guaranteed filing result.',
    credential_status_summary: verification ? {
      compliance_score: verification.compliance_score,
      approved_for_assignment: verification.approved_for_assignment,
      approved_for_final_release: verification.approved_for_final_release,
      blocking_issues: verification.blocking_issues
    } : null,
    signoffs: signoffs.map((item) => ({
      id: item.id,
      signoff_label: item.signoff_label,
      professional_name: item.professional_name,
      professional_role_label: item.professional_role_label,
      scope_reviewed: item.scope_reviewed,
      limitations: item.limitations,
      client_visible_summary: item.client_visible_summary,
      final_release_allowed: Boolean(item.final_release_allowed),
      signed_at: item.signed_at
    })),
    standing_notice: 'Justice Tax Solutions is not the IRS, New York State, NYC, or a law firm. No refund, tax debt reduction, payment plan, penalty relief, offer-in-compromise, audit result, or government outcome is guaranteed. Review the final facts carefully before signing, filing, or responding.'
  };
}

function buildProfessionalOperationsBoard(store) {
  const professionals = store.list('professionals', (p) => !p.deleted_at);
  const cases = store.list('cases', (c) => !c.deleted_at);
  return {
    readiness: buildProfessionalOperationsReadiness({ professionals, cases }),
    credential_renewal_queue: buildCredentialRenewalQueue(professionals),
    assignment_matrix: buildProfessionalAssignmentMatrix(cases, professionals),
    recent_signoffs: store.list('professional_signoffs', (s) => !s.deleted_at).slice(-25).reverse()
  };
}

module.exports = {
  PROFESSIONAL_OPERATIONS_POLICY,
  CREDENTIAL_REQUIREMENT_MATRIX,
  SIGNOFF_TYPES,
  professionalCredentialProfile,
  buildCredentialVerificationPlan,
  buildProfessionalOperationsReadiness,
  buildCredentialRenewalQueue,
  buildProfessionalAssignmentMatrix,
  recommendCaseReviewer,
  createProfessionalSignoff,
  buildClientReviewerDisclosure,
  buildProfessionalOperationsBoard
};
