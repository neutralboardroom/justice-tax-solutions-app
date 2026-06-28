require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Stripe = require('stripe');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const store = require('./src/storage');
const { STARTING_PATHS, FEDERAL_MVP_FORMS, NY_MVP_FORMS, NYC_MVP_WORKFLOWS, analyzeCase } = require('./src/taxRules');
const { configuredVendors, runAiSummary } = require('./src/aiVendors');
const { TAX_FORM_CATALOG, catalogSummary, workflowCoverage, ioReferenceAuditForTaxBuild } = require('./src/taxCatalog');
const { REVIEW_ROLES, REVIEW_TIERS, buildReviewPlan, professionalPublicView } = require('./src/proReview');
const { ROLE_PERMISSIONS, hasPermission, publicPermissions } = require('./src/permissions');
const { PREPARER_COMPLIANCE_REQUIREMENTS, checklistForCase, professionalComplianceScore, releaseGateStatus } = require('./src/compliance');
const { COMPETITOR_MAP, WORKFLOW_PATTERNS, FEATURE_INSPIRATION_LEDGER, competitorSummary } = require('./src/competitorIntel');
const { TAX_DOCUMENT_TYPES, FIELD_FILL_TARGETS, classifyDocument, buildFieldFillPlan, workpaperBinderForCase } = require('./src/documentIntelligence');
const { buildDocumentExtractionProfile, buildVerificationQueue } = require('./src/documentExtraction');
const { NOTICE_ACTION_CATALOG, noticeCatalogSummary } = require('./src/noticeCatalog');
const { FIRST_FORM_WAVES, FIELD_MAPPING_POLICY, ingestOfficialFormsZip, mappingQueue, buildMappingDraft, uploadReadinessGuide, formPrioritySummary, OFFICIAL_FORM_SOURCE_CATALOG, FORM_SOURCE_COLLECTION_POLICY, CONTROLLED_MAPPING_STAGES, officialSourceCatalog, validateOfficialSourceUrl, seedOfficialSourceCatalog, createOfficialSourceRecord, listOfficialFormSources, buildOfficialSourceInventory, buildSourceDrivenMappingDraft, buildDownloadVsUploadGuide, buildControlledMappingPlan, buildOfficialUrlDiscoveryGuide, buildOfficialUrlCaptureGuide, captureOfficialPdfFromSource, captureOfficialPdfBuffer } = require('./src/officialForms');
const { TAX_PROBLEM_PLAYBOOKS, TOMORROW_FORM_UPLOAD_CHECKLIST, buildCaseActionPlan, buildStaffTasks, mergeTaskBoard } = require('./src/workflowEngine');
const { CLIENT_CONSENT_MODEL, buildLiveReadiness, consentFromBody, consentValidation, buildCaseClientReadiness } = require('./src/liveOps');
const { LIVE_SERVICE_LEVELS, LIVE_CLIENT_JOURNEY, OPERATING_POLICIES, chooseServiceFit, buildClientJourney, buildIntakeQualityGate, buildStaffSlaBoard, buildLaunchPolishAudit } = require('./src/liveLaunch');
const { BRAND_SYSTEM, UX_POLISH_AUDIT } = require('./src/brandUx');
const { buildSimpleCaseStatus, buildCustomerExperienceReport, prelaunchQualityChecklist } = require('./src/customerExperience');
const { IMPROVEMENT_AUDIT, buildLivePilotGate, buildFounderNextActions, buildSecurityPlanReport, buildPilotCaseBoard, buildEmailTemplateInventory } = require('./src/pilotLaunch');
const { buildProductionConfigReport, buildSensitiveUploadPolicy, validateSensitiveUploadRequest, scanUploadBuffer, STORAGE_PROVIDERS, MALWARE_SCAN_PROVIDERS, EMAIL_TEMPLATES, RENDER_DEPLOYMENT_CHECKLIST, DATABASE_ADAPTERS, STORAGE_ADAPTER_INTERFACE, MALWARE_QUARANTINE_WORKFLOW, TRANSACTIONAL_EMAIL_DELIVERY_POLICY, STAFF_APPROVAL_MFA_POLICY, PILOT_STAGE_GATES, renderChecklistStatus, emailProviderStatus, databaseAdapterStatus, storageAdapterStatus, staffApprovalMfaStatus, pilotStageGateReport } = require('./src/productionConfig');
const { buildCustomerStatusCopy, buildStaffWorkflowBoard, buildUploadSafetyGuide, buildLaunchStageChecklist, buildOfficialFormReadinessMatrix, buildReferralPartnerGuide, buildDemoDataPreview, seedDemoData } = require('./src/pilotWorkflow');
const { AI_FIRST_FORM_COMPLETION_POLICY, FORM_COMPLETION_PIPELINE, FORM_INTERVIEW_LIBRARY, buildQuestionnaire, buildFormCompletionPlan, buildAutomationRoadmap, buildSampleFillAudit, buildExceptionReviewQueue, normalizeFormNumber } = require('./src/formAutomation');
const { PRICING_TIERS, buildPublicPricingSchedule, estimatePrice, buildStaffPricingGuide, buildReviewLevelPricing, recommendReviewLevel } = require('./src/pricingCatalog');
const { buildCompetitorMarketResearch, buildLiveOnlineConsultationProducts, estimateLiveConsultation } = require('./src/consultationMarket');
const { buildProfessionalSessionProducts, buildSessionRouting, buildPreSessionReadiness, buildProfessionalAgenda, estimateProfessionalSession, createSessionRequest, buildSessionBoard, buildProfessionalRoom } = require('./src/professionalSessions');
const { buildCalendarIntegrationGuide, buildAppointmentOptions, professionalCalendarRecord, listProfessionalCalendarConfigs, buildSchedulingReadiness, createAppointmentSchedulingRequest, updateProfessionalSessionSchedule, buildAppointmentSchedulingBoard } = require('./src/calendarIntegrations');
const { buildProductionSecurityReadiness, buildSensitiveDataHandlingRunbook, buildAccessControlAudit, buildSecurityLaunchBlockers, buildStaffSecurityGoLiveChecklist } = require('./src/productionSecurity');
const { IRS_9465_OFFICIAL_SOURCE, IRS_9465_OUTPUT_POLICY, build9465FieldMapReport, build9465CompletionPlan, build9465OutputReadiness, build9465SampleCases, build9465SampleFillAudit, build9465VerificationSheet, create9465DraftPdfBuffer, record9465QaStatus } = require('./src/form9465Output');
const { PROFESSIONAL_OPERATIONS_POLICY, CREDENTIAL_REQUIREMENT_MATRIX, SIGNOFF_TYPES, professionalCredentialProfile, buildCredentialVerificationPlan, buildProfessionalOperationsReadiness, buildCredentialRenewalQueue, buildProfessionalAssignmentMatrix, recommendCaseReviewer, createProfessionalSignoff, buildClientReviewerDisclosure, buildProfessionalOperationsBoard } = require('./src/professionalOperations');
const { PAYMENT_QUOTE_EMAIL_POLICY, TRANSACTIONAL_EMAIL_TEMPLATES_V2, buildPaymentQuoteEmailWorkflow, createQuoteRecord, approveQuote, createPaymentRequestFromQuote, createSafeMessageEvent, createAppointmentMessage, buildPaymentOperationsBoard, buildCasePaymentSummary } = require('./src/paymentWorkflow');
const { SERVICE_PAGES, buildMarketingConversionPlan, buildCampaignLandingChecklist, buildSeoServicePageRoadmap, listMarketingPages, getMarketingPage } = require('./src/marketingConversion');
const { ANALYTICS_EVENT_TAXONOMY, CAMPAIGN_FIELDS, buildStaffCockpit, buildConversionFunnel, buildMarketingAttribution, buildOperationalAlerts, buildAnalyticsImplementationPlan, sanitizeAnalyticsPayload } = require('./src/staffCockpitAnalytics');
const { PRIVATE_PILOT_RELEASE_POLICY, buildPrivatePilotReleaseCandidate, buildPrivatePilotRegressionChecklist, buildPilotUserScenarioMatrix, buildComplianceCopyAudit, buildPilotMarketingSafetyReview, buildPrivatePilotGoNoGoReport, buildPilotReleasePacket, recordPilotReleaseDecision } = require('./src/privatePilotRelease');
const { IRS_9465_CAPTURE_PROFILE, IRS_9465_VISUAL_QA_POLICY, ensure9465OfficialSource, inspectCaptured9465Pdf, build9465PdfCaptureReadiness, build9465VisualFieldQaPlan, build9465VisualSampleQa, create9465VisualQaPacketBuffer, record9465VisualQaStatus, build9465VisualQaBoard } = require('./src/form9465VisualQa');
const { FORM_9465_FILL_ENGINE_POLICY, FORM_9465_RELEASE_GATES, build9465OverlayTemplate, build9465FillPlan, build9465FillEngineReadiness, create9465SampleFilledOverlayPdfBuffer, record9465FillEngineStatus, build9465FillEngineBoard } = require('./src/form9465FillEngine');
const { FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY, build9465CaptureUploadFallbackPlan, build9465CoordinateLockChecklist, upload9465OfficialPdfFallback, record9465CoordinateLockStatus, build9465CoordinateLockBoard, build9465FinalOutputGateReport, create9465CoordinateLockPacketPdfBuffer } = require('./src/form9465CoordinateLock');
const { FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY, build9465VisualOverlayComparisonPlan, build9465OfficialSampleOutputPreview, build9465OfficialSampleOutputReadiness, record9465OfficialSampleQaStatus, build9465OfficialSampleQaBoard, create9465OfficialSampleOutputPacketPdfBuffer } = require('./src/form9465OfficialSample');
const { FORM_9465_CLIENT_RELEASE_POLICY, build9465ClientVerificationChecklist, create9465ClientVerificationRecord, build9465ProfessionalReleaseGate, record9465ProfessionalReleaseStatus, build9465PrintSignatureDraftReadiness, create9465PrintSignatureDraftPacketPdfBuffer, build9465ReleaseGateBoard } = require('./src/form9465ClientRelease');
const { FORM_9465_FINAL_RELEASE_POLICY, build9465FinalOutputGateAudit, build9465ClientReadyDraftPath, record9465FinalReleaseAuditStatus, build9465FinalReleaseBoard, create9465ClientReadyDraftPacketPdfBuffer } = require('./src/form9465FinalRelease');
const { FORM_9465_OPERATIONAL_QA_POLICY, build9465OperationalCaptureTest, build9465TrueCoordinateQaWorkflow, record9465TrueCoordinateQaStatus, build9465OperationalQaBoard, build9465FinalReleaseReadinessFromOperationalQa, create9465OperationalQaPacketPdfBuffer } = require('./src/form9465OperationalQa');
const { FORM_9465_CAPTURE_COMPLETION_POLICY, build9465CaptureCompletionReadiness, build9465CoordinateLockSimulationPlan, record9465CaptureCompletionStatus, build9465StaffApprovalGateReport, build9465CaptureCompletionBoard, create9465CaptureCompletionPacketPdfBuffer } = require('./src/form9465CaptureCompletion');

const app = express();
const PORT = process.env.PORT || 10000;
const APP_VERSION = require('./package.json').version;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DEFAULT_PUBLIC_BASE_URL = process.env.DEFAULT_PUBLIC_BASE_URL || PUBLIC_BASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-change-me-before-production';
const SESSION_COOKIE = 'jts_session';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'owner-dev-token');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
const PAYMENT_SUCCESS_URL = process.env.PAYMENT_SUCCESS_URL || `${PUBLIC_BASE_URL}/dashboard.html?payment=success`;
const PAYMENT_CANCEL_URL = process.env.PAYMENT_CANCEL_URL || `${PUBLIC_BASE_URL}/pricing.html?payment=cancelled`;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(501).json({ ok: false, error: 'Stripe webhook is not configured.' });
    }
    const signature = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object || {};
      const metadata = session.metadata || {};
      const paymentId = metadata.payment_id || `stripe_${session.id}`;
      const existing = store.find('payments', (p) => p.id === paymentId || p.stripe_checkout_session_id === session.id);
      const product = safeDisplay(metadata.product_type || 'tax_debt_notice_review', 80);
      const tier = pricingTierForProduct(product);
      const paymentPayload = {
        id: paymentId,
        case_id: metadata.case_id || '',
        email: session.customer_details ? session.customer_details.email : (metadata.email || ''),
        product_type: product,
        amount_total_cents: Number(session.amount_total || (tier ? tier.publicPriceCents : 0)),
        status: 'paid',
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent || '',
        referral_code: normalizeReferralCode(metadata.referral_code || ''),
        paid_at: new Date().toISOString()
      };
      const payment = existing ? store.update('payments', existing.id, paymentPayload) : store.insert('payments', paymentPayload);
      if (payment.case_id) store.update('cases', payment.case_id, { payment_status: 'paid', selected_tier: product, paid_at: new Date().toISOString(), payment_id: payment.id, status: 'paid_review_ready_for_assignment' });
      const reward = createReferralRewardForPayment(payment);
      store.addEvent('stripe_checkout_completed', { payment_id: payment.id, case_id: payment.case_id, product_type: product, reward_created: Boolean(reward) }, req);
    } else if (event.type === 'charge.refunded' || event.type === 'checkout.session.expired') {
      store.addEvent('stripe_payment_non_success_event', { stripe_event_type: event.type, object_id: event.data && event.data.object ? event.data.object.id : '' }, req);
    }
    return res.json({ received: true });
  } catch (error) {
    store.addEvent('stripe_webhook_error', { message: error.message }, req);
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.use(cookieParser());
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 180 }));
app.use(express.static(path.join(__dirname, 'public')));

function safeDisplay(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function parseAnswers(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return {}; }
}

function normalizeReferralCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 48);
}

function requestBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const host = req && String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  if (host) {
    const proto = String((req.get('x-forwarded-proto') || req.protocol || 'https')).split(',')[0].trim() || 'https';
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return DEFAULT_PUBLIC_BASE_URL;
}

function referralCodeFromEmail(email = '', role = 'client') {
  const local = String(email || '').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'PARTNER';
  const prefix = ['staff','admin','owner','professional'].includes(String(role || '').toLowerCase()) ? 'PRO' : 'JTS';
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 7) || String(Date.now()).slice(-5);
  return normalizeReferralCode(`${prefix}-${local}-${suffix}`);
}

function generateUniqueReferralCode(email = '', role = 'client') {
  for (let i = 0; i < 10; i += 1) {
    const code = referralCodeFromEmail(email, role);
    const exists = store.find('users', (u) => !u.deleted_at && (normalizeReferralCode(u.referral_code) === code || normalizeReferralCode(u.helper_code) === code));
    const exists2 = store.find('referrals', (r) => !r.deleted_at && normalizeReferralCode(r.code) === code);
    if (!exists && !exists2) return code;
  }
  return normalizeReferralCode(`JTS-${uuidv4().slice(0, 8).toUpperCase()}`);
}

function ensureReferralCode(user) {
  if (!user || !user.id) return null;
  if (normalizeReferralCode(user.referral_code)) return user;
  return store.update('users', user.id, { referral_code: generateUniqueReferralCode(user.email, user.role || 'client') }) || user;
}

function findReferrerByCode(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  return store.find('users', (u) => !u.deleted_at && (normalizeReferralCode(u.referral_code) === normalized || normalizeReferralCode(u.helper_code) === normalized))
    || store.find('referrals', (r) => !r.deleted_at && normalizeReferralCode(r.code) === normalized)
    || null;
}

function trackedStartLink(code, baseUrl = PUBLIC_BASE_URL, campaign = 'community-flyer') {
  const root = String(baseUrl || DEFAULT_PUBLIC_BASE_URL).replace(/\/$/, '');
  const qs = new URLSearchParams({ source: 'community_qr', campaign: safeDisplay(campaign, 80) });
  return `${root}/r/${encodeURIComponent(normalizeReferralCode(code))}?${qs.toString()}`;
}

function directReferralLink(code, baseUrl = PUBLIC_BASE_URL) {
  const root = String(baseUrl || DEFAULT_PUBLIC_BASE_URL).replace(/\/$/, '');
  return `${root}/?ref=${encodeURIComponent(normalizeReferralCode(code))}#start`;
}

function hashForAudit(value = '') {
  const salt = process.env.AUDIT_HASH_SALT || JWT_SECRET;
  return crypto.createHash('sha256').update(`${salt}:${String(value || '')}`).digest('hex').slice(0, 24);
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role || 'client' }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function getToken(req) {
  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return req.cookies && req.cookies[SESSION_COOKIE];
}

function currentUser(req) {
  const token = getToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return store.find('users', (u) => u.id === decoded.sub && !u.deleted_at) || null;
  } catch { return null; }
}

function publicUser(user = {}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    role: user.role || 'client',
    staff_status: user.staff_status || '',
    language: user.language || 'English',
    referral_code: user.referral_code || '',
    referred_by_code: user.referred_by_code || '',
    email_verified: Boolean(user.email_verified),
    permissions: publicPermissions(user),
    created_at: user.created_at
  };
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Please sign in.' });
  req.user = user;
  next();
}

function isStaff(user = {}) {
  const role = String(user.role || '').toLowerCase();
  if (!['staff','admin','owner','professional','human_tax_specialist'].includes(role)) return false;
  if (['admin','owner'].includes(role)) return true;
  return !user.staff_status || user.staff_status === 'active' || process.env.REQUIRE_STAFF_APPROVAL !== 'true';
}

function requirePermission(permission) {
  return (req, res, next) => {
    const user = currentUser(req);
    if (!user || !hasPermission(user, permission)) return res.status(403).json({ ok: false, error: `Permission required: ${permission}` });
    req.user = user;
    next();
  };
}

function requireStaff(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
    req.staff = { id: 'admin-token', role: 'admin', email: 'admin-token' };
    return next();
  }
  const user = currentUser(req);
  if (!user || !isStaff(user)) return res.status(401).json({ ok: false, error: 'Authorized staff access required.' });
  req.staff = user;
  next();
}

function adminGuard(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, error: 'ADMIN_TOKEN is not configured.' });
  if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  next();
}

// Pricing tiers are centralized in src/pricingCatalog.js so public pricing, payments, referrals, and staff quote guidance stay aligned.

function centsToDollars(cents = 0) { return `$${Math.round(Number(cents || 0) / 100)}`; }
function pricingTierForProduct(key = '') { return PRICING_TIERS[String(key || '').trim()] || null; }
function referralRewardCentsFor(productType, amountTotal = 0) {
  const tier = pricingTierForProduct(productType);
  if (!tier) return 0;
  const amount = Number(amountTotal || tier.publicPriceCents || 0);
  return amount >= 1000 ? Math.min(Number(tier.referralRewardCents || 0), amount) : 0;
}

function sameReferralCustomer(reward = {}, { referredUserId = '', caseId = '', email = '' } = {}) {
  const rewardEmail = String(reward.referred_email || '').trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  return Boolean((referredUserId && reward.referred_user_id === referredUserId) || (caseId && reward.case_id === caseId) || (cleanEmail && rewardEmail && rewardEmail === cleanEmail));
}

function priorCreditedReferralRewardCents({ referrerCode = '', referredUserId = '', caseId = '', email = '', excludingPaymentId = '' } = {}) {
  const code = normalizeReferralCode(referrerCode);
  const activeStatuses = new Set(['pending','approved','paid','held','needs_review']);
  const rewards = store.list('referral_rewards', (r) => {
    if (!r || r.deleted_at) return false;
    if (excludingPaymentId && r.payment_id === excludingPaymentId) return false;
    if (normalizeReferralCode(r.referrer_code) !== code) return false;
    if (!activeStatuses.has(String(r.status || 'pending'))) return false;
    return sameReferralCustomer(r, { referredUserId, caseId, email });
  });
  return rewards.reduce((sum, reward) => sum + Number(reward.reward_amount_cents || 0), 0);
}

function createReferralRewardForPayment(payment = {}) {
  const caseItem = payment.case_id ? store.find('cases', (c) => c.id === payment.case_id) : null;
  const user = caseItem && caseItem.user_id ? store.find('users', (u) => u.id === caseItem.user_id) : null;
  const candidateCode = normalizeReferralCode((user && user.referred_by_code) || (caseItem && (caseItem.referral_code || caseItem.helper_code)) || payment.referral_code || '');
  if (!candidateCode) return null;
  const productType = payment.product_type || (caseItem && caseItem.selected_tier) || '';
  const tier = pricingTierForProduct(productType);
  const maxReward = referralRewardCentsFor(productType, payment.amount_total_cents || 0);
  if (!tier || !maxReward) return null;
  const referrer = findReferrerByCode(candidateCode);
  if (referrer && user && referrer.id === user.id) return null;
  const existing = store.find('referral_rewards', (r) => r.payment_id === payment.id && !r.deleted_at);
  if (existing) return existing;
  const prior = priorCreditedReferralRewardCents({ referrerCode: candidateCode, referredUserId: user ? user.id : '', caseId: payment.case_id || '', email: payment.email || (caseItem && caseItem.email) || '' });
  const delta = Math.max(0, maxReward - prior);
  return store.insert('referral_rewards', {
    id: `rw_${uuidv4()}`,
    status: delta > 0 ? (referrer ? 'pending' : 'needs_review') : 'covered_by_prior_reward',
    referrer_code: candidateCode,
    referrer_user_id: referrer && referrer.email ? referrer.id : '',
    referrer_email: referrer ? referrer.email : '',
    referred_user_id: user ? user.id : '',
    referred_email: payment.email || (caseItem && caseItem.email) || '',
    case_id: payment.case_id || '',
    payment_id: payment.id,
    product_type: productType,
    pricing_tier_key: tier.key,
    pricing_tier_label: tier.label,
    platform_service_amount_cents: payment.amount_total_cents || tier.publicPriceCents,
    maximum_eligible_reward_cents: maxReward,
    prior_credited_reward_cents: prior,
    reward_amount_cents: delta,
    upgrade_credit_cents: delta,
    no_stacking_rule: true,
    note: 'Referral reward is based on the highest eligible paid Justice Tax Solutions platform/professional-review service for this referred customer, minus any prior credited or paid reward. Taxes, penalties, interest, government payments, refunds, chargebacks, and separate third-party professional fees do not qualify.'
  });
}

function summarizeRewards(rewards = []) {
  const out = { entries: rewards.length, pendingCents: 0, approvedCents: 0, paidCents: 0, heldCents: 0, needsReviewCents: 0, deniedCents: 0, reversedCents: 0, coveredByPriorRewardCents: 0, totalEarnedCents: 0, totalLedgerCents: 0 };
  for (const reward of rewards) {
    const cents = Number(reward.reward_amount_cents || 0);
    out.totalLedgerCents += cents;
    const status = String(reward.status || 'pending');
    if (status === 'pending') { out.pendingCents += cents; out.totalEarnedCents += cents; }
    else if (status === 'approved') { out.approvedCents += cents; out.totalEarnedCents += cents; }
    else if (status === 'paid') { out.paidCents += cents; out.totalEarnedCents += cents; }
    else if (status === 'held') { out.heldCents += cents; out.totalEarnedCents += cents; }
    else if (status === 'needs_review') { out.needsReviewCents += cents; out.totalEarnedCents += cents; }
    else if (status === 'covered_by_prior_reward') out.coveredByPriorRewardCents += cents;
    else if (status === 'reversed' || status === 'refunded') out.reversedCents += cents;
    else out.deniedCents += cents;
  }
  out.rule = 'Highest eligible paid-service reward for the referred customer minus prior credited/paid rewards. Standard rewards do not automatically stack.';
  out.maxStandardRewardCents = 5000;
  return out;
}

function pricingLedger() {
  const schedule = buildPublicPricingSchedule();
  return {
    ok: true,
    version: APP_VERSION,
    ...schedule,
    pricingTiers: schedule.publicTiers,
    referralRule: 'Rewards apply only to eligible paid Justice Tax Solutions platform/professional-review fees, not taxes, penalties, interest, government payments, refunds, chargebacks, or separate third-party professional fees.',
    upgradeExamples: [
      { sequence: '$49 quick summary then $99 notice action plan', firstRewardCents: 1000, upgradeCreditCents: 1500, totalRewardCents: 2500 },
      { sequence: '$99 Form 9465 AI completion then $199 PTIN review', firstRewardCents: 2500, upgradeCreditCents: 2500, totalRewardCents: 5000 },
      { sequence: '$199 PTIN return review then $499 CPA-level gig-worker review', firstRewardCents: 5000, upgradeCreditCents: 0, totalRewardCents: 5000 }
    ]
  };
}

