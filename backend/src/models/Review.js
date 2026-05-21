// Future DB schema (MongoDB/PostgreSQL):
//   id, clientId, clientName, professionalId, firmId, rating, comment, date

let seq = 0;

function createReview(data = {}) {
  return {
    id: data.id || `review-${Date.now()}-${++seq}`,
    clientId: data.clientId || null,
    clientName: data.clientName || '',
    professionalId: data.professionalId || null,
    firmId: data.firmId || null,
    rating: typeof data.rating === 'number' ? data.rating : 0,
    comment: data.comment || '',
    date: data.date || new Date().toISOString().slice(0, 10),
  };
}

module.exports = { createReview };
