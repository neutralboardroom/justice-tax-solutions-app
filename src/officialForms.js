const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const OFFICIAL_FORM_DIR = process.env.OFFICIAL_FORM_DIR || path.join(__dirname, '..', 'storage', 'official-forms');

const AUTHORITATIVE_SOURCE_RULES = [
  { agency: 'IRS', domains: ['irs.gov'], sourceNote: 'IRS official forms, instructions, and publications should come from irs.gov.' },
  { agency: 'NYS', domains: ['tax.ny.gov', 'ny.gov'], sourceNote: 'New York State tax forms should come from tax.ny.gov or another official ny.gov page.' },
  { agency: 'NYC', domains: ['nyc.gov'], sourceNote: 'New York City Finance tax forms should come from nyc.gov / NYC Department of Finance.' }
];

const FIRST_FORM_WAVES = [
  {
    wave: 'A',
    label: 'Tax-problem and notice MVP',
    priority: 1,
    forms: [
      'IRS notices: CP14, CP2000, CP504, Letter 1058/LT11, Letter 12C',
      'Form 9465 Installment Agreement Request',
      'Form 433-F Collection Information Statement',
      'Form 433-A / 433-B Collection Information Statements',
      'Form 656 Offer in Compromise booklet/workflow',
      'Form 2848 Power of Attorney and Declaration of Representative',
      'Form 8821 Tax Information Authorization',
      'NYS tax bill/payment-plan/OIC notices',
      'NYC DOF business tax collection notices'
    ]
  },
  {
    wave: 'B',
    label: 'Individual return foundation',
    priority: 2,
    forms: ['1040', '1040-SR', 'Schedules 1, 2, 3', 'Schedule A', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule SE', '8812', '8863', '8889', '8962', '4868', '1040-X']
  },
  {
    wave: 'C',
    label: 'New York personal income tax foundation',
    priority: 3,
    forms: ['IT-201', 'IT-203', 'IT-2', 'IT-196', 'IT-201-ATT', 'IT-201-X', 'IT-203-X', 'IT-370', 'IT-2105', 'IT-213', 'IT-215', 'IT-214']
  },
  {
    wave: 'D',
    label: 'Gig worker, freelancer, and NYC business add-on',
    priority: 4,
    forms: ['1099-NEC', '1099-K', 'Schedule C', 'Schedule SE', 'NYC-202', 'NYC-202S', 'NYC-204', 'NYC-204EZ', 'NYC-EXT', 'NYC-221']
  }
];

const FIELD_MAPPING_POLICY = {
  principle: 'source-to-field values must be verified before use',
  fill_modes: ['manual_entry', 'document_candidate', 'verified_extracted_value', 'professional_final_value'],
  blocked_modes: ['unverified_ai_final_filing', 'unverified_ocr_final_filing', 'unofficial_pdf_template'],
  required_reviews: [
    'confirm agency and tax year',
    'confirm form edition/revision date',
    'confirm official source domain or staff-authorized legacy source',
    'confirm fillable PDF fields before mapping',
    'confirm calculations and cross-form dependencies',
    'confirm PTIN/professional sign-off before paid filing or agency submission'
  ]
};

function ensureOfficialDir() {
  fs.mkdirSync(OFFICIAL_FORM_DIR, { recursive: true });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function safePathPart(value = 'item') {
  return String(value || 'item').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'item';
}

function readUInt32LE(buf, offset) { return buf.readUInt32LE(offset); }
function readUInt16LE(buf, offset) { return buf.readUInt16LE(offset); }

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 0xFFFF - 22);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('ZIP end-of-central-directory record not found.');
}

function parseZipEntries(buffer, options = {}) {
  const maxEntries = Number(options.maxEntries || 1000);
  const maxTotalUncompressed = Number(options.maxTotalUncompressed || 250 * 1024 * 1024);
  const eocd = findEndOfCentralDirectory(buffer);
  const totalEntries = readUInt16LE(buffer, eocd + 10);
  const cdSize = readUInt32LE(buffer, eocd + 12);
  const cdOffset = readUInt32LE(buffer, eocd + 16);
  if (totalEntries > maxEntries) throw new Error(`ZIP has too many entries: ${totalEntries}.`);
  if (cdOffset + cdSize > buffer.length) throw new Error('ZIP central directory looks invalid.');
  let offset = cdOffset;
  let total = 0;
  const entries = [];
  for (let i = 0; i < totalEntries; i += 1) {
    if (readUInt32LE(buffer, offset) !== 0x02014b50) throw new Error('Invalid ZIP central-directory header.');
    const method = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const nameLen = readUInt16LE(buffer, offset + 28);
    const extraLen = readUInt16LE(buffer, offset + 30);
    const commentLen = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const entryName = buffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8').replace(/\\/g, '/');
    offset += 46 + nameLen + extraLen + commentLen;
    if (!entryName || entryName.endsWith('/')) continue;
    if (entryName.includes('..') || path.isAbsolute(entryName)) continue;
    total += uncompressedSize;
    if (total > maxTotalUncompressed) throw new Error('ZIP uncompressed size exceeds safety limit.');
    entries.push({ entryName, method, compressedSize, uncompressedSize, localHeaderOffset });
  }
  return entries;
}

function extractEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (readUInt32LE(buffer, offset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for ${entry.entryName}.`);
  const nameLen = readUInt16LE(buffer, offset + 26);
  const extraLen = readUInt16LE(buffer, offset + 28);
  const dataStart = offset + 30 + nameLen + extraLen;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.entryName}.`);
}

function inferAgency(fileName = '', agencyHint = '') {
  const hint = String(agencyHint || '').toUpperCase();
  if (['IRS', 'NYS', 'NYC'].includes(hint)) return hint;
  const lower = String(fileName || '').toLowerCase();
  if (/nyc[-_ ]|cr-a|rptt|nyc202|nyc-202|nyc204|nyc-204|dof/.test(lower)) return 'NYC';
  if (/\bit[-_ ]?\d|dtf[-_ ]?\d|ct[-_ ]?\d|st[-_ ]?\d|nys[-_ ]|tr-579|tax\.ny/.test(lower)) return 'NYS';
  if (/f\d{3,5}|i\d{3,5}|p\d{3,5}|1040|9465|433[-_ ]?[abf]|656|2848|8821|w[-_ ]?2|w[-_ ]?4|1099|1098|1095|irs/.test(lower)) return 'IRS';
  return 'UNKNOWN';
}

function inferDocType(fileName = '') {
  const lower = String(fileName || '').toLowerCase();
  if (/instr|instruction|inst\b|_i\b|\bi[-_ ]?\d{3,5}|\.i\d/.test(lower)) return 'instructions';
  if (/publication|\bpub[-_ ]?\d|\bp\d{3,5}/.test(lower)) return 'publication';
  if (/notice|letter|cp\d{2,4}|lt\d{2,4}/.test(lower)) return 'notice_template_or_guidance';
  if (/worksheet|guide|booklet/.test(lower)) return 'workbook_or_guidance';
  return lower.endsWith('.pdf') ? 'form_or_instruction_pdf' : 'supporting_file';
}

