'use client';

import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  Download,
  Upload,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import { formatDate } from '@/utils/formatters';

const DEFAULT_FILES = [
  {
    id: 'demo-file-1',
    name: 'engagement-letter.pdf',
    size: 184000,
    type: 'application/pdf',
    uploadedAt: '2025-04-12T09:00:00.000Z',
  },
  {
    id: 'demo-file-2',
    name: 'case-summary.docx',
    size: 56000,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uploadedAt: '2025-04-20T09:00:00.000Z',
  },
  {
    id: 'demo-file-3',
    name: 'fee-statement.xlsx',
    size: 42000,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2025-05-02T09:00:00.000Z',
  },
];

function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(file) {
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return { Icon: FileText, color: 'bg-red-100 text-red-600' };
  }
  if (
    type.includes('spreadsheet') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.csv')
  ) {
    return { Icon: FileSpreadsheet, color: 'bg-emerald-100 text-emerald-600' };
  }
  if (type.includes('image') || /\.(png|jpe?g|gif)$/.test(name)) {
    return { Icon: FileImage, color: 'bg-amber-100 text-amber-600' };
  }
  if (type.includes('word') || name.endsWith('.docx')) {
    return { Icon: FileText, color: 'bg-blue-100 text-blue-600' };
  }
  return { Icon: FileIcon, color: 'bg-slate-100 text-slate-600' };
}

/**
 * FileManager — document grid with upload (placeholder) and per-file download.
 * Props: { files }
 */
export default function FileManager({ files }) {
  const list = files && files.length > 0 ? files : DEFAULT_FILES;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Documents</h3>
          <p className="text-sm text-slate-500">
            {list.length} {list.length === 1 ? 'file' : 'files'}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Upload size={15} />
          Upload document
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<FileIcon size={24} />}
          title="No documents yet"
          description="Uploaded files will be listed here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((file) => {
            const { Icon, color } = iconFor(file);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatSize(file.size)} · {formatDate(file.uploadedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Download ${file.name}`}
                  className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <Download size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
