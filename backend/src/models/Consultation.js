// Future DB schema (MongoDB/PostgreSQL):
//   id, bookingId, clientId, professionalId, callStatus, recordingUrl,
//   transcript, notes, startedAt, endedAt, durationMinutes, cost
// callStatus: 'scheduled' | 'ongoing' | 'ended'

let seq = 0;

function createConsultation(data = {}) {
  return {
    id: data.id || `consult-${Date.now()}-${++seq}`,
    bookingId: data.bookingId || null,
    clientId: data.clientId || null,
    professionalId: data.professionalId || null,
    callStatus: data.callStatus || 'scheduled',
    recordingUrl: data.recordingUrl || null,
    transcript: data.transcript || null,
    notes: data.notes || '',
    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,
    durationMinutes:
      typeof data.durationMinutes === 'number' ? data.durationMinutes : 0,
    cost: typeof data.cost === 'number' ? data.cost : 0,
  };
}

module.exports = { createConsultation };
