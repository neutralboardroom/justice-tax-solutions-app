# Justice Tax Solutions v0.1.38

v0.1.38 adds the IRS Form 9465 official PDF capture/upload completion workflow, coordinate-lock simulation, and staff approval-gate reporting. It builds on v0.1.37 by making the capture/upload and coordinate QA process more operational while keeping final client IRS output blocked unless actual official PDF, checksum, true coordinate lock, sample QA, client verification, professional release, payment/quote, and production-security gates pass.

## Included through v0.1.38

- Tax-problem-first Justice Tax Solutions platform.
- AI-first form completion planning.
- Official IRS/NYS/NYC source catalog and controlled mapping workflow.
- IRS Form 9465 completion plan, sample QA, visual QA, fill/overlay engine prep.
- IRS Form 9465 URL capture readiness.
- IRS Form 9465 official PDF upload fallback when URL capture is blocked.
- IRS Form 9465 checksum validation and coordinate-lock workflow.
- IRS Form 9465 official sample output preview and visual overlay comparison packet workflow.
- IRS Form 9465 client verification checklist, professional release gate, final output gate audit, and client-ready draft path.
- IRS Form 9465 operational capture/upload test and true-coordinate QA workflow.
- IRS Form 9465 capture/upload completion readiness, coordinate-lock simulation plan, staff approval-gate report, and internal completion packet.
- Professional operations and credential verification workflow.
- Payments, quotes, transactional-message records, appointment confirmations/reminders.
- Live online consultation and professional scheduling readiness.
- Marketing conversion pages, staff cockpit, analytics, and private pilot release-candidate gates.
- Production security and sensitive-upload readiness gates.

## Added in v0.1.38

New module:

- `src/form9465CaptureCompletion.js`

New endpoints:

- `GET /api/tax/forms/9465/capture-completion-readiness`
- `GET /api/tax/forms/9465/coordinate-lock-simulation-plan`
- `POST /api/tax/forms/9465/staff-approval-gate-report`
- `POST /api/tax/forms/9465/capture-completion-packet`
- `GET /api/cases/:id/forms/9465/capture-completion-readiness`
- `POST /api/cases/:id/forms/9465/staff-approval-gate-report`
- `POST /api/cases/:id/forms/9465/capture-completion-packet`
- `GET /api/staff/forms/9465/capture-completion-board`
- `POST /api/staff/forms/9465/capture-completion-status`
- `POST /api/staff/forms/9465/staff-approval-gate-status`

## Capture/upload completion workflow

The workflow checks whether the official IRS Form 9465 source has been seeded, whether the official PDF has been captured or uploaded, whether a checksum is recorded, whether basic PDF inspection passes, whether staff recorded source/checksum review, and whether the real page coordinates have been locked against the official PDF.

## Coordinate-lock simulation

v0.1.38 adds a simulation/rehearsal path so staff can practice page 1/page 2 coordinate locks, sample overlay review, and staff approval before real production coordinates are locked. Simulation approval is always marked as training only and cannot authorize final client IRS output.

## Staff approval gates

The staff approval-gate report separates:

- source/capture or upload approval;
- true coordinate lock approval;
- operational QA approval;
- optional simulation rehearsal approval;
- final release audit gates.

Simulation records cannot substitute for actual release gates.

## Final output remains blocked

v0.1.38 does not enable final client-facing official IRS Form 9465 output unless every required actual gate passes. In the default pilot/demo state, it remains blocked. Final output still requires:

- official IRS PDF captured/uploaded and checksummed;
- exact AcroForm fields or overlay coordinates locked against the real PDF;
- visual sample QA passed;
- overflow/signature/direct-debit checks passed;
- client values verified;
- required professional release recorded;
- payment/quote gates satisfied;
- production security, storage, malware, access-control, WISP, retention, incident-response, and operating gates complete.

## Environment and operations

Do not include secrets or taxpayer documents in ZIP builds. Real sensitive document handling must remain blocked until production database, private storage, malware scanning, staff/professional access controls, WISP-style safeguards, email, Stripe webhook, verified professionals, and operating procedures are configured.