async function generateQrPngBuffer(text) {
  return QRCode.toBuffer(text, { type: 'png', width: 720, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#173B6D', light: '#FFFFFF' } });
}

async function generateReferralFlyerPdf({ code, startLink, partnerName = '' }) {
  const qrBuffer = await generateQrPngBuffer(startLink);
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 34, bottom: 34, left: 42, right: 42 } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const navy = '#173B6D';
  const teal = '#2D9C8D';
  const ink = '#1F2937';
  const gray = '#5B6470';
  const light = '#F7FAFE';
  const border = '#D6E3F2';
  doc.rect(0, 0, doc.page.width, 18).fill(navy);
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(19).text('Justice Tax Solutions', 42, 36, { width: 220 });
  doc.fillColor(gray).font('Helvetica').fontSize(10.5).text('Tax help when you need more than software.', 42, 62, { width: 250 });
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(18).text('IRS, NY State, or NYC tax problem?', 265, 36, { width: 290, align: 'right' });
  doc.fillColor(gray).font('Helvetica').fontSize(10.5).text('Start free. Upload a notice, organize tax documents, or ask for return/tax-debt review.', 260, 64, { width: 300, align: 'right' });

  const topY = 124;
  doc.roundedRect(42, topY, 300, 210, 12).lineWidth(1).strokeColor(border).fillAndStroke(light, border);
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(18).text('English', 60, topY + 15);
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text('Need help with a tax notice, back taxes, or a return?', 60, topY + 43, { width: 260 });
  doc.fillColor(ink).font('Helvetica').fontSize(10.6)
    .text('Scan to start free and get a plain-English tax concern summary.', 60, topY + 83, { width: 260, lineGap: 1.2 })
    .text('Help available for IRS, New York State, NYC notices, tax debt, back taxes, gig worker taxes, and return review.', 60, topY + 116, { width: 260, lineGap: 1.2 })
    .text('Human tax review is used when the issue is risky or a return/agency response needs professional review.', 60, topY + 163, { width: 260, lineGap: 1.2 });

  doc.roundedRect(365, topY, 205, 210, 12).lineWidth(1).strokeColor(border).fillAndStroke('#FFFFFF', border);
  doc.image(qrBuffer, 397, topY + 16, { fit: [142, 142], align: 'center' });
  doc.roundedRect(385, topY + 164, 165, 26, 9).fill(teal);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(11).text('SCAN TO START FREE', 385, topY + 172, { width: 165, align: 'center' });
  doc.fillColor(gray).font('Helvetica').fontSize(8.3).text('Notice help | Tax debt | Return review', 372, topY + 195, { width: 190, align: 'center' });

  const bottomY = 370;
  doc.roundedRect(42, bottomY, 528, 268, 12).lineWidth(1).strokeColor(border).fillAndStroke(light, border);
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(18).text('Español', 60, bottomY + 16);
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text('¿Necesita ayuda con una carta de impuestos, deudas o una declaración?', 60, bottomY + 44, { width: 490 });
  doc.fillColor(ink).font('Helvetica').fontSize(10.8)
    .text('Escanee para empezar gratis y recibir un resumen en lenguaje claro.', 60, bottomY + 83, { width: 490, lineGap: 1.2 })
    .text('Ayuda disponible para cartas del IRS, Estado de Nueva York, NYC, deudas de impuestos, años no presentados, trabajadores independientes y revisión de declaraciones.', 60, bottomY + 116, { width: 490, lineGap: 1.2 })
    .text('Usamos revisión humana cuando el asunto es riesgoso o necesita revisión profesional antes de presentar, firmar o responder.', 60, bottomY + 172, { width: 490, lineGap: 1.2 });
  doc.roundedRect(60, bottomY + 226, 492, 27, 10).fill(teal);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Escanee aquí para empezar gratis / Scan here to start free', 60, bottomY + 234, { width: 492, align: 'center' });

  doc.roundedRect(42, 648, 528, 24, 10).fill('#ECF7F5');
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(11).text(`Community Partner / location code: ${code}${partnerName ? ` · ${partnerName}` : ''}`, 52, 655, { width: 508, align: 'center' });
  doc.fillColor(gray).font('Helvetica').fontSize(8.2).text('Justice Tax Solutions is not the IRS, New York State, NYC, or a law firm. No refund, tax debt reduction, payment plan, penalty relief, offer-in-compromise, audit result, or government outcome is guaranteed. Tax return preparation/filing and legal advice require qualified professionals where required.', 42, 678, { width: 528, align: 'center' });
  doc.end();
  return done;
}


function productionReadinessSummary() {
  const hasJwt = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev-change-me-before-production');
  const hasAdmin = Boolean(ADMIN_TOKEN);
  const hasPublicUrl = Boolean(process.env.PUBLIC_BASE_URL);
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const hasDocumentKey = Boolean(process.env.DOCUMENT_ENCRYPTION_KEY || (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev-change-me-before-production'));
  const hasSecureUploads = Boolean(process.env.SECURE_OBJECT_STORAGE_CONFIGURED === 'true' || hasDocumentKey);
  const hasOwnerEmail = Boolean(process.env.OWNER_EMAIL);
  const hasEmailProvider = Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.OWNER_EMAIL);
  const hasStaffApproval = Boolean(process.env.REQUIRE_STAFF_APPROVAL === 'true' || process.env.STAFF_SIGNUP_CODE);
  const checks = [
    { key: 'jwt_secret', label: 'Strong JWT/session secret configured', ok: hasJwt },
    { key: 'admin_token', label: 'Admin token configured', ok: hasAdmin },
    { key: 'public_base_url', label: 'Public base URL configured', ok: hasPublicUrl },
    { key: 'database', label: 'Managed database configured', ok: hasDb, note: hasDb ? 'DATABASE_URL present; v0.1.30 keeps db/postgres-schema.sql, database-adapter readiness reporting, calendar/scheduling readiness, production-security readiness, marketing conversion readiness, staff cockpit analytics, and private pilot release-candidate gates while local JSON remains the development fallback.' : 'Local JSON storage only. Use Render PostgreSQL before live production.' },
    { key: 'document_encryption', label: 'Document encryption key configured', ok: hasDocumentKey, note: 'v0.1.30 keeps encrypted local uploaded files at rest with AES-256-GCM and blocks live sensitive uploads unless database, storage, malware, staff, calendar/session, security, and private-pilot operating gates are enabled.' },
    { key: 'secure_document_storage', label: 'Secure object storage/private bucket configured', ok: process.env.SECURE_OBJECT_STORAGE_CONFIGURED === 'true', note: 'Encrypted local storage is acceptable for development; live tax documents should use managed private object storage.' },
    { key: 'stripe', label: 'Stripe payments/webhooks configured', ok: hasStripe },
    { key: 'email_recovery', label: 'Email provider or owner fallback configured for verification/password reset', ok: hasEmailProvider },
    { key: 'staff_permissions', label: 'Staff signup/approval controls configured', ok: hasStaffApproval },
    { key: 'owner_email', label: 'Owner/staff notification email configured', ok: hasOwnerEmail },
    { key: 'ai_vendors', label: 'At least one AI vendor configured', ok: configuredVendors().length > 0 },
    { key: 'ocr_provider', label: 'Production OCR/document extraction provider configured', ok: process.env.OCR_PROVIDER_CONFIGURED === 'true' || process.env.TEXTRACT_CONFIGURED === 'true' || process.env.GOOGLE_DOCUMENT_AI_CONFIGURED === 'true', note: 'v0.1.30 keeps local text/PDF extraction heuristics, AI-first form interview planning, professional operations/credential verification, professional-session readiness, calendar/scheduling integration scaffolding, marketing conversion pages, staff analytics, and private pilot sample-case gates; production should use OCR/document AI plus client/professional verification gates.' },
    { key: 'official_form_library', label: 'Official IRS/NYS/NYC form source and PDF library enabled', ok: true, note: 'v0.1.30 can seed official government source URLs, validate official domains, capture official PDFs when enabled, build AI-first interviews/completion plans, route verified professionals, show output gates before any print-ready draft, route marketing pages into safe intake paths, and report private-pilot go/no-go status.' }
  ];
  return {
    ready_for_sensitive_tax_documents: checks.every((c) => c.ok),
    checks,
    role_permissions: ROLE_PERMISSIONS,
    reviewer_compliance_requirements: PREPARER_COMPLIANCE_REQUIREMENTS,
    warning: 'v0.1.30 is a private pilot release candidate on top of marketing pages, staff cockpit analytics, payments/quotes, professional operations, production-security hardening, calendar/scheduling readiness, professional-session readiness, AI-first official form completion planning, and controlled IRS/NYS/NYC source capture. Source URLs, uploaded PDFs, captured PDFs, AI answers, and draft mappings remain blocked from final client-output use until source, edition, fields, calculations, sample-fill QA, client verification, required exception/professional review, Render PostgreSQL, private object storage, OCR/document-AI provider, malware scanning, Stripe live webhooks, staff approval, and e-file/professional procedures are configured.'
  };
}

function publicCaseSummary(taxCase = {}) {
  return {
    id: taxCase.id,
    created_at: taxCase.created_at,
    status: taxCase.status,
    pathway: taxCase.pathway,
    selected_tier: taxCase.selected_tier,
    risk_level: taxCase.risk_level,
    risk_score: taxCase.risk_score,
    agency: taxCase.agency,
    flags: taxCase.flags || [],
    missing_items: taxCase.missing_items || [],
    recommended_next_steps: taxCase.recommended_next_steps || [],
    review_gate: taxCase.review_gate,
    review_plan: taxCase.review_plan || null,
    payment_status: taxCase.payment_status || '',
    release_status: taxCase.release_status || '',
    assigned_professional_id: taxCase.assigned_professional_id || '',
    ai_summary: taxCase.ai_summary,
    referral_code: taxCase.referral_code || '',
    document_count: taxCase.document_count || 0,
    documents: taxCase.documents || [],
    document_readiness_score: taxCase.document_readiness_score || 0,
    extraction_summary: taxCase.extraction_summary || null,
    field_fill_plan: taxCase.field_fill_plan || null,
    document_binder: taxCase.document_binder || [],
    action_plan: taxCase.action_plan || null,
    client_readiness: taxCase.client_readiness || null,
    client_journey: taxCase.client_journey || null,
    service_fit: taxCase.service_fit || null,
    intake_quality_gate: taxCase.intake_quality_gate || null,
    next_questions: taxCase.next_questions || [],
    consent_status: taxCase.consent_status || '',
    upload_mode: taxCase.upload_mode || '',
    upload_policy_status: taxCase.upload_policy_status || '',
    customer_status_copy: taxCase.customer_status_copy || buildCustomerStatusCopy(taxCase)
  };
}

function summarizeCaseExtraction(documents = []) {
  const docs = Array.isArray(documents) ? documents : [];
  const scores = docs.map((d) => Number((d.extraction_profile && d.extraction_profile.extraction_confidence_score) || d.extraction_confidence_score || 0));
  const fields = docs.flatMap((d) => (d.extraction_profile && d.extraction_profile.extracted_fields) || d.extracted_fields || []);
  return {
    document_count: docs.length,
    extracted_documents: docs.filter((d) => ['extracted','extracted_partial'].includes(String((d.extraction_profile && d.extraction_profile.extraction_status) || d.extraction_status || ''))).length,
    ocr_required_count: docs.filter((d) => Boolean((d.extraction_profile && d.extraction_profile.ocr_required) || d.ocr_required)).length,
    average_confidence_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    extracted_field_count: fields.length,
    fields_needing_verification: fields.filter((f) => !['verified','rejected','professional_override'].includes(String(f.status || ''))).length,
    rule: 'Extracted fields are source-linked suggestions only and must be verified before filing, signing, payment-plan advice, or agency response.'
  };
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: 'Justice Tax Solutions',
    version: APP_VERSION,
    focus: 'tax problems first, tax returns included, private pilot release-candidate gates, staff cockpit analytics, client journey/service fit, action plans/playbooks, official form upload readiness, document extraction/verification, professional compliance workflow, production configuration gates, encrypted documents, Stripe-ready payments, referrals, QR flyers, release gates, staff SLA, demo-case testing, customer status copy, multi-AI readiness, AI-first official form completion planning, production-security hardening',
    storage: store.storageSummary(),
    ai_vendors_configured: configuredVendors(),
    io_reference_adapted: true,
    production_readiness: productionReadinessSummary(),
    production_config_stage: buildProductionConfigReport({ store, configuredVendors: configuredVendors() }).stage,
    sensitive_upload_policy: buildSensitiveUploadPolicy(),
    time: new Date().toISOString()
  });
});

app.get('/api/platform/brand-system', (req, res) => {
  res.json({ ok: true, brand: BRAND_SYSTEM });
});

app.get('/api/platform/ux-polish-audit', (req, res) => {
  res.json({ ok: true, audit: UX_POLISH_AUDIT });
});

app.get('/api/platform/customer-experience', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, customer_experience: buildCustomerExperienceReport({ store, version: APP_VERSION }) });
});

app.get('/api/platform/prelaunch-quality-checklist', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, checklist: prelaunchQualityChecklist() });
});

app.get('/api/platform/what-needs-improvement', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, audit: IMPROVEMENT_AUDIT, founder_next_actions: buildFounderNextActions({ store }), live_pilot_gate: buildLivePilotGate({ store }) });
});

app.get('/api/platform/founder-next-actions', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, actions: buildFounderNextActions({ store }) });
});

app.get('/api/platform/live-pilot-gate', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, gate: buildLivePilotGate({ store }) });
});

app.get('/api/platform/security-plan-checklist', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, security_plan: buildSecurityPlanReport({ store }) });
});

app.get('/api/platform/email-template-inventory', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, email_templates: buildEmailTemplateInventory() });
});

app.get('/api/platform/production-config', (req, res) => {
  const production_config = buildProductionConfigReport({ store, configuredVendors: configuredVendors() });
  res.json({ ok: true, version: APP_VERSION, production_config, production_security: buildProductionSecurityReadiness({ store }) });
});

app.get('/api/platform/production-security-readiness', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, readiness: buildProductionSecurityReadiness({ store }) });
});

app.get('/api/platform/sensitive-data-handling-runbook', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, runbook: buildSensitiveDataHandlingRunbook() });
});

app.get('/api/platform/access-control-audit', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, audit: buildAccessControlAudit({ store }) });
});

app.get('/api/platform/security-launch-blockers', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, blockers: buildSecurityLaunchBlockers({ store }) });
});

app.get('/api/staff/security-go-live-checklist', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, checklist: buildStaffSecurityGoLiveChecklist({ store }) });
});

app.post('/api/staff/production-security/:statusKey', requireStaff, (req, res) => {
  const statusKey = safeDisplay(req.params.statusKey, 100);
  const status = ['not_started','in_progress','complete','blocked','deferred'].includes(String(req.body.status || '')) ? req.body.status : 'in_progress';
  const event = store.insert('production_security_events', {
    id: `psec_${uuidv4()}`,
    status_key: statusKey,
    status,
    note: safeDisplay(req.body.note || '', 1200),
    actor_user_id: req.staff ? req.staff.id : '',
    actor_email: req.staff ? req.staff.email : '',
    completed_at: status === 'complete' ? new Date().toISOString() : ''
  });
  store.addEvent('production_security_status_recorded', { status_key: statusKey, status }, req);
  res.json({ ok: true, version: APP_VERSION, event, checklist: buildStaffSecurityGoLiveChecklist({ store }) });
});

app.get('/api/platform/sensitive-upload-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, policy: buildSensitiveUploadPolicy() });
});

app.get('/api/platform/storage-adapters', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, current_policy: buildSensitiveUploadPolicy(), storage_adapters: STORAGE_PROVIDERS });
});

app.get('/api/platform/malware-scan-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, current_policy: buildSensitiveUploadPolicy(), malware_scan_providers: MALWARE_SCAN_PROVIDERS });
});

app.get('/api/platform/transactional-email-templates', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, provider: emailProviderStatus(), templates: EMAIL_TEMPLATES, rule: 'Email subjects and bodies should avoid sensitive taxpayer facts. Direct clients to sign in to view details.' });
});

app.get('/api/platform/render-deployment-checklist', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, checklist: renderChecklistStatus(), source: RENDER_DEPLOYMENT_CHECKLIST, note: 'Use this before deploying to GitHub + Render. Keep live flags false until blockers pass.' });
});

app.get('/api/platform/database-adapters', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, database: databaseAdapterStatus(), adapters: DATABASE_ADAPTERS });
});

app.get('/api/platform/storage-provider-adapter', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, storage: storageAdapterStatus(), adapter_interface: STORAGE_ADAPTER_INTERFACE });
});

app.get('/api/platform/malware-quarantine-workflow', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, workflow: MALWARE_QUARANTINE_WORKFLOW, providers: MALWARE_SCAN_PROVIDERS });
});

app.get('/api/platform/staff-approval-mfa-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, status: staffApprovalMfaStatus(store), policy: STAFF_APPROVAL_MFA_POLICY });
});

app.get('/api/platform/pilot-stage-gates', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, gates: pilotStageGateReport({ store, configuredVendors: configuredVendors() }), stages: PILOT_STAGE_GATES });
});

app.get('/api/platform/transactional-email-delivery-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, email_provider: emailProviderStatus(), policy: TRANSACTIONAL_EMAIL_DELIVERY_POLICY, templates: EMAIL_TEMPLATES });
});

app.get('/api/platform/upload-safety-guide', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, guide: buildUploadSafetyGuide(buildSensitiveUploadPolicy()) });
});

app.get('/api/platform/launch-stage-checklist', (req, res) => {
  const productionReadiness = productionReadinessSummary();
  const liveReadiness = buildLiveReadiness({ store, configuredVendors: configuredVendors() });
  const productionConfig = buildProductionConfigReport({ store, configuredVendors: configuredVendors() });
  res.json({ ok: true, version: APP_VERSION, checklist: buildLaunchStageChecklist({ store, productionReadiness, liveReadiness, productionConfig, policy: buildSensitiveUploadPolicy() }) });
});

app.get('/api/platform/referral-partner-guide', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, guide: buildReferralPartnerGuide({ store }), pricing: pricingLedger() });
});

app.get('/api/platform/demo-data-preview', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, demo: buildDemoDataPreview() });
});

app.get('/api/tax/official-form-readiness-matrix', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, matrix: buildOfficialFormReadinessMatrix({ store }) });
});

app.get('/api/tax/ai-form-completion-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, policy: AI_FIRST_FORM_COMPLETION_POLICY, pipeline: FORM_COMPLETION_PIPELINE });
});

app.get('/api/tax/form-automation-roadmap', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, roadmap: buildAutomationRoadmap() });
});

app.get('/api/tax/forms/:formNumber/interview', (req, res) => {
  const answers = parseAnswers(req.query.answers || req.query.sample_answers || {});
  res.json({ ok: true, version: APP_VERSION, questionnaire: buildQuestionnaire(req.params.formNumber, answers) });
});

app.post('/api/tax/forms/:formNumber/answer-check', (req, res) => {
  const body = req.body || {};
  const sourceRecord = body.source_record_id ? store.find('official_form_sources', (src) => src.id === body.source_record_id && !src.deleted_at) : null;
  const officialForm = body.official_form_id ? store.find('official_forms', (form) => form.id === body.official_form_id && !form.deleted_at) : null;
  const plan = buildFormCompletionPlan({ formNumber: req.params.formNumber, answers: body.answers || body, sourceRecord, officialForm });
  res.status(plan.ok ? 200 : 404).json({ ok: plan.ok, version: APP_VERSION, plan });
});

app.post('/api/tax/forms/:formNumber/sample-fill-audit', (req, res) => {
  const audit = buildSampleFillAudit(req.params.formNumber, (req.body || {}).answers || req.body || {});
  res.status(audit.ok ? 200 : 404).json({ ok: audit.ok, version: APP_VERSION, audit });
});

app.get('/api/staff/workflow-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, workflow_board: buildStaffWorkflowBoard({ store }) });
});

app.get('/api/staff/form-automation-review-queue', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, queue: buildExceptionReviewQueue({ store }), policy: AI_FIRST_FORM_COMPLETION_POLICY });
});

app.post('/api/staff/demo-data/seed', requireStaff, (req, res) => {
  const seeded = seedDemoData(store, { analyzeCase, buildFieldFillPlan, workpaperBinderForCase, buildReviewPlan, buildCaseActionPlan, chooseServiceFit, buildClientJourney });
  res.json({ ok: true, version: APP_VERSION, ...seeded });
});

app.get('/api/staff/production-config-events', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, events: store.list('production_config_events').slice(0, Number(req.query.limit) || 100) });
});

app.post('/api/staff/production-config-events', requireStaff, (req, res) => {
  const body = req.body || {};
  const event = store.insert('production_config_events', {
    id: `prod_${uuidv4()}`,
    status_key: safeDisplay(body.status_key || body.key || 'general_note', 80),
    status: safeDisplay(body.status || 'noted', 80),
    note: safeDisplay(body.note || '', 1000),
    actor_user_id: req.staff.id,
    actor_email: req.staff.email
  });
  store.addEvent('production_config_event_recorded', { production_config_event_id: event.id, status_key: event.status_key, status: event.status }, req);
  res.json({ ok: true, version: APP_VERSION, event });
});

app.get('/api/staff/pilot-cases', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, pilot_cases: buildPilotCaseBoard({ store }) });
});

app.post('/api/staff/security-plan/:statusKey', requireStaff, (req, res) => {
  const statusKey = safeDisplay(req.params.statusKey, 80);
  const status = ['not_started','in_progress','complete','blocked'].includes(String(req.body.status || '')) ? req.body.status : 'in_progress';
  const record = store.insert('security_plan_events', {
    status_key: statusKey,
    status,
    note: safeDisplay(req.body.note || '', 800),
    completed_at: status === 'complete' ? new Date().toISOString() : '',
    actor_user_id: req.user ? req.user.id : '',
    actor_email: req.user ? req.user.email : ''
  });
  store.addEvent('security_plan_status_updated', { status_key: statusKey, status }, req);
  res.json({ ok: true, record, security_plan: buildSecurityPlanReport({ store }) });
});

app.get('/api/config', (req, res) => {
  res.json({ ok: true, app: 'Justice Tax Solutions', version: APP_VERSION, base_url: requestBaseUrl(req), starting_paths: STARTING_PATHS, federal_mvp_forms: FEDERAL_MVP_FORMS, ny_mvp_forms: NY_MVP_FORMS, nyc_mvp_workflows: NYC_MVP_WORKFLOWS, pricing: pricingLedger(), ai_vendors_configured: configuredVendors(), review_roles: REVIEW_ROLES, review_tiers: REVIEW_TIERS, role_permissions: ROLE_PERMISSIONS, compliance_requirements: PREPARER_COMPLIANCE_REQUIREMENTS, official_form_uploads_ready: true, live_service_levels: LIVE_SERVICE_LEVELS, client_journey: LIVE_CLIENT_JOURNEY, operating_policies: OPERATING_POLICIES });
});

app.get('/api/me', (req, res) => {
  const user = currentUser(req);
  res.json({ ok: true, user: user ? publicUser(ensureReferralCode(user)) : null });
});

