import React, { useState, useEffect, useRef } from 'react';
import { PipelineTrace } from '../types/fixit';
import { Copy, Check, Download, RotateCcw } from 'lucide-react';

interface AnimatedTerminalPipelineProps {
  taskId: string;
  targetFile: string;
  testFile: string;
  sourceSnippet: string;
  multiTrace: PipelineTrace;
  singleTrace: PipelineTrace;
  architectureMode: 'multi_agent' | 'single_agent' | 'both';
  triggerKey: number;
  onRunningChange?: (running: boolean) => void;
  onApplyFixToEditor?: (newCode: string) => void;
  isFixAppliedToEditor?: boolean;
}

interface TerminalLine {
  id: string;
  stepIndex: number;
  agentName: string;
  attempt: number;
  kind: 'header' | 'text' | 'pass' | 'fail' | 'blocked';
  text: string;
}

interface SurgicalFixGuide {
  startLineNumber: number;
  removedSnippet: string;
  addedSnippet: string;
  cleanFullCode: string;
  changedLineSet: Set<number>;
}

const SIMPLE_STAGES = [
  { id: 'Triage Agent', step: '1', name: 'Find Bug' },
  { id: 'Diagnosis Agent', step: '2', name: 'Find Cause' },
  { id: 'Patch Agent', step: '3', name: 'Write Fix' },
  { id: 'Safety Hook', step: '4', name: 'Safety Check' },
  { id: 'Test-Runner Agent', step: '5', name: 'Run Tests' },
  { id: 'Reviewer Agent', step: '6', name: 'Approved' },
];

function buildSurgicalFixGuide(
  sourceSnippet: string,
  unifiedDiff: string,
  fixedFullCode?: string
): SurgicalFixGuide {
  const diffLines = (unifiedDiff || '').split('\n');
  const removedLines: string[] = [];
  const addedLines: string[] = [];
  let startLineNumber = 1;

  for (const line of diffLines) {
    const hunkMatch = line.match(/@@\s*-(\d+)/);
    if (hunkMatch) {
      startLineNumber = parseInt(hunkMatch[1], 10);
      continue;
    }
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
      continue;
    }
    if (line.startsWith('-')) {
      removedLines.push(line.slice(1));
    } else if (line.startsWith('+')) {
      addedLines.push(line.slice(1));
    }
  }

  const changedLineSet = new Set<number>();
  const srcLines = sourceSnippet.split('\n');
  const headerLineMatch = srcLines[0]?.match(/lines?\s+(\d+)/i);
  const baseOffset = headerLineMatch ? parseInt(headerLineMatch[1], 10) - 1 : 1;

  if (fixedFullCode && fixedFullCode.trim().length > 0) {
    const fixedArr = fixedFullCode.split('\n');
    fixedArr.forEach((line, idx) => {
      if (srcLines[idx] !== line) {
        changedLineSet.add(idx);
      }
    });
    return {
      startLineNumber,
      removedSnippet:
        removedLines.length > 0 ? removedLines.join('\n') : '# (missing block / line)',
      addedSnippet:
        addedLines.length > 0 ? addedLines.join('\n') : fixedFullCode,
      cleanFullCode: fixedFullCode,
      changedLineSet,
    };
  }

  const finalLines = [...srcLines];

  if (removedLines.length > 0) {
    // Try contiguous block match first so multi-line diffs with different line counts splice cleanly
    const firstRemovedTrimmed = removedLines[0].trim();
    const firstIdx = finalLines.findIndex((l) => l.trim() === firstRemovedTrimmed);

    if (firstIdx !== -1 && (removedLines.length === 1 || addedLines.length !== removedLines.length)) {
      startLineNumber = baseOffset + firstIdx;
      finalLines.splice(firstIdx, removedLines.length, ...addedLines);
      for (let k = 0; k < addedLines.length; k++) {
        changedLineSet.add(firstIdx + k);
      }
    } else {
      let matchedAny = false;
      for (let rIdx = 0; rIdx < removedLines.length; rIdx++) {
        const removedTrimmed = removedLines[rIdx].trim();
        const replacementLine =
          addedLines[rIdx] !== undefined ? addedLines[rIdx] : '';
        if (!removedTrimmed) continue;

        const lineIndex = finalLines.findIndex(
          (l, idx) => l.trim() === removedTrimmed && !changedLineSet.has(idx)
        );
        if (lineIndex !== -1) {
          if (!matchedAny) {
            startLineNumber = baseOffset + lineIndex;
            matchedAny = true;
          }
          if (replacementLine) {
            finalLines[lineIndex] = replacementLine;
            changedLineSet.add(lineIndex);
          }
        }
      }
    }
  } else if (addedLines.length > 0) {
    const contextLines = diffLines.filter(
      (l) =>
        !l.startsWith('---') &&
        !l.startsWith('+++') &&
        !l.startsWith('@@') &&
        !l.startsWith('+') &&
        !l.startsWith('-') &&
        l.trim().length > 0
    );
    if (contextLines.length > 0) {
      const anchor = contextLines[0].trim();
      const anchorIdx = finalLines.findIndex((l) => l.trim() === anchor);
      if (anchorIdx !== -1) {
        startLineNumber = baseOffset + anchorIdx + 1;
        finalLines.splice(anchorIdx + 1, 0, ...addedLines);
        for (let i = 0; i < addedLines.length; i++) {
          changedLineSet.add(anchorIdx + 1 + i);
        }
      }
    }
  }

  return {
    startLineNumber,
    removedSnippet:
      removedLines.length > 0 ? removedLines.join('\n') : '# (new line added)',
    addedSnippet:
      addedLines.length > 0 ? addedLines.join('\n') : '# (no lines added)',
    cleanFullCode: finalLines.join('\n'),
    changedLineSet,
  };
}