function cleanFormNumber(name = '') {
  const base = path.basename(String(name || '').toLowerCase(), path.extname(String(name || '')))
    .replace(/fill[-_ ]?in/g, '')
    .replace(/instructions?/g, '')
    .replace(/instr/g, '')
    .replace(/\b20\d{2}\b/g, '')
    .replace(/[_]+$/g, '')
    .trim();
  const common = [
    ['f1040sc', '1040 Schedule C'], ['f1040se', '1040 Schedule SE'], ['f1040sa', '1040 Schedule A'], ['f1040sb', '1040 Schedule B'], ['f1040sd', '1040 Schedule D'],
    ['f1040s1', '1040 Schedule 1'], ['f1040s2', '1040 Schedule 2'], ['f1040s3', '1040 Schedule 3'], ['f1040x', '1040-X'], ['f1040', '1040'],
    ['i1040gi', '1040 Instructions'], ['i1040sc', '1040 Schedule C Instructions'],
    ['f9465', '9465'], ['f2848', '2848'], ['f8821', '8821'], ['f433f', '433-F'], ['f433a', '433-A'], ['f433b', '433-B'], ['f656', '656'], ['f4868', '4868'],
    ['it201', 'IT-201'], ['it203', 'IT-203'], ['it2', 'IT-2'], ['it196', 'IT-196'], ['it370', 'IT-370'], ['it2105', 'IT-2105'],
    ['nyc202s', 'NYC-202S'], ['nyc202', 'NYC-202'], ['nyc204ez', 'NYC-204EZ'], ['nyc204', 'NYC-204'], ['nyc221', 'NYC-221']
  ];
  const compact = base.replace(/[^a-z0-9]/g, '');
  for (const [needle, label] of common) if (compact.includes(needle)) return label;
  const match = base.match(/(it[-_ ]?\d+[a-z-]*|dtf[-_ ]?\d+[a-z-]*|ct[-_ ]?\d+[a-z-]*|st[-_ ]?\d+[a-z-]*|nyc[-_ ]?\d+[a-z-]*|\d{3,5}[a-z-]*)/i);
  if (match) return match[1].toUpperCase().replace(/_/g, '-').replace(/\s+/g, '-');
  return path.basename(String(name || 'unknown'), path.extname(String(name || ''))).slice(0, 80);
}

function inferTaxYear(fileName = '', taxYearHint = '') {
  const hint = String(taxYearHint || '').trim();
  if (/^20\d{2}$/.test(hint)) return hint;
  const match = String(fileName || '').match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/);
  return match ? match[1] : '';
}

function authoritativeSourceStatus(agency = '', sourceUrl = '') {
  const rule = AUTHORITATIVE_SOURCE_RULES.find((r) => r.agency === agency);
  const url = String(sourceUrl || '').toLowerCase();
  if (!rule) return { status: 'needs_staff_review', note: 'Agency could not be confidently inferred. Staff must verify source.' };
  if (!url) return { status: 'source_url_missing', note: rule.sourceNote };
  const ok = rule.domains.some((domain) => url.includes(domain));
  return ok ? { status: 'official_source_indicated', note: `Source URL appears to match ${rule.domains.join(' or ')}.` } : { status: 'needs_staff_review', note: rule.sourceNote };
}

function inferOfficialFormMetadata(entryName, { agency = '', taxYear = '', sourceUrl = '' } = {}) {
  const base = path.basename(entryName);
  const inferredAgency = inferAgency(entryName, agency);
  const inferredTaxYear = inferTaxYear(entryName, taxYear);
  const formNumber = cleanFormNumber(base);
  const docType = inferDocType(base);
  const official = authoritativeSourceStatus(inferredAgency, sourceUrl);
  const mappingPriority = priorityForForm(formNumber, inferredAgency);
  return {
    original_entry_name: entryName,
    file_name: base,
    agency: inferredAgency,
    tax_year: inferredTaxYear,
    form_number: formNumber,
    doc_type: docType,
    official_source_status: official.status,
    official_source_note: official.note,
    mapping_priority: mappingPriority.priority,
    mapping_wave: mappingPriority.wave,
    mapping_status: 'not_started',
    field_map_status: 'not_started',
    fillable_pdf_status: 'unknown',
    requires_staff_source_review: official.status !== 'official_source_indicated',
    requires_field_mapping: docType.includes('form'),
    release_status: 'not_usable_for_client_output_until_mapped_and_verified'
  };
}

function priorityForForm(formNumber = '', agency = '') {
  const value = String(formNumber || '').toUpperCase();
  const waveA = ['9465', '433-F', '433-A', '433-B', '656', '2848', '8821', 'CP14', 'CP2000', 'CP504'];
  const waveB = ['1040', '1040-SR', '1040-X', '1040 SCHEDULE 1', '1040 SCHEDULE 2', '1040 SCHEDULE 3', '1040 SCHEDULE A', '1040 SCHEDULE B', '1040 SCHEDULE C', '1040 SCHEDULE D', '1040 SCHEDULE SE', '8812', '8863', '8889', '8962', '4868'];
  const waveC = ['IT-201', 'IT-203', 'IT-2', 'IT-196', 'IT-201-ATT', 'IT-201-X', 'IT-203-X', 'IT-370', 'IT-2105', 'IT-213', 'IT-215', 'IT-214'];
  const waveD = ['NYC-202', 'NYC-202S', 'NYC-204', 'NYC-204EZ', 'NYC-221', 'NYC-EXT'];
  if (waveA.some((item) => value.includes(item))) return { priority: 1, wave: 'A' };
  if (waveB.some((item) => value === item || value.includes(item))) return { priority: 2, wave: 'B' };
  if (waveC.some((item) => value === item || value.includes(item))) return { priority: 3, wave: 'C' };
  if (waveD.some((item) => value === item || value.includes(item))) return { priority: 4, wave: 'D' };
  if (agency === 'IRS') return { priority: 5, wave: 'IRS later' };
  if (agency === 'NYS') return { priority: 6, wave: 'NYS later' };
  if (agency === 'NYC') return { priority: 7, wave: 'NYC later' };
  return { priority: 9, wave: 'needs triage' };
}

