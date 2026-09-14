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
const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

assert(pkg.version === '0.1.80-recovery.3', 'package version mismatch');
assert(lock.version === pkg.version, 'package-lock root version mismatch');
assert(lock.packages && lock.packages[''] && lock.packages[''].version === pkg.version, 'package-lock app version mismatch');

assert(!server.includes('req.query.admin_token'), 'admin token must never be accepted from URL query parameters');
assert(server.includes("const token = String(req.headers['x-admin-token'] || '');"), 'admin token must be header-only');
assert(server.includes('crypto.timingSafeEqual(candidateBuffer, expectedBuffer)'), 'timing-safe admin-token comparison missing');
assert(server.includes("app.use('/api/staff'"), 'staff no-store middleware missing');
assert(server.includes("app.use('/api/admin'"), 'admin no-store middleware missing');
assert(server.includes("res.setHeader('Cache-Control', 'no-store');"), 'no-store cache control missing');
assert(server.includes("res.setHeader('Referrer-Policy', 'no-referrer');"), 'internal no-referrer policy missing');

assert(!appJs.includes("localStorage.getItem('jts_admin_token')"), 'admin token must not be read from persistent localStorage');
assert(!appJs.includes("localStorage.setItem('jts_admin_token'"), 'admin token must not be written to persistent localStorage');
assert(appJs.includes("sessionStorage.getItem('jts_admin_token')"), 'session-only admin token read missing');
assert(appJs.includes("sessionStorage.setItem('jts_admin_token'"), 'session-only admin token write missing');

console.log('Justice Tax Solutions v0.1.80-recovery.3 focused checks passed');