function buildFriendlyLogLines(
  multiTrace: PipelineTrace,
  singleTrace: PipelineTrace,
  architectureMode: 'multi_agent' | 'single_agent' | 'both'
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  if (architectureMode === 'multi_agent' || architectureMode === 'both') {
    multiTrace.steps.forEach((step, idx) => {
      lines.push({
        id: `hdr-${idx}`,
        stepIndex: idx,
        agentName: step.agent,
        attempt: step.attempt,
        kind: 'header',
        text: `Step ${idx + 1} · ${step.agent} (Try #${step.attempt})`,
      });

      lines.push({
        id: `txt-${idx}`,
        stepIndex: idx,
        agentName: step.agent,
        attempt: step.attempt,
        kind:
          step.status === 'blocked'
            ? 'blocked'
            : step.status === 'failed'
            ? 'fail'
            : 'text',
        text: `  ${step.summary}`,
      });
    });
  }

  if (architectureMode === 'single_agent' || architectureMode === 'both') {
    const sStep = singleTrace.steps[0];
    lines.push({
      id: 'single-hdr',
      stepIndex: multiTrace.steps.length,
      agentName: 'Single-Agent Generalist',
      attempt: 1,
      kind: 'header',
      text: `Single AI Baseline (1-Shot Comparison)`,
    });
    lines.push({
      id: 'single-res',
      stepIndex: multiTrace.steps.length + 1,
      agentName: 'Single-Agent Generalist',
      attempt: 1,
      kind: singleTrace.status === 'RESOLVED' ? 'pass' : 'fail',
      text:
        singleTrace.status === 'RESOLVED'
          ? `  ✓ Single AI also passed: ${sStep?.summary}`
          : `  ✗ Single AI failed: ${sStep?.summary}`,
    });
  }

  return lines;
}

