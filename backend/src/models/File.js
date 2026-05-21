// Future DB schema (MongoDB/PostgreSQL):
//   id, name, size, type, caseId, uploadedBy, uploadedAt, url
// Represents an attachment, typically embedded inside a Case's files[] array.

let seq = 0;

function createFile(data = {}) {
  return {
    id: data.id || `file-${Date.now()}-${++seq}`,
    name: data.name || '',
    size: typeof data.size === 'number' ? data.size : 0,
    type: data.type || 'application/octet-stream',
    caseId: data.caseId || null,
    uploadedBy: data.uploadedBy || null,
    url: data.url || null,
    uploadedAt: data.uploadedAt || new Date().toISOString(),
  };
}

module.exports = { createFile };
