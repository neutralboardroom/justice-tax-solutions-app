const BRAND_SYSTEM = {
  name: 'Justice Tax Solutions',
  promise: 'Tax help when you need more than software.',
  public_positioning: 'Tax problems first; tax returns included.',
  personality: ['calm', 'plain-English', 'trustworthy', 'human-reviewed', 'anti-scam'],
  colors: [
    { token: '--brand-dark', value: '#0B3154', use: 'logo, headings, trust foundation' },
    { token: '--brand', value: '#0C5C78', use: 'primary actions and navigation emphasis' },
    { token: '--accent', value: '#C58A2B', use: 'warm secondary emphasis and caution' },
    { token: '--cream', value: '#FAF7F0', use: 'soft customer-facing page background' },
    { token: '--ink', value: '#102033', use: 'body text and readability' }
  ],
  typography: {
    stack: 'Inter, system UI, Segoe UI, Arial, sans-serif',
    rule: 'Header sizes must stay calm and readable; avoid oversized hero typography that crowds mobile users.'
  },
  logo_assets: ['/logo.svg', '/brand-mark.svg', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-512.png', '/site.webmanifest'],
  language_rules: [
    'Say “tax notice” or “tax letter” before saying “agency correspondence.”',
    'Say “what happened” before “case facts.”',
    'Say “human review” before “professional compliance workflow.”',
    'Never promise a refund, tax reduction, payment-plan approval, OIC acceptance, penalty relief, audit result, or government outcome.',
    'Keep public navigation short: How it works, Pricing, Referral Program, Sign in, Start free.',
    'Internal pages should not be featured in the public homepage navigation.'
  ]
};

const UX_POLISH_AUDIT = {
  version: '0.1.16',
  focus: 'customer-facing language, brand identity, font scale, logo/favicon, simpler public flow, and dashboard readability',
  improvements: [
    'Replaced internal version-heavy homepage copy with plain customer-facing language.',
    'Refined the logo system with a more polished shield/check/scale mark, PNG favicons, Apple touch icon, and updated web manifest.',
    'Reduced hero/header font scale to avoid oversized mobile headers.',
    'Simplified public navigation and moved internal diagnostic pages out of the main customer path.',
    'Rewrote the homepage flow around ordinary user concerns: notice, tax debt, return help, and gig work.',
    'Improved dashboard, signup, signin, pricing, referral, how-it-works, and security copy.',
    'Kept compliance acknowledgments but translated surrounding guidance into plain English.',
    'Added brand-system rules to protect future versions from drifting into technical/internal language.',
    'Added simple dashboard status language and a customer-experience audit page for pre-launch QA.'
  ],
  remaining_before_public_launch: [
    'Run mobile visual review after deployment.',
    'Connect final domain and verify brand asset rendering on browser tabs/social previews.',
    'Add real contact/support email and notification routing.',
    'Finalize Spanish customer-facing copy after English flow is stable.',
    'Add accessibility pass for contrast, focus states, labels, and keyboard navigation.',
    'Add production document storage, malware scanning, MFA, Stripe live webhooks, and verified professional procedures before accepting real sensitive tax documents.'
  ]
};

module.exports = { BRAND_SYSTEM, UX_POLISH_AUDIT };
