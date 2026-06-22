// entityTypeRequirements — per-entity-type checklist of (1) KYC / legal
// documents a professional typically needs to collect from the client
// and (2) recurring services a CA / lawyer commonly delivers for that
// client type.
//
// Source: standard Indian practice for each entity class (Income-tax
// Act + Companies Act 2013 + LLP Act 2008 + GST Act + MSMED Act +
// Indian Trusts Act + Societies Registration Act). Reviewers: a CA +
// a litigator should sign these lists off before they're treated as
// authoritative — this is a starting catalog, not legal advice.
//
// Structure per entity:
//   {
//     label,
//     documents: [{ key, label, description, category, mandatory }],
//     services:  [{ key, label, description, cadence }],
//   }
//
// `category` on documents helps the UI group them (KYC / Registration
// / Financial / Compliance). `cadence` on services describes how
// often they recur (one-time / monthly / quarterly / annual / ad-hoc).

const KYC = 'kyc';
const REG = 'registration';
const FIN = 'financial';
const COM = 'compliance';

const COMMON_KYC = [
  { key: 'pan', label: 'PAN card', description: 'Permanent Account Number card.', category: KYC, mandatory: true },
  { key: 'aadhaar', label: 'Aadhaar card', description: 'Unique identity card (masked copy acceptable for KYC).', category: KYC, mandatory: true },
];

const COMMON_FINANCIAL = [
  { key: 'bank_statement', label: 'Bank statement', description: 'Last 12 months for the financial year being filed.', category: FIN, mandatory: true },
];

