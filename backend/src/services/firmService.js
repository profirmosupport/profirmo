const db = require('../data/mockData');
const { createProfessional } = require('../models/Professional');
const { paginate } = require('./professionalService');

/**
 * List firms with optional filters and pagination.
 * Supported filters: name, city, firmType.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.firms];

  if (filters.name) {
    const q = String(filters.name).toLowerCase();
    result = result.filter((f) => f.name.toLowerCase().includes(q));
  }
  if (filters.city) {
    const q = String(filters.city).toLowerCase();
    result = result.filter((f) => f.city.toLowerCase() === q);
  }
  if (filters.firmType) {
    const q = String(filters.firmType).toLowerCase();
    result = result.filter((f) => f.firmType.toLowerCase() === q);
  }

  return paginate(result, page, limit);
};

/** Find a firm by id or throw 404. */
const getById = (id) => {
  const firm = db.firms.find((f) => f.id === id);
  if (!firm) {
    throw { statusCode: 404, message: `Firm not found: ${id}` };
  }
  return firm;
};

/** Get all professionals belonging to a firm. */
const getProfessionals = (firmId) => {
  getById(firmId);
  return db.professionals.filter((p) => p.firmId === firmId);
};

/**
 * Add a new professional under a firm. Creates the Professional record,
 * links it to the firm and updates the firm's professional list/count.
 */
const addProfessional = (firmId, data = {}) => {
  const firm = getById(firmId);

  const professional = createProfessional({
    name: data.name,
    email: data.email,
    phone: data.phone,
    professionType: data.professionType,
    specialization: data.specialization,
    city: data.city || firm.city,
    experience: Number(data.experience) || 0,
    languages: Array.isArray(data.languages) ? data.languages : [],
    perMinuteRate: Number(data.perMinuteRate) || 0,
    bio: data.bio,
    registrationNumber: data.registrationNumber,
    firmId: firm.id,
    servicesOffered: Array.isArray(data.servicesOffered)
      ? data.servicesOffered
      : [],
    verified: true,
    status: 'approved',
  });
  db.professionals.push(professional);

  firm.professionalIds.push(professional.id);
  firm.professionalCount = firm.professionalIds.length;

  return professional;
};

/**
 * Get clients linked to a firm through cases handled by that firm or by
 * its professionals.
 */
const getClients = (firmId) => {
  getById(firmId);
  const firmProfessionalIds = db.professionals
    .filter((p) => p.firmId === firmId)
    .map((p) => p.id);

  const relatedCases = db.cases.filter(
    (c) =>
      c.firmId === firmId || firmProfessionalIds.includes(c.professionalId)
  );
  const clientIds = [...new Set(relatedCases.map((c) => c.clientId))];

  return db.clients.filter((c) => clientIds.includes(c.id));
};

/** Get all cases handled by a firm or its professionals. */
const getCases = (firmId) => {
  getById(firmId);
  const firmProfessionalIds = db.professionals
    .filter((p) => p.firmId === firmId)
    .map((p) => p.id);

  return db.cases.filter(
    (c) =>
      c.firmId === firmId || firmProfessionalIds.includes(c.professionalId)
  );
};

module.exports = {
  list,
  getById,
  getProfessionals,
  addProfessional,
  getClients,
  getCases,
};
