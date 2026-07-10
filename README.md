# Justice Tax Solutions v0.1.79 — Spanish parity, uniform navigation, and professional network inquiry

This build adds one consistent public menu across the platform, expands Spanish-language parity for public pages and common customer interactions, adds a customer-facing page for qualified tax professionals interested in joining the network, and continues the public-language cleanup.

# Justice Tax Solutions v0.1.78 — sitewide English/Español and mobile/tablet polish

Adds a prominent language selector to every page, a mobile menu with accessible touch targets, tablet navigation wrapping, responsive table handling, and small-screen layout refinements while preserving the approved logo, colors, fonts, and platform flows.

# Justice Tax Solutions v0.1.76 — public homepage cleanup

Streamlines the live public homepage by removing internal operations content, shortening repeated sections, tightening navigation, replacing the oversized intake sidebar with a compact sticky guide, and reducing visible consent friction while preserving the approved brand, six-path flow, prior-return prominence, and all safety/release gates.

## v0.1.75 — credits and dependents controlled workflows

Integrates official IRS credits and dependents forms with controlled Schedule EIC and Form 8880 workflows, professional-review organizers, and fail-closed AI-helper routing.

# Justice Tax Solutions v0.1.75 — credits and dependents controlled form engine

Adds seven verified official IRS assets covering Schedule EIC and Forms 8332, 8862, 8867, and 8880. The build includes checksum/revision/source metadata, technical field inventory, fail-closed AI-helper routing, a controlled Schedule EIC qualifying-child organizer, a narrow deterministic 2025 Form 8880 saver’s-credit calculation lane, staff-only synthetic sample PDFs, and professional-review organizers for prior credit disallowance, custodial-parent releases, and paid-preparer due diligence.

Real taxpayer data, final filing output, signatures, preparer certifications, e-file, agency submission, and credit/refund guarantees remain blocked.

# Justice Tax Solutions v0.1.74 — selected logo-system replacement

Adopts the selected **Concept 2** logo family (document + checkmark) across the core website assets, favicon/app icons, and referral-flyer marketing output while preserving the current color palette, typography, navigation structure, and platform flow.

## v0.1.73 — homepage prior-return review separation

Separates prior-return amendment review from new-return filing in the homepage choice architecture and strengthens its prominence without disturbing the six-path start flow.

# Justice Tax Solutions v0.1.72 — IRS individual return deep mapping and controlled pilot

Adds verified intake evidence for the two uploaded official-form archives and a narrow, fail-closed 2025 Form 1040 W-2-only lane with structured AI-helper questions, deterministic tax-table calculations, engineered field mappings, controlled sample PDF generation, and explicit human/professional/owner release gates. Real taxpayer data, signatures, final filing output, e-file, and agency submission remain blocked.


## v0.1.71 — IRS individual income tax form engine

Adds the uploaded IRS individual return forms, automated field inventory, safe sample generation, guided recommendation logic, and controlled QA evidence.

## v0.1.70 — Official form operational release gates

Adds automated AcroForm field inventory, per-form release evidence, fail-closed paid-pilot eligibility, and an internal Official Form Release Center. Captured PDFs remain blocked from paid print-ready use until mapping, sample output, visual QA, client verification, professional review, security, and owner approval all pass. IRS e-file and agency submission remain disabled.
# Justice Tax Solutions v0.1.64 - Release continuity, save/resume polish, and homepage-stable platform refinement

v0.1.62 is a broad non-form platform improvement pass. It preserves every previously built Justice Tax Solutions feature, keeps the no-new-IRS-forms-without-official-PDFs policy, and refines customer flow, staff/owner dashboards, pricing/help language, Spanish parity, marketing pages, upload safety, deployment readiness, and official-PDF intake readiness.

## v0.1.64 - Release continuity, save/resume polish, and homepage-stable platform refinement

This build preserves the current homepage setup and avoids adding new IRS form bundles. It strengthens deployment-safe continuity so public customers, staff, accountants, CPAs, EAs, and other tax professionals can save work, resume later, and keep account, case, quote, payment, document, and review information intact across platform updates.

Key additions:

- `/release-continuity.html`
- `src/releaseContinuity.js`
- `/api/platform/release-continuity-audit`
- `/api/platform/homepage-stability-rule`
- `/api/platform/save-resume-continuity-map`
- `/api/platform/deployment-safe-release-gates`
- `/api/platform/payment-quote-preservation-checklist`
- `/api/professional/work-progress/drafts`
- `/api/staff/release-continuity-board`
- `/api/staff/release-continuity-check`
- `/api/staff/quote-payment-preservation-check`

Data rule: deployments are source-code updates only. They must not wipe or reset users, login records, cases, saved drafts, uploaded document references, staff/professional work, quotes, payments, referral rewards, release gates, or audit logs.


## Main decision preserved

Do **not** add more logical-only IRS form bundles until Roger uploads official IRS PDFs or a verified official PDF source is captured and QA'd. Existing organizers and logical maps remain useful for controlled testing, but paid-user-ready official output requires official PDF capture, checksum, field/coordinate lock, sample-filled output, visual QA, staff/professional release, production security approval, and owner approval.

