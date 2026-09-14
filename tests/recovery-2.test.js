const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'src', 'storage.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'public', 'tax-professionals.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

assert(pkg.version === '0.1.80-recovery.2', 'package version mismatch');
assert(lock.version === pkg.version, 'package-lock root version mismatch');
assert(lock.packages && lock.packages[''] && lock.packages[''].version === pkg.version, 'package-lock app version mismatch');

for (const marker of [
  'const loginLimiter = rateLimit',
  'const accountMutationLimiter = rateLimit',
  "app.post('/api/login', loginLimiter",
  "app.post('/api/signup', accountMutationLimiter",
  "app.post('/api/account/request-password-reset', accountMutationLimiter",
  "app.post('/api/account/reset-password', accountMutationLimiter",
  "app.post('/api/account/verify-email', accountMutationLimiter"
]) assert(server.includes(marker), `missing authentication abuse-control marker: ${marker}`);

assert(server.includes("const expiresIn = privileged ? '8h' : '30d';"), 'privileged-session lifetime hardening missing');
assert(server.includes("if (user.staff_status) return user.staff_status === 'active';"), 'pending/suspended staff fail-closed check missing');
assert(server.includes("store.addEvent('login_failed'"), 'failed-login audit event missing');

for (const marker of [
  "const PRIVILEGED_PROVISIONING_ROLES = new Set(['staff','professional','human_tax_specialist'])",
  "app.post('/api/admin/staff-users'",
  "app.post('/api/admin/staff-users/:id/status'",
  "password.length < 16",
  "staff_status: 'pending'"
]) assert(server.includes(marker), `missing controlled privileged-account marker: ${marker}`);
assert(!server.includes("PRIVILEGED_PROVISIONING_ROLES = new Set(['staff','professional','human_tax_specialist','admin'"), 'admin role must not be publicly provisionable');

for (const marker of [
  'PROFESSIONAL_INQUIRY_CREDENTIALS',
  'basicEmailIsValid',
  'professionalInquiryCopy',
  'duplicate_suppressed',
  'retention_review_after',
  "/\\b\\d{2}-\\d{7}\\b/"
]) assert(server.includes(marker), `missing professional-inquiry hardening marker: ${marker}`);

assert(storage.includes("const APP_VERSION = require('../package.json').version;"), 'storage version must follow package version');
assert(storage.includes('professional_inquiries: []'), 'professional inquiry collection must be declared in default storage schema');

for (const marker of [
  'name="language" type="hidden" value="English"',
  'value="Enrolled Agent"',
  'value="Tax Attorney"',
  'privacy_acknowledged',
  "data.language = spanish ? 'Spanish' : 'English';",
  'Enviando su consulta…'
]) assert(page.includes(marker), `missing bilingual professional-inquiry marker: ${marker}`);

for (const marker of [
  "'Send professional inquiry':'Enviar consulta profesional'",
  "'Enrolled Agent':'Agente inscrito'",
  "'Tax Attorney':'Abogado de impuestos'",
  'Confirmo que no estoy enviando registros de contribuyentes'
]) assert(appJs.includes(marker), `missing Spanish professional-inquiry translation: ${marker}`);

console.log('Justice Tax Solutions v0.1.80-recovery.2 focused checks passed');
