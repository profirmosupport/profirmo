// Future DB schema (MongoDB/PostgreSQL):
//   id, name, email, phone, city, userType, createdAt
// userType: 'individual' | 'business'

let seq = 0;

function createClient(data = {}) {
  return {
    id: data.id || `client-${Date.now()}-${++seq}`,
    name: data.name || '',
    email: (data.email || '').toLowerCase(),
    phone: data.phone || '',
    city: data.city || '',
    userType: data.userType || 'individual',
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

module.exports = { createClient };
