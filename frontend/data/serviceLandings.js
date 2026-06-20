// Service-landing content (15 entries). Consumed by:
//   - app/services/page.js          (index grid)
//   - app/services/[slug]/page.js   (dynamic landing template)
//   - utils/constants.js NAV_LINKS  (Knowledge dropdown)
//
// Each entry must include slug, title, subtitle, problem, howWeHelp,
// documents, process, faq, ctaText, categoryHint. Optional fields:
// keywords (SEO), accent (visual tint),
// accessOnly (boolean — when true, the page renders compliance-safe
// "information & access to verified independent professionals" framing
// instead of advertising the service; required for advocate-tier
// categories per BCI Rule 36 / P.N. Vignesh (Madras HC, July 2024)).

import {
  Home,
  Receipt,
  FileText,
  Heart,
  Mail,
  AlertCircle,
  Rocket,
  Building2,
  ShieldCheck,
  ShoppingBag,
  Briefcase,
  ScrollText,
  FileSignature,
  Globe2,
  FileSearch,
} from 'lucide-react';

// Top 10 metros — used for the "City-wise help" internal-link block on every
// landing page. Links resolve to /professionals/city/<slug>.
export const TOP_CITIES = [
  { name: 'Mumbai', slug: 'mumbai' },
  { name: 'New Delhi', slug: 'new-delhi' },
  { name: 'Bangalore', slug: 'bangalore' },
  { name: 'Hyderabad', slug: 'hyderabad' },
  { name: 'Chennai', slug: 'chennai' },
  { name: 'Pune', slug: 'pune' },
  { name: 'Kolkata', slug: 'kolkata' },
  { name: 'Ahmedabad', slug: 'ahmedabad' },
  { name: 'Gurgaon', slug: 'gurgaon' },
  { name: 'Noida', slug: 'noida' },
];

