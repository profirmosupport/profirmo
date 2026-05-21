import { FileText } from 'lucide-react';
import Card from '@/components/common/Card';

const PLACEHOLDER_LINES = [
  { speaker: 'Professional', text: 'Hello, thanks for joining. How can I help you today?' },
  { speaker: 'Client', text: 'Hi, I wanted to discuss the documents you asked for.' },
  { speaker: 'Professional', text: 'Of course. Let us go through them one by one.' },
  { speaker: 'Client', text: 'I have the agreement and the supporting proofs ready.' },
  { speaker: 'Professional', text: 'That is helpful. I will note the key points as we talk.' },
];

/**
 * TranscriptPanel — scrollable live transcript panel.
 *
 * Props: { transcript } — optional array of { speaker, text }
 */
export default function TranscriptPanel({ transcript }) {
  const lines =
    Array.isArray(transcript) && transcript.length > 0
      ? transcript
      : PLACEHOLDER_LINES;

  return (
    <Card padding={false}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <FileText size={16} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">Live transcript</h3>
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-3">
        {lines.map((line, i) => {
          const isClient = line.speaker === 'Client';
          return (
            <div key={i} className="text-sm">
              <p
                className={`text-xs font-semibold ${
                  isClient ? 'text-slate-500' : 'text-blue-600'
                }`}
              >
                {line.speaker}
              </p>
              <p className="mt-0.5 text-slate-700">{line.text}</p>
            </div>
          );
        })}
      </div>

      <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
        AI transcription integration placeholder.
      </p>
    </Card>
  );
}
