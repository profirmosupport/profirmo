// Future DB schema (MongoDB/PostgreSQL):
//   id, clientId, professionalId, date, time, duration, type,
//   estimatedCost, status, createdAt
// type: 'instant' | 'scheduled'
// status: 'pending' | 'confirmed' | 'completed' | 'cancelled'

let seq = 0;

function createBooking(data = {}) {
  return {
    id: data.id || `booking-${Date.now()}-${++seq}`,
    clientId: data.clientId || null,
    professionalId: data.professionalId || null,
    date: data.date || '',
    time: data.time || '',
    duration: typeof data.duration === 'number' ? data.duration : 0,
    type: data.type || 'scheduled',
    estimatedCost:
      typeof data.estimatedCost === 'number' ? data.estimatedCost : 0,
    status: data.status || 'pending',
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

module.exports = { createBooking };
