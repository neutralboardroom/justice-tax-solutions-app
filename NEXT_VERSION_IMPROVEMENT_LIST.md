# Next Version Improvement List — after v0.1.80-recovery.3

1. **Recover the unavailable later authoritative package**
   - Continue searching for exact historical v0.1.80–v0.1.124 source packages.
   - Verify checksum/version before use.
   - Reconcile forward without overwriting later working functionality.

2. **Verify production persistence**
   - Confirm the correct Render workspace/service.
   - Prove persistent `DATA_DIR` or complete the PostgreSQL adapter.
   - Test continuity across restart/deploy before adding a professional-inquiry operating queue.

3. **Authentication**
   - Add MFA for staff/professional/admin accounts using a vetted implementation.
   - Add privacy-preserving breached-password screening.
   - Verify production JWT/session/admin-token secret strength and rotation.
   - Add CSRF protection for cookie-authenticated state-changing browser requests after mapping every affected frontend call.

4. **Privileged browser operations**
   - Prefer signed-in staff accounts over manual admin-token entry for ordinary work.
   - Add explicit browser control to clear the session-only fallback admin token.
   - Add owner-only privileged provisioning UI only after persistence and authentication controls are verified.

5. **Professional inquiry**
   - Verify persistence across restart/deploy.
   - Then add a protected staff queue, credential review evidence, retention/deletion controls, and privacy-safe notifications.

6. **Launch-readiness verification**
   - Clean extraction, `npm install`, `npm run check`, `npm audit --audit-level=moderate`.
   - Runtime startup and `/health`.
   - Confirm query-string admin tokens are rejected.
   - Confirm privileged API responses are non-cacheable.
   - Confirm pending/suspended staff remain blocked.
   - Persistence-across-restart and secret/runtime-data scans.

7. **Tax logic remains fail-closed**
   - Do not expand calculations, deadlines, official-form mappings, e-file, representation, or agency submission without authoritative current sources and separate testing.
