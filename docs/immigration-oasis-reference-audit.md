# Immigration Oasis reference audit for Justice Tax Solutions v0.1.1

Source reviewed: `Immigration Oasis Final last combined version Completed v1.10.160.zip`.

Use rule: Immigration Oasis was used as a reference pattern only. Immigration-specific form logic, USCIS language, and Immigration Oasis branding were not merged into Justice Tax Solutions.

## What the Immigration Oasis reference proved

The Immigration Oasis v1.10.160 reference is much more mature than the first Justice Tax Solutions foundation. It includes a broad route surface, public pages, intake logic, referral attribution, QR/flyer tools, staff/admin endpoints, compliance copy, health checks, regression tests, and deployment conventions.

Important mature patterns found:

- Public route hardening with trust/compliance language.
- Health/version endpoint used for Render deployment verification.
- Account/session pattern for clients and staff.
- Public intake with referral/helper attribution.
- Referral code creation, QR scan logging, tracked referral landing routes, and flyer generation.
- Referral attribution lock at signup/case creation so the original helper/community partner is preserved.
- Referral reward ledger with upgrade/no-stacking rules instead of fragile one-off counters.
- Staff workbench lanes, status updates, admin visibility, and CSV-style exports.
- Multi-AI vendor readiness and live-AI status reporting without exposing API keys.
- Regression/smoke tests to prevent accidental removal of critical routes and public pages.

## Adapted into Justice Tax Solutions v0.1.1

Justice Tax Solutions v0.1.1 adapts the relevant platform patterns into tax-specific workflows:

- Account signup/sign-in with secure session cookie.
- Client dashboard for tax cases, missing items, recommended next steps, and referral tools.
- Staff/professional workbench for tax cases, notices, back-tax/debt matters, and review status.
- Tax-problem-first intake with return help included.
- Tax case risk flags for IRS/NYS/NYC notices, deadlines, collections, cannot-pay issues, unfiled years, self-employment/gig-worker issues, and return review.
- Referral codes for signed-in users and public community partners.
- `/r/:code` tracked landing route with hashed scan logging.
- Public and signed-in QR PNG endpoints.
- Public and signed-in English/Spanish PDF flyer endpoints.
- Referral reward ledger with configurable tax-service tiers and upgrade/no-stacking rule.
- Staff referral attribution verifier and reward-ledger endpoints.
- Admin endpoints for cases, referrals, events, and live AI status.
- Tax catalog and workflow coverage endpoints for federal, NYS, and NYC MVP scope.
- Compliance pages and public copy adapted to tax: not IRS/NYS/NYC, not a law firm, no guaranteed refund/debt/OIC/payment-plan/penalty/audit result.
- Multi-AI vendor architecture for OpenAI, Gemini, Anthropic/Claude, and xAI/Grok with safe rule-based fallback.

## Tax-specific differences from Immigration Oasis

Tax must be stricter than immigration self-help in a few places:

- Paid federal tax-return preparation requires valid PTIN handling.
- Direct e-file requires an authorized e-file provider/EFIN path or a partner workflow.
- New York paid preparer/facilitator rules may apply.
- AI cannot be positioned as final tax authority.
- Refund, debt reduction, penalty abatement, payment plan, OIC, audit, and government outcomes must never be guaranteed.
- The system must distinguish organizer/draft/review from signed and filed returns.

## Remaining production gaps after v0.1.1

v0.1.1 is a strong deployable foundation, but not yet a final production tax-document system. Before live sensitive-tax-document use, add:

- Managed PostgreSQL persistence on Render.
- Production object storage for tax documents.
- Encryption-at-rest and stricter document access logs.
- Staff/professional role-based access controls beyond the starter staff role.
- Password reset and email verification.
- Stripe payments and payment-webhook-confirmed referral rewards.
- Signed professional review checklist and PTIN/CPA/EA/accountant assignment workflow.
- E-file provider/partner strategy and client authorization workflow.
- Secure upload scanning and retention/deletion controls.
- More formal regression tests around referral QR/flyer, attribution lock, staff queues, and tax-risk flags.
