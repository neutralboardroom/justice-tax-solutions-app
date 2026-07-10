const VERSION = '0.1.62';

const CONTINUITY_PRINCIPLES = [
  'Preserve every useful existing feature before adding anything new.',
  'Keep the public start path simple: file personal, file business, review past returns, Free Truth Check, fix a tax problem, or not sure.',
  'Make prior-return review/amendment screening prominent, but never guarantee refund, savings, acceptance, or benefit.',
  'Separate free starting summaries from paid filing, amendment preparation, business tax work, bookkeeping cleanup, and professional review.',
  'Keep public users away from unredacted sensitive tax uploads while live sensitive-upload gates remain blocked.',
  'Treat official IRS/NYS/NYC PDFs as admin/staff source material until PDF mapping, visual QA, release, and security gates pass.',
  'Keep staff/owner readiness pages clearly operational rather than customer marketing pages.',
  'Do not claim live e-file, agency submission, direct debit, Refund Transfer, refund advance, automatic scheduling, live email, or professional representation unless configured and verified.'
];

const CUSTOMER_FLOW_QUALITY_GATE = {
  title: 'Customer flow quality gate',
  goal: 'A user should know what to do next without needing to understand tax form numbers or internal platform status.',
  checkpoints: [
    { key: 'first_choice', status: 'polished', check: 'The first choice is a public path, not an internal workflow: personal return, business return, review past returns, Free Truth Check, fix a tax problem, or not sure.' },
    { key: 'free_start_explained', status: 'polished', check: 'The user sees that the first Truth Check and first amendment screening are free starting points.' },
    { key: 'paid_boundary', status: 'polished', check: 'Paid filing, amendment preparation, bookkeeping cleanup, professional review, or response preparation is explained before the user chooses it.' },
    { key: 'document_boundary', status: 'hardened', check: 'The user is reminded not to upload originals, full SSNs, EINs, bank data, full returns, transcripts, or unredacted notices in controlled mode.' },
    { key: 'next_step_output', status: 'polished', check: 'Each path produces or prepares a clear summary: filing readiness, business readiness, amendment opportunity, Truth Check, or urgency triage.' }
  ],
  public_copy: [
    'Start with the return, business records, letter, or question.',
    'You do not need to know the correct tax form number.',
    'Your first starting summary is free; paid help is explained before you choose it.',
    'Use no-file or redacted/sample mode while live sensitive uploads are blocked.'
  ]
};

const STAFF_DAILY_OPERATING_MAP = {
  title: 'Staff daily operating map',
  opening_review: [
    'Check new submissions by selected path and urgency before reading details.',
    'Separate filing, business filing, prior-return/amendment, notice, tax debt, payroll/sales-tax, and not-sure cases.',
    'Confirm whether the user received a free starting summary before any paid conversion step.',
    'Flag deadlines, levy/lien/garnishment, court, criminal, trust-fund, payroll, sales-tax, large-balance, and refund-deadline issues.',
    'Confirm no staff note, email, or analytics event includes SSNs, EINs, bank data, full notice text, payroll records, or uploaded file contents.'
  ],
  routing_lanes: [
    { lane: 'General intake/support', use_for: 'Basic classification, missing documents, free summary, and next-step organization.' },
    { lane: 'PTIN/tax preparation support', use_for: 'Return preparation or amendment preparation when operationally supported and within scope.' },
    { lane: 'Accountant/bookkeeper', use_for: 'Business records, bookkeeping cleanup, profit/loss, balance sheet, Schedule C/business expense organization.' },
    { lane: 'Payroll or sales-tax specialist', use_for: 'Payroll deposits, 941/940/W-2/1099, state payroll, sales-tax registration/filing/notice issues.' },
    { lane: 'EA/CPA review', use_for: 'IRS/NYS/NYC notices, collection options, complex amendments, business entity issues, tax debt, and review before action.' },
    { lane: 'Tax attorney review', use_for: 'Legal, criminal, court, fraud, trust-fund, summons, high-risk collection, or representation questions.' }
  ],
  closeout_check: [
    'Is the user’s path clear?',
    'Is the next action written in plain language?',
    'Is a professional route needed or only intake support?',
    'Are final official form output and e-file still blocked?',
    'Is any follow-up message free of private taxpayer facts?'
  ]
};

