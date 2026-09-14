# Justice Tax Solutions — v0.1.80-recovery.3 Build Receipt

Date: 2026-09-14
Branch: `jts-v0.1.80-recovery-3-20260914`
Base: v0.1.80-recovery.2, commit `bde3f04be5f28bd602d4ec008747a5ce6df6d5e9`

## Source truth
This is a recovery-line successor. Historical later packages through v0.1.124 remain unavailable and are not claimed as the source base.

## Security improvements
- Removed `req.query.admin_token` authentication.
- Admin token accepted only through `x-admin-token`.
- Added timing-safe token comparison.
- Browser fallback token changed from persistent localStorage to sessionStorage.
- Staff/admin API responses set no-store/no-cache.
- Internal protected HTML pages set no-store/no-cache/noindex/no-referrer.

## Preserved
Tax calculation logic, official forms/assets, mapping logic, pricing, payment configuration, customer workflows, prior authentication improvements, professional inquiry workflow, branding, and deployment configuration.

## Deployment
Not deployed. Main branch unchanged.
