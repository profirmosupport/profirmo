'use client';

// FileUpload — reusable document uploader. Renders a drop-zone / click area
// when empty, and a file card (icon or thumbnail + Preview/Replace/Remove)
// once a file URL is stored. On a successful upload it calls onChange(url)
// with the new RELATIVE url; Remove calls onChange('').

import { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Eye,
  RefreshCw,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import DocumentPreviewModal from '@/components/common/DocumentPreviewModal';
import {
  uploadFile,
  deleteFile,
  validateFile,
  resolveFileUrl,
} from '@/services/fileService';

/** Derive a friendly file name from a stored URL. */
function fileNameFromUrl(url) {
  if (!url) return '';
  try {
    const clean = url.split('?')[0].split('#')[0];
    const last = clean.substring(clean.lastIndexOf('/') + 1);
    return decodeURIComponent(last) || 'Uploaded file';
  } catch {
    return 'Uploaded file';
  }
}

/** True when the URL/name looks like an image. */
function urlIsImage(url) {
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url || '');
}

/**
 * FileUpload
 * Props:
 *  - label: field label
 *  - value: stored file URL (relative or absolute) — '' when empty
 *  - onChange: (url) => void — receives the new relative url, or '' on remove
 *  - category: backend file category string
 *  - accept: input accept attribute (default 'image/*,application/pdf')
 *  - hint: helper text shown under the field
 */
export default function FileUpload({
  label,
  value,
  onChange,
  category,
  // When set, the upload is filed under the given case (S3 key prefix:
  // `case-files/<caseId>/`). Required by the backend for
  // category="case_note" / "booking_note"; ignored for other categories.
  caseId,
  accept = 'image/*,application/pdf',
  hint,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Track the id of the most recent upload so Remove can best-effort delete it.
  const [fileMeta, setFileMeta] = useState({ id: null, mimeType: '', name: '' });

  const hasFile = Boolean(value);
  const displayName = fileMeta.name || fileNameFromUrl(value);
  const isImage = fileMeta.mimeType
    ? fileMeta.mimeType.startsWith('image/')
    : urlIsImage(value);

  function openPicker() {
    setError('');
    if (inputRef.current) inputRef.current.click();
  }

  async function handleFiles(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    setError('');
    setSuccess(false);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      const data = await uploadFile(file, category, { caseId });
      setFileMeta({
        id: data.id || null,
        mimeType: data.mimeType || file.type || '',
        name: data.originalName || file.name || '',
      });
      setSuccess(true);
      // Pass the resolved metadata alongside the URL so callers that
      // care about the original filename (e.g. note/update attachment
      // lists) can render a real name instead of having to split the
      // signed URL. Existing callers ignore the extra arg.
      const meta = {
        name: data.originalName || file.name || '',
        mimeType: data.mimeType || file.type || '',
        size: data.size || file.size || 0,
        id: data.id || null,
      };
      if (typeof onChange === 'function') onChange(data.url || '', meta);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset the input so picking the same file again still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  async function handleRemove() {
    const idToDelete = fileMeta.id;
    setSuccess(false);
    setError('');
    setFileMeta({ id: null, mimeType: '', name: '' });
    if (typeof onChange === 'function') onChange('');
    // Best-effort backend delete — ignore any failure.
    if (idToDelete) {
      try {
        await deleteFile(idToDelete);
      } catch {
        /* ignore — the field is already cleared */
      }
    }
  }

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {hasFile ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-3">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveFileUrl(value)}
                alt={displayName}
                className="h-12 w-12 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-600">
                {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">Uploaded</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={openPicker}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed ${
            dragOver
              ? 'border-amber-400 bg-amber-50'
              : 'border-slate-300 bg-slate-50 hover:border-amber-300 hover:bg-amber-50/50'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              <span className="text-sm font-medium text-slate-600">
                Uploading…
              </span>
            </>
          ) : (
            <>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-600">
                <UploadCloud size={20} />
              </span>
              <span className="text-sm font-medium text-slate-700">
                Click to upload
                <span className="font-normal text-slate-500">
                  {' '}
                  or drag &amp; drop
                </span>
              </span>
              <span className="text-xs text-slate-400">
                JPEG, PNG, WEBP, GIF or PDF · up to 10 MB
              </span>
            </>
          )}
        </button>
      )}

      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : success && hasFile ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          File uploaded.
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        url={value}
        name={displayName}
        mimeType={fileMeta.mimeType}
      />
    </div>
  );
}