const PRICING_MESSAGE_ALIGNMENT = {
  title: 'Pricing and payment-message alignment',
  public_promises: [
    'Free first Tax Problem Truth Check / starting summary.',
    'Free first past-return/amendment-opportunity screening where offered as the starting point.',
    'Filing intake can start without a surprise payment gate.',
    'Paid work starts only after scope, available review level, and pricing are explained.'
  ],
  paid_categories: [
    'Personal return preparation or review',
    'Business return preparation or review',
    'Prior-year return preparation',
    'Amended-return preparation or professional review',
    'Notice response preparation',
    'Bookkeeping cleanup or business records review',
    'Payroll/sales-tax specialist routing',
    'CPA/EA/accountant/tax attorney review when available and appropriate'
  ],
  blocked_or_future: [
    'No live Refund Transfer/pay-by-refund claim yet.',
    'No refund advance claim yet.',
    'No live e-file claim yet.',
    'No final official form output fee claim until official PDF QA and release gates pass.',
    'No guaranteed refund, savings, penalty removal, settlement, payment plan, or amendment benefit.'
  ]
};

const SPANISH_PARITY_ACTION_PLAN = {
  title: 'Spanish parity action plan',
  principle: 'Spanish UX should carry the same public value, safety, and free-vs-paid boundaries as English, not just a short translation page.',
  priority_copy: [
    'Presente claramente: presentar una declaración personal, presentar una declaración de negocio, revisar declaraciones pasadas, revisión gratuita inicial, avisos de impuestos y problemas de impuestos.',
    'Use “posible”, “puede”, “conviene revisar” y “sin garantía” para evitar promesas de resultado.',
    'Explique que la revisión profesional en español depende de disponibilidad y confirmación.',
    'Explique que no se deben subir documentos originales, SSN completos, datos bancarios, declaraciones completas ni avisos sin censurar en modo controlado.',
    'Aclare que e-file, formularios finales, Refund Transfer, adelantos de reembolso y envío a agencias no están activos todavía.'
  ],
  staff_rule: 'If a user prefers Spanish, staff should preserve the preference, use plain Spanish when possible, and avoid promising bilingual CPA/EA/tax-attorney review until availability is confirmed.'
};

const MARKETING_SAFETY_REVIEW = {
  title: 'Marketing safety review',
  strong_messages_to_use: [
    'File, fix, review, amend, and understand your taxes.',
    'Tax help for people and businesses who need more than software.',
    'Already filed? A second look may uncover something worth correcting.',
    'Start with the return, business records, letter, or problem.',
    'Your first Truth Check is free.'
  ],
  required_qualifiers: [
    'No refund, savings, amended-return benefit, payment plan, penalty relief, settlement, audit result, or government outcome is guaranteed.',
    'Justice Tax Solutions is not the IRS, NYS, NYC, or a law firm.',
    'Professional review availability depends on scope, credentials, and case complexity.',
    'Government taxes, penalties, interest, agency payments, and filing fees are separate.',
    'Final filing, e-file, official form output, direct debit, Refund Transfer, and refund advance are not live unless later configured and approved.'
  ],
  avoid: [
    'Settle for pennies',
    'Erase your tax debt',
    'Guaranteed refund',
    'We will get you money back',
    'Stop the IRS today',
    'Secret loopholes',
    'IRS-approved unless actually true for a specific program',
    'Bank-level security unless production controls support the claim'
  ]
};

