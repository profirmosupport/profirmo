const db = require('../data/mockData');

// Strip the password before exposing a user record.
const sanitizeUser = (user) => {
  const { password, ...rest } = user;
  return rest;
};

/**
 * Aggregate platform-wide statistics for the admin dashboard.
 * `revenue` is a placeholder sum of completed-booking estimated costs
 * and ended-consultation costs.
 */
const getStats = () => {
  const completedBookings = db.bookings.filter(
    (b) => b.status === 'completed'
  );
  const endedConsultations = db.consultations.filter(
    (c) => c.callStatus === 'ended'
  );

  const bookingRevenue = completedBookings.reduce(
    (sum, b) => sum + (b.estimatedCost || 0),
    0
  );
  const consultationRevenue = endedConsultations.reduce(
    (sum, c) => sum + (c.cost || 0),
    0
  );

  return {
    totals: {
      users: db.users.length,
      professionals: db.professionals.length,
      firms: db.firms.length,
      clients: db.clients.length,
      cases: db.cases.length,
      bookings: db.bookings.length,
      consultations: db.consultations.length,
      reviews: db.reviews.length,
    },
    pendingProfessionals: db.professionals.filter(
      (p) => p.status === 'pending'
    ).length,
    revenue: {
      currency: 'INR',
      fromBookings: bookingRevenue,
      fromConsultations: consultationRevenue,
      total: bookingRevenue + consultationRevenue,
      note: 'Placeholder revenue figure derived from mock data.',
    },
  };
};

/** List all users (sanitized). */
const listUsers = () => db.users.map(sanitizeUser);

/** List professionals awaiting admin approval. */
const getPendingProfessionals = () =>
  db.professionals.filter((p) => p.status === 'pending');

/** Approve a pending professional. */
const approveProfessional = (id) => {
  const professional = db.professionals.find((p) => p.id === id);
  if (!professional) {
    throw { statusCode: 404, message: `Professional not found: ${id}` };
  }
  professional.status = 'approved';
  professional.verified = true;
  return professional;
};

/** List all firms. */
const listFirms = () => [...db.firms];

/** List all bookings. */
const listBookings = () => [...db.bookings];

module.exports = {
  getStats,
  listUsers,
  getPendingProfessionals,
  approveProfessional,
  listFirms,
  listBookings,
};
