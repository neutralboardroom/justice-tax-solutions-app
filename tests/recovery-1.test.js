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
const page = fs.readFileSync(path.join(root, 'public', 'tax-professionals.html'), 'utf8');

assert(/^0\.1\.80-recovery\.\d+$/.test(pkg.version), 'package must remain on the v0.1.80 recovery line');
assert(lock.version === pkg.version, 'package-lock root version mismatch');
assert(lock.packages && lock.packages[''] && lock.packages[''].version === pkg.version, 'package-lock app version mismatch');
assert(server.includes("password.length < 12"), '12-character password minimum missing');
assert(!server.includes("password.length < 6"), 'legacy 6-character signup minimum still present');
assert(server.includes("const role = 'client';"), 'public signup must remain client-only');
assert(!server.includes("body.staff_code === process.env.STAFF_SIGNUP_CODE"), 'public staff-code escalation must be removed');
assert(server.includes("app.post('/api/professional-inquiries'"), 'professional inquiry POST endpoint missing');
assert(server.includes("app.get('/api/staff/professional-inquiries'"), 'protected professional inquiry staff endpoint missing');
assert(server.includes("app.post('/api/staff/professional-inquiries/:id/status'"), 'professional inquiry status workflow missing');
assert(page.includes('id="professional-interest-form"'), 'professional inquiry form missing');
assert(page.includes('/api/professional-inquiries'), 'professional inquiry form is not wired to persistence API');
assert(page.includes('privacy_acknowledged'), 'professional inquiry privacy acknowledgment missing');

console.log('Justice Tax Solutions recovery.1 compatibility checks passed');