function saveOfficialFormFile(packageId, entryName, buffer) {
  ensureOfficialDir();
  const folder = path.join(OFFICIAL_FORM_DIR, safePathPart(packageId));
  fs.mkdirSync(folder, { recursive: true });
  const fileId = `off_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const ext = path.extname(entryName) || '.bin';
  const storedName = `${fileId}-${safePathPart(path.basename(entryName, ext))}${ext}`;
  const fullPath = path.join(folder, storedName);
  fs.writeFileSync(fullPath, buffer);
  return { fileId, fullPath, storedName };
}

function ingestOfficialFormsZip(store, file, options = {}) {
  if (!file || !file.buffer) throw new Error('No ZIP file provided.');
  const archiveHash = sha256(file.buffer);
  const existing = store.find('official_form_packages', (p) => p.sha256 === archiveHash && !p.deleted_at);
  if (existing && options.deduplicate !== false) return { package: existing, forms: store.list('official_forms', (f) => f.package_id === existing.id), duplicate: true };
  const packageRecord = store.insert('official_form_packages', {
    original_name: file.originalname || 'official-forms.zip',
    mime_type: file.mimetype || 'application/zip',
    size_bytes: file.size || file.buffer.length,
    sha256: archiveHash,
    agency_hint: options.agency || '',
    tax_year_hint: options.taxYear || '',
    source_url: options.sourceUrl || '',
    notes: options.notes || '',
    upload_status: 'processing'
  });
  const entries = parseZipEntries(file.buffer);
  const forms = [];
  const skipped = [];
  for (const entry of entries) {
    const lower = entry.entryName.toLowerCase();
    if (!lower.endsWith('.pdf')) {
      skipped.push({ entry_name: entry.entryName, reason: 'not_pdf' });
      continue;
    }
    const payload = extractEntry(file.buffer, entry);
    const metadata = inferOfficialFormMetadata(entry.entryName, { agency: options.agency, taxYear: options.taxYear, sourceUrl: options.sourceUrl });
    const saved = saveOfficialFormFile(packageRecord.id, entry.entryName, payload);
    const record = store.insert('official_forms', {
      package_id: packageRecord.id,
      ...metadata,
      mime_type: 'application/pdf',
      size_bytes: payload.length,
      sha256: sha256(payload),
      storage_provider: 'local-official-form-library-starter',
      storage_path: saved.fullPath,
      stored_name: saved.storedName,
      source_url: options.sourceUrl || '',
      ingestion_notes: options.notes || '',
      uploaded_by_user_id: options.uploadedByUserId || '',
      public_use_note: 'Official source document stored for form mapping/reference. Not usable for client filing output until staff verifies source, edition, fields, calculations, and professional review workflow.'
    });
    forms.push(record);
  }
  const updatedPackage = store.update('official_form_packages', packageRecord.id, {
    upload_status: 'processed',
    pdf_count: forms.length,
    skipped_count: skipped.length,
    skipped_entries: skipped.slice(0, 100),
    priority_summary: formPrioritySummary(forms),
    processed_at: new Date().toISOString()
  });
  return { package: updatedPackage || packageRecord, forms, skipped, duplicate: false };
}

function formPrioritySummary(forms = []) {
  const byWave = {};
  for (const form of forms) {
    const wave = form.mapping_wave || 'needs triage';
    byWave[wave] = (byWave[wave] || 0) + 1;
  }
  return byWave;
}

function mappingQueue(store, filters = {}) {
  const agency = String(filters.agency || '').toUpperCase();
  const onlyNeedsReview = filters.onlyNeedsReview !== false;
  return store.list('official_forms', (form) => {
    if (agency && form.agency !== agency) return false;
    if (onlyNeedsReview && ['mapped_verified', 'deferred_not_needed'].includes(form.mapping_status)) return false;
    return !form.deleted_at;
  }).sort((a, b) => Number(a.mapping_priority || 99) - Number(b.mapping_priority || 99) || String(a.form_number).localeCompare(String(b.form_number)));
}

function buildMappingDraft(form = {}) {
  const number = String(form.form_number || '').toUpperCase();
  const agency = form.agency || 'UNKNOWN';
  const base = {
    form_id: form.id,
    agency,
    tax_year: form.tax_year || '',
    form_number: form.form_number || '',
    mapping_status: form.mapping_status || 'not_started',
    required_steps: [
      'Open PDF and extract official AcroForm/XFA field names where possible.',
      'Create plain-English intake questions for each fillable field or workflow decision.',
      'Connect uploaded document candidates to possible fields without auto-finalizing values.',
      'Add calculation checks and cross-form dependency notes.',
      'Run sample data through PDF output and have a human/professional verify.'
    ],
    first_field_groups: []
  };
  if (number.includes('9465')) base.first_field_groups = ['taxpayer identity', 'tax period and amount owed', 'proposed monthly payment', 'bank/account payment choice', 'signature/preparer'];
  else if (number.includes('433-F') || number.includes('433-A') || number.includes('433-B')) base.first_field_groups = ['household/income', 'bank accounts', 'assets', 'monthly expenses', 'employment/business', 'collection notes'];
  else if (number.includes('656')) base.first_field_groups = ['taxpayer and periods', 'offer amount', 'payment option', 'low-income certification', 'source of funds', 'professional review flags'];
  else if (number.includes('2848') || number.includes('8821')) base.first_field_groups = ['taxpayer identity', 'representative/designee', 'tax matters and periods', 'acts authorized', 'signatures'];
  else if (number.includes('1040')) base.first_field_groups = ['identity and filing status', 'dependents', 'income', 'adjustments', 'tax/credits', 'payments', 'refund/amount owed', 'third-party designee/preparer'];
  else if (number.includes('IT-201') || number.includes('IT-203')) base.first_field_groups = ['NY residency', 'federal income import', 'NY additions/subtractions', 'credits', 'NYC/Yonkers', 'payments/refund', 'preparer'];
  else if (number.includes('NYC-202') || number.includes('NYC-204')) base.first_field_groups = ['business identity', 'income/deductions', 'allocation', 'credits/payments', 'signature/preparer'];
  else base.first_field_groups = ['source verification', 'field extraction', 'question mapping', 'calculation review', 'sample output verification'];
  base.controlled_mapping_policy = FORM_SOURCE_COLLECTION_POLICY;
  base.qa_gate_stages = CONTROLLED_MAPPING_STAGES;
  base.blueprint = blueprintForFormNumber(form.form_number || '', agency);
  return base;
}

function uploadReadinessGuide() {
  return {
    ready_for_uploads: true,
    what_to_upload_now: [
      'IRS official PDF form ZIPs for tax-problem/debt forms first: 9465, 433-F, 433-A, 433-B, 656, 2848, 8821, 1040-X, 4868, then 1040/Schedules.',
      'New York State official PDF form ZIPs: IT-201, IT-203, IT-2, IT-196, amended/extension/estimated-tax forms, NYS payment-plan/OIC materials.',
      'New York City Department of Finance official PDF ZIPs: NYC-202, NYC-202S, NYC-204, NYC-204EZ, NYC-221, NYC-EXT, business-tax forms and instructions.'
    ],
    preferred_zip_structure: [
      'One agency per ZIP when possible: IRS, NYS, or NYC.',
      'Use folders by tax year if mixed: 2025/1040/f1040.pdf, 2025/IT-201/it201.pdf.',
      'Include forms and instructions together if available.',
      'Keep original official filenames when possible.',
      'Add a simple README.txt or manifest.csv if you know source URLs or edition dates.'
    ],
    metadata_to_tell_next_chat_or_staff: ['agency', 'tax year', 'source page URL', 'whether the ZIP contains current-year forms, prior-year forms, instructions, or all of these'],
    safety_rules: FIELD_MAPPING_POLICY.required_reviews,
    first_waves: FIRST_FORM_WAVES,
    source_collection_policy: FORM_SOURCE_COLLECTION_POLICY,
    seeded_government_source_catalog_count: OFFICIAL_FORM_SOURCE_CATALOG.length,
    download_vs_upload: buildDownloadVsUploadGuide()
  };
}


const OFFICIAL_FORM_SOURCE_CATALOG = [
  { agency: 'IRS', tax_year: 'current', form_number: '9465', title: 'Installment Agreement Request', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f9465.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i9465.pdf', workflow: 'tax debt / payment plan', first_wave: 'A', priority: 1, source_note: 'IRS lists Form 9465 as an Installment Agreement Request for taxpayers who cannot pay the full amount due.' },
  { agency: 'IRS', tax_year: 'current', form_number: '433-F', title: 'Collection Information Statement', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f433f.pdf', instructions_url: '', workflow: 'tax debt financial disclosure', first_wave: 'A', priority: 1 },
  { agency: 'IRS', tax_year: 'current', form_number: '433-A', title: 'Collection Information Statement for Wage Earners and Self-Employed Individuals', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f433a.pdf', instructions_url: '', workflow: 'tax debt financial disclosure', first_wave: 'A', priority: 1 },
  { agency: 'IRS', tax_year: 'current', form_number: '433-B', title: 'Collection Information Statement for Businesses', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f433b.pdf', instructions_url: '', workflow: 'business tax debt financial disclosure', first_wave: 'A', priority: 1 },
  { agency: 'IRS', tax_year: 'current', form_number: '656', title: 'Offer in Compromise booklet / offer workflow', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f656b.pdf', instructions_url: '', workflow: 'offer in compromise screening', first_wave: 'A', priority: 1 },
  { agency: 'IRS', tax_year: 'current', form_number: '2848', title: 'Power of Attorney and Declaration of Representative', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f2848.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i2848.pdf', workflow: 'professional authorization', first_wave: 'A', priority: 1 },
  { agency: 'IRS', tax_year: 'current', form_number: '8821', title: 'Tax Information Authorization', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f8821.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i8821.pdf', workflow: 'tax information authorization', first_wave: 'A', priority: 1 },
  { agency: 'IRS', tax_year: 'current', form_number: '1040-X', title: 'Amended U.S. Individual Income Tax Return', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f1040x.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i1040x.pdf', workflow: 'amended return', first_wave: 'B', priority: 2 },
  { agency: 'IRS', tax_year: 'current', form_number: '4868', title: 'Application for Automatic Extension of Time To File U.S. Individual Income Tax Return', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f4868.pdf', instructions_url: '', workflow: 'extension', first_wave: 'B', priority: 2 },
  { agency: 'IRS', tax_year: 'current', form_number: '1040', title: 'U.S. Individual Income Tax Return', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f1040.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf', workflow: 'individual return foundation', first_wave: 'B', priority: 2 },
  { agency: 'IRS', tax_year: 'current', form_number: '1040 Schedule C', title: 'Profit or Loss From Business', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f1040sc.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i1040sc.pdf', workflow: 'self-employed / gig worker', first_wave: 'B', priority: 2 },
  { agency: 'IRS', tax_year: 'current', form_number: '1040 Schedule SE', title: 'Self-Employment Tax', source_page_url: 'https://www.irs.gov/forms-instructions', pdf_url: 'https://www.irs.gov/pub/irs-pdf/f1040sse.pdf', instructions_url: 'https://www.irs.gov/pub/irs-pdf/i1040sse.pdf', workflow: 'self-employment tax', first_wave: 'B', priority: 2 },
  { agency: 'NYS', tax_year: 'current', form_number: 'IT-201', title: 'Resident Income Tax Return', source_page_url: 'https://www.tax.ny.gov/forms/', pdf_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it201_fill_in.pdf', instructions_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf', workflow: 'New York resident income tax', first_wave: 'C', priority: 3 },
  { agency: 'NYS', tax_year: 'current', form_number: 'IT-203', title: 'Nonresident and Part-Year Resident Income Tax Return', source_page_url: 'https://www.tax.ny.gov/forms/', pdf_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it203_fill_in.pdf', instructions_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it203i.pdf', workflow: 'New York nonresident / part-year return', first_wave: 'C', priority: 3 },
  { agency: 'NYS', tax_year: 'current', form_number: 'IT-2', title: 'Summary of W-2 Statements', source_page_url: 'https://www.tax.ny.gov/forms/', pdf_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it2_fill_in.pdf', instructions_url: '', workflow: 'New York wage attachment', first_wave: 'C', priority: 3 },
  { agency: 'NYS', tax_year: 'current', form_number: 'IT-196', title: 'New York Resident, Nonresident, and Part-Year Resident Itemized Deductions', source_page_url: 'https://www.tax.ny.gov/forms/', pdf_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it196_fill_in.pdf', instructions_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it196i.pdf', workflow: 'New York itemized deductions', first_wave: 'C', priority: 3 },
  { agency: 'NYS', tax_year: 'current', form_number: 'IT-370', title: 'Application for Automatic Six-Month Extension of Time to File for Individuals', source_page_url: 'https://www.tax.ny.gov/forms/', pdf_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it370_fill_in.pdf', instructions_url: '', workflow: 'New York individual extension', first_wave: 'C', priority: 3 },
  { agency: 'NYS', tax_year: 'current', form_number: 'IT-2105', title: 'Estimated Tax Payment Voucher for Individuals', source_page_url: 'https://www.tax.ny.gov/forms/', pdf_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it2105_fill_in.pdf', instructions_url: 'https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf', workflow: 'New York estimated tax', first_wave: 'C', priority: 3 },
  { agency: 'NYC', tax_year: '2025', form_number: 'NYC-202', title: 'Unincorporated Business Tax Return for Individuals and Single-Member LLCs', source_page_url: 'https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page', pdf_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-202_2025.pdf', instructions_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-202-instr_2025.pdf', workflow: 'NYC freelancer / sole proprietor UBT', first_wave: 'D', priority: 4 },
  { agency: 'NYC', tax_year: '2025', form_number: 'NYC-202S', title: 'Unincorporated Business Tax Return for Individuals - simplified', source_page_url: 'https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page', pdf_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-202s_2025.pdf', instructions_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-202s-instr_2025.pdf', workflow: 'NYC freelancer / sole proprietor UBT simplified', first_wave: 'D', priority: 4 },
  { agency: 'NYC', tax_year: '2025', form_number: 'NYC-204', title: 'Unincorporated Business Tax Return for Partnerships', source_page_url: 'https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page', pdf_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-204_2025.pdf', instructions_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-204-instr_2025.pdf', workflow: 'NYC partnership / LLC UBT', first_wave: 'D', priority: 4 },
  { agency: 'NYC', tax_year: '2025', form_number: 'NYC-204EZ', title: 'Unincorporated Business Tax Return for Partnerships - EZ', source_page_url: 'https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page', pdf_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-204ez_2025.pdf', instructions_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-204-instr_2025.pdf', workflow: 'NYC partnership / LLC UBT simplified', first_wave: 'D', priority: 4 },
  { agency: 'NYC', tax_year: '2025', form_number: 'NYC-EXT', title: 'Application for Automatic Extension of Time to File Business Income Tax Returns', source_page_url: 'https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page', pdf_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-ext_2025.pdf', instructions_url: '', workflow: 'NYC business tax extension', first_wave: 'D', priority: 4 },
  { agency: 'NYC', tax_year: '2025', form_number: 'NYC-221', title: 'Underpayment of Estimated Unincorporated Business Tax', source_page_url: 'https://www.nyc.gov/site/finance/business/business-unincorporated-business-tax-ubt.page', pdf_url: 'https://www.nyc.gov/assets/finance/downloads/pdf/25pdf/business_tax_forms/nyc-221_2025.pdf', instructions_url: '', workflow: 'NYC UBT estimated tax penalty', first_wave: 'D', priority: 4 }
];

const FORM_SOURCE_COLLECTION_POLICY = {
  answer_to_owner: 'You do not need to manually upload every public form for source discovery. The platform can maintain official IRS/NYS/NYC source URLs and staff can retrieve from government sites. Uploaded ZIPs are still useful for bulk field extraction, checksum control, offline QA, and repeatable builds.',
  source_only_allowed_now: true,
  url_capture_allowed_when_enabled: true,
  pdf_required_for_field_extraction: true,
  client_output_gate: 'No source URL, uploaded PDF, downloaded PDF, or mapped field can drive client-facing final output until source, edition, field names, calculations, sample PDF fill, and professional review are verified.',
  download_sources_allowed: ['irs.gov', 'tax.ny.gov', 'ny.gov', 'nyc.gov'],
  preferred_order: [
    'Seed/verify official source catalog from government pages.',
    'Register source URL records with agency, tax year, form number, and workflow.',
    'Capture PDFs directly from official government URLs when enabled, or upload PDFs/ZIPs into the official form library, capturing checksum and source URL.',
    'Extract field names and classify pages/sections.',
    'Draft intake-to-field mapping with source-linked values only.',
    'Run sample data, check overflow/calculations/signature/preparer/government-only fields.',
    'Require staff/professional verification before any client-visible completed form.'
  ]
};

const CONTROLLED_MAPPING_STAGES = [
  { stage: 'source_identified', customer_output: false, description: 'Official government page or PDF URL is known, but no local PDF has been verified.' },
  { stage: 'pdf_captured_checksum_recorded', customer_output: false, description: 'PDF was uploaded or downloaded; checksum, size, source URL, agency, form number, and tax year are recorded.' },
  { stage: 'fields_extracted', customer_output: false, description: 'AcroForm/XFA names or visual line locations were extracted and reviewed for completeness.' },
  { stage: 'mapping_drafted', customer_output: false, description: 'Intake fields, document-extraction candidates, calculations, and conditional sections are drafted.' },
  { stage: 'sample_pdf_tested', customer_output: false, description: 'At least one fake/sample taxpayer dataset was used to test placement, overflow, dates, dollars, checkboxes, and blank fields.' },
  { stage: 'professional_verified', customer_output: true, description: 'Qualified staff/professional verified source, fields, calculations, signatures/preparer areas, and case-specific facts.' }
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function safeText(value = '', max = 500) { return String(value || '').replace(/[<>]/g, '').slice(0, max); }

function officialSourceCatalog(filters = {}) {
  const agency = String(filters.agency || '').toUpperCase();
  const wave = String(filters.wave || '').toUpperCase();
  const form = String(filters.form_number || filters.form || '').toUpperCase();
  return OFFICIAL_FORM_SOURCE_CATALOG.filter((item) => {
    if (agency && item.agency !== agency) return false;
    if (wave && String(item.first_wave || '').toUpperCase() !== wave) return false;
    if (form && !String(item.form_number || '').toUpperCase().includes(form)) return false;
    return true;
  }).sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99) || String(a.agency).localeCompare(String(b.agency)) || String(a.form_number).localeCompare(String(b.form_number)));
}

function validateOfficialSourceUrl(url = '', agencyHint = '') {
  const raw = String(url || '').trim();
  if (!raw) return { ok: false, status: 'missing_url', note: 'No URL provided.' };
  let parsed;
  try { parsed = new URL(raw); } catch { return { ok: false, status: 'invalid_url', note: 'URL could not be parsed.' }; }
  if (parsed.protocol !== 'https:') return { ok: false, status: 'not_https', note: 'Official source URLs should use HTTPS.' };
  const host = parsed.hostname.toLowerCase();
  const agency = String(agencyHint || inferAgency(raw)).toUpperCase();
  const rule = AUTHORITATIVE_SOURCE_RULES.find((r) => r.agency === agency);
  if (!rule) return { ok: false, status: 'unknown_agency', note: 'Agency could not be inferred; staff must verify this source.' };
  const allowed = rule.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  return allowed ? { ok: true, status: 'official_source_domain', agency, host, note: `Host ${host} matches ${rule.domains.join(' or ')}.` } : { ok: false, status: 'domain_not_allowed', agency, host, note: rule.sourceNote };
}

function sourceRecordFromCatalog(item = {}, extra = {}) {
  const urlCheck = validateOfficialSourceUrl(item.pdf_url || item.source_page_url || '', item.agency);
  return {
    source_catalog_key: `${item.agency}:${item.tax_year}:${item.form_number}`,
    agency: item.agency,
    tax_year: item.tax_year || '',
    form_number: item.form_number || '',
    title: item.title || '',
    workflow: item.workflow || '',
    source_page_url: item.source_page_url || '',
    pdf_url: item.pdf_url || '',
    instructions_url: item.instructions_url || '',
    first_wave: item.first_wave || '',
    mapping_priority: item.priority || 9,
    source_status: urlCheck.ok ? 'source_identified_official_domain' : 'needs_staff_source_review',
    url_validation: urlCheck,
    pdf_capture_status: 'not_captured',
    checksum_status: 'not_recorded',
    field_extraction_status: 'not_started',
    mapping_status: 'source_only_not_mapped',
    can_drive_client_output: false,
    release_status: 'not_usable_for_client_output_until_pdf_captured_mapped_tested_and_verified',
    added_from: extra.added_from || 'v0.1.16_official_source_catalog',
    notes: extra.notes || item.source_note || ''
  };
}

function seedOfficialSourceCatalog(store, options = {}) {
  const filters = { agency: options.agency || '', wave: options.wave || '', form_number: options.form_number || '' };
  const selected = officialSourceCatalog(filters);
  const inserted = [];
  const existing = [];
  for (const item of selected) {
    const key = `${item.agency}:${item.tax_year}:${item.form_number}`;
    const found = store.find('official_form_sources', (row) => row.source_catalog_key === key && !row.deleted_at);
    if (found) { existing.push(found); continue; }
    inserted.push(store.insert('official_form_sources', sourceRecordFromCatalog(item, { notes: options.notes || '', added_from: options.added_from || 'admin_seed' })));
  }
  return { inserted_count: inserted.length, existing_count: existing.length, inserted, existing, total_selected: selected.length };
}

function createOfficialSourceRecord(store, input = {}, actor = {}) {
  const agency = String(input.agency || inferAgency(input.pdf_url || input.source_page_url || '')).toUpperCase();
  const formNumber = safeText(input.form_number || cleanFormNumber(input.pdf_url || input.source_page_url || 'unknown'), 80);
  const pdfUrl = safeText(input.pdf_url || '', 500);
  const sourcePageUrl = safeText(input.source_page_url || '', 500);
  const instructionsUrl = safeText(input.instructions_url || '', 500);
  const primaryUrl = pdfUrl || sourcePageUrl || instructionsUrl;
  const urlValidation = validateOfficialSourceUrl(primaryUrl, agency);
  const priority = priorityForForm(formNumber, agency);
  const record = store.insert('official_form_sources', {
    source_catalog_key: safeText(input.source_catalog_key || `custom:${agency}:${input.tax_year || 'unknown'}:${formNumber}:${Date.now()}`, 180),
    agency,
    tax_year: safeText(input.tax_year || inferTaxYear(primaryUrl), 20),
    form_number: formNumber,
    title: safeText(input.title || '', 200),
    workflow: safeText(input.workflow || '', 200),
    source_page_url: sourcePageUrl,
    pdf_url: pdfUrl,
    instructions_url: instructionsUrl,
    first_wave: priority.wave,
    mapping_priority: priority.priority,
    source_status: urlValidation.ok ? 'source_identified_official_domain' : 'needs_staff_source_review',
    url_validation: urlValidation,
    pdf_capture_status: 'not_captured',
    checksum_status: 'not_recorded',
    field_extraction_status: 'not_started',
    mapping_status: 'source_only_not_mapped',
    can_drive_client_output: false,
    release_status: 'not_usable_for_client_output_until_pdf_captured_mapped_tested_and_verified',
    added_from: 'manual_admin_source_registration',
    added_by: actor.id || 'admin-token',
    notes: safeText(input.notes || '', 1000)
  });
  return record;
}

function listOfficialFormSources(store, filters = {}) {
  const agency = String(filters.agency || '').toUpperCase();
  const status = String(filters.status || '');
  const needsPdf = filters.needs_pdf === true || String(filters.needs_pdf || '') === 'true';
  return store.list('official_form_sources', (row) => {
    if (row.deleted_at) return false;
    if (agency && row.agency !== agency) return false;
    if (status && row.source_status !== status && row.mapping_status !== status && row.pdf_capture_status !== status) return false;
    if (needsPdf && row.pdf_capture_status !== 'not_captured') return false;
    return true;
  }).sort((a, b) => Number(a.mapping_priority || 99) - Number(b.mapping_priority || 99) || String(a.agency).localeCompare(String(b.agency)) || String(a.form_number).localeCompare(String(b.form_number)));
}

function buildOfficialSourceInventory(store) {
  const sources = listOfficialFormSources(store);
  const forms = store.list('official_forms', (form) => !form.deleted_at);
  const byAgency = {};
  for (const source of sources) {
    const bucket = byAgency[source.agency] || { sources: 0, pdfs_not_captured: 0, official_domain_sources: 0, client_output_ready: 0 };
    bucket.sources += 1;
    if (source.pdf_capture_status !== 'captured') bucket.pdfs_not_captured += 1;
    if (source.source_status === 'source_identified_official_domain') bucket.official_domain_sources += 1;
    if (source.can_drive_client_output) bucket.client_output_ready += 1;
    byAgency[source.agency] = bucket;
  }
  return {
    summary: {
      source_records: sources.length,
      pdf_records_ingested: forms.length,
      official_domain_sources: sources.filter((s) => s.source_status === 'source_identified_official_domain').length,
      source_only_not_mapped: sources.filter((s) => s.mapping_status === 'source_only_not_mapped').length,
      client_output_ready: sources.filter((s) => s.can_drive_client_output).length + forms.filter((f) => f.can_drive_client_output).length,
      by_agency: byAgency
    },
    policy: FORM_SOURCE_COLLECTION_POLICY,
    controlled_mapping_stages: CONTROLLED_MAPPING_STAGES,
    sources: sources.map((source) => ({ ...source, storage_path: undefined })),
    uploaded_forms_summary: formPrioritySummary(forms)
  };
}

function blueprintForFormNumber(formNumber = '', agency = '') {
  const number = String(formNumber || '').toUpperCase();
  const base = {
    form_number: formNumber,
    agency,
    intake_groups: [],
    document_candidates: [],
    calculation_checks: [],
    conditional_sections: [],
    must_remain_blank_until_review: ['taxpayer signature', 'paid preparer signature', 'government/agency-only areas'],
    qa_tests: ['blank/NA handling', 'date format', 'money format', 'checkbox placement', 'overflow', 'sample output review']
  };
  if (number.includes('9465')) return { ...base, intake_groups: ['taxpayer identity', 'balance due by tax year', 'proposed monthly payment', 'payment date', 'direct debit preference', 'spouse/joint return'], document_candidates: ['IRS balance notice', 'tax return balance due', 'bank account proof if direct debit'], calculation_checks: ['monthly payment affordability is not legal/tax advice', 'filing/compliance status needed before promise'], conditional_sections: ['direct debit', 'payroll deduction', 'low-income certification if applicable'] };
  if (number.includes('433-F') || number.includes('433-A') || number.includes('433-B')) return { ...base, intake_groups: ['household/business identity', 'income', 'bank accounts', 'assets', 'vehicles', 'real property', 'monthly living expenses', 'debts'], document_candidates: ['paystubs', 'bank statements', 'mortgage/rent', 'vehicle loans', 'utility bills', 'profit/loss'], calculation_checks: ['income minus allowable expenses', 'asset equity', 'business vs personal separation'], conditional_sections: ['business assets', 'self-employed income', 'spouse information'] };
  if (number.includes('656')) return { ...base, intake_groups: ['taxpayer identity', 'tax periods', 'offer basis', 'offer amount', 'payment option', 'low-income certification', 'source of funds'], document_candidates: ['IRS balance transcript/notice', '433-A/B data', 'income and asset documents'], calculation_checks: ['reasonable collection potential review required', 'OIC eligibility not guaranteed'], conditional_sections: ['low-income certification', 'periodic payment vs lump sum'] };
  if (number.includes('2848') || number.includes('8821')) return { ...base, intake_groups: ['taxpayer identity', 'representative/designee', 'tax form/type', 'tax periods', 'scope limitations', 'signature/date'], document_candidates: ['ID information', 'professional credentials', 'prior IRS notices'], calculation_checks: ['no dollar calculations; scope/date/authority review required'], conditional_sections: ['CAF number', 'acts authorized/deleted', 'specific use not recorded on CAF'] };
  if (number.includes('1040')) return { ...base, intake_groups: ['identity', 'filing status', 'dependents', 'income', 'adjustments', 'deductions', 'credits', 'payments', 'refund/amount owed', 'third-party designee', 'preparer'], document_candidates: ['W-2', '1099', '1098', '1095-A', 'K-1', 'receipts', 'prior-year return'], calculation_checks: ['federal taxable income', 'credits/payments', 'refund/amount due', 'Schedule C/SE dependencies'], conditional_sections: ['dependents', 'self-employment', 'itemized deductions', 'premium tax credit', 'education credits'] };
  if (number.includes('IT-201') || number.includes('IT-203')) return { ...base, intake_groups: ['NY residency', 'federal import', 'NY additions/subtractions', 'NY itemized/standard', 'credits', 'NYC/Yonkers', 'payments/refund', 'preparer'], document_candidates: ['federal 1040', 'W-2 IT-2 data', '1099s', 'NY withholding', 'NY notices'], calculation_checks: ['NY AGI from federal', 'NY/NYC/Yonkers taxes', 'resident vs nonresident allocation'], conditional_sections: ['part-year/nonresident allocation', 'NYC resident tax', 'school district/credits'] };
  if (number.includes('NYC-202') || number.includes('NYC-204') || number.includes('NYC-EXT') || number.includes('NYC-221')) return { ...base, intake_groups: ['business identity', 'federal Schedule C/partnership data', 'NYC activity', 'allocation', 'credits/payments', 'extension/estimated tax', 'signature/preparer'], document_candidates: ['federal Schedule C', 'federal Form 1065', 'NYC DOF notice', 'estimated tax payment records'], calculation_checks: ['UBT taxable income', 'business allocation percentage', 'business tax credit', 'prepayments/extension payments'], conditional_sections: ['amended/final return', 'exempt or partially exempt business', 'NYC real property allocation', 'partnership vs individual'] };
  return base;
}

function buildSourceDrivenMappingDraft(source = {}) {
  const blueprint = blueprintForFormNumber(source.form_number, source.agency);
  return {
    source_id: source.id || '',
    agency: source.agency || '',
    tax_year: source.tax_year || '',
    form_number: source.form_number || '',
    title: source.title || '',
    source_status: source.source_status || 'not_seeded',
    pdf_capture_status: source.pdf_capture_status || 'not_captured',
    mapping_status: source.mapping_status || 'source_only_not_mapped',
    can_drive_client_output: false,
    next_steps: [
      'Capture the PDF from the official URL or upload the official PDF/ZIP and record checksum.',
      'Extract field names or visual field locations from the captured PDF.',
      'Map intake/document candidates to fields as draft-only values.',
      'Run fake sample data and inspect output for overflow, calculations, and conditional sections.',
      'Require staff/professional verification before any client-facing completed form output.'
    ],
    blueprint
  };
}


function buildOfficialUrlDiscoveryGuide() {
  return {
    answer_to_owner: 'I can find and maintain the official IRS/NYS/NYC URLs for common public tax forms. You only need to provide a URL when a form is obscure, prior-year, blocked, hard to locate, or you want a specific edition/year verified.',
    default_workflow: [
      'Use the seeded official government source catalog for common IRS/NYS/NYC forms.',
      'Allow staff/admin to add a source URL manually when a special form or year is needed.',
      'Capture PDFs directly from the official government URL when URL capture is enabled.',
      'Record source URL, capture date, checksum, file size, agency, tax year, form number, and instructions URL where available.',
      'Keep source records and captured PDFs blocked from client-output use until mapping, sample-fill QA, and professional verification are complete.'
    ],
    when_owner_urls_help: [
      'older prior-year forms not in the first catalog',
      'special notices, worksheets, or publications that are hard to search',
      'a government page changes or returns a blocked/download-only link',
      'you already know the exact PDF you want us to test'
    ],
    first_wave_can_be_found_by_platform: OFFICIAL_FORM_SOURCE_CATALOG.map((item) => ({ agency: item.agency, tax_year: item.tax_year, form_number: item.form_number, title: item.title, pdf_url: item.pdf_url, instructions_url: item.instructions_url || '' })),
    safety_gate: FORM_SOURCE_COLLECTION_POLICY.client_output_gate
  };
}

function buildOfficialUrlCaptureGuide() {
  return {
    enabled: process.env.ALLOW_OFFICIAL_FORM_URL_CAPTURE === 'true',
    mode: process.env.ALLOW_OFFICIAL_FORM_URL_CAPTURE === 'true' ? 'enabled' : 'disabled_by_default',
    why_disabled_by_default: 'URL capture is safe for official public forms, but production should intentionally enable it so staff know the app will make outbound requests and store immutable government PDFs.',
    env_to_enable: 'ALLOW_OFFICIAL_FORM_URL_CAPTURE=true',
    max_pdf_bytes: Number(process.env.OFFICIAL_FORM_CAPTURE_MAX_BYTES || 20 * 1024 * 1024),
    allowed_domains: FORM_SOURCE_COLLECTION_POLICY.download_sources_allowed,
    capture_steps: [
      'Validate that the source record points to an allowed official government HTTPS domain.',
      'Download the PDF from the source record PDF URL only when capture is enabled or staff requests dry-run planning.',
      'Reject non-PDF responses and files over the configured size limit.',
      'Write the exact captured file to the official form library.',
      'Record SHA-256 checksum, source URL, capture date, content type, byte size, and source record linkage.',
      'Create an official_forms record with mapping_status not_started and release_status blocked.',
      'Update the source record to pdf_captured/checksum_recorded while still blocking client output.'
    ],
    client_output_rule: FORM_SOURCE_COLLECTION_POLICY.client_output_gate
  };
}

function officialCaptureFileName(source = {}) {
  const form = safePathPart(source.form_number || cleanFormNumber(source.pdf_url || 'official-form'));
  const year = safePathPart(source.tax_year || 'current');
  const agency = safePathPart(source.agency || 'agency');
  return `${agency}-${year}-${form}.pdf`;
}

async function fetchOfficialPdfBuffer(url, options = {}) {
  const validation = validateOfficialSourceUrl(url, options.agency || '');
  if (!validation.ok) {
    const error = new Error(validation.note || 'Official source URL did not pass validation.');
    error.code = validation.status || 'official_url_validation_failed';
    error.validation = validation;
    throw error;
  }
  const maxBytes = Number(options.maxBytes || process.env.OFFICIAL_FORM_CAPTURE_MAX_BYTES || 20 * 1024 * 1024);
  const response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'accept': 'application/pdf,*/*;q=0.8', 'user-agent': 'JusticeTaxSolutionsOfficialFormCapture/0.1.27 (+official public form retrieval)' } });
  if (!response.ok) {
    const error = new Error(`Official PDF download failed with HTTP ${response.status}.`);
    error.code = 'official_pdf_fetch_failed';
    error.status = response.status;
    throw error;
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const lengthHeader = Number(response.headers.get('content-length') || 0);
  if (lengthHeader && lengthHeader > maxBytes) {
    const error = new Error(`Official PDF exceeds configured size limit of ${maxBytes} bytes.`);
    error.code = 'official_pdf_too_large';
    throw error;
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > maxBytes) {
    const error = new Error(`Official PDF exceeds configured size limit of ${maxBytes} bytes.`);
    error.code = 'official_pdf_too_large';
    throw error;
  }
  const looksPdf = buffer.subarray(0, 5).toString('utf8') === '%PDF-';
  if (!looksPdf && !contentType.includes('pdf')) {
    const error = new Error('Downloaded file does not look like a PDF.');
    error.code = 'official_pdf_not_pdf';
    throw error;
  }
  return { buffer, contentType, byteLength: buffer.length, validation };
}

function captureOfficialPdfBuffer(store, source = {}, buffer, meta = {}) {
  if (!source || !source.id) throw new Error('Official source record is required for capture.');
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('PDF buffer is required for capture.');
  const filename = meta.fileName || path.basename(new URL(source.pdf_url || 'https://example.gov/official-form.pdf').pathname) || officialCaptureFileName(source);
  const packageId = `url_capture_${source.id}`;
  const saved = saveOfficialFormFile(packageId, filename, buffer);
  const inferred = inferOfficialFormMetadata(filename, { agency: source.agency, taxYear: source.tax_year, sourceUrl: source.pdf_url || source.source_page_url || '' });
  const hash = sha256(buffer);
  const record = store.insert('official_forms', {
    package_id: packageId,
    ...inferred,
    agency: source.agency || inferred.agency,
    tax_year: source.tax_year || inferred.tax_year,
    form_number: source.form_number || inferred.form_number,
    title: source.title || '',
    doc_type: 'form_or_instruction_pdf',
    file_name: filename,
    mime_type: 'application/pdf',
    size_bytes: buffer.length,
    sha256: hash,
    storage_provider: 'official-url-capture-local-library-starter',
    storage_path: saved.fullPath,
    stored_name: saved.storedName,
    source_url: source.pdf_url || source.source_page_url || '',
    source_page_url: source.source_page_url || '',
    instructions_url: source.instructions_url || '',
    official_form_source_id: source.id,
    capture_method: 'official_government_url_capture',
    capture_status: 'captured_checksum_recorded',
    captured_at: new Date().toISOString(),
    content_type_reported: meta.contentType || '',
    mapping_status: 'not_started',
    field_map_status: 'not_started',
    can_drive_client_output: false,
    release_status: 'not_usable_for_client_output_until_mapped_sample_tested_and_professionally_verified',
    public_use_note: 'Captured from official government URL for mapping/reference only. Not usable for client filing output until source, edition, fields, calculations, sample-fill QA, and professional verification are complete.'
  });
  const updatedSource = store.update('official_form_sources', source.id, {
    pdf_capture_status: 'captured',
    checksum_status: 'recorded',
    captured_official_form_id: record.id,
    captured_sha256: hash,
    captured_size_bytes: buffer.length,
    captured_at: record.captured_at,
    field_extraction_status: 'not_started',
    mapping_status: 'pdf_captured_not_mapped',
    can_drive_client_output: false,
    release_status: 'not_usable_for_client_output_until_pdf_mapped_tested_and_verified'
  }) || source;
  store.insert('official_source_audits', {
    official_form_source_id: source.id,
    official_form_id: record.id,
    event_type: 'official_pdf_url_captured',
    agency: record.agency,
    form_number: record.form_number,
    tax_year: record.tax_year,
    source_url: record.source_url,
    sha256: hash,
    size_bytes: buffer.length,
    content_type_reported: meta.contentType || '',
    client_output_allowed: false,
    note: 'PDF captured and checksummed; still blocked from client output pending field extraction, mapping, sample-fill QA, and professional verification.'
  });
  return { source: updatedSource, official_form: { ...record, storage_path: undefined }, mapping_draft: buildMappingDraft(record) };
}

async function captureOfficialPdfFromSource(store, sourceId, options = {}) {
  const source = store.find('official_form_sources', (item) => item.id === sourceId && !item.deleted_at);
  if (!source) return { ok: false, status: 'not_found', error: 'Official form source record not found.' };
  const url = source.pdf_url || source.source_page_url || '';
  const validation = validateOfficialSourceUrl(url, source.agency);
  const plan = {
    source_id: source.id,
    agency: source.agency,
    form_number: source.form_number,
    tax_year: source.tax_year,
    pdf_url: source.pdf_url || '',
    source_page_url: source.source_page_url || '',
    validation,
    capture_enabled: process.env.ALLOW_OFFICIAL_FORM_URL_CAPTURE === 'true',
    dry_run: Boolean(options.dryRun),
    release_rule: FORM_SOURCE_COLLECTION_POLICY.client_output_gate
  };
  if (!validation.ok) return { ok: false, status: 'blocked_url_validation', plan, error: validation.note };
  if (options.dryRun) return { ok: true, status: 'dry_run_capture_plan', plan, next_step: 'Set ALLOW_OFFICIAL_FORM_URL_CAPTURE=true and call this endpoint without dry_run to capture the official PDF.' };
  if (process.env.ALLOW_OFFICIAL_FORM_URL_CAPTURE !== 'true' && options.force !== true) {
    return { ok: false, status: 'capture_disabled', plan, error: 'Official URL capture is disabled by default. Set ALLOW_OFFICIAL_FORM_URL_CAPTURE=true after confirming outbound official-form capture is allowed for this deployment.' };
  }
  try {
    const fetched = await fetchOfficialPdfBuffer(url, { agency: source.agency, maxBytes: options.maxBytes });
    const captured = captureOfficialPdfBuffer(store, source, fetched.buffer, { contentType: fetched.contentType, fileName: path.basename(new URL(url).pathname) || officialCaptureFileName(source) });
    return { ok: true, status: 'captured_checksum_recorded', capture: captured, plan: { ...plan, byte_length: fetched.byteLength, content_type: fetched.contentType } };
  } catch (error) {
    store.insert('official_source_audits', {
      official_form_source_id: source.id,
      event_type: 'official_pdf_url_capture_failed',
      agency: source.agency,
      form_number: source.form_number,
      tax_year: source.tax_year,
      source_url: url,
      error_code: error.code || 'capture_error',
      error_message: safeText(error.message || '', 500),
      client_output_allowed: false
    });
    return { ok: false, status: error.code || 'capture_error', plan, error: error.message || 'Official PDF capture failed.' };
  }
}

function buildDownloadVsUploadGuide() {
  return {
    short_answer: 'I can use official government websites to build and verify the source catalog. For actual field extraction and PDF fill testing, the app needs a captured PDF, which can come either from a government URL download or from a ZIP/PDF upload you provide.',
    when_i_can_get_them: ['IRS forms/instructions that are public on irs.gov', 'NYS forms/instructions on tax.ny.gov', 'NYC Department of Finance business tax forms on nyc.gov'],
    when_uploads_help: ['bulk ZIPs are faster for large batches', 'uploaded copies preserve the exact edition you want to test', 'offline checksum and repeatable QA are easier', 'some pages require navigation or JavaScript that is easier for you to download manually'],
    safest_workflow: FORM_SOURCE_COLLECTION_POLICY.preferred_order,
    current_build_behavior: 'v0.1.27 keeps the official government URL capture workflow, AI-first completion planning, professional-session readiness, calendar/scheduling integration readiness, and production-security hardening. It still does not mark any form as client-output-ready until a PDF is captured, checksummed, mapped, sample-tested, client-verified, and professionally/exception verified when required.'
  };
}

function buildControlledMappingPlan(store) {
  return {
    version_goal: 'v0.1.27 adds AI-first official form completion planning, professional-session readiness, appointment scheduling readiness, and production-security hardening on top of source-first IRS/NYS/NYC form ingestion, URL capture, and mapping.',
    source_catalog_count: OFFICIAL_FORM_SOURCE_CATALOG.length,
    source_inventory: buildOfficialSourceInventory(store).summary,
    stages: CONTROLLED_MAPPING_STAGES,
    policy: FORM_SOURCE_COLLECTION_POLICY,
    first_forms_to_map: officialSourceCatalog({}).slice(0, 12).map((item) => ({ ...item, blueprint: blueprintForFormNumber(item.form_number, item.agency) })),
    client_output_rule: FIELD_MAPPING_POLICY.principle
  };
}

module.exports = {
  AUTHORITATIVE_SOURCE_RULES,
  FIRST_FORM_WAVES,
  FIELD_MAPPING_POLICY,
  OFFICIAL_FORM_DIR,
  parseZipEntries,
  extractEntry,
  inferOfficialFormMetadata,
  ingestOfficialFormsZip,
  mappingQueue,
  buildMappingDraft,
  formPrioritySummary,
  uploadReadinessGuide,
  authoritativeSourceStatus,
  OFFICIAL_FORM_SOURCE_CATALOG,
  FORM_SOURCE_COLLECTION_POLICY,
  CONTROLLED_MAPPING_STAGES,
  officialSourceCatalog,
  validateOfficialSourceUrl,
  seedOfficialSourceCatalog,
  createOfficialSourceRecord,
  listOfficialFormSources,
  buildOfficialSourceInventory,
  blueprintForFormNumber,
  buildSourceDrivenMappingDraft,
  buildDownloadVsUploadGuide,
  buildControlledMappingPlan,
  buildOfficialUrlDiscoveryGuide,
  buildOfficialUrlCaptureGuide,
  captureOfficialPdfFromSource,
  captureOfficialPdfBuffer
};
