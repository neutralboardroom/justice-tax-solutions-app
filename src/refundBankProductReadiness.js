const VERSION = '0.1.56';

const REFUND_BANK_PRODUCT_POLICY = {
  status: 'future_integration_research_and_gate_only',
  answer: 'Yes, Justice Tax Solutions can be designed to support e-file, Refund Transfer/pay-by-refund, refund advance, and early-refund-access products later, but not as a simple website feature and not until the e-file, tax software/transmitter, bank-product, consumer-disclosure, security, and professional operating gates are complete.',
  core_distinction: 'A bank product provider such as SBTPG does not by itself make Justice Tax Solutions an IRS e-file provider or tax software transmitter. The platform would need an authorized e-file path, approved tax software/transmitter workflow, bank-product enrollment/contracting, and careful consumer disclosures before any live client offer.',
  current_site_rule: 'Do not market Refund Transfer, refund advance, early refund access, automatic bank products, or fee-withheld-from-refund as live on Justice Tax Solutions until vendor enrollment, e-file authorization, software/transmitter integration, disclosures, and testing are complete. Republic Bank Tax Refund Solutions is now tracked as a second candidate vendor alongside SBTPG, but neither provider is live on the platform yet.'
};

function buildRefundBankProductReadiness() {
  const gates = [
    {
      key: 'efin_ero_authorization',
      label: 'IRS authorized e-file provider / ERO path',
      status: 'blocked',
      why: 'Firm/Responsible Official application, suitability, and EFIN/ERO role must be approved before Justice Tax Solutions claims it can e-file client returns.'
    },
    {
      key: 'tax_software_transmitter',
      label: 'Tax software/transmitter integration',
      status: 'blocked',
      why: 'Refund Transfer and refund advance products usually sit inside approved professional tax software/transmitter workflows, not a standalone intake website.'
    },
    {
      key: 'bank_product_vendor_contract',
      label: 'Bank-product vendor enrollment/contract',
      status: 'blocked',
      why: 'A provider such as SBTPG must approve the tax professional/practice and the available products, fees, timing, disbursement methods, and software channels.'
    },
    {
      key: 'consumer_disclosures_and_consents',
      label: 'Consumer disclosures, consents, and fee display',
      status: 'blocked',
      why: 'Refund Transfers, refund advance loans, early refund access, disclosures, APR/fees, opt-in language, alternatives, and use/disclosure of tax return information must be handled carefully.'
    },
    {
      key: 'security_wisp_and_data_handling',
      label: 'WISP/security and taxpayer-data handling',
      status: 'blocked',
      why: 'Live return prep/e-file/bank products require real taxpayer-data handling controls, staff access controls, audit logs, retention/deletion procedures, and tested incident response.'
    },
    {
      key: 'payments_accounting_reconciliation',
      label: 'Fee reconciliation and accounting operations',
      status: 'blocked',
      why: 'Pay-by-refund means professional/platform fees are withheld after refund funding. Operations must handle unfunded returns, rejected returns, offsets, client refunds, disputes, and nonpayment.'
    },
    {
      key: 'state_law_and_lending_review',
      label: 'State law, lending, advertising, and refund-product compliance review',
      status: 'blocked',
      why: 'Refund advance products are loans from a bank partner and may carry APR/fees and state-specific restrictions; advertising and scripts need compliance review.'
    }
  ];
  return {
    ok: true,
    version: VERSION,
    policy: REFUND_BANK_PRODUCT_POLICY,
    short_answer: 'Feasible later, but blocked now.',

    candidate_vendors: [
      {
        key: 'sbtpg',
        name: 'Santa Barbara Tax Products Group (SBTPG)',
        status: 'candidate_only_not_integrated',
        product_categories_to_evaluate: ['Refund Transfer / pay-by-refund', 'refund advance / early refund access products where available', 'disbursement options'],
        notes: 'Evaluate supported professional tax software, enrollment requirements, fees, state/product limits, disclosures, funding timelines, unfunded-return handling, and reconciliation exports.'
      },
      {
        key: 'republic_bank_tax_refund_solutions',
        name: 'Republic Bank Tax Refund Solutions / RepublicRefund',
        status: 'candidate_only_not_integrated',
        product_categories_to_evaluate: ['Refund Transfer', 'Easy Advance', 'December Dollars Advance', 'EASY100 Advance', 'bank checks', 'direct deposit', 'Netspend prepaid card', 'ERO support/training/reporting tools'],
        notes: 'Republic is useful to compare because its public site markets ERO enrollment, Refund Transfer, advance products, checks/direct deposit/card options, taxpayer text updates, reporting tools, receivables assistance, and software purchase assistance. Exact live terms must come from the vendor contract and current disclosures.'
      }
    ],
    feasible_future_products: [
      { key: 'refund_transfer', label: 'Refund Transfer / pay-by-refund', future_use: 'Allow client to pay tax-prep/platform/professional fees from the refund after IRS/state funding, if product/vendor/software rules allow.' },
      { key: 'refund_advance', label: 'Refund advance loan', future_use: 'Optional loan product from bank partner, subject to credit/product approval, APR/fee disclosure, eligibility, and vendor availability.' },
      { key: 'early_refund_access', label: 'Early refund access product', future_use: 'Optional early access after IRS refund-funding signals or funding, depending on vendor product and bank/network participation.' },
      { key: 'card_direct_deposit_check', label: 'Disbursement choices', future_use: 'Direct deposit, card, or check disbursement depending on vendor and client choice.' }
    ],
    gates,
    suggested_build_sequence: [
      'Keep current platform as tax-problem-first organizer and professional-review funnel.',
      'Add a future e-file/bank-product readiness page and internal vendor evaluation checklist only.',
      'Before next tax season, choose professional tax software/transmitter stack and verify bank-product partners supported by that stack.',
      'Complete IRS e-file provider/ERO path and credential/Responsible Official controls.',
      'Negotiate/enroll with bank-product provider, compare SBTPG and Republic Bank Tax Refund Solutions against the chosen tax software stack, and load exact live disclosures, product terms, fees, states, and scripts.',
      'Build isolated return-prep/e-file module with consent, identity, signature, payment, refund-product, and audit logs.',
      'Pilot with invited clients only after test returns, rejected-return workflows, unfunded/refund-offset workflows, and reconciliation pass.'
    ],
    platform_copy_rules: [
      'Do not say refunds can be advanced or loaded early until vendor contracts and terms are live.',
      'Do not say clients can pay our fees from refund until Refund Transfer is live and tested.',
      'Do not call refund advance an IRS refund; describe it as an optional loan from the provider/bank if offered.',
      'Always disclose that e-file and direct deposit can be available without choosing a refund-product loan or transfer when applicable.',
      'Separate government taxes, penalties, interest, and agency payments from platform/professional fees.'
    ]
  };
}

module.exports = { VERSION, REFUND_BANK_PRODUCT_POLICY, buildRefundBankProductReadiness };
