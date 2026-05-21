'use client';

import { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
} from 'lucide-react';
import { getInitials } from '@/utils/formatters';

/**
 * CallRoom — video call stage with placeholder controls.
 *
 * Props: { professional, client, onEndCall }
 */
export default function CallRoom({ professional, client, onEndCall }) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const proName = professional ? professional.name : 'Professional';
  const clientName = client ? client.name : 'You';

  const controlBase =
    'flex h-12 w-12 items-center justify-center rounded-full transition-colors';

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-sm">
        {/* Main stage */}
        <div className="flex aspect-video w-full flex-col items-center justify-center">
          <span className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-600 text-3xl font-bold text-white sm:h-32 sm:w-32 sm:text-4xl">
            {getInitials(proName)}
          </span>
          <p className="mt-4 text-lg font-semibold text-white">{proName}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
          {professional && professional.professionType && (
            <p className="mt-2 text-xs text-slate-400">
              {professional.professionType}
            </p>
          )}
        </div>

        {/* Self-view tile */}
        <div className="absolute bottom-4 right-4 flex h-24 w-32 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 sm:h-28 sm:w-40">
          {cameraOn ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-600 text-sm font-semibold text-white">
              {getInitials(clientName)}
            </span>
          ) : (
            <VideoOff size={22} className="text-slate-500" />
          )}
          <span className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-300">
            {!micOn && <MicOff size={11} className="text-red-400" />}
            You
          </span>
        </div>

        {sharing && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
            <MonitorUp size={12} />
            Sharing screen
          </span>
        )}
      </div>

      {/* Control bar */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setMicOn((v) => !v)}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          className={`${controlBase} ${
            micOn
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
        >
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button
          type="button"
          onClick={() => setCameraOn((v) => !v)}
          aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
          className={`${controlBase} ${
            cameraOn
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
        >
          {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button
          type="button"
          onClick={() => setSharing((v) => !v)}
          aria-label="Share screen"
          className={`${controlBase} ${
            sharing
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <MonitorUp size={20} />
        </button>
        <button
          type="button"
          onClick={onEndCall}
          aria-label="End call"
          className={`${controlBase} w-auto gap-2 bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700`}
        >
          <PhoneOff size={18} />
          End call
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Video/audio calling integration placeholder.
      </p>
    </div>
  );
}