app.post('/api/signup', async (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !email.includes('@') || password.length < 6) return res.status(400).json({ ok: false, error: 'Enter an email and a password of at least 6 characters.' });
  const existing = store.find('users', (u) => !u.deleted_at && String(u.email || '').toLowerCase() === email);
  if (existing) return res.status(409).json({ ok: false, error: 'That email already has an account. Please sign in.' });
  const requestedRole = String(body.role || 'client').toLowerCase();
  const role = (body.staff_code && process.env.STAFF_SIGNUP_CODE && body.staff_code === process.env.STAFF_SIGNUP_CODE) ? (requestedRole === 'professional' ? 'professional' : 'staff') : 'client';
  const incomingReferralCode = normalizeReferralCode(body.referral_code || body.ref || body.referred_by_code || '');
  const referrer = incomingReferralCode ? findReferrerByCode(incomingReferralCode) : null;
  const user = store.insert('users', {
    id: `usr_${uuidv4()}`,
    name: safeDisplay(body.name || '', 160),
    email,
    password_hash: await bcrypt.hash(password, 10),
    language: body.language || 'English',
    role,
    staff_status: role === 'client' ? '' : (process.env.REQUIRE_STAFF_APPROVAL === 'true' ? 'pending' : 'active'),
    referral_code: generateUniqueReferralCode(email, role),
    helper_code: normalizeReferralCode(body.helper_code || ''),
    referred_by_code: referrer ? normalizeReferralCode(referrer.referral_code || referrer.code) : incomingReferralCode,
    referred_by_user_id: referrer && referrer.email ? referrer.id : '',
    email_verified: false
  });
  const verification = store.createTokenRecord('email_verification_tokens', { user_id: user.id, email: user.email, purpose: 'email_verification' }, 24 * 60);
  store.addEvent('signup_completed', { user_id: user.id, role: user.role, referred: Boolean(user.referred_by_code), verification_created: true }, req);
  issueSession(res, user);
  res.json({ ok: true, user: publicUser(user), email_verification_required: true, dev_verification_token: process.env.NODE_ENV === 'production' ? undefined : verification.rawToken });
});

app.post('/api/login', async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const user = store.find('users', (u) => !u.deleted_at && String(u.email || '').toLowerCase() === email);
  if (!user || !(await bcrypt.compare(String((req.body || {}).password || ''), user.password_hash || ''))) return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  issueSession(res, user);
  store.addEvent('login_completed', { user_id: user.id }, req);
  res.json({ ok: true, user: publicUser(ensureReferralCode(user)) });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.post('/api/account/request-password-reset', (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const user = store.find('users', (u) => !u.deleted_at && String(u.email || '').toLowerCase() === email);
  if (user) {
    const token = store.createTokenRecord('password_reset_tokens', { user_id: user.id, email, purpose: 'password_reset' }, 90);
    store.addEvent('password_reset_requested', { user_id: user.id, email_hash: hashForAudit(email), delivery: process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY ? 'email-provider-configured' : 'dev-token-returned' }, req);
    return res.json({ ok: true, message: 'If that email exists, a reset link will be sent.', dev_reset_token: process.env.NODE_ENV === 'production' ? undefined : token.rawToken });
  }
  res.json({ ok: true, message: 'If that email exists, a reset link will be sent.' });
});

app.post('/api/account/reset-password', async (req, res) => {
  const rawToken = String((req.body || {}).token || '');
  const password = String((req.body || {}).password || '');
  if (password.length < 8) return res.status(400).json({ ok: false, error: 'Use a password of at least 8 characters.' });
  const token = store.findValidToken('password_reset_tokens', rawToken);
  if (!token) return res.status(400).json({ ok: false, error: 'Invalid or expired reset token.' });
  const user = store.find('users', (u) => u.id === token.user_id && !u.deleted_at);
  if (!user) return res.status(404).json({ ok: false, error: 'Account not found.' });
  await bcrypt.hash(password, 10).then((password_hash) => store.update('users', user.id, { password_hash }));
  store.update('password_reset_tokens', token.id, { status: 'used', used_at: new Date().toISOString() });
  store.addEvent('password_reset_completed', { user_id: user.id }, req);
  res.json({ ok: true, message: 'Password updated. Please sign in.' });
});

app.post('/api/account/request-email-verification', requireUser, (req, res) => {
  const token = store.createTokenRecord('email_verification_tokens', { user_id: req.user.id, email: req.user.email, purpose: 'email_verification' }, 24 * 60);
  store.addEvent('email_verification_requested', { user_id: req.user.id, delivery: process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY ? 'email-provider-configured' : 'dev-token-returned' }, req);
  res.json({ ok: true, message: 'Verification link created.', dev_verification_token: process.env.NODE_ENV === 'production' ? undefined : token.rawToken });
});

app.post('/api/account/verify-email', (req, res) => {
  const token = store.findValidToken('email_verification_tokens', String((req.body || {}).token || ''));
  if (!token) return res.status(400).json({ ok: false, error: 'Invalid or expired verification token.' });
  const user = store.find('users', (u) => u.id === token.user_id && !u.deleted_at);
  if (!user) return res.status(404).json({ ok: false, error: 'Account not found.' });
  const updated = store.update('users', user.id, { email_verified: true, email_verified_at: new Date().toISOString() });
  store.update('email_verification_tokens', token.id, { status: 'used', used_at: new Date().toISOString() });
  store.addEvent('email_verified', { user_id: user.id }, req);
  res.json({ ok: true, user: publicUser(updated) });
});

app.get('/r/:code', (req, res) => {
  const code = normalizeReferralCode(req.params.code || req.query.ref || '');
  const source = safeDisplay(req.query.source || 'community_qr', 80) || 'community_qr';
  const campaign = safeDisplay(req.query.campaign || req.query.c || 'community-flyer', 120) || 'community-flyer';
  if (!code) return res.redirect(302, `/?source=${encodeURIComponent(source)}#start`);
  const referrer = findReferrerByCode(code);
  store.insert('qr_scans', { id: `scan_${uuidv4()}`, referrer_code: code, referrer_id: referrer ? referrer.id : '', referrer_email: referrer ? referrer.email : '', source, campaign, path: `/r/${code}`, ip_hash: hashForAudit(String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()), user_agent_hash: hashForAudit(req.headers['user-agent'] || ''), user_agent_summary: safeDisplay(req.headers['user-agent'] || '', 180) });
  store.addEvent('referral_qr_scan_logged', { code, source, campaign, known_referrer: Boolean(referrer) }, req);
  res.redirect(302, `/?ref=${encodeURIComponent(code)}&source=${encodeURIComponent(source)}#start`);
});

app.post('/api/intake', upload.array('documents', 10), async (req, res) => {
  try {
    const body = req.body || {};
    const user = currentUser(req);
    const lockedReferralCode = normalizeReferralCode((user && user.referred_by_code) || body.referral_code || body.ref || '');
    const analysis = analyzeCase(body);
    const intakeQualityGate = buildIntakeQualityGate(body, req.files || []);
    if (!intakeQualityGate.ok) {
      return res.status(400).json({ ok: false, error: `Required intake item missing: ${intakeQualityGate.issues.map((i) => i.label).join(', ')}`, intake_quality_gate: intakeQualityGate });
    }
    const preliminaryConsent = consentFromBody(body, Boolean((req.files || []).length));
    const consentCheck = consentValidation(preliminaryConsent, { hasDocuments: Boolean((req.files || []).length), pathway: body.pathway || 'not-sure', riskLevel: analysis.risk_level });
    if (!consentCheck.ok) {
      return res.status(400).json({ ok: false, error: `Required acknowledgment missing: ${consentCheck.missing.join(', ')}`, missing_consents: consentCheck.missing, consent_model: CLIENT_CONSENT_MODEL });
    }
    const uploadGate = validateSensitiveUploadRequest(req.files || [], body);
    if (!uploadGate.ok) {
      store.addEvent('sensitive_upload_blocked_by_production_gate', { reason: uploadGate.error, file_count: (req.files || []).length, pathway: body.pathway || '' }, req);
      return res.status(403).json({ ok: false, error: uploadGate.error, upload_policy: uploadGate.policy });
    }
    const caseId = `case_${uuidv4()}`;
    const docs = [];
    for (const file of req.files || []) {
      const scan = await scanUploadBuffer(file);
      store.insert('storage_scan_events', { id: `scan_${uuidv4()}`, case_id: caseId, original_name: safeDisplay(file.originalname || '', 180), size_bytes: Number(file.size || 0), mime_type: safeDisplay(file.mimetype || '', 120), scan_status: scan.status, scan_provider: scan.provider, sha256: scan.sha256, upload_mode: uploadGate.upload_mode, live_sensitive_uploads_allowed: uploadGate.policy.accept_live_sensitive_documents, note: scan.rule });
      if (uploadGate.policy.accept_live_sensitive_documents && !scan.ok) {
        return res.status(403).json({ ok: false, error: 'Upload blocked because the malware scanner did not confirm the file is safe.', scan });
      }
      const savedDoc = store.saveUploadedFile(caseId, file);
      const initialExtraction = buildDocumentExtractionProfile(file, { key: 'unknown_tax_document' });
      const classification = classifyDocument({ original_name: savedDoc.original_name, mime_type: savedDoc.mime_type, extracted_text: initialExtraction.extracted_text_preview });
      const extractionProfile = buildDocumentExtractionProfile(file, classification);
      const updatedDoc = store.update('documents', savedDoc.id, {
        classification,
        document_workflow: classification.workflow,
        classifier: classification.classifier,
        extraction_profile: extractionProfile,
        extraction_status: extractionProfile.extraction_status,
        extraction_method: extractionProfile.extraction_method,
        extraction_confidence_score: extractionProfile.extraction_confidence_score,
        extraction_confidence_label: extractionProfile.extraction_confidence_label,
        extracted_fields: extractionProfile.extracted_fields,
        extracted_text_preview: extractionProfile.extracted_text_preview,
        ocr_required: extractionProfile.ocr_required,
        upload_mode: uploadGate.upload_mode,
        malware_scan_status: scan.status,
        malware_scan_provider: scan.provider,
        live_sensitive_uploads_allowed: uploadGate.policy.accept_live_sensitive_documents
      }) || savedDoc;
      store.insert('extraction_jobs', {
        id: `extract_${uuidv4()}`,
        case_id: caseId,
        document_id: savedDoc.id,
        status: extractionProfile.ocr_required ? 'needs_ocr_or_manual_review' : 'local_extraction_complete_needs_verification',
        method: extractionProfile.extraction_method,
        confidence_score: extractionProfile.extraction_confidence_score,
        confidence_label: extractionProfile.extraction_confidence_label,
        warnings: extractionProfile.warnings || []
      });
      docs.push(updatedDoc);
    }
    const taxCase = {
      id: caseId,
      user_id: user ? user.id : '',
      created_at: new Date().toISOString(),
      status: 'started',
      name: safeDisplay(body.name || (user && user.name) || '', 160),
      email: safeDisplay(body.email || (user && user.email) || '', 180).toLowerCase(),
      phone: safeDisplay(body.phone || '', 60),
      language: safeDisplay(body.language || 'English', 60),
      pathway: safeDisplay(body.pathway || 'not-sure', 80),
      selected_tier: safeDisplay(body.selectedTier || body.selected_tier || 'free_starting_point', 80),
      primary_concern: safeDisplay(body.primaryConcern || '', 240),
      description: safeDisplay(body.description || '', 3500),
      notice_text: safeDisplay(body.noticeText || '', 3500),
      tax_years: safeDisplay(body.taxYears || '', 200),
      income_types: safeDisplay(body.incomeTypes || '', 400),
      state_city_issues: safeDisplay(body.stateCityIssues || '', 500),
      utm_source: safeDisplay(body.utm_source || '', 100),
      utm_medium: safeDisplay(body.utm_medium || '', 100),
      utm_campaign: safeDisplay(body.utm_campaign || '', 140),
      utm_content: safeDisplay(body.utm_content || '', 140),
      utm_term: safeDisplay(body.utm_term || '', 140),
      landing_page: safeDisplay(body.landing_page || '', 220),
      conversion_intent: safeDisplay(body.conversion_intent || body.pathway || '', 120),
      referral_code: lockedReferralCode,
      helper_code: lockedReferralCode,
      client_consent: { ...preliminaryConsent, validation: consentCheck },
      consent_status: 'accepted',
      upload_mode: uploadGate.upload_mode || 'no_files',
      upload_policy_status: uploadGate.policy ? (uploadGate.policy.accept_live_sensitive_documents ? 'live_sensitive_enabled' : 'redacted_sample_or_no_uploads_only') : '',
      documents: docs.map((d) => ({
        id: d.id,
        original_name: d.original_name,
        size_bytes: d.size_bytes,
        mime_type: d.mime_type,
        classification: d.classification || classifyDocument(d),
        extraction_profile: d.extraction_profile || null,
        extraction_status: d.extraction_status || '',
        extraction_confidence_score: d.extraction_confidence_score || 0,
        extraction_confidence_label: d.extraction_confidence_label || '',
        extracted_fields: d.extracted_fields || [],
        ocr_required: Boolean(d.ocr_required)
      })),
      document_count: docs.length,
      ...analysis
    };
    taxCase.field_fill_plan = buildFieldFillPlan(taxCase, taxCase.documents || []);
    taxCase.document_binder = workpaperBinderForCase(taxCase, taxCase.documents || []);
    taxCase.document_readiness_score = taxCase.field_fill_plan.readiness_score;
    taxCase.extraction_summary = summarizeCaseExtraction(taxCase.documents || []);
    taxCase.review_plan = buildReviewPlan(taxCase);
    taxCase.review_readiness_score = taxCase.review_plan.readinessScore;
    taxCase.review_recommended_product = taxCase.review_plan.recommendedProduct;
    taxCase.action_plan = buildCaseActionPlan(taxCase);
    taxCase.client_readiness = buildCaseClientReadiness(taxCase);
    taxCase.intake_quality_gate = intakeQualityGate;
    taxCase.service_fit = chooseServiceFit(taxCase);
    taxCase.client_journey = buildClientJourney(taxCase);
    taxCase.next_questions = taxCase.client_journey.next_questions;
    taxCase.ai_summary = await runAiSummary(taxCase);
    taxCase.customer_status_copy = buildCustomerStatusCopy(taxCase);
    const saved = store.insert('cases', taxCase);
    store.insert('service_fit_events', { id: `fit_${uuidv4()}`, case_id: saved.id, recommended_service_key: saved.service_fit && saved.service_fit.recommended_service ? saved.service_fit.recommended_service.key : '', reason: saved.service_fit ? saved.service_fit.reason : '', intake_quality_score: intakeQualityGate.score });
    store.insert('client_journey_events', { id: `journey_${uuidv4()}`, case_id: saved.id, current_step: saved.client_journey ? saved.client_journey.current_step : 0, blocker_count: saved.client_journey ? saved.client_journey.blockers.length : 0 });
    store.insert('client_acknowledgments', {
      id: `ack_${uuidv4()}`,
      case_id: saved.id,
      user_id: user ? user.id : '',
      ...preliminaryConsent,
      ip_hash: hashForAudit(String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()),
      user_agent_summary: safeDisplay(req.headers['user-agent'] || '', 180)
    });
    store.addEvent('case_created', { case_id: saved.id, pathway: saved.pathway, risk_level: saved.risk_level, referral: Boolean(saved.referral_code), document_count: docs.length, consent_recorded: true, recommended_service_key: saved.service_fit && saved.service_fit.recommended_service ? saved.service_fit.recommended_service.key : '', intake_quality_score: intakeQualityGate.score }, req);
    res.json({ ok: true, case: publicCaseSummary(saved) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/cases', requireUser, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at && (c.user_id === req.user.id || String(c.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()));
  res.json({ ok: true, cases: cases.map(publicCaseSummary) });
});

app.get('/api/cases/:id', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  res.json({ ok: true, case: publicCaseSummary(c), documents: c.documents || [], field_fill_plan: c.field_fill_plan || buildFieldFillPlan(c, c.documents || []), document_binder: c.document_binder || workpaperBinderForCase(c, c.documents || []), messages: store.list('messages', (m) => m.case_id === c.id && !m.deleted_at) });
});

app.get('/api/cases/:id/action-plan', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const actionPlan = buildCaseActionPlan(c);
  const updated = store.update('cases', c.id, { action_plan: actionPlan, action_plan_updated_at: new Date().toISOString() });
  store.addEvent('case_action_plan_generated', { case_id: c.id, matched_playbooks: actionPlan.matched_playbooks.map((p) => p.key) }, req);
  res.json({ ok: true, case: publicCaseSummary(updated || c), action_plan: actionPlan });
});

app.get('/api/cases/:id/client-readiness', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const clientReadiness = buildCaseClientReadiness(c);
  const updated = store.update('cases', c.id, { client_readiness: clientReadiness, client_readiness_updated_at: new Date().toISOString() });
  store.addEvent('case_client_readiness_checked', { case_id: c.id, ready_for_paid_review_request: clientReadiness.ready_for_paid_review_request, blocker_count: clientReadiness.blockers.length }, req);
  res.json({ ok: true, case: publicCaseSummary(updated || c), client_readiness: clientReadiness });
});

app.get('/api/cases/:id/client-journey', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const clientJourney = buildClientJourney(c);
  const serviceFit = chooseServiceFit(c);
  const updated = store.update('cases', c.id, { client_journey: clientJourney, service_fit: serviceFit, next_questions: clientJourney.next_questions, client_journey_updated_at: new Date().toISOString() });
  store.insert('client_journey_events', { id: `journey_${uuidv4()}`, case_id: c.id, current_step: clientJourney.current_step, blocker_count: clientJourney.blockers.length, warning_count: clientJourney.warnings.length, actor_user_id: req.user.id });
  store.addEvent('case_client_journey_checked', { case_id: c.id, current_step: clientJourney.current_step, recommended_service_key: serviceFit.recommended_service.key, blocker_count: clientJourney.blockers.length }, req);
  res.json({ ok: true, case: publicCaseSummary(updated || c), client_journey: clientJourney, service_fit: serviceFit });
});


app.get('/api/cases/:id/simple-status', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const simpleStatus = buildSimpleCaseStatus(c);
  store.addEvent('case_simple_status_viewed', { case_id: c.id, plain_status: simpleStatus.plain_status, blocker_count: simpleStatus.blockers.length }, req);
  res.json({ ok: true, case: publicCaseSummary(c), simple_status: simpleStatus });
});

app.get('/api/cases/:id/customer-status-copy', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const customerStatus = buildCustomerStatusCopy(c);
  store.addEvent('case_customer_status_copy_viewed', { case_id: c.id, label: customerStatus.label }, req);
  res.json({ ok: true, case: publicCaseSummary(c), customer_status: customerStatus });
});

app.get('/api/cases/:id/form-completion-plan/:formNumber', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const sourceRecord = req.query.source_record_id ? store.find('official_form_sources', (src) => src.id === req.query.source_record_id && !src.deleted_at) : null;
  const officialForm = req.query.official_form_id ? store.find('official_forms', (form) => form.id === req.query.official_form_id && !form.deleted_at) : null;
  const answers = c.form_answers && c.form_answers[normalizeFormNumber(req.params.formNumber)] ? c.form_answers[normalizeFormNumber(req.params.formNumber)] : (c.form_answers || c.intake_answers || {});
  const plan = buildFormCompletionPlan({ formNumber: req.params.formNumber, answers, taxCase: c, sourceRecord, officialForm });
  store.addEvent('case_form_completion_plan_viewed', { case_id: c.id, form_number: normalizeFormNumber(req.params.formNumber), print_ready_draft_allowed: Boolean(plan.output_gate && plan.output_gate.print_ready_draft_allowed) }, req);
  res.status(plan.ok ? 200 : 404).json({ ok: plan.ok, version: APP_VERSION, case: publicCaseSummary(c), plan });
});

app.post('/api/cases/:id/form-completion-plan/:formNumber', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const body = req.body || {};
  const formNumber = normalizeFormNumber(req.params.formNumber);
  const currentAnswers = c.form_answers || {};
  const priorForForm = currentAnswers[formNumber] || {};
  const mergedAnswers = { ...priorForForm, ...(body.answers || body) };
  const updatedAnswers = { ...currentAnswers, [formNumber]: mergedAnswers };
  const sourceRecord = body.source_record_id ? store.find('official_form_sources', (src) => src.id === body.source_record_id && !src.deleted_at) : null;
  const officialForm = body.official_form_id ? store.find('official_forms', (form) => form.id === body.official_form_id && !form.deleted_at) : null;
  const plan = buildFormCompletionPlan({ formNumber, answers: mergedAnswers, taxCase: c, sourceRecord, officialForm });
  const updated = store.update('cases', c.id, { form_answers: updatedAnswers, [`form_completion_${formNumber.replace(/[^A-Z0-9]+/g, '_').toLowerCase()}`]: plan, form_completion_updated_at: new Date().toISOString() });
  store.addEvent('case_form_completion_plan_generated', { case_id: c.id, form_number: formNumber, missing_required_count: plan.interview_status ? plan.interview_status.missing_required_count : 0, print_ready_draft_allowed: Boolean(plan.output_gate && plan.output_gate.print_ready_draft_allowed) }, req);
  res.status(plan.ok ? 200 : 404).json({ ok: plan.ok, version: APP_VERSION, case: publicCaseSummary(updated || c), plan });
});


app.get('/api/tax/forms/9465/official-output-readiness', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, readiness: build9465OutputReadiness({ store }), source: IRS_9465_OFFICIAL_SOURCE, policy: IRS_9465_OUTPUT_POLICY });
});

app.get('/api/tax/forms/9465/field-map', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, field_map: build9465FieldMapReport() });
});

app.get('/api/tax/forms/9465/sample-cases', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, samples: build9465SampleCases() });
});

