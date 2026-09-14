# Next Version Improvement List — after v0.1.80-recovery.2

Priority remains conservative because the historical v0.1.80 through v0.1.124 source packages are still unavailable.

1. **Recover and reconcile the missing later authoritative package**
   - Search for the exact historical v0.1.80 ZIP or any later Justice Tax Solutions release package.
   - Verify checksum and version markers before using it.
   - Diff this recovery line against the recovered package.
   - Carry forward compatible improvements only; never overwrite later working functionality.

2. **Verify production persistence before adding the professional-inquiry staff UI**
   - Confirm the correct Render workspace and Justice Tax Solutions service.
   - Verify `DATA_DIR` is on persistent storage or complete/enable the managed PostgreSQL adapter.
   - Test a professional inquiry through a restart/deploy and prove it survives.
   - Only then add the operational inquiry queue, retention review controls, and staff notifications.

3. **Continue authentication hardening**
   - Add MFA for staff/professional/admin accounts using a vetted implementation.
   - Add breached-password screening through an appropriate privacy-preserving provider/library.
   - Review production JWT/session secret configuration and add a fail-closed production startup check only after confirming current environment values.
   - Consider CSRF protection for authenticated state-changing browser requests.

4. **Privileged-account operations**
   - Add an owner-facing internal provisioning screen only after authentication/persistence are verified.
   - Add credential/identity verification evidence before professional activation.
   - Add explicit deactivation/session-revocation behavior for suspended privileged users.
   - Keep owner/admin creation outside ordinary provisioning endpoints.

5. **Bilingual parity**
   - Verify every professional-inquiry label, validation error, success state, duplicate-submission state, and navigation path in English and Spanish.
   - Run the complete public Spanish parity audit after any recovered later source is reconciled.

6. **Launch-readiness verification**
   - Clean source extraction.
   - `npm install`.
   - `npm run check`.
   - `npm audit --audit-level=moderate`.
   - local startup and `/health`.
   - auth rate-limit behavior tests.
   - pending/suspended staff authorization tests.
   - privileged provisioning tests.
   - professional-inquiry happy/error/duplicate/rate-limit tests.
   - persistence-across-restart test.
   - secret/runtime-data/internal-registry scans.

7. **Tax logic remains fail-closed**
   - Do not expand tax calculations, deadlines, official-form mappings, e-file, representation, or agency submission merely to create another version.
   - Any such change must be source-backed, tax-year/jurisdiction aware, human-reviewable, and separately tested.
