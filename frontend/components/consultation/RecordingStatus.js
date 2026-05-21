'use client';

import { Circle } from 'lucide-react';

/**
 * RecordingStatus — pill showing whether the call is being recorded.
 *
 * Props: { recording }
 */
export default function RecordingStatus({ recording }) {
  return (
    <div>
      {recording ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
          </span>
          Recording
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          <Circle size={8} className="fill-slate-400 text-slate-400" />
          Not recording
        </span>
      )}
      <p className="mt-1.5 text-xs text-slate-400">
        Call recording integration placeholder.
      </p>
    </div>
  );
}
