const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'storage', 'uploads');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const APP_VERSION = require('../package.json').version;

const DEFAULT_DB = {
  meta: { app: 'Justice Tax Solutions', version: APP_VERSION, created_at: new Date().toISOString() },
  users: [],
  cases: [],
  documents: [],
  referrals: [],
  qr_scans: [],
  helper_starts: [],
  referral_rewards: [],
  payments: [],
  messages: [],
  events: [],
  professionals: [],
  professional_inquiries: [],
  review_requests: [],
  review_notes: [],
  review_artifacts: [],
  access_logs: [],
  release_events: [],
  password_reset_tokens: [],
  email_verification_tokens: [],
  staff_invites: [],
  compliance_checklists: [],
  client_approvals: [],
  document_share_tokens: [],
  field_fill_events: [],
  competitor_notes: [],
  document_verifications: [],
  extraction_jobs: [],
  field_value_verifications: [],
  official_form_packages: [],
  official_forms: [],
  official_form_mappings: [],
  official_form_mapping_records: [],
  official_form_release_gates: [],
  official_form_paid_pilot_cases: [],
  official_form_field_maps: [],
  official_form_sources: [],
  official_source_audits: [],
  tasks: [],
  client_checklist_events: [],
  form_upload_sessions: [],
  staff_notifications: [],
  client_acknowledgments: [],
  live_readiness_events: [],
  contact_attempts: [],
  service_fit_events: [],
  client_journey_events: [],
  security_plan_events: [],
  pilot_gate_events: [],
  email_template_events: [],
  production_config_events: [],
  storage_scan_events: [],
  email_delivery_events: [],
  deployment_check_events: [],
  professional_session_requests: [],
  professional_session_events: [],
  professional_availability_windows: [],
  professional_calendar_configs: [],
  appointment_scheduling_events: [],
  production_security_events: [],
  form_output_qa_events: [],
  professional_credential_events: [],
  professional_signoffs: [],
  professional_assignment_events: [],
  quotes: [],
  transactional_messages: [],
  payment_quote_events: [],
  appointment_message_events: [],
  pilot_release_events: [],
  form_9465_coordinate_lock_events: [],
  form_9465_official_sample_events: [],
  form_9465_client_verifications: [],
  form_9465_release_events: [],
  form_9465_final_release_events: [],
  form_9465_true_coordinate_qa_events: [],
  form_9465_capture_completion_events: [],
  public_launch_decisions: [],
  first_user_feedback: [],
  work_progress_drafts: [],
  case_progress_saves: [],
  deployment_data_checks: [],
  data_preservation_events: [],
  professional_work_drafts: [],
  deployment_continuity_snapshots: [],
  release_integrity_checks: [],
  quote_payment_preservation_checks: []
};

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
}

