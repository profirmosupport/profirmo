const db = require('../data/mockData');
const { createClient } = require('../models/Client');
const { paginate } = require('./professionalService');

/**
 * List clients with optional filters and pagination.
 * Supported filters: name, city, userType.
 */
const list = ({ filters = {}, page, limit } = {}) => {
  let result = [...db.clients];

  if (filters.name) {
    const q = String(filters.name).toLowerCase();
    result = result.filter((c) => c.name.toLowerCase().includes(q));
  }
  if (filters.city) {
    const q = String(filters.city).toLowerCase();
    result = result.filter((c) => c.city.toLowerCase() === q);
  }
  if (filters.userType) {
    const q = String(filters.userType).toLowerCase();
    result = result.filter((c) => c.userType.toLowerCase() === q);
  }

  return paginate(result, page, limit);
};

/** Find a client by id or throw 404. */
const getById = (id) => {
  const client = db.clients.find((c) => c.id === id);
  if (!client) {
    throw { statusCode: 404, message: `Client not found: ${id}` };
  }
  return client;
};

/** Create a new client record. */
const create = (data = {}) => {
  const client = createClient({
    name: data.name,
    email: data.email,
    phone: data.phone,
    city: data.city,
    userType: data.userType || 'individual',
  });
  db.clients.push(client);
  return client;
};

/** Update an existing client record. */
const update = (id, data = {}) => {
  const client = getById(id);
  const updatable = ['name', 'email', 'phone', 'city', 'userType'];
  updatable.forEach((field) => {
    if (data[field] !== undefined) {
      client[field] = field === 'email' ? String(data[field]).toLowerCase() : data[field];
    }
  });
  return client;
};

module.exports = { list, getById, create, update };
