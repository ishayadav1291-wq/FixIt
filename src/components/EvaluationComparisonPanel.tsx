import React, { useState } from 'react';
import { SqliteRunRecord } from '../types/fixit';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface EvaluationComparisonPanelProps {
  runs: SqliteRunRecord[];
  onSelectInstance: (instanceId: string) => void;
}

export const EvaluationComparisonPanel: React.FC<EvaluationComparisonPanelProps> = ({
  runs,
  onSelectInstance,
}) => {
  const [showFullTable, setShowFullTable] = useState(false);

  const totalTasks = runs.length;
  const multiResolvedCount = runs.filter((r) => r.multiAgentResolved).length;
  const singleResolvedCount = runs.filter((r) => r.singleAgentResolved).length;

  const multiRate = ((multiResolvedCount / totalTasks) * 100).toFixed(0);
  const singleRate = ((singleResolvedCount / totalTasks) * 100).toFixed(0);

  return (
    <section className="rounded-lg border border-white/10 bg-[#11131A] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Why Use 5 Agents Instead of 1 AI? (Tested on {totalTasks} Real Bugs)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Both use the exact same free local AI model (<code className="font-mono text-zinc-200">qwen2.5-coder:3b</code>).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFullTable(!showFullTable)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
        >
          <span>{showFullTable ? 'Hide 25-Bug Table' : 'See All 25 Bugs'}</span>
          {showFullTable ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 3 Simple Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border border-white/10 bg-[#0B0C10] p-4">
          <div className="text-xs text-zinc-400">1. Bugs Fixed</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{multiRate}%</span>
            <span className="text-xs text-zinc-500">vs. {singleRate}% Single AI</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1.5">
            5-Agent Team fixed <strong>{multiResolvedCount} of {totalTasks}</strong> bugs (Single AI only fixed {singleResolvedCount}).
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-[#0B0C10] p-4">
          <div className="text-xs text-zinc-400">2. Self-Correcting Retry Loop</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">Up to 5 Tries</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1.5">
            If the first fix fails the test, it automatically learns from the error and tries again.
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-[#0B0C10] p-4">
          <div className="text-xs text-zinc-400">3. Anti-Cheat Safety Check</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-400">100% Safe</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1.5">
            Blocks the AI if it ever tries to cheat by editing or deleting your test files.
          </p>
        </div>
      </div>

      {showFullTable && (
        <div className="border-t border-white/10 pt-4 overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400">
                <th className="py-2 px-3">Bug Name</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">5-Agent Team</th>
                <th className="py-2 px-3">Tries</th>
                <th className="py-2 px-3">Single AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {runs.map((r) => (
                <tr
                  key={r.runId}
                  onClick={() => onSelectInstance(r.instanceId)}
                  className="hover:bg-white/5 cursor-pointer"
                >
                  <td className="py-2 px-3 font-mono text-zinc-200">{r.instanceId}</td>
                  <td className="py-2 px-3 text-zinc-400">{r.category}</td>
                  <td className="py-2 px-3">
                    <span className={r.multiAgentResolved ? 'text-emerald-400' : 'text-zinc-500'}>
                      {r.multiAgentResolved ? '✓ Fixed' : '✗ Not Fixed'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-zinc-400">{r.multiAgentAttempts}</td>
                  <td className="py-2 px-3">
                    <span className={r.singleAgentResolved ? 'text-zinc-300' : 'text-zinc-500'}>
                      {r.singleAgentResolved ? '✓ Fixed' : '✗ Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
