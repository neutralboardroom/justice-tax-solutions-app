# Next Version Improvement List — after v0.1.80-recovery.1

Priority order is intentionally conservative until the missing later authoritative ZIP is recovered.

1. **Highest priority: recover and reconcile the missing later package**
   - Locate the exact historical v0.1.80 ZIP or any later authoritative Justice Tax Solutions ZIP.
   - Verify checksum before use.
   - Diff recovery changes against that package.
   - Carry forward only compatible improvements; never overwrite later working functionality with this recovery branch.

2. **Professional inquiry durability**
   - Verify the configured production storage backend persists `professional_inquiries` across deploys.
   - Add staff UI only after persistence is proven.
   - Add privacy-safe staff notifications without placing applicant details in logs or URLs.
   - Add retention/deletion controls appropriate to professional recruiting records.

3. **Authentication**
   - Add breached-password screening and stronger password guidance only with a properly vetted provider/library.
   - Add MFA for staff/professional accounts.
   - Create a controlled owner/admin provisioning workflow so no public endpoint is needed for privileged accounts.
   - Add rate limits specifically to login, reset, and verification endpoints.

4. **Public bilingual parity**
   - Verify all new professional-inquiry success/error states in Spanish.
   - Audit the complete public-page language pairings and navigation after reconciliation with the missing later build.

5. **Launch-readiness verification**
   - Clean extraction.
   - `npm install`.
   - `npm run check`.
   - `npm audit --audit-level=moderate`.
   - local startup and `/health`.
   - unauthorized staff-route checks.
   - public professional-inquiry happy/error/rate-limit tests.
   - persistence-across-restart test.
   - secret/runtime-data/internal-registry scans.

6. **Do not expand tax-law/form logic merely to create a version**
   - Any tax calculation, form mapping, deadline, filing, e-file, representation, or agency-submission change must be source-backed, tax-year/jurisdiction aware, human-reviewable, and separately tested.
