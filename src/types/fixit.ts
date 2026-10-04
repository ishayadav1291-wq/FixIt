export type RunArchitecture = 'multi_agent' | 'single_agent' | 'both';

export type BugCategory =
  | 'Logic Error'
  | 'Type / Value Error'
  | 'Boundary / Indexing'
  | 'Missing Import / Attribute'
  | 'State / Mutation Bug'
  | 'Exception Handling';

export type AgentName =
  | 'Triage Agent'
  | 'Diagnosis Agent'
  | 'Patch Agent'
  | 'Safety Hook'
  | 'Test-Runner Agent'
  | 'Reviewer Agent'
  | 'Single-Agent Generalist';

export interface AgentStepOutput {
  id: string;
  attempt: number;
  agent: AgentName;
  status: 'completed' | 'failed' | 'blocked' | 'running';
  durationMs: number;
  summary: string;
  structuredData?: {
    bugCategory?: BugCategory;
    targetFile?: string;
    suspiciousLines?: string;
    hypothesis?: string;
    rootCauseDetail?: string;
    diff?: string;
    touchedFiles?: string[];
    safetyViolation?: boolean;
    safetyReason?: string;
    pytestCommand?: string;
    pytestExitCode?: number;
    pytestStdout?: string;
    reviewVerdict?: 'APPROVED' | 'NEEDS_REVISION';
    plainEnglishExplanation?: string;
  };
  promptUsed?: string;
  rawModelOutput?: string;
}

export interface PipelineTrace {
  architecture: 'multi_agent' | 'single_agent';
  status: 'RESOLVED' | 'UNRESOLVED' | 'BLOCKED_SAFETY';
  iterationsUsed: number;
  totalDurationSec: number;
  finalPatchDiff: string;
  failureStage?: 'Triage' | 'Diagnosis' | 'Patch Syntax' | 'Safety Hook' | 'Test Execution' | 'Max Retries Exhausted';
  steps: AgentStepOutput[];
}

export interface SweBenchTask {
  instanceId: string;
  repo: string;
  version: string;
  baseCommit: string;
  title: string;
  category: BugCategory;
  targetFile: string;
  testFile: string;
  failingTestName: string;
  traceback: string;
  sourceSnippet: string;
  multiAgentTrace: PipelineTrace;
  singleAgentTrace: PipelineTrace;
}

export interface RulesConfig {
  model: string;
  runtime: string;
  temperature: number;
  max_attempts: number;
  docker_image: string;
  docker_timeout_sec: number;
  protected_patterns: string[];
  require_minimal_diff: boolean;
  max_diff_lines: number;
  random_seed: number;
}

export interface SqliteRunRecord {
  runId: string;
  timestamp: string;
  instanceId: string;
  repo: string;
  category: BugCategory;
  multiAgentResolved: boolean;
  multiAgentAttempts: number;
  multiAgentDurationSec: number;
  singleAgentResolved: boolean;
  singleAgentAttempts: number;
  singleAgentDurationSec: number;
  multiAgentFailureStage: string | null;
  singleAgentFailureStage: string | null;
  safetyHookTriggered: boolean;
  finalDiff: string;
  reviewerNotes: string;
}
