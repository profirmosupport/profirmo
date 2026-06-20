// Service-landing content (15 entries). Consumed by:
//   - app/services/page.js          (index grid)
//   - app/services/[slug]/page.js   (dynamic landing template)
//   - utils/constants.js NAV_LINKS  (Knowledge dropdown)
//
// Each entry must include slug, title, subtitle, problem, howWeHelp,
// documents, process, faq, ctaText, categoryHint. Optional fields:
// keywords (SEO), accent (visual tint).

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
  {
    slug: 'property-dispute-consultation',
    title: 'Property Dispute Consultation',
    subtitle:
      'Title disputes, partition, encroachment, builder issues — get a verified property lawyer to read the papers and tell you where you stand.',
    icon: 'Home',
    accent: 'amber',
    keywords:
      'property dispute lawyer, partition suit, title dispute India, real estate litigation, RERA complaint',
    problem:
      'Property disputes in India are messy because they sit at the intersection of revenue records, registered deeds, succession, possession, and family relationships. People come to us mid-fight — the will is contested, the builder hasn\'t handed over possession, a sibling has occupied the family plot, the society is sitting on the share certificate. The longer you wait, the more expensive (and slower) it gets.',
    howWeHelp: [
      'Document review by a verified civil/property lawyer in your jurisdiction.',
      'A plain-English read on whether you have a clean title and an enforceable claim.',
      'Strategy: civil suit, criminal complaint (cheating, trespass), RERA, consumer forum, or settlement.',
      'Drafting partition / settlement / family-arrangement deeds where parties want a clean exit.',
      'Liaison with sub-registrar, society, builder, and bank where loans are involved.',
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
    ctaText: 'Discuss my property dispute',
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
    title: 'Divorce & Family Consultation',
    subtitle:
      'Mutual consent or contested, custody, maintenance, domestic violence — a family lawyer walks you through your real options.',
    icon: 'Heart',
    accent: 'rose',
    keywords:
      'divorce lawyer India, mutual consent divorce, contested divorce, alimony, child custody, domestic violence',
    problem:
      'Family-law cases are uniquely heavy — they\'re about money, children, dignity, and decades of history at once. People come to us at very different stages: thinking about leaving, mid-mediation, served with a §85 BNS complaint, denied custody, owed maintenance for years. The right first conversation saves months later.',
    howWeHelp: [
      'Honest first read: do you have grounds, what kind of divorce makes sense, what to expect financially.',
      'Mutual-consent divorce drafting + filing (the fastest, cheapest exit when both sides are aligned).',
      'Contested-divorce strategy and pleadings in your jurisdiction.',
      'Maintenance applications (BNSS §144, HMA §24/25, DV Act §20).',
      'Child custody — interim and permanent — and visitation arrangements.',
      'Defence in 85/86 BNS (the new 498A) cases.',
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
    ctaText: 'Talk to a family lawyer',
    categoryHint: 'family',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'legal-notice-drafting',
    title: 'Legal Notice Drafting',
    subtitle:
      'Money recovery, breach of contract, cheque bounce, harassment — a properly drafted legal notice often closes the matter without going to court.',
    icon: 'Mail',
    accent: 'amber',
    keywords:
      'legal notice drafting, cease and desist, recovery notice, demand notice, advocate notice India',
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
    ctaText: 'Get a legal notice drafted',
    categoryHint: 'civil-notice',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'cheque-bounce-matter',
    title: 'Cheque Bounce Matter',
    subtitle:
      'Section 138 NI Act case — whether you\'re the payee or the accused, the timeline is tight. Get a lawyer on day one.',
    icon: 'AlertCircle',
    accent: 'rose',
    keywords:
      'cheque bounce case, Section 138 NI Act, dishonour of cheque, summary trial, NI Act amendment',
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
    ctaText: 'Discuss my cheque bounce case',
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
    title: 'Consumer Complaint Consultation',
    subtitle:
      'Defective product, refund denied, e-commerce dispute, builder delay — the Consumer Protection Act, 2019 gives you fast remedies. Use them.',
    icon: 'ShoppingBag',
    accent: 'teal',
    keywords:
      'consumer complaint India, Consumer Protection Act 2019, CCPA, district consumer forum, e-commerce refund',
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
    ctaText: 'File my consumer complaint',
    categoryHint: 'consumer',
  },
  // -------------------------------------------------------------------------
  {
    slug: 'employment-and-salary-dispute',
    title: 'Employment & Salary Dispute',
    subtitle:
      'Unpaid salary, wrongful termination, gratuity, F&F not settled, non-compete enforcement — labour lawyers who fight for both sides.',
    icon: 'Briefcase',
    accent: 'rose',
    keywords:
      'salary dispute India, wrongful termination, full and final settlement, gratuity, non-compete',
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
    ctaText: 'Talk to a labour lawyer',
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
    title: 'NRI Property Legal Help',
    subtitle:
      'Buying, selling, gifting, inheriting Indian property as an NRI — FEMA, TDS, repatriation, PoA, and the documentation that holds up at the registrar.',
    icon: 'Globe2',
    accent: 'teal',
    keywords:
      'NRI property India, FEMA real estate, NRI TDS sale, repatriation, Power of Attorney NRI',
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
    ctaText: 'Get NRI property help',
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
