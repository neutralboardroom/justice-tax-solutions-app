const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  OFFICIAL_FORM_DIR,
  inferOfficialFormMetadata,
  formPrioritySummary,
  mappingQueue,
  buildOfficialSourceInventory,
  CONTROLLED_MAPPING_STAGES,
  FIELD_MAPPING_POLICY,
  FORM_SOURCE_COLLECTION_POLICY
} = require('./officialForms');

const VERSION = '0.1.62';

const NO_MORE_FORMS_WITHOUT_OFFICIAL_PDF_POLICY = {
  title: 'No new IRS form buildout without official PDFs',
  decision: 'Pause new logical-only IRS form bundles until Roger uploads official IRS PDFs or a verified official PDF source is captured.',
  reason: 'Website organizers and logical maps are useful, but paid-user-ready official forms require the exact PDF edition, checksum, field/coordinate mapping, sample-filled PDFs, visual QA, client verification, professional/staff release, and production security approval.',
  allowed_work_now: [
    'platform polish and customer-flow improvements',
    'staff dashboard and operations polish',
    'pricing/help/FAQ/marketing language refinement',
    'Spanish parity and bilingual UX polish',
    'upload-safety and no-sensitive-data gate hardening',
    'deployment readiness and smoke-test checklists',
    'official-PDF intake infrastructure and mapping queue preparation'
  ],
  blocked_work_until_pdf: [
    'adding more logical-only IRS form bundles',
    'claiming final official IRS/NYS/NYC form output',
    'claiming e-file or agency submission',
    'claiming paid-user-ready completed forms',
    'collecting full SSNs/EINs/bank data for final form output in public mode'
  ]
};

const OFFICIAL_PDF_READINESS_STAGES = [
  { key: 'uploaded_or_captured', label: 'Official PDF uploaded or captured', required: true },
  { key: 'source_verified', label: 'Official source/edition verified', required: true },
  { key: 'checksum_recorded', label: 'Checksum recorded', required: true },
  { key: 'fields_or_coordinates_locked', label: 'Fillable fields or overlay coordinates locked', required: true },
  { key: 'sample_filled_pdf_generated', label: 'Sample-filled PDF generated', required: true },
  { key: 'visual_qa_passed', label: 'Visual QA passed for placement, overflow, checkboxes, dates, blanks, and signature/preparer areas', required: true },
  { key: 'client_value_verification', label: 'Client values verified for the case', required: true },
  { key: 'professional_or_staff_release', label: 'Professional/staff release recorded where required', required: true },
  { key: 'production_security_gate', label: 'Production security and upload/storage gates approved', required: true },
  { key: 'owner_release', label: 'Owner/staff final release approval recorded', required: true }
];

const CUSTOMER_FLOW_POLISH = {
  homepage: 'Keep five main paths visible: personal filing, business filing, past-return review/amendment check, free Truth Check, and tax-problem help.',
  start_flow: 'Use one unified start path and avoid duplicate/confusing intake pages. The user can begin with no-file mode or redacted/sample documents only.',
  dashboard: 'Show next step, missing items, free-vs-paid boundary, and what remains blocked before final filing or professional review.',
  pricing: 'No surprise charges; explain free Truth Check/free screening before paid preparation, review, amendment filing, business work, or consultation.',
  marketing: 'Lead with filing, business taxes, past-return review, free Truth Check, and calm tax-problem support without guaranteed outcome language.',
  spanish: 'Spanish UX should mirror the English path enough for users to understand safe start, no guarantees, free-vs-paid boundaries, and when professional review is needed.'
};