function readDb() {
  ensureDirs();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const merged = { ...DEFAULT_DB, ...parsed };
    for (const key of Object.keys(DEFAULT_DB)) {
      if (Array.isArray(DEFAULT_DB[key]) && !Array.isArray(merged[key])) merged[key] = [];
    }
    merged.meta = { ...DEFAULT_DB.meta, ...(parsed.meta || {}), version: APP_VERSION };
    return merged;
  } catch (error) {
    const backupPath = `${DB_PATH}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(DB_PATH, backupPath); } catch {}
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return { ...DEFAULT_DB };
  }
}

function writeDb(db) {
  ensureDirs();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ ...db, meta: { ...(db.meta || {}), version: APP_VERSION, updated_at: new Date().toISOString() } }, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
}

function randomId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function list(collection, predicate = null) {
  const db = readDb();
  const rows = Array.isArray(db[collection]) ? db[collection] : [];
  const filtered = predicate ? rows.filter(predicate) : rows;
  return filtered;
}

function find(collection, predicate) {
  return list(collection).find(predicate) || null;
}

function insert(collection, item) {
  const db = readDb();
  if (!Array.isArray(db[collection])) db[collection] = [];
  const now = new Date().toISOString();
  const record = { ...item, id: item.id || randomId(collection.slice(0, 4)), created_at: item.created_at || now, updated_at: item.updated_at || now };
  db[collection].unshift(record);
  writeDb(db);
  return record;
}

function update(collection, id, patch = {}) {
  const db = readDb();
  if (!Array.isArray(db[collection])) db[collection] = [];
  const idx = db[collection].findIndex((item) => item.id === id);
  if (idx === -1) return null;
  db[collection][idx] = { ...db[collection][idx], ...patch, updated_at: new Date().toISOString() };
  writeDb(db);
  return db[collection][idx];
}

function remove(collection, id) {
  const db = readDb();
  if (!Array.isArray(db[collection])) db[collection] = [];
  db[collection] = db[collection].filter((item) => item.id !== id);
  writeDb(db);
  return true;
}

function hashForAudit(value = '') {
  const salt = process.env.AUDIT_HASH_SALT || process.env.JWT_SECRET || 'justice-tax-local';
  return crypto.createHash('sha256').update(`${salt}:${String(value || '')}`).digest('hex').slice(0, 24);
}

function addEvent(type, payload = {}, req = null) {
  const clean = { ...(payload || {}) };
  for (const sensitive of ['ssn','socialSecurityNumber','fullAccountNumber','documents','password','token','reset_token','verification_token','storage_path','encryption_key']) delete clean[sensitive];
  const event = insert('events', {
    id: randomId('evt'),
    type,
    payload: clean,
    path: req ? req.path : '',
    ip_hash: req ? hashForAudit(String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()) : '',
    user_agent_summary: req ? String(req.headers['user-agent'] || '').slice(0, 180) : '',
    created_at: new Date().toISOString()
  });
  trimCollection('events', 1500);
  return event;
}

function trimCollection(collection, max = 1000) {
  const db = readDb();
  if (Array.isArray(db[collection]) && db[collection].length > max) {
    db[collection] = db[collection].slice(0, max);
    writeDb(db);
  }
}

function safeFileName(name = 'upload.bin') {
  const base = path.basename(String(name || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload.bin';
  return base;
}

function encryptionKey() {
  const raw = process.env.DOCUMENT_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-document-key-change-before-production';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { payload: Buffer.concat([iv, tag, encrypted]), iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decryptBuffer(payload) {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function saveUploadedFile(caseId, file) {
  ensureDirs();
  const folder = path.join(UPLOAD_DIR, String(caseId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '_'));
  fs.mkdirSync(folder, { recursive: true });
  const id = randomId('doc');
  const cleanOriginal = safeFileName(file.originalname);
  const filename = `${id}-${cleanOriginal}.enc`;
  const fullPath = path.join(folder, filename);
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const encrypted = encryptBuffer(file.buffer);
  fs.writeFileSync(fullPath, encrypted.payload);
  const record = insert('documents', {
    id,
    case_id: caseId,
    original_name: file.originalname,
    stored_name: filename,
    mime_type: file.mimetype,
    size_bytes: file.size,
    sha256,
    encrypted: true,
    encryption: 'aes-256-gcm-local',
    storage_provider: process.env.SECURE_OBJECT_STORAGE_CONFIGURED === 'true' ? 'object-storage-configured' : 'encrypted-local-starter',
    storage_path: fullPath,
    retention_status: 'active',
    public_note: 'Stored encrypted at rest in local starter storage. For live production, use managed object storage/private buckets, malware scanning, retention rules, and least-privilege access controls.'
  });
  return record;
}

function readUploadedFile(document) {
  if (!document || !document.storage_path || !fs.existsSync(document.storage_path)) return null;
  const payload = fs.readFileSync(document.storage_path);
  if (document.encrypted) return decryptBuffer(payload);
  return payload;
}

function getDocument(documentId) {
  return find('documents', (doc) => doc.id === documentId && !doc.deleted_at);
}

function storageSummary() {
  const db = readDb();
  const appRoot = path.resolve(__dirname, '..');
  const dataDirResolved = path.resolve(DATA_DIR);
  const uploadDirResolved = path.resolve(UPLOAD_DIR);
  const dataInsideAppDirectory = dataDirResolved.startsWith(appRoot + path.sep);
  const uploadsInsideAppDirectory = uploadDirResolved.startsWith(appRoot + path.sep);
  return {
    mode: process.env.DATABASE_URL ? 'json-local-with-postgres-schema-ready' : 'json-local-encrypted-documents',
    counts: Object.fromEntries(Object.keys(DEFAULT_DB).filter((k) => Array.isArray(DEFAULT_DB[k])).map((k) => [k, Array.isArray(db[k]) ? db[k].length : 0])),
    data_dir: DATA_DIR,
    upload_dir: UPLOAD_DIR,
    app_root: appRoot,
    data_inside_app_directory: dataInsideAppDirectory,
    uploads_inside_app_directory: uploadsInsideAppDirectory,
    data_path_risk: dataInsideAppDirectory || uploadsInsideAppDirectory,
    document_encryption: 'aes-256-gcm',
    secure_object_storage_configured: process.env.SECURE_OBJECT_STORAGE_CONFIGURED === 'true',
    production_storage_note: 'For paid users, DATA_DIR/UPLOAD_DIR must be persistent or external to the source release folder, or replaced by managed PostgreSQL/private object storage. Source deployments must never delete runtime data.'
  };
}

function logAccess(action, payload = {}, req = null) {
  const clean = { ...(payload || {}) };
  for (const sensitive of ['ssn','socialSecurityNumber','fullAccountNumber','password','token','storage_path','reset_token','verification_token']) delete clean[sensitive];
  const event = insert('access_logs', {
    id: randomId('acc'),
    action,
    payload: clean,
    path: req ? req.path : '',
    ip_hash: req ? hashForAudit(String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()) : '',
    user_agent_summary: req ? String(req.headers['user-agent'] || '').slice(0, 180) : '',
    created_at: new Date().toISOString()
  });
  trimCollection('access_logs', 2000);
  return event;
}

function currentSchemaSummary() {
  const db = readDb();
  const names = Object.keys(DEFAULT_DB).filter((k) => Array.isArray(DEFAULT_DB[k]));
  return {
    version: APP_VERSION,
    persistence_mode: process.env.DATABASE_URL ? 'postgres-database-url-present-json-adapter-active' : 'json-local',
    postgres_schema_file: 'db/postgres-schema.sql',
    collections: names.map((name) => ({ name, count: Array.isArray(db[name]) ? db[name].length : 0 })),
    production_note: 'v0.1.27 keeps the encrypted local development adapter and adds payment/quote approval, no-sensitive-details transactional-message planning, appointment confirmation/reminder tracking, and reschedule/cancel workflow hardening on top of professional operations, production-security, calendar/scheduling, AI-first form completion, official-form gates, and PostgreSQL/storage/malware safeguards. A full managed PostgreSQL adapter should be enabled before production scale, official form output, live payments, or live sensitive taxpayer document handling.'
  };
}

function createTokenRecord(collection, payload = {}, ttlMinutes = 60) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const record = insert(collection, { ...payload, token_hash: tokenHash, expires_at: expiresAt, used_at: '', status: 'active' });
  return { rawToken, record };
}

function findValidToken(collection, rawToken = '') {
  const tokenHash = crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
  const now = Date.now();
  return find(collection, (row) => !row.deleted_at && row.status === 'active' && !row.used_at && row.token_hash === tokenHash && Date.parse(row.expires_at || 0) > now);
}

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  DB_PATH,
  readDb,
  writeDb,
  list,
  find,
  insert,
  update,
  remove,
  addEvent,
  randomId,
  hashForAudit,
  logAccess,
  currentSchemaSummary,
  saveUploadedFile,
  readUploadedFile,
  getDocument,
  storageSummary,
  createTokenRecord,
  findValidToken
};
