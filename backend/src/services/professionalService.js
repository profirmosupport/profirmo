const db = require('../data/mockData');

// Default pagination settings shared across list endpoints.
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Apply page/limit pagination to an array.
 * @returns {{ items: Array, page: number, limit: number, total: number }}
 */
const paginate = (items, page, limit) => {
  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safeLimit = Math.max(Number(limit) || DEFAULT_LIMIT, 1);
  const start = (safePage - 1) * safeLimit;
  return {
    items: items.slice(start, start + safeLimit),
    page: safePage,
    limit: safeLimit,
    total: items.length,
  };
};

/**
 * List professionals with optional filters, sorting and pagination.
 * Supported filters: name, city, professionType, specialization,
 * minExperience, maxRate, availableNow, minRating, language.
 * Supported sort values: rating | experience | price | availability.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.professionals];

  if (filters.name) {
    const q = String(filters.name).toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (filters.city) {
    const q = String(filters.city).toLowerCase();
    result = result.filter((p) => p.city.toLowerCase() === q);
  }
  if (filters.professionType) {
    const q = String(filters.professionType).toLowerCase();
    result = result.filter((p) => p.professionType.toLowerCase() === q);
  }
  if (filters.specialization) {
    const q = String(filters.specialization).toLowerCase();
    result = result.filter((p) =>
      p.specialization.toLowerCase().includes(q)
    );
  }
  if (filters.minExperience !== undefined) {
    const min = Number(filters.minExperience) || 0;
    result = result.filter((p) => p.experience >= min);
  }
  if (filters.maxRate !== undefined) {
    const max = Number(filters.maxRate);
    if (!Number.isNaN(max)) {
      result = result.filter((p) => p.perMinuteRate <= max);
    }
  }
  if (filters.availableNow !== undefined) {
    const wantAvailable =
      filters.availableNow === true || filters.availableNow === 'true';
    result = result.filter((p) => p.availableNow === wantAvailable);
  }
  if (filters.minRating !== undefined) {
    const min = Number(filters.minRating) || 0;
    result = result.filter((p) => p.rating >= min);
  }
  if (filters.language) {
    const q = String(filters.language).toLowerCase();
    result = result.filter((p) =>
      p.languages.some((l) => l.toLowerCase() === q)
    );
  }
  if (filters.status) {
    const q = String(filters.status).toLowerCase();
    result = result.filter((p) => p.status.toLowerCase() === q);
  }

  switch (filters.sort) {
    case 'rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    case 'experience':
      result.sort((a, b) => b.experience - a.experience);
      break;
    case 'price':
      result.sort((a, b) => a.perMinuteRate - b.perMinuteRate);
      break;
    case 'availability':
      result.sort((a, b) => Number(b.availableNow) - Number(a.availableNow));
      break;
    default:
      break;
  }

  return paginate(result, page, limit);
};

/** Find a professional by id or throw 404. */
const getById = (id) => {
  const professional = db.professionals.find((p) => p.id === id);
  if (!professional) {
    throw { statusCode: 404, message: `Professional not found: ${id}` };
  }
  return professional;
};

/**
 * Free-text search across name, professionType, specialization and city.
 */
const search = (query) => {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  return db.professionals.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.professionType.toLowerCase().includes(q) ||
      p.specialization.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q)
  );
};

/** Toggle a professional's availableNow flag. */
const updateAvailability = (id, availableNow) => {
  const professional = getById(id);
  professional.availableNow = Boolean(availableNow);
  return professional;
};

/** Update a professional's per-minute rate. */
const updateRate = (id, perMinuteRate) => {
  const rate = Number(perMinuteRate);
  if (Number.isNaN(rate) || rate < 0) {
    throw { statusCode: 422, message: 'perMinuteRate must be a positive number' };
  }
  const professional = getById(id);
  professional.perMinuteRate = rate;
  return professional;
};

/** Get all reviews tied to a professional. */
const getReviews = (id) => {
  getById(id);
  return db.reviews.filter((r) => r.professionalId === id);
};

/** Get a professional's availability slots. */
const getAvailability = (id) => {
  const professional = getById(id);
  return {
    professionalId: professional.id,
    availableNow: professional.availableNow,
    availabilitySlots: professional.availabilitySlots,
  };
};

module.exports = {
  paginate,
  list,
  getById,
  search,
  updateAvailability,
  updateRate,
  getReviews,
  getAvailability,
};
