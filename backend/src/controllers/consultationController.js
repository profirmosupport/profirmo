const consultationService = require('../services/consultationService');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');

// GET /api/consultations
const listConsultations = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const { items, ...meta } = consultationService.list({
    filters,
    page,
    limit,
  });
  return paginatedResponse(res, 'Consultations fetched', items, meta);
});

// GET /api/consultations/:id
const getConsultation = asyncHandler(async (req, res) => {
  const consultation = consultationService.getById(req.params.id);
  return successResponse(res, 200, 'Consultation fetched', consultation);
});

// POST /api/consultations/:id/start
const startConsultation = asyncHandler(async (req, res) => {
  const consultation = consultationService.start(req.params.id);
  return successResponse(res, 200, 'Consultation started', consultation);
});

// POST /api/consultations/:id/end
const endConsultation = asyncHandler(async (req, res) => {
  const consultation = consultationService.end(req.params.id);
  return successResponse(res, 200, 'Consultation ended', consultation);
});

// GET /api/consultations/:id/recording
const getRecording = asyncHandler(async (req, res) => {
  const recording = consultationService.getRecording(req.params.id);
  return successResponse(res, 200, 'Consultation recording fetched', recording);
});

// GET /api/consultations/:id/transcript
const getTranscript = asyncHandler(async (req, res) => {
  const transcript = consultationService.getTranscript(req.params.id);
  return successResponse(
    res,
    200,
    'Consultation transcript fetched',
    transcript
  );
});

// POST /api/consultations/:id/notes
const addNotes = asyncHandler(async (req, res) => {
  const consultation = consultationService.addNotes(
    req.params.id,
    req.body.notes
  );
  return successResponse(res, 200, 'Consultation notes saved', consultation);
});

module.exports = {
  listConsultations,
  getConsultation,
  startConsultation,
  endConsultation,
  getRecording,
  getTranscript,
  addNotes,
};
