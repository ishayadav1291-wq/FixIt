import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  diff: string;
  title?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const lines = diff.split('\n');

  return (
    <div className="border border-slate-200 bg-[#0F172A] text-slate-100 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#1E293B] border-b border-slate-700/80 text-xs font-mono text-slate-300">
        <span>{title || 'Unified Diff (python difflib)'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded transition-colors whitespace-nowrap cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy diff</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        {lines.map((line, idx) => {
          let lineClass = 'text-slate-300';
          let bgClass = '';

          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass = 'text-slate-400 font-semibold';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-sky-400';
            bgClass = 'bg-sky-950/30';
          } else if (line.startsWith('+')) {
            lineClass = 'text-emerald-300';
            bgClass = 'bg-emerald-950/45';
          } else if (line.startsWith('-')) {
            lineClass = 'text-rose-300';
            bgClass = 'bg-rose-950/45';
          }

          return (
            <div
              key={idx}
              className={`px-2 py-0.5 whitespace-pre ${bgClass} ${lineClass}`}
            >
              {line || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
};
