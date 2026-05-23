const {
  Booking,
  Consultation,
  Professional,
  ProfessionalDetail,
  User,
} = require('../models');
const { Op } = require('sequelize');
const { paginate } = require('./professionalService');
const notificationService = require('./notificationService');

// Attach `consultationId` to a list of bookings via a single bulk lookup.
const attachConsultations = async (bookings) => {
  if (!bookings || bookings.length === 0) return bookings || [];
  const ids = bookings.map((b) => b.id);
  const consultations = await Consultation.findAll({
    where: { bookingId: { [Op.in]: ids } },
    raw: true,
  });
  const byBooking = new Map(consultations.map((c) => [c.bookingId, c]));
  return bookings.map((b) => {
    const c = byBooking.get(b.id);
    return {
      ...b,
      consultationId: c ? c.id : null,
      callStatus: c ? c.callStatus : null,
    };
  });
};

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

// Fire-and-forget notification — failures never break the request.
const notify = async (params) => {
  try {
    await notificationService.createNotification(params);
  } catch (err) {
    console.warn(`[bookingNotify] failed: ${err.message}`);
  }
};

// Resolve a public professional id (user.linkedId || detail.id) to:
//   { rate, name, userId }  — rate sourced from legacy `professionals` first,
//                              then ProfessionalDetail.consultationFee.
const resolveProfessional = async (publicProfId) => {
  if (!publicProfId) return null;

  // 1. Legacy Professional table (prof-N).
  const legacy = await Professional.findByPk(publicProfId, { raw: true });
  if (legacy) {
    const linkedUser = await User.findOne({
      where: { linkedId: publicProfId },
      raw: true,
    });
    return {
      rate: Number(legacy.perMinuteRate) || 0,
      name: legacy.name || '',
      userId: linkedUser ? linkedUser.id : null,
    };
  }

  // 2. New-model: ProfessionalDetail (pdetail-...).
  const detail = await ProfessionalDetail.findByPk(publicProfId, {
    raw: true,
  });
  if (detail) {
    const owner = detail.userId
      ? await User.findByPk(detail.userId, { raw: true })
      : null;
    return {
      rate: Number(detail.consultationFee) || 0,
      name: owner
        ? owner.fullName ||
          [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() ||
          owner.name ||
          ''
        : '',
      userId: owner ? owner.id : null,
    };
  }

  return null;
};

/**
 * List bookings with optional filters and pagination.
 * Supported filters: status, type, clientId, professionalId.
 * @returns {Promise<{ items, page, limit, total }>}
 */
const list = async ({ filters = {}, page, limit } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);
  const where = {};

  if (filters.status) where.status = String(filters.status);
  if (filters.type) where.type = String(filters.type);
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.professionalId) where.professionalId = filters.professionalId;

  const { rows, count } = await Booking.findAndCountAll({
    where,
    limit: l,
    offset,
    raw: true,
  });

  return { items: rows, page: p, limit: l, total: count };
};

/** Find a booking by id, or null when not found. */
const getById = async (id) => {
  const booking = await Booking.findByPk(id, { raw: true });
  return booking || null;
};

/**
 * Create a booking. estimatedCost is derived from the professional's
 * per-minute rate and the requested duration. A matching scheduled
 * consultation record is also created.
 */
const create = async (data = {}, actor = null) => {
  const pro = await resolveProfessional(data.professionalId);
  if (!pro) {
    throw {
      statusCode: 404,
      message: `Professional not found: ${data.professionalId}`,
    };
  }

  // clientId is now `users.id` (role='client'). Accept it from the body OR
  // derive it from the authenticated client user (req.user.id).
  const resolvedClientId =
    data.clientId || (actor && actor.role === 'client' ? actor.id : null);
  if (!resolvedClientId) {
    throw {
      statusCode: 422,
      message: 'clientId is required (or sign in as a client).',
    };
  }
  const client = await User.findByPk(resolvedClientId);
  if (!client || client.role !== 'client') {
    throw {
      statusCode: 404,
      message: `Client not found: ${resolvedClientId}`,
    };
  }
  const clientDisplayName =
    client.fullName ||
    [client.firstName, client.lastName].filter(Boolean).join(' ').trim() ||
    client.name ||
    'A client';

  const duration = Number(data.duration) || 0;
  const estimatedCost = duration * (pro.rate || 0);

  const booking = await Booking.create({
    clientId: resolvedClientId,
    professionalId: data.professionalId,
    date: data.date || '',
    time: data.time || '',
    duration,
    type: data.type || 'scheduled',
    estimatedCost,
    status: data.status || 'pending',
  });

  // Auto-create the consultation shell for this booking.
  const consultation = await Consultation.create({
    bookingId: booking.id,
    clientId: booking.clientId,
    professionalId: booking.professionalId,
    callStatus: 'scheduled',
  });

  // Notify the assigned professional of the new booking.
  if (pro.userId && (!actor || pro.userId !== actor.id)) {
    await notify({
      userId: pro.userId,
      type: 'booking_received',
      title:
        booking.type === 'instant'
          ? 'New instant consultation request'
          : 'New consultation booking',
      message:
        booking.type === 'instant'
          ? `${clientDisplayName} wants to consult with you now (${duration} min).`
          : `${clientDisplayName} booked a ${duration}-minute consultation on ${booking.date} at ${booking.time}.`,
      link: '/dashboard/professional/bookings',
      metadata: { bookingId: booking.id, type: booking.type },
    });
  }

  return { ...booking.get({ plain: true }), consultationId: consultation.id };
};

/** Bookings made by the calling client user (clientId = users.id). */
const listMineAsClient = async (user) => {
  if (!user || user.role !== 'client') return [];
  const rows = await Booking.findAll({
    where: { clientId: user.id },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return attachConsultations(rows);
};

/**
 * Bookings assigned to the calling professional. Resolves their public
 * professional id from user.linkedId (legacy) or via professional_details.
 */
const listMineAsProfessional = async (user) => {
  if (!user) return [];
  let professionalId = user.linkedId;
  if (!professionalId) {
    const detail = await ProfessionalDetail.findOne({
      where: { userId: user.id },
      raw: true,
    });
    professionalId = detail ? detail.id : null;
  }
  if (!professionalId) return [];
  const rows = await Booking.findAll({
    where: { professionalId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return attachConsultations(rows);
};

/** Update a booking's status. Returns null when the booking is not found. */
const updateStatus = async (id, status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw {
      statusCode: 422,
      message: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
    };
  }
  const booking = await Booking.findByPk(id);
  if (!booking) return null;
  await booking.update({ status });
  return booking.get({ plain: true });
};

/** Get all bookings for a given client. */
const getByClient = async (clientId) =>
  Booking.findAll({ where: { clientId }, raw: true });

/** Get all bookings for a given professional. */
const getByProfessional = async (professionalId) =>
  Booking.findAll({ where: { professionalId }, raw: true });

module.exports = {
  list,
  getById,
  create,
  updateStatus,
  getByClient,
  getByProfessional,
  listMineAsClient,
  listMineAsProfessional,
};
