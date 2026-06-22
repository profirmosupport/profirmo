const bookingService = require('../services/bookingService');
const bookingDetailService = require('../services/bookingDetailService');
const caseService = require('../services/caseService');
const gates = require('../services/subscriptionGateService');
const auditService = require('../services/auditService');
const { Case, ProfessionalClient } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

const notFound = (id) => ({
  statusCode: 404,
  message: `Booking not found: ${id}`,
});

// GET /api/bookings
const listBookings = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = await bookingService.list({
    filters,
    page,
    limit,
  });
  return paginatedResponse(res, 'Bookings fetched', items, meta);
});

// GET /api/bookings/:id
const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getById(req.params.id);
  if (!booking) throw notFound(req.params.id);
  return successResponse(res, 200, 'Booking fetched', booking);
});

// POST /api/bookings
const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.create(req.body, req.user);
  auditService.recordCreate({
    req,
    entityType: 'booking',
    entityId: booking.id,
    after: booking,
    summary: `Booking ${booking.id} created`,
  });
  return successResponse(res, 201, 'Booking created', booking);
});

// GET /api/bookings/mine — bookings made by the calling client.
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.listMineAsClient(req.user);
  return successResponse(res, 200, 'Your bookings fetched', bookings);
});

// GET /api/bookings/mine-as-professional — bookings assigned to the caller.
const getMyAssignedBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.listMineAsProfessional(req.user);
  return successResponse(res, 200, 'Your assigned bookings fetched', bookings);
});

// PATCH /api/bookings/:id/status
const updateBookingStatus = asyncHandler(async (req, res) => {
  const before = await bookingService.getById(req.params.id);
  const booking = await bookingService.updateStatus(
    req.params.id,
    req.body.status
  );
  if (!booking) throw notFound(req.params.id);
  auditService.recordUpdate({
    req,
    entityType: 'booking',
    entityId: req.params.id,
    before: { status: before ? before.status : null },
    after: { status: booking.status },
    summary: `Booking ${req.params.id} status → ${booking.status}`,
  });
  return successResponse(res, 200, 'Booking status updated', booking);
});

// GET /api/bookings/client/:clientId
const getBookingsByClient = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getByClient(req.params.clientId);
  return successResponse(res, 200, 'Client bookings fetched', bookings);
});

// GET /api/bookings/professional/:professionalId
const getBookingsByProfessional = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getByProfessional(
    req.params.professionalId
  );
  return successResponse(res, 200, 'Professional bookings fetched', bookings);
});

// GET /api/bookings/:id/detail — booking + professional + notes + review.
const getBookingDetail = asyncHandler(async (req, res) => {
  const detail = await bookingDetailService.getBookingDetail(
    req.params.id,
    req.user
  );
  if (!detail) throw notFound(req.params.id);
  return successResponse(res, 200, 'Booking detail fetched', detail);
});

// POST /api/bookings/:id/notes  body: { body, attachments? }
const addBookingNote = asyncHandler(async (req, res) => {
  const note = await bookingDetailService.addNote(
    req.params.id,
    req.user,
    {
      body: (req.body && req.body.body) || '',
      attachments: (req.body && req.body.attachments) || [],
    }
  );
  return successResponse(res, 201, 'Note added', note);
});

