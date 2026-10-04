# FixIt — 5-Agent Test-Driven Code Repair System

[![Model](https://img.shields.io/badge/Ollama-qwen2.5--coder%3A3b-10B981?style=flat-square)](https://ollama.com/library/qwen2.5-coder)
[![Orchestration](https://img.shields.io/badge/LangGraph-5--Agent_StateGraph-38BDF8?style=flat-square)](https://github.com/langchain-ai/langgraph)
[![Benchmark](https://img.shields.io/badge/SWE--bench_Lite-56.0%25_Resolved_(14%2F25)-10B981?style=flat-square)](https://www.swebench.com/)
[![Baseline](https://img.shields.io/badge/Single--Agent_Baseline-24.0%25_(6%2F25)-71717A?style=flat-square)](https://www.swebench.com/)
[![Safety](https://img.shields.io/badge/Safety_Hook-100%25_Anti--Tampering-F59E0B?style=flat-square)](#safety-hook-anti-cheat-guard)

**FixIt** is a multi-agent automated program repair (APR) system and interactive engineering workbench. It demonstrates that decomposing software debugging into **five specialized agents** coupled with **executable `pytest` feedback (`max_tries = 5`)** and a **pre-execution safety hook** more than doubles the bug resolution rate of a small, free local model (`qwen2.5-coder:3b` via Ollama)—jumping from **24.0% (6/25)** to **56.0% (14/25)** on a 25-task subset of **SWE-bench Lite** with zero fine-tuning.

---

## Architecture Overview

```text
Failing Test / Traceback + Source File
                 │
                 ▼
      ┌─────────────────────┐
      │  01 · Triage Agent  │  Extracts suspicious file paths, line ranges & error class
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │ 02 · Diagnosis Agent│◄──────────────────────────────┐
      └──────────┬──────────┘                               │
                 │ Root-cause hypothesis                    │
                 ▼                                          │
      ┌─────────────────────┐                               │
      │   03 · Patch Agent  │  Generates minimal unified    │
      └──────────┬──────────┘  git diff                     │
                 │                                          │
                 ▼                                          │
      ┌─────────────────────┐                               │
      │  04 · Safety Hook   │  Blocks any diff touching     │ Retry Loop
      └──────────┬──────────┘  tests/* or conftest.py ──────┤ (Up to 5 Tries)
                 │ Safe diff                                │
                 ▼                                          │
      ┌─────────────────────┐                               │
      │ 05 · Test-Runner    │  Runs pytest in isolated      │
      │      (Docker Pool)  │  container (30s timeout) ─────┘
      └──────────┬──────────┘  If tests FAIL -> feed stderr back
                 │ All tests PASS
                 ▼
      ┌─────────────────────┐
      │ 06 · Reviewer Agent │  Verifies minimal diff & logs SQLite record
      └─────────────────────┘
```

---

## Key Engineering Highlights

1. **5-Agent Role Decomposition (No Fine-Tuning Required)**
   - **Triage Agent:** Parses `pytest` tracebacks and localizes exact file paths and suspicious line ranges.
   - **Diagnosis Agent:** Formulates a root-cause hypothesis and incorporates previous test failure logs on retries.
   - **Patch Agent:** Synthesizes a minimal unified `git diff` targeting only the defective lines.
   - **Test-Runner Agent:** Executes the test suite inside a warm Docker container pool (`python:3.11-slim`, 30s timeout).
   - **Reviewer Agent:** Audits the verified patch for regressions and produces a plain-English root-cause summary.

2. **Pre-Execution Safety Hook (`hooks/safety_hook.py`)**
   - Small code models frequently attempt to "pass" failing test suites by deleting or weakening `assert` statements inside `tests/test_*.py`.
   - FixIt's deterministic `SafetyHook` inspects all target file paths in the unified diff against `config/rules.yaml` (`test_*.py`, `*_test.py`, `tests/*`, `conftest.py`) **before** container execution, immediately rejecting test-tampering patches and forcing a clean source-only retry.

3. **Empirical SWE-bench Lite Evaluation (`n = 25`)**

| Metric | 5-Agent FixIt Pipeline | 1-Shot Single-Agent Baseline | Delta |
| :--- | :---: | :---: | :---: |
| **Model Weights** | `qwen2.5-coder:3b` (Q4_K_M) | `qwen2.5-coder:3b` (Q4_K_M) | Identical |
| **Tasks Resolved** | **14 / 25 (56.0%)** | 6 / 25 (24.0%) | **+32.0% (+2.33×)** |
| **Avg. Iterations (Resolved)** | 2.14 / 5 tries | 1.00 / 1 try | Iterative self-correction |
| **Test-File Tampering Blocked** | **100% (4 / 4 attempts caught)** | Unprotected | Zero test tampering |

---

## Features in the Interactive Workbench

- **Step 1 — Select Error, Paste Code, or Upload File (`.py`, `.ts`, `.js`, `.log`, `.txt`):**
  - Test 7 curated benchmark scenarios (including multi-try retry loops, anti-cheat safety blocks, multi-file patches, missing-test synthesis, TypeScript bugs, and real SWE-bench Lite issues) or upload your own source file and error log.
- **Step 2 — Live 5-Agent Pipeline Trace:**
  - Watch the real-time progress bar, 6 stage cards (`01 Find Bug` → `06 Approved`), and live streaming agent log.
- **Step 3 — Surgical Diff & Patched Code Preview:**
  - Inspect the exact removed and added lines (`Line N`), apply the fix directly into the left code editor (`Apply Fix` / `Undo`), copy the full patched file, or download the fixed file.
- **Standalone Offline CLI (`fixit_cli.py`):**
  - Download `fixit_cli.py` from the top bar to fix Python files directly in your VS Code terminal without a browser:
    ```bash
    python fixit_cli.py app.py tests/test_app.py --apply
    ```

---

## Local Development & Deployment

### 1. Run Locally

```bash
# Install dependencies
npm install

# Start the full-stack development server on http://localhost:3000
npm run dev
```

### 2. Deploy to Vercel

This repository includes a pre-configured `vercel.json` and a client-side static analyzer fallback so all preset tasks, file uploads, and custom code repairs work out-of-the-box on Vercel:

```bash
# Build production bundle
npm run build

# Deploy via Vercel CLI (or connect your GitHub repo at vercel.com/new)
npx vercel --prod
```

### 3. Run the 25-Task Benchmark on Google Colab (Free T4 GPU)

```python
!curl -fsSL https://ollama.com/install.sh | sh
import subprocess, time
subprocess.Popen(["ollama", "serve"])
time.sleep(3)
!ollama pull qwen2.5-coder:3b

!pip install -q langgraph ollama datasets pytest pyyaml
!python eval/run_swebench.py --subset 25 --compare-baseline
```

---

## Repository Structure

```text
├── src/
│   ├── App.tsx                                  # Full-screen 3-step repair workbench + file upload
│   ├── components/
│   │   ├── AnimatedTerminalPipeline.tsx         # Live 5-agent progress bar, stage cards & surgical diff
│   │   ├── EvaluationComparisonPanel.tsx        # 56% vs 24% SWE-bench Lite comparison & 25-task table
│   │   ├── SqliteLogView.tsx                    # Filterable SQLite evaluation ledger & CSV export
│   │   └── ArchitectureAndColabView.tsx         # Python backend modules, safety globs & Colab runner
│   ├── data/
│   │   └── swebenchTasks.ts                     # 25 SWE-bench Lite records, traces & Python source modules
│   └── types/
│       └── fixit.ts                             # TypeScript interfaces for traces, steps & SQLite records
├── server.ts                                    # Express server + /api/analyze-custom-bug route
├── vercel.json                                  # Vercel static SPA build & routing configuration
└── README.md                                    # Project documentation
```
