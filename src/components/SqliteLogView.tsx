import React, { useState } from 'react';
import { SqliteRunRecord } from '../types/fixit';
import { Download } from 'lucide-react';

interface SqliteLogViewProps {
  runs: SqliteRunRecord[];
  onLoadFeaturedTask: (instanceId: string) => void;
  onExportCsv: () => void;
}

export const SqliteLogView: React.FC<SqliteLogViewProps> = ({
  runs,
  onLoadFeaturedTask,
  onExportCsv,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'multi_only_wins' | 'safety_blocked'>('all');

  const filteredRuns = runs.filter((r) => {
    if (filterMode === 'multi_only_wins') {
      return r.multiAgentResolved && !r.singleAgentResolved;
    }
    if (filterMode === 'safety_blocked') {
      return r.safetyHookTriggered;
    }
    return true;
  });

  return (
    <div className="border border-white/[0.08] bg-[#0E1017]">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400">SQLITE3 // FIXIT_RESULTS.DB</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{filteredRuns.length} RECORDS</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'ALL (25)' },
            { id: 'multi_only_wins', label: '5-AGENT WINS ONLY (8)' },
            { id: 'safety_blocked', label: 'SAFETY HOOK TRIGGERS (2)' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterMode(btn.id as any)}
              className={`px-3 py-1.5 text-[11px] border transition-colors cursor-pointer ${
                filterMode === btn.id
                  ? 'bg-white text-black border-white font-semibold'
                  : 'bg-transparent text-zinc-400 border-white/[0.08] hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-[#090A0F] text-zinc-500 text-[10px] uppercase">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">INSTANCE_ID</th>
              <th className="py-3 px-4">CATEGORY</th>
              <th className="py-3 px-4">5-AGENT</th>
              <th className="py-3 px-4">TRIES</th>
              <th className="py-3 px-4">SINGLE-AGENT</th>
              <th className="py-3 px-4">SAFETY</th>
              <th className="py-3 px-4 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {filteredRuns.map((row) => (
              <tr key={row.runId} className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-4 text-zinc-600">#{row.runId}</td>
                <td className="py-2.5 px-4 text-zinc-200">{row.instanceId}</td>
                <td className="py-2.5 px-4 text-zinc-500">{row.category}</td>
                <td className="py-2.5 px-4">
                  <span
                    className={
                      row.multiAgentResolved ? 'text-emerald-400' : 'text-zinc-600'
                    }
                  >
                    {row.multiAgentResolved ? 'RESOLVED' : 'UNRESOLVED'}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-zinc-400">
                  {row.multiAgentAttempts}/5
                </td>
                <td className="py-2.5 px-4">
                  <span
                    className={
                      row.singleAgentResolved ? 'text-zinc-300' : 'text-zinc-600'
                    }
                  >
                    {row.singleAgentResolved ? 'RESOLVED' : 'FAILED'}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  {row.safetyHookTriggered ? (
                    <span className="text-amber-400">BLOCKED EDIT</span>
                  ) : (
                    <span className="text-zinc-600">CLEAN</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onLoadFeaturedTask(row.instanceId)}
                    className="text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    [LOAD]
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
