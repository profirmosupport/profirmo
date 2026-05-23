const consultationService = require('../services/consultationService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

const notFound = (id) => ({
  statusCode: 404,
  message: `Consultation not found: ${id}`,
});

// GET /api/consultations
const listConsultations = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = await consultationService.list({
    filters,
    page,
    limit,
  });
  return paginatedResponse(res, 'Consultations fetched', items, meta);
});

// GET /api/consultations/:id
const getConsultation = asyncHandler(async (req, res) => {
  const consultation = await consultationService.getById(req.params.id);
  if (!consultation) throw notFound(req.params.id);
  return successResponse(res, 200, 'Consultation fetched', consultation);
});

// GET /api/consultations/by-booking/:bookingId
const getConsultationByBooking = asyncHandler(async (req, res) => {
  const consultation = await consultationService.getByBooking(
    req.params.bookingId
  );
  if (!consultation) {
    throw {
      statusCode: 404,
      message: `Consultation not found for booking: ${req.params.bookingId}`,
    };
  }
  return successResponse(res, 200, 'Consultation fetched', consultation);
});

// POST /api/consultations/:id/start
const startConsultation = asyncHandler(async (req, res) => {
  const consultation = await consultationService.start(req.params.id);
  if (!consultation) throw notFound(req.params.id);
  return successResponse(res, 200, 'Consultation started', consultation);
});

// POST /api/consultations/:id/end
const endConsultation = asyncHandler(async (req, res) => {
  const consultation = await consultationService.end(req.params.id);
  if (!consultation) throw notFound(req.params.id);
  return successResponse(res, 200, 'Consultation ended', consultation);
});

// GET /api/consultations/:id/recording
const getRecording = asyncHandler(async (req, res) => {
  const recording = await consultationService.getRecording(req.params.id);
  if (!recording) throw notFound(req.params.id);
  return successResponse(res, 200, 'Consultation recording fetched', recording);
});

// GET /api/consultations/:id/transcript
const getTranscript = asyncHandler(async (req, res) => {
  const transcript = await consultationService.getTranscript(req.params.id);
  if (!transcript) throw notFound(req.params.id);
  return successResponse(
    res,
    200,
    'Consultation transcript fetched',
    transcript
  );
});

// POST /api/consultations/:id/notes
const addNotes = asyncHandler(async (req, res) => {
  const consultation = await consultationService.addNotes(
    req.params.id,
    req.body.notes
  );
  if (!consultation) throw notFound(req.params.id);
  return successResponse(res, 200, 'Consultation notes saved', consultation);
});

module.exports = {
  listConsultations,
  getConsultation,
  getConsultationByBooking,
  startConsultation,
  endConsultation,
  getRecording,
  getTranscript,
  addNotes,
};
