# Justice Tax Solutions research and game plan

## Strategic conclusion

Justice Tax Solutions should be a tax-problem-first platform that also prepares/reviews tax returns. It should not start as a generic TurboTax clone.

Best public positioning:

**Tax help when you need more than software.**

## Primary doors

1. Upload a Tax Notice
2. Tax Debt or Back Taxes
3. Prepare or Review a Tax Return
4. Self-Employed or Gig Worker Taxes
5. Prior-Year or Amended Return
6. CPA / Accountant / EA / Tax Attorney Review

## Why this is different from TurboTax

TurboTax and similar products focus heavily on ordinary filing. Justice Tax Solutions focuses on fear, confusion, notices, debt, deadlines, missing returns, New York-specific issues, and human review.

## Compliance principles

- Paid federal tax return preparation requires a valid PTIN.
- Direct e-file requires IRS authorized e-file provider status or an e-file partner.
- New York preparer/facilitator registration may be required.
- Tax debt/OIC marketing must not promise unrealistic outcomes.
- No ghost preparer positioning.
- Legal advice only through licensed attorneys when separately arranged.

## Product phases

### v0.1 Foundation

- Public site
- Tax-problem-first intake
- Return-help intake
- Referral system with QR/flyers
- Multi-AI architecture
- Rule-based risk flags
- Compliance pages

### v0.2 Secure case system

- Login
- PostgreSQL
- Secure file storage
- Staff dashboard
- Better case statuses
- Payment setup

### v0.3 Tax notice analyzer

- IRS/NYS/NYC notice taxonomy
- Deadline extraction
- Agency-specific action plans
- Upload-to-summary workflow

### v0.4 Return organizer

- 1040 organizer
- NY IT-201/IT-203 organizer
- W-2 / 1099 intake
- Gig worker path
- Missing documents

### v0.5 Professional review

- PTIN preparer queue
- CPA/accountant review queue
- EA/tax attorney escalation
- Client approval workflow
- Prepared-by and reviewed-by audit logs

### v0.6 Tax debt workflows

- Payment-plan screen
- Hardship/CNC screen
- OIC pre-screen
- Penalty abatement
- Missing return compliance flags

### v1.0 Launch MVP

- Tax notice help
- Return organizer
- Gig worker path
- NY-focused personal tax path
- Paid human review
- Referral partner program

## MVP forms/workflows

### Federal

- 1040 / 1040-SR
- Schedule 1, 2, 3
- Schedule A, B, C, D, E basic, SE
- 8812, 8863, 8962, 8889
- 1040-ES, 1040-X, 4868
- 9465 payment plan
- 433-F / 433-A organizer
- 656 OIC pre-screen

### New York State

- IT-201
- IT-203
- IT-2
- IT-196
- IT-201-ATT
- IT-201-X / IT-203-X
- IT-370
- IT-2105 / IT-2104
- IT-213, IT-215, IT-214
- DTF-4 / DTF-5 screening

### NYC

- Personal income tax residency questions through NY return
- NYC Department of Finance notice workflow
- UBT screening
- Commercial Rent Tax screening
- NYC business/non-property tax debt routing

## Referral program requirements

- Unique code per partner
- Tracked URL
- QR code
- Printable flyer
- Partner dashboard
- Admin visibility
- Reward language configurable before launch
- Referral partner should not receive private tax details unless separately authorized

## Deployment

Use GitHub + Render for v0.1. A different host is not required for the foundation. Production tax document handling may eventually benefit from managed object storage, stronger database configuration, and stricter role-based access controls.
