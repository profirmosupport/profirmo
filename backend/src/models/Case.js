// Future DB schema (MongoDB/PostgreSQL):
//   id, clientId, professionalId, firmId, title, category, status,
//   description, files[], createdAt
// status: 'open' | 'in-progress' | 'closed'
// files: [{ id, name, size, type, uploadedAt }]

let seq = 0;

function createCase(data = {}) {
  return {
    id: data.id || `case-${Date.now()}-${++seq}`,
    clientId: data.clientId || null,
    professionalId: data.professionalId || null,
    firmId: data.firmId || null,
    title: data.title || '',
    category: data.category || '',
    status: data.status || 'open',
    description: data.description || '',
    files: Array.isArray(data.files) ? data.files : [],
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

module.exports = { createCase };
