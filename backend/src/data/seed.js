// Database seeder for the Profirmo backend.
//
// `seedDatabase()` populates an empty database with the demo dataset from
// ./mockData.js. It is idempotent: if any users already exist it skips
// seeding entirely. Records are inserted in foreign-key-safe order.

const mockData = require('./mockData');
const {
  User,
  Professional,
  Firm,
  Case,
  Booking,
  Consultation,
  Review,
  File,
} = require('../models');

/**
 * Seed the database with demo data when it is empty.
 * @returns {Promise<void>}
 */
async function seedDatabase() {
  const existing = await User.count();
  if (existing > 0) {
    console.log(`[Seed] Database already seeded (${existing} users) - skipping.`);
    return;
  }

  console.log('[Seed] Empty database detected - inserting demo data...');

  // Strip the `files` array off cases; cases store no files column anymore.
  const cases = mockData.cases.map(({ files, ...rest }) => rest);

  // Flatten case file attachments into standalone File rows.
  const files = [];
  mockData.cases.forEach((c) => {
    (c.files || []).forEach((f) => {
      files.push({
        id: f.id,
        caseId: c.id,
        name: f.name,
        size: String(f.size),
        type: f.type,
        uploadedAt: f.uploadedAt,
      });
    });
  });

  // Clients are users now. Convert the mock clients into user rows so a
  // fresh seed produces them with role='client'. Bookings / cases / reviews
  // already reference these ids on their clientId column.
  const clientUsers = (mockData.clients || []).map((c) => ({
    id: c.id,
    email:
      (c.email && c.email.toLowerCase()) ||
      `pf-client-${c.id}@profirmo.local`,
    password: '',
    role: 'client',
    name: c.name || '',
    fullName: c.name || '',
    mobileNumber: c.phone || null,
    city: c.city || '',
    userType: c.userType || 'individual',
    status: 'active',
    accountVerified: true,
    emailVerified: true,
    memberSince: new Date(),
  }));

  // FK-safe insert order: Firms -> Professionals -> Users -> Cases -> Files
  // -> Bookings -> Consultations -> Reviews.
  await Firm.bulkCreate(mockData.firms);
  await Professional.bulkCreate(mockData.professionals);
  await User.bulkCreate([...mockData.users, ...clientUsers]);
  await Case.bulkCreate(cases);
  await File.bulkCreate(files);
  await Booking.bulkCreate(mockData.bookings);
  await Consultation.bulkCreate(mockData.consultations);
  await Review.bulkCreate(mockData.reviews);

  console.log(
    '[Seed] Done. Inserted: ' +
      `${mockData.firms.length} firms, ` +
      `${mockData.professionals.length} professionals, ` +
      `${mockData.users.length + clientUsers.length} users ` +
      `(${clientUsers.length} clients), ` +
      `${cases.length} cases, ` +
      `${files.length} files, ` +
      `${mockData.bookings.length} bookings, ` +
      `${mockData.consultations.length} consultations, ` +
      `${mockData.reviews.length} reviews.`
  );
}

module.exports = { seedDatabase };