app.post('/api/tax/forms/9465/completion-plan', (req, res) => {
  const body = req.body || {};
  const sourceRecord = body.source_record_id ? store.find('official_form_sources', (src) => src.id === body.source_record_id && !src.deleted_at) : null;
  const officialForm = body.official_form_id ? store.find('official_forms', (form) => form.id === body.official_form_id && !form.deleted_at) : null;
  const plan = build9465CompletionPlan(body.answers || body, { sourceRecord, officialForm, clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
  store.addEvent('form_9465_completion_plan_generated', { missing_count: plan.validation.missing.length, error_count: plan.validation.errors.length, release_status: plan.output_gate.release_status }, req);
  res.status(plan.ok ? 200 : 400).json({ ok: plan.ok, version: APP_VERSION, plan });
});

app.post('/api/tax/forms/9465/sample-fill-audit', (req, res) => {
  const body = req.body || {};
  const audit = build9465SampleFillAudit(body.answers || body, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
  store.addEvent('form_9465_sample_fill_audit_generated', { print_ready: Boolean(audit.print_ready), qa_count: audit.qa.length }, req);
  res.json({ ok: true, version: APP_VERSION, audit });
});

app.post('/api/tax/forms/9465/verification-sheet', (req, res) => {
  const body = req.body || {};
  const sheet = build9465VerificationSheet(body.answers || body, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
  res.json({ ok: true, version: APP_VERSION, verification_sheet: sheet });
});

app.post('/api/tax/forms/9465/draft-pdf', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const buffer = await create9465DraftPdfBuffer(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
    store.addEvent('form_9465_draft_pdf_generated', { mode: 'sample_or_internal_draft', byte_length: buffer.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-draft-qa-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/verification-sheet', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const sheet = build9465VerificationSheet(answers, {});
  store.addEvent('case_9465_verification_sheet_viewed', { case_id: c.id, release_status: sheet.release_status }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), verification_sheet: sheet });
});

app.post('/api/cases/:id/forms/9465/draft-pdf', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const body = req.body || {};
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...(body.answers || {}) };
    const plan = build9465CompletionPlan(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
    if (!plan.output_gate.sample_or_internal_draft_allowed) return res.status(400).json({ ok: false, error: '9465 draft package is blocked until validation errors are resolved.', plan });
    const buffer = await create9465DraftPdfBuffer(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
    store.addEvent('case_9465_draft_pdf_generated', { case_id: c.id, release_status: plan.output_gate.release_status, byte_length: buffer.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-draft-qa-packet.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post('/api/staff/forms/9465/qa-status', requireStaff, (req, res) => {
  const record = record9465QaStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_qa_status_recorded', { status: record.status, client_output_allowed: Boolean(record.client_output_allowed), staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, qa_status: record, readiness: build9465OutputReadiness({ store }) });
});

app.get('/api/tax/forms/9465/pdf-capture-readiness', (req, res) => {
  const readiness = build9465PdfCaptureReadiness(store);
  res.json({ ok: true, version: APP_VERSION, readiness, profile: IRS_9465_CAPTURE_PROFILE, policy: IRS_9465_VISUAL_QA_POLICY });
});

app.get('/api/tax/forms/9465/visual-field-qa-plan', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, visual_qa_plan: build9465VisualFieldQaPlan() });
});

app.post('/api/admin/forms/9465/seed-official-source', adminGuard, (req, res) => {
  const result = ensure9465OfficialSource(store, { id: 'admin-token' });
  store.addEvent('form_9465_official_source_seeded', { created: Boolean(result.created), source_id: result.source && result.source.id }, req);
  res.json({ ok: true, version: APP_VERSION, ...result, capture_readiness: build9465PdfCaptureReadiness(store) });
});

app.get('/api/staff/forms/9465/captured-pdf-inspection', requireStaff, (req, res) => {
  const inspection = inspectCaptured9465Pdf(store);
  store.addEvent('form_9465_captured_pdf_inspected', { status: inspection.status, ok: Boolean(inspection.ok) }, req);
  res.json({ ok: true, version: APP_VERSION, inspection, readiness: build9465PdfCaptureReadiness(store) });
});

app.post('/api/tax/forms/9465/visual-sample-qa', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const plan = build9465CompletionPlan(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
  const qa = build9465VisualSampleQa(answers, plan);
  store.addEvent('form_9465_visual_sample_qa_generated', { checks: qa.checks.length, final_client_output_ready: Boolean(qa.final_client_output_ready) }, req);
  res.json({ ok: true, version: APP_VERSION, completion_plan: plan, visual_sample_qa: qa });
});

app.post('/api/tax/forms/9465/visual-qa-packet', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const plan = build9465CompletionPlan(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
    const readiness = build9465PdfCaptureReadiness(store);
    const visualPlan = build9465VisualFieldQaPlan();
    const sampleQa = build9465VisualSampleQa(answers, plan);
    const buffer = await create9465VisualQaPacketBuffer({ readiness, visualPlan, sampleQa });
    store.addEvent('form_9465_visual_qa_packet_generated', { byte_length: buffer.length, release_status: plan.output_gate.release_status }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-visual-qa-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get('/api/staff/forms/9465/visual-qa-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465VisualQaBoard(store), readiness: build9465PdfCaptureReadiness(store) });
});

app.post('/api/staff/forms/9465/visual-qa-status', requireStaff, (req, res) => {
  const record = record9465VisualQaStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_visual_qa_status_recorded', { status: record.status, zone_key: record.zone_key, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, qa_status: record, board: build9465VisualQaBoard(store), readiness: build9465PdfCaptureReadiness(store) });
});

app.get('/api/tax/forms/9465/fill-engine-readiness', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, readiness: build9465FillEngineReadiness(store), policy: FORM_9465_FILL_ENGINE_POLICY, release_gates: FORM_9465_RELEASE_GATES });
});

app.get('/api/tax/forms/9465/overlay-template', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, overlay_template: build9465OverlayTemplate() });
});

app.post('/api/tax/forms/9465/fill-plan', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const fillPlan = build9465FillPlan(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
  store.addEvent('form_9465_fill_plan_generated', { fillable_in_sample: fillPlan.output_counts.fillable_in_sample, blocked: fillPlan.output_counts.blocked, final_output_allowed: false }, req);
  res.status(fillPlan.completion_plan && fillPlan.completion_plan.ok ? 200 : 400).json({ ok: Boolean(fillPlan.completion_plan && fillPlan.completion_plan.ok), version: APP_VERSION, fill_plan: fillPlan });
});

app.post('/api/tax/forms/9465/sample-filled-overlay-pdf', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const fillPlan = build9465FillPlan(answers, { clientVerified: body.client_verified === true || body.client_verified === 'true', professionalReleased: body.professional_released === true || body.professional_released === 'true' });
    const buffer = await create9465SampleFilledOverlayPdfBuffer({ answers, fillPlan });
    const record = record9465FillEngineStatus(store, { status: 'sample_overlay_generated', sample_case_key: body.sample_case_key || 'ad_hoc', notes: 'Internal Form 9465 sample overlay QA PDF generated. Not client final output.' }, { id: 'system' });
    store.addEvent('form_9465_sample_filled_overlay_pdf_generated', { byte_length: buffer.length, fillable_in_sample: fillPlan.output_counts.fillable_in_sample, qa_event_id: record.id }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-sample-filled-overlay-qa.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/fill-plan', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const fillPlan = build9465FillPlan(answers, {});
  store.addEvent('case_9465_fill_plan_viewed', { case_id: c.id, fillable_in_sample: fillPlan.output_counts.fillable_in_sample, final_output_allowed: false }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), fill_plan: fillPlan });
});

app.post('/api/cases/:id/forms/9465/sample-filled-overlay-pdf', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const body = req.body || {};
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...(body.answers || {}) };
    const fillPlan = build9465FillPlan(answers, {});
    if (!fillPlan.output_gate.internal_sample_overlay_allowed) return res.status(400).json({ ok: false, error: '9465 sample overlay is blocked until validation errors are resolved.', fill_plan: fillPlan });
    const buffer = await create9465SampleFilledOverlayPdfBuffer({ answers, fillPlan });
    const record = record9465FillEngineStatus(store, { status: 'sample_overlay_generated', sample_case_key: c.id, notes: 'Case-level internal Form 9465 sample overlay QA PDF generated. Not client final output.' }, req.user || {});
    store.addEvent('case_9465_sample_filled_overlay_pdf_generated', { case_id: c.id, byte_length: buffer.length, qa_event_id: record.id }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-sample-filled-overlay-qa.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get('/api/staff/forms/9465/fill-engine-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465FillEngineBoard(store), readiness: build9465FillEngineReadiness(store) });
});

app.post('/api/staff/forms/9465/fill-engine-status', requireStaff, (req, res) => {
  const record = record9465FillEngineStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_fill_engine_status_recorded', { status: record.status, zone_key: record.zone_key, client_output_allowed: false, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, qa_status: record, board: build9465FillEngineBoard(store), readiness: build9465FillEngineReadiness(store) });
});

app.get('/api/tax/forms/9465/capture-upload-fallback-plan', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, plan: build9465CaptureUploadFallbackPlan(store), policy: FORM_9465_CAPTURE_UPLOAD_FALLBACK_POLICY });
});

app.get('/api/tax/forms/9465/coordinate-lock-checklist', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, checklist: build9465CoordinateLockChecklist(store) });
});

app.get('/api/tax/forms/9465/final-output-gate-report', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, report: build9465FinalOutputGateReport(store) });
});

app.post('/api/admin/forms/9465/upload-official-pdf', adminGuard, upload.single('pdf'), (req, res) => {
  try {
    const result = upload9465OfficialPdfFallback(store, req.file || {}, req.body || {}, { id: 'admin-token', role: 'admin' }, captureOfficialPdfBuffer);
    store.addEvent('form_9465_official_pdf_upload_fallback', { ok: Boolean(result.ok), status: result.status, sha256: result.validation ? result.validation.sha256 : '', official_form_id: result.official_form ? result.official_form.id : '' }, req);
    res.status(result.ok ? 200 : 400).json({ ...result, version: APP_VERSION });
  } catch (error) {
    store.addEvent('form_9465_official_pdf_upload_fallback_error', { message: error.message }, req);
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/staff/forms/9465/coordinate-lock-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465CoordinateLockBoard(store), final_output_gate: build9465FinalOutputGateReport(store) });
});

app.post('/api/staff/forms/9465/coordinate-lock-status', requireStaff, (req, res) => {
  const record = record9465CoordinateLockStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_coordinate_lock_status_recorded', { status: record.status, page: record.page, zone_key: record.zone_key, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, coordinate_lock_status: record, board: build9465CoordinateLockBoard(store), final_output_gate: build9465FinalOutputGateReport(store) });
});

app.get('/api/staff/forms/9465/coordinate-lock-packet', requireStaff, async (req, res) => {
  try {
    const buffer = await create9465CoordinateLockPacketPdfBuffer(store);
    store.addEvent('form_9465_coordinate_lock_packet_generated', { byte_length: buffer.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-coordinate-lock-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/tax/forms/9465/official-sample-output-readiness', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, readiness: build9465OfficialSampleOutputReadiness(store), policy: FORM_9465_OFFICIAL_SAMPLE_OUTPUT_POLICY });
});

app.get('/api/tax/forms/9465/visual-overlay-comparison-plan', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, comparison_plan: build9465VisualOverlayComparisonPlan(store) });
});

app.post('/api/tax/forms/9465/official-sample-output-preview', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const preview = build9465OfficialSampleOutputPreview(answers, store);
  store.addEvent('form_9465_official_sample_preview_generated', { fill_plan_ok: Boolean(preview.fill_plan_ok), populated_page_1: preview.page_populated_counts.page_1, populated_page_2: preview.page_populated_counts.page_2, client_output_allowed: false }, req);
  res.status(preview.fill_plan_ok ? 200 : 400).json({ ok: Boolean(preview.fill_plan_ok), version: APP_VERSION, preview });
});

app.post('/api/tax/forms/9465/official-sample-output-packet', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const buffer = await create9465OfficialSampleOutputPacketPdfBuffer({ answers, store, sampleCaseKey: body.sample_case_key || 'ad_hoc' });
    const record = record9465OfficialSampleQaStatus(store, { status: 'comparison_packet_generated', sample_case_key: body.sample_case_key || 'ad_hoc', notes: 'Internal IRS Form 9465 official-sample visual comparison packet generated. Not client final output.' }, { id: 'system' });
    store.addEvent('form_9465_official_sample_output_packet_generated', { byte_length: buffer.length, qa_event_id: record.id, client_output_allowed: false }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-official-sample-comparison-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/official-sample-output-preview', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const preview = build9465OfficialSampleOutputPreview(answers, store);
  store.addEvent('case_9465_official_sample_preview_viewed', { case_id: c.id, fill_plan_ok: Boolean(preview.fill_plan_ok), client_output_allowed: false }, req);
  res.status(preview.fill_plan_ok ? 200 : 400).json({ ok: Boolean(preview.fill_plan_ok), version: APP_VERSION, case: publicCaseSummary(c), preview });
});

app.post('/api/cases/:id/forms/9465/official-sample-output-packet', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const body = req.body || {};
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...(body.answers || {}) };
    const preview = build9465OfficialSampleOutputPreview(answers, store);
    if (!preview.output_gate.internal_comparison_packet_allowed) return res.status(400).json({ ok: false, error: '9465 official-sample comparison packet is blocked until validation errors are resolved.', preview });
    const buffer = await create9465OfficialSampleOutputPacketPdfBuffer({ answers, store, sampleCaseKey: c.id });
    const record = record9465OfficialSampleQaStatus(store, { status: 'comparison_packet_generated', sample_case_key: c.id, notes: 'Case-level internal IRS Form 9465 official-sample visual comparison packet generated. Not client final output.' }, req.user || {});
    store.addEvent('case_9465_official_sample_output_packet_generated', { case_id: c.id, byte_length: buffer.length, qa_event_id: record.id, client_output_allowed: false }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-official-sample-comparison-packet.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/staff/forms/9465/official-sample-qa-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465OfficialSampleQaBoard(store), readiness: build9465OfficialSampleOutputReadiness(store) });
});

app.post('/api/staff/forms/9465/official-sample-qa-status', requireStaff, (req, res) => {
  const record = record9465OfficialSampleQaStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_official_sample_qa_status_recorded', { status: record.status, page: record.page, zone_key: record.zone_key, client_output_allowed: false, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, official_sample_status: record, board: build9465OfficialSampleQaBoard(store), readiness: build9465OfficialSampleOutputReadiness(store) });
});


app.get('/api/tax/forms/9465/client-release-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, policy: FORM_9465_CLIENT_RELEASE_POLICY });
});

app.post('/api/tax/forms/9465/client-verification-checklist', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const checklist = build9465ClientVerificationChecklist(answers, store, {});
  store.addEvent('form_9465_client_verification_checklist_generated', { status: checklist.status, missing: checklist.required_missing.length, client_output_allowed: false }, req);
  res.status(checklist.status === 'client_verification_incomplete' ? 400 : 200).json({ ok: checklist.status !== 'client_verification_incomplete', version: APP_VERSION, checklist });
});

app.post('/api/tax/forms/9465/print-signature-draft-readiness', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const readiness = build9465PrintSignatureDraftReadiness(store, {}, answers);
  store.addEvent('form_9465_print_signature_draft_readiness_generated', { print_signature_draft_allowed: readiness.print_signature_draft_allowed, final_client_irs_output_allowed: false, blockers: readiness.blockers.length }, req);
  res.json({ ok: true, version: APP_VERSION, readiness });
});

app.post('/api/tax/forms/9465/print-signature-draft-packet', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const readiness = build9465PrintSignatureDraftReadiness(store, {}, answers);
    const buffer = await create9465PrintSignatureDraftPacketPdfBuffer({ answers, store, taxCase: {}, actor: { id: 'system' } });
    store.addEvent('form_9465_print_signature_draft_packet_generated', { byte_length: buffer.length, print_signature_draft_allowed: readiness.print_signature_draft_allowed, final_client_irs_output_allowed: false }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-print-signature-draft-release-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/client-verification', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const checklist = build9465ClientVerificationChecklist(answers, store, { caseId: c.id });
  store.addEvent('case_9465_client_verification_viewed', { case_id: c.id, status: checklist.status, missing: checklist.required_missing.length }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), checklist });
});

app.post('/api/cases/:id/forms/9465/client-verification', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const body = req.body || {};
  const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const answers = { ...currentAnswers, ...(body.answers || {}) };
  const result = create9465ClientVerificationRecord(store, c, answers, body, req.user || {});
  store.addEvent('case_9465_client_verification_recorded', { case_id: c.id, status: result.record.status, client_attested: result.record.client_attested, missing: result.record.unchecked_required_items.length }, req);
  res.status(result.record.status === 'client_values_need_correction' ? 409 : 200).json({ ok: result.record.status !== 'client_values_need_correction', version: APP_VERSION, verification: result.record, checklist: result.checklist, case: store.find('cases', (item) => item.id === c.id) || c });
});

app.get('/api/cases/:id/forms/9465/professional-release-gate', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const gate = build9465ProfessionalReleaseGate(store, c, answers);
  store.addEvent('case_9465_professional_release_gate_viewed', { case_id: c.id, print_signature_draft_allowed: gate.print_signature_draft_allowed, blockers: gate.blockers.length }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), gate });
});

app.get('/api/cases/:id/forms/9465/print-signature-draft-readiness', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const readiness = build9465PrintSignatureDraftReadiness(store, c, answers);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), readiness });
});

app.post('/api/cases/:id/forms/9465/print-signature-draft-packet', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const body = req.body || {};
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...(body.answers || {}) };
    const readiness = build9465PrintSignatureDraftReadiness(store, c, answers);
    if (!readiness.print_signature_draft_allowed && body.override_print_signature_gate !== true && !isStaff(req.user)) {
      return res.status(409).json({ ok: false, version: APP_VERSION, error: 'Print/signature draft packet is blocked until client verification and professional release gates are satisfied.', readiness });
    }
    const buffer = await create9465PrintSignatureDraftPacketPdfBuffer({ answers, store, taxCase: c, actor: req.user || {} });
    store.addEvent('case_9465_print_signature_draft_packet_generated', { case_id: c.id, byte_length: buffer.length, print_signature_draft_allowed: readiness.print_signature_draft_allowed, final_client_irs_output_allowed: false }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-print-signature-draft-release-packet.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/staff/forms/9465/release-gate-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465ReleaseGateBoard(store) });
});

app.post('/api/staff/forms/9465/release-gate-status', requireStaff, (req, res) => {
  const payload = req.body || {};
  const c = payload.case_id ? store.find('cases', (item) => item.id === payload.case_id && !item.deleted_at) : {};
  const record = record9465ProfessionalReleaseStatus(store, c || {}, payload, req.staff || req.user || {});
  store.addEvent('form_9465_release_gate_status_recorded', { case_id: record.case_id, status: record.status, print_signature_draft_allowed: record.print_signature_draft_allowed, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, release_status: record, board: build9465ReleaseGateBoard(store) });
});

app.post('/api/staff/cases/:id/forms/9465/professional-release', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const record = record9465ProfessionalReleaseStatus(store, c, { ...(req.body || {}), status: (req.body || {}).status || 'professional_released_for_print_signature_draft' }, req.staff || req.user || {});
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const gate = build9465ProfessionalReleaseGate(store, store.find('cases', (item) => item.id === c.id) || c, answers);
  store.addEvent('case_9465_professional_release_recorded', { case_id: c.id, status: record.status, print_signature_draft_allowed: record.print_signature_draft_allowed }, req);
  res.json({ ok: true, version: APP_VERSION, release_status: record, gate, case: store.find('cases', (item) => item.id === c.id) || c });
});




app.get('/api/tax/forms/9465/operational-qa-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, policy: FORM_9465_OPERATIONAL_QA_POLICY });
});

app.get('/api/tax/forms/9465/operational-capture-test', (req, res) => {
  const test = build9465OperationalCaptureTest(store);
  store.addEvent('form_9465_operational_capture_test_viewed', { status: test.status, passed: test.passed, required_checks: test.required_checks }, req);
  res.json({ ok: true, version: APP_VERSION, test });
});

app.get('/api/tax/forms/9465/true-coordinate-qa-workflow', (req, res) => {
  const workflow = build9465TrueCoordinateQaWorkflow(store);
  store.addEvent('form_9465_true_coordinate_qa_workflow_viewed', { status: workflow.status, passed: workflow.passed, required_checks: workflow.required_checks }, req);
  res.json({ ok: true, version: APP_VERSION, workflow });
});

app.get('/api/tax/forms/9465/final-release-readiness-from-operational-qa', (req, res) => {
  const readiness = build9465FinalReleaseReadinessFromOperationalQa(store, {}, {});
  store.addEvent('form_9465_final_release_readiness_from_operational_qa_viewed', { status: readiness.status, client_output_allowed: readiness.client_output_allowed, blocker_count: readiness.blockers.length }, req);
  res.json({ ok: true, version: APP_VERSION, readiness });
});

app.post('/api/tax/forms/9465/operational-qa-packet', async (req, res) => {
  try {
    const answers = (req.body || {}).answers || req.body || {};
    const buffer = await create9465OperationalQaPacketPdfBuffer({ store, answers, taxCase: {}, actor: { id: 'system' } });
    store.addEvent('form_9465_operational_qa_packet_generated', { byte_length: buffer.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-operational-qa-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/final-release-readiness-from-operational-qa', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const readiness = build9465FinalReleaseReadinessFromOperationalQa(store, c, answers);
  store.addEvent('case_9465_final_release_readiness_from_operational_qa_viewed', { case_id: c.id, status: readiness.status, client_output_allowed: readiness.client_output_allowed, blocker_count: readiness.blockers.length }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), readiness });
});

app.post('/api/cases/:id/forms/9465/operational-qa-packet', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...((req.body || {}).answers || {}) };
    const buffer = await create9465OperationalQaPacketPdfBuffer({ store, answers, taxCase: c, actor: req.user || {} });
    store.addEvent('case_9465_operational_qa_packet_generated', { case_id: c.id, byte_length: buffer.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-operational-qa-packet.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/staff/forms/9465/operational-qa-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465OperationalQaBoard(store) });
});

app.post('/api/staff/forms/9465/true-coordinate-qa-status', requireStaff, (req, res) => {
  const record = record9465TrueCoordinateQaStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_true_coordinate_qa_status_recorded', { status: record.status, page: record.page, comparison_summary: record.comparison_summary, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, qa_status: record, board: build9465OperationalQaBoard(store) });
});


app.get('/api/tax/forms/9465/capture-completion-readiness', (req, res) => {
  const readiness = build9465CaptureCompletionReadiness(store);
  store.addEvent('form_9465_capture_completion_readiness_viewed', { status: readiness.status, actual_gate_passed: readiness.actual_gate_passed, client_final_output_allowed: readiness.client_final_output_allowed }, req);
  res.json({ ok: true, version: APP_VERSION, readiness, policy: FORM_9465_CAPTURE_COMPLETION_POLICY });
});

app.get('/api/tax/forms/9465/coordinate-lock-simulation-plan', (req, res) => {
  const plan = build9465CoordinateLockSimulationPlan(store);
  store.addEvent('form_9465_coordinate_lock_simulation_plan_viewed', { status: plan.status, staff_simulation_approved: plan.simulation_summary.staff_simulation_approved }, req);
  res.json({ ok: true, version: APP_VERSION, simulation_plan: plan });
});

app.post('/api/tax/forms/9465/staff-approval-gate-report', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const report = build9465StaffApprovalGateReport(store, {}, answers);
  store.addEvent('form_9465_staff_approval_gate_report_generated', { passed: report.passed, required_checks: report.required_checks, client_output_allowed: report.client_output_allowed }, req);
  res.json({ ok: true, version: APP_VERSION, report });
});

app.post('/api/tax/forms/9465/capture-completion-packet', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const buffer = await create9465CaptureCompletionPacketPdfBuffer({ store, answers, taxCase: {}, actor: { id: 'system' } });
    store.addEvent('form_9465_capture_completion_packet_generated', { byte_length: buffer.length, client_output_allowed: false }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-capture-completion-coordinate-simulation-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/capture-completion-readiness', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const readiness = build9465CaptureCompletionReadiness(store);
  store.addEvent('case_9465_capture_completion_readiness_viewed', { case_id: c.id, status: readiness.status, actual_gate_passed: readiness.actual_gate_passed }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), readiness });
});

app.post('/api/cases/:id/forms/9465/staff-approval-gate-report', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const answers = { ...currentAnswers, ...(((req.body || {}).answers) || {}) };
  const report = build9465StaffApprovalGateReport(store, c, answers);
  store.addEvent('case_9465_staff_approval_gate_report_generated', { case_id: c.id, passed: report.passed, required_checks: report.required_checks, client_output_allowed: report.client_output_allowed }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), report });
});

app.post('/api/cases/:id/forms/9465/capture-completion-packet', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...(((req.body || {}).answers) || {}) };
    const buffer = await create9465CaptureCompletionPacketPdfBuffer({ store, taxCase: c, answers, actor: req.user || {} });
    store.addEvent('case_9465_capture_completion_packet_generated', { case_id: c.id, byte_length: buffer.length, client_output_allowed: false }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-capture-completion-coordinate-simulation-packet.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/staff/forms/9465/capture-completion-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465CaptureCompletionBoard(store) });
});

app.post('/api/staff/forms/9465/capture-completion-status', requireStaff, (req, res) => {
  const record = record9465CaptureCompletionStatus(store, req.body || {}, req.staff || req.user || {});
  store.addEvent('form_9465_capture_completion_status_recorded', { status: record.status, simulation_only: record.simulation_only, page: record.page, staff_id: req.staff ? req.staff.id : (req.user ? req.user.id : '') }, req);
  res.json({ ok: true, version: APP_VERSION, status_record: record, board: build9465CaptureCompletionBoard(store) });
});

app.post('/api/staff/forms/9465/staff-approval-gate-status', requireStaff, (req, res) => {
  const body = req.body || {};
  const status = body.status || (body.simulation_only ? 'simulation_staff_approved' : 'actual_coordinate_lock_staff_approved');
  const record = record9465CaptureCompletionStatus(store, { ...body, status }, req.staff || req.user || {});
  const report = build9465StaffApprovalGateReport(store, {}, {});
  store.addEvent('form_9465_staff_approval_gate_status_recorded', { status: record.status, simulation_only: record.simulation_only, client_output_allowed: false }, req);
  res.json({ ok: true, version: APP_VERSION, status_record: record, report, board: build9465CaptureCompletionBoard(store) });
});

app.get('/api/tax/forms/9465/final-release-policy', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, policy: FORM_9465_FINAL_RELEASE_POLICY });
});

app.post('/api/tax/forms/9465/final-output-gate-audit', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const audit = build9465FinalOutputGateAudit(store, {}, answers);
  store.addEvent('form_9465_final_output_gate_audit_generated', { passed: audit.passed, required_gates: audit.required_gates, final_client_irs_output_allowed: audit.final_client_irs_output_allowed, blocker_count: audit.blockers.length }, req);
  res.json({ ok: true, version: APP_VERSION, audit });
});

app.post('/api/tax/forms/9465/client-ready-draft-path', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  const pathReport = build9465ClientReadyDraftPath(store, {}, answers);
  store.addEvent('form_9465_client_ready_draft_path_generated', { status: pathReport.status, final_client_irs_output_allowed: pathReport.audit_summary.final_client_irs_output_allowed, blocker_count: pathReport.audit_summary.blocker_count }, req);
  res.json({ ok: true, version: APP_VERSION, draft_path: pathReport });
});

