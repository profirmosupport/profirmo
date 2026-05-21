const db = require('../data/mockData');
const { createCase } = require('../models/Case');
const { paginate } = require('./professionalService');

/**
 * List cases with optional filters and pagination.
 * Supported filters: status, category, clientId, professionalId, firmId.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.cases];

  if (filters.status) {
    const q = String(filters.status).toLowerCase();
    result = result.filter((c) => c.status.toLowerCase() === q);
  }
  if (filters.category) {
    const q = String(filters.category).toLowerCase();
    result = result.filter((c) => c.category.toLowerCase() === q);
  }
  if (filters.clientId) {
    result = result.filter((c) => c.clientId === filters.clientId);
  }
  if (filters.professionalId) {
    result = result.filter((c) => c.professionalId === filters.professionalId);
  }
  if (filters.firmId) {
    result = result.filter((c) => c.firmId === filters.firmId);
  }

  return paginate(result, page, limit);
};

/** Find a case by id or throw 404. */
const getById = (id) => {
  const found = db.cases.find((c) => c.id === id);
  if (!found) {
    throw { statusCode: 404, message: `Case not found: ${id}` };
  }
  return found;
};

/** Create a new case record. */
const create = (data = {}) => {
  const newCase = createCase({
    clientId: data.clientId,
    professionalId: data.professionalId,
    firmId: data.firmId || null,
    title: data.title,
    category: data.category,
    status: data.status || 'open',
    description: data.description,
    files: Array.isArray(data.files) ? data.files : [],
  });
  db.cases.push(newCase);
  return newCase;
};

/** Update an existing case record. */
const update = (id, data = {}) => {
  const found = getById(id);
  const updatable = [
    'professionalId',
    'firmId',
    'title',
    'category',
    'status',
    'description',
    'files',
  ];
  updatable.forEach((field) => {
    if (data[field] !== undefined) {
      found[field] = data[field];
    }
  });
  return found;
};

/** Delete a case record. Returns the removed case. */
const remove = (id) => {
  const index = db.cases.findIndex((c) => c.id === id);
  if (index === -1) {
    throw { statusCode: 404, message: `Case not found: ${id}` };
  }
  const [removed] = db.cases.splice(index, 1);
  return removed;
};

/** Get all cases for a given client. */
const getByClient = (clientId) =>
  db.cases.filter((c) => c.clientId === clientId);

/** Get all cases for a given professional. */
const getByProfessional = (professionalId) =>
  db.cases.filter((c) => c.professionalId === professionalId);

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getByClient,
  getByProfessional,
};
