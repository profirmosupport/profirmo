const db = require('../data/mockData');
const { paginate } = require('./professionalService');

/**
 * List consultations with optional filters and pagination.
 * Supported filters: callStatus, clientId, professionalId, bookingId.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.consultations];

  if (filters.callStatus) {
    const q = String(filters.callStatus).toLowerCase();
    result = result.filter((c) => c.callStatus.toLowerCase() === q);
  }
  if (filters.clientId) {
    result = result.filter((c) => c.clientId === filters.clientId);
  }
  if (filters.professionalId) {
    result = result.filter((c) => c.professionalId === filters.professionalId);
  }
  if (filters.bookingId) {
    result = result.filter((c) => c.bookingId === filters.bookingId);
  }

  return paginate(result, page, limit);
};

/** Find a consultation by id or throw 404. */
const getById = (id) => {
  const consultation = db.consultations.find((c) => c.id === id);
  if (!consultation) {
    throw { statusCode: 404, message: `Consultation not found: ${id}` };
  }
  return consultation;
};

/** Start a consultation call. */
const start = (id) => {
  const consultation = getById(id);
  if (consultation.callStatus === 'ended') {
    throw { statusCode: 422, message: 'Consultation has already ended' };
  }
  consultation.callStatus = 'ongoing';
  consultation.startedAt = consultation.startedAt || new Date().toISOString();
  return consultation;
};

/**
 * End a consultation call. Computes durationMinutes from start/end times
 * and cost from the professional's per-minute rate.
 */
const end = (id) => {
  const consultation = getById(id);
  if (consultation.callStatus !== 'ongoing') {
    throw {
      statusCode: 422,
      message: 'Only an ongoing consultation can be ended',
    };
  }

  const endedAt = new Date();
  const startedAt = consultation.startedAt
    ? new Date(consultation.startedAt)
    : endedAt;

  const durationMinutes = Math.max(
    Math.round((endedAt.getTime() - startedAt.getTime()) / 60000),
    0
  );

  const professional = db.professionals.find(
    (p) => p.id === consultation.professionalId
  );
  const rate = professional ? professional.perMinuteRate : 0;

  consultation.callStatus = 'ended';
  consultation.endedAt = endedAt.toISOString();
  consultation.durationMinutes = durationMinutes;
  consultation.cost = durationMinutes * rate;

  // Mark the linked booking as completed if present.
  const booking = db.bookings.find((b) => b.id === consultation.bookingId);
  if (booking && booking.status !== 'cancelled') {
    booking.status = 'completed';
  }

  return consultation;
};

/** Placeholder: get the recording URL for a consultation. */
const getRecording = (id) => {
  const consultation = getById(id);
  return {
    consultationId: consultation.id,
    recordingUrl: consultation.recordingUrl,
    available: Boolean(consultation.recordingUrl),
  };
};

/** Placeholder: get the transcript for a consultation. */
const getTranscript = (id) => {
  const consultation = getById(id);
  return {
    consultationId: consultation.id,
    transcript: consultation.transcript,
    available: Boolean(consultation.transcript),
  };
};

/** Append/replace notes on a consultation. */
const addNotes = (id, notes) => {
  const consultation = getById(id);
  consultation.notes = notes || '';
  return consultation;
};

module.exports = {
  list,
  getById,
  start,
  end,
  getRecording,
  getTranscript,
  addNotes,
};