export const SERVICE_LANDINGS = [
  // -------------------------------------------------------------------------
  // CATEGORY PILLAR PAGES (Phase B — strategy §4). Each has a `pillarSlug`
  // that pulls in the long-form authority content from data/pillarPages.js.
  // -------------------------------------------------------------------------
  {
    slug: 'gst-consultation',
    pillarSlug: 'gst-consultation',
    title: 'GST Consultation in India: The Complete 2026 Guide',
    subtitle:
      'Everything Indian businesses need to know about GST — registration, returns, audits, notices, refunds — explained plainly, with a checklist for each step.',
    icon: 'Receipt',
    accent: 'teal',
    keywords:
      'GST consultation India, GST registration, GST returns, GSTR-1, GSTR-3B, GSTR-9, GST notice, GST audit, GST refund, input tax credit',
    problem:
      "GST is the single largest indirect-tax system India has ever run, and seven years on it is still changing every Budget. Indian businesses face a moving target: rate changes, return formats, ITC matching rules, and notices that arrive months after the relevant period. Getting GST right is not optional — but staying current on every change is unrealistic without a system or a consultant.",
    howWeHelp: [
      'Educational coverage of GST registration thresholds and procedure.',
      'Plain-English explainer of the return calendar (GSTR-1, 3B, 9) and the QRMP scheme.',
      'A field guide to the most common notice sections — §61, §73, §74, §65, §67.',
      'Notes on Input Tax Credit eligibility under §16 post the 2024 amendments.',
      'Access to verified GST consultants via Pro Firmo for execution.',
    ],
    documents: [
      'GST registration certificate (if registered)',
      'Last 12 months of GSTR-1 and GSTR-3B',
      'Books of accounts — sales register, purchase register',
      'E-invoice / e-way bill data',
      'Any notice received from the GST officer',
      'PAN, Aadhaar of authorised signatory',
    ],
    process: [
      'Tell the AI assistant your GST situation in plain English.',
      'Get matched to a verified GST consultant for your industry.',
      'Strategy call — registration, filings, notices, or refund.',
      'Consultant handles end-to-end, with you in the loop on every filing.',
      'Optional annual retainer for ongoing compliance.',
    ],
    faq: [
      ['Do I need to register for GST?', 'Yes if your turnover crosses ₹40L (goods) or ₹20L (services) — thresholds halve in special-category states. Inter-state supply, e-commerce sale, or reverse-charge supply trigger registration regardless of turnover.'],
      ['How does the QRMP scheme work?', 'Quarterly Return Monthly Payment — for taxpayers with turnover ≤ ₹5 crore. Pay GST monthly via challan or fixed-sum, file GSTR-1 quarterly. Reduces filing burden for SMEs.'],
      ['Can I claim ITC if my supplier hasn\'t filed GSTR-1?', 'No — ITC matching to your GSTR-2B is required. If a supplier doesn\'t report your invoice, you cannot claim the credit until they do.'],
      ['What\'s the deadline to claim ITC?', '30 November of the next financial year, or the date of filing the annual return, whichever is earlier (§16(4)).'],
    ],
    ctaText: 'Get GST consultation help',
    categoryHint: 'tax-gst',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'income-tax-itr',
    pillarSlug: 'income-tax-itr',
    title: 'Income Tax & ITR Filing in India: The 2026 Complete Guide',
    subtitle:
      'From picking the right ITR form to handling a 143(1) intimation — everything a salaried earner, freelancer, business owner or NRI needs to know about Indian income tax.',
    icon: 'FileText',
    accent: 'indigo',
    keywords:
      'income tax India, ITR filing, ITR-1 ITR-2 ITR-3 ITR-4, AIS TIS Form 26AS, new tax regime, NRI tax return, 143(1), 148 notice',
    problem:
      'Indian income-tax compliance has compressed: AIS, TIS, faceless assessment, and a unified portal mean the system has more visibility into your finances than ever, and the consequences of getting filings wrong are faster. Most people get notices not for evasion but for mismatch — TDS that wasn\'t reconciled, interest income that wasn\'t reported, capital gains the broker missed in the AIS feed.',
    howWeHelp: [
      'Coverage of every ITR form and which one fits your income mix.',
      'Old vs new regime calculator logic explained.',
      'AIS / TIS / 26AS reconciliation walk-through.',
      'Plain-English notice guide: 143(1), 142(1), 143(2), 148, 245.',
      'Access to verified CAs via Pro Firmo for filing and notice response.',
    ],
    documents: [
      'PAN, Aadhaar, bank account number',
      'Form 16 (salaried) or audited books (business)',
      'Form 26AS, AIS, TIS for the assessment year',
      'Capital-gains statements from brokers',
      'Investment proofs for 80C / 80D / etc.',
      'Any prior tax notices or correspondence',
    ],
    process: [
      'Tell AI your income mix — salary, capital gains, rental, freelance, etc.',
      'Form picker + regime picker recommend the right path.',
      'Match to a CA — verified, with experience in your bracket.',
      'CA files the ITR; refund or demand resolved on the portal.',
      '12-month post-filing notice support included on most plans.',
    ],
    faq: [
      ['Old or new tax regime?', 'New regime wins below ~₹15L gross with low 80C/HRA. Old regime wins when deductions stack up (e.g., metro renter with ₹3L HRA + ₹1.5L 80C + ₹50K NPS + ₹50K 80D).'],
      ['Where do I look for income mismatch?', 'AIS first, then TIS, then 26AS. AIS is masterfile; TIS is the cleaned summary; 26AS is the TDS-only view that 143(1) reconciles against.'],
      ['What if I miss the ITR deadline?', 'File a belated return till 31 December of the AY with a late fee (₹5,000 above ₹5L income, ₹1,000 below). Updated return possible till 24 months later under ITR-U with additional tax.'],
      ['How long does a refund take?', 'Most refunds clear within 30-45 days of e-verification. Beyond 60 days, interest under §244A @ 6% p.a. accrues.'],
    ],
    ctaText: 'Get ITR help',
    categoryHint: 'tax-income',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'company-registration-and-roc',
    pillarSlug: 'company-registration-and-roc',
    title: 'Company Registration & ROC Compliance: The Founder\'s Guide',
    subtitle:
      'Pvt Ltd, LLP, OPC, Section 8 — incorporation done end-to-end, plus the annual ROC compliance calendar most founders only learn about after the first penalty.',
    icon: 'Building2',
    accent: 'teal',
    keywords:
      'company registration India, Pvt Ltd incorporation, LLP, OPC, SPICe+, ROC annual return MGT-7, AOC-4, DPT-3, DIR-3 KYC',
    problem:
      'SPICe+ has made incorporation simpler than ever — but ROC compliance after Day 1 catches almost every founder out. Annual filings, board meetings, director KYC, deposit returns, the disqualification trap. The first late-filing penalty usually arrives at month 18, by which point three forms are overdue and the bill is ₹20-30K.',
    howWeHelp: [
      'Structure-choice walk-through (Pvt Ltd vs LLP vs OPC vs Section 8).',
      'End-to-end SPICe+ checklist — DSC, DIN, name reservation, MOA/AOA.',
      'The full first-year compliance calendar with statutory deadlines.',
      'Penalty schedule under §403 so founders see the cost of missing.',
      'Access to verified CS / CA firms via Pro Firmo for incorporation + ongoing ROC retainers.',
    ],
    documents: [
      'PAN, Aadhaar, address proof of all directors',
      'Photographs of all directors',
      'Office address proof (latest utility bill within 2 months)',
      'NOC from property owner (if rented)',
      'Top 2 proposed company name choices',
      'Proposed objects of business',
    ],
    process: [
      'AI walks you through structure choice based on your plan.',
      'Match to a CS firm — flat fee, no surprises.',
      'Documents collected via a secure portal.',
      'SPICe+ Part A + Part B filed; name approval typically in 2-3 days.',
      'Certificate of Incorporation + PAN + TAN + bank account.',
      'Optional ROC retainer for the annual calendar.',
    ],
    faq: [
      ['Pvt Ltd or LLP for a startup?', 'Pvt Ltd if external funding is even a possibility. LLP works for bootstrapped service firms but investors won\'t fund it without conversion.'],
      ['What if I miss MGT-7 / AOC-4?', 'Late fees compound at ₹100/day per form, no upper cap. Three consecutive years\' default disqualifies all directors under §164(2).'],
      ['Do I need an auditor from day one?', 'Yes — first auditor appointment under §139 within 30 days of incorporation (Form ADT-1).'],
      ['Can a foreign / NRI director incorporate?', 'Yes — at least one director must be Indian-resident; the rest can be foreign nationals or NRIs.'],
    ],
    ctaText: 'Get incorporation help',
    categoryHint: 'corporate-incorporation',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'startup-compliance',
    pillarSlug: 'startup-compliance',
    title: 'Startup Compliance in India 2026: Founders, Funding, ESOPs, DPIIT',
    subtitle:
      'The legal and financial scaffolding a high-growth Indian startup needs from day one — founders agreement, ESOPs, DPIIT, FEMA reporting, angel-tax exemption.',
    icon: 'Rocket',
    accent: 'indigo',
    keywords:
      'startup compliance India, DPIIT recognition, 80-IAC, angel tax §56(2)(viib), FEMA FC-GPR, ESOP scheme, founders agreement, vesting',
    problem:
      "A startup's legal stack grows in layers. Year-one is incorporation + IP. The seed round adds an SHA, a vesting schedule, FC-GPR. Series A adds CCPS, a maintained cap table, ESOP top-ups. Most founders learn this in the middle of a fundraise — diligence surfaces every gap, and the deal slows down while you back-fill.",
    howWeHelp: [
      'A founders\' agreement template walk-through (vesting, ROFR, IP, IP assignment).',
      'DPIIT recognition + 80-IAC + angel-tax exemption explained.',
      'Term-sheet decoder — preference, liquidation, anti-dilution, ROFR.',
      'ESOP scheme drafting + grant-letter mechanics.',
      'FEMA FC-GPR + RBI FIRMS reporting timeline.',
      'Access to verified startup-specialist lawyers and CSs via Pro Firmo.',
    ],
    documents: [
      'Incorporation documents (CoI, MoA, AoA, PAN, TAN)',
      'Current cap table — fully diluted',
      'Founder + early-employee contracts with IP-assignment clauses',
      'Any term sheets or LOI received',
      'Customer + vendor contracts where IP changes hands',
      'Bank statements for the last 12 months',
    ],
    process: [
      'AI asks where you are — pre-incorp, post-seed, mid-fundraise, scaling.',
      'Match to a startup-specialist consultant.',
      'Strategy call covering structure, IP, equity, tax.',
      'Drafting and review starts; data room organised in parallel.',
      'Ongoing retainer for companies with regular deal flow.',
    ],
    faq: [
      ['What is DPIIT recognition and why does it matter?', 'Government recognition of "innovative" startups (<10 years old, <₹100Cr turnover). Unlocks 80-IAC tax exemption and angel-tax exemption under §56(2)(viib). Application is administrative; turnaround 2-5 days.'],
      ['How does the 80-IAC exemption work?', '100% income-tax deduction on profits for any 3 consecutive years out of the first 10. Requires Inter-Ministerial Board approval; turnaround 3-6 months.'],
      ['What\'s the deadline to file FC-GPR?', '30 days from receipt of foreign investment, on the RBI FIRMS portal. Routinely missed by founders; compounding penalties apply.'],
      ['What ESOP pool size is normal?', '8-12% post-seed; investors typically require top-up to 12-15% pre-Series A. Pool dilution comes from existing shareholders pro-rata unless specifically allocated.'],
    ],
    ctaText: 'Get startup compliance help',
    categoryHint: 'corporate-startup',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'property-dispute-consultation',
    title: 'Property Disputes in India: Your Options',
    subtitle:
      'Title disputes, partition, encroachment, builder issues — understand the legal landscape and connect with a verified independent professional via Pro Firmo.',
    icon: 'Home',
    accent: 'amber',
    accessOnly: true,
    keywords:
      'property dispute India, partition suit, title dispute, RERA complaint, builder delay options',
    problem:
      'Property disputes in India are messy because they sit at the intersection of revenue records, registered deeds, succession, possession, and family relationships. People come to us mid-fight — the will is contested, the builder hasn\'t handed over possession, a sibling has occupied the family plot, the society is sitting on the share certificate. The longer you wait, the more expensive (and slower) it gets.',
    howWeHelp: [
      'Educational overview of the procedural options available under Indian property law.',
      'A plain-English explainer on what makes a title clean and a claim enforceable.',
      'Decision guide: civil suit, RERA, consumer forum, or settlement — what each route involves.',
      'Document checklists for partition / settlement / family-arrangement deeds.',
      'Access to verified independent professionals via Pro Firmo, who can advise on your specific facts.',
    ],
    documents: [
      'Sale deed / gift deed / will / partition deed (whichever applies)',
      '7/12 extract, khatauni, mutation records, property tax receipts',
      'Encumbrance certificate (EC) and recent index II',
      'Builder agreement, allotment letter, possession letter (if builder-related)',
      'Photographs of the property and any encroachment',
      'Prior legal notices, court orders, or correspondence with the other side',
    ],
    process: [
      'Tell Pro Firmo AI what happened — it summarises your case in 2 minutes.',
      'You\'re matched with 3 property-dispute lawyers near you.',
      'Pick one and book a 30–45 minute consultation (in-person or online).',
      'You get a written case-strategy note within 48 hours.',
      'If you proceed, the lawyer files / replies / drafts as agreed.',
    ],
    faq: [
      ['How long does a property dispute take in India?', 'Civil suits typically run 3–7 years in trial courts; RERA disputes are usually faster (6–18 months). Mediation can resolve family disputes in 60–120 days.'],
      ['Can I file a criminal case for property fraud?', 'Yes — cheating (BNS), forgery, and criminal breach of trust are common where documents are forged or possession is taken by deceit. A property lawyer will tell you whether the facts fit.'],
      ['Is a registered will enough to claim ancestral property?', 'A registered will is strong but not absolute — ancestral property has different rules under Hindu succession law than self-acquired property. We\'ll walk you through which applies.'],
      ['Do I need to go to court?', 'Not always. A well-drafted family-arrangement or settlement deed can close most family property disputes without litigation.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'civil-property',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'gst-notice-consultation',
    title: 'GST Notice Consultation',
    subtitle:
      'Got a GST notice — SCN, DRC-01, ASMT-10, mismatch? A verified GST consultant will reply, file, and represent you before the officer.',
    icon: 'Receipt',
    accent: 'teal',
    keywords:
      'GST notice reply, SCN GST, DRC-01, ASMT-10, GST audit, GST consultant India',
    problem:
      'GST notices arrive without warning, often months after the period in question, and the language is opaque. Most businesses are caught between "this looks scary, just pay" and "the consultant said ignore it, it will go away" — both wrong. A reasoned reply within the timeline almost always saves you tax, interest, and penalty.',
    howWeHelp: [
      'Read the notice and identify the exact section (61 mismatch, 73 SCN, 74 fraud SCN, 65 audit, etc.).',
      'Map the alleged liability against your books and GSTR returns.',
      'Draft a reasoned, evidence-backed reply with the right form (DRC-06, ASMT-11, etc.).',
      'Represent you at personal-hearing stage before the proper officer.',
      'Appeal route if the order is adverse — first appeal under §107, GSTAT now functional.',
    ],
    documents: [
      'The notice itself (PDF from the GST portal)',
      'GSTR-1, GSTR-3B, GSTR-9 for the period in question',
      'Sales and purchase registers / books of account',
      'E-invoice / e-way-bill data',
      'Bank statements relevant to the disputed transactions',
      'Any prior correspondence with the GST officer',
    ],
    process: [
      'Upload the notice — AI extracts the section, period, and demand.',
      'Match to 3 GST practitioners with relevant industry experience.',
      'Consultation: case-strategy + timeline + likely outcome.',
      'Engage the consultant to draft and file the reply on your behalf.',
      'Personal-hearing representation if the officer fixes one.',
    ],
    faq: [
      ['How many days do I have to reply to a GST SCN?', 'A standard SCN under §73 / §74 gives you 30 days to reply. Don\'t miss it — silence is treated as acceptance.'],
      ['Can I reply to a GST notice myself?', 'For simple mismatches (Form 61), yes. For SCN / audit / fraud-allegation notices, get a professional — the wrong reply can lock in liability.'],
      ['What\'s the penalty if I lose?', 'Under §73, penalty is 10% of tax due or ₹10,000 (whichever is higher). Under §74 (fraud), it\'s 100%. Big reason to fight a §74 notice on facts.'],
      ['Can I appeal an adverse order?', 'Yes — first appeal under §107 to the Appellate Authority within 3 months, then GSTAT, then High Court on substantial questions of law.'],
    ],
    ctaText: 'Get help with my GST notice',
    categoryHint: 'tax-gst',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'income-tax-filing-help',
    title: 'Income Tax Filing Help',
    subtitle:
      'ITR for salary, capital gains, rental income, freelancers, NRIs — a CA files it correctly, claims every deduction, and stays around for any notice.',
    icon: 'FileText',
    accent: 'indigo',
    keywords:
      'ITR filing India, income tax return CA, ITR-1 ITR-2 ITR-3, tax deduction Section 80C, NRI tax return',
    problem:
      'The DIY ITR portal works fine if you\'re salaried with one Form 16 and no other income. The moment you have capital gains, rental income, foreign assets, business income, F&O, crypto, or a switch-of-regime question, you\'re one wrong field away from a notice. People come to us either before filing (to get it right) or after a notice (to fix it).',
    howWeHelp: [
      'Pick the right ITR form for your income mix.',
      'Maximise legitimate deductions: 80C / 80D / HRA / home-loan interest / 54EC / 54F etc.',
      'New regime vs old regime — a real calculation, not a rule of thumb.',
      'File ITR + verify within timeline; keep the e-acknowledgment.',
      'Handle any post-filing notice (intimation under 143(1), refund hold, scrutiny).',
    ],
    documents: [
      'PAN, Aadhaar, bank details',
      'Form 16 / Form 16A / Form 26AS / AIS / TIS',
      'Salary slips for HRA / LTA claims',
      'Capital-gains statements from brokers (equity, MF, F&O)',
      'Rental income agreement and rent receipts',
      'Home-loan interest certificate and 80C investment proofs',
      'Foreign-asset details if applicable (Schedule FA)',
    ],
    process: [
      'Tell AI your income mix — it suggests the right ITR form and rough tax.',
      'Match to a CA who files in your bracket (salaried / business / NRI).',
      'Upload the docs to a secure CA portal.',
      'CA files the ITR + sends you the acknowledgement.',
      'Post-filing notice support included for 12 months on most plans.',
    ],
    faq: [
      ['When is the ITR filing deadline?', 'For salaried / non-audit cases, 31 July of the assessment year. For audit cases, 31 October. Belated returns till 31 December with late fee.'],
      ['Should I pick old regime or new?', 'Depends on your 80C / HRA / home-loan claims. Generally, new regime is better below ~₹15L gross with low deductions; old regime wins when deductions stack up.'],
      ['Can I revise my ITR after filing?', 'Yes — revise as many times as you need before the end of the assessment year (or before assessment, whichever is earlier).'],
      ['What if I get a 143(1) intimation?', 'Read it carefully — most are adjustments (refund / extra demand). Respond on the portal; a CA can do it in 30 minutes.'],
    ],
    ctaText: 'Get help filing my ITR',
    categoryHint: 'tax-income',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'divorce-and-family-consultation',
    title: 'Divorce & Family Matters in India: Information & Options',
    subtitle:
      'Mutual consent or contested, custody, maintenance, domestic violence — learn the procedural landscape and connect with a verified independent professional via Pro Firmo.',
    icon: 'Heart',
    accent: 'rose',
    accessOnly: true,
    keywords:
      'mutual consent divorce India, contested divorce, alimony, child custody, BNS Section 85 86, domestic violence',
    problem:
      'Family-law cases are uniquely heavy — they\'re about money, children, dignity, and decades of history at once. People come to us at very different stages: thinking about leaving, mid-mediation, served with a §85 BNS complaint, denied custody, owed maintenance for years. The right first conversation saves months later.',
    howWeHelp: [
      'Educational overview of grounds for divorce, custody, and maintenance under Indian personal-law statutes.',
      'Plain-English process map for mutual-consent and contested divorce.',
      'Reference notes on Section 144 BNSS, HMA §24/25, DV Act §20, and BNS Sections 85/86.',
      'Document checklists for filings.',
      'Access to verified independent professionals via Pro Firmo, who can advise on your specific situation.',
    ],
    documents: [
      'Marriage certificate',
      'Income proofs (ITR, salary slips) of both spouses',
      'Property and asset documents in joint or single names',
      'Children\'s birth certificates and school records',
      'Any prior court orders or police complaints',
      'WhatsApp / email evidence of cruelty, threats, or financial misuse',
    ],
    process: [
      'AI screens your situation — type of relief, urgency, jurisdiction.',
      'You\'re matched to 3 family lawyers (women lawyers available on request).',
      'Confidential 30–45 minute consultation.',
      'Strategy memo in 48 hours, drafting begins on engagement.',
      'Court filings, mediation, and hearings — fully tracked.',
    ],
    faq: [
      ['How long does mutual-consent divorce take?', 'Minimum 6 months under §13B HMA (cooling-off period). Supreme Court can waive it in clear cases; some High Courts have been waiving it routinely after 18 months of separation.'],
      ['Will my wife / husband get half of everything?', 'Indian law has no automatic 50:50 split — alimony and asset division depend on income, conduct, length of marriage, and the SC\'s 8-factor framework (Kiran Jyot Maini, 2024).'],
      ['Can I get custody as a father?', 'Yes — the welfare of the child is the only test, not the parent\'s gender. Courts increasingly grant joint or shared custody where both parents are fit.'],
      ['Is anticipatory bail possible in a 498A / BNS 85 case?', 'Yes — and post the Arnesh Kumar guidelines, courts grant it in the first hearing for most non-violent allegations.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'family',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'legal-notice-drafting',
    title: 'Legal Notices in India: What They Are and Your Options',
    subtitle:
      'Money recovery, breach of contract, cheque bounce, harassment — learn what a legal notice does and connect with a verified independent professional via Pro Firmo to have one drafted.',
    icon: 'Mail',
    accent: 'amber',
    accessOnly: true,
    keywords:
      'legal notice India, cease and desist, recovery notice, demand notice, response to legal notice',
    problem:
      'A well-drafted legal notice does three things: it states the breach precisely, it cites the right law, and it gives a clear deadline. Most one-page "notices" people send themselves do none of those — and end up weakening their court case later. A lawyer-drafted notice signals you\'re serious, anchors your facts on record, and very often gets the other side to settle.',
    howWeHelp: [
      'Notice for money recovery (loan, salary, refund, service fee).',
      'Breach-of-contract notice (vendors, clients, employees).',
      'Cheque-bounce notice under §138 NI Act (mandatory before prosecution).',
      'Cease-and-desist for defamation, trademark misuse, harassment.',
      'Eviction notice to tenants under your state\'s rent law.',
      'Response to a notice you\'ve received.',
    ],
    documents: [
      'Your full name, address, contact details',
      'Recipient\'s full name and address (last known is fine)',
      'The contract / invoice / cheque / agreement at the centre of the dispute',
      'Bank statement showing the transaction',
      'Any prior emails, WhatsApp messages, or letters',
      'Calculation of the amount due (principal + interest, if any)',
    ],
    process: [
      'Tell AI what happened — it asks the right follow-up questions.',
      'Match to a litigation lawyer in your state.',
      'Notice drafted within 24–48 hours; you review and approve.',
      'Sent via registered post / speed post + email; tracking shared with you.',
      'If no response within the deadline, your lawyer files the suit / complaint.',
    ],
    faq: [
      ['Is a legal notice mandatory before filing a case?', 'For some matters yes — §138 cheque-bounce (15 days) and certain consumer / government suits. For others it\'s optional but strongly advisable.'],
      ['What is the standard notice period?', 'Most civil notices give 15 or 30 days. Cheque-bounce is fixed at 15 days from receipt of the notice.'],
      ['What happens if the other side ignores my notice?', 'You proceed with filing the suit / complaint. The notice plus its non-reply is evidence of bad faith.'],
      ['Can a legal notice be sent by email?', 'Yes — courts have accepted notices served by email + registered post. We send both to be safe.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'civil-notice',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'cheque-bounce-matter',
    title: 'Cheque Bounce Under Section 138 NI Act: How It Works',
    subtitle:
      'Whether you are the payee or the accused, the procedural timeline under Section 138 is tight. Learn the process and connect with a verified independent professional via Pro Firmo.',
    icon: 'AlertCircle',
    accent: 'rose',
    accessOnly: true,
    keywords:
      'Section 138 NI Act, dishonour of cheque, cheque bounce timeline, summary trial procedure India',
    problem:
      'A cheque bounce case is one of the most common criminal complaints in India and one of the most time-bound. The payee has to send a notice within 30 days of dishonour, the accused has 15 days to pay, and the complaint must be filed within a month after that. Miss any step and the case is gone. People mess this up because the timeline is unforgiving and Form-A registered post tracking has its own quirks.',
    howWeHelp: [
      'For payees — notice under §138 within 30 days, complaint within timeline, summary-trial strategy.',
      'For the accused — defence on the merits (no liability, time-barred, alteration, etc.), bail, settlement.',
      'Settlement negotiation — most §138 cases settle; we negotiate from a position of strength.',
      'Appeals if the trial court order is unfavourable.',
      'Recovery of decreed amount after conviction.',
    ],
    documents: [
      'The bounced cheque (original)',
      'Bank return memo / dishonour memo',
      'Original transaction / agreement under which the cheque was issued',
      'KYC of payee and accused (PAN, Aadhaar)',
      'Bank statement showing presentation and dishonour',
      'Any prior communication around the cheque',
    ],
    process: [
      'AI confirms eligibility (Form-A timeline still alive).',
      'Match to a banking / NI Act practitioner.',
      'Notice or defence drafted same day.',
      'Filed in the magistrate\'s court with jurisdiction (cause of action / bank).',
      'Trial managed end-to-end; settlement explored at every hearing.',
    ],
    faq: [
      ['What\'s the punishment under §138 NI Act?', 'Up to 2 years imprisonment OR fine up to twice the cheque amount, OR both.'],
      ['Can a §138 case be settled?', 'Yes — at any stage, with payment of the cheque amount plus interest and costs. The court records the settlement and discharges the accused.'],
      ['Is the cheque-bounce case civil or criminal?', 'It\'s a criminal complaint, but the remedy is largely monetary and trials are summary (faster than regular criminal cases).'],
      ['What if the cheque was post-dated?', 'Doesn\'t matter — post-dated cheques are valid; the cause of action starts from the date of dishonour.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'banking',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'startup-legal-consultation',
    title: 'Startup Legal Consultation',
    subtitle:
      'Incorporation, founders\' agreements, ESOPs, ROFR, term sheets — Indian-startup-specific legal advice from lawyers who\'ve done it before.',
    icon: 'Rocket',
    accent: 'indigo',
    keywords:
      'startup lawyer India, founders agreement, ESOP, SAFE note, term sheet review, DPIIT registration',
    problem:
      'The first year of a startup is mostly product and customers — and then suddenly it\'s also a term sheet, a vesting schedule, a co-founder fallout, or an angel-tax notice. The right legal scaffolding early is cheap; fixing it during diligence is not. We work with founders before, during, and after the first funding round.',
    howWeHelp: [
      'Pvt Ltd / LLP / OPC incorporation and post-incorporation compliance.',
      'Founders\' / shareholders\' agreement with vesting, ROFR, drag/tag, IP assignment.',
      'ESOP scheme drafting + Companies Act compliance.',
      'SAFE notes, CCPS / CCDs, term-sheet markup for seed/Series A.',
      'DPIIT recognition + startup tax exemptions (80-IAC, angel tax §56(2)(viib)).',
      'Privacy policy, terms, customer contracts — the production-readiness suite.',
    ],
    documents: [
      'Founders\' PAN, Aadhaar, address proof',
      'Existing incorporation documents (if any)',
      'Cap table — current + post-money',
      'Term sheet (for fundraising review)',
      'Customer / vendor contracts you want reviewed',
      'IP — code, content, design — and current ownership status',
    ],
    process: [
      'AI asks where you are — pre-incorp, post-seed, mid-fundraise, scaling.',
      'Match to a startup-specialist lawyer (3 options).',
      'Strategy call covering structure, IP, equity, and tax.',
      'Drafting / review begins; we manage the data-room with you.',
      'Ongoing retainer optional for companies with regular deal flow.',
    ],
    faq: [
      ['Pvt Ltd or LLP — which is better for a startup?', 'Pvt Ltd if you plan to raise external funding (investors prefer it). LLP if you\'re bootstrapping and want lower compliance.'],
      ['Do founders need a written agreement on day one?', 'Yes — vesting and ROFR clauses on day one prevent the most painful fights two years in.'],
      ['What\'s an angel tax notice?', 'Section 56(2)(viib) notices on share-premium issues. DPIIT recognition exempts most early-stage startups; we help you secure it.'],
      ['Can you help with a foreign-investor (FDI) round?', 'Yes — sectoral caps, AIF rules, FEMA reporting, and downstream investment.'],
    ],
    ctaText: 'Get a startup lawyer',
    categoryHint: 'corporate-startup',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'company-registration',
    title: 'Company Registration',
    subtitle:
      'Pvt Ltd, LLP, OPC, Section 8 — incorporation done end-to-end with PAN, TAN, GST and a bank account, in 7–14 days.',
    icon: 'Building2',
    accent: 'teal',
    keywords:
      'company registration India, Pvt Ltd incorporation, LLP registration, MCA SPICe+, DIN DSC',
    problem:
      'MCA\'s SPICe+ form integrates 10 different services and that\'s great in theory — but in practice, name approvals are rejected for vague reasons, DSCs get tangled with bank KYC, and SPICe+ Part B keeps the office address from your gas bill. People come to us either before they\'ve started (wanting it done right) or after a stuck application.',
    howWeHelp: [
      'Pvt Ltd, OPC, LLP, Section 8 (non-profit) — full incorporation.',
      'Name reservation strategy (avoiding "deceptively similar" rejections).',
      'Digital Signature Certificate (DSC) and Director Identification Number (DIN).',
      'PAN, TAN, GSTIN, Professional Tax, Shops & Establishment.',
      'Current-account opening at a partner bank.',
      'First-year compliance calendar handed over on completion.',
    ],
    documents: [
      'PAN, Aadhaar, address proof of all directors',
      'Photographs of all directors',
      'Office address proof (latest utility bill — gas, electricity, telephone)',
      'No Objection Certificate from the property owner (if rented)',
      'Email + phone for all directors',
      'Proposed company name (top 2 choices)',
    ],
    process: [
      'AI walks you through structure choice (Pvt Ltd / LLP / OPC).',
      'Match to a CS / CA — flat-fee, no surprises.',
      'Documents collected via a secure portal.',
      'SPICe+ filed; name approval typically in 2–3 days.',
      'Certificate of Incorporation + PAN + TAN issued; bank account opened.',
    ],
    faq: [
      ['How long does company registration take?', '7–14 working days end-to-end if documents are clean. Name-approval rejections add 2–3 days each.'],
      ['What\'s the minimum capital?', 'No minimum since the 2015 amendment. ₹1 lakh authorised capital is the common default for Pvt Ltd.'],
      ['Can a foreigner / NRI be a director?', 'Yes — at least one director must be Indian-resident, the rest can be foreign nationals or NRIs.'],
      ['Do I need an office address?', 'Yes — your registered office. A co-working space works if you have an NOC + utility bill.'],
    ],
    ctaText: 'Register my company',
    categoryHint: 'corporate-incorporation',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'trademark-consultation',
    title: 'Trademark Consultation',
    subtitle:
      'Search, registration, objections, oppositions, infringement — get your brand on the register and keep it there.',
    icon: 'ShieldCheck',
    accent: 'amber',
    keywords:
      'trademark registration India, TM application, trademark objection, examination report, infringement',
    problem:
      'A trademark is the cheapest piece of IP you can own — and the easiest one to lose if you delay. Common mistakes: filing in the wrong class, ignoring a similar mark you didn\'t search for, missing the examination-report deadline. We help startups, D2C brands, and SMEs get registered and stay defended.',
    howWeHelp: [
      'Pre-filing trademark search (Indian Register + international visibility).',
      'TM-A filing in the right class(es).',
      'Examination-report response within the 30-day window.',
      'Oppositions and rectifications.',
      'Cease-and-desist for infringement.',
      'TM renewal (every 10 years) and assignment.',
    ],
    documents: [
      'Proposed mark — wordmark, logo, or both',
      'Class(es) of goods/services you operate in',
      'Date of first use (if used in commerce already)',
      'Logo file in high-resolution',
      'Proof of use (invoices, marketing, packaging) if claiming prior use',
      'Power of Attorney (we prepare it)',
    ],
    process: [
      'AI runs an initial similarity check.',
      'IP attorney does a full search across classes + international gazettes.',
      'TM-A filed; application number issued within 24–48 hours.',
      'Examination report response handled within deadline.',
      'Once registered, you get the certificate and the watch service activates.',
    ],
    faq: [
      ['How much does trademark registration cost?', 'Government fee is ₹4,500 (small entity / individual) or ₹9,000 (others) per class per mark. Professional fee on top.'],
      ['How long does it take to register a trademark?', '12–18 months end-to-end in India if no objection or opposition. Faster if uncontested.'],
      ['Can I use ™ before registration?', 'Yes — ™ can be used from day one. ® is only after registration.'],
      ['What if my mark is opposed?', 'You file a counter-statement within 2 months. The matter goes to evidence + hearing. We handle this end-to-end.'],
    ],
    ctaText: 'Get my trademark registered',
    categoryHint: 'ip',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'consumer-complaint-consultation',
    title: 'Consumer Complaints Under the 2019 Act: Your Rights',
    subtitle:
      'Defective product, refund denied, e-commerce dispute, builder delay — learn the procedural options under the Consumer Protection Act, 2019 and connect with a verified independent professional via Pro Firmo.',
    icon: 'ShoppingBag',
    accent: 'teal',
    accessOnly: true,
    keywords:
      'Consumer Protection Act 2019, CCPA, district consumer commission, e-commerce refund India',
    problem:
      'The Consumer Protection Act, 2019 quietly changed the game — district commissions can hear claims up to ₹50 lakh, state commissions up to ₹2 crore, the National Commission above that. E-commerce defaults and product-liability are now squarely covered. Most complaints succeed if drafted properly; many fail because the complaint is filed in the wrong forum.',
    howWeHelp: [
      'Pre-filing review of your claim and the right forum (district / state / national).',
      'Drafting and filing the complaint with affidavits and annexures.',
      'Representation at the consumer commission hearings.',
      'Settlement / mediation where the opposite party is open.',
      'Recovery and execution after a favourable order.',
    ],
    documents: [
      'Invoice / receipt / order confirmation',
      'Product photographs / screenshots',
      'Correspondence with the seller / service provider',
      'Bank statement showing payment',
      'Warranty / guarantee documents',
      'Any independent technical / expert report',
    ],
    process: [
      'AI estimates the right forum based on your claim value.',
      'Match to a consumer-law lawyer in your district.',
      'Complaint drafted and filed within 7 days.',
      'Hearings tracked; appearance via video allowed in most forums.',
      'Once decided, we help execute the order.',
    ],
    faq: [
      ['What\'s the filing fee?', 'Nominal — ₹100 to ₹5,000 depending on claim value. No fee for claims up to ₹5 lakh in some states.'],
      ['How long does a consumer case take?', 'District forum: 3–9 months on average. State: 9–18 months. National: longer.'],
      ['Can I file against an e-commerce platform?', 'Yes — the 2019 Act and the E-Commerce Rules make platforms directly liable for product-listing defaults.'],
      ['What if I bought the product abroad?', 'Indian forums cover transactions where the cause of action arose in India or the seller is resident in India.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'consumer',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'employment-and-salary-dispute',
    title: 'Employment & Salary Disputes in India: Your Options',
    subtitle:
      'Unpaid salary, wrongful termination, gratuity, F&F not settled, non-compete enforcement — understand the statutory remedies and connect with a verified independent professional via Pro Firmo.',
    icon: 'Briefcase',
    accent: 'rose',
    accessOnly: true,
    keywords:
      'salary dispute India, wrongful termination remedies, Payment of Gratuity Act, full and final settlement, Indian Labour Codes',
    problem:
      'Salary disputes are one of the most common — and most fixable — legal problems in India. The Industrial Disputes Act, the Payment of Wages Act, the new Labour Codes, the Gratuity Act and state Shops & Establishments laws each open a different door. People come to us when their F&F is stuck, gratuity is denied, or they\'ve been "asked to resign". Many of these settle once a properly-worded notice goes out.',
    howWeHelp: [
      'Recovery of unpaid salary / variable pay / commission.',
      'Wrongful termination challenge — labour court / civil court / writ.',
      'Gratuity recovery (Payment of Gratuity Act).',
      'Full-and-final settlement disputes (notice + claim).',
      'Defence in non-compete / non-solicit enforcement.',
      'Sexual-harassment-at-workplace (POSH) complaints — both sides.',
    ],
    documents: [
      'Appointment letter / employment contract',
      'Salary slips for the last 12 months',
      'Form 16',
      'Email exchanges around termination / resignation / F&F',
      'Bank statements showing salary credits',
      'Any HR letters or warning memos',
    ],
    process: [
      'AI runs the eligibility check (workman / non-workman / supervisor).',
      'Match to a labour & employment lawyer.',
      'Notice / claim drafted within 48 hours.',
      'Forum chosen: Labour Commissioner / civil court / writ / High Court.',
      'Settlement explored — most cases resolve before final hearing.',
    ],
    faq: [
      ['How long do I have to claim unpaid salary?', '3 years from the date the salary became due (Payment of Wages Act / Limitation Act).'],
      ['Am I a workman under the new Labour Codes?', 'Depends on your role and pay grade. We do the analysis upfront — it changes which forum you go to.'],
      ['Is my non-compete enforceable?', 'Post-employment non-competes are largely void under §27 Indian Contract Act, except trade-secret protection. We can defend you in most enforcement attempts.'],
      ['How do I claim gratuity if HR refuses?', 'Form-I to the employer, then Form-N to the Controlling Authority under the Gratuity Act. Recovery is usually within 60–90 days.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'employment',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'rental-agreement-drafting',
    title: 'Rental Agreement Drafting',
    subtitle:
      'Residential, commercial, leave & licence, long-term lease — drafted to your state\'s rent-control law, e-stamped, and registered.',
    icon: 'ScrollText',
    accent: 'amber',
    keywords:
      'rental agreement India, leave and license, lease deed, e-stamp, registration of rent agreement',
    problem:
      'Most landlords and tenants in India still sign templated 11-month rent agreements that don\'t reflect either side\'s actual position — security deposit refund terms, maintenance, lock-in, exit, painting, fixtures, tenant-default remedies. When something goes wrong, the agreement is silent on the very point that matters. We draft state-specific, scenario-tested agreements.',
    howWeHelp: [
      'Residential leave & licence agreement (Maharashtra, Delhi, Karnataka, etc.).',
      'Commercial / office lease deed with stamp-duty optimisation.',
      'Long-term lease (10+ years) with registration.',
      'Co-living / paying-guest agreements.',
      'Renewal / extension / amendment deeds.',
      'Eviction notices and possession recovery.',
    ],
    documents: [
      'Owner\'s title deed / society NOC',
      'Owner and tenant ID + address proof',
      'Photos of the premises and inventory list (for furnished lets)',
      'Final rent + deposit terms',
      'Any prior agreement (for renewal)',
    ],
    process: [
      'Tell AI the kind of let (residential, commercial, etc.) and the state.',
      'Match to a property lawyer in your jurisdiction.',
      'Draft prepared within 24 hours; both sides review.',
      'E-stamping and registration arranged where applicable.',
      'Signed PDF + e-stamped original delivered.',
    ],
    faq: [
      ['Do I have to register an 11-month rent agreement?', 'No — registration is only mandatory for tenancies of 12 months or more (Registration Act §17). The 11-month default exists precisely to skip registration.'],
      ['Stamp duty — who pays?', 'Usually the tenant under most state laws, but it\'s negotiable. Maharashtra has a specific schedule for leave & licence.'],
      ['Can the landlord increase rent mid-term?', 'Only if the agreement provides for it (typical: 5–10% annual escalation). Otherwise no.'],
      ['What if the tenant doesn\'t vacate?', 'Send a notice, then file a possession suit / leave-and-licence eviction (Maharashtra). Newer state rent laws have faster Rent Tribunals.'],
    ],
    ctaText: 'Get my rental agreement',
    categoryHint: 'property-rent',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'business-contract-review',
    title: 'Business Contract Review',
    subtitle:
      'NDA, MSA, SaaS terms, vendor contracts, employment agreements — a lawyer reads it before you sign, flags risk, suggests redlines.',
    icon: 'FileSignature',
    accent: 'indigo',
    keywords:
      'contract review India, NDA review, MSA, SaaS agreement, vendor contract redlines',
    problem:
      'Most Indian SMEs sign contracts the other side drafted, often a poorly-cut-and-pasted template that\'s tilted heavily against the smaller party. The clauses you don\'t notice — indemnity, limitation of liability, governing law, dispute resolution, termination-for-convenience — are exactly the ones that bite during a dispute. A 1-hour review before signing saves an 18-month arbitration.',
    howWeHelp: [
      'NDA / mutual NDA review and markup.',
      'MSA / SaaS / Subscription agreements.',
      'Vendor + customer contracts for SMEs.',
      'Employment + consulting agreements.',
      'Distribution, franchise, agency, and reseller contracts.',
      'Shareholders / JV agreements.',
    ],
    documents: [
      'The contract you\'ve been asked to sign (Word / PDF)',
      'Any side letters, term sheets, or prior emails',
      'Your business model summary (helps the lawyer focus the review)',
      'The other party\'s name (for conflict-check)',
    ],
    process: [
      'Upload the contract — AI flags obvious red flags in 2 minutes.',
      'Match to a commercial-contracts lawyer.',
      '24–48 hour turnaround on a markup with risk-tier annotations.',
      'Negotiation memo if you want to push back.',
      'Final signed contract stored in your Pro Firmo dashboard.',
    ],
    faq: [
      ['How much does a contract review cost?', 'Typically ₹3,000 to ₹15,000 depending on length and complexity. Pricing is flat-fee, not hourly.'],
      ['Can you redline a contract sent in PDF?', 'Yes — we recreate the relevant Word version or use comments + a separate markup memo.'],
      ['What\'s an indemnity clause?', 'The other side\'s "I\'ll pay your losses if X happens" promise — and the most important clause in most B2B contracts. We pay particular attention to it.'],
      ['Should I use arbitration or courts?', 'Depends on counterparty, value, and speed. We advise per contract — not by rule of thumb.'],
    ],
    ctaText: 'Get my contract reviewed',
    categoryHint: 'corporate-contracts',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'nri-property-legal-help',
    title: 'NRI Property in India: FEMA, TDS, Repatriation & PoA',
    subtitle:
      'Buying, selling, gifting, inheriting Indian property as an NRI — learn the FEMA, TDS, repatriation, and Power-of-Attorney rules, and connect with a verified independent professional via Pro Firmo.',
    icon: 'Globe2',
    accent: 'teal',
    accessOnly: true,
    keywords:
      'NRI property India, FEMA real estate, NRI TDS Section 195, repatriation, Power of Attorney consulate attestation',
    problem:
      'NRI property transactions sit at the intersection of FEMA, Income Tax (TDS), the Registration Act, and family-property succession. Add a builder who\'s used to dealing with residents, and a sub-registrar who doesn\'t see many foreign passports, and a routine purchase becomes a 6-month detour. Done right with a proper PoA + a competent local lawyer, the same transaction is uneventful.',
    howWeHelp: [
      'Property purchase / sale by NRIs — title due diligence and sale-deed drafting.',
      'TDS at sale (20.6%/22.88%/Lower-TDS certificate route under §195 / §197).',
      'Repatriation of sale proceeds within FEMA limits.',
      'Power of Attorney drafting — Indian-consulate attestation + Indian-registrar acceptance.',
      'Succession certificates and partition for inherited property.',
      'Disputes — builder delay, encroachment, tenant overstay.',
    ],
    documents: [
      'NRI status proof (passport copy with valid visa / OCI)',
      'PAN and Indian bank account (NRO / NRE)',
      'Sale deed / title chain for the property',
      'Encumbrance certificate',
      'TDS certificate (Form 16B) if buying / selling',
      'PoA (if you can\'t be physically present)',
    ],
    process: [
      'AI screens the transaction type and tax position.',
      'Match to an NRI-property specialist (Delhi / Mumbai / Bangalore / Chennai are common bases).',
      'Title due diligence + tax structuring memo before you sign.',
      'PoA / sale-deed drafted and attested via Indian consulate.',
      'Registration, TDS deposit, and repatriation handled end-to-end.',
    ],
    faq: [
      ['What\'s the TDS rate when an NRI sells Indian property?', '20.6% (long-term capital gain) or up to 30%+ (short-term) on the sale value — unless you get a Lower-TDS certificate under §197 based on actual capital gain.'],
      ['Can an NRI buy agricultural land in India?', 'No — RBI/FEMA bar NRIs and PIOs from buying agricultural land, plantation property, or farmhouses. Inherited agricultural land is allowed.'],
      ['How much can I repatriate from a property sale?', 'USD 1 million per financial year out of NRO balances, after tax. NRE balance is fully repatriable.'],
      ['Does my PoA work in India?', 'Only if it\'s attested by the Indian consulate / embassy in your country of residence AND adjudicated/registered in the state where the property is.'],
    ],
    ctaText: 'Connect with a verified professional',
    categoryHint: 'nri-property',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'tax-notice-help',
    title: 'Tax Notice Help',
    subtitle:
      'Notice under §143(1), §142(1), §148, reassessment, faceless assessment, TDS demand — get a CA who reads notices for a living.',
    icon: 'FileSearch',
    accent: 'indigo',
    keywords:
      'income tax notice reply, 143(1), 148 reassessment, faceless assessment, TDS demand',
    problem:
      'A tax notice never arrives at a good time. The section numbers blur together — 143(1), 143(2), 142(1), 148, 245, 154 — but the consequences are very different. Some are routine intimations; others open up your past 7 years. Replying on the portal in the right form, within the deadline, with the right schedule of evidence is the difference between a refund and a demand.',
    howWeHelp: [
      'Intimation u/s 143(1) — adjustments and refund release.',
      'Scrutiny notice u/s 143(2) / 142(1) — drafting submissions, evidence, appearance.',
      'Reassessment notice u/s 148 — challenging jurisdiction and merits.',
      'Faceless-assessment representation including video hearings.',
      'TDS demand / mismatch resolution.',
      'Appeals — CIT(A), ITAT, High Court.',
    ],
    documents: [
      'The notice (download the PDF from the income-tax portal)',
      'ITR for the assessment year in question',
      'AIS / TIS / 26AS for that year',
      'Bank statements and supporting evidence for income / deductions claimed',
      'Investment proofs, capital-gains workings',
      'Any prior correspondence with the income-tax department',
    ],
    process: [
      'AI parses the notice — section, AY, deadline, demand.',
      'Match to a CA with tax-litigation experience.',
      'Reply prepared within deadline; submissions uploaded.',
      'Video hearing handled by your CA.',
      'If adverse, appeal filed within 30 days.',
    ],
    faq: [
      ['Is a 143(1) intimation a notice?', 'It\'s an order, technically. Mostly routine — adjustments / refund. If it shows extra demand, respond on the portal.'],
      ['How long do I have to reply to a 148 notice?', '30 days from receipt to file the return; then respond to the §143(2) follow-up within the deadline given. Don\'t miss it.'],
      ['Can I get an extension?', 'You can request adjournment in faceless assessment. Granted reasonably but not indefinitely.'],
      ['Is faceless better or worse for the taxpayer?', 'Generally better — uniform standards and a documented record. The downside is the lack of in-person rapport; pre-decision rights are limited.'],
    ],
    ctaText: 'Reply to my tax notice',
    categoryHint: 'tax-notice',
  },
];

export const ICONS = {
  Home, Receipt, FileText, Heart, Mail, AlertCircle, Rocket, Building2,
  ShieldCheck, ShoppingBag, Briefcase, ScrollText, FileSignature, Globe2,
  FileSearch,
};
