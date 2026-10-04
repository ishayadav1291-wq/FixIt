export interface ProjectSourceFile {
  path: string;
  language: 'python' | 'yaml' | 'sql' | 'bash' | 'text';
  description: string;
  stepRef: string;
  content: string;
}

export const PYTHON_PROJECT_FILES: ProjectSourceFile[] = [
  {
    path: 'rules.yaml',
    language: 'yaml',
    description: 'Hard execution boundaries, model configuration, and protected file globs.',
    stepRef: 'Step 7 · Rules Config',
    content: `# FixIt Execution Rules & Safety Boundaries
model: "qwen2.5-coder:3b"
ollama_host: "http://127.0.0.1:11434"
temperature: 0.1
max_attempts: 5
random_seed: 42

sandbox:
  docker_image: "python:3.10-slim-bookworm"
  timeout_sec: 30
  network_disabled: true
  memory_limit: "1g"

safety_hook:
  block_test_modifications: true
  require_minimal_diff: true
  max_diff_lines: 45
  protected_patterns:
    - "tests/*"
    - "test_*.py"
    - "*_test.py"
    - "*/tests/*"
    - "conftest.py"
`,
  },
  {
    path: 'orchestrator.py',
    language: 'python',
    description: 'LangGraph state machine coordinating the 5 agents and conditional retry loop.',
    stepRef: 'Step 9 · LangGraph Orchestrator',
    content: `"""
FixIt Multi-Agent Orchestrator built with LangGraph.
Coordinates Triage -> Diagnosis -> Patch -> SafetyHook -> TestRunner -> Reviewer
with a conditional retry edge back to Diagnosis up to max_attempts (5).
"""
from typing import TypedDict, List, Optional
import yaml
from langgraph.graph import StateGraph, END
from agents import (
    triage_agent,
    diagnosis_agent,
    patch_agent,
    reviewer_agent,
)
from safety_hook import verify_patch_safety
from sandbox import run_pytest_in_docker
from db import log_agent_step, finalize_bug_run

with open("rules.yaml", "r", encoding="utf-8") as f:
    RULES = yaml.safe_load(f)


class FixItState(TypedDict):
    bug_id: str
    repo_path: str
    failing_test: str
    traceback: str
    source_code: str
    attempt: int
    bug_category: Optional[str]
    target_file: Optional[str]
    hypothesis: Optional[str]
    current_diff: Optional[str]
    safety_passed: bool
    safety_error: Optional[str]
    test_passed: bool
    latest_pytest_output: Optional[str]
    review_explanation: Optional[str]
    status: str


def node_triage(state: FixItState) -> FixItState:
    res = triage_agent(state["failing_test"], state["traceback"], state["source_code"])
    log_agent_step(state["bug_id"], state["attempt"], "Triage Agent", res)
    return {
        **state,
        "bug_category": res["category"],
        "target_file": res["target_file"],
    }


def node_diagnosis(state: FixItState) -> FixItState:
    attempt = state["attempt"] + 1
    feedback = state.get("latest_pytest_output") or state.get("safety_error")
    res = diagnosis_agent(
        target_file=state["target_file"],
        source_code=state["source_code"],
        traceback=state["traceback"],
        previous_feedback=feedback,
    )
    log_agent_step(state["bug_id"], attempt, "Diagnosis Agent", res)
    return {
        **state,
        "attempt": attempt,
        "hypothesis": res["hypothesis"],
    }


def node_patch(state: FixItState) -> FixItState:
    diff = patch_agent(
        target_file=state["target_file"],
        source_code=state["source_code"],
        hypothesis=state["hypothesis"],
    )
    log_agent_step(state["bug_id"], state["attempt"], "Patch Agent", {"diff": diff})
    return {**state, "current_diff": diff}


def node_test_runner(state: FixItState) -> FixItState:
    safe, reason = verify_patch_safety(state["current_diff"], RULES["safety_hook"])
    if not safe:
        log_agent_step(state["bug_id"], state["attempt"], "Safety Hook", {"blocked": reason})
        return {
            **state,
            "safety_passed": False,
            "safety_error": reason,
            "test_passed": False,
        }

    passed, output = run_pytest_in_docker(
        repo_path=state["repo_path"],
        diff_text=state["current_diff"],
        pytest_target=state["failing_test"],
        timeout_sec=RULES["sandbox"]["timeout_sec"],
    )
    log_agent_step(state["bug_id"], state["attempt"], "Test-Runner Agent", {
        "passed": passed,
        "stdout": output,
    })
    return {
        **state,
        "safety_passed": True,
        "safety_error": None,
        "test_passed": passed,
        "latest_pytest_output": output,
    }


def node_reviewer(state: FixItState) -> FixItState:
    review = reviewer_agent(state["current_diff"], state["hypothesis"])
    log_agent_step(state["bug_id"], state["attempt"], "Reviewer Agent", review)
    finalize_bug_run(state["bug_id"], "RESOLVED", state["attempt"], state["current_diff"])
    return {
        **state,
        "review_explanation": review["explanation"],
        "status": "RESOLVED",
    }


def should_retry_or_review(state: FixItState) -> str:
    if state["test_passed"]:
        return "reviewer"
    if state["attempt"] >= RULES["max_attempts"]:
        finalize_bug_run(state["bug_id"], "UNRESOLVED", state["attempt"], state["current_diff"])
        return "unresolved"
    return "diagnosis"


def build_fixit_graph():
    workflow = StateGraph(FixItState)
    workflow.add_node("triage", node_triage)
    workflow.add_node("diagnosis", node_diagnosis)
    workflow.add_node("patch", node_patch)
    workflow.add_node("test_runner", node_test_runner)
    workflow.add_node("reviewer", node_reviewer)

    workflow.set_entry_point("triage")
    workflow.add_edge("triage", "diagnosis")
    workflow.add_edge("diagnosis", "patch")
    workflow.add_edge("patch", "test_runner")
    workflow.add_conditional_edges(
        "test_runner",
        should_retry_or_review,
        {
            "reviewer": "reviewer",
            "diagnosis": "diagnosis",
            "unresolved": END,
        },
    )
    workflow.add_edge("reviewer", END)
    return workflow.compile()
`,
  },
  {
    path: 'safety_hook.py',
    language: 'python',
    description: 'Prevents reward hacking by blocking any patch that edits test files.',
    stepRef: 'Step 7 · Safety Hook',
    content: `"""
Safety Hook: Blocks any patch that attempts to modify unit test files
(e.g., weakening an assert statement instead of fixing the bug).
"""
import fnmatch
import re
from typing import Tuple, Dict, Any, List


def extract_touched_files(unified_diff: str) -> List[str]:
    touched = []
    for line in unified_diff.splitlines():
        if line.startswith("+++ b/") or line.startswith("--- a/"):
            filepath = line[6:].strip()
            if filepath != "/dev/null" and filepath not in touched:
                touched.append(filepath)
    return touched


def verify_patch_safety(unified_diff: str, safety_config: Dict[str, Any]) -> Tuple[bool, str]:
    if not unified_diff or not unified_diff.strip():
        return False, "Empty unified diff generated."

    touched_files = extract_touched_files(unified_diff)
    protected_patterns = safety_config.get("protected_patterns", [
        "tests/*", "test_*.py", "*_test.py", "*/tests/*", "conftest.py"
    ])

    for path in touched_files:
        filename = path.split("/")[-1]
        for pattern in protected_patterns:
            if fnmatch.fnmatch(path, pattern) or fnmatch.fnmatch(filename, pattern):
                return (
                    False,
                    f"BLOCKED BY SAFETY HOOK: Patch modifies protected test file '{path}' "
                    f"(matched rule '{pattern}'). Agents may only edit implementation files."
                )

    changed_lines = [
        line for line in unified_diff.splitlines()
        if (line.startswith("+") or line.startswith("-"))
        and not line.startswith("+++")
        and not line.startswith("---")
    ]
    max_lines = safety_config.get("max_diff_lines", 45)
    if safety_config.get("require_minimal_diff", True) and len(changed_lines) > max_lines:
        return (
            False,
            f"BLOCKED BY SAFETY HOOK: Diff modifies {len(changed_lines)} lines, "
            f"exceeding minimal diff limit ({max_lines} lines)."
        )

    return True, "OK"
`,
  },
  {
    path: 'agents.py',
    language: 'python',
    description: 'Thin wrappers loading focused prompt templates and querying Qwen2.5-Coder via Ollama.',
    stepRef: 'Steps 3 & 5 · 5 Specialist Agents + Baseline',
    content: `"""
FixIt Specialist Agents & Single-Agent Generalist Baseline.
All agents share the same local model (qwen2.5-coder:3b via Ollama) so that
the evaluation isolates the effect of multi-agent orchestration vs. single-shot prompting.
"""
import json
import difflib
import urllib.request
from pathlib import Path

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "qwen2.5-coder:3b"


def call_ollama(prompt: str, format_json: bool = True) -> str:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1, "seed": 42},
    }
    if format_json:
        payload["format"] = "json"

    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        return body["response"]


def load_prompt(name: str, **kwargs) -> str:
    template = Path(f"prompts/{name}.txt").read_text(encoding="utf-8")
    return template.format(**kwargs)


def triage_agent(failing_test: str, traceback: str, source_code: str) -> dict:
    prompt = load_prompt(
        "triage",
        failing_test=failing_test,
        traceback=traceback,
        source_code=source_code,
    )
    return json.loads(call_ollama(prompt, format_json=True))


def diagnosis_agent(target_file: str, source_code: str, traceback: str, previous_feedback: str = None) -> dict:
    prompt = load_prompt(
        "diagnosis",
        target_file=target_file,
        source_code=source_code,
        traceback=traceback,
        previous_feedback=previous_feedback or "None (Attempt 1)",
    )
    return json.loads(call_ollama(prompt, format_json=True))


def patch_agent(target_file: str, source_code: str, hypothesis: str) -> str:
    prompt = load_prompt(
        "patch",
        target_file=target_file,
        source_code=source_code,
        hypothesis=hypothesis,
    )
    res = json.loads(call_ollama(prompt, format_json=True))
    patched_code = res.get("patched_code", source_code)
    diff_lines = difflib.unified_diff(
        source_code.splitlines(keepends=True),
        patched_code.splitlines(keepends=True),
        fromfile=f"a/{target_file}",
        tofile=f"b/{target_file}",
    )
    return "".join(diff_lines)


def reviewer_agent(diff_text: str, hypothesis: str) -> dict:
    prompt = load_prompt("reviewer", diff_text=diff_text, hypothesis=hypothesis)
    return json.loads(call_ollama(prompt, format_json=True))


def single_agent_baseline(target_file: str, source_code: str, traceback: str, prev_error: str = None) -> str:
    """Single generalist agent doing triage + diagnosis + patch in one prompt."""
    prompt = load_prompt(
        "single_agent",
        target_file=target_file,
        source_code=source_code,
        traceback=traceback,
        prev_error=prev_error or "None (Attempt 1)",
    )
    res = json.loads(call_ollama(prompt, format_json=True))
    patched_code = res.get("patched_code", source_code)
    return "".join(
        difflib.unified_diff(
            source_code.splitlines(keepends=True),
            patched_code.splitlines(keepends=True),
            fromfile=f"a/{target_file}",
            tofile=f"b/{target_file}",
        )
    )
`,
  },
  {
    path: 'sandbox.py',
    language: 'python',
    description: 'Isolated Docker execution environment for applying patches and running pytest.',
    stepRef: 'Step 6 · Docker Sandbox',
    content: `"""
Docker Sandbox Runner: Mounts a temporary copy of the repository inside
an ephemeral container (network disabled), applies the unified diff, and runs pytest.
"""
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Tuple


def run_pytest_in_docker(
    repo_path: str,
    diff_text: str,
    pytest_target: str,
    timeout_sec: int = 30,
) -> Tuple[bool, str]:
    with tempfile.TemporaryDirectory(prefix="fixit_sandbox_") as tmpdir:
        work_repo = Path(tmpdir) / "repo"
        shutil.copytree(repo_path, work_repo)
        patch_file = work_repo / "candidate.patch"
        patch_file.write_text(diff_text, encoding="utf-8")

        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "1g",
            "-v", f"{work_repo}:/workspace",
            "-w", "/workspace",
            "python:3.10-slim-bookworm",
            "bash", "-c",
            f"git apply candidate.patch && pytest {pytest_target} -q --tb=short"
        ]
        try:
            proc = subprocess.run(
                docker_cmd,
                capture_output=True,
                text=True,
                timeout=timeout_sec,
            )
            output = (proc.stdout + "\\n" + proc.stderr).strip()
            return proc.returncode == 0, output
        except subprocess.TimeoutExpired:
            return False, f"TimeoutError: pytest exceeded {timeout_sec}s limit in Docker container."
`,
  },
  {
    path: 'db.py',
    language: 'python',
    description: 'SQLite schema and logging utilities for bugs, agent reasoning steps, and benchmark runs.',
    stepRef: 'Step 8 · SQLite Database',
    content: `"""
SQLite Persistence Layer (fixit_results.db).
Stores every bug, every attempt, every agent's reasoning trace, and test outcome.
"""
import sqlite3
import json
from datetime import datetime

DB_PATH = "fixit_results.db"


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(
            \"\"\"
            CREATE TABLE IF NOT EXISTS bugs (
                bug_id TEXT PRIMARY KEY,
                repo TEXT NOT NULL,
                failing_test TEXT NOT NULL,
                traceback TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bug_id TEXT NOT NULL,
                architecture TEXT NOT NULL,
                status TEXT NOT NULL,
                iterations_used INTEGER NOT NULL,
                final_diff TEXT,
                completed_at TEXT NOT NULL,
                FOREIGN KEY(bug_id) REFERENCES bugs(bug_id)
            );

            CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bug_id TEXT NOT NULL,
                attempt_num INTEGER NOT NULL,
                agent_name TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                logged_at TEXT NOT NULL
            );
            \"\"\"
        )


def log_agent_step(bug_id: str, attempt_num: int, agent_name: str, payload: dict):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO agent_logs (bug_id, attempt_num, agent_name, payload_json, logged_at) VALUES (?, ?, ?, ?, ?)",
            (bug_id, attempt_num, agent_name, json.dumps(payload), datetime.utcnow().isoformat()),
        )


def finalize_bug_run(bug_id: str, status: str, iterations: int, final_diff: str, arch: str = "multi_agent"):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO attempts (bug_id, architecture, status, iterations_used, final_diff, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
            (bug_id, arch, status, iterations, final_diff, datetime.utcnow().isoformat()),
        )
`,
  },
];