// POST /api/bookings/:id/convert-to-case
// body: { title, category?, description?, priority? }
//
// Idempotent: one live case per booking. If a case already exists for this
// booking we return it with `alreadyExisted: true` so the frontend can
// redirect the pro instead of creating a second case. Deleting the case
// clears the row (no soft-delete), so a follow-up conversion is free to
// create a fresh case from the same booking.
const convertBookingToCase = asyncHandler(async (req, res) => {
  const detail = await bookingDetailService.getBookingDetail(
    req.params.id,
    req.user
  );
  if (!detail) throw notFound(req.params.id);
  if (!detail.permissions.canConvertToCase) {
    throw {
      statusCode: 403,
      message: 'Only the assigned professional can convert a booking to a case.',
    };
  }

  // Dedup check before creation — keeps the page idempotent if a stray
  // double-click submits twice and surfaces the existing case URL when the
  // pro re-attempts the conversion months later.
  const existing = await Case.findOne({
    where: { bookingId: detail.booking.id },
    raw: true,
  });
  if (existing) {
    return successResponse(res, 200, 'Case already exists for this booking', {
      case: existing,
      bookingId: detail.booking.id,
      alreadyExisted: true,
    });
  }

  // Subscription gate — the new case will be assigned to a single
  // professional (the booking's pro), so it counts as an individual case
  // against THEIR plan. Returns 403 + code='PLAN_LIMIT_REACHED' if they
  // are at their caseLimit so the frontend can show the upgrade CTA.
  try {
    // detail.booking.professionalId is the legacy professional id
    // (User.linkedId), which is what canAssignCaseToProfessional expects.
    await gates.enforceCanAssignCaseToProfessional(
      detail.booking.professionalId
    );
  } catch (err) {
    if (err && err.code === 'PLAN_LIMIT_REACHED') {
      return res.status(err.statusCode || 403).json({
        success: false,
        message: err.message,
        errors: null,
        code: err.code,
        feature: err.feature,
        planName: err.planName,
        limit: err.limit,
        currentCount: err.currentCount,
      });
    }
    throw err;
  }

  const body = req.body || {};
  const title =
    String(body.title || '').trim() ||
    `Booking ${detail.booking.id.slice(-8)} — ${detail.client ? detail.client.name : 'client'}`;

  const newCase = await caseService.create(
    {
      clientId: detail.booking.clientId,
      professionalId: detail.booking.professionalId,
      // Stamp the back-link so future convert attempts hit the dedup above.
      bookingId: detail.booking.id,
      title,
      category: body.category || detail.professional?.professionalType || 'General',
      description: String(body.description || '').trim() || null,
      priority: body.priority || 'medium',
      status: 'open',
    },
    req.user
  );

  // Make sure the client appears in the pro's clients list. The payment
  // verify hook normally creates this link on successful Razorpay capture;
  // but if the booking was completed without a paid payment, no link
  // exists and the client wouldn't show up in the case edit modal's
  // pre-filled chip picker.
  if (detail.booking.clientId && detail.booking.professionalId) {
    const existingLink = await ProfessionalClient.findOne({
      where: {
        professionalId: detail.booking.professionalId,
        clientUserId: detail.booking.clientId,
      },
    });
    if (!existingLink) {
      try {
        await ProfessionalClient.create({
          professionalId: detail.booking.professionalId,
          clientUserId: detail.booking.clientId,
          addedByUserId: req.user && req.user.id,
        });
      } catch (err) {
        console.warn(
          `[convertBookingToCase] could not link client: ${err.message}`
        );
      }
    }
  }

  // Copy every booking note over as a proper CaseNote row so the case
  // timeline reflects the conversation that led to it. Attachments come
  // along too; the author is the booking's note author (so the pro and
  // client are correctly attributed on the case as well). Errors are
  // logged but do NOT roll the case back — a half-copied timeline is
  // better than no case at all.
  if (Array.isArray(detail.notes) && detail.notes.length > 0) {
    for (const note of detail.notes) {
      try {
        await caseService.addNote(
          newCase.id,
          {
            id: note.authorUserId || (req.user && req.user.id),
            fullName: note.authorName || null,
          },
          {
            body: note.body,
            attachments: Array.isArray(note.attachments) ? note.attachments : [],
          }
        );
      } catch (err) {
        console.warn(
          `[convertBookingToCase] failed to copy note ${note.id}: ${err.message}`
        );
      }
    }
  }

  return successResponse(res, 201, 'Case created from booking', {
    case: newCase,
    bookingId: detail.booking.id,
    alreadyExisted: false,
  });
});

module.exports = {
  listBookings,
  getBooking,
  createBooking,
  getMyBookings,
  getMyAssignedBookings,
  updateBookingStatus,
  getBookingsByClient,
  getBookingsByProfessional,
  getBookingDetail,
  addBookingNote,
  convertBookingToCase,
};
