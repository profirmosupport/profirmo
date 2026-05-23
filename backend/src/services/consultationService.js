const {
  Consultation,
  Professional,
  ProfessionalDetail,
  Booking,
  User,
} = require('../models');
const { paginate } = require('./professionalService');

const displayName = (u) => {
  if (!u) return '';
  return (
    u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.name ||
    ''
  );
};

// Resolve a public professional id (legacy prof-N OR new pdetail-...) into
// a flat shape the consultation room needs.
const resolveProfessionalView = async (publicProfId) => {
  if (!publicProfId) return null;
  const legacy = await Professional.findByPk(publicProfId, { raw: true });
  if (legacy) {
    return {
      id: legacy.id,
      name: legacy.name || '',
      professionType: legacy.professionType || legacy.professionalType || '',
      specialization: legacy.specialization || '',
      city: legacy.city || '',
      profilePhoto: legacy.profilePhoto || null,
      perMinuteRate: Number(legacy.perMinuteRate) || 0,
    };
  }
  const detail = await ProfessionalDetail.findByPk(publicProfId, { raw: true });
  if (!detail) return null;
  const owner = detail.userId
    ? await User.findByPk(detail.userId, { raw: true })
    : null;
  return {
    id: detail.id,
    name: displayName(owner),
    professionType: detail.professionalType || '',
    specialization: detail.specialization || '',
    city: (owner && owner.city) || '',
    profilePhoto: (owner && owner.profilePhoto) || null,
    perMinuteRate: Number(detail.consultationFee) || 0,
  };
};

// Resolve a clientId (users.id with role='client') into a flat shape.
const resolveClientView = async (clientId) => {
  if (!clientId) return null;
  const user = await User.findByPk(clientId, { raw: true });
  if (!user) return null;
  return {
    id: user.id,
    name: displayName(user),
    email: user.email || '',
    phone: user.mobileNumber || '',
    city: user.city || '',
  };
};

// Attach client + professional payloads to a consultation record.
const decorate = async (consultation) => {
  if (!consultation) return null;
  const [client, professional] = await Promise.all([
    resolveClientView(consultation.clientId),
    resolveProfessionalView(consultation.professionalId),
  ]);
  return { ...consultation, client, professional };
};

/**
 * List consultations with optional filters and pagination.
 * Supported filters: callStatus, clientId, professionalId, bookingId.
 * @returns {Promise<{ items, page, limit, total }>}
 */
const list = async ({ filters = {}, page, limit } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);
  const where = {};

  if (filters.callStatus) where.callStatus = String(filters.callStatus);
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (filters.bookingId) where.bookingId = filters.bookingId;

  const { rows, count } = await Consultation.findAndCountAll({
    where,
    limit: l,
    offset,
    raw: true,
  });

  return { items: rows, page: p, limit: l, total: count };
};

/** Find a consultation by id, decorated with client/professional info. */
const getById = async (id) => {
  const consultation = await Consultation.findByPk(id, { raw: true });
  if (!consultation) return null;
  return decorate(consultation);
};

/**
 * Find the consultation for a booking — bookings always auto-create one on
 * create, but we still fall back gracefully when missing.
 */
const getByBooking = async (bookingId) => {
  const consultation = await Consultation.findOne({
    where: { bookingId },
    raw: true,
  });
  if (!consultation) return null;
  return decorate(consultation);
};

/** Start a consultation call. Returns null when the consultation is missing. */
const start = async (id) => {
  const consultation = await Consultation.findByPk(id);
  if (!consultation) return null;
  if (consultation.callStatus === 'ended') {
    throw { statusCode: 422, message: 'Consultation has already ended' };
  }
  await consultation.update({
    callStatus: 'ongoing',
    startedAt: consultation.startedAt || new Date(),
  });
  return decorate(consultation.get({ plain: true }));
};

/**
 * End a consultation call. Computes durationMinutes from start/end times
 * and cost from the professional's per-minute rate (legacy or new-model).
 * Returns null when the consultation is missing.
 */
const end = async (id) => {
  const consultation = await Consultation.findByPk(id);
  if (!consultation) return null;
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

  const pro = await resolveProfessionalView(consultation.professionalId);
  const rate = pro ? pro.perMinuteRate : 0;

  await consultation.update({
    callStatus: 'ended',
    endedAt,
    durationMinutes,
    cost: durationMinutes * rate,
  });

  // Mark the linked booking as completed if present.
  if (consultation.bookingId) {
    const booking = await Booking.findByPk(consultation.bookingId);
    if (booking && booking.status !== 'cancelled') {
      await booking.update({ status: 'completed' });
    }
  }

  return decorate(consultation.get({ plain: true }));
};

/** Get the recording URL for a consultation. Returns null if missing. */
const getRecording = async (id) => {
  const consultation = await Consultation.findByPk(id, { raw: true });
  if (!consultation) return null;
  return {
    consultationId: consultation.id,
    recordingUrl: consultation.recordingUrl,
    available: Boolean(consultation.recordingUrl),
  };
};

/** Get the transcript for a consultation. Returns null if missing. */
const getTranscript = async (id) => {
  const consultation = await Consultation.findByPk(id, { raw: true });
  if (!consultation) return null;
  return {
    consultationId: consultation.id,
    transcript: consultation.transcript,
    available: Boolean(consultation.transcript),
  };
};

/** Append/replace notes on a consultation. Returns null if missing. */
const addNotes = async (id, notes) => {
  const consultation = await Consultation.findByPk(id);
  if (!consultation) return null;
  await consultation.update({ notes: notes || '' });
  return decorate(consultation.get({ plain: true }));
};

module.exports = {
  list,
  getById,
  getByBooking,
  start,
  end,
  getRecording,
  getTranscript,
  addNotes,
};