## Added in v0.1.62

- `/platform-continuity-polish.html` — one owner/staff control page for the broad platform audit.
- `src/platformContinuityPolish.js` — consolidated platform continuity, customer-flow, staff, pricing, Spanish, marketing, upload, deployment, and official-PDF readiness guidance.
- New readiness/polish APIs:
  - `GET /api/platform/continuity-polish-audit`
  - `GET /api/platform/customer-flow-quality-gate`
  - `GET /api/platform/staff-daily-operating-map`
  - `GET /api/platform/pricing-message-alignment`
  - `GET /api/platform/spanish-parity-action-plan`
  - `GET /api/platform/marketing-safety-review`
  - `GET /api/platform/official-pdf-readiness-ladder`
  - `GET /api/platform/deployment-smoke-test-plan`

## Polished in v0.1.62

- Homepage next-best-action guidance.
- Dashboard progress hub language.
- Staff daily quality-control lane.
- Staff cockpit/privacy-safe analytics positioning.
- Pricing free-vs-paid clarity.
- FAQ continuity language.
- Marketing safety language.
- Spanish public touchpoints.
- Official PDF intake readiness ladder.
- Deployment readiness smoke-test plan.
- Document upload safety reminders.

## Preserved

- Personal tax return filing intake.
- Business tax return filing/help intake.
- Prior-return review / amendment opportunity prominence.
- Free Tax Problem Truth Check.
- Spanish UX/parity pages.
- Existing controlled organizer/form bundles: IRS 9465, 433-F, 1040-X, 2848/8821, 843/9423/12153.
- SBTPG and Republic Refund as future vendor candidates only.
- Live sensitive uploads remain blocked.
- Final official form output, e-file, agency submission, direct debit, Refund Transfer, and refund advance remain blocked.
- No refund, savings, penalty-removal, payment-plan, amended-return, business-tax, professional-review, or government-outcome guarantees.

## Safe operating posture

This version is appropriate for public website review and controlled no-sensitive-data testing after deployment smoke tests. It is not ready for broad public advertising, real unredacted taxpayer uploads, final official IRS/NYS/NYC form output, e-file, agency submission, live bank products, or unrestricted professional review claims.

## Local checks

Run:

```bash
npm install
npm run check
npm audit --audit-level=moderate
npm start
```

Then smoke-test `/health`, `/`, `/platform-continuity-polish.html`, `/platform-readiness-workbench.html`, `/official-pdf-intake.html`, `/deployment-readiness.html`, `/official-forms.html`, `/dashboard.html`, `/staff.html`, `/staff-cockpit.html`, `/pricing.html`, `/faq.html`, `/marketing.html`, `/ayuda-impuestos-espanol.html`, `/document-safety-center.html`, and the v0.1.62 APIs.


## v0.1.63 - Deployment-safe persistence and save/resume continuity

This build pauses new IRS form additions and focuses on preserving customer, staff, accountant/CPA/professional, payment, document, and work-progress data across deployments.

Key additions:

- `/platform-data-continuity.html, /release-continuity.html`
- `/api/platform/data-continuity-safeguards`
- `/api/platform/persistence-readiness`
- `/api/platform/save-resume-readiness`
- `/api/platform/deployment-data-preservation-checklist`
- `/api/work-progress/drafts`
- `/api/cases/:id/progress-save`
- `/api/staff/deployment-data-check`

Deployment rule: source-code deployments must never wipe user accounts, login records, cases, saved drafts, uploaded document records, staff notes, professional work, quotes, payments, or audit logs. Runtime data must live in managed PostgreSQL/private object storage or persistent external DATA_DIR/UPLOAD_DIR paths, not inside a replaceable source ZIP.


## v0.1.68 — IRS Tax Debt Resolution Form Engine
See `docs/v0.1.68-irs-tax-debt-resolution-form-engine.md`. Official IRS PDFs are included as controlled source assets with checksum tracking; final output and submission remain blocked pending mapping and QA gates.


## v0.1.70
Adds production operational evidence gates, automated technical semantic mapping for all inventoried fields, sample-filled output generation, automated page render QA, and fail-closed human/professional/owner approval controls. See `docs/v0.1.70-production-operational-gates.md`.


## v0.1.78 — public-language and internal-workspace separation
- Removed the visible Language / Idioma label while preserving the prominent English / Español toggle and accessible labeling.
- Audited every HTML page for customer-facing build, pilot, QA, release, mapping, and version language.
- Rewrote public tax-help pages in plain customer language.
- Removed release-note and continuity blocks from public pages.
- Rebuilt the public Official Forms page as a customer guide and preserved administration tools in a staff-only workspace.
- Added server-side staff access protection and no-index controls for operational, QA, deployment, and owner pages.
- Preserved current public workflows, dashboards, responsive navigation, form engines, staff tools, and security boundaries.