app.post('/api/tax/forms/9465/client-ready-draft-packet', async (req, res) => {
  try {
    const body = req.body || {};
    const answers = body.answers || body;
    const audit = build9465FinalOutputGateAudit(store, {}, answers);
    const buffer = await create9465ClientReadyDraftPacketPdfBuffer({ answers, store, taxCase: {}, actor: { id: 'system' }, mode: 'ad_hoc_audit_packet' });
    store.addEvent('form_9465_client_ready_draft_packet_generated', { byte_length: buffer.length, final_client_irs_output_allowed: audit.final_client_irs_output_allowed, blocker_count: audit.blockers.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="justice-tax-solutions-irs-9465-final-output-gate-audit-packet.pdf"');
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/cases/:id/forms/9465/final-output-gate-audit', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const audit = build9465FinalOutputGateAudit(store, c, answers);
  store.addEvent('case_9465_final_output_gate_audit_viewed', { case_id: c.id, passed: audit.passed, required_gates: audit.required_gates, final_client_irs_output_allowed: audit.final_client_irs_output_allowed, blocker_count: audit.blockers.length }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), audit });
});

app.get('/api/cases/:id/forms/9465/client-ready-draft-path', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const answers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
  const pathReport = build9465ClientReadyDraftPath(store, c, answers);
  store.addEvent('case_9465_client_ready_draft_path_viewed', { case_id: c.id, status: pathReport.status, final_client_irs_output_allowed: pathReport.audit_summary.final_client_irs_output_allowed, blocker_count: pathReport.audit_summary.blocker_count }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), draft_path: pathReport });
});

app.post('/api/cases/:id/forms/9465/client-ready-draft-packet', requireUser, async (req, res) => {
  try {
    const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
    if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
    const body = req.body || {};
    const currentAnswers = c.form_answers && c.form_answers['9465'] ? c.form_answers['9465'] : (c.form_answers || c.intake_answers || {});
    const answers = { ...currentAnswers, ...(body.answers || {}) };
    const audit = build9465FinalOutputGateAudit(store, c, answers);
    if (!audit.final_client_irs_output_allowed && body.override_final_output_gate !== true && !isStaff(req.user)) {
      return res.status(409).json({ ok: false, version: APP_VERSION, error: 'Client-ready IRS Form 9465 draft is blocked until final output gates pass. Staff may generate audit packets only.', audit });
    }
    const buffer = await create9465ClientReadyDraftPacketPdfBuffer({ answers, store, taxCase: c, actor: req.user || {}, mode: audit.final_client_irs_output_allowed ? 'client_ready_draft_release' : 'staff_audit_packet' });
    store.addEvent('case_9465_client_ready_draft_packet_generated', { case_id: c.id, byte_length: buffer.length, final_client_irs_output_allowed: audit.final_client_irs_output_allowed, blocker_count: audit.blockers.length }, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '')}-irs-9465-final-output-gate-audit-packet.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ ok: false, version: APP_VERSION, error: error.message });
  }
});

app.get('/api/staff/forms/9465/final-release-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: build9465FinalReleaseBoard(store) });
});

app.post('/api/staff/forms/9465/final-release-audit-status', requireStaff, (req, res) => {
  const payload = req.body || {};
  const c = payload.case_id ? store.find('cases', (item) => item.id === payload.case_id && !item.deleted_at) : {};
  const result = record9465FinalReleaseAuditStatus(store, c || {}, payload, req.staff || req.user || {});
  store.addEvent('form_9465_final_release_audit_status_recorded', { case_id: result.record.case_id, status: result.record.status, final_client_irs_output_allowed: result.record.final_client_irs_output_allowed, blocker_count: (result.record.blockers || []).length }, req);
  res.json({ ok: true, version: APP_VERSION, final_release_status: result.record, audit: result.audit, board: build9465FinalReleaseBoard(store) });
});

app.post('/api/cases/:id/client-checklist/:itemId/status', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const status = ['open','working','uploaded','answered','not_applicable','complete'].includes(String((req.body || {}).status || '')) ? String(req.body.status) : 'complete';
  const event = store.insert('client_checklist_events', { id: `chk_${uuidv4()}`, case_id: c.id, item_id: safeDisplay(req.params.itemId, 120), status, note: safeDisplay((req.body || {}).note || '', 800), actor_user_id: req.user.id, actor_role: req.user.role || 'client' });
  store.addEvent('client_checklist_status_updated', { case_id: c.id, item_id: event.item_id, status, actor_role: event.actor_role }, req);
  res.json({ ok: true, event });
});

app.post('/api/cases/:id/messages', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const body = safeDisplay((req.body || {}).body || '', 2000);
  if (!body) return res.status(400).json({ ok: false, error: 'Message body is required.' });
  const message = store.insert('messages', { id: `msg_${uuidv4()}`, case_id: c.id, user_id: req.user.id, author_email: req.user.email, author_role: req.user.role || 'client', body, visibility: isStaff(req.user) ? safeDisplay((req.body || {}).visibility || 'staff_and_client', 60) : 'staff_and_client', status: 'open' });
  store.addEvent('case_message_created', { case_id: c.id, message_id: message.id, author_role: message.author_role }, req);
  res.json({ ok: true, message });
});

app.get('/api/cases/:id/field-fill-plan', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const plan = buildFieldFillPlan(c, c.documents || []);
  const binder = workpaperBinderForCase(c, c.documents || []);
  const updated = store.update('cases', c.id, { field_fill_plan: plan, document_binder: binder, document_readiness_score: plan.readiness_score });
  store.addEvent('field_fill_plan_generated', { case_id: c.id, readiness_score: plan.readiness_score, targets: plan.field_targets.length }, req);
  res.json({ ok: true, case: publicCaseSummary(updated), field_fill_plan: plan, document_binder: binder });
});

app.post('/api/cases/:id/done-uploading', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const plan = buildFieldFillPlan(c, c.documents || []);
  const updated = store.update('cases', c.id, { client_done_uploading: true, client_done_uploading_at: new Date().toISOString(), field_fill_plan: plan, document_readiness_score: plan.readiness_score, status: c.status === 'started' ? 'client_done_uploading_ready_for_triage' : c.status });
  store.addEvent('client_done_uploading', { case_id: c.id, readiness_score: plan.readiness_score, missing_document_types: plan.missing_document_types }, req);
  res.json({ ok: true, case: publicCaseSummary(updated), field_fill_plan: plan, message: plan.missing_document_types.length ? 'We recorded that you are done uploading for now. The checklist still shows possible missing items for staff/professional review.' : 'We recorded that you are done uploading. Staff can begin review.' });
});

app.post('/api/cases/:id/field/:targetIndex/verify', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const plan = c.field_fill_plan || buildFieldFillPlan(c, c.documents || []);
  const idx = Number(req.params.targetIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= plan.field_targets.length) return res.status(400).json({ ok: false, error: 'Unknown field target.' });
  const status = ['needs_verification','client_confirmed','verified','rejected','professional_override'].includes(String((req.body || {}).status || '')) ? String(req.body.status) : 'client_confirmed';
  plan.field_targets[idx] = { ...plan.field_targets[idx], status, value_summary: safeDisplay((req.body || {}).value_summary || '', 300), verified_by: req.user.id, verified_role: req.user.role || 'client', verified_at: new Date().toISOString(), note: safeDisplay((req.body || {}).note || '', 1000) };
  const updated = store.update('cases', c.id, { field_fill_plan: plan });
  store.addEvent('field_target_status_updated', { case_id: c.id, target_index: idx, status }, req);
  res.json({ ok: true, case: publicCaseSummary(updated), field_fill_plan: plan });
});

app.post('/api/cases/:id/submit-review', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const clientReadiness = buildCaseClientReadiness(c);
  if (!clientReadiness.ready_for_paid_review_request) return res.status(409).json({ ok: false, error: 'Please resolve required acknowledgments/contact blockers before submitting for review.', client_readiness: clientReadiness });
  const reviewPlan = buildReviewPlan(c);
  const reviewRequest = store.insert('review_requests', {
    id: `rev_${uuidv4()}`,
    case_id: c.id,
    user_id: req.user.id,
    requested_by_email: req.user.email,
    status: reviewPlan.reviewStatusSuggestion,
    recommended_product: reviewPlan.recommendedProduct,
    tier_key: reviewPlan.tier.key,
    tier_label: reviewPlan.tier.label,
    readiness_score: reviewPlan.readinessScore,
    client_consent: Boolean((req.body || {}).client_consent),
    consent_text: safeDisplay((req.body || {}).consent_text || reviewPlan.clientConsentSummary, 1200)
  });
  const updated = store.update('cases', c.id, { status: 'submitted_for_human_tax_review', submitted_at: new Date().toISOString(), review_plan: reviewPlan, review_request_id: reviewRequest.id, review_recommended_product: reviewPlan.recommendedProduct, review_readiness_score: reviewPlan.readinessScore });
  store.addEvent('case_submitted_for_review', { case_id: c.id, risk_level: c.risk_level, review_request_id: reviewRequest.id, tier: reviewPlan.tier.key }, req);
  res.json({ ok: true, case: publicCaseSummary(updated), review_request: reviewRequest, review_plan: reviewPlan });
});

app.get('/api/cases/:id/review-plan', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const reviewPlan = buildReviewPlan(c);
  res.json({ ok: true, case: publicCaseSummary({ ...c, review_plan: reviewPlan }), review_plan: reviewPlan, review_requests: store.list('review_requests', (r) => r.case_id === c.id && !r.deleted_at) });
});

app.post('/api/cases/:id/request-paid-review', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const clientReadiness = buildCaseClientReadiness(c);
  if (!clientReadiness.ready_for_paid_review_request) return res.status(409).json({ ok: false, error: 'Please resolve required acknowledgments/contact blockers before requesting paid review.', client_readiness: clientReadiness });
  const reviewPlan = buildReviewPlan(c);
  const product = safeDisplay((req.body || {}).product_type || reviewPlan.recommendedProduct || c.selected_tier || 'tax_notice_action_plan', 80);
  const tier = pricingTierForProduct(product);
  if (!tier) return res.status(400).json({ ok: false, error: 'Unknown product tier.' });
  const payment = store.insert('payments', { id: `payreq_${uuidv4()}`, case_id: c.id, email: c.email || req.user.email, product_type: product, amount_total_cents: tier.publicPriceCents, status: 'requested_not_paid', referral_code: c.referral_code || '', checkout_note: 'Stripe checkout/webhook support exists but is not configured. Staff can record a test payment only for development.' });
  const updated = store.update('cases', c.id, { selected_tier: product, payment_status: 'requested_not_paid', payment_request_id: payment.id, status: 'payment_requested_for_review', review_plan: reviewPlan });
  store.addEvent('case_paid_review_requested', { case_id: c.id, product_type: product, amount_total_cents: tier.publicPriceCents }, req);
  res.json({ ok: true, case: publicCaseSummary(updated), payment_request: payment, review_plan: reviewPlan });
});


app.get('/api/cases/:id/payment-summary', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), payment_summary: buildCasePaymentSummary(store, c.id) });
});

app.get('/api/cases/:id/quotes', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), quotes: store.list('quotes', (q) => q.case_id === c.id && !q.deleted_at), payment_summary: buildCasePaymentSummary(store, c.id) });
});

app.post('/api/cases/:id/quote-request', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const product = safeDisplay((req.body || {}).product_type || c.selected_tier || c.review_recommended_product || 'tax_notice_action_plan', 80);
  const tier = pricingTierForProduct(product);
  const quote = createQuoteRecord(store, { caseData: c, user: req.user, body: { ...(req.body || {}), product_type: product, status: 'draft', requires_custom_quote: true, quote_note: safeDisplay((req.body || {}).quote_note || 'Customer requested a quote/upgrade before paid work begins.', 1200) }, tier, createdBy: req.user });
  const updated = store.update('cases', c.id, { quote_status: 'requested', quote_request_id: quote.id, status: c.status === 'started' ? 'quote_requested' : c.status }) || c;
  store.addEvent('customer_quote_requested', { case_id: c.id, quote_id: quote.id, product_type: product }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(updated), quote, workflow: buildPaymentQuoteEmailWorkflow({ stripeConfigured: Boolean(stripe), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) }) });
});

app.post('/api/cases/:id/quotes/:quoteId/customer-approval', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const quote = store.find('quotes', (q) => q.id === req.params.quoteId && q.case_id === c.id && !q.deleted_at);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found.' });
  const approved = approveQuote(store, quote.id, req.user, req.body || {});
  if (!approved) return res.status(404).json({ ok: false, error: 'Quote not found or not authorized.' });
  const updated = store.update('cases', c.id, { quote_status: approved.status, selected_tier: approved.product_type || c.selected_tier || '', quoted_amount_cents: approved.amount_total_cents, status: approved.status === 'customer_approved' ? 'quote_approved_payment_needed' : 'quote_declined' }) || c;
  createSafeMessageEvent(store, { caseData: updated, user: req.user, templateKey: approved.status === 'customer_approved' ? 'quote_approved' : 'quote_ready', payload: { quote_id: approved.id }, actor: req.user, status: 'queued_manual_send' });
  store.addEvent('customer_quote_status_recorded', { case_id: c.id, quote_id: approved.id, status: approved.status }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(updated), quote: approved, payment_summary: buildCasePaymentSummary(store, c.id) });
});

app.get('/api/cases/:id/appointment-messages', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(c), messages: store.list('transactional_messages', (m) => m.case_id === c.id && !m.deleted_at), note: 'Email/message records are safe summaries only. Sign in is required for sensitive details.' });
});


app.get('/api/cases/:id/pre-session-readiness', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  res.json({ ok: true, version: APP_VERSION, readiness: buildPreSessionReadiness(c), routing: buildSessionRouting({ caseData: c }) });
});

app.post('/api/cases/:id/professional-session-request', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const created = createSessionRequest(store, c, req.user, req.body || {});
  store.addEvent('professional_session_requested', { case_id: c.id, request_id: created.request.id, final_level: created.routing.finalLevel, customer_requested_professional: created.routing.customerRequestedProfessional }, req);
  res.json({ ok: true, version: APP_VERSION, ...created });
});

app.get('/api/cases/:id/appointment-options', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const sessionRequest = store.find('professional_session_requests', (r) => r.case_id === c.id && !r.deleted_at) || {};
  res.json({ ok: true, version: APP_VERSION, options: buildAppointmentOptions({ caseData: c, sessionRequest }), readiness: buildSchedulingReadiness({ caseData: c, sessionRequest }) });
});

app.post('/api/cases/:id/appointment-scheduling-request', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const appointment = createAppointmentSchedulingRequest(store, c, req.user, req.body || {});
  store.addEvent('appointment_scheduling_requested', { case_id: c.id, appointment_id: appointment.id, meeting_provider: appointment.meeting_provider, appointment_status: appointment.appointment_status }, req);
  res.json({ ok: true, version: APP_VERSION, appointment, options: buildAppointmentOptions({ caseData: c }), readiness: buildSchedulingReadiness({ caseData: c, sessionRequest: appointment }) });
});

app.post('/api/payments/create-checkout-session', requireUser, async (req, res) => {
  const body = req.body || {};
  const quoteId = safeDisplay(body.quote_id || '', 120);
  const quote = quoteId ? store.find('quotes', (q) => q.id === quoteId && !q.deleted_at) : null;
  const caseId = safeDisplay(body.case_id || (quote && quote.case_id) || '', 120);
  const c = caseId ? store.find('cases', (item) => item.id === caseId && !item.deleted_at) : null;
  if (caseId && (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user)))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  if (quote && quote.status !== 'customer_approved' && quote.status !== 'converted_to_payment_request') return res.status(409).json({ ok: false, error: 'Customer quote approval is required before checkout.', quote });
  const product = safeDisplay(body.product_type || (quote && quote.product_type) || (c && c.review_recommended_product) || (c && c.selected_tier) || 'tax_notice_action_plan', 80);
  const tier = pricingTierForProduct(product);
  const amountCents = Number((quote && quote.amount_total_cents) || (tier && tier.publicPriceCents) || 0);
  const productLabel = safeDisplay((quote && quote.product_label) || (tier && tier.label) || product, 160);
  if ((!tier && !quote) || amountCents <= 0) return res.status(400).json({ ok: false, error: 'Unknown, free, or invalid product/quote amount.' });
  const payment = store.insert('payments', { id: `pay_${uuidv4()}`, quote_id: quote ? quote.id : '', case_id: c ? c.id : '', email: c ? c.email : (quote ? quote.email : req.user.email), product_type: product, amount_total_cents: amountCents, status: stripe ? 'checkout_created' : 'requested_not_paid', referral_code: c ? c.referral_code || '' : req.user.referred_by_code || '', created_by_user_id: req.user.id });
  if (!stripe) {
    store.addEvent('stripe_checkout_not_configured_payment_request_created', { payment_id: payment.id, case_id: payment.case_id, product_type: product }, req);
    return res.json({ ok: true, configured: false, payment, message: 'Stripe is not configured. Payment request was recorded but no checkout URL was created.' });
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${PAYMENT_SUCCESS_URL}${PAYMENT_SUCCESS_URL.includes('?') ? '&' : '?'}case=${encodeURIComponent(payment.case_id)}&payment_id=${encodeURIComponent(payment.id)}`,
    cancel_url: PAYMENT_CANCEL_URL,
    customer_email: payment.email || req.user.email,
    line_items: [{ price_data: { currency: 'usd', product_data: { name: productLabel }, unit_amount: amountCents }, quantity: 1 }],
    metadata: { payment_id: payment.id, quote_id: payment.quote_id || '', case_id: payment.case_id || '', product_type: product, referral_code: payment.referral_code || '', email: payment.email || '' }
  });
  const updated = store.update('payments', payment.id, { stripe_checkout_session_id: session.id, checkout_url: session.url, status: 'checkout_created' });
  if (c) store.update('cases', c.id, { payment_status: 'checkout_created', payment_request_id: payment.id, selected_tier: product });
  store.addEvent('stripe_checkout_created', { payment_id: payment.id, case_id: payment.case_id, product_type: product }, req);
  res.json({ ok: true, configured: true, payment: updated, checkout_url: session.url });
});

app.get('/api/cases/:id/reviewer-disclosure', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const pro = c.assigned_professional_id ? store.find('professionals', (p) => p.id === c.assigned_professional_id && !p.deleted_at) : null;
  const signoffs = store.list('professional_signoffs', (s) => s.case_id === c.id && !s.deleted_at && (s.final_release_allowed || c.release_status === 'released_to_client'));
  res.json({ ok: true, version: APP_VERSION, disclosure: buildClientReviewerDisclosure(c, pro, signoffs) });
});

app.get('/api/cases/:id/release-summary', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const releases = store.list('release_events', (r) => r.case_id === c.id && !r.deleted_at);
  const notes = store.list('review_notes', (n) => n.case_id === c.id && !n.deleted_at && n.visible_to_client !== false);
  store.logAccess('release_summary_viewed', { case_id: c.id, actor_user_id: req.user.id, release_count: releases.length }, req);
  res.json({ ok: true, case: publicCaseSummary(c), releases, notes, message: releases.length ? 'Released review notes are shown below. Confirm all facts with the assigned professional before filing, signing, or responding to an agency.' : 'No final review output has been released yet.' });
});

app.get('/api/cases/:caseId/documents/:documentId/download', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.caseId && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const doc = store.getDocument(req.params.documentId);
  const buffer = doc && doc.case_id === c.id ? store.readUploadedFile(doc) : null;
  if (!doc || !buffer) return res.status(404).json({ ok: false, error: 'Document not found.' });
  store.logAccess('document_download_decrypted', { case_id: c.id, document_id: doc.id, actor_user_id: req.user.id, actor_role: req.user.role || 'client' }, req);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${String(doc.original_name || doc.stored_name || 'document').replace(/"/g, '')}"`);
  res.send(buffer);
});


app.get('/api/cases/:caseId/documents/:documentId/extraction', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.caseId && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const doc = store.getDocument(req.params.documentId);
  if (!doc || doc.case_id !== c.id) return res.status(404).json({ ok: false, error: 'Document not found.' });
  store.logAccess('document_extraction_profile_viewed', { case_id: c.id, document_id: doc.id, actor_user_id: req.user.id, actor_role: req.user.role || 'client' }, req);
  res.json({
    ok: true,
    case: publicCaseSummary(c),
    document: {
      id: doc.id,
      original_name: doc.original_name,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      classification: doc.classification || null,
      extraction_profile: doc.extraction_profile || null,
      extracted_fields: doc.extracted_fields || [],
      extracted_text_preview: doc.extracted_text_preview || ''
    },
    verification_history: store.list('document_verifications', (v) => v.case_id === c.id && v.document_id === doc.id && !v.deleted_at)
  });
});

app.post('/api/cases/:caseId/documents/:documentId/fields/:fieldKey/verify', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.caseId && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const doc = store.getDocument(req.params.documentId);
  if (!doc || doc.case_id !== c.id) return res.status(404).json({ ok: false, error: 'Document not found.' });
  const body = req.body || {};
  const profile = doc.extraction_profile || {};
  const fields = Array.isArray(profile.extracted_fields) ? profile.extracted_fields : (doc.extracted_fields || []);
  const fieldKey = safeDisplay(req.params.fieldKey, 120);
  const idx = fields.findIndex((f) => f.key === fieldKey);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Extracted field not found.' });
  const allowed = ['client_confirmed','verified','rejected','manual_corrected','professional_override'];
  const status = allowed.includes(String(body.status || '')) ? String(body.status) : (isStaff(req.user) ? 'verified' : 'client_confirmed');
  const correctedValue = safeDisplay(body.corrected_value || body.value || fields[idx].value || '', 300);
  fields[idx] = {
    ...fields[idx],
    status,
    corrected_value: correctedValue,
    verified_by: req.user.id,
    verified_role: req.user.role || 'client',
    verified_at: new Date().toISOString(),
    note: safeDisplay(body.note || '', 800)
  };
  const nextProfile = { ...profile, extracted_fields: fields, human_verification_required: fields.some((f) => !['verified','rejected','professional_override'].includes(String(f.status || ''))) };
  const updatedDoc = store.update('documents', doc.id, { extraction_profile: nextProfile, extracted_fields: fields });
  const nextDocs = (c.documents || []).map((d) => d.id === doc.id ? { ...d, extraction_profile: nextProfile, extracted_fields: fields } : d);
  const nextCase = { ...c, documents: nextDocs };
  const plan = buildFieldFillPlan(nextCase, nextDocs);
  const binder = workpaperBinderForCase(nextCase, nextDocs);
  const updatedCase = store.update('cases', c.id, { documents: nextDocs, field_fill_plan: plan, document_binder: binder, document_readiness_score: plan.readiness_score, extraction_summary: summarizeCaseExtraction(nextDocs) });
  const verification = store.insert('document_verifications', { id: `docver_${uuidv4()}`, case_id: c.id, document_id: doc.id, field_key: fieldKey, status, corrected_value: correctedValue, actor_user_id: req.user.id, actor_role: req.user.role || 'client', note: safeDisplay(body.note || '', 800) });
  store.addEvent('document_extracted_field_verified', { case_id: c.id, document_id: doc.id, field_key: fieldKey, status, actor_role: req.user.role || 'client' }, req);
  res.json({ ok: true, case: publicCaseSummary(updatedCase), document: updatedDoc, verification, field_fill_plan: plan });
});

app.post('/api/staff/cases/:caseId/documents/:documentId/classify', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.caseId && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const doc = store.getDocument(req.params.documentId);
  if (!doc || doc.case_id !== c.id) return res.status(404).json({ ok: false, error: 'Document not found.' });
  const typeKey = safeDisplay((req.body || {}).document_type_key || '', 80);
  const type = TAX_DOCUMENT_TYPES.find((entry) => entry.key === typeKey);
  if (!type) return res.status(400).json({ ok: false, error: 'Unknown document type.' });
  const actor = req.user || req.staff || { id: 'staff', role: 'staff' };
  const classification = { ...type, confidence: 'human-confirmed', confidence_score: 100, classifier: `staff:${actor.id}` };
  const profile = doc.extraction_profile || {};
  const updatedDoc = store.update('documents', doc.id, { classification, document_workflow: classification.workflow, classifier: classification.classifier, extraction_profile: { ...profile, staff_classification_confirmed: true } });
  const nextDocs = (c.documents || []).map((d) => d.id === doc.id ? { ...d, classification, extraction_profile: updatedDoc.extraction_profile } : d);
  const nextCase = { ...c, documents: nextDocs };
  const plan = buildFieldFillPlan(nextCase, nextDocs);
  const binder = workpaperBinderForCase(nextCase, nextDocs);
  const updatedCase = store.update('cases', c.id, { documents: nextDocs, field_fill_plan: plan, document_binder: binder, document_readiness_score: plan.readiness_score, extraction_summary: summarizeCaseExtraction(nextDocs) });
  store.addEvent('staff_document_classification_confirmed', { case_id: c.id, document_id: doc.id, document_type_key: typeKey, actor_role: actor.role || 'staff' }, req);
  res.json({ ok: true, case: publicCaseSummary(updatedCase), document: updatedDoc, field_fill_plan: plan });
});