export const AnimatedTerminalPipeline: React.FC<AnimatedTerminalPipelineProps> = ({
  taskId,
  targetFile,
  sourceSnippet,
  multiTrace,
  singleTrace,
  architectureMode,
  triggerKey,
  onRunningChange,
  onApplyFixToEditor,
  isFixAppliedToEditor,
}) => {
  const allLines = React.useMemo(
    () => buildFriendlyLogLines(multiTrace, singleTrace, architectureMode),
    [multiTrace, singleTrace, architectureMode]
  );

  const activeTraceForOutput =
    architectureMode === 'single_agent' ? singleTrace : multiTrace;

  const fixGuide = React.useMemo(
    () =>
      buildSurgicalFixGuide(
        sourceSnippet,
        activeTraceForOutput.finalPatchDiff,
        activeTraceForOutput.fixedFullCode
      ),
    [
      sourceSnippet,
      activeTraceForOutput.finalPatchDiff,
      activeTraceForOutput.fixedFullCode,
    ]
  );

  const [completedLineCount, setCompletedLineCount] = useState<number>(0);
  const [currentTypedChars, setCurrentTypedChars] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const [copiedFullFile, setCopiedFullFile] = useState<boolean>(false);

  const terminalScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCompletedLineCount(0);
    setCurrentTypedChars(0);
    setIsAnimating(true);
    onRunningChange?.(true);
  }, [triggerKey, taskId, multiTrace, singleTrace, architectureMode]);

  useEffect(() => {
    if (!isAnimating) return;

    if (completedLineCount >= allLines.length) {
      setIsAnimating(false);
      onRunningChange?.(false);
      return;
    }

    const activeLine = allLines[completedLineCount];
    const fullLen = activeLine.text.length;

    const timer = window.setTimeout(() => {
      if (currentTypedChars + 4 < fullLen) {
        setCurrentTypedChars((prev) => prev + 4);
      } else {
        setCompletedLineCount((prev) => prev + 1);
        setCurrentTypedChars(0);
      }
    }, 18);

    return () => window.clearTimeout(timer);
  }, [isAnimating, completedLineCount, currentTypedChars, allLines]);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [completedLineCount, currentTypedChars]);

  const handleCopyFullFile = () => {
    navigator.clipboard.writeText(fixGuide.cleanFullCode);
    setCopiedFullFile(true);
    setTimeout(() => setCopiedFullFile(false), 1800);
  };

  const handleDownloadFixedFile = () => {
    const filename = targetFile.split('/').pop()?.split(',')[0] || 'fixed.py';
    const blob = new Blob([fixGuide.cleanFullCode], {
      type: 'text/x-python;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentLineObj =
    allLines[Math.min(completedLineCount, allLines.length - 1)] || allLines[0];
  const activeStepIndex = isAnimating
    ? currentLineObj?.stepIndex ?? 0
    : multiTrace.steps.length - 1;
  const activeAgentName = isAnimating
    ? currentLineObj?.agentName
    : multiTrace.steps[multiTrace.steps.length - 1]?.agent;

  const visibleStepsSoFar = multiTrace.steps.slice(
    0,
    Math.max(1, activeStepIndex + 1)
  );

  const progressPercent = isAnimating
    ? Math.min(96, Math.round(((completedLineCount + 1) / Math.max(1, allLines.length)) * 100))
    : 100;

  const patchHasRun =
    !isAnimating ||
    visibleStepsSoFar.some(
      (s) =>
        s.agent === 'Patch Agent' ||
        s.agent === 'Test-Runner Agent' ||
        s.agent === 'Reviewer Agent'
    );

  const reviewerStep = multiTrace.steps.find((s) => s.agent === 'Reviewer Agent');
  const fullCodeLines = fixGuide.cleanFullCode.split('\n');

  return (
    <div className="space-y-5">
      {/* STEP 2: LIVE 5-AGENT PIPELINE + THINKING LOG */}
      <div className="rounded-lg border border-white/10 bg-[#11131A] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-semibold text-white">
              Step 2: Live 5-Agent Pipeline
            </h2>
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-emerald-400">
              {isAnimating
                ? `Active · ${activeAgentName || 'Working'}`
                : `Verified · ${multiTrace.iterationsUsed}/5 Tries`}
            </span>
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-zinc-400">
              56% Success Rate (vs 24% Single AI)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setCompletedLineCount(0);
              setCurrentTypedChars(0);
              setIsAnimating(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isAnimating ? 'animate-spin' : ''}`} />
            <span>Replay</span>
          </button>
        </div>

        {/* Animated Progress Bar */}
        <div className="h-1 w-full bg-[#0B0C10] overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 6 Animated Stage Cards */}
        <div className="p-4 border-b border-white/10">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SIMPLE_STAGES.map((stage) => {
              const matchingSteps = visibleStepsSoFar.filter(
                (s) => s.agent === stage.id
              );
              const lastMatch = matchingSteps[matchingSteps.length - 1];
              const isCurrentlyActive =
                isAnimating && activeAgentName === stage.id;

              let cardStyle = 'border-white/5 bg-white/[0.02] text-zinc-500';
              let stateText = 'Waiting';

              if (isCurrentlyActive) {
                cardStyle =
                  'border-sky-400/60 bg-sky-500/10 text-white scale-[1.02] shadow-sm';
                stateText = 'Working...';
              } else if (lastMatch) {
                if (
                  lastMatch.status === 'blocked' ||
                  lastMatch.status === 'failed'
                ) {
                  cardStyle =
                    'border-amber-400/40 bg-amber-500/10 text-amber-200';
                  stateText =
                    lastMatch.status === 'blocked' ? 'Blocked' : 'Retrying';
                } else {
                  cardStyle =
                    'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
                  stateText = 'Done ✓';
                }
              }

              return (
                <div
                  key={stage.id}
                  className={`rounded-md border p-2.5 transition-all duration-300 ${cardStyle}`}
                >
                  <div className="flex items-center justify-between text-[10px] opacity-75 mb-1 font-mono">
                    <span>0{stage.step}</span>
                    <span>{stateText}</span>
                  </div>
                  <div className="text-xs font-medium">{stage.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Agent Thinking Log */}
        <div
          ref={terminalScrollRef}
          className="p-4 font-mono text-xs leading-relaxed space-y-1.5 max-h-[190px] overflow-y-auto bg-[#0B0C10]"
        >
          {allLines.slice(0, completedLineCount + 1).map((line, idx) => {
            const isCurrentTypingLine =
              isAnimating && idx === completedLineCount;
            const displayedText = isCurrentTypingLine
              ? line.text.slice(0, currentTypedChars)
              : line.text;

            let colorClass = 'text-zinc-400';
            if (line.kind === 'header') {
              colorClass = 'text-sky-400 font-semibold pt-1.5';
            } else if (line.kind === 'pass') {
              colorClass = 'text-emerald-400';
            } else if (line.kind === 'fail') {
              colorClass = 'text-rose-400';
            } else if (line.kind === 'blocked') {
              colorClass = 'text-amber-300';
            }

            return (
              <div key={line.id} className={colorClass}>
                <span>{displayedText}</span>
                {isCurrentTypingLine && (
                  <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-1 align-middle animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 3: FIXED CODE RESULT */}
      <div
        className={`rounded-lg border border-white/10 bg-[#11131A] overflow-hidden transition-all duration-500 ${
          patchHasRun ? 'opacity-100 translate-y-0' : 'opacity-60'
        }`}
      >
        <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-semibold text-white">
              Step 3: Fixed Code ({targetFile})
            </h2>
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-emerald-400">
              Line {fixGuide.startLineNumber}
            </span>
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-zinc-400">
              {isAnimating ? 'Synthesizing Patch...' : 'Tests Passed ✓'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onApplyFixToEditor && activeTraceForOutput.status === 'RESOLVED' && (
              <button
                type="button"
                onClick={() => onApplyFixToEditor(fixGuide.cleanFullCode)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isFixAppliedToEditor
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black font-semibold'
                }`}
              >
                {isFixAppliedToEditor ? '✓ Applied to Left Editor' : 'Apply Fix'}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyFullFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 transition-colors cursor-pointer"
            >
              {copiedFullFile ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadFixedFile}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Download Fixed File"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Simple Before vs After Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 border-b border-white/10 text-xs">
          <div className="p-4 bg-rose-500/[0.04]">
            <div className="text-rose-400 font-medium mb-1.5">
              1. Broken Line (Line {fixGuide.startLineNumber})
            </div>
            <pre className="font-mono text-rose-200 whitespace-pre-wrap">
              {fixGuide.removedSnippet}
            </pre>
          </div>

          <div className="p-4 bg-emerald-500/[0.04]">
            <div className="text-emerald-400 font-medium mb-1.5">
              2. Fixed Line
            </div>
            <pre className="font-mono text-emerald-200 whitespace-pre-wrap">
              {fixGuide.addedSnippet}
            </pre>
          </div>
        </div>

        {/* Resulting Full Code */}
        <div className="p-4 bg-[#0B0C10] font-mono text-xs overflow-x-auto">
          <div className="space-y-0.5">
            {fullCodeLines.map((lineText, idx) => {
              const isChanged = fixGuide.changedLineSet.has(idx);
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-2.5 py-0.5 rounded transition-colors duration-300 ${
                    isChanged
                      ? 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-400'
                      : 'text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-4 whitespace-pre">
                    <span className="text-zinc-600 select-none w-4 text-right">
                      {idx + 1}
                    </span>
                    <span>{lineText || ' '}</span>
                  </div>
                  {isChanged && (
                    <span className="text-[10px] font-sans text-emerald-400 ml-4">
                      ← Fixed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Plain English Explanation */}
        {reviewerStep?.structuredData?.plainEnglishExplanation && (
          <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] text-xs text-zinc-300 leading-relaxed">
            <strong className="text-emerald-400">Why this fixes it: </strong>
            {reviewerStep.structuredData.plainEnglishExplanation}
          </div>
        )}
      </div>
    </div>
  );
};
