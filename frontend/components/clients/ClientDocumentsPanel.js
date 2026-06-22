'use client';

// ClientDocumentsPanel — document upload + listing for one client,
// rendered on the manage page. Shows the entity-type catalog grouped
// by category; under each catalog row, lists the documents already
// uploaded for that key and offers an Upload button to add more.
//
// Honours the access model: a pro without granted access only ever
// sees their own uploads. The "Request access" button shows when the
// pro has no access yet; status pills show pending / denied / revoked.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Upload,
  Trash2,
  ExternalLink,
  Lock,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import {
  listForClient,
  uploadDocument,
  getDocumentUrl,
  deleteDocument,
  requestAccess,
  getProAccessForClient,
} from '@/services/clientDocumentService';

const CAT_LABEL = {
  kyc: 'KYC',
  registration: 'Registration',
  financial: 'Financial',
  compliance: 'Statutory',
};

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ClientDocumentsPanel({ clientUserId, requirements }) {
  const [docs, setDocs] = useState([]);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingKey, setUploadingKey] = useState(null);

  const load = useCallback(async () => {
    if (!clientUserId) return;
    setLoading(true);
    setError('');
    try {
      const [d, a] = await Promise.all([
        listForClient(clientUserId),
        getProAccessForClient(clientUserId),
      ]);
      setDocs(d);
      setAccess(a);
    } catch (err) {
      setError(err.message || 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, [clientUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const docsByKey = useMemo(() => {
    const map = new Map();
    for (const d of docs) {
      if (!map.has(d.docKey)) map.set(d.docKey, []);
      map.get(d.docKey).push(d);
    }
    return map;
  }, [docs]);

  async function handleUpload(docKey, label, file) {
    if (!file) return;
    setUploadingKey(docKey);
    setError('');
    try {
      await uploadDocument(clientUserId, file, { docKey, label });
      await load();
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleView(doc) {
    try {
      const out = await getDocumentUrl(doc.id);
      if (out && out.url) window.open(out.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'Could not open document.');
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.fileName || 'document'}"? This can't be undone.`)) return;
    try {
      await deleteDocument(doc.id);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  }

  async function handleRequestAccess() {
    try {
      await requestAccess(
        clientUserId,
        'Please share access to compliance documents.'
      );
      await load();
    } catch (err) {
      setError(err.message || 'Could not request access.');
    }
  }

  const accessStatus = access ? access.status : null;
  const documents = (requirements && requirements.documents) || [];
  const byCat = new Map();
  for (const d of documents) {
    const cat = d.category || 'other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(d);
  }
  const catOrder = ['kyc', 'registration', 'financial', 'compliance'];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Client documents
          </h3>
          <p className="text-xs text-slate-500">
            Upload, store on Profirmo's secure S3 bucket, view as
            presigned URL. Client controls who else can see them.
          </p>
        </div>
        <AccessBadge
          status={accessStatus}
          onRequest={handleRequestAccess}
        />
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : !requirements ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          Set an entity type on the compliance profile above to see the
          document checklist.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {catOrder
            .filter((c) => byCat.has(c))
            .map((cat) => (
              <div key={cat}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {CAT_LABEL[cat] || cat}
                </p>
                <ul className="space-y-2">
                  {byCat.get(cat).map((d) => {
                    const uploaded = docsByKey.get(d.key) || [];
                    return (
                      <li
                        key={d.key}
                        className="rounded-lg border border-slate-200 bg-white p-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={[
                                  'inline-block h-2 w-2 shrink-0 rounded-full',
                                  d.mandatory ? 'bg-red-500' : 'bg-slate-300',
                                ].join(' ')}
                                title={d.mandatory ? 'Mandatory' : 'Optional'}
                              />
                              <p className="text-sm font-medium text-slate-800">
                                {d.label}
                              </p>
                              {uploaded.length > 0 && (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  {uploaded.length} uploaded
                                </span>
                              )}
                            </div>
                            {d.description && (
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {d.description}
                              </p>
                            )}
                          </div>
                          <UploadButton
                            disabled={uploadingKey === d.key}
                            isUploading={uploadingKey === d.key}
                            onFile={(f) => handleUpload(d.key, d.label, f)}
                          />
                        </div>

                        {uploaded.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {uploaded.map((u) => (
                              <li
                                key={u.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-slate-700">
                                    {u.fileName || '(file)'}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {u.mimeType} · {fmtSize(u.size)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleView(u)}
                                    className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                    title="Open"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(u)}
                                    className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

function UploadButton({ disabled, isUploading, onFile }) {
  return (
    <label
      className={[
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
          : 'cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
      ].join(' ')}
    >
      <Upload size={12} />
      {isUploading ? 'Uploading…' : 'Upload'}
      <input
        type="file"
        className="hidden"
        disabled={disabled}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function AccessBadge({ status, onRequest }) {
  if (status === 'granted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <ShieldCheck size={12} />
        Full access granted
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        <Clock size={12} />
        Access pending
      </span>
    );
  }
  if (status === 'denied' || status === 'revoked') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          <Lock size={12} />
          {status === 'denied' ? 'Denied' : 'Revoked'}
        </span>
        <Button size="sm" variant="outline" onClick={onRequest}>
          Re-request
        </Button>
      </div>
    );
  }
  // No access record yet — offer Request.
  return (
    <Button size="sm" variant="outline" onClick={onRequest}>
      <Lock size={12} />
      Request full access
    </Button>
  );
}