app.get('/api/staff/document-verification-queue', requireStaff, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at);
  res.json({ ok: true, queue: buildVerificationQueue(cases), extraction_jobs: store.list('extraction_jobs', (j) => !j.deleted_at).slice(0, 200) });
});

app.get('/api/tax/extraction-controls', (req, res) => res.json({
  ok: true,
  version: APP_VERSION,
  controls: [
    'Local extraction is a starter layer for text PDFs and text-like uploads only.',
    'Image-only PDFs and photos require configured OCR/document-AI provider or manual entry.',
    'Every source-to-field value has confidence and must be verified before filing or agency response.',
    'Tax-year, deadline, SSN/TIN, bank-account, balance/refund, and signature fields are high-risk verification fields.',
    'Professional override creates an audit event and should be used only by authorized preparers/reviewers.'
  ],
  production_ocr_provider_configured: process.env.OCR_PROVIDER_CONFIGURED === 'true' || process.env.TEXTRACT_CONFIGURED === 'true' || process.env.GOOGLE_DOCUMENT_AI_CONFIGURED === 'true'
}));

app.post('/api/referrals', (req, res) => {
  try {
    const body = req.body || {};
    if (!body.partner_name || !body.email) return res.status(400).json({ ok: false, error: 'Partner name and email are required.' });
    const requested = normalizeReferralCode(body.requested_code || '');
    const existingByEmail = store.find('referrals', (item) => !item.deleted_at && String(item.email || '').toLowerCase() === String(body.email || '').toLowerCase());
    if (existingByEmail) return res.json({ ok: true, referral: decorateReferral(existingByEmail, req) });
    const code = requested || generateUniqueReferralCode(body.email, 'client');
    const existingByCode = findReferrerByCode(code);
    if (existingByCode) return res.status(409).json({ ok: false, error: 'That requested code already exists. Try another.' });
    const referral = store.insert('referrals', { id: `ref_${uuidv4()}`, partner_name: safeDisplay(body.partner_name, 160), organization: safeDisplay(body.organization || '', 160), email: safeDisplay(body.email || '', 180).toLowerCase(), phone: safeDisplay(body.phone || '', 60), city_state: safeDisplay(body.city_state || '', 120), language: safeDisplay(body.language || 'English', 60), code, status: 'active', reward_note: pricingLedger().referralRule });
    store.addEvent('referral_created', { code: referral.code, organization: referral.organization }, req);
    res.json({ ok: true, referral: decorateReferral(referral, req) });
  } catch (error) { res.status(500).json({ ok: false, error: error.message }); }
});

function decorateReferral(referral, req) {
  const code = normalizeReferralCode(referral.code || referral.referral_code || '');
  const base = requestBaseUrl(req);
  return { ...referral, code, link: directReferralLink(code, base), tracked_start_link: trackedStartLink(code, base), qr_url: `/api/referrals/${encodeURIComponent(code)}/qr.png`, flyer_url: `/api/referrals/${encodeURIComponent(code)}/flyer.pdf` };
}


// Signed-in referral tools must be registered before the public /api/referrals/:code route.
app.get('/api/referrals/me', requireUser, (req, res) => {
  const user = ensureReferralCode(req.user);
  const code = normalizeReferralCode(user.referral_code);
  const rewards = store.list('referral_rewards', (r) => !r.deleted_at && normalizeReferralCode(r.referrer_code) === code);
  const scans = store.list('qr_scans', (q) => !q.deleted_at && normalizeReferralCode(q.referrer_code) === code);
  const referredUsers = store.list('users', (u) => !u.deleted_at && normalizeReferralCode(u.referred_by_code) === code);
  const referredIds = new Set(referredUsers.map((u) => u.id));
  const cases = store.list('cases', (c) => !c.deleted_at && (normalizeReferralCode(c.referral_code) === code || referredIds.has(c.user_id)));
  const helperStarts = store.list('helper_starts', (h) => !h.deleted_at && normalizeReferralCode(h.helper_code || h.referral_code) === code);
  res.json({ ok: true, referralCode: code, referralLink: directReferralLink(code, requestBaseUrl(req)), trackedStartLink: trackedStartLink(code, requestBaseUrl(req)), qrCodeImageUrl: '/api/referrals/me/qr', flyerPdfUrl: '/api/referrals/me/flyer.pdf', rewards, summary: summarizeRewards(rewards), helperStats: { scans: scans.length, starts: helperStarts.length, accounts: referredUsers.length, cases: cases.length, paidCases: cases.filter((c) => c.payment_status === 'paid').length }, program: pricingLedger() });
});


app.get('/api/referrals/me/qr', requireUser, async (req, res) => {
  const user = ensureReferralCode(req.user);
  const code = normalizeReferralCode(user.referral_code);
  const png = await generateQrPngBuffer(trackedStartLink(code, requestBaseUrl(req), 'community-qr'));
  res.setHeader('Content-Type', 'image/png');
  if (String(req.query.download || '') === '1') res.setHeader('Content-Disposition', `attachment; filename="justice-tax-solutions-community-qr-${code}.png"`);
  res.send(png);
});

app.get('/api/referrals/me/flyer.pdf', requireUser, async (req, res) => {
  const user = ensureReferralCode(req.user);
  const code = normalizeReferralCode(user.referral_code);
  const pdf = await generateReferralFlyerPdf({ code, startLink: trackedStartLink(code, requestBaseUrl(req), 'community-flyer'), partnerName: user.name || user.email });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="justice-tax-solutions-community-flyer-${code}.pdf"`);
  res.send(pdf);
});


app.get('/api/referrals/:code', (req, res) => {
  const referral = findReferrerByCode(req.params.code);
  if (!referral) return res.status(404).json({ ok: false, error: 'Referral code not found.' });
  res.json({ ok: true, referral: decorateReferral(referral, req) });
});

app.get('/api/referrals/:code/qr.png', async (req, res) => {
  const referral = findReferrerByCode(req.params.code);
  if (!referral) return res.status(404).send('Referral code not found.');
  const code = normalizeReferralCode(referral.code || referral.referral_code || req.params.code);
  const png = await generateQrPngBuffer(trackedStartLink(code, requestBaseUrl(req), 'community-qr'));
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (String(req.query.download || '') === '1') res.setHeader('Content-Disposition', `attachment; filename="justice-tax-solutions-qr-${code}.png"`);
  res.send(png);
});

app.get('/api/referrals/:code/flyer.pdf', async (req, res) => {
  const referral = findReferrerByCode(req.params.code);
  if (!referral) return res.status(404).send('Referral code not found.');
  const code = normalizeReferralCode(referral.code || referral.referral_code || req.params.code);
  const pdf = await generateReferralFlyerPdf({ code, startLink: trackedStartLink(code, requestBaseUrl(req), 'community-flyer'), partnerName: referral.organization || referral.partner_name || referral.name || '' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="justice-tax-solutions-${code}-flyer.pdf"`);
  res.send(pdf);
});

app.get('/api/platform/pricing', (req, res) => res.json(pricingLedger()));
app.get('/api/platform/pricing-schedule', (req, res) => res.json({ ok: true, version: APP_VERSION, schedule: buildPublicPricingSchedule() }));
app.get('/api/platform/form-pricing-matrix', (req, res) => res.json({ ok: true, version: APP_VERSION, formPricingMatrix: buildPublicPricingSchedule().formPricingMatrix, returnAddOns: buildPublicPricingSchedule().returnAddOns }));
app.get('/api/platform/review-level-pricing', (req, res) => res.json({ ok: true, version: APP_VERSION, reviewLevelPricing: buildReviewLevelPricing() }));
app.post('/api/platform/review-level-routing', (req, res) => res.json({ ok: true, version: APP_VERSION, routing: recommendReviewLevel(req.body || {}) }));
app.post('/api/platform/service-price-estimate', (req, res) => res.json({ ok: true, version: APP_VERSION, estimate: estimatePrice(req.body || {}) }));
app.get('/api/platform/competitor-market-research', (req, res) => res.json({ ok: true, version: APP_VERSION, research: buildCompetitorMarketResearch() }));
app.get('/api/platform/live-online-consultation-products', (req, res) => res.json({ ok: true, version: APP_VERSION, products: buildLiveOnlineConsultationProducts(), professionalSessionProducts: buildProfessionalSessionProducts() }));
app.get('/api/platform/professional-session-products', (req, res) => res.json({ ok: true, version: APP_VERSION, products: buildProfessionalSessionProducts() }));
app.get('/api/platform/professional-operations-policy', (req, res) => res.json({ ok: true, version: APP_VERSION, policy: PROFESSIONAL_OPERATIONS_POLICY, credentialRequirementMatrix: CREDENTIAL_REQUIREMENT_MATRIX, signoffTypes: SIGNOFF_TYPES }));
app.get('/api/platform/calendar-integration-guide', (req, res) => res.json({ ok: true, version: APP_VERSION, guide: buildCalendarIntegrationGuide() }));
app.get('/api/platform/appointment-options', (req, res) => res.json({ ok: true, version: APP_VERSION, options: buildAppointmentOptions({}) }));
app.post('/api/platform/live-consultation-estimate', (req, res) => res.json({ ok: true, version: APP_VERSION, estimate: estimateLiveConsultation(req.body || {}) }));
app.post('/api/platform/professional-session-estimate', (req, res) => res.json({ ok: true, version: APP_VERSION, estimate: estimateProfessionalSession(req.body || {}) }));
app.get('/api/staff/pricing-guide', requireStaff, (req, res) => res.json({ ok: true, version: APP_VERSION, guide: buildStaffPricingGuide(), schedule: buildPublicPricingSchedule() }));
app.get('/api/platform/referral-ledger', (req, res) => res.json(pricingLedger()));
app.get('/api/platform/io-reference-audit', (req, res) => res.json({ ok: true, version: APP_VERSION, ...ioReferenceAuditForTaxBuild() }));
app.get('/api/tax/forms', (req, res) => res.json({ ok: true, version: APP_VERSION, summary: catalogSummary(), forms: TAX_FORM_CATALOG }));
app.get('/api/tax/workflow-coverage', (req, res) => res.json({ ok: true, version: APP_VERSION, summary: catalogSummary(), workflows: workflowCoverage() }));
app.get('/api/platform/production-readiness', (req, res) => res.json({ ok: true, version: APP_VERSION, readiness: productionReadinessSummary(), schema: store.currentSchemaSummary(), review_roles: REVIEW_ROLES, review_tiers: REVIEW_TIERS, role_permissions: ROLE_PERMISSIONS, compliance_requirements: PREPARER_COMPLIANCE_REQUIREMENTS }));
app.get('/api/platform/review-roles', (req, res) => res.json({ ok: true, version: APP_VERSION, review_roles: REVIEW_ROLES, review_tiers: REVIEW_TIERS, compliance_requirements: PREPARER_COMPLIANCE_REQUIREMENTS }));
app.get('/api/platform/payment-status', (req, res) => res.json({ ok: true, version: APP_VERSION, stripe_configured: Boolean(stripe), webhook_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET), success_url: PAYMENT_SUCCESS_URL, cancel_url: PAYMENT_CANCEL_URL }));
app.get('/api/platform/payment-quote-email-workflow', (req, res) => res.json({ ok: true, version: APP_VERSION, workflow: buildPaymentQuoteEmailWorkflow({ stripeConfigured: Boolean(stripe), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) }) }));
app.get('/api/platform/transactional-message-policy', (req, res) => res.json({ ok: true, version: APP_VERSION, policy: PAYMENT_QUOTE_EMAIL_POLICY, templates: TRANSACTIONAL_EMAIL_TEMPLATES_V2, workflow: buildPaymentQuoteEmailWorkflow({ stripeConfigured: Boolean(stripe), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) }) }));
app.get('/api/platform/marketing-conversion-plan', (req, res) => res.json({ ok: true, version: APP_VERSION, plan: buildMarketingConversionPlan() }));
app.get('/api/platform/marketing-pages', (req, res) => res.json({ ok: true, version: APP_VERSION, pages: listMarketingPages() }));
app.get('/api/platform/marketing-page/:slug', (req, res) => {
  const page = getMarketingPage(String(req.params.slug || ''));
  if (!page) return res.status(404).json({ ok: false, error: 'Marketing page not found.' });
  res.json({ ok: true, version: APP_VERSION, page });
});
app.get('/api/platform/campaign-landing-checklist', (req, res) => res.json({ ok: true, version: APP_VERSION, checklist: buildCampaignLandingChecklist(String(req.query.slug || '')) }));
app.get('/api/platform/seo-service-page-roadmap', (req, res) => res.json({ ok: true, version: APP_VERSION, roadmap: buildSeoServicePageRoadmap() }));
app.get('/api/platform/analytics-event-taxonomy', (req, res) => res.json({ ok: true, version: APP_VERSION, taxonomy: ANALYTICS_EVENT_TAXONOMY, campaign_fields: CAMPAIGN_FIELDS, plan: buildAnalyticsImplementationPlan() }));

app.post('/api/analytics/events', (req, res) => {
  const body = req.body || {};
  const eventKey = safeDisplay(body.event_key || body.event || 'site_event', 100).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const payload = sanitizeAnalyticsPayload({ ...(body.payload || {}), source: body.source, medium: body.medium, campaign: body.campaign, landing_page: body.landing_page, conversion_intent: body.conversion_intent, page: body.page || body.path || '' });
  const event = store.addEvent(`analytics_${eventKey}`, payload, req);
  res.json({ ok: true, version: APP_VERSION, event_id: event.id, recorded: true, no_sensitive_details_policy: buildAnalyticsImplementationPlan().event_policy });
});

app.get('/api/staff/cockpit', requireStaff, (req, res) => res.json({ ok: true, version: APP_VERSION, cockpit: buildStaffCockpit(store) }));
app.get('/api/staff/analytics-funnel', requireStaff, (req, res) => res.json({ ok: true, version: APP_VERSION, funnel: buildConversionFunnel(store) }));
app.get('/api/staff/marketing-attribution', requireStaff, (req, res) => res.json({ ok: true, version: APP_VERSION, attribution: buildMarketingAttribution(store) }));
app.get('/api/staff/operational-alerts', requireStaff, (req, res) => res.json({ ok: true, version: APP_VERSION, alerts: buildOperationalAlerts(store) }));

function pilotReleaseReports() {
  return {
    securityBlockers: buildSecurityLaunchBlockers({ store }),
    form9465Ready: build9465OutputReadiness({ store }),
    professionalProducts: buildProfessionalSessionProducts(),
    marketingPages: listMarketingPages().length,
    staffCockpitReady: true
  };
}

app.get('/api/platform/private-pilot-release-candidate', (req, res) => res.json({ ok: true, version: APP_VERSION, candidate: buildPrivatePilotReleaseCandidate({ store, reports: pilotReleaseReports() }) }));
app.get('/api/platform/private-pilot-go-no-go', (req, res) => res.json({ ok: true, version: APP_VERSION, report: buildPrivatePilotGoNoGoReport({ store, reports: pilotReleaseReports() }) }));
app.get('/api/platform/private-pilot-regression-checklist', (req, res) => res.json({ ok: true, version: APP_VERSION, regression: buildPrivatePilotRegressionChecklist({ store }) }));
app.get('/api/platform/private-pilot-scenario-matrix', (req, res) => res.json({ ok: true, version: APP_VERSION, scenarios: buildPilotUserScenarioMatrix() }));
app.get('/api/platform/compliance-copy-audit', (req, res) => res.json({ ok: true, version: APP_VERSION, audit: buildComplianceCopyAudit() }));
app.get('/api/platform/pilot-marketing-safety-review', (req, res) => res.json({ ok: true, version: APP_VERSION, review: buildPilotMarketingSafetyReview({ store }) }));
app.get('/api/staff/private-pilot-release-packet', requireStaff, (req, res) => res.json({ ok: true, version: APP_VERSION, packet: buildPilotReleasePacket({ store, reports: pilotReleaseReports() }) }));
app.post('/api/staff/private-pilot-release-decision', requireStaff, (req, res) => {
  const user = currentUser(req) || { id: 'admin-token', email: 'staff/admin token' };
  const event = recordPilotReleaseDecision(store, req.body || {}, user);
  store.addEvent('private_pilot_release_decision_recorded', { event_id: event.id, status_key: event.status_key, status: event.status }, req);
  res.json({ ok: true, version: APP_VERSION, event, candidate: buildPrivatePilotReleaseCandidate({ store, reports: pilotReleaseReports() }) });
});
app.get('/api/platform/client-consent-model', (req, res) => res.json({ ok: true, version: APP_VERSION, consent_model: CLIENT_CONSENT_MODEL }));
app.get('/api/platform/live-readiness', (req, res) => res.json({ ok: true, version: APP_VERSION, readiness: buildLiveReadiness({ store, configuredVendors: configuredVendors() }), production_readiness: productionReadinessSummary() }));
app.get('/api/platform/live-user-journey', (req, res) => res.json({ ok: true, version: APP_VERSION, service_levels: LIVE_SERVICE_LEVELS, client_journey: LIVE_CLIENT_JOURNEY, operating_policies: OPERATING_POLICIES, audit: buildLaunchPolishAudit({ store, configuredVendors: configuredVendors() }) }));
app.post('/api/platform/service-fit', (req, res) => res.json({ ok: true, version: APP_VERSION, service_fit: chooseServiceFit(req.body || {}) }));
app.get('/api/platform/competitor-intelligence', (req, res) => res.json({ ok: true, version: APP_VERSION, summary: competitorSummary(), competitor_map: COMPETITOR_MAP, workflow_patterns: WORKFLOW_PATTERNS, inspiration_ledger: FEATURE_INSPIRATION_LEDGER, market_research: buildCompetitorMarketResearch(), live_online_products: buildLiveOnlineConsultationProducts(), professional_session_products: buildProfessionalSessionProducts() }));
app.get('/api/platform/workflow-patterns', (req, res) => res.json({ ok: true, version: APP_VERSION, workflow_patterns: WORKFLOW_PATTERNS }));
app.get('/api/tax/problem-playbooks', (req, res) => res.json({ ok: true, version: APP_VERSION, playbooks: TAX_PROBLEM_PLAYBOOKS }));
app.get('/api/tax/forms-upload-tomorrow-checklist', (req, res) => res.json({ ok: true, version: APP_VERSION, checklist: TOMORROW_FORM_UPLOAD_CHECKLIST }));
app.get('/api/tax/document-types', (req, res) => res.json({ ok: true, version: APP_VERSION, document_types: TAX_DOCUMENT_TYPES, field_fill_targets: FIELD_FILL_TARGETS }));
app.get('/api/tax/notice-catalog', (req, res) => res.json({ ok: true, version: APP_VERSION, summary: noticeCatalogSummary(), notices: NOTICE_ACTION_CATALOG }));



app.get('/api/tax/official-form-download-vs-upload-guide', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, guide: buildDownloadVsUploadGuide(), policy: FORM_SOURCE_COLLECTION_POLICY });
});

app.get('/api/tax/official-url-discovery-guide', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, guide: buildOfficialUrlDiscoveryGuide(), capture_guide: buildOfficialUrlCaptureGuide() });
});

app.get('/api/tax/official-url-capture-guide', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, guide: buildOfficialUrlCaptureGuide(), inventory: buildOfficialSourceInventory(store).summary });
});

app.get('/api/tax/official-source-catalog', (req, res) => {
  const sources = officialSourceCatalog({ agency: req.query.agency || '', wave: req.query.wave || '', form_number: req.query.form_number || '' });
  res.json({ ok: true, version: APP_VERSION, summary: { total: sources.length, catalog_total: OFFICIAL_FORM_SOURCE_CATALOG.length }, sources, policy: FORM_SOURCE_COLLECTION_POLICY });
});

app.get('/api/tax/official-source-inventory', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, inventory: buildOfficialSourceInventory(store) });
});

app.get('/api/tax/official-form-controlled-mapping-plan', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, plan: buildControlledMappingPlan(store) });
});

app.post('/api/admin/official-source-catalog/seed', adminGuard, (req, res) => {
  const result = seedOfficialSourceCatalog(store, { agency: req.body.agency || '', wave: req.body.wave || '', form_number: req.body.form_number || '', notes: req.body.notes || '', added_from: 'admin_seed_v0.1.29' });
  store.addEvent('official_source_catalog_seeded', { inserted_count: result.inserted_count, existing_count: result.existing_count, total_selected: result.total_selected, agency: req.body.agency || '', wave: req.body.wave || '' }, req);
  res.json({ ok: true, version: APP_VERSION, result });
});

app.post('/api/admin/official-form-sources', adminGuard, (req, res) => {
  const body = req.body || {};
  const record = createOfficialSourceRecord(store, body, { id: 'admin-token' });
  store.addEvent('official_form_source_registered', { source_id: record.id, agency: record.agency, form_number: record.form_number, source_status: record.source_status }, req);
  res.json({ ok: true, version: APP_VERSION, source: record, mapping_draft: buildSourceDrivenMappingDraft(record) });
});

app.get('/api/staff/official-form-sources', requireStaff, (req, res) => {
  const sources = listOfficialFormSources(store, { agency: req.query.agency || '', status: req.query.status || '', needs_pdf: req.query.needs_pdf || '' });
  res.json({ ok: true, version: APP_VERSION, summary: { total: sources.length }, sources });
});

app.get('/api/staff/official-form-sources/:id/mapping-draft', requireStaff, (req, res) => {
  const source = store.find('official_form_sources', (item) => item.id === req.params.id && !item.deleted_at);
  if (!source) return res.status(404).json({ ok: false, error: 'Official form source record not found.' });
  res.json({ ok: true, version: APP_VERSION, source, mapping_draft: buildSourceDrivenMappingDraft(source), stages: CONTROLLED_MAPPING_STAGES });
});

app.post('/api/admin/official-form-sources/:id/capture-pdf', adminGuard, async (req, res) => {
  const body = req.body || {};
  const result = await captureOfficialPdfFromSource(store, req.params.id, { dryRun: body.dry_run === true || body.dry_run === 'true', force: body.force === true || body.force === 'true' });
  store.addEvent('official_form_url_capture_requested', { source_id: req.params.id, result_status: result.status, ok: Boolean(result.ok), dry_run: body.dry_run === true || body.dry_run === 'true' }, req);
  res.status(result.ok ? 200 : 400).json({ ...result, version: APP_VERSION });
});

app.post('/api/admin/official-source-url/validate', adminGuard, (req, res) => {
  const body = req.body || {};
  res.json({ ok: true, version: APP_VERSION, validation: validateOfficialSourceUrl(body.url || body.source_url || body.pdf_url || '', body.agency || '') });
});

app.get('/api/tax/official-form-upload-guide', (req, res) => {
  res.json({ ok: true, version: APP_VERSION, guide: uploadReadinessGuide(), sources: [
    { agency: 'IRS', official_site: 'irs.gov/forms-instructions', purpose: 'current IRS forms, instructions, and publications' },
    { agency: 'NYS', official_site: 'tax.ny.gov/forms', purpose: 'New York State current and prior-year tax forms' },
    { agency: 'NYC', official_site: 'nyc.gov/site/finance/taxes/business.page', purpose: 'New York City Department of Finance business/excise tax forms' }
  ] });
});

