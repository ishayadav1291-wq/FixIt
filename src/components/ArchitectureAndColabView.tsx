import React, { useState } from 'react';
import { RulesConfig } from '../types/fixit';
import { PYTHON_PROJECT_FILES } from '../data/swebenchTasks';
import { Copy, Check, Download } from 'lucide-react';

interface ArchitectureAndColabViewProps {
  rules: RulesConfig;
  onUpdateRules: (updated: RulesConfig) => void;
}

export const ArchitectureAndColabView: React.FC<ArchitectureAndColabViewProps> = ({
  rules,
  onUpdateRules,
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedColab, setCopiedColab] = useState(false);
  const [newPatternInput, setNewPatternInput] = useState('');

  const sourceModules = PYTHON_PROJECT_FILES.filter(
    (f) => f.path !== 'fixit_cli.py'
  );
  const activeFile =
    sourceModules[selectedFileIndex] || sourceModules[0];

  const handleCopyFile = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleDownloadActiveFile = () => {
    const blob = new Blob([activeFile.content], {
      type: 'text/x-python;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.path.split('/').pop() || 'fixit_cli.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const colabScript = `# Run in Google Colab (Runtime -> T4 GPU)
!curl -fsSL https://ollama.com/install.sh | sh
import subprocess, time
subprocess.Popen(["ollama", "serve"])
time.sleep(3)
!ollama pull qwen2.5-coder:3b

!git clone https://github.com/research/fixit-swebench.git
%cd fixit-swebench
!pip install -q langgraph ollama datasets pytest pyyaml
!python eval/run_swebench.py --subset 25 --compare-baseline`;

  const handleCopyColab = () => {
    navigator.clipboard.writeText(colabScript);
    setCopiedColab(true);
    setTimeout(() => setCopiedColab(false), 1800);
  };

  const handleAddPattern = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPatternInput.trim();
    if (!trimmed || rules.protected_patterns.includes(trimmed)) return;
    onUpdateRules({
      ...rules,
      protected_patterns: [...rules.protected_patterns, trimmed],
    });
    setNewPatternInput('');
  };

  const handleRemovePattern = (pattern: string) => {
    onUpdateRules({
      ...rules,
      protected_patterns: rules.protected_patterns.filter((p) => p !== pattern),
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Python Codebase Explorer */}
      <div className="border border-white/[0.08] bg-[#0E1017] grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/[0.08]">
          <div className="px-4 py-3 border-b border-white/[0.08] font-mono text-[11px] text-zinc-500">
            SOURCE // PYTHON MODULES
          </div>
          <div className="divide-y divide-white/[0.05] font-mono text-xs">
            {sourceModules.map((file, idx) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                  idx === selectedFileIndex
                    ? 'bg-white/[0.05] text-emerald-400 border-l-2 border-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                <div>{file.path}</div>
                <div className="text-[11px] text-zinc-600 font-sans mt-0.5">
                  {file.role}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col bg-[#06070B]">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between font-mono text-xs">
            <span className="text-zinc-200">{activeFile.path}</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCopyFile}
                className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>[COPIED]</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>[COPY MODULE]</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadActiveFile}
                className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>[DOWNLOAD .PY]</span>
              </button>
            </div>
          </div>
          <div className="p-4 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed max-h-[420px] overflow-y-auto">
            <pre>{activeFile.content}</pre>
          </div>
        </div>
      </div>

      {/* 2. Safety Rules + Google Colab Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-white/[0.08] bg-[#0E1017] p-5 space-y-4">
          <div className="font-mono text-[11px] text-emerald-400 uppercase">
            SAFETY // CONFIG/RULES.YAML
          </div>
          <p className="text-xs text-zinc-400">
            Protected test globs blocked by <code className="font-mono text-zinc-200">safety_hook.py</code> before Docker execution:
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {rules.protected_patterns.map((pattern) => (
              <span
                key={pattern}
                className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#090A0F] border border-white/[0.08] text-zinc-300"
              >
                <span>{pattern}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePattern(pattern)}
                  className="text-zinc-600 hover:text-rose-400 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={handleAddPattern} className="flex gap-2 font-mono text-xs">
            <input
              type="text"
              value={newPatternInput}
              onChange={(e) => setNewPatternInput(e.target.value)}
              placeholder="e.g. *_spec.py"
              className="flex-1 px-3 py-1.5 bg-[#090A0F] border border-white/[0.08] text-zinc-200 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-white text-black font-semibold hover:bg-zinc-200 cursor-pointer"
            >
              ADD GLOB
            </button>
          </form>
        </div>

        <div className="border border-white/[0.08] bg-[#0E1017] p-5 space-y-4">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-sky-400 uppercase">COLAB // FREE T4 GPU RUNNER</span>
            <button
              type="button"
              onClick={handleCopyColab}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              {copiedColab ? '[COPIED]' : '[COPY CELL]'}
            </button>
          </div>
          <div className="bg-[#06070B] border border-white/[0.08] p-3 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
            <pre>{colabScript}</pre>
          </div>
        </div>
      </div>

      {/* 3. Key Project Rules (Short & Minimal) */}
      <div className="border border-white/[0.08] bg-[#0E1017] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
        <div className="p-4">
          <div className="font-mono text-[10px] text-zinc-500 mb-1">01 // INPUT</div>
          <div className="text-xs font-medium text-zinc-200">Starts From an Error</div>
          <p className="text-xs text-zinc-500 mt-1">
            Give FixIt a failing test or crash error (auto-creates a test if missing).
          </p>
        </div>
        <div className="p-4">
          <div className="font-mono text-[10px] text-zinc-500 mb-1">02 // SCOPE</div>
          <div className="text-xs font-medium text-zinc-200">Minimal Code Diffs</div>
          <p className="text-xs text-zinc-500 mt-1">
            Fixes only the broken lines in 1–2 files without rewriting your project.
          </p>
        </div>
        <div className="p-4">
          <div className="font-mono text-[10px] text-zinc-500 mb-1">03 // WEIGHTS</div>
          <div className="text-xs font-medium text-zinc-200">Zero Fine-Tuning</div>
          <p className="text-xs text-zinc-500 mt-1">
            All 5 agents share the same free <code className="font-mono text-zinc-300">qwen2.5-coder:3b</code> model.
          </p>
        </div>
        <div className="p-4">
          <div className="font-mono text-[10px] text-zinc-500 mb-1">04 // PROOF</div>
          <div className="text-xs font-medium text-zinc-200">56% vs. 24% Baseline</div>
          <p className="text-xs text-zinc-500 mt-1">
            Role decomposition + test-driven retries more than double the resolution rate.
          </p>
        </div>
      </div>
    </div>
  );
};
