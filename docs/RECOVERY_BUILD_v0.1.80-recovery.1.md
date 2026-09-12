# Justice Tax Solutions — v0.1.80-recovery.1 Build Receipt

Date: 2026-09-13  
Branch: `jts-v0.1.80-recovery-1-20260913`

## Source truth

- Complete recoverable base: v0.1.79
- Base commit: `2994d619fc01cd496ce075da1ea31c55b56985e0`
- Historical continuation evidence identifies a later `justice-tax-solutions-v0.1.80.zip` with SHA-256 `6203c45229e1709a6d6584334a47ec41c2bb8bf8293bd467a49bb15462707b5b`.
- That historical ZIP was not recoverable from the accessible Library during this build.
- Older project history also refers to later Justice Tax Solutions builds, but those exact packages were not available as development bases.
- Therefore this release is intentionally labeled **recovery**, not a no-loss successor to an unavailable later ZIP.

## Material changes

1. **Functional tax-professional inquiry**
   - New public `POST /api/professional-inquiries`.
   - Stores a bounded professional inquiry record.
   - Dedicated rate limit: 8 submissions per 15 minutes per limiter key.
   - Honeypot automation trap.
   - Explicit acknowledgment that taxpayer/confidential client records must not be submitted.
   - Rejects SSN-shaped values.
   - Response explicitly avoids implying engagement, employment, assignments, or guaranteed work.

2. **Protected staff workflow**
   - New `GET /api/staff/professional-inquiries`.
   - New `POST /api/staff/professional-inquiries/:id/status`.
   - Both require existing staff authorization.
   - Controlled statuses: new, contacted, reviewing, accepted, declined, closed.

3. **Authentication hardening**
   - Public signup password minimum increased from 6 to 12 characters.
   - Password-reset minimum increased from 8 to 12 characters.
   - Public `/api/signup` can create client accounts only.
   - Public staff-code / role self-selection path removed.

4. **Regression protection**
   - Existing smoke suite updated for recovery version identity.
   - New `tests/recovery-1.test.js` checks version consistency, password policy, client-only signup, professional-inquiry persistence, protected staff access markers, and privacy acknowledgment wiring.

## Explicitly preserved

No intentional changes were made to:

- tax calculations or tax-rule logic;
- official IRS/NYS/NYC form PDFs or form mappings;
- pricing or payment amounts;
- Stripe configuration;
- filing/e-file claims or submission behavior;
- customer case workflows;
- professional tax-review logic;
- branding assets;
- Render deployment configuration;
- production environment variables;
- live deployment state.

## Validation limits

The branch was produced through the connected GitHub repository so all inherited binary assets remain intact. The isolated build container could not network-clone the repository, so a clean local `npm install` / full `npm run check` could not be executed in this session. Focused source-level regression assertions were added, and all changed files were re-read from the branch after commit.

## Deployment

Not deployed. Main branch not modified.