app.get('/api/tax/official-forms', (req, res) => {
  const agency = String(req.query.agency || '').toUpperCase();
  const taxYear = String(req.query.tax_year || '');
  const forms = store.list('official_forms', (form) => {
    if (form.deleted_at) return false;
    if (agency && form.agency !== agency) return false;
    if (taxYear && String(form.tax_year || '') !== taxYear) return false;
    return true;
  }).sort((a, b) => Number(a.mapping_priority || 99) - Number(b.mapping_priority || 99) || String(a.form_number).localeCompare(String(b.form_number)));
  res.json({ ok: true, version: APP_VERSION, summary: { total: forms.length, priority_summary: formPrioritySummary(forms) }, forms: forms.map((form) => ({ ...form, storage_path: undefined })) });
});

app.get('/api/tax/official-form-roadmap', (req, res) => {
  const forms = store.list('official_forms', (form) => !form.deleted_at);
  res.json({ ok: true, version: APP_VERSION, waves: FIRST_FORM_WAVES, uploaded_summary: formPrioritySummary(forms), mapping_policy: FIELD_MAPPING_POLICY, next_best_uploads: uploadReadinessGuide().what_to_upload_now });
});

app.post('/api/admin/official-form-zips', adminGuard, upload.array('archives', 10), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ ok: false, error: 'Upload one or more ZIP files in the archives field.' });
  const options = {
    agency: safeDisplay(req.body.agency || '', 20).toUpperCase(),
    taxYear: safeDisplay(req.body.tax_year || '', 12),
    sourceUrl: safeDisplay(req.body.source_url || '', 500),
    notes: safeDisplay(req.body.notes || '', 1000),
    uploadedByUserId: 'admin-token'
  };
  const results = [];
  try {
    for (const file of files) {
      if (!/\.zip$/i.test(file.originalname || '') && !/zip/i.test(file.mimetype || '')) {
        results.push({ original_name: file.originalname, ok: false, error: 'Skipped non-ZIP upload.' });
        continue;
      }
      const result = ingestOfficialFormsZip(store, file, options);
      results.push({ ok: true, duplicate: result.duplicate, package: result.package, pdf_count: result.forms.length, skipped_count: (result.skipped || []).length, priority_summary: formPrioritySummary(result.forms) });
      store.addEvent('official_form_zip_ingested', { package_id: result.package.id, original_name: file.originalname, pdf_count: result.forms.length, duplicate: result.duplicate, agency: options.agency, tax_year: options.taxYear }, req);
    }
    res.json({ ok: true, version: APP_VERSION, results, mapping_queue_count: mappingQueue(store).length });
  } catch (error) {
    store.addEvent('official_form_zip_ingestion_error', { message: error.message }, req);
    res.status(400).json({ ok: false, error: error.message, results });
  }
});

app.get('/api/staff/form-mapping-queue', requireStaff, (req, res) => {
  const queue = mappingQueue(store, { agency: req.query.agency || '', onlyNeedsReview: req.query.all !== 'true' });
  res.json({ ok: true, version: APP_VERSION, summary: { total: queue.length, priority_summary: formPrioritySummary(queue) }, queue: queue.map((form) => ({ ...form, storage_path: undefined })) });
});

app.get('/api/staff/official-forms/:id/mapping-draft', requireStaff, (req, res) => {
  const form = store.find('official_forms', (item) => item.id === req.params.id && !item.deleted_at);
  if (!form) return res.status(404).json({ ok: false, error: 'Official form not found.' });
  res.json({ ok: true, version: APP_VERSION, form: { ...form, storage_path: undefined }, mapping_draft: buildMappingDraft(form), policy: FIELD_MAPPING_POLICY });
});

app.post('/api/staff/official-forms/:id/mapping-status', requireStaff, (req, res) => {
  const form = store.find('official_forms', (item) => item.id === req.params.id && !item.deleted_at);
  if (!form) return res.status(404).json({ ok: false, error: 'Official form not found.' });
  const allowed = new Set(['not_started','source_verified','fields_extracted','mapping_in_progress','sample_pdf_testing','mapped_verified','deferred_not_needed','needs_newer_official_source','blocked_unofficial_or_unclear']);
  const mappingStatus = allowed.has(String(req.body.mapping_status || '')) ? String(req.body.mapping_status) : form.mapping_status || 'not_started';
  const updated = store.update('official_forms', form.id, {
    mapping_status: mappingStatus,
    field_map_status: safeDisplay(req.body.field_map_status || form.field_map_status || '', 80),
    fillable_pdf_status: safeDisplay(req.body.fillable_pdf_status || form.fillable_pdf_status || '', 80),
    source_verified_by: req.staff.id,
    source_verified_at: mappingStatus === 'source_verified' || mappingStatus === 'mapped_verified' ? new Date().toISOString() : form.source_verified_at || '',
    mapping_notes: safeDisplay(req.body.mapping_notes || '', 2000),
    can_drive_client_output: mappingStatus === 'mapped_verified',
    release_status: mappingStatus === 'mapped_verified' ? 'usable_after_case_specific_professional_review' : 'not_usable_for_client_output_until_mapped_and_verified'
  });
  store.insert('official_form_mappings', {
    official_form_id: form.id,
    mapping_status: mappingStatus,
    field_map_status: updated.field_map_status,
    fillable_pdf_status: updated.fillable_pdf_status,
    notes: updated.mapping_notes,
    staff_id: req.staff.id,
    policy_snapshot: FIELD_MAPPING_POLICY
  });
  store.addEvent('official_form_mapping_status_updated', { official_form_id: form.id, form_number: form.form_number, mapping_status: mappingStatus }, req);
  res.json({ ok: true, form: { ...updated, storage_path: undefined }, mapping_draft: buildMappingDraft(updated) });
});

