# Justice Tax Solutions — v0.1.80-recovery.2 Build Receipt

Date: 2026-09-14  
Branch: `jts-v0.1.80-recovery-2-20260914`

## Located source truth

- Newest complete buildable source found at build start: `v0.1.80-recovery.1`
- Base branch: `jts-v0.1.80-recovery-1-20260913`
- Base commit: `9207f7106ba394dffde888f2aff319248bdeb92c`
- GitHub `main` remains at historical v0.1.79.
- Historical project records still refer to later v0.1.80–v0.1.124 work, but those exact source packages were not recoverable during this pass.
- This release remains explicitly on the recovery line and does not claim no-loss continuity with unavailable packages.

## Improvements

### Authentication abuse protection
- Dedicated login rate limiter.
- Dedicated account-mutation rate limiter for signup, password-reset, and verification routes.
- Failed-login audit events store a hash, not the entered email.
- Privileged sessions are reduced to 8 hours; customer sessions remain 30 days.
- Logout clears the cookie using matching security attributes.

### Staff/professional authorization safety
- Fixed the pending-status authorization bug: any nonempty staff status must now equal `active`.
- Legacy blank-status behavior is preserved according to the existing `REQUIRE_STAFF_APPROVAL` rule.
- Added admin-token-only provisioning for `staff`, `professional`, and `human_tax_specialist`.
- New privileged accounts always start `pending`.
- Provisioning requires a 16-character password and bcrypt cost 12.
- Added explicit pending/active/suspended status control.
- Admin/owner roles cannot be created through the ordinary provisioning endpoint.

### Professional inquiry quality and privacy
- Credential allowlist.
- Stronger basic email validation.
- English/Spanish server responses.
- SSN and EIN pattern rejection.
- 24-hour duplicate suppression by professional email for nonclosed inquiries.
- One-year retention-review date.
- Stable credential option values so translated labels do not corrupt identifiers.
- Spanish client-side sending/success/error handling and privacy acknowledgment translation.

### Storage consistency
- Storage version now follows `package.json` instead of the stale hardcoded v0.1.69.
- `professional_inquiries` is declared in the default storage schema and appears in schema/count reporting.
- Stale production-storage note was replaced with current-source truth.

## Intentionally not changed
- Tax calculations.
- Tax law/deadline logic.
- Official IRS/NYS/NYC PDFs.
- Official-form mappings.
- E-file/agency submission behavior.
- Pricing.
- Stripe/payment configuration.
- Customer case workflows.
- Branding.
- Render configuration.
- Production environment variables.

## Persistence limitation
The source still uses the JSON storage adapter. Production durability of professional inquiries cannot be claimed until the correct Render workspace/service is confirmed and persistent `DATA_DIR` or a completed PostgreSQL adapter is verified.

## Deployment
Not deployed. `main` not modified.
