const db = require('../data/mockData');
const { createBooking } = require('../models/Booking');
const { createConsultation } = require('../models/Consultation');
const { paginate } = require('./professionalService');

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

/**
 * List bookings with optional filters and pagination.
 * Supported filters: status, type, clientId, professionalId.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.bookings];

  if (filters.status) {
    const q = String(filters.status).toLowerCase();
    result = result.filter((b) => b.status.toLowerCase() === q);
  }
  if (filters.type) {
    const q = String(filters.type).toLowerCase();
    result = result.filter((b) => b.type.toLowerCase() === q);
  }
  if (filters.clientId) {
    result = result.filter((b) => b.clientId === filters.clientId);
  }
  if (filters.professionalId) {
    result = result.filter((b) => b.professionalId === filters.professionalId);
  }

  return paginate(result, page, limit);
};

/** Find a booking by id or throw 404. */
const getById = (id) => {
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) {
    throw { statusCode: 404, message: `Booking not found: ${id}` };
  }
  return booking;
};

/**
 * Create a booking. estimatedCost is derived from the professional's
 * per-minute rate and the requested duration. A matching scheduled
 * consultation record is also created.
 */
const create = (data = {}) => {
  const professional = db.professionals.find(
    (p) => p.id === data.professionalId
  );
  if (!professional) {
    throw {
      statusCode: 404,
      message: `Professional not found: ${data.professionalId}`,
    };
  }
  const client = db.clients.find((c) => c.id === data.clientId);
  if (!client) {
    throw { statusCode: 404, message: `Client not found: ${data.clientId}` };
  }

  const duration = Number(data.duration) || 0;
  const estimatedCost = duration * professional.perMinuteRate;

  const booking = createBooking({
    clientId: data.clientId,
    professionalId: data.professionalId,
    date: data.date,
    time: data.time,
    duration,
    type: data.type || 'scheduled',
    estimatedCost,
    status: data.status || 'pending',
  });
  db.bookings.push(booking);

  // Auto-create the consultation shell for this booking.
  const consultation = createConsultation({
    bookingId: booking.id,
    clientId: booking.clientId,
    professionalId: booking.professionalId,
    callStatus: 'scheduled',
  });
  db.consultations.push(consultation);

  return booking;
};

/** Update a booking's status. */
const updateStatus = (id, status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw {
      statusCode: 422,
      message: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
    };
  }
  const booking = getById(id);
  booking.status = status;
  return booking;
};

/** Get all bookings for a given client. */
const getByClient = (clientId) =>
  db.bookings.filter((b) => b.clientId === clientId);

/** Get all bookings for a given professional. */
const getByProfessional = (professionalId) =>
  db.bookings.filter((b) => b.professionalId === professionalId);

module.exports = {
  list,
  getById,
  create,
  updateStatus,
  getByClient,
  getByProfessional,
};
