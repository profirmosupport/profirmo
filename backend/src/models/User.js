// Future DB schema (MongoDB/PostgreSQL):
//   id, name, email, password (hashed), role, linkedId, firmId, createdAt
// Roles: 'client' | 'professional' | 'firm_admin' | 'firm_professional' | 'platform_admin'
// NOTE: password is stored as plain text here for mock/demo purposes only.
//       A real implementation MUST hash it (bcrypt/argon2).

let seq = 0;

function createUser(data = {}) {
  return {
    id: data.id || `user-${Date.now()}-${++seq}`,
    name: data.name || '',
    email: (data.email || '').toLowerCase(),
    password: data.password || '',
    role: data.role || 'client',
    linkedId: data.linkedId || null,
    firmId: data.firmId || null,
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

module.exports = { createUser };