const STAFF_DASHBOARD_POLISH = {
  lanes: [
    'Classify path: personal filing, business filing, past-return review, notice/Truth Check, tax-problem, not sure.',
    'Confirm no full sensitive taxpayer data is needed for the free first summary.',
    'Flag urgency: deadlines, lien/levy/garnishment, court, criminal, payroll, trust-fund, sales-tax, large balance, or refund-deadline issues.',
    'Route appropriately: intake support, PTIN preparer, accountant/bookkeeper, payroll/sales-tax specialist, EA/CPA, or tax attorney.',
    'Keep official form output blocked unless the official PDF readiness ladder is complete for that form and the specific case.',
    'Keep staff notes and analytics free of SSNs, EINs, full account numbers, bank data, full notice text, and uploaded file contents.'
  ],
  status_labels: [
    'New Personal Filing Intake',
    'New Business Filing Intake',
    'New Past Return Review',
    'New Free Truth Check',
    'Needs official PDF mapping',
    'Needs redacted/sample replacement',
    'Urgent professional review suggested',
    'Paid option explained; waiting for user choice',
    'Official output blocked'
  ]
};

const SPANISH_PARITY_POLISH = {
  principle: 'Spanish pages should not be a small translated afterthought; they should explain the same safe start, free-vs-paid boundary, prior-return review, business-tax help, and document-safety limits in natural Spanish.',
  priority_updates: [
    'Make “Revisar declaraciones pasadas” visible wherever English says Review Past Returns.',
    'Explain “revisión inicial gratuita” and paid amendment preparation boundaries.',
    'Explain that final forms, e-file, Refund Transfer, and refund advances are not active.',
    'Do not promise Spanish-speaking CPA/EA/tax attorney review until availability is confirmed.',
    'Use plain Spanish: aviso/carta de impuestos, deuda de impuestos, declaraciones atrasadas, declaración enmendada/corregida.'
  ]
};

const DEPLOYMENT_READINESS_CLOSEOUT = {
  title: 'Deployment readiness closeout for v0.1.62',
  before_deploy: [
    'Confirm clean ZIP extracts correctly.',
    'Run npm install, npm run check, and npm audit --audit-level=moderate.',
    'Confirm package.json, package-lock, README, docs, health, and smoke tests show v0.1.62.',
    'Confirm no .env, node_modules, data, storage uploads, logs, runtime database, captured PDFs, or secrets are in the ZIP.',
    'Confirm live sensitive upload flags stay false unless Roger separately approves after security gates.'
  ],
  after_deploy: [
    'Check live /health version and expected focus.',
    'Smoke-test homepage, pricing, dashboard, staff, FAQ, Spanish, official forms, official PDF intake, document safety, and deployment readiness pages.',
    'Confirm custom domain/SSL if using justicetaxsolutions.com.',
    'Confirm PUBLIC_BASE_URL before broad public use.',
    'Confirm Stripe/email/calendar/EFIN/refund bank products are not claimed as live unless configured and tested.'
  ],
  go_no_go: {
    public_site_viewing: 'go_after_smoke_test',
    controlled_no_sensitive_users: 'go_with_clear_limits',
    official_pdf_mapping_intake: 'go_for_admin/staff_pdf_capture_and_queue',
    paid_final_form_output: 'blocked_until_pdf_QA_and_operations_release',
    broad_marketing: 'not_yet'
  }
};

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function safePathPart(value = 'item') {
  return String(value || 'item').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'item';
}

