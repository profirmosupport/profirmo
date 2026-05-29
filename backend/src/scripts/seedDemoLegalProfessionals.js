// Seed 18 SYNTHETIC "property lawyer" professional profiles for demo /
// staging purposes. Idempotent — skips any row whose seed email already
// exists.
//
// IMPORTANT NOTES
// ---------------
// 1. These are NOT real lawyers. Names are common Indian patronyms in random
//    permutation. Enrolment numbers follow the State-code/serial/year shape
//    used on Bar Council rolls but are NOT taken from any actual roll. Do
//    not present these profiles as a real advocate directory in production.
//
// 2. Safety guards applied to every seeded row:
//      - email pattern  *.demo@profirmo.seed       (trivially deletable)
//      - acceptsOnlineBooking = false              (no Book CTA renders)
//      - verificationStatus  = 'unverified'        (no green badge intent)
//      - signupComplete      = false               (treated as draft)
//      - password            = ''                  (account is not loginable)
//
// 3. To wipe all demo seeds:
//      DELETE FROM professional_approvals WHERE userId IN
//        (SELECT id FROM users WHERE email LIKE '%.demo@profirmo.seed');
//      DELETE FROM professional_details   WHERE userId IN
//        (SELECT id FROM users WHERE email LIKE '%.demo@profirmo.seed');
//      DELETE FROM users WHERE email LIKE '%.demo@profirmo.seed';
//
// Usage (from backend/):  node src/scripts/seedDemoLegalProfessionals.js

require('dotenv').config();

const {
  User,
  ProfessionalDetail,
  ProfessionalApproval,
  Category,
  SubCategory,
  sequelize,
} = require('../models');

const CURRENT_YEAR = new Date().getFullYear();

