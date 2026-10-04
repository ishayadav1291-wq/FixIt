import React from 'react';
import { AgentName, AgentStepOutput } from '../types/fixit';
import { RotateCcw, ArrowRight } from 'lucide-react';

interface PipelineGraphBarProps {
  visibleSteps: AgentStepOutput[];
  isRunning: boolean;
  maxAttempts: number;
  currentAttempt: number;
  status: 'RESOLVED' | 'UNRESOLVED' | 'BLOCKED_SAFETY' | 'RUNNING';
}

const PIPELINE_NODES: { key: AgentName; role: string }[] = [
  { key: 'Triage Agent', role: 'Classify & locate' },
  { key: 'Diagnosis Agent', role: 'Root-cause hypothesis' },
  { key: 'Patch Agent', role: 'Minimal difflib patch' },
  { key: 'Safety Hook', role: 'Block test-file edits' },
  { key: 'Test-Runner Agent', role: 'Docker pytest sandbox' },
  { key: 'Reviewer Agent', role: 'Verify & explain' },
];

export const PipelineGraphBar: React.FC<PipelineGraphBarProps> = ({
  visibleSteps,
  isRunning,
  maxAttempts,
  currentAttempt,
  status,
}) => {
  const latestStep = visibleSteps[visibleSteps.length - 1];

  const getNodeState = (nodeKey: AgentName) => {
    const matching = visibleSteps.filter((s) => s.agent === nodeKey);
    if (matching.length === 0) return 'idle';
    const last = matching[matching.length - 1];
    if (isRunning && latestStep?.agent === nodeKey) return 'active';
    if (last.status === 'blocked') return 'blocked';
    if (last.status === 'failed') return 'failed';
    return 'completed';
  };

  const hasRetryLoopOccurred = currentAttempt > 1;

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">LangGraph Orchestrator State</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            Attempt {currentAttempt} of {maxAttempts}
          </span>
          {hasRetryLoopOccurred && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <RotateCcw className="w-3 h-3" />
                Retry feedback loop active (Test-Runner → Diagnosis)
              </span>
            </>
          )}
        </div>
        <div className="font-mono text-xs">
          {status === 'RUNNING' && (
            <span className="text-blue-700 font-medium">Status: Executing pipeline...</span>
          )}
          {status === 'RESOLVED' && (
            <span className="text-emerald-700 font-semibold">Outcome: RESOLVED</span>
          )}
          {status === 'UNRESOLVED' && (
            <span className="text-rose-700 font-semibold">Outcome: UNRESOLVED</span>
          )}
          {status === 'BLOCKED_SAFETY' && (
            <span className="text-amber-800 font-semibold">Outcome: SAFETY HOOK INTERCEPTED</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {PIPELINE_NODES.map((node, index) => {
          const state = getNodeState(node.key);
          const count = visibleSteps.filter((s) => s.agent === node.key).length;

          let borderClass = 'border-slate-200 bg-slate-50/60 text-slate-500';
          let stateLabel = 'Pending';
          let stateColor = 'text-slate-400';

          if (state === 'active') {
            borderClass = 'border-blue-600 bg-blue-50/40 text-slate-900';
            stateLabel = 'Running';
            stateColor = 'text-blue-700 font-semibold';
          } else if (state === 'completed') {
            borderClass = 'border-slate-300 bg-white text-slate-900';
            stateLabel = count > 1 ? `Done (${count}x)` : 'Done';
            stateColor = 'text-emerald-700 font-medium';
          } else if (state === 'failed') {
            borderClass = 'border-rose-300 bg-rose-50/30 text-slate-900';
            stateLabel = 'Failed → Retry';
            stateColor = 'text-rose-700 font-medium';
          } else if (state === 'blocked') {
            borderClass = 'border-amber-400 bg-amber-50/40 text-slate-900';
            stateLabel = 'Blocked Edit';
            stateColor = 'text-amber-800 font-semibold';
          }

          return (
            <div key={node.key} className="relative flex items-stretch">
              <div
                className={`flex-1 border rounded p-2.5 transition-colors ${borderClass}`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400 tabular-nums">0{index + 1}</span>
                  <span className={`tabular-nums ${stateColor}`}>{stateLabel}</span>
                </div>
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {node.key}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {node.role}
                </div>
              </div>
              {index < PIPELINE_NODES.length - 1 && (
                <div className="hidden lg:flex items-center justify-center px-0.5 text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