const OFFICIAL_PDF_READINESS_LADDER = [
  { stage: 'Organizer only', output_allowed: false, description: 'User/staff can organize facts, but no final official PDF can be released.' },
  { stage: 'Official PDF uploaded/captured', output_allowed: false, description: 'Exact PDF edition exists in the admin/staff source library.' },
  { stage: 'Checksum and source recorded', output_allowed: false, description: 'Source URL, version/edition, upload date, and checksum are recorded.' },
  { stage: 'Fields or coordinates mapped', output_allowed: false, description: 'Fillable fields or overlay coordinates are locked for the specific PDF edition.' },
  { stage: 'Sample-filled PDF generated', output_allowed: false, description: 'Controlled sample output exists for QA only.' },
  { stage: 'Visual QA passed', output_allowed: false, description: 'Placement, overflow, checkboxes, dates, blanks, signature/preparer fields, and sensitive fields have been inspected.' },
  { stage: 'Case verification and professional/staff release', output_allowed: false, description: 'User values, review level, professional/staff signoff, and payment/quote clearance are complete where required.' },
  { stage: 'Production security and owner approval', output_allowed: true, description: 'Security, storage, retention, audit logs, deletion, and owner release gates are approved for the specific form and workflow.' }
];

const DEPLOYMENT_SMOKE_TEST_PLAN = {
  title: 'Post-deployment smoke-test plan',
  pages: [
    '/',
    '/platform-continuity-polish.html',
    '/platform-readiness-workbench.html',
    '/official-pdf-intake.html',
    '/deployment-readiness.html',
    '/official-forms.html',
    '/file-personal-tax-return.html',
    '/file-business-tax-return.html',
    '/review-past-returns.html',
    '/free-tax-problem-truth-check.html',
    '/dashboard.html',
    '/staff.html',
    '/staff-cockpit.html',
    '/pricing.html',
    '/faq.html',
    '/marketing.html',
    '/ayuda-impuestos-espanol.html',
    '/document-safety-center.html'
  ],
  api_checks: [
    '/health',
    '/api/platform/continuity-polish-audit',
    '/api/platform/customer-flow-quality-gate',
    '/api/platform/staff-daily-operating-map',
    '/api/platform/pricing-message-alignment',
    '/api/platform/spanish-parity-action-plan',
    '/api/platform/marketing-safety-review',
    '/api/platform/official-pdf-readiness-ladder',
    '/api/platform/deployment-smoke-test-plan'
  ],
  must_confirm: [
    'Health version is v0.1.62.',
    'Homepage shows personal filing, business filing, review past returns, Free Truth Check, tax problem, and not sure paths.',
    'Public pages do not claim live sensitive uploads, final official forms, e-file, agency submission, Refund Transfer, or refund advance.',
    'Official PDF intake is admin/staff readiness infrastructure, not a customer upload promise.',
    'Spanish entry points remain visible and careful.',
    'Upload without required acknowledgment remains blocked; redacted/sample mode remains limited.',
    'Staff pages do not expose secrets.'
  ]
};

function buildContinuityPolishAudit({ version = VERSION } = {}) {
  return {
    version,
    title: 'Justice Tax Solutions full-platform continuity polish audit',
    conclusion: 'The platform has been polished for clarity and controlled readiness without adding new IRS form bundles or weakening safety gates.',
    principles: CONTINUITY_PRINCIPLES,
    improved_areas: [
      'customer-facing language',
      'public start flow',
      'dashboard progress guidance',
      'staff daily operating map',
      'pricing/free-vs-paid copy',
      'Spanish parity reminders',
      'marketing safety review',
      'official-PDF readiness ladder',
      'deployment smoke-test plan',
      'upload safety boundary language'
    ],
    go_no_go: {
      public_review: 'go_after_deployment_smoke_test',
      controlled_no_sensitive_users: 'controlled_go',
      real_unredacted_taxpayer_uploads: 'blocked',
      final_official_pdf_output: 'blocked_until_official_pdf_ladder_passes',
      efile_or_agency_submission: 'blocked',
      refund_transfer_or_advance: 'future_only',
      broad_marketing: 'not_yet'
    }
  };
}

module.exports = {
  VERSION,
  CONTINUITY_PRINCIPLES,
  CUSTOMER_FLOW_QUALITY_GATE,
  STAFF_DAILY_OPERATING_MAP,
  PRICING_MESSAGE_ALIGNMENT,
  SPANISH_PARITY_ACTION_PLAN,
  MARKETING_SAFETY_REVIEW,
  OFFICIAL_PDF_READINESS_LADDER,
  DEPLOYMENT_SMOKE_TEST_PLAN,
  buildContinuityPolishAudit
};