function safeText(value = '', max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function storeOfficialPdfFile(packageId, file) {
  fs.mkdirSync(OFFICIAL_FORM_DIR, { recursive: true });
  const folder = path.join(OFFICIAL_FORM_DIR, safePathPart(packageId));
  fs.mkdirSync(folder, { recursive: true });
  const ext = path.extname(file.originalname || '') || '.pdf';
  const fileId = `pdf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const storedName = `${fileId}-${safePathPart(path.basename(file.originalname || 'official-form', ext))}${ext}`;
  const storagePath = path.join(folder, storedName);
  fs.writeFileSync(storagePath, file.buffer);
  return { fileId, storedName, storagePath };
}

function ingestOfficialPdfUploads(store, files = [], options = {}) {
  const pdfs = (files || []).filter((file) => /\.pdf$/i.test(file.originalname || '') || /pdf/i.test(file.mimetype || ''));
  const skipped = (files || []).filter((file) => !(/\.pdf$/i.test(file.originalname || '') || /pdf/i.test(file.mimetype || '')))
    .map((file) => ({ original_name: file.originalname || '', reason: 'Only PDF files are accepted by this endpoint. Use ZIP endpoint for ZIP archives.' }));
  if (!pdfs.length) return { ok: false, error: 'Upload one or more official PDF files in the pdfs field.', skipped };
  const combinedHash = sha256(Buffer.concat(pdfs.map((file) => file.buffer || Buffer.alloc(0))));
  const existing = store.find('official_form_packages', (item) => item.package_sha256 === combinedHash && !item.deleted_at);
  if (existing) return { ok: true, duplicate: true, package: existing, forms: [], skipped, message: 'This exact set of PDF bytes has already been ingested.' };
  const packageRecord = store.insert('official_form_packages', {
    package_sha256: combinedHash,
    original_name: safeText(options.packageName || `official-pdfs-${Date.now()}`, 180),
    agency_hint: safeText(options.agency || '', 20).toUpperCase(),
    tax_year_hint: safeText(options.taxYear || '', 12),
    source_url: safeText(options.sourceUrl || '', 500),
    notes: safeText(options.notes || '', 1000),
    upload_mode: 'individual_official_pdf_files',
    file_count: pdfs.length,
    client_output_allowed: false,
    release_status: 'intake_only_not_client_output_ready'
  });
  const forms = [];
  for (const file of pdfs) {
    const hash = sha256(file.buffer || Buffer.alloc(0));
    const duplicate = store.find('official_forms', (item) => item.sha256 === hash && !item.deleted_at);
    if (duplicate) {
      skipped.push({ original_name: file.originalname, reason: 'Duplicate PDF checksum already exists.', existing_form_id: duplicate.id });
      continue;
    }
    const saved = storeOfficialPdfFile(packageRecord.id, file);
    const metadata = inferOfficialFormMetadata(file.originalname || 'official-form.pdf', { agency: options.agency, taxYear: options.taxYear, sourceUrl: options.sourceUrl });
    const record = store.insert('official_forms', {
      ...metadata,
      package_id: packageRecord.id,
      original_entry_name: file.originalname || metadata.original_entry_name,
      file_name: file.originalname || metadata.file_name,
      stored_name: saved.storedName,
      storage_path: saved.storagePath,
      mime_type: file.mimetype || 'application/pdf',
      byte_size: Number(file.size || (file.buffer ? file.buffer.length : 0)),
      sha256: hash,
      official_source_url: safeText(options.sourceUrl || '', 500),
      uploaded_by_user_id: options.uploadedByUserId || 'admin-token',
      uploaded_via: 'individual_pdf_intake_v0.1.62',
      official_pdf_captured: true,
      checksum_recorded: true,
      can_drive_client_output: false,
      release_status: 'official_pdf_captured_not_mapped_or_client_output_ready',
      readiness_stage: 'official_pdf_captured'
    });
    forms.push(record);
  }
  return { ok: true, duplicate: false, package: packageRecord, forms, skipped, priority_summary: formPrioritySummary(forms) };
}

function buildOfficialPdfIntakeInfrastructure({ store } = {}) {
  const inventory = store ? buildOfficialSourceInventory(store) : null;
  const queue = store ? mappingQueue(store, { onlyNeedsReview: false }).slice(0, 25).map((item) => ({
    id: item.id,
    agency: item.agency,
    form_number: item.form_number,
    tax_year: item.tax_year,
    mapping_status: item.mapping_status,
    fillable_pdf_status: item.fillable_pdf_status,
    release_status: item.release_status,
    can_drive_client_output: Boolean(item.can_drive_client_output)
  })) : [];
  return {
    version: VERSION,
    title: 'Official-PDF intake infrastructure',
    policy: NO_MORE_FORMS_WITHOUT_OFFICIAL_PDF_POLICY,
    readiness_stages: OFFICIAL_PDF_READINESS_STAGES,
    controlled_mapping_stages: CONTROLLED_MAPPING_STAGES,
    field_mapping_policy: FIELD_MAPPING_POLICY,
    source_collection_policy: FORM_SOURCE_COLLECTION_POLICY,
    current_inventory_summary: inventory ? inventory.summary : null,
    queue_preview: queue,
    endpoints: [
      'GET /api/platform/official-pdf-intake-infrastructure',
      'GET /api/platform/no-more-form-buildout-policy',
      'GET /api/tax/official-form-upload-guide',
      'GET /api/tax/official-source-inventory',
      'GET /api/staff/form-mapping-queue',
      'POST /api/admin/official-form-pdfs',
      'POST /api/admin/official-form-zips',
      'POST /api/admin/official-form-sources',
      'POST /api/admin/official-form-sources/:id/capture-pdf'
    ],
    user_facing_boundary: 'Public users may complete organizers or start summaries, but official PDFs are an admin/staff source-mapping workflow. Uploaded official PDFs do not make final filing output ready by themselves.'
  };
}

function buildNonFormPlatformReadinessCloseout({ version = VERSION } = {}) {
  return {
    version,
    title: 'Non-form platform polish and readiness closeout',
    scope: [
      'customer flow',
      'staff dashboard',
      'pricing/help language',
      'Spanish parity',
      'marketing pages',
      'upload safety',
      'deployment readiness',
      'official-PDF intake infrastructure'
    ],
    no_new_forms_policy: NO_MORE_FORMS_WITHOUT_OFFICIAL_PDF_POLICY,
    customer_flow: CUSTOMER_FLOW_POLISH,
    staff_dashboard: STAFF_DASHBOARD_POLISH,
    spanish_parity: SPANISH_PARITY_POLISH,
    deployment: DEPLOYMENT_READINESS_CLOSEOUT,
    readiness_judgment: {
      public_ux_polish: 'improved',
      customer_flow: 'improved',
      staff_dashboard: 'improved',
      pricing_help_language: 'improved',
      spanish_parity: 'improved',
      marketing_pages: 'improved',
      upload_safety: 'hardened',
      deployment_readiness: 'clearer',
      official_pdf_intake: 'prepared',
      new_form_buildout_without_pdfs: 'paused',
      paid_user_final_form_output: 'blocked'
    }
  };
}

function buildUploadSafetyReadinessAudit() {
  return {
    version: VERSION,
    title: 'Upload safety readiness audit',
    allowed_now: [
      'No-file intake',
      'Written descriptions without full SSNs/EINs/bank data',
      'Redacted/sample copies only when acknowledged',
      'Admin/staff official government PDFs for form mapping'
    ],
    blocked_now: [
      'Real unredacted taxpayer uploads in public mode',
      'Full tax returns, notices, transcripts, W-2s, 1099s, payroll records, bank data, direct-debit info, full SSNs/EINs',
      'Client final official form output before PDF QA/release gates',
      'E-file, agency submission, refund bank product, or direct debit flows'
    ],
    implementation_notes: [
      'Taxpayer uploads and official government form uploads are different risk categories.',
      'Official PDFs are public-source build materials; taxpayer documents are sensitive client data.',
      'Staff dashboards and analytics must never expose secret values or sensitive taxpayer content.'
    ]
  };
}

function buildDeploymentReadinessCloseout() {
  return { version: VERSION, ...DEPLOYMENT_READINESS_CLOSEOUT };
}

function buildSpanishParityNextPolish() {
  return { version: VERSION, ...SPANISH_PARITY_POLISH };
}

module.exports = {
  VERSION,
  NO_MORE_FORMS_WITHOUT_OFFICIAL_PDF_POLICY,
  OFFICIAL_PDF_READINESS_STAGES,
  CUSTOMER_FLOW_POLISH,
  STAFF_DASHBOARD_POLISH,
  SPANISH_PARITY_POLISH,
  DEPLOYMENT_READINESS_CLOSEOUT,
  ingestOfficialPdfUploads,
  buildOfficialPdfIntakeInfrastructure,
  buildNonFormPlatformReadinessCloseout,
  buildUploadSafetyReadinessAudit,
  buildDeploymentReadinessCloseout,
  buildSpanishParityNextPolish
};
