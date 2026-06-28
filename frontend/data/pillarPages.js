// Category pillar pages — comprehensive 1,500-2,500 word authority hubs.
// Distinct from the /services/[slug] conversion landings: pillars are the
// head-term anchors that rank for "GST consultation", "ITR filing in India",
// "company registration India", and link DOWN to every related sub-topic +
// city × category page.
//
// Consumed by app/services/[slug]/page.js — when the slug matches a pillar,
// extra sections are rendered between the FAQ and the city block.

export const PILLAR_PAGES = {
  // -------------------------------------------------------------------------
  'gst-consultation': {
    slug: 'gst-consultation',
    title: 'GST Consultation in India: The Complete 2026 Guide',
    subtitle:
      'Everything Indian businesses need to know about GST — registration, returns, audits, notices, refunds — explained plainly, with a checklist for each step.',
    icon: 'Receipt',
    accent: 'teal',
    keywords:
      'GST consultation India, GST registration, GST returns, GSTR-1, GSTR-3B, GSTR-9, GST notice, GST audit, GST refund, input tax credit',
    intro:
      'GST is the single largest indirect-tax system India has ever run, and seven years on, it is still moving. The act is amended in every Union Budget, the Council reshapes rate structures and procedural rules through its meetings, and the proper officer at your jurisdictional office has more discretion than any taxpayer would like. This pillar covers everything a business owner, founder or finance lead needs to know about GST in India — from getting registered, to filing returns on time, to handling the inevitable mismatch notice, to claiming refunds. Read it once; bookmark the sections you keep coming back to.',
    sections: [
      {
        heading: 'Who needs to register for GST',
        body: [
          'GST registration in India is mandatory above turnover thresholds that vary by state and supply type. The Central thresholds are ₹40 lakh for goods (₹20 lakh in special-category states) and ₹20 lakh for services (₹10 lakh in special-category states). Inter-state supply, e-commerce sale through a platform like Amazon or Flipkart, and certain reverse-charge supplies trigger registration regardless of turnover.',
          'Beyond the turnover trigger, voluntary registration is an under-rated lever for startups: it unlocks input-tax credit on purchases and presents the business as GST-compliant from day one. The trade-off is the compliance burden — monthly or quarterly filings, e-invoicing if turnover crosses ₹5 crore, e-way bills on inter-state movement of goods.',
          'Specific compulsory-registration categories: casual taxable persons, non-resident taxable persons, persons required to deduct TDS under §51, agents of a supplier, input service distributors, and persons supplying online information and database access or retrieval services from outside India to a non-taxable online recipient in India.',
        ],
      },
      {
        heading: 'GST returns — the practical schedule',
        body: [
          'The two returns every regular taxpayer files are GSTR-1 (outward supplies) and GSTR-3B (summary return with payment). GSTR-1 due dates: 11th of the following month for monthly filers, 13th of the month following the quarter for QRMP scheme filers. GSTR-3B due dates: 20th of the following month (staggered to 22nd / 24th for QRMP states), regardless of scheme.',
          'Annual return GSTR-9 is due 31 December of the next financial year for taxpayers above ₹2 crore turnover. GSTR-9C reconciliation is required for those above ₹5 crore. Composition-scheme taxpayers file CMP-08 quarterly and GSTR-4 annually.',
          'Late-fee structure under §47: ₹50 per day (₹25 each CGST + SGST) for normal returns, capped at ₹10,000. Nil returns: ₹20 per day. Interest under §50 on tax not paid: 18% p.a. on the net cash liability. These add up fast — automating filings or engaging a consultant pays for itself in the first late month avoided.',
        ],
      },
      {
        heading: 'Input Tax Credit (ITC) — the make-or-break engine',
        body: [
          "Input Tax Credit is the heart of GST. You collect output tax from customers, pay input tax to suppliers, and remit only the difference to the government. The mechanic only works if your suppliers actually report your purchases on their GSTR-1 — because that data flows into your GSTR-2B, and only ITC matching your 2B is creditable post the §16 amendments.",
          'Conditions for ITC eligibility under §16: (a) you have a tax invoice or debit note, (b) you have received the goods or services, (c) your supplier has paid the tax to government and reported the invoice in their GSTR-1, (d) you have filed your return, (e) the supply is not in the blocked-credit list under §17(5) (motor vehicles, food and beverages, club memberships, personal-use goods, etc.).',
          "The Time of ITC is now §16(4) and §16(5) (the latter inserted by the 2024 Finance Act with retrospective effect for certain years) — you have until 30 November of the next financial year, or the date of filing the annual return, whichever is earlier. Lose the deadline, lose the credit.",
        ],
      },
      {
        heading: 'GST notices — the section-by-section field guide',
        body: [
          '§61 (scrutiny of returns) — mismatch between GSTR-3B and GSTR-1, or GSTR-3B and GSTR-2B. Respond in Form ASMT-11 with reconciliation, usually within 30 days. Often closeable without escalation.',
          '§73 (non-fraud SCN) — short-payment, non-payment, or wrongly availed ITC without intent to evade. 30-day reply window, penalty 10% of tax or ₹10,000 (higher).',
          '§74 (fraud SCN) — willful misstatement or suppression. 30-day reply window, penalty up to 100% of tax. The reply must rebut the fraud allegation factually; otherwise the matter quickly escalates to confirmed demand + appellate route.',
          '§65 / §66 / §67 (audit, special audit, search/seizure) — typically follow a high-risk-profile flag. Treat any notice in these sections as serious; engaging a GST practitioner from day one is sensible.',
          'Procedural appeal route post-2024: ASMT-10 → ASMT-11 → DRC-01 → DRC-06 → DRC-07 (order) → first appeal under §107 within 3 months → GSTAT (now functional, post the September 2023 amendments) → High Court on substantial questions of law.',
        ],
      },
      {
        heading: 'GST refunds — when you can claim and how',
        body: [
          'The common refund categories are: (a) excess balance in electronic cash ledger, (b) exports of goods or services (LUT/bond mechanism), (c) inverted duty structure (output rate lower than input rate, refund of unutilised ITC), (d) zero-rated supplies to SEZ.',
          'Procedure: Form RFD-01 filed online with annexures. The officer issues acknowledgement in RFD-02 within 15 days of filing. Provisional refund of 90% under RFD-04 is supposed to be issued within 7 days for exports — in practice closer to 30 days. Final order in RFD-06 within 60 days.',
          'Interest @ 6% p.a. on delayed refunds beyond 60 days. Refund claims must be filed within 2 years from the relevant date — miss it and the right is gone.',
        ],
      },
      {
        heading: 'Common GST traps in 2026',
        body: [
          'Reverse-charge on imports of services — easy to miss for SaaS and consulting purchases from foreign vendors. Pay GST on the import, then claim ITC. Net cash impact is nil, but a missed entry triggers §73 follow-up.',
          'E-commerce TCS (Tax Collected at Source) under §52 — Amazon / Flipkart / Swiggy etc. deduct TCS on net taxable supplies; the seller reconciles in GSTR-2X and claims TCS credit. Mismatches trigger notices that take a quarter to unwind.',
          "Pure agent treatment of reimbursements — a common error among consultants who pass through travel / out-of-pocket expenses. Document the pure-agent test (Rule 33) properly, or the reimbursement gets added back to value of supply with GST.",
          'Place-of-supply for services to overseas clients — easy to assume export and skip GST; the test is the recipient\'s usual place of business plus consideration in foreign currency through banking channels. Anything else and you owe IGST.',
        ],
      },
    ],
    related: [
      { label: 'Help with a specific GST notice', href: '/services/gst-notice-consultation' },
      { label: 'GST calculator (free tool)', href: '/tools/gst-calculator' },
      { label: 'GST consultants by city', href: '/professionals?category=tax&q=GST' },
    ],
  },

  // -------------------------------------------------------------------------
  'income-tax-itr': {
    slug: 'income-tax-itr',
    title: 'Income Tax & ITR Filing in India: The 2026 Complete Guide',
    subtitle:
      'From picking the right ITR form to handling a 143(1) intimation — everything a salaried earner, freelancer, business owner or NRI needs to know about Indian income tax.',
    icon: 'FileText',
    accent: 'indigo',
    keywords:
      'income tax India, ITR filing, ITR-1 ITR-2 ITR-3 ITR-4, AIS TIS Form 26AS, new tax regime old tax regime, Section 80C 80D, NRI tax return, 143(1), 148 notice',
    intro:
      'Indian income-tax compliance has compressed over the last five years. The AIS (Annual Information Statement), the TIS (Taxpayer Information Summary), the integrated e-filing portal and faceless assessment have made the system more data-driven and the consequences of getting it wrong faster. This pillar covers everything from picking the right ITR form to handling assessment notices, with the clauses and section numbers that actually matter in real practice.',
    sections: [
      {
        heading: 'Which ITR form is yours',
        body: [
          'ITR-1 (Sahaj) — resident individuals with total income up to ₹50 lakh from salary, one house property, other sources (excluding lottery and racehorses), and agricultural income up to ₹5,000. Most salaried earners with simple lives.',
          'ITR-2 — individuals and HUFs with no business income but with capital gains, income from more than one house property, or foreign assets. Salaried + investments + property goes here.',
          "ITR-3 — individuals and HUFs with business or professional income. Sole proprietors, doctors, consultants, F&O traders typically.",
          "ITR-4 (Sugam) — presumptive-income taxpayers under §44AD (business), §44ADA (profession) or §44AE (transport). Simpler — declare deemed profit (6%/8% for §44AD; 50% for §44ADA), file the form, done.",
          'ITR-5 / 6 / 7 — partnerships and LLPs, companies, trusts respectively. Specialist territory.',
        ],
      },
      {
        heading: 'Old vs new regime — the live decision',
        body: [
          "From AY 2024-25, the new regime is the default. To stay on the old regime, the taxpayer has to opt out — and once opted out, §115BAC(6) restricts switching back for business income taxpayers.",
          'New regime slab structure (FY 2024-25 onwards): up to ₹3L nil, ₹3-7L @ 5%, ₹7-10L @ 10%, ₹10-12L @ 15%, ₹12-15L @ 20%, above ₹15L @ 30%. Standard deduction ₹75,000 for salaried; rebate under §87A makes income up to ₹7L effectively tax-free.',
          'Old regime: up to ₹2.5L nil, ₹2.5-5L @ 5%, ₹5-10L @ 20%, above ₹10L @ 30%. Standard deduction ₹50,000. Rebate under §87A up to ₹5L.',
          'Rule of thumb: new regime wins when 80C + HRA + home-loan interest + 80D total below ~₹2.5L. Old regime still wins when those stack up substantially (e.g., metro renter with ₹3L HRA + ₹1.5L 80C + ₹50K NPS + ₹50K 80D). Run the calculator at https://incometax.gov.in/ both ways before filing.',
        ],
      },
      {
        heading: 'AIS, TIS, Form 26AS — what to actually look at',
        body: [
          'AIS (Annual Information Statement) is the masterfile — every transaction reported to the tax department against your PAN. Salary, interest from each bank, dividend by company, mutual-fund redemptions, share sales, large cash deposits, foreign remittances under LRS, EPF withdrawals — all of it.',
          'TIS (Taxpayer Information Summary) is the cleaned-up version of AIS by category — total interest from banks, total dividends, etc. Use TIS when filling out the return; verify against AIS line-by-line for anything unusual.',
          'Form 26AS now mostly mirrors AIS, but still useful for the TDS section. TDS reported by deductors flows to 26AS, and that\'s what the system reconciles against your claimed TDS in the ITR. Mismatches trigger 143(1) intimations.',
          'A 15-minute habit: every November, pull your AIS draft, click "submit feedback" on any erroneous entry, and resolve before March. Saves a December scramble.',
        ],
      },
      {
        heading: 'The most common notices and what they mean',
        body: [
          'Intimation u/s 143(1) — automated processing summary. Three outcomes: (a) accepted as filed (NIL demand, NIL refund), (b) refund processed and credited, (c) adjustments leading to demand. Most action is in (c) — usually a 26AS / TDS mismatch.',
          'Notice u/s 142(1) — call for return or specific documents. Reply on the e-portal within the deadline. Routine; not adversarial by itself.',
          'Notice u/s 143(2) — case selected for scrutiny. This is the start of regular assessment. Personal hearing is now via video; expect 3-6 months of submissions.',
          "Notice u/s 148 — reassessment. The officer has \"reason to believe income has escaped assessment.\" Post-2021 amendments, the timeline is up to 3 years (10 years for high-value escapement, ₹50L+). The notice now has to be preceded by a §148A enquiry — review whether the §148A order is sustainable.",
          'Notice u/s 245 — refund adjustment against an outstanding demand. Often a surprise; check the demand origin before letting the refund be adjusted.',
        ],
      },
      {
        heading: 'Deductions worth maximising (old regime only)',
        body: [
          '§80C (₹1.5L cap) — EPF + PPF + ELSS + life insurance premium + 5-year FD + home-loan principal + child tuition fees + Sukanya Samriddhi.',
          '§80CCD(1B) (₹50K additional cap) — NPS contribution by employee, over and above 80C.',
          "§80D — medical insurance: ₹25K for self/family + ₹50K for senior-citizen parents. Includes ₹5K preventive health check-up within the cap.",
          '§80E — interest on education loan. No upper cap; deductible for up to 8 years.',
          'HRA exemption — works only if you are salaried, paying rent, and your salary includes an HRA component. Compute as least of (actual HRA, rent paid minus 10% of basic, 40%/50% of basic).',
          'Home-loan interest u/s 24(b) — ₹2L cap for self-occupied; no cap for let-out property (with carry-forward of loss under §71B subject to ₹2L cap against other heads).',
        ],
      },
      {
        heading: 'Special situations: NRIs, freelancers, F&O traders',
        body: [
          'NRIs file the same ITR forms but use ITR-2 by default (no business income presumed). DTAA relief is claimed in Schedule TR. Foreign assets — disclose in Schedule FA. TDS on Indian property sale is 20%/22%/30% — apply for a Lower-TDS certificate under §197 to reduce.',
          'Freelancers — §44ADA presumptive scheme (deemed profit @ 50% of gross receipts up to ₹50L; ₹75L if cash receipts ≤ 5%). Simpler than maintaining full books. Above ₹50L (or ₹75L), full books + audit under §44AB.',
          'F&O traders — derivatives are non-speculative business income. Maintain books, audit under §44AB if turnover crosses ₹10 crore (with the digital-mode safe-harbour), claim all business expenses (brokerage, internet, even pro-rated rent if relevant), set off F&O losses against other business income.',
        ],
      },
    ],
    related: [
      { label: 'Help filing this year\'s ITR', href: '/services/income-tax-filing-help' },
      { label: 'Help responding to a tax notice', href: '/services/tax-notice-help' },
      { label: 'Free ITR deadline tracker', href: '/tools/gst-calculator' },
    ],
  },

  // -------------------------------------------------------------------------
  'company-registration-and-roc': {
    slug: 'company-registration-and-roc',
    title: 'Company Registration & ROC Compliance in India: The Founder\'s Guide',
    subtitle:
      'Pvt Ltd, LLP, OPC, Section 8 — incorporation done end-to-end, plus the annual ROC compliance calendar most founders only learn about after the first penalty.',
    icon: 'Building2',
    accent: 'teal',
    keywords:
      'company registration India, Pvt Ltd incorporation, LLP registration, OPC, Section 8 NGO, SPICe+, ROC compliance, annual return MGT-7, financial statements AOC-4',
    intro:
      'Incorporating a company in India is now mostly a 7-to-14-day procedural exercise — SPICe+ Part B integrates incorporation, PAN, TAN, GST, EPFO, ESIC, professional tax and bank-account opening into a single web form. The harder problem starts on Day 15: the annual compliance calendar that follows the incorporation, where most founders learn — usually around month 18, when the late-filing penalty arrives in the inbox — that ROC compliance is its own ongoing job. This pillar covers both: getting incorporated right, and staying compliant after.',
    sections: [
      {
        heading: 'Pvt Ltd vs LLP vs OPC vs Section 8 — picking the structure',
        body: [
          'Pvt Ltd (Private Limited Company) — the default for startups planning to raise external funding. Limited liability, share capital, board of directors, MOA + AOA. Higher compliance burden (annual filings, statutory meetings, audit irrespective of turnover) but every venture investor expects it.',
          "LLP (Limited Liability Partnership) — limited liability + partnership-style flexibility. Good for professional-services firms (CA, consulting). Lower compliance: annual return (Form 11) + Statement of Account & Solvency (Form 8); audit only if turnover crosses ₹40L or contribution ₹25L. Investors generally won't fund an LLP — you'd convert to Pvt Ltd at fundraise time.",
          "OPC (One Person Company) — sole-founder structure with limited liability. One director, one shareholder. Forced conversion to Pvt Ltd when turnover crosses ₹2 crore or paid-up capital crosses ₹50L. Useful for sole consultants who want a corporate vehicle but aren't ready for partners.",
          "Section 8 — not-for-profit. Charitable purpose only. Higher scrutiny, no profit distribution. Used by NGOs and CSR vehicles, not by commercial ventures.",
        ],
      },
      {
        heading: 'The SPICe+ incorporation flow, in plain English',
        body: [
          'Part A — name reservation. Apply with top 2 choices. Avoid "deceptively similar" rejections by searching MCA + trademark register first. Approval usually in 2-3 working days.',
          'Part B — the integrated form: incorporation + PAN + TAN + GST + EPFO + ESIC + professional tax (Maharashtra / Karnataka) + bank-account application + e-MOA + e-AOA.',
          "DSC (Digital Signature Certificate) for all directors — Class 3, two-year validity, ~₹1,500-2,500 per director.",
          "DIN (Director Identification Number) — issued at incorporation for first-time directors. For subsequent appointments use DIR-3.",
          'Registered office — utility bill in the property owner\'s name (latest, within 2 months) + NOC if rented. Coworking address with utility bill + NOC works.',
          'Bank account opening — flows from SPICe+; most partner banks finalise within 5-7 days of Certificate of Incorporation issuance.',
        ],
      },
      {
        heading: "The first-year compliance calendar (Pvt Ltd)",
        body: [
          'Within 30 days of incorporation: appointment of first auditor under §139 (Form ADT-1).',
          'Within 60 days of incorporation: receipt of subscription money from subscribers + filing of INC-20A (declaration of commencement of business). Penalty for default: company ₹50,000, officers ₹1,000 per day.',
          'Within 30 days of first board meeting: hold board meeting (must occur within 30 days of incorporation; minimum 4 board meetings per year, gap not exceeding 120 days between two consecutive meetings).',
          'Annual General Meeting (AGM): within 9 months from the end of the first financial year, then within 6 months of FY-end thereafter; gap between two AGMs not exceeding 15 months.',
          'AOC-4 (financial statements): within 30 days of AGM. AOC-4 XBRL is mandatory for certain classes.',
          'MGT-7 / MGT-7A (annual return): within 60 days of AGM. MGT-7A is the simplified form for small companies and OPCs.',
          'DPT-3 (return of deposits / loans): annually by 30 June for the preceding FY.',
          "Director KYC (DIR-3 KYC): annually by 30 September. Late filing fee: ₹5,000 per DIN.",
        ],
      },
      {
        heading: "ROC penalties — why founders end up paying lakhs",
        body: [
          "Late filing under §403 / general additive late fee: ₹100 per day per form, no upper cap (until 2018 amendment introduced caps for some forms).",
          'INC-20A (commencement of business) — ₹50,000 on the company; ₹1,000 per day per officer in default, max ₹1L per officer.',
          "MGT-7 / AOC-4 — late filing fees compound across the year. Missing both for one year typically costs ₹3,000-15,000 in filing fees alone.",
          "Strike-off — the registrar can strike off a company that hasn't filed annual returns for two consecutive financial years. Restoration through NCLT is expensive (₹50K+ professional fee + court costs) and slow (6-12 months).",
          "Disqualification of directors — three consecutive years of non-filing disqualifies directors under §164(2), preventing them from being a director of any company for five years. This bites hardest when the same person is on multiple boards.",
        ],
      },
      {
        heading: 'What changes when you raise funding',
        body: [
          'Conversion of share class — typically from equity to CCPS (Compulsorily Convertible Preference Shares). Requires special resolution, alteration of MOA/AOA, MGT-14 filing.',
          'PAS-3 (return of allotment) — within 15 days of allotment. Penalty: ₹1,000 per day, max ₹1L.',
          'FC-GPR (foreign-investment reporting under FEMA) — within 30 days of receipt of foreign investment, on the RBI FIRMS portal. Penalty: compounding under FEMA, typically ₹10K-1L per default.',
          'Updated cap table maintained as part of the secretarial record.',
          "ESOP scheme — Companies Act §62(1)(b) + SEBI (SBEBSE) regulations if listed. For unlisted, Companies (Share Capital and Debentures) Rules. Get the scheme drafted; track grants, vesting, exercises.",
        ],
      },
    ],
    related: [
      { label: 'Quick company-registration help', href: '/services/company-registration' },
      { label: 'Startup compliance pillar', href: '/services/startup-compliance' },
      { label: 'Free GST calculator', href: '/tools/gst-calculator' },
    ],
  },

  // -------------------------------------------------------------------------
  'startup-compliance': {
    slug: 'startup-compliance',
    title: 'Startup Compliance in India 2026: Founders, Funding, ESOPs, DPIIT',
    subtitle:
      'The legal and financial scaffolding a high-growth Indian startup needs from day one — founders agreement, ESOPs, DPIIT, FEMA reporting, the angel-tax exemption.',
    icon: 'Rocket',
    accent: 'indigo',
    keywords:
      'startup compliance India, DPIIT recognition, 80-IAC tax exemption, angel tax Section 56, FEMA FC-GPR, ESOP scheme, founders agreement, vesting',
    intro:
      'A startup\'s legal stack does not stay still. The first year is all incorporation and IP assignment; the seed round adds a SHA, a vesting schedule, and FEMA reporting; Series A adds preference shares, a cap table you actually maintain, and CCPS. DPIIT recognition and angel-tax exemption sit underneath all of it. This pillar walks through the scaffolding stage by stage, with the section numbers and forms you\'ll see in real diligence.',
    sections: [
      {
        heading: 'Day-one paperwork — incorporation and founders\' agreement',
        body: [
          'Incorporate as Pvt Ltd if external funding is even a possibility within 18 months — investors will not fund LLPs without a conversion clause; the cost of conversion at fundraise time is non-trivial in time and tax.',
          "Founders' / shareholders' agreement (SHA) — drafted before the team starts disagreeing, signed in week one. Core clauses: vesting (typically 4-year with 1-year cliff), reverse vesting on existing founder equity, IP assignment to the company, ROFR + ROFO on share transfers, drag-along, tag-along, board composition, reserved matters.",
          'IP assignment — every founder and consultant signs over all pre-incorporation IP via a written assignment agreement, plus a present-tense "IP created during engagement" clause going forward. Without it, your codebase belongs to whoever wrote it personally.',
          'Banking and books — open the bank account before raising any money. Move to a proper accounting system (Zoho Books, Tally, or hire a virtual CFO from day one) — angel investors will ask for monthly MIS at the seed pitch.',
        ],
      },
      {
        heading: 'DPIIT recognition + 80-IAC + angel-tax exemption',
        body: [
          "DPIIT recognition — application on the Startup India portal. Requirements: registered in India for less than 10 years, turnover under ₹100 crore in any of the last financial years, working towards innovation/improvement. Approval is administrative — usually 2-5 working days.",
          '80-IAC tax exemption — for DPIIT-recognised startups incorporated between 1 April 2016 and 31 March 2025 (extended budgets keep moving this). 100% tax deduction on profits for any 3 consecutive years out of the first 10. Requires Inter-Ministerial Board approval; turnaround 3-6 months.',
          "Angel tax exemption (§56(2)(viib)) — DPIIT-recognised startups are exempt from the share-premium tax on issuance to residents. Post the September 2023 amendments extending §56(2)(viib) to non-residents, this exemption became critical even for foreign-investor rounds.",
          "Self-certification under labour laws and environmental laws — for DPIIT startups for up to 5 years. Reduces inspector risk for early-stage companies.",
        ],
      },
      {
        heading: "Fundraising paperwork — what hits the data room",
        body: [
          "Term Sheet — non-binding (mostly) outline of the round. Investor's side typically drafts; the founders push back on valuation, preference, liquidation, anti-dilution, board, ROFR, and vesting on founder equity.",
          'SHA (Shareholders Agreement) + Share Subscription Agreement (SSA) — the binding deal documents. SHA governs the relationship going forward; SSA governs the act of share issuance and the price.',
          "Amended AOA — to give effect to investor protective rights, reserved matters, and class of shares (CCPS / CCD).",
          'PAS-3 within 15 days of allotment; FC-GPR within 30 days of receipt of foreign investment via the RBI FIRMS portal. Both are statutory and routinely missed by founders — and routinely flagged in diligence.',
          'Cap table maintenance — fully diluted, broken by class, with vesting schedules. The single most-asked-for diligence artifact after the founders\' KYC.',
        ],
      },
      {
        heading: "ESOPs without the usual mistakes",
        body: [
          "ESOP scheme drafted and adopted by special resolution under §62(1)(b) — covers eligibility, vesting, exercise period, exit/liquidity clauses. Required even before the first grant.",
          "Grant letters — individual documents per employee, specifying number of options, exercise price, vesting commencement date, vesting schedule (typically 4-year monthly post 1-year cliff), exercise period after exit.",
          "Pool size — typically 8-12% post-seed; investors usually require top-up to 12-15% pre-Series A. Pool dilution comes from existing shareholders pro-rata unless specifically allocated.",
          "Tax for employees — taxed at exercise (perquisite under §17(2)(vi)) on FMV minus exercise price, then again at sale on capital gain. DPIIT-recognised startups get a 5-year deferral on the exercise-time tax under §192(1C) — a real cash-flow lever.",
          'Buyback during exit — typically capped at a percentage of the company\'s buyback capacity; structure as either capital reduction (slow, court-approved) or buyback under §68 (faster).',
        ],
      },
      {
        heading: 'The diligence-ready stack',
        body: [
          'Constitutional: MOA, AOA (latest), Certificate of Incorporation, PAN, GST, professional-tax registration.',
          'Cap table + share certificates + PAS-3 filings for every allotment.',
          'Founder / consultant / employee contracts with IP assignment and NDA.',
          'ESOP scheme + grant letters + register of options.',
          'Statutory registers (members, directors, charges, contracts).',
          'Audited financials for every year since incorporation (or unaudited where audit is not yet due).',
          'GST returns + ITRs for the last 3 years.',
          'Key customer + vendor contracts.',
          'DPIIT recognition, 80-IAC and §56(2)(viib) certificates (where obtained).',
        ],
      },
    ],
    related: [
      { label: 'Quick startup-legal help', href: '/services/startup-legal-consultation' },
      { label: 'Company registration pillar', href: '/services/company-registration-and-roc' },
      { label: 'For-professionals supply hub', href: '/for-professionals' },
    ],
  },
};

export const PILLAR_SLUGS = Object.keys(PILLAR_PAGES);