const ENTITIES = {
  individual: {
    label: 'Individual',
    documents: [
      ...COMMON_KYC,
      { key: 'form16', label: 'Form 16', description: 'TDS certificate from employer covering salary + tax deducted.', category: FIN, mandatory: false },
      { key: 'form26as', label: 'Form 26AS', description: 'Annual tax credit statement from TRACES.', category: FIN, mandatory: true },
      { key: 'salary_slips', label: 'Salary slips', description: 'March + any month with bonuses, if salaried.', category: FIN, mandatory: false },
      { key: 'rent_receipts', label: 'Rent receipts (HRA)', description: 'Required if claiming HRA exemption.', category: FIN, mandatory: false },
      { key: 'investment_proofs', label: 'Investment proofs (80C/80D etc.)', description: 'ELSS, PPF, life insurance premium, mediclaim, etc.', category: FIN, mandatory: false },
      { key: 'capital_gains_statement', label: 'Capital gains statement', description: 'From broker — equity + MF + property sale.', category: FIN, mandatory: false },
      { key: 'home_loan_interest', label: 'Home loan interest certificate', description: 'For 24(b) deduction.', category: FIN, mandatory: false },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'itr_filing', label: 'Income tax return (ITR) filing', description: 'Quarterly advance tax + annual ITR-1/2/3 as applicable.', cadence: 'annual' },
      { key: 'tax_planning', label: 'Tax planning advisory', description: 'Investment + deduction planning to optimise next year\'s liability.', cadence: 'annual' },
      { key: 'tds_refund_tracking', label: 'TDS refund tracking', description: 'Filing rectifications + following up on refund.', cadence: 'ad-hoc' },
      { key: 'notice_response', label: 'IT notice response', description: 'Handling 143(1), 142(1), 148, 245 notices.', cadence: 'ad-hoc' },
    ],
  },

  sole_proprietor: {
    label: 'Sole proprietor',
    documents: [
      ...COMMON_KYC,
      { key: 'shop_act_license', label: 'Shop & Establishment Act license', description: 'State-specific trade license.', category: REG, mandatory: false },
      { key: 'udyam_registration', label: 'Udyam (MSME) registration', description: 'Recommended for any micro / small / medium enterprise.', category: REG, mandatory: false },
      { key: 'gst_certificate', label: 'GST registration certificate', description: 'If turnover crosses the threshold or interstate / e-commerce.', category: REG, mandatory: false },
      { key: 'profession_tax', label: 'Profession tax registration', description: 'State-specific — Maharashtra, Karnataka, etc.', category: REG, mandatory: false },
      { key: 'books_of_accounts', label: 'Books of accounts', description: 'Cashbook, ledger, sales/purchase registers.', category: FIN, mandatory: true },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'gst_filing', label: 'GST returns (GSTR-1, 3B, 9)', description: 'Monthly / quarterly based on QRMP eligibility.', cadence: 'monthly' },
      { key: 'itr_filing', label: 'ITR filing (Business income)', description: 'ITR-3 / ITR-4 Sugam.', cadence: 'annual' },
      { key: 'tds_returns', label: 'TDS returns (24Q/26Q)', description: 'Only if employing staff or paying contractors.', cadence: 'quarterly' },
      { key: 'bookkeeping', label: 'Bookkeeping', description: 'Monthly accounting + bank reconciliation.', cadence: 'monthly' },
      { key: 'tax_audit', label: 'Tax audit (44AB)', description: 'If turnover > ₹1 cr (or ₹10 cr with digital receipts).', cadence: 'annual' },
    ],
  },

  partnership: {
    label: 'Partnership firm',
    documents: [
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (of each partner)` })),
      { key: 'partnership_deed', label: 'Partnership deed', description: 'Registered partnership agreement.', category: REG, mandatory: true },
      { key: 'firm_registration', label: 'Firm registration certificate', description: 'Registrar of Firms certificate (optional but recommended).', category: REG, mandatory: false },
      { key: 'pan_firm', label: 'PAN of the firm', description: 'Separate PAN issued in the firm\'s name.', category: KYC, mandatory: true },
      { key: 'gst_certificate', label: 'GST registration certificate', description: 'If turnover crosses threshold / interstate.', category: REG, mandatory: false },
      { key: 'books_of_accounts', label: 'Books of accounts', description: 'Maintained at the firm level — cashbook, ledger, journals.', category: FIN, mandatory: true },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'gst_filing', label: 'GST returns', description: 'GSTR-1 + 3B + 9.', cadence: 'monthly' },
      { key: 'itr_filing', label: 'ITR-5 filing', description: 'Annual return for firms.', cadence: 'annual' },
      { key: 'partner_share_calculation', label: 'Partner share-of-profit calculation', description: 'Remuneration + interest on capital + share distribution.', cadence: 'annual' },
      { key: 'tax_audit', label: 'Tax audit (44AB)', description: 'If turnover > ₹1 cr.', cadence: 'annual' },
      { key: 'partnership_deed_update', label: 'Partnership deed amendments', description: 'When partners join/leave or profit-sharing changes.', cadence: 'ad-hoc' },
    ],
  },

  llp: {
    label: 'Limited Liability Partnership (LLP)',
    documents: [
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (of each designated partner)` })),
      { key: 'llp_agreement', label: 'LLP Agreement', description: 'Registered agreement defining profit sharing, capital, etc.', category: REG, mandatory: true },
      { key: 'coi_llp', label: 'Certificate of Incorporation (LLP)', description: 'Issued by MCA on registration.', category: REG, mandatory: true },
      { key: 'llpin', label: 'LLPIN', description: 'LLP Identification Number assigned by MCA.', category: REG, mandatory: true },
      { key: 'dpin', label: 'DPIN (each designated partner)', description: 'Designated Partner Identification Number.', category: REG, mandatory: true },
      { key: 'dsc', label: 'Digital Signature Certificate (DSC)', description: 'Required for every designated partner for MCA filings.', category: REG, mandatory: true },
      { key: 'pan_llp', label: 'PAN of the LLP', description: 'Separate PAN issued in the LLP\'s name.', category: KYC, mandatory: true },
      { key: 'tan_llp', label: 'TAN', description: 'Required if the LLP deducts TDS.', category: REG, mandatory: false },
      { key: 'gst_certificate', label: 'GST registration certificate', description: 'If turnover crosses threshold.', category: REG, mandatory: false },
      { key: 'form11', label: 'Form 11 (annual return)', description: 'Filed within 60 days of FY-end.', category: COM, mandatory: true },
      { key: 'form8', label: 'Form 8 (Statement of Account & Solvency)', description: 'Filed within 30 days from end of 6 months of FY-end.', category: COM, mandatory: true },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'roc_filings_llp', label: 'ROC filings (Form 8, Form 11)', description: 'Annual statutory filings.', cadence: 'annual' },
      { key: 'gst_filing', label: 'GST returns', description: 'GSTR-1, 3B, 9.', cadence: 'monthly' },
      { key: 'itr_filing', label: 'ITR-5 filing', description: 'Annual return for LLP.', cadence: 'annual' },
      { key: 'designated_partner_kyc', label: 'DIR-3 KYC (designated partners)', description: 'Annual KYC by 30 Sep.', cadence: 'annual' },
      { key: 'tax_audit', label: 'Tax audit (44AB)', description: 'If turnover > ₹1 cr.', cadence: 'annual' },
    ],
  },

  private_ltd: {
    label: 'Private Limited Company',
    documents: [
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (of each director + shareholder)` })),
      { key: 'moa', label: 'Memorandum of Association (MoA)', description: 'Defines the company\'s objects, capital, registered office state.', category: REG, mandatory: true },
      { key: 'aoa', label: 'Articles of Association (AoA)', description: 'Internal rules governing the company.', category: REG, mandatory: true },
      { key: 'coi', label: 'Certificate of Incorporation', description: 'Issued by ROC on registration.', category: REG, mandatory: true },
      { key: 'cin', label: 'Corporate Identity Number (CIN)', description: '21-digit alphanumeric assigned by MCA.', category: REG, mandatory: true },
      { key: 'pan_company', label: 'PAN of the company', description: 'Separate PAN issued in the company\'s name.', category: KYC, mandatory: true },
      { key: 'tan_company', label: 'TAN', description: 'Required for TDS deduction.', category: REG, mandatory: true },
      { key: 'din', label: 'DIN (each director)', description: 'Director Identification Number.', category: REG, mandatory: true },
      { key: 'dsc', label: 'DSC (each director)', description: 'Digital Signature Certificate for MCA filings.', category: REG, mandatory: true },
      { key: 'gst_certificate', label: 'GST registration certificate', description: 'If turnover crosses threshold.', category: REG, mandatory: false },
      { key: 'shop_act_license', label: 'Shop & Establishment Act license', description: 'State-specific.', category: REG, mandatory: false },
      { key: 'pf_registration', label: 'EPF / ESIC registration', description: 'Required once employee count crosses 20 / 10 respectively.', category: REG, mandatory: false },
      { key: 'board_resolutions', label: 'Board resolutions', description: 'Minutes of board meetings + signed resolutions.', category: COM, mandatory: true },
      { key: 'register_of_members', label: 'Register of members + share certificates', description: 'Statutory register under Companies Act.', category: COM, mandatory: true },
      { key: 'financial_statements', label: 'Audited financial statements', description: 'Balance sheet + P&L signed by auditor.', category: FIN, mandatory: true },
      { key: 'aoc4', label: 'AOC-4 (Financial Statement)', description: 'Filed within 30 days from AGM.', category: COM, mandatory: true },
      { key: 'mgt7', label: 'MGT-7 (Annual Return)', description: 'Filed within 60 days from AGM.', category: COM, mandatory: true },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'roc_filings_company', label: 'ROC filings (AOC-4, MGT-7)', description: 'Annual statutory filings.', cadence: 'annual' },
      { key: 'statutory_audit', label: 'Statutory audit', description: 'Mandatory annual audit under Companies Act.', cadence: 'annual' },
      { key: 'tax_audit', label: 'Tax audit (44AB)', description: 'If turnover > ₹1 cr.', cadence: 'annual' },
      { key: 'gst_filing', label: 'GST returns', description: 'GSTR-1, 3B, 9, 9C if applicable.', cadence: 'monthly' },
      { key: 'tds_returns', label: 'TDS returns', description: 'Quarterly 24Q/26Q + monthly TDS deposits.', cadence: 'quarterly' },
      { key: 'itr_filing', label: 'ITR-6 filing', description: 'Annual return for companies.', cadence: 'annual' },
      { key: 'dir3_kyc', label: 'DIR-3 KYC (each director)', description: 'Annual KYC by 30 Sep.', cadence: 'annual' },
      { key: 'msme_return', label: 'MSME-1 half-yearly return', description: 'Outstanding payments to MSME creditors.', cadence: 'half-yearly' },
      { key: 'board_meetings', label: 'Board meeting minutes drafting', description: 'Minimum 4 meetings per year.', cadence: 'quarterly' },
    ],
  },

  public_ltd: {
    label: 'Public Limited Company',
    documents: [
      // Same as private_ltd plus listing-specific items.
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (of each director + key shareholder)` })),
      { key: 'moa', label: 'Memorandum of Association (MoA)', description: 'Public-company MoA includes additional disclosures.', category: REG, mandatory: true },
      { key: 'aoa', label: 'Articles of Association (AoA)', description: 'Internal governance rules.', category: REG, mandatory: true },
      { key: 'coi', label: 'Certificate of Incorporation', description: 'Issued by ROC.', category: REG, mandatory: true },
      { key: 'commencement_certificate', label: 'Certificate of Commencement of Business', description: 'Public companies need this before starting business.', category: REG, mandatory: true },
      { key: 'cin', label: 'CIN', description: 'Corporate Identity Number.', category: REG, mandatory: true },
      { key: 'pan_company', label: 'PAN of the company', description: 'Company-level PAN.', category: KYC, mandatory: true },
      { key: 'tan_company', label: 'TAN', description: 'For TDS.', category: REG, mandatory: true },
      { key: 'listing_agreement', label: 'Listing agreement / SEBI registrations', description: 'If listed on stock exchange.', category: REG, mandatory: false },
      { key: 'din', label: 'DIN (each director)', description: 'Director Identification Number.', category: REG, mandatory: true },
      { key: 'dsc', label: 'DSC (each director)', description: 'For digital MCA + SEBI filings.', category: REG, mandatory: true },
      { key: 'sebi_filings', label: 'SEBI filings (if listed)', description: 'Quarterly + annual disclosures.', category: COM, mandatory: false },
      { key: 'agm_minutes', label: 'AGM minutes', description: 'Statutory annual general meeting minutes.', category: COM, mandatory: true },
      { key: 'financial_statements', label: 'Audited financial statements', description: 'Balance sheet + P&L + cash flow + auditor\'s report.', category: FIN, mandatory: true },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'roc_filings_company', label: 'ROC filings (AOC-4, MGT-7)', description: 'Annual statutory filings.', cadence: 'annual' },
      { key: 'statutory_audit', label: 'Statutory audit', description: 'Mandatory annual audit.', cadence: 'annual' },
      { key: 'sebi_compliance', label: 'SEBI compliance (if listed)', description: 'Quarterly disclosures, shareholding patterns, etc.', cadence: 'quarterly' },
      { key: 'tax_audit', label: 'Tax audit (44AB)', description: 'If turnover > ₹1 cr.', cadence: 'annual' },
      { key: 'gst_filing', label: 'GST returns', description: 'Monthly + annual.', cadence: 'monthly' },
      { key: 'tds_returns', label: 'TDS returns', description: 'Quarterly + monthly.', cadence: 'quarterly' },
      { key: 'itr_filing', label: 'ITR-6 filing', description: 'Annual return.', cadence: 'annual' },
      { key: 'cs_secretarial_audit', label: 'Secretarial audit (MR-3)', description: 'Required for listed + public companies above thresholds.', cadence: 'annual' },
    ],
  },

  huf: {
    label: 'Hindu Undivided Family (HUF)',
    documents: [
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (Karta + adult coparceners)` })),
      { key: 'huf_deed', label: 'HUF deed', description: 'Declaration / formation deed of the HUF.', category: REG, mandatory: true },
      { key: 'pan_huf', label: 'PAN of the HUF', description: 'Separate PAN in HUF name.', category: KYC, mandatory: true },
      { key: 'family_tree', label: 'Family tree certificate', description: 'Listing all coparceners + members.', category: REG, mandatory: false },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'itr_filing', label: 'ITR-2 / ITR-3 filing (HUF)', description: 'Annual return for HUF income.', cadence: 'annual' },
      { key: 'tax_planning_huf', label: 'HUF tax planning', description: 'Using HUF for income splitting + deductions.', cadence: 'annual' },
    ],
  },

  trust: {
    label: 'Charitable / Religious Trust',
    documents: [
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (each trustee)` })),
      { key: 'trust_deed', label: 'Trust deed', description: 'Registered deed setting out objects + trustees.', category: REG, mandatory: true },
      { key: 'pan_trust', label: 'PAN of the trust', description: 'Trust-level PAN.', category: KYC, mandatory: true },
      { key: '12a_certificate', label: '12A / 12AB registration certificate', description: 'Tax exemption registration under Income-tax Act.', category: REG, mandatory: false },
      { key: '80g_certificate', label: '80G certificate', description: 'Donor deduction eligibility.', category: REG, mandatory: false },
      { key: 'fcra_registration', label: 'FCRA registration', description: 'If accepting foreign contributions.', category: REG, mandatory: false },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'itr_filing', label: 'ITR-7 filing', description: 'Annual return for trusts / societies / 12A entities.', cadence: 'annual' },
      { key: '10b_audit', label: 'Form 10B audit', description: 'Trust audit + filing.', cadence: 'annual' },
      { key: 'fcra_returns', label: 'FCRA annual returns (FC-4)', description: 'If FCRA registered.', cadence: 'annual' },
      { key: 'renewal_12a_80g', label: '12A / 80G renewal', description: 'Renewals every 5 years.', cadence: 'ad-hoc' },
    ],
  },

  society: {
    label: 'Society',
    documents: [
      ...COMMON_KYC.map((d) => ({ ...d, description: `${d.description} (governing body members)` })),
      { key: 'society_registration', label: 'Society Registration Certificate', description: 'Under Societies Registration Act 1860 (or state act).', category: REG, mandatory: true },
      { key: 'mou_society', label: 'Memorandum + Rules', description: 'Memorandum of Association + Rules & Regulations.', category: REG, mandatory: true },
      { key: 'pan_society', label: 'PAN of the society', description: 'Society-level PAN.', category: KYC, mandatory: true },
      { key: '12a_certificate', label: '12A / 12AB registration', description: 'Tax exemption under Income-tax Act.', category: REG, mandatory: false },
      ...COMMON_FINANCIAL,
    ],
    services: [
      { key: 'itr_filing', label: 'ITR-7 filing', description: 'Annual return for societies.', cadence: 'annual' },
      { key: 'annual_general_body', label: 'Annual general body meeting minutes', description: 'Required under most state society acts.', cadence: 'annual' },
      { key: 'renewal_12a_80g', label: '12A / 80G renewal', description: '5-yearly renewal cycle.', cadence: 'ad-hoc' },
    ],
  },
};

function listEntities() {
  return Object.entries(ENTITIES).map(([key, def]) => ({
    key,
    label: def.label,
    documentCount: def.documents.length,
    serviceCount: def.services.length,
  }));
}

function getRequirements(entityType) {
  if (!entityType || !ENTITIES[entityType]) return null;
  const def = ENTITIES[entityType];
  return {
    entityType,
    label: def.label,
    documents: def.documents,
    services: def.services,
  };
}

module.exports = { listEntities, getRequirements };
