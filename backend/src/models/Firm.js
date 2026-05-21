// Future DB schema (MongoDB/PostgreSQL):
//   id, name, firmType, city, address, email, phone, rating, reviewsCount,
//   professionalCount, services[], description, professionalIds[], adminName,
//   createdAt
// firmType: 'Legal Firm' | 'Tax Firm'

let seq = 0;

function createFirm(data = {}) {
  const professionalIds = Array.isArray(data.professionalIds)
    ? data.professionalIds
    : [];
  return {
    id: data.id || `firm-${Date.now()}-${++seq}`,
    name: data.name || '',
    firmType: data.firmType || 'Legal Firm',
    city: data.city || '',
    address: data.address || '',
    email: (data.email || '').toLowerCase(),
    phone: data.phone || '',
    rating: typeof data.rating === 'number' ? data.rating : 0,
    reviewsCount: typeof data.reviewsCount === 'number' ? data.reviewsCount : 0,
    professionalCount:
      typeof data.professionalCount === 'number'
        ? data.professionalCount
        : professionalIds.length,
    services: Array.isArray(data.services) ? data.services : [],
    description: data.description || '',
    professionalIds,
    adminName: data.adminName || '',
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

module.exports = { createFirm };