// State code, full state name, headquarter cities.
const STATES = {
  MAH: { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur'] },
  D: { name: 'Delhi', cities: ['Delhi'] },
  KA: { name: 'Karnataka', cities: ['Bangalore'] },
  TN: { name: 'Tamil Nadu', cities: ['Chennai'] },
  TS: { name: 'Telangana', cities: ['Hyderabad'] },
  WB: { name: 'West Bengal', cities: ['Kolkata'] },
  UP: { name: 'Uttar Pradesh', cities: ['Lucknow', 'Noida'] },
  GJ: { name: 'Gujarat', cities: ['Ahmedabad'] },
  RJ: { name: 'Rajasthan', cities: ['Jaipur'] },
  HR: { name: 'Haryana', cities: ['Gurgaon'] },
  PB: { name: 'Punjab', cities: ['Chandigarh'] },
  MP: { name: 'Madhya Pradesh', cities: ['Bhopal'] },
};

// 18 profiles. yearsExperience is computed (CURRENT_YEAR - enrolmentYear).
// Names are synthetic; pick languages by region. `secondary` flags a profile
// that also lists Civil Lawyer in addition to Property Lawyer.
const PROFILES = [
  { first: 'Aarav',    last: 'Mehta',     stateCode: 'MAH', city: 'Mumbai',    enrolmentYear: 2009, serial: 4521, langs: ['English', 'Hindi', 'Marathi'], secondary: true },
  { first: 'Priya',    last: 'Sharma',    stateCode: 'D',   city: 'Delhi',     enrolmentYear: 2012, serial: 1234, langs: ['English', 'Hindi'],            secondary: true },
  { first: 'Rohan',    last: 'Iyer',      stateCode: 'KA',  city: 'Bangalore', enrolmentYear: 2007, serial: 2876, langs: ['English', 'Kannada', 'Hindi'], secondary: false },
  { first: 'Ananya',   last: 'Reddy',     stateCode: 'TS',  city: 'Hyderabad', enrolmentYear: 2014, serial: 3309, langs: ['English', 'Telugu', 'Hindi'],  secondary: false },
  { first: 'Vikram',   last: 'Bhattacharya', stateCode: 'WB', city: 'Kolkata', enrolmentYear: 2003, serial: 1820, langs: ['English', 'Bengali', 'Hindi'], secondary: true },
  { first: 'Nikhil',   last: 'Joshi',     stateCode: 'MAH', city: 'Pune',      enrolmentYear: 2016, serial: 5102, langs: ['English', 'Marathi', 'Hindi'], secondary: false },
  { first: 'Sneha',    last: 'Pillai',    stateCode: 'TN',  city: 'Chennai',   enrolmentYear: 2011, serial: 2245, langs: ['English', 'Tamil', 'Hindi'],   secondary: true },
  { first: 'Karan',    last: 'Malhotra',  stateCode: 'D',   city: 'Delhi',     enrolmentYear: 2005, serial: 998,  langs: ['English', 'Hindi', 'Punjabi'], secondary: false },
  { first: 'Pooja',    last: 'Agarwal',   stateCode: 'RJ',  city: 'Jaipur',    enrolmentYear: 2013, serial: 1670, langs: ['English', 'Hindi'],            secondary: true },
  { first: 'Saurabh',  last: 'Patel',     stateCode: 'GJ',  city: 'Ahmedabad', enrolmentYear: 2008, serial: 2412, langs: ['English', 'Gujarati', 'Hindi'], secondary: false },
  { first: 'Meera',    last: 'Nair',      stateCode: 'KA',  city: 'Bangalore', enrolmentYear: 2017, serial: 5980, langs: ['English', 'Malayalam', 'Hindi'], secondary: true },
  { first: 'Arjun',    last: 'Singh',     stateCode: 'UP',  city: 'Lucknow',   enrolmentYear: 2006, serial: 1145, langs: ['English', 'Hindi', 'Urdu'],     secondary: false },
  { first: 'Ritu',     last: 'Kapoor',    stateCode: 'HR',  city: 'Gurgaon',   enrolmentYear: 2015, serial: 768,  langs: ['English', 'Hindi', 'Punjabi'], secondary: true },
  { first: 'Devansh',  last: 'Trivedi',   stateCode: 'MAH', city: 'Mumbai',    enrolmentYear: 2010, serial: 3354, langs: ['English', 'Marathi', 'Gujarati', 'Hindi'], secondary: false },
  { first: 'Isha',     last: 'Chatterjee', stateCode: 'WB', city: 'Kolkata',   enrolmentYear: 2018, serial: 4076, langs: ['English', 'Bengali', 'Hindi'],  secondary: true },
  { first: 'Harsh',    last: 'Verma',     stateCode: 'MP',  city: 'Bhopal',    enrolmentYear: 2012, serial: 1289, langs: ['English', 'Hindi'],            secondary: false },
  { first: 'Tanvi',    last: 'Deshpande', stateCode: 'MAH', city: 'Pune',      enrolmentYear: 2019, serial: 6201, langs: ['English', 'Marathi', 'Hindi'], secondary: true },
  { first: 'Aditya',   last: 'Rao',       stateCode: 'KA',  city: 'Bangalore', enrolmentYear: 2004, serial: 612,  langs: ['English', 'Kannada', 'Tamil', 'Hindi'], secondary: false },
];

const COURT_BY_STATE = {
  MAH: ['Bombay High Court', 'District Court'],
  D: ['Delhi High Court', 'Supreme Court', 'District Court'],
  KA: ['Karnataka High Court', 'District Court'],
  TN: ['Madras High Court', 'District Court'],
  TS: ['Telangana High Court', 'District Court'],
  WB: ['Calcutta High Court', 'District Court'],
  UP: ['Allahabad High Court', 'District Court'],
  GJ: ['Gujarat High Court', 'District Court'],
  RJ: ['Rajasthan High Court', 'District Court'],
  HR: ['Punjab & Haryana High Court', 'District Court'],
  PB: ['Punjab & Haryana High Court', 'District Court'],
  MP: ['Madhya Pradesh High Court', 'District Court'],
};

// Avatar URL — initials over a brand-adjacent palette, seeded by name so the
// colour is stable on re-runs. Generated client-side at request time by
// ui-avatars.com so we ship no binary.
const PALETTE = ['0f766e', '7c3aed', 'd97706', 'e11d48', '2563eb', '059669', 'db2777', '7c2d12'];
const avatarUrl = (first, last) => {
  const seed = (first + last).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = PALETTE[seed % PALETTE.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(first + ' ' + last)}&background=${bg}&color=fff&size=256&bold=true`;
};

const fmtEnrolment = (stateCode, serial, year) =>
  `${stateCode}/${String(serial).padStart(4, '0')}/${year}`;

const consultationFeeFor = (years) => {
  // ₹/min, scaled by experience. Rough heuristic for demo realism.
  if (years >= 18) return 80;
  if (years >= 12) return 60;
  if (years >= 6) return 40;
  return 25;
};

const buildBio = (p, years) =>
  `${p.first} ${p.last} is a ${years}-year property law practitioner based in ${p.city}, ${STATES[p.stateCode].name}. ` +
  `Areas of practice include conveyancing, title due diligence, RERA disputes and lease/leave-and-licence drafting. ` +
  `Profile is unverified and not bookable until the advocate has claimed and confirmed their listing.`;

// --- Runner ----------------------------------------------------------------

async function run() {
  await sequelize.authenticate();
  console.log('[demoLegal] DB connected.');

  // Resolve taxonomy ids.
  const legalCat = await Category.findOne({ where: { slug: 'legal' } });
  if (!legalCat) throw new Error("Category 'legal' not found. Seed taxonomy first.");
  const propSub = await SubCategory.findOne({
    where: { categoryId: legalCat.id, name: 'Property Lawyer' },
  });
  const civilSub = await SubCategory.findOne({
    where: { categoryId: legalCat.id, name: 'Civil Lawyer' },
  });
  if (!propSub) throw new Error("SubCategory 'Property Lawyer' not found.");
  console.log('[demoLegal] taxonomy ok — Legal cat:', legalCat.id);

  let created = 0;
  let skipped = 0;

  for (const p of PROFILES) {
    const slugName = `${p.first}.${p.last}`.toLowerCase();
    const email = `${slugName}.demo@profirmo.seed`;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      console.log(`[demoLegal] exists, skipping: ${email}`);
      skipped += 1;
      continue;
    }

    const years = CURRENT_YEAR - p.enrolmentYear;
    const fullName = `${p.first} ${p.last}`;
    const enrolmentNo = fmtEnrolment(p.stateCode, p.serial, p.enrolmentYear);
    const subIds = p.secondary && civilSub ? [propSub.id, civilSub.id] : [propSub.id];

    // 1. User
    const user = await User.create({
      name: fullName,
      fullName,
      firstName: p.first,
      lastName: p.last,
      email,
      password: '', // not loginable
      role: 'professional',
      status: 'active',
      emailVerified: false,
      mobileVerified: false,
      accountVerified: false,
      city: p.city,
      profilePhoto: avatarUrl(p.first, p.last),
    });

    // 2. ProfessionalDetail
    const detail = await ProfessionalDetail.create({
      userId: user.id,
      professionalType: 'Lawyer',
      designation: 'Advocate — Property Law',
      organization: `Chambers of ${p.last}`,
      yearsOfExperience: years,
      bio: buildBio(p, years),
      about: buildBio(p, years),
      skills: ['Property Law', 'RERA', 'Conveyancing', 'Title Due Diligence', 'Lease Drafting'],
      expertise: p.secondary
        ? ['Property Law', 'Civil Law', 'Real Estate Disputes']
        : ['Property Law', 'Real Estate Disputes'],
      languages: p.langs,
      subCategoryIds: subIds,
      practiceCities: [p.city],
      certifications: [],
      education: [
        { degree: 'LL.B.', institution: 'National Law University', year: p.enrolmentYear - 1 },
      ],
      achievements: [],
      certificationsDocuments: [],
      // Safety: explicit "demo" verification posture
      verificationStatus: 'unverified',
      consultationFee: consultationFeeFor(years),
      availability: [],
      availableNow: false,
      acceptsOnlineBooking: false, // <-- hides Book CTA
      rating: 0,
      reviewsCount: 0,
      primaryCategoryId: legalCat.id,
      consultancyType: 'individual',
      courtsPracticing: COURT_BY_STATE[p.stateCode] || ['District Court'],
      chamberAddress: `${p.city}, ${STATES[p.stateCode].name}`,
      barRegistrationNumber: enrolmentNo,
      enrollmentNumber: enrolmentNo,
      completionPercent: 60,
      signupComplete: false,
    });

    // 3. Approval (APPROVED so the row surfaces on the public listing —
    //    bookability is gated by acceptsOnlineBooking=false instead).
    await ProfessionalApproval.create({
      userId: user.id,
      professionalDetailId: detail.id,
      professionalType: 'Legal Consultant',
      status: 'APPROVED',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: null,
      resubmissionCount: 0,
    });

    console.log(`[demoLegal] created: ${fullName.padEnd(28)} | ${p.city.padEnd(12)} | ${enrolmentNo} | ${years}y`);
    created += 1;
  }

  console.log(`\n[demoLegal] done. created=${created} skipped=${skipped} total=${PROFILES.length}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[demoLegal] failed:', err);
    process.exit(1);
  });
