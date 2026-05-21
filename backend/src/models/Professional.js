// Future DB schema (MongoDB/PostgreSQL):
//   id, name, email, phone, professionType, specialization, city, experience,
//   languages[], rating, reviewsCount, perMinuteRate, availableNow, profileImage,
//   bio, registrationNumber, firmId, servicesOffered[], availabilitySlots[],
//   verified, status, createdAt
// status: 'approved' | 'pending'

let seq = 0;

function createProfessional(data = {}) {
  return {
    id: data.id || `prof-${Date.now()}-${++seq}`,
    name: data.name || '',
    email: (data.email || '').toLowerCase(),
    phone: data.phone || '',
    professionType: data.professionType || '',
    specialization: data.specialization || '',
    city: data.city || '',
    experience: typeof data.experience === 'number' ? data.experience : 0,
    languages: Array.isArray(data.languages) ? data.languages : [],
    rating: typeof data.rating === 'number' ? data.rating : 0,
    reviewsCount: typeof data.reviewsCount === 'number' ? data.reviewsCount : 0,
    perMinuteRate:
      typeof data.perMinuteRate === 'number' ? data.perMinuteRate : 0,
    availableNow: Boolean(data.availableNow),
    profileImage: data.profileImage || null,
    bio: data.bio || '',
    registrationNumber: data.registrationNumber || '',
    firmId: data.firmId || null,
    servicesOffered: Array.isArray(data.servicesOffered)
      ? data.servicesOffered
      : [],
    availabilitySlots: Array.isArray(data.availabilitySlots)
      ? data.availabilitySlots
      : [],
    verified: Boolean(data.verified),
    status: data.status || 'pending',
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

module.exports = { createProfessional };
