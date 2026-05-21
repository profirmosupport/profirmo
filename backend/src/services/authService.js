const db = require('../data/mockData');
const { createUser } = require('../models/User');
const { createClient } = require('../models/Client');
const { createProfessional } = require('../models/Professional');
const { createFirm } = require('../models/Firm');
const { signToken } = require('../utils/tokenHelper');

// Build the public view of a user (never expose the password).
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
};

// Build a JWT for a given user record.
const issueToken = (user) =>
  signToken({ id: user.id, role: user.role, linkedId: user.linkedId });

/**
 * Authenticate a user with email + plain password (mock comparison).
 * @returns {{ token: string, user: object }}
 */
const login = (email, password) => {
  const normalized = (email || '').toLowerCase();
  const user = db.users.find((u) => u.email === normalized);
  if (!user || user.password !== password) {
    throw { statusCode: 401, message: 'Invalid email or password' };
  }
  return { token: issueToken(user), user: sanitizeUser(user) };
};

/**
 * Register a new client: creates a Client record and a linked User.
 */
const registerClient = (data = {}) => {
  const normalized = (data.email || '').toLowerCase();
  if (db.users.some((u) => u.email === normalized)) {
    throw { statusCode: 409, message: 'Email already registered' };
  }

  const client = createClient({
    name: data.name,
    email: data.email,
    phone: data.phone,
    city: data.city,
    userType: data.userType || 'individual',
  });
  db.clients.push(client);

  const user = createUser({
    name: data.name,
    email: data.email,
    password: data.password,
    role: 'client',
    linkedId: client.id,
  });
  db.users.push(user);

  return { token: issueToken(user), user: sanitizeUser(user) };
};

/**
 * Register a new independent professional: creates a Professional record
 * (status 'pending' for admin approval) and a linked User.
 */
const registerProfessional = (data = {}) => {
  const normalized = (data.email || '').toLowerCase();
  if (db.users.some((u) => u.email === normalized)) {
    throw { statusCode: 409, message: 'Email already registered' };
  }

  const professional = createProfessional({
    name: data.name,
    email: data.email,
    phone: data.phone,
    professionType: data.professionType,
    specialization: data.specialization,
    city: data.city,
    experience: Number(data.experience) || 0,
    languages: Array.isArray(data.languages) ? data.languages : [],
    perMinuteRate: Number(data.perMinuteRate) || 0,
    bio: data.bio,
    registrationNumber: data.registrationNumber,
    servicesOffered: Array.isArray(data.servicesOffered)
      ? data.servicesOffered
      : [],
    verified: false,
    status: 'pending',
  });
  db.professionals.push(professional);

  const user = createUser({
    name: data.name,
    email: data.email,
    password: data.password,
    role: 'professional',
    linkedId: professional.id,
  });
  db.users.push(user);

  return { token: issueToken(user), user: sanitizeUser(user) };
};

/**
 * Register a new firm: creates a Firm record and a linked firm_admin User.
 */
const registerFirm = (data = {}) => {
  const normalized = (data.email || '').toLowerCase();
  if (db.users.some((u) => u.email === normalized)) {
    throw { statusCode: 409, message: 'Email already registered' };
  }

  const firm = createFirm({
    name: data.name,
    firmType: data.firmType || 'Legal Firm',
    city: data.city,
    address: data.address,
    email: data.email,
    phone: data.phone,
    services: Array.isArray(data.services) ? data.services : [],
    description: data.description,
    adminName: data.adminName || data.name,
  });
  db.firms.push(firm);

  const user = createUser({
    name: data.adminName || data.name,
    email: data.email,
    password: data.password,
    role: 'firm_admin',
    linkedId: firm.id,
    firmId: firm.id,
  });
  db.users.push(user);

  return { token: issueToken(user), user: sanitizeUser(user) };
};

/**
 * Fetch the current user (sanitized) by id.
 */
const getCurrentUser = (userId) => {
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }
  return sanitizeUser(user);
};

module.exports = {
  login,
  registerClient,
  registerProfessional,
  registerFirm,
  getCurrentUser,
};