app.get('/api/staff/official-forms/:id/download', requireStaff, (req, res) => {
  const form = store.find('official_forms', (item) => item.id === req.params.id && !item.deleted_at);
  if (!form || !form.storage_path || !fs.existsSync(form.storage_path)) return res.status(404).json({ ok: false, error: 'Official form file not found.' });
  store.logAccess('official_form_downloaded', { official_form_id: form.id, form_number: form.form_number, agency: form.agency, staff_id: req.staff.id }, req);
  res.setHeader('Content-Type', form.mime_type || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${String(form.file_name || form.stored_name || 'official-form.pdf').replace(/"/g, '')}"`);
  fs.createReadStream(form.storage_path).pipe(res);
});

app.get('/api/admin/live-ai-status', adminGuard, async (req, res) => {
  const configured = configuredVendors();
  res.json({ ok: true, version: APP_VERSION, configured, live_ai_enabled: configured.length > 0, note: 'No API keys are returned. v0.1.29 reports configuration only; deep provider ping can be enabled later.' });
});

app.get('/api/admin/cases', adminGuard, (req, res) => res.json({ ok: true, cases: store.list('cases').slice(0, Number(req.query.limit) || 200) }));
app.get('/api/admin/referrals', adminGuard, (req, res) => res.json({ ok: true, referrals: store.list('referrals').slice(0, Number(req.query.limit) || 200), users_with_referrals: store.list('users').filter((u) => u.referral_code).map(publicUser) }));
app.get('/api/admin/events', adminGuard, (req, res) => res.json({ ok: true, events: store.list('events').slice(0, Number(req.query.limit) || 200) }));
app.get('/api/admin/access-logs', adminGuard, (req, res) => res.json({ ok: true, access_logs: store.list('access_logs').slice(0, Number(req.query.limit) || 200) }));

app.get('/api/staff/task-board', requireStaff, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at).slice(0, Number(req.query.limit) || 200);
  const manualTasks = store.list('tasks', (t) => !t.deleted_at);
  const board = mergeTaskBoard({ cases, manualTasks });
  const openCount = board.reduce((sum, lane) => sum + lane.tasks.filter((t) => !['done','closed','cancelled'].includes(String(t.status || 'open'))).length, 0);
  res.json({ ok: true, version: APP_VERSION, open_count: openCount, board });
});

app.post('/api/staff/cases/:id/task', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const label = safeDisplay((req.body || {}).label || '', 500);
  if (!label) return res.status(400).json({ ok: false, error: 'Task label is required.' });
  const task = store.insert('tasks', { id: `task_${uuidv4()}`, case_id: c.id, lane: safeDisplay((req.body || {}).lane || 'manual', 80), label, status: 'open', priority: safeDisplay((req.body || {}).priority || 'normal', 40), assigned_to: safeDisplay((req.body || {}).assigned_to || '', 120), created_by: (req.staff || req.user).id });
  store.addEvent('staff_manual_task_created', { case_id: c.id, task_id: task.id, lane: task.lane }, req);
  res.json({ ok: true, task });
});

app.post('/api/staff/tasks/:id/status', requireStaff, (req, res) => {
  const task = store.find('tasks', (t) => t.id === req.params.id && !t.deleted_at);
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found.' });
  const allowed = new Set(['open','in_progress','waiting_on_client','waiting_on_professional','done','closed','cancelled']);
  const status = allowed.has(String((req.body || {}).status || '')) ? String(req.body.status) : 'open';
  const updated = store.update('tasks', task.id, { status, staff_note: safeDisplay((req.body || {}).staff_note || '', 1000), updated_by: (req.staff || req.user).id });
  store.addEvent('staff_task_status_updated', { task_id: task.id, status }, req);
  res.json({ ok: true, task: updated });
});

app.get('/api/staff/live-operations', requireStaff, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at);
  const readiness = buildLiveReadiness({ store, configuredVendors: configuredVendors() });
  const caseReadiness = cases.slice(0, 200).map((c) => ({ case_id: c.id, email: c.email, pathway: c.pathway, risk_level: c.risk_level, status: c.status, client_readiness: buildCaseClientReadiness(c) }));
  const blockedCases = caseReadiness.filter((c) => c.client_readiness.blockers.length);
  res.json({ ok: true, version: APP_VERSION, readiness, blocked_case_count: blockedCases.length, blocked_cases: blockedCases.slice(0, 100), launch_mode: process.env.LIVE_PAYING_USERS_ENABLED === 'true' ? 'enabled' : 'disabled' });
});


app.get('/api/staff/sla-board', requireStaff, (req, res) => {
  const board = buildStaffSlaBoard(store.list('cases').slice(0, 500));
  res.json({ ok: true, version: APP_VERSION, board });
});

app.post('/api/staff/cases/:id/contact-attempt', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const method = safeDisplay((req.body || {}).method || 'email', 60);
  const outcome = safeDisplay((req.body || {}).outcome || 'message_left_or_sent', 120);
  const note = safeDisplay((req.body || {}).note || '', 1200);
  const contact = store.insert('contact_attempts', { id: `contact_${uuidv4()}`, case_id: c.id, staff_user_id: req.user.id, staff_email: req.user.email, method, outcome, note });
  const updated = store.update('cases', c.id, { last_contact_attempt_at: new Date().toISOString(), last_contact_attempt_method: method, last_contact_attempt_outcome: outcome });
  store.addEvent('staff_contact_attempt_logged', { case_id: c.id, method, outcome }, req);
  res.json({ ok: true, case: publicCaseSummary(updated || c), contact_attempt: contact });
});

app.get('/api/staff/overview', requireStaff, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at);
  const rewards = store.list('referral_rewards', (r) => !r.deleted_at);
  res.json({ ok: true, version: APP_VERSION, lanes: { urgent: cases.filter((c) => c.risk_level === 'high').length, submitted: cases.filter((c) => String(c.status || '').includes('review')).length, paid: cases.filter((c) => c.payment_status === 'paid').length, notices: cases.filter((c) => c.pathway === 'notice-help').length, taxDebt: cases.filter((c) => c.pathway === 'tax-debt').length, referralsPending: rewards.filter((r) => ['pending','needs_review','held'].includes(String(r.status || ''))).length, reviewRequests: store.list('review_requests', (r) => !r.deleted_at).length, unreleased: cases.filter((c) => c.release_status !== 'released_to_client' && String(c.status || '').includes('review')).length }, pricing: pricingLedger(), storage: store.storageSummary(), readiness: productionReadinessSummary() });
});

app.get('/api/staff/professional-calendar-configs', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, calendars: listProfessionalCalendarConfigs(store) });
});

app.post('/api/staff/professional-calendar-configs', requireStaff, (req, res) => {
  const record = professionalCalendarRecord(req.body || {}, req.staff || {});
  const saved = store.insert('professional_calendar_configs', record);
  store.addEvent('professional_calendar_config_saved', { calendar_config_id: saved.id, professional_id: saved.professional_id, provider: saved.professional_calendar_provider }, req);
  res.json({ ok: true, version: APP_VERSION, calendar_config: saved, guide: buildCalendarIntegrationGuide() });
});

app.get('/api/staff/appointment-scheduling-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: buildAppointmentSchedulingBoard(store) });
});

app.get('/api/staff/payment-operations-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: buildPaymentOperationsBoard(store), workflow: buildPaymentQuoteEmailWorkflow({ stripeConfigured: Boolean(stripe), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) }) });
});

app.post('/api/staff/cases/:id/quote', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const product = safeDisplay((req.body || {}).product_type || c.selected_tier || c.review_recommended_product || 'tax_notice_action_plan', 80);
  const tier = pricingTierForProduct(product);
  const quote = createQuoteRecord(store, { caseData: c, user: {}, body: { ...(req.body || {}), product_type: product, status: safeDisplay((req.body || {}).status || 'sent', 80) }, tier, createdBy: req.staff });
  const updated = store.update('cases', c.id, { quote_status: quote.status, quote_request_id: quote.id, selected_tier: quote.product_type || c.selected_tier || '', quoted_amount_cents: quote.amount_total_cents, status: quote.status === 'sent' ? 'quote_sent_to_customer' : c.status }) || c;
  const msg = createSafeMessageEvent(store, { caseData: updated, templateKey: 'quote_ready', payload: { quote_id: quote.id }, actor: req.staff, status: 'queued_manual_send' });
  store.addEvent('staff_quote_created', { case_id: c.id, quote_id: quote.id, product_type: quote.product_type, amount_total_cents: quote.amount_total_cents }, req);
  res.json({ ok: true, version: APP_VERSION, case: publicCaseSummary(updated), quote, queued_message: msg, payment_summary: buildCasePaymentSummary(store, c.id) });
});

app.post('/api/staff/quotes/:id/status', requireStaff, (req, res) => {
  const quote = store.find('quotes', (q) => q.id === req.params.id && !q.deleted_at);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found.' });
  const allowed = new Set(['draft','sent','customer_approved','customer_declined','expired','converted_to_payment_request','paid','cancelled','refunded','voided']);
  const status = allowed.has(String((req.body || {}).status || '')) ? String((req.body || {}).status) : quote.status;
  const patch = { status, staff_note: safeDisplay((req.body || {}).staff_note || '', 1200), updated_by: req.staff.id };
  const updated = store.update('quotes', quote.id, patch);
  if (updated && updated.case_id) store.update('cases', updated.case_id, { quote_status: updated.status, status: updated.status === 'customer_approved' ? 'quote_approved_payment_needed' : (updated.status === 'sent' ? 'quote_sent_to_customer' : undefined) });
  store.addEvent('staff_quote_status_updated', { quote_id: quote.id, status }, req);
  res.json({ ok: true, version: APP_VERSION, quote: updated });
});

app.post('/api/staff/quotes/:id/payment-request', requireStaff, (req, res) => {
  const quote = store.find('quotes', (q) => q.id === req.params.id && !q.deleted_at);
  if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found.' });
  if (!['customer_approved','converted_to_payment_request'].includes(String(quote.status || ''))) return res.status(409).json({ ok: false, error: 'Customer approval is required before converting this quote to a payment request.', quote });
  const payment = createPaymentRequestFromQuote(store, quote, req.staff);
  const c = quote.case_id ? store.find('cases', (item) => item.id === quote.case_id && !item.deleted_at) : null;
  if (c) store.update('cases', c.id, { payment_status: payment.status, payment_request_id: payment.id, selected_tier: quote.product_type, status: 'payment_requested_after_quote_approval' });
  const msg = createSafeMessageEvent(store, { caseData: c || { id: quote.case_id, email: quote.email }, templateKey: 'payment_request', payload: { quote_id: quote.id, payment_id: payment.id }, actor: req.staff, status: 'queued_manual_send' });
  store.addEvent('staff_payment_request_created_from_quote', { quote_id: quote.id, payment_id: payment.id, case_id: quote.case_id }, req);
  res.json({ ok: true, version: APP_VERSION, payment, queued_message: msg, payment_summary: buildCasePaymentSummary(store, quote.case_id) });
});

app.post('/api/staff/transactional-messages', requireStaff, (req, res) => {
  const caseId = safeDisplay((req.body || {}).case_id || '', 120);
  const c = caseId ? store.find('cases', (item) => item.id === caseId && !item.deleted_at) : {};
  const msg = createSafeMessageEvent(store, { caseData: c || {}, templateKey: (req.body || {}).template_key || 'quote_ready', target: { email: (req.body || {}).email || (c && c.email) || '' }, payload: req.body || {}, actor: req.staff, status: (req.body || {}).status || 'queued_manual_send' });
  store.addEvent('staff_transactional_message_recorded', { message_id: msg.id, case_id: msg.case_id, template_key: msg.template_key, status: msg.status }, req);
  res.json({ ok: true, version: APP_VERSION, message: msg, policy: PAYMENT_QUOTE_EMAIL_POLICY });
});


app.get('/api/staff/professional-session-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: buildSessionBoard(store) });
});

app.get('/api/staff/professional-room/:caseId', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.caseId && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const room = buildProfessionalRoom(c, { requestedLevel: req.query.level || c.professional_session_level || '', customerRequestedProfessional: c.customer_requested_professional });
  store.addEvent('professional_room_viewed', { case_id: c.id, room_status: room.roomStatus, requested_level: req.query.level || c.professional_session_level || '' }, req);
  res.json({ ok: true, version: APP_VERSION, room });
});


app.post('/api/staff/professional-session-requests/:id/appointment-message', requireStaff, (req, res) => {
  const request = store.find('professional_session_requests', (r) => r.id === req.params.id && !r.deleted_at);
  if (!request) return res.status(404).json({ ok: false, error: 'Professional session request not found.' });
  const msg = createAppointmentMessage(store, request, req.body || {}, req.staff || {});
  store.addEvent('staff_appointment_message_recorded', { request_id: request.id, message_id: msg.id, template_key: msg.template_key, status: msg.status }, req);
  res.json({ ok: true, version: APP_VERSION, message: msg, request: store.find('professional_session_requests', (r) => r.id === request.id) || request });
});

app.post('/api/staff/professional-session-requests/:id/reminder', requireStaff, (req, res) => {
  const request = store.find('professional_session_requests', (r) => r.id === req.params.id && !r.deleted_at);
  if (!request) return res.status(404).json({ ok: false, error: 'Professional session request not found.' });
  const msg = createAppointmentMessage(store, request, { ...(req.body || {}), template_key: 'appointment_reminder' }, req.staff || {});
  store.addEvent('staff_appointment_reminder_recorded', { request_id: request.id, message_id: msg.id, status: msg.status }, req);
  res.json({ ok: true, version: APP_VERSION, message: msg, request: store.find('professional_session_requests', (r) => r.id === request.id) || request });
});

app.post('/api/staff/professional-session-requests/:id/reschedule-cancel', requireStaff, (req, res) => {
  const request = store.find('professional_session_requests', (r) => r.id === req.params.id && !r.deleted_at);
  if (!request) return res.status(404).json({ ok: false, error: 'Professional session request not found.' });
  const statusPatch = safeDisplay((req.body || {}).session_status || '', 80);
  if (['reschedule_requested','cancelled','canceled','blocked','scheduled'].includes(statusPatch)) store.update('professional_session_requests', request.id, { status: statusPatch === 'canceled' ? 'cancelled' : statusPatch, scheduling_status: statusPatch, reschedule_cancel_note: safeDisplay((req.body || {}).staff_note || (req.body || {}).note || '', 1000) });
  const msg = createAppointmentMessage(store, request, { ...(req.body || {}), template_key: 'appointment_reschedule_cancel' }, req.staff || {});
  store.addEvent('staff_appointment_reschedule_cancel_recorded', { request_id: request.id, message_id: msg.id, status: statusPatch || request.status }, req);
  res.json({ ok: true, version: APP_VERSION, message: msg, request: store.find('professional_session_requests', (r) => r.id === request.id) || request });
});

app.post('/api/staff/professional-session-requests/:id/status', requireStaff, (req, res) => {
  const request = store.find('professional_session_requests', (r) => r.id === req.params.id && !r.deleted_at);
  if (!request) return res.status(404).json({ ok: false, error: 'Professional session request not found.' });
  const allowed = new Set(['requested_needs_pre_session_cleanup','requested_ready_for_staff_confirmation','quote_sent','quote_approved','scheduled','in_progress','completed','cancelled','blocked']);
  const status = allowed.has(String((req.body || {}).status || '')) ? String(req.body.status) : request.status;
  const patch = { status, staff_note: safeDisplay((req.body || {}).staff_note || '', 1200), scheduling_status: safeDisplay((req.body || {}).scheduling_status || request.scheduling_status || '', 80), quote_status: safeDisplay((req.body || {}).quote_status || request.quote_status || '', 120), updated_by: req.staff.id };
  const updated = store.update('professional_session_requests', request.id, patch);
  store.addEvent('professional_session_status_updated', { request_id: request.id, status }, req);
  res.json({ ok: true, version: APP_VERSION, request: updated });
});

app.post('/api/staff/professional-session-requests/:id/schedule', requireStaff, (req, res) => {
  const updated = updateProfessionalSessionSchedule(store, req.params.id, req.body || {}, req.staff || {});
  if (!updated) return res.status(404).json({ ok: false, error: 'Professional session request not found.' });
  const c = updated.case_id ? store.find('cases', (item) => item.id === updated.case_id && !item.deleted_at) : {};
  const readiness = buildSchedulingReadiness({ caseData: c || {}, sessionRequest: updated });
  store.addEvent('professional_session_schedule_updated', { request_id: updated.id, case_id: updated.case_id, scheduling_status: updated.scheduling_status, meeting_provider: updated.meeting_provider }, req);
  res.json({ ok: true, version: APP_VERSION, request: updated, scheduling_readiness: readiness });
});


app.get('/api/staff/cases', requireStaff, (req, res) => res.json({ ok: true, cases: store.list('cases').slice(0, Number(req.query.limit) || 200) }));

app.get('/api/staff/review-queue', requireStaff, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at && (String(c.status || '').includes('review') || c.payment_status === 'paid' || c.risk_level === 'high'));
  const requests = store.list('review_requests', (r) => !r.deleted_at);
  res.json({ ok: true, queue: cases.map((c) => ({ ...publicCaseSummary(c), review_plan: c.review_plan || buildReviewPlan(c), review_requests: requests.filter((r) => r.case_id === c.id) })) });
});

app.get('/api/staff/document-review-queue', requireStaff, (req, res) => {
  const cases = store.list('cases', (c) => !c.deleted_at).map((c) => {
    const plan = c.field_fill_plan || buildFieldFillPlan(c, c.documents || []);
    return { id: c.id, email: c.email, name: c.name, pathway: c.pathway, risk_level: c.risk_level, status: c.status, document_count: c.document_count || 0, client_done_uploading: Boolean(c.client_done_uploading), document_readiness_score: plan.readiness_score, missing_document_types: plan.missing_document_types, field_targets_count: plan.field_targets.length, created_at: c.created_at };
  }).sort((a, b) => Number(b.client_done_uploading) - Number(a.client_done_uploading) || (b.document_readiness_score - a.document_readiness_score));
  res.json({ ok: true, cases });
});

app.get('/api/staff/cases/:id/workpaper-binder', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const plan = buildFieldFillPlan(c, c.documents || []);
  const binder = workpaperBinderForCase(c, c.documents || []);
  store.update('cases', c.id, { field_fill_plan: plan, document_binder: binder, document_readiness_score: plan.readiness_score });
  store.addEvent('staff_workpaper_binder_viewed', { case_id: c.id, readiness_score: plan.readiness_score }, req);
  res.json({ ok: true, case: c, field_fill_plan: plan, document_binder: binder });
});

app.get('/api/staff/professionals', requireStaff, (req, res) => {
  const professionals = store.list('professionals', (p) => !p.deleted_at).map((pro) => ({
    ...professionalPublicView(pro),
    verification_plan: buildCredentialVerificationPlan(pro)
  }));
  res.json({ ok: true, roles: REVIEW_ROLES, professionals, credentialRequirementMatrix: CREDENTIAL_REQUIREMENT_MATRIX });
});

app.get('/api/staff/professional-operations-readiness', requireStaff, (req, res) => {
  const professionals = store.list('professionals', (p) => !p.deleted_at);
  const cases = store.list('cases', (c) => !c.deleted_at);
  res.json({ ok: true, version: APP_VERSION, readiness: buildProfessionalOperationsReadiness({ professionals, cases }) });
});

app.get('/api/staff/professional-operations-board', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, board: buildProfessionalOperationsBoard(store) });
});

app.get('/api/staff/professional-credential-renewal-queue', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, queue: buildCredentialRenewalQueue(store.list('professionals', (p) => !p.deleted_at)) });
});

app.get('/api/staff/professional-assignment-matrix', requireStaff, (req, res) => {
  res.json({ ok: true, version: APP_VERSION, matrix: buildProfessionalAssignmentMatrix(store.list('cases', (c) => !c.deleted_at), store.list('professionals', (p) => !p.deleted_at)) });
});


app.post('/api/staff/professionals', requireStaff, (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.email) return res.status(400).json({ ok: false, error: 'Professional name and email are required.' });
  const role = REVIEW_ROLES.find((r) => r.key === body.role_key) || REVIEW_ROLES[0];
  const existing = store.find('professionals', (p) => !p.deleted_at && String(p.email || '').toLowerCase() === String(body.email || '').toLowerCase());
  if (existing) return res.json({ ok: true, professional: professionalPublicView(existing) });
  const proPayload = {
    id: `pro_${uuidv4()}`,
    name: safeDisplay(body.name, 160),
    email: safeDisplay(body.email, 180).toLowerCase(),
    role_key: role.key,
    role_label: role.label,
    credentials: safeDisplay(body.credentials || '', 240),
    status: safeDisplay(body.status || 'pending_verification', 80),
    can_sign_returns: Boolean(body.can_sign_returns === true || body.can_sign_returns === 'true' || role.canSignReturn),
    can_handle_notices: Boolean(body.can_handle_notices === true || body.can_handle_notices === 'true' || ['ea','cpa','tax_attorney','ptin_preparer'].includes(role.key)),
    can_handle_tax_debt: Boolean(body.can_handle_tax_debt === true || body.can_handle_tax_debt === 'true' || ['ea','cpa','tax_attorney'].includes(role.key)),
    ptin_last4: safeDisplay(body.ptin_last4 || '', 4),
    ptin_status: safeDisplay(body.ptin_status || 'not_recorded', 80),
    ptin_expires_at: safeDisplay(body.ptin_expires_at || '', 40),
    ny_tprin: safeDisplay(body.ny_tprin || '', 80),
    ny_preparer_registration_status: safeDisplay(body.ny_preparer_registration_status || 'not_recorded', 80),
    ny_tprin_expires_at: safeDisplay(body.ny_tprin_expires_at || '', 40),
    license_jurisdiction: safeDisplay(body.license_jurisdiction || '', 80),
    license_number: safeDisplay(body.license_number || '', 120),
    license_expires_at: safeDisplay(body.license_expires_at || '', 40),
    ea_number: safeDisplay(body.ea_number || '', 120),
    ea_expires_at: safeDisplay(body.ea_expires_at || '', 40),
    identity_verified: Boolean(body.identity_verified),
    background_review_status: safeDisplay(body.background_review_status || 'not_started', 80),
    credential_status: safeDisplay(body.credential_status || 'not_started', 80),
    engagement_scope: safeDisplay(body.engagement_scope || '', 1200),
    notes: safeDisplay(body.notes || '', 1200),
    created_by: req.staff.id
  };
  const enriched = professionalCredentialProfile(proPayload, req.staff || req.user || {});
  proPayload.compliance_score = enriched.compliance_score;
  proPayload.verification_plan = enriched.verification_plan;
  proPayload.client_disclosure = enriched.client_disclosure || proPayload.client_disclosure || '';
  const pro = store.insert('professionals', proPayload);
  store.addEvent('professional_created', { professional_id: pro.id, role_key: pro.role_key, compliance_score: pro.compliance_score }, req);
  res.json({ ok: true, professional: { ...professionalPublicView(pro), verification_plan: buildCredentialVerificationPlan(pro) }, compliance_score: pro.compliance_score, requirements: PREPARER_COMPLIANCE_REQUIREMENTS[pro.role_key] || [] });
});

app.post('/api/staff/professionals/:id/verify', requireStaff, (req, res) => {
  const pro = store.find('professionals', (p) => p.id === req.params.id && !p.deleted_at);
  if (!pro) return res.status(404).json({ ok: false, error: 'Professional not found.' });
  const body = req.body || {};
  const patch = {
    status: safeDisplay(body.status || pro.status || 'active', 80),
    credential_status: safeDisplay(body.credential_status || pro.credential_status || 'verified_by_staff', 80),
    ptin_last4: safeDisplay(body.ptin_last4 || pro.ptin_last4 || '', 4),
    ptin_status: safeDisplay(body.ptin_status || pro.ptin_status || 'recorded_if_required', 80),
    ptin_expires_at: safeDisplay(body.ptin_expires_at || pro.ptin_expires_at || '', 40),
    ny_tprin: safeDisplay(body.ny_tprin || pro.ny_tprin || '', 80),
    ny_preparer_registration_status: safeDisplay(body.ny_preparer_registration_status || pro.ny_preparer_registration_status || 'checked_if_required', 80),
    ny_tprin_expires_at: safeDisplay(body.ny_tprin_expires_at || pro.ny_tprin_expires_at || '', 40),
    license_jurisdiction: safeDisplay(body.license_jurisdiction || pro.license_jurisdiction || '', 80),
    license_number: safeDisplay(body.license_number || pro.license_number || '', 120),
    license_expires_at: safeDisplay(body.license_expires_at || pro.license_expires_at || '', 40),
    ea_number: safeDisplay(body.ea_number || pro.ea_number || '', 120),
    ea_expires_at: safeDisplay(body.ea_expires_at || pro.ea_expires_at || '', 40),
    identity_verified: body.identity_verified !== undefined ? Boolean(body.identity_verified) : Boolean(pro.identity_verified),
    background_review_status: safeDisplay(body.background_review_status || pro.background_review_status || 'reviewed', 80),
    engagement_scope: safeDisplay(body.engagement_scope || pro.engagement_scope || '', 1200),
    verified_by: req.staff.id,
    verified_at: new Date().toISOString()
  };
  const enrichedPatch = professionalCredentialProfile({ ...pro, ...patch }, req.staff || req.user || {});
  patch.compliance_score = enrichedPatch.compliance_score;
  patch.verification_plan = enrichedPatch.verification_plan;
  patch.client_disclosure = enrichedPatch.client_disclosure || pro.client_disclosure || '';
  const updated = store.update('professionals', pro.id, patch);
  store.addEvent('professional_verified_or_updated', { professional_id: pro.id, status: patch.status, compliance_score: patch.compliance_score, approved_for_assignment: patch.verification_plan.approved_for_assignment }, req);
  res.json({ ok: true, professional: { ...professionalPublicView(updated), verification_plan: buildCredentialVerificationPlan(updated) }, compliance_score: patch.compliance_score, requirements: PREPARER_COMPLIANCE_REQUIREMENTS[updated.role_key] || [] });
});

app.post('/api/staff/professionals/:id/credential-profile', requireStaff, (req, res) => {
  const pro = store.find('professionals', (p) => p.id === req.params.id && !p.deleted_at);
  if (!pro) return res.status(404).json({ ok: false, error: 'Professional not found.' });
  const profile = professionalCredentialProfile({ ...pro, ...(req.body || {}) }, req.staff || req.user || {});
  const updated = store.update('professionals', pro.id, profile);
  store.addEvent('professional_credential_profile_updated', { professional_id: pro.id, role_key: updated.role_key, compliance_score: updated.compliance_score, approved_for_assignment: updated.verification_plan && updated.verification_plan.approved_for_assignment }, req);
  res.json({ ok: true, version: APP_VERSION, professional: { ...professionalPublicView(updated), verification_plan: buildCredentialVerificationPlan(updated) } });
});

app.get('/api/staff/professionals/:id/verification-plan', requireStaff, (req, res) => {
  const pro = store.find('professionals', (p) => p.id === req.params.id && !p.deleted_at);
  if (!pro) return res.status(404).json({ ok: false, error: 'Professional not found.' });
  res.json({ ok: true, version: APP_VERSION, professional: professionalPublicView(pro), verification_plan: buildCredentialVerificationPlan(pro), requirements: PREPARER_COMPLIANCE_REQUIREMENTS[pro.role_key] || [] });
});

app.get('/api/staff/cases/:id/reviewer-recommendation', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  res.json({ ok: true, version: APP_VERSION, recommendation: recommendCaseReviewer(c, store.list('professionals', (p) => !p.deleted_at)) });
});

app.post('/api/staff/cases/:id/assign-reviewer', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const pro = store.find('professionals', (p) => !p.deleted_at && p.id === (req.body || {}).professional_id);
  if (!pro) return res.status(404).json({ ok: false, error: 'Professional not found.' });
  const verificationPlan = buildCredentialVerificationPlan(pro);
  if (!verificationPlan.approved_for_assignment && (req.body || {}).override_assignment_gate !== true) {
    return res.status(409).json({ ok: false, error: 'Professional credential/assignment gate is not complete.', verification_plan: verificationPlan });
  }
  const recommendation = recommendCaseReviewer(c, store.list('professionals', (p) => !p.deleted_at));
  const updated = store.update('cases', c.id, { assigned_professional_id: pro.id, assigned_professional_name: pro.name, assigned_professional_role: pro.role_label || pro.role_key, assigned_professional_role_key: pro.role_key, assigned_professional_verification_snapshot: verificationPlan, reviewer_assignment_recommendation: recommendation, status: 'assigned_for_professional_review', assigned_at: new Date().toISOString(), assigned_by: req.staff.id });
  store.addEvent('case_assigned_to_professional', { case_id: c.id, professional_id: pro.id, professional_role: pro.role_key, approved_for_assignment: verificationPlan.approved_for_assignment }, req);
  res.json({ ok: true, case: updated, professional: { ...professionalPublicView(pro), verification_plan: verificationPlan }, recommendation });
});

app.post('/api/staff/cases/:id/professional-signoff', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const pro = store.find('professionals', (p) => !p.deleted_at && p.id === ((req.body || {}).professional_id || c.assigned_professional_id));
  if (!pro) return res.status(404).json({ ok: false, error: 'Professional not found or not assigned.' });
  const signoff = createProfessionalSignoff(store, c, pro, req.body || {}, req.staff || req.user || {});
  const updated = store.find('cases', (item) => item.id === c.id && !item.deleted_at) || c;
  store.addEvent('professional_signoff_recorded', { case_id: c.id, professional_id: pro.id, signoff_type: signoff.signoff_type, final_release_allowed: signoff.final_release_allowed }, req);
  res.json({ ok: true, version: APP_VERSION, case: updated, signoff, disclosure: buildClientReviewerDisclosure(updated, pro, store.list('professional_signoffs', (s) => s.case_id === c.id && !s.deleted_at)) });
});

app.get('/api/staff/cases/:id/reviewer-disclosure', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const pro = c.assigned_professional_id ? store.find('professionals', (p) => p.id === c.assigned_professional_id && !p.deleted_at) : null;
  const signoffs = store.list('professional_signoffs', (s) => s.case_id === c.id && !s.deleted_at);
  res.json({ ok: true, version: APP_VERSION, disclosure: buildClientReviewerDisclosure(c, pro, signoffs) });
});

app.post('/api/staff/cases/:id/review-note', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const note = store.insert('review_notes', {
    id: `note_${uuidv4()}`,
    case_id: c.id,
    author_id: req.staff.id,
    author_role: req.staff.role || 'staff',
    note_type: safeDisplay((req.body || {}).note_type || 'review_note', 80),
    body: safeDisplay((req.body || {}).body || '', 3000),
    visible_to_client: (req.body || {}).visible_to_client !== false,
    requires_professional_signoff: Boolean((req.body || {}).requires_professional_signoff),
    professional_signoff_id: safeDisplay((req.body || {}).professional_signoff_id || '', 120)
  });
  const updated = store.update('cases', c.id, { status: safeDisplay((req.body || {}).case_status || c.status || 'under_human_tax_review', 80), last_review_note_at: new Date().toISOString() });
  store.addEvent('review_note_created', { case_id: c.id, note_id: note.id, visible_to_client: note.visible_to_client }, req);
  res.json({ ok: true, note, case: updated });
});

app.get('/api/staff/cases/:id/compliance-checklist', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const pro = c.assigned_professional_id ? store.find('professionals', (p) => p.id === c.assigned_professional_id && !p.deleted_at) : null;
  const checklist = checklistForCase(c);
  const gate = releaseGateStatus({ taxCase: c, checklistItems: checklist, professional: pro });
  res.json({ ok: true, case_id: c.id, checklist, completed_keys: c.compliance_completed_keys || [], release_gate: gate, assigned_professional: pro ? professionalPublicView(pro) : null });
});

app.post('/api/staff/cases/:id/compliance-checklist', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const incoming = Array.isArray((req.body || {}).completed_keys) ? req.body.completed_keys.map(String) : [];
  const current = new Set((c.compliance_completed_keys || []).map(String));
  for (const key of incoming) current.add(key);
  const checklistRecord = store.insert('compliance_checklists', { id: `chk_${uuidv4()}`, case_id: c.id, completed_keys: Array.from(current), staff_note: safeDisplay((req.body || {}).staff_note || '', 1200), updated_by: req.staff.id });
  const updated = store.update('cases', c.id, { compliance_completed_keys: Array.from(current), last_compliance_checklist_id: checklistRecord.id, compliance_updated_at: new Date().toISOString() });
  store.addEvent('case_compliance_checklist_updated', { case_id: c.id, completed_count: current.size }, req);
  res.json({ ok: true, case: updated, checklist_record: checklistRecord, release_gate: releaseGateStatus({ taxCase: updated, checklistItems: checklistForCase(updated), professional: updated.assigned_professional_id ? store.find('professionals', (p) => p.id === updated.assigned_professional_id) : null }) });
});

app.post('/api/cases/:id/client-approval', requireUser, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c || (c.user_id && c.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const approval = store.insert('client_approvals', { id: `appr_${uuidv4()}`, case_id: c.id, user_id: req.user.id, approval_type: safeDisplay((req.body || {}).approval_type || 'facts_and_release_review', 80), client_statement: safeDisplay((req.body || {}).client_statement || 'I reviewed the information and understand no tax result is guaranteed.', 1500), no_guarantee_acknowledged: Boolean((req.body || {}).no_guarantee_acknowledged !== false), ip_hash: hashForAudit(String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()) });
  const completed = new Set((c.compliance_completed_keys || []).map(String));
  completed.add('client_approval_captured');
  completed.add('no_guarantee_acknowledged');
  const updated = store.update('cases', c.id, { client_final_approval_at: new Date().toISOString(), client_approval_id: approval.id, compliance_completed_keys: Array.from(completed) });
  store.addEvent('client_approval_recorded', { case_id: c.id, approval_id: approval.id }, req);
  res.json({ ok: true, case: publicCaseSummary(updated), approval });
});

app.post('/api/staff/cases/:id/release-to-client', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const assignedPro = c.assigned_professional_id ? store.find('professionals', (p) => p.id === c.assigned_professional_id && !p.deleted_at) : null;
  const gate = releaseGateStatus({ taxCase: c, checklistItems: checklistForCase(c), professional: assignedPro });
  if (!gate.releasable && (req.body || {}).override_release_gate !== true) return res.status(409).json({ ok: false, error: 'Release gate is not complete.', release_gate: gate });
  const release = store.insert('release_events', {
    id: `rel_${uuidv4()}`,
    case_id: c.id,
    released_by: req.staff.id,
    release_type: safeDisplay((req.body || {}).release_type || 'review_summary', 80),
    payment_verified: Boolean(c.payment_status === 'paid' || (req.body || {}).payment_verified === true),
    professional_reviewed: Boolean(c.assigned_professional_id || (req.body || {}).professional_reviewed === true),
    release_note: safeDisplay((req.body || {}).release_note || 'Review summary released to client dashboard.', 1500),
    compliance_notice: 'Client must confirm facts and use a qualified preparer/professional before filing, signing, or responding where required.'
  });
  const updated = store.update('cases', c.id, { status: 'released_to_client', release_status: 'released_to_client', released_at: new Date().toISOString(), released_by: req.staff.id });
  store.addEvent('case_released_to_client', { case_id: c.id, release_id: release.id }, req);
  res.json({ ok: true, case: updated, release, release_gate: gate });
});
app.post('/api/staff/cases/:id/status', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const patch = { status: safeDisplay(req.body.status || c.status || 'staff_review', 80), staff_note: safeDisplay(req.body.staff_note || c.staff_note || '', 2000), staff_updated_by: req.staff.id, staff_updated_at: new Date().toISOString() };
  let updated = store.update('cases', c.id, patch);
  updated = store.update('cases', c.id, { customer_status_copy: buildCustomerStatusCopy(updated || c) }) || updated;
  store.addEvent('staff_case_status_updated', { case_id: c.id, status: patch.status }, req);
  res.json({ ok: true, case: updated });
});

app.post('/api/staff/cases/:id/mock-payment', requireStaff, (req, res) => {
  const c = store.find('cases', (item) => item.id === req.params.id && !item.deleted_at);
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found.' });
  const product = safeDisplay(req.body.product_type || c.selected_tier || 'tax_debt_notice_review', 80);
  const tier = pricingTierForProduct(product);
  if (!tier) return res.status(400).json({ ok: false, error: 'Unknown product tier.' });
  const payment = store.insert('payments', { id: `pay_${uuidv4()}`, case_id: c.id, email: c.email, product_type: product, amount_total_cents: tier.publicPriceCents, status: 'paid', referral_code: c.referral_code || '', staff_created: true });
  const reward = createReferralRewardForPayment(payment);
  const updated = store.update('cases', c.id, { payment_status: 'paid', selected_tier: product, paid_at: new Date().toISOString() });
  store.addEvent('staff_mock_payment_recorded', { case_id: c.id, product_type: product, reward_created: Boolean(reward) }, req);
  res.json({ ok: true, payment, reward, case: updated });
});

app.get('/api/staff/referral-attribution-verifier', requireStaff, (req, res) => {
  const code = normalizeReferralCode(req.query.code || '');
  const scans = store.list('qr_scans', (q) => !code || normalizeReferralCode(q.referrer_code) === code);
  const users = store.list('users', (u) => !code || normalizeReferralCode(u.referral_code) === code || normalizeReferralCode(u.referred_by_code) === code);
  const cases = store.list('cases', (c) => !code || normalizeReferralCode(c.referral_code) === code || normalizeReferralCode(c.helper_code) === code);
  const rewards = store.list('referral_rewards', (r) => !code || normalizeReferralCode(r.referrer_code) === code);
  res.json({ ok: true, code, chain: [{ step: 'tracked_qr_or_flyer_scan', count: scans.length }, { step: 'signup_referral_lock', count: users.filter((u) => normalizeReferralCode(u.referred_by_code) === code).length }, { step: 'case_referral_lock', count: cases.length }, { step: 'reward_ledger', count: rewards.length }], scans: scans.slice(0, 25), users: users.slice(0, 25).map(publicUser), cases: cases.slice(0, 25), rewards: rewards.slice(0, 25), protection: 'Original referral code is locked at signup/case creation and carried into payment/reward review.' });
});

app.get('/api/staff/referral-reward-ledger', requireStaff, (req, res) => {
  const rewards = store.list('referral_rewards', (r) => !r.deleted_at);
  res.json({ ok: true, summary: summarizeRewards(rewards), rewards });
});

app.post('/api/staff/referral-rewards/:id/status', requireStaff, (req, res) => {
  const reward = store.find('referral_rewards', (r) => r.id === req.params.id && !r.deleted_at);
  if (!reward) return res.status(404).json({ ok: false, error: 'Reward not found.' });
  const allowed = new Set(['pending','approved','paid','held','denied','reversed','needs_review']);
  const status = allowed.has(String(req.body.status || '')) ? req.body.status : 'pending';
  const updated = store.update('referral_rewards', reward.id, { status, staff_note: safeDisplay(req.body.staff_note || '', 1200), reviewed_by: req.staff.id, reviewed_at: new Date().toISOString() });
  store.addEvent('referral_reward_status_updated', { reward_id: reward.id, status }, req);
  res.json({ ok: true, reward: updated });
});

app.post('/api/admin/users/:id/role', adminGuard, (req, res) => {
  const user = store.find('users', (u) => u.id === req.params.id && !u.deleted_at);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
  const allowedRoles = new Set(Object.keys(ROLE_PERMISSIONS));
  const role = String((req.body || {}).role || user.role || 'client').toLowerCase();
  if (!allowedRoles.has(role)) return res.status(400).json({ ok: false, error: 'Unknown role.' });
  const updated = store.update('users', user.id, { role, staff_status: safeDisplay((req.body || {}).staff_status || (role === 'client' ? '' : 'active'), 80) });
  store.addEvent('admin_user_role_updated', { user_id: user.id, role }, req);
  res.json({ ok: true, user: publicUser(updated) });
});

app.post('/api/staff/invites', requireStaff, (req, res) => {
  if (!hasPermission(req.staff || req.user, 'case:assign') && !['admin','owner'].includes(String((req.staff || req.user || {}).role || '').toLowerCase())) return res.status(403).json({ ok: false, error: 'Staff invite permission required.' });
  const email = safeDisplay((req.body || {}).email || '', 180).toLowerCase();
  const role = String((req.body || {}).role || 'staff').toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'Valid email required.' });
  const token = store.createTokenRecord('staff_invites', { email, role, invited_by: (req.staff || req.user).id, purpose: 'staff_invite' }, 7 * 24 * 60);
  store.addEvent('staff_invite_created', { email_hash: hashForAudit(email), role }, req);
  res.json({ ok: true, email, role, expires_at: token.record.expires_at, dev_invite_token: process.env.NODE_ENV === 'production' ? undefined : token.rawToken });
});

app.get('/api/staff/export/:type', requireStaff, (req, res) => {
  const type = req.params.type;
  const rows = [];
  if (type === 'cases') rows.push(['id','email','pathway','risk_level','status','referral_code','payment_status','created_at'], ...store.list('cases').map((c) => [c.id,c.email,c.pathway,c.risk_level,c.status,c.referral_code,c.payment_status || '',c.created_at]));
  else if (type === 'referrals') rows.push(['code','email','name','organization','status','created_at'], ...store.list('referrals').map((r) => [r.code,r.email,r.partner_name,r.organization,r.status,r.created_at]));
  else if (type === 'rewards') rows.push(['id','referrer_code','referred_email','case_id','product_type','status','reward_amount_cents','created_at'], ...store.list('referral_rewards').map((r) => [r.id,r.referrer_code,r.referred_email,r.case_id,r.product_type,r.status,r.reward_amount_cents,r.created_at]));
  else if (type === 'review-queue') rows.push(['id','email','pathway','risk_level','status','assigned_professional_id','review_recommended_product','release_status','created_at'], ...store.list('cases').map((c) => [c.id,c.email,c.pathway,c.risk_level,c.status,c.assigned_professional_id || '',c.review_recommended_product || '',c.release_status || '',c.created_at]));
  else if (type === 'professionals') rows.push(['id','name','email','role_key','credentials','status','created_at'], ...store.list('professionals').map((pro) => [pro.id,pro.name,pro.email,pro.role_key,pro.credentials,pro.status,pro.created_at]));
  else if (type === 'tasks') rows.push(['id','case_id','lane','label','status','priority','assigned_to','created_at'], ...store.list('tasks').map((t) => [t.id,t.case_id,t.lane,t.label,t.status,t.priority,t.assigned_to || '',t.created_at]));
  else return res.status(404).json({ ok: false, error: 'Unknown export type.' });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="justice-tax-solutions-${type}.csv"`);
  res.send(csv);
});

app.get('/dashboard.html', (req, res, next) => next());
app.get('/start.html', (req, res) => res.redirect(302, '/#start'));

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'API endpoint not found.' }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.listen(PORT, () => console.log(`Justice Tax Solutions v${APP_VERSION} running on ${PORT}`));
