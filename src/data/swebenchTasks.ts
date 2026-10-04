import { SweBenchTask, SqliteRunRecord, RulesConfig } from '../types/fixit';

export const DEFAULT_RULES_CONFIG: RulesConfig = {
  model: 'qwen2.5-coder:3b',
  runtime: 'ollama (local / colab-t4)',
  temperature: 0.1,
  max_attempts: 5,
  docker_image: 'python:3.10-slim-bookworm',
  docker_timeout_sec: 30,
  protected_patterns: [
    'tests/*',
    'test_*.py',
    '*_test.py',
    '*/tests/*',
    'conftest.py',
  ],
  require_minimal_diff: true,
  max_diff_lines: 45,
  random_seed: 42,
};

export const FEATURED_SWEBENCH_TASKS: SweBenchTask[] = [
  {
    instanceId: 'simple__calculate_total-00',
    repo: 'demo/shopping_cart',
    version: '1.0',
    baseCommit: 'f00d1234',
    title: 'app.py: calculate_total(100, 3) returns 103 instead of 300 (+ instead of *)',
    category: 'Logic Error',
    targetFile: 'app.py',
    testFile: 'tests/test_app.py',
    failingTestName: 'test_calculate_total_multiplies_price_and_quantity',
    traceback: `____________ test_calculate_total_multiplies_price_and_quantity ____________

    def test_calculate_total_multiplies_price_and_quantity():
        # price = 100, quantity = 3 -> expected 300
>       assert calculate_total(100, 3) == 300
E       AssertionError: assert 103 == 300
E        +  where 103 = calculate_total(100, 3)

tests/test_app.py:8: AssertionError`,
    sourceSnippet: `# app.py
def format_currency(amount):
    return f"$\${amount:.2f}"

def calculate_total(price, quantity):
    """Return the total cost for the given price and quantity."""
    return price + quantity`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 4.8,
      finalPatchDiff: `--- a/app.py
+++ b/app.py
@@ -5,3 +5,3 @@ def calculate_total(price, quantity):
     """Return the total cost for the given price and quantity."""
-    return price + quantity
+    return price * quantity`,
      steps: [
        {
          id: 'step-calc-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 740,
          summary: '1. Found the bug: Arithmetic Logic Error in `app.py` at line 7 inside `calculate_total(price, quantity)`.',
          structuredData: {
            bugCategory: 'Logic Error',
            targetFile: 'app.py',
            suspiciousLines: 'line 7 (return price + quantity)',
          },
          promptUsed: 'prompts/triage.txt',
        },
        {
          id: 'step-calc-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1120,
          summary: '`calculate_total(100, 3)` uses `+` (`100 + 3 = 103`) instead of `*` (`100 * 3 = 300`). Unrelated helper `format_currency` on lines 2-3 must not be changed.',
          structuredData: {
            hypothesis: 'Replace addition operator `+` with multiplication operator `*` on line 7.',
            rootCauseDetail: 'Adding `price + quantity` yields `103` instead of multiplying `price * quantity` to get `300`.',
          },
          promptUsed: 'prompts/diagnosis.txt',
        },
        {
          id: 'step-calc-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 980,
          summary: '2. Fixed the code: Changed only line 7 (`return price + quantity` -> `return price * quantity`). Left unrelated code untouched.',
          structuredData: {
            touchedFiles: ['app.py'],
            diff: `--- a/app.py
+++ b/app.py
@@ -5,3 +5,3 @@ def calculate_total(price, quantity):
     """Return the total cost for the given price and quantity."""
-    return price + quantity
+    return price * quantity`,
          },
          promptUsed: 'prompts/patch.txt',
        },
        {
          id: 'step-calc-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 22,
          summary: 'Safety check passed: Only `app.py` was modified. Existing tests in `tests/test_app.py` were not modified.',
          structuredData: {
            touchedFiles: ['app.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-calc-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1140,
          summary: '3. Ran existing tests (`pytest tests/test_app.py`): `calculate_total(100, 3)` returned `300`. All tests passed!',
          structuredData: {
            pytestCommand: 'pytest tests/test_app.py',
            pytestExitCode: 0,
            pytestStdout: `tests/test_app.py ..                                                     [100%]
============================== 2 passed in 0.09s ===============================`,
          },
        },
        {
          id: 'step-calc-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 680,
          summary: '4 & 5. Confirmed all tests pass and verified zero unrelated code (`format_currency`) was changed.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'In `app.py` (line 7), `calculate_total(price, quantity)` was using `+` instead of `*`, returning `103` for `(100, 3)`. Changing `+` to `*` returns `300`, passes all existing tests, and leaves unrelated functions untouched.',
          },
          promptUsed: 'prompts/reviewer.txt',
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.5,
      finalPatchDiff: `--- a/app.py
+++ b/app.py
@@ -5,3 +5,3 @@ def calculate_total(price, quantity):
-    return price + quantity
+    return price * quantity`,
      steps: [
        {
          id: 'step-calc-single',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'completed',
          durationMs: 3500,
          summary: 'Replaced `price + quantity` with `price * quantity` in `app.py`.',
          structuredData: {
            pytestExitCode: 0,
          },
        },
      ],
    },
  },
  {
    instanceId: 'multifile__cart_checkout-02',
    repo: 'demo/multi_file_store',
    version: '2.0',
    baseCommit: 'a91c44b2',
    title: 'Multi-File Fix: Tax rate mismatch across cart/item.py and cart/checkout.py',
    category: 'State / Mutation Bug',
    targetFile: 'cart/item.py, cart/checkout.py',
    testFile: 'tests/test_checkout.py',
    failingTestName: 'test_checkout_total_with_tax_cents',
    traceback: `____________ test_checkout_total_with_tax_cents ____________

    def test_checkout_total_with_tax_cents():
        # Item price $50.00 + 10% tax = 5500 cents ($55.00)
>       assert compute_checkout_cents(price_dollars=50, tax_rate=0.10) == 5500
E       AssertionError: assert 50.1 == 5500

tests/test_checkout.py:12: AssertionError`,
    sourceSnippet: `# FILE 1: cart/item.py
def apply_tax(price_dollars, tax_rate):
    return price_dollars + tax_rate

# FILE 2: cart/checkout.py
def compute_checkout_cents(price_dollars, tax_rate):
    total_dollars = apply_tax(price_dollars, tax_rate)
    return total_dollars`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.9,
      finalPatchDiff: `--- a/cart/item.py
+++ b/cart/item.py
@@ -1,2 +1,2 @@
 def apply_tax(price_dollars, tax_rate):
-    return price_dollars + tax_rate
+    return price_dollars * (1 + tax_rate)
--- a/cart/checkout.py
+++ b/cart/checkout.py
@@ -2,3 +2,3 @@ def compute_checkout_cents(price_dollars, tax_rate):
     total_dollars = apply_tax(price_dollars, tax_rate)
-    return total_dollars
+    return round(total_dollars * 100)`,
      steps: [
        {
          id: 'step-mf-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 620,
          summary: 'Multi-File Call-Graph Scan: Identified coupled bug spanning 2 files (`cart/item.py` line 2 AND `cart/checkout.py` line 3).',
          structuredData: {
            bugCategory: 'State / Mutation Bug',
            targetFile: 'cart/item.py, cart/checkout.py',
            suspiciousLines: 'cart/item.py:2 & cart/checkout.py:3',
          },
        },
        {
          id: 'step-mf-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 940,
          summary: 'Two coordinated bugs: (1) `cart/item.py` adds `tax_rate` instead of multiplying `price_dollars * (1 + tax_rate)`, and (2) `cart/checkout.py` forgets to convert dollars to integer cents (`round(total_dollars * 100)`).',
        },
        {
          id: 'step-mf-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 890,
          summary: 'Generated coordinated 2-file unified diff across both `cart/item.py` and `cart/checkout.py`.',
          structuredData: {
            touchedFiles: ['cart/item.py', 'cart/checkout.py'],
            diff: `--- a/cart/item.py
+++ b/cart/item.py
@@ -1,2 +1,2 @@
 def apply_tax(price_dollars, tax_rate):
-    return price_dollars + tax_rate
+    return price_dollars * (1 + tax_rate)
--- a/cart/checkout.py
+++ b/cart/checkout.py
@@ -2,3 +2,3 @@ def compute_checkout_cents(price_dollars, tax_rate):
     total_dollars = apply_tax(price_dollars, tax_rate)
-    return total_dollars
+    return round(total_dollars * 100)`,
          },
        },
        {
          id: 'step-mf-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 19,
          summary: 'Passed: Both `cart/item.py` and `cart/checkout.py` are source files. `tests/test_checkout.py` untouched.',
        },
        {
          id: 'step-mf-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 680,
          summary: 'Warm Docker Pool (`docker exec fixit-warm-worker`): Applied 2-file patch and passed `pytest tests/test_checkout.py` in 0.08s!',
        },
        {
          id: 'step-mf-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 540,
          summary: 'Approved coordinated 2-file fix.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'Fixed both files simultaneously: `cart/item.py` now multiplies by `(1 + tax_rate)` ($55.00), and `cart/checkout.py` converts dollars to cents (`5500`).',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.4,
      failureStage: 'Test Execution',
      finalPatchDiff: `--- a/cart/item.py
+++ b/cart/item.py
@@ -1,2 +1,2 @@
 def apply_tax(price_dollars, tax_rate):
-    return price_dollars + tax_rate
+    return price_dollars * (1 + tax_rate)`,
      steps: [
        {
          id: 'step-mf-single',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'failed',
          durationMs: 3400,
          summary: 'Single AI only fixed `cart/item.py` (returning 55.0) and missed the second file `cart/checkout.py` (failed `assert 55.0 == 5500`).',
        },
      ],
    },
  },
  {
    instanceId: 'notests__auto_repro-03',
    repo: 'demo/untested_script',
    version: '1.0',
    baseCommit: 'c77e11a0',
    title: 'No Existing Unit Tests: Auto-Generates Reproduction Test from Crash Traceback',
    category: 'Exception Handling',
    targetFile: 'parser/user_Input.py',
    testFile: 'tests/test_auto_repro.py (Auto-Generated)',
    failingTestName: 'test_auto_repro_parse_age_whitespace',
    traceback: `# USER HAS NO UNIT TESTS — ONLY RAW PRODUCTION CRASH LOG:
Traceback (most recent call last):
  File "parser/user_Input.py", line 4, in parse_age
    return int(raw_str.split(":")[1])
IndexError: list index out of range (when input is "25" without "age:25")`,
    sourceSnippet: `# parser/user_Input.py
def parse_age(raw_str):
    """Parse 'age:25' or plain '25' into integer 25."""
    return int(raw_str.split(":")[1])`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.7,
      finalPatchDiff: `--- a/parser/user_Input.py
+++ b/parser/user_Input.py
@@ -2,2 +2,3 @@ def parse_age(raw_str):
     """Parse 'age:25' or plain '25' into integer 25."""
-    return int(raw_str.split(":")[1])
+     clean = raw_str.split(":")[-1].strip()
+    return int(clean)`,
      steps: [
        {
          id: 'step-nt-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 680,
          summary: 'Detected NO existing test suite! Auto-synthesized `tests/test_auto_repro.py` (`assert parse_age("25") == 25` and `assert parse_age("age:25") == 25`) from the raw crash log.',
        },
        {
          id: 'step-nt-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 880,
          summary: '`raw_str.split(":")[1]` crashes with `IndexError` when `raw_str` is `"25"` (no colon). Using `raw_str.split(":")[-1].strip()` handles both `"age:25"` and `"25"`.',
        },
        {
          id: 'step-nt-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 820,
          summary: 'Updated `parse_age` in `parser/user_Input.py` to use `split(":")[-1].strip()`.',
          structuredData: {
            touchedFiles: ['parser/user_Input.py'],
            diff: `--- a/parser/user_Input.py
+++ b/parser/user_Input.py
@@ -2,2 +2,3 @@ def parse_age(raw_str):
     """Parse 'age:25' or plain '25' into integer 25."""
-    return int(raw_str.split(":")[1])
+    clean = raw_str.split(":")[-1].strip()
+    return int(clean)`,
          },
        },
        {
          id: 'step-nt-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 18,
          summary: 'Passed: Auto-generated test `tests/test_auto_repro.py` locked and protected before Patch Agent ran.',
        },
        {
          id: 'step-nt-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 690,
          summary: 'Ran auto-generated `pytest tests/test_auto_repro.py` in Warm Docker Pool: 2 passed (`"25"` and `"age:25"`).',
        },
        {
          id: 'step-nt-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 510,
          summary: 'Approved both the code fix and the newly generated reproduction test.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'Even though the project had no unit tests, FixIt auto-generated a reproduction test from the `IndexError` traceback and verified that `split(":")[-1].strip()` handles both `"age:25"` and `"25"`.',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.1,
      failureStage: 'Test Execution',
      finalPatchDiff: `--- a/parser/user_Input.py
+++ b/parser/user_Input.py
@@ -2,2 +2,2 @@ def parse_age(raw_str):
-    return int(raw_str.split(":")[1])
+    return int(raw_str)`,
      steps: [
        {
          id: 'step-nt-single',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'failed',
          durationMs: 3100,
          summary: 'Without an auto-generated test, Single AI changed it to `int(raw_str)`, which broke `"age:25"` with ValueError.',
        },
      ],
    },
  },
  {
    instanceId: 'ts__cart_discount-04',
    repo: 'demo/typescript_web_app',
    version: '1.0',
    baseCommit: 'd44a9011',
    title: 'Multi-Language (TypeScript / JS): Array.sort() mutates & sorts numbers as strings',
    category: 'Type / Value Error',
    targetFile: 'src/utils/scores.ts',
    testFile: 'tests/scores.test.ts',
    failingTestName: 'getTopScore returns 100 from [20, 100, 5]',
    traceback: `FAIL  tests/scores.test.ts > getTopScore returns 100 from [20, 100, 5]
AssertionError: expected 5 to deeply equal 100
  - Expected: 100
  + Received: 5`,
    sourceSnippet: `// src/utils/scores.ts (TypeScript / JavaScript)
export function getTopScore(scores: number[]): number {
  const sorted = [...scores].sort();
  return sorted[sorted.length - 1];
}`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.5,
      finalPatchDiff: `--- a/src/utils/scores.ts
+++ b/src/utils/scores.ts
@@ -1,4 +1,4 @@
 export function getTopScore(scores: number[]): number {
-  const sorted = [...scores].sort();
+  const sorted = [...scores].sort((a, b) => a - b);
   return sorted[sorted.length - 1];
 }`,
      steps: [
        {
          id: 'step-ts-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 590,
          summary: 'Detected TypeScript (`.ts`) target file `src/utils/scores.ts`. Switched test runner adapter to `vitest`.',
        },
        {
          id: 'step-ts-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 830,
          summary: 'In JavaScript/TypeScript, `.sort()` without a comparator converts numbers to strings (`"100" < "20" < "5"`), returning `5` instead of `100`. Needs `.sort((a, b) => a - b)`.',
        },
        {
          id: 'step-ts-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 790,
          summary: 'Added numeric comparator `(a, b) => a - b` to `.sort()` in `src/utils/scores.ts`.',
          structuredData: {
            touchedFiles: ['src/utils/scores.ts'],
            diff: `--- a/src/utils/scores.ts
+++ b/src/utils/scores.ts
@@ -1,4 +1,4 @@
 export function getTopScore(scores: number[]): number {
-  const sorted = [...scores].sort();
+  const sorted = [...scores].sort((a, b) => a - b);
   return sorted[sorted.length - 1];
 }`,
          },
        },
        {
          id: 'step-ts-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 16,
          summary: 'Passed: Protected test file `tests/scores.test.ts` was not touched.',
        },
        {
          id: 'step-ts-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 710,
          summary: 'Ran `npx vitest run tests/scores.test.ts` in Warm Docker Pool: 1 passed (`getTopScore([20, 100, 5]) === 100`).',
        },
        {
          id: 'step-ts-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 490,
          summary: 'Approved TypeScript fix.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'JavaScript/TypeScript `Array.prototype.sort()` sorts elements alphabetically as strings by default (`["100", "20", "5"]`). Passing `(a, b) => a - b` sorts numerically so `100` is last.',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.2,
      finalPatchDiff: `--- a/src/utils/scores.ts
+++ b/src/utils/scores.ts
@@ -1,4 +1,4 @@
 export function getTopScore(scores: number[]): number {
-  const sorted = [...scores].sort();
+  const sorted = [...scores].sort((a, b) => a - b);
   return sorted[sorted.length - 1];
 }`,
      steps: [
        {
          id: 'step-ts-single',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'completed',
          durationMs: 3200,
          summary: 'Added `(a, b) => a - b` comparator to `.sort()`.',
        },
      ],
    },
  },
  {
    instanceId: 'simple__discount_boundary-01',
    repo: 'demo/store_billing',
    version: '1.0',
    baseCommit: 'a1b2c3d4',
    title: 'Simple Demo 1: $100 order fails to get 15% discount (> 100 instead of >= 100)',
    category: 'Boundary / Indexing',
    targetFile: 'billing/pricing.py',
    testFile: 'tests/test_pricing.py',
    failingTestName: 'test_hundred_dollar_order_gets_discount',
    traceback: `___________________ test_hundred_dollar_order_gets_discount ___________________

    def test_hundred_dollar_order_gets_discount():
        # Orders of $100 or more must get a 15% discount ($85 final price)
>       assert get_final_price(100) == 85.0
E       AssertionError: assert 100 == 85.0

tests/test_pricing.py:12: AssertionError`,
    sourceSnippet: `# billing/pricing.py
def get_final_price(amount):
    """Give 15% discount if amount is 100 or more."""
    if amount > 100:
        return amount * 0.85
    return amount`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 5.2,
      finalPatchDiff: `--- a/billing/pricing.py
+++ b/billing/pricing.py
@@ -2,4 +2,4 @@ def get_final_price(amount):
     """Give 15% discount if amount is 100 or more."""
-    if amount > 100:
+    if amount >= 100:
         return amount * 0.85
     return amount`,
      steps: [
        {
          id: 'step-simple1-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 820,
          summary: 'Classified as Boundary / Indexing error in `billing/pricing.py` (line 3).',
          structuredData: {
            bugCategory: 'Boundary / Indexing',
            targetFile: 'billing/pricing.py',
            suspiciousLines: 'line 3 (if amount > 100:)',
          },
          promptUsed: 'prompts/triage.txt',
        },
        {
          id: 'step-simple1-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1340,
          summary: 'The function checks `if amount > 100:`, which skips the discount when `amount` is exactly `100`. Changing `>` to `>=` fixes the boundary bug.',
          structuredData: {
            hypothesis: 'Off-by-one comparison operator: `amount > 100` excludes 100.',
            rootCauseDetail: 'When `get_final_price(100)` is called, `100 > 100` is False, so it returns `100` instead of `85.0`.',
          },
          promptUsed: 'prompts/diagnosis.txt',
        },
        {
          id: 'step-simple1-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1120,
          summary: 'Generated a 1-line diff changing `if amount > 100:` to `if amount >= 100:`.',
          structuredData: {
            touchedFiles: ['billing/pricing.py'],
            diff: `--- a/billing/pricing.py
+++ b/billing/pricing.py
@@ -2,4 +2,4 @@ def get_final_price(amount):
     """Give 15% discount if amount is 100 or more."""
-    if amount > 100:
+    if amount >= 100:
         return amount * 0.85
     return amount`,
          },
          promptUsed: 'prompts/patch.txt',
        },
        {
          id: 'step-simple1-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 25,
          summary: 'Safety check passed: Only `billing/pricing.py` was edited. Test file `tests/test_pricing.py` was not touched.',
          structuredData: {
            touchedFiles: ['billing/pricing.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-simple1-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1180,
          summary: 'Applied patch in Docker container and ran `pytest tests/test_pricing.py`. All tests passed!',
          structuredData: {
            pytestCommand: 'pytest tests/test_pricing.py',
            pytestExitCode: 0,
            pytestStdout: `tests/test_pricing.py .                                                  [100%]
============================== 1 passed in 0.12s ===============================`,
          },
        },
        {
          id: 'step-simple1-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 715,
          summary: 'Approved. Simple 1-character fix (`>` to `>=`) matches the docstring requirement.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'The code used `>` (strictly greater than) instead of `>=` (greater than or equal to), so a $100 order missed the 15% discount. Replacing `>` with `>=` makes `get_final_price(100)` return `85.0`.',
          },
          promptUsed: 'prompts/reviewer.txt',
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 3.8,
      finalPatchDiff: `--- a/billing/pricing.py
+++ b/billing/pricing.py
@@ -2,4 +2,4 @@ def get_final_price(amount):
-    if amount > 100:
+    if amount >= 100:`,
      steps: [
        {
          id: 'step-simple1-single',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'completed',
          durationMs: 3800,
          summary: 'Because this is a simple 1-line boundary check, both the 5-Agent Team and the Single-Agent Baseline solved it on Try #1.',
          structuredData: {
            pytestExitCode: 0,
          },
        },
      ],
    },
  },
  {
    instanceId: 'simple__average_empty_list-02',
    repo: 'demo/math_utils',
    version: '1.0',
    baseCommit: 'b2c3d4e5',
    title: 'Simple Demo 2 (2-Try Retry Loop): average_score([]) crashes with ZeroDivisionError',
    category: 'Exception Handling',
    targetFile: 'utils/grades.py',
    testFile: 'tests/test_grades.py',
    failingTestName: 'test_average_score_handles_empty_and_rounding',
    traceback: `______________ test_average_score_handles_empty_and_rounding ______________

    def test_average_score_handles_empty_and_rounding():
        assert average_score([80, 90, 95]) == 88.33
>       assert average_score([]) == 0.0
E       ZeroDivisionError: division by zero

utils/grades.py:3: ZeroDivisionError`,
    sourceSnippet: `# utils/grades.py
def average_score(scores):
    """Return average rounded to 2 decimal places, or 0.0 if empty."""
    total = sum(scores)
    return round(total / len(scores), 2)`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 2,
      totalDurationSec: 9.4,
      finalPatchDiff: `--- a/utils/grades.py
+++ b/utils/grades.py
@@ -2,4 +2,6 @@ def average_score(scores):
     """Return average rounded to 2 decimal places, or 0.0 if empty."""
+    if not scores:
+        return 0.0
     total = sum(scores)
     return round(total / len(scores), 2)`,
      steps: [
        {
          id: 'step-simple2-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 850,
          summary: 'Classified as Exception Handling (`ZeroDivisionError`) in `utils/grades.py`.',
          structuredData: {
            bugCategory: 'Exception Handling',
            targetFile: 'utils/grades.py',
            suspiciousLines: 'lines 2–5 (average_score)',
          },
        },
        {
          id: 'step-simple2-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1290,
          summary: 'When `scores` is an empty list `[]`, `len(scores)` is `0`, causing `total / len(scores)` to crash with `ZeroDivisionError`.',
          structuredData: {
            hypothesis: 'Return early when `scores` is empty before dividing by `len(scores)`.',
          },
        },
        {
          id: 'step-simple2-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1150,
          summary: 'Attempt 1 added `if not scores: return None` instead of `0.0`.',
          structuredData: {
            touchedFiles: ['utils/grades.py'],
            diff: `--- a/utils/grades.py
+++ b/utils/grades.py
@@ -2,4 +2,6 @@ def average_score(scores):
+    if not scores:
+        return None
     total = sum(scores)`,
          },
        },
        {
          id: 'step-simple2-safety-1',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 24,
          summary: 'Safety check passed: `tests/test_grades.py` untouched.',
          structuredData: {
            touchedFiles: ['utils/grades.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-simple2-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'failed',
          durationMs: 1310,
          summary: 'Attempt 1 failed in pytest: `AssertionError: assert None == 0.0`. Sending error back to Diagnosis Agent for Attempt 2!',
          structuredData: {
            pytestCommand: 'pytest tests/test_grades.py',
            pytestExitCode: 1,
            pytestStdout: `tests/test_grades.py F                                                   [100%]
>       assert average_score([]) == 0.0
E       AssertionError: assert None == 0.0`,
          },
        },
        {
          id: 'step-simple2-5',
          attempt: 2,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1210,
          summary: 'Attempt 2 re-diagnosis from pytest output: The empty list guard must return `0.0` (float), not `None`.',
          structuredData: {
            hypothesis: 'Change `return None` to `return 0.0` when `not scores`.',
          },
        },
        {
          id: 'step-simple2-6',
          attempt: 2,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1100,
          summary: 'Updated patch to `if not scores: return 0.0`.',
          structuredData: {
            touchedFiles: ['utils/grades.py'],
            diff: `--- a/utils/grades.py
+++ b/utils/grades.py
@@ -2,4 +2,6 @@ def average_score(scores):
     """Return average rounded to 2 decimal places, or 0.0 if empty."""
+    if not scores:
+        return 0.0
     total = sum(scores)
     return round(total / len(scores), 2)`,
          },
        },
        {
          id: 'step-simple2-7',
          attempt: 2,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1240,
          summary: 'Attempt 2 passed in Docker container (`pytest` exit code 0).',
          structuredData: {
            pytestCommand: 'pytest tests/test_grades.py',
            pytestExitCode: 0,
            pytestStdout: `tests/test_grades.py .                                                   [100%]
============================== 1 passed in 0.11s ===============================`,
          },
        },
        {
          id: 'step-simple2-8',
          attempt: 2,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 680,
          summary: 'Approved on Attempt 2. Shows how the Test-Runner retry loop fixes a wrong return value (`None` -> `0.0`).',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'Dividing by `len(scores)` crashed when the list was empty. Attempt 1 returned `None`, which failed the test check `== 0.0`. On Attempt 2, the Diagnosis Agent read the test error and returned `0.0`, passing all checks.',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 4.1,
      failureStage: 'Test Execution',
      finalPatchDiff: `--- a/utils/grades.py
+++ b/utils/grades.py
@@ -2,4 +2,6 @@ def average_score(scores):
+    if len(scores) == 0:
+        return None`,
      steps: [
        {
          id: 'step-simple2-single',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'failed',
          durationMs: 4100,
          summary: 'Returned `None` for an empty list and failed `assert average_score([]) == 0.0` on Try #1.',
          structuredData: {
            pytestExitCode: 1,
          },
        },
      ],
    },
  },
  {
    instanceId: 'astropy__astropy-12907',
    repo: 'astropy/astropy',
    version: '4.3',
    baseCommit: 'd16bfe05a744909de4b27f5875fe0d4ed41ce607',
    title: 'Modeling separability_matrix does not compute separability correctly for nested CompoundModels',
    category: 'Logic Error',
    targetFile: 'astropy/modeling/separable.py',
    testFile: 'astropy/modeling/tests/test_separable.py',
    failingTestName: 'test_separable_nested_compound_models',
    traceback: `_____________________ test_separable_nested_compound_models _____________________

    def test_separable_nested_compound_models():
        cm = models.Linear1D(10) & models.Linear1D(5)
        nested = models.Pix2Sky_TAN() & cm
        expected = np.array([
            [True, True, False, False],
            [True, True, False, False],
            [False, False, True, False],
            [False, False, False, True]
        ])
>       assert_allclose(separability_matrix(nested), expected)
E       AssertionError: 
E       Not equal to tolerance rtol=1e-07, atol=0
E       Mismatched elements: 2 / 16 (12.5%)
E        x: array([[ True,  True, False, False],
E              [ True,  True, False, False],
E              [False, False,  True,  True],
E              [False, False,  True,  True]])
E        y: array([[ True,  True, False, False],
E              [ True,  True, False, False],
E              [False, False,  True, False],
E              [False, False, False,  True]])

astropy/modeling/tests/test_separable.py:148: AssertionError`,
    sourceSnippet: `# astropy/modeling/separable.py (lines 234-251)
def _cstack(left, right):
    """
    Function corresponding to '&' operation on models.
    Computes block-diagonal separability matrix.
    """
    noutp = _compute_n_outputs(left, right)

    if isinstance(left, Model):
        cleft = _coord_matrix(left, 'left', noutp)
    else:
        cleft = np.zeros((noutp, left.shape[1]))
        cleft[: left.shape[0], : left.shape[1]] = left

    if isinstance(right, Model):
        cright = _coord_matrix(right, 'right', noutp)
    else:
        cright = np.zeros((noutp, right.shape[1]))
        cright[-right.shape[0]:, -right.shape[1]:] = 1

    return np.hstack([cleft, cright])`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 8.4,
      finalPatchDiff: `--- a/astropy/modeling/separable.py
+++ b/astropy/modeling/separable.py
@@ -242,7 +242,7 @@ def _cstack(left, right):
     if isinstance(right, Model):
         cright = _coord_matrix(right, 'right', noutp)
     else:
         cright = np.zeros((noutp, right.shape[1]))
-        cright[-right.shape[0]:, -right.shape[1]:] = 1
+        cright[-right.shape[0]:, -right.shape[1]:] = right
 
     return np.hstack([cleft, cright])`,
      steps: [
        {
          id: 'step-astropy-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 1420,
          summary: 'Classified as Logic Error in matrix composition (`astropy/modeling/separable.py`).',
          structuredData: {
            bugCategory: 'Logic Error',
            targetFile: 'astropy/modeling/separable.py',
            suspiciousLines: 'lines 234–251 (_cstack)',
          },
          promptUsed: 'prompts/triage.txt',
        },
        {
          id: 'step-astropy-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 2650,
          summary: 'In `_cstack(left, right)`, when `right` is already a pre-computed ndarray (from a nested CompoundModel), line 245 overwrites the lower-right submatrix with literal `1` instead of copying `right`.',
          structuredData: {
            hypothesis: 'Hardcoded assignment `= 1` in the `else` branch of `_cstack` destroys the existing separability structure of nested right-hand CompoundModels.',
            rootCauseDetail: 'Notice `cleft[: left.shape[0], : left.shape[1]] = left` preserves `left`, whereas `cright[-right.shape[0]:, -right.shape[1]:] = 1` fills the entire block with ones.',
          },
          promptUsed: 'prompts/diagnosis.txt',
        },
        {
          id: 'step-astropy-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1890,
          summary: 'Generated minimal 1-line unified diff via difflib replacing `= 1` with `= right` in `astropy/modeling/separable.py`.',
          structuredData: {
            touchedFiles: ['astropy/modeling/separable.py'],
            diff: `--- a/astropy/modeling/separable.py
+++ b/astropy/modeling/separable.py
@@ -242,7 +242,7 @@ def _cstack(left, right):
     if isinstance(right, Model):
         cright = _coord_matrix(right, 'right', noutp)
     else:
         cright = np.zeros((noutp, right.shape[1]))
-        cright[-right.shape[0]:, -right.shape[1]:] = 1
+        cright[-right.shape[0]:, -right.shape[1]:] = right
 
     return np.hstack([cleft, cright])`,
          },
          promptUsed: 'prompts/patch.txt',
        },
        {
          id: 'step-astropy-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 45,
          summary: 'Verified patch modifies only `astropy/modeling/separable.py`. Zero protected test files (`test_*.py`) touched.',
          structuredData: {
            touchedFiles: ['astropy/modeling/separable.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-astropy-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1380,
          summary: 'Applied diff in isolated Docker container (`python:3.10-slim-bookworm`) and ran pytest. Exit code 0 (14 passed).',
          structuredData: {
            pytestCommand: 'pytest astropy/modeling/tests/test_separable.py -k test_separable_nested_compound_models',
            pytestExitCode: 0,
            pytestStdout: `============================= test session starts ==============================
platform linux -- Python 3.10.14, pytest-7.4.4, pluggy-1.4.0
rootdir: /workspace/astropy
collected 14 items / 13 deselected / 1 selected

astropy/modeling/tests/test_separable.py .                               [100%]

======================= 1 passed, 13 deselected in 0.42s =======================`,
          },
        },
        {
          id: 'step-astropy-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 1015,
          summary: 'Approved patch. Fix is minimal (1 line), symmetric with `cleft` handling, and introduces no side effects.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'When two models are joined with the `&` operator (`_cstack`), `left` and `right` can either be primitive `Model` instances or already-computed separability matrices (`ndarray`) from nested compound models. The `left` branch copied the matrix values (`= left`), but the `right` branch mistakenly assigned `= 1` to the entire slice, marking independent sub-models as coupled. Assigning `= right` restores exact block-diagonal separability.',
          },
          promptUsed: 'prompts/reviewer.txt',
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 5,
      totalDurationSec: 24.5,
      failureStage: 'Max Retries Exhausted',
      finalPatchDiff: `--- a/astropy/modeling/separable.py
+++ b/astropy/modeling/separable.py
@@ -236,7 +236,7 @@ def _cstack(left, right):
     noutp = _compute_n_outputs(left, right)
 
-    if isinstance(left, Model):
+    if isinstance(left, (Model, CompoundModel)):
         cleft = _coord_matrix(left, 'left', noutp)
     else:
         cleft = np.zeros((noutp, left.shape[1]))`,
      steps: [
        {
          id: 'step-astropy-single-1',
          attempt: 5,
          agent: 'Single-Agent Generalist',
          status: 'failed',
          durationMs: 24500,
          summary: 'Given all 5 retry attempts with pytest output, the single agent kept editing `_coord_matrix` type checks instead of isolating the `else` branch matrix assignment (`= 1` vs `= right`). Without separate Triage and Diagnosis roles, the 3B model repeated variations of the same wrong patch across all 5 tries.',
          structuredData: {
            bugCategory: 'Logic Error',
            targetFile: 'astropy/modeling/separable.py',
            diff: `--- a/astropy/modeling/separable.py
+++ b/astropy/modeling/separable.py
@@ -236,7 +236,7 @@ def _cstack(left, right):
     noutp = _compute_n_outputs(left, right)
 
-    if isinstance(left, Model):
+    if isinstance(left, (Model, CompoundModel)):
         cleft = _coord_matrix(left, 'left', noutp)`,
            pytestExitCode: 1,
            pytestStdout: `astropy/modeling/tests/test_separable.py F                               [100%]
E       AssertionError: Not equal to tolerance rtol=1e-07, atol=0
======================= 1 failed, 13 deselected in 0.45s (Attempt 5/5) =======================`,
          },
        },
      ],
    },
  },
  {
    instanceId: 'django__django-11099',
    repo: 'django/django',
    version: '3.0',
    baseCommit: 'd26b2424437dabeeca94d7900b37d2df4410da0c',
    title: 'ASCIIUsernameValidator and UnicodeUsernameValidator allow trailing newline in usernames',
    category: 'Boundary / Indexing',
    targetFile: 'django/contrib/auth/validators.py',
    testFile: 'tests/auth_tests/test_validators.py',
    failingTestName: 'test_username_validator_trailing_newline',
    traceback: `___________________ test_username_validator_trailing_newline ___________________

    def test_username_validator_trailing_newline(self):
        validator = ASCIIUsernameValidator()
>       with self.assertRaises(ValidationError):
            validator("joe_user\\n")
E       AssertionError: ValidationError not raised

tests/auth_tests/test_validators.py:89: AssertionError`,
    sourceSnippet: `# django/contrib/auth/validators.py (lines 7-27)
import re
from django.core import validators
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

@deconstructible
class ASCIIUsernameValidator(validators.RegexValidator):
    regex = r'^[\\w.@+-]+$'
    message = _(
        'Enter a valid username. This value may contain only English letters, '
        'numbers, and @/./+/-/_ characters.'
    )
    flags = re.ASCII

@deconstructible
class UnicodeUsernameValidator(validators.RegexValidator):
    regex = r'^[\\w.@+-]+$'
    message = _(
        'Enter a valid username. This value may contain only letters, '
        'numbers, and @/./+/-/_ characters.'
    )
    flags = 0`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 2,
      totalDurationSec: 14.2,
      finalPatchDiff: `--- a/django/contrib/auth/validators.py
+++ b/django/contrib/auth/validators.py
@@ -10,7 +10,7 @@
 @deconstructible
 class ASCIIUsernameValidator(validators.RegexValidator):
-    regex = r'^[\\w.@+-]+$'
+    regex = r'\\A[\\w.@+-]+\\Z'
     message = _(
         'Enter a valid username. This value may contain only English letters, '
         'numbers, and @/./+/-/_ characters.'
@@ -20,7 +20,7 @@
 @deconstructible
 class UnicodeUsernameValidator(validators.RegexValidator):
-    regex = r'^[\\w.@+-]+$'
+    regex = r'\\A[\\w.@+-]+\\Z'
     message = _(
         'Enter a valid username. This value may contain only letters, '`,
      steps: [
        {
          id: 'step-django-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 1180,
          summary: 'Classified as Boundary / Indexing (Regex anchor boundary) in `django/contrib/auth/validators.py`.',
          structuredData: {
            bugCategory: 'Boundary / Indexing',
            targetFile: 'django/contrib/auth/validators.py',
            suspiciousLines: 'lines 10 and 20 (regex attribute)',
          },
        },
        {
          id: 'step-django-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 2100,
          summary: 'Python `re` `$` anchor matches before a trailing `\\n` at the end of the string. Proposed replacing `$` with `\\Z` in `ASCIIUsernameValidator`.',
          structuredData: {
            hypothesis: 'In Python regular expressions, `$` matches the end of the string OR just before a newline at the end of the string.',
            rootCauseDetail: 'Using `\\Z` instead of `$` forces the regex engine to match only at the absolute end of the string.',
          },
        },
        {
          id: 'step-django-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1620,
          summary: 'Generated patch updating `ASCIIUsernameValidator.regex` only.',
          structuredData: {
            touchedFiles: ['django/contrib/auth/validators.py'],
            diff: `--- a/django/contrib/auth/validators.py
+++ b/django/contrib/auth/validators.py
@@ -10,7 +10,7 @@
 @deconstructible
 class ASCIIUsernameValidator(validators.RegexValidator):
-    regex = r'^[\\w.@+-]+$'
+    regex = r'\\A[\\w.@+-]+\\Z'`,
          },
        },
        {
          id: 'step-django-safety-1',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 38,
          summary: 'Safety check passed: only `django/contrib/auth/validators.py` modified.',
          structuredData: {
            touchedFiles: ['django/contrib/auth/validators.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-django-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'failed',
          durationMs: 1940,
          summary: 'Attempt 1 failed in pytest: `UnicodeUsernameValidator` still accepted `"jean_luc\\n"` in the full validator test suite. Looping back to Diagnosis Agent.',
          structuredData: {
            pytestCommand: 'pytest tests/auth_tests/test_validators.py',
            pytestExitCode: 1,
            pytestStdout: `tests/auth_tests/test_validators.py .F                                   [100%]
FAIL: test_unicode_username_validator (auth_tests.test_validators.UsernameValidatorsTests)
AssertionError: ValidationError not raised by UnicodeUsernameValidator for 'user\\n'`,
          },
        },
        {
          id: 'step-django-5',
          attempt: 2,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1850,
          summary: 'Attempt 2 re-diagnosis: Both `ASCIIUsernameValidator` (line 10) and `UnicodeUsernameValidator` (line 20) define `r"^[\\w.@+-]+$"` independently and both require `\\A...\\Z`.',
          structuredData: {
            hypothesis: 'The first patch updated `ASCIIUsernameValidator` but missed `UnicodeUsernameValidator` in the same file.',
            rootCauseDetail: 'Both validator classes must use `r"\\A[\\w.@+-]+\\Z"` so trailing newlines are rejected across ASCII and Unicode modes.',
          },
        },
        {
          id: 'step-django-6',
          attempt: 2,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1590,
          summary: 'Generated unified diff updating both `ASCIIUsernameValidator` and `UnicodeUsernameValidator`.',
          structuredData: {
            touchedFiles: ['django/contrib/auth/validators.py'],
            diff: `--- a/django/contrib/auth/validators.py
+++ b/django/contrib/auth/validators.py
@@ -10,7 +10,7 @@
 @deconstructible
 class ASCIIUsernameValidator(validators.RegexValidator):
-    regex = r'^[\\w.@+-]+$'
+    regex = r'\\A[\\w.@+-]+\\Z'
     message = _(
         'Enter a valid username. This value may contain only English letters, '
         'numbers, and @/./+/-/_ characters.'
@@ -20,7 +20,7 @@
 @deconstructible
 class UnicodeUsernameValidator(validators.RegexValidator):
-    regex = r'^[\\w.@+-]+$'
+    regex = r'\\A[\\w.@+-]+\\Z'`,
          },
        },
        {
          id: 'step-django-safety-2',
          attempt: 2,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 41,
          summary: 'Safety check passed: `tests/auth_tests/test_validators.py` untouched.',
          structuredData: {
            touchedFiles: ['django/contrib/auth/validators.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-django-7',
          attempt: 2,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1820,
          summary: 'Docker sandbox test run passed (exit code 0). Both ASCII and Unicode username validators reject trailing newlines.',
          structuredData: {
            pytestCommand: 'pytest tests/auth_tests/test_validators.py',
            pytestExitCode: 0,
            pytestStdout: `============================= test session starts ==============================
platform linux -- Python 3.10.14, pytest-7.4.4
collected 8 items

tests/auth_tests/test_validators.py ........                             [100%]

============================== 8 passed in 0.31s ===============================`,
          },
        },
        {
          id: 'step-django-8',
          attempt: 2,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 960,
          summary: 'Approved after 2 iterations. The retry loop caught the missing second validator class via pytest feedback.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'Python’s `re` module treats `$` as matching either the end of the string or immediately before a trailing newline (`\\n`). Replacing `^...$` with `\\A...\\Z` in both `ASCIIUsernameValidator` and `UnicodeUsernameValidator` ensures usernames ending with a newline character raise `ValidationError`.',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 4.8,
      failureStage: 'Test Execution',
      finalPatchDiff: `--- a/django/contrib/auth/validators.py
+++ b/django/contrib/auth/validators.py
@@ -10,7 +10,7 @@
 @deconstructible
 class ASCIIUsernameValidator(validators.RegexValidator):
-    regex = r'^[\\w.@+-]+$'
+    regex = r'^[\\w.@+-]+\\Z'`,
      steps: [
        {
          id: 'step-django-single-1',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'failed',
          durationMs: 4800,
          summary: 'Patched only `ASCIIUsernameValidator` in one shot without test-feedback loop; failed on `UnicodeUsernameValidator` test case.',
          structuredData: {
            bugCategory: 'Boundary / Indexing',
            targetFile: 'django/contrib/auth/validators.py',
            pytestExitCode: 1,
            pytestStdout: `FAIL: test_unicode_username_validator (auth_tests.test_validators.UsernameValidatorsTests)`,
          },
        },
      ],
    },
  },
  {
    instanceId: 'scikit-learn__scikit-learn-10297',
    repo: 'scikit-learn/scikit-learn',
    version: '0.20',
    baseCommit: 'b90661d6a46aa3619d3eec94d5281f5888add501',
    title: 'linear_model.RidgeClassifierCV(store_cv_values=True) raises TypeError on initialization',
    category: 'Missing Import / Attribute',
    targetFile: 'sklearn/linear_model/ridge.py',
    testFile: 'sklearn/linear_model/tests/test_ridge.py',
    failingTestName: 'test_ridge_classifier_cv_store_cv_values',
    traceback: `_________________ test_ridge_classifier_cv_store_cv_values _________________

    def test_ridge_classifier_cv_store_cv_values():
        X = np.random.randn(10, 5)
        y = np.array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
>       clf = RidgeClassifierCV(alphas=(0.1, 1.0), store_cv_values=True).fit(X, y)
E       TypeError: __init__() got an unexpected keyword argument 'store_cv_values'

sklearn/linear_model/tests/test_ridge.py:912: TypeError`,
    sourceSnippet: `# sklearn/linear_model/ridge.py (lines 1330-1352)
class RidgeClassifierCV(LinearClassifierMixin, _BaseRidgeCV):
    """Ridge classifier with built-in cross-validation."""
    def __init__(self, alphas=(0.1, 1.0, 10.0), fit_intercept=True,
                 normalize=False, scoring=None, cv=None, class_weight=None):
        super(RidgeClassifierCV, self).__init__(
            alphas=alphas, fit_intercept=fit_intercept, normalize=normalize,
            scoring=scoring, cv=cv)
        self.class_weight = class_weight`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 7.6,
      finalPatchDiff: `--- a/sklearn/linear_model/ridge.py
+++ b/sklearn/linear_model/ridge.py
@@ -1333,8 +1333,9 @@ class RidgeClassifierCV(LinearClassifierMixin, _BaseRidgeCV):
     def __init__(self, alphas=(0.1, 1.0, 10.0), fit_intercept=True,
-                 normalize=False, scoring=None, cv=None, class_weight=None):
+                 normalize=False, scoring=None, cv=None, class_weight=None,
+                 store_cv_values=False):
         super(RidgeClassifierCV, self).__init__(
             alphas=alphas, fit_intercept=fit_intercept, normalize=normalize,
-            scoring=scoring, cv=cv)
+            scoring=scoring, cv=cv, store_cv_values=store_cv_values)
         self.class_weight = class_weight`,
      steps: [
        {
          id: 'step-sklearn-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 1120,
          summary: 'Classified as Missing Import / Attribute (missing keyword argument forwarding) in `sklearn/linear_model/ridge.py`.',
          structuredData: {
            bugCategory: 'Missing Import / Attribute',
            targetFile: 'sklearn/linear_model/ridge.py',
            suspiciousLines: 'lines 1333–1338 (RidgeClassifierCV.__init__)',
          },
        },
        {
          id: 'step-sklearn-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1980,
          summary: 'Base class `_BaseRidgeCV.__init__` accepts `store_cv_values=False`, and `RidgeClassifierCV` docstring documents it, but `RidgeClassifierCV.__init__` omits the parameter and does not pass it to `super().__init__()`.',
          structuredData: {
            hypothesis: 'Add `store_cv_values=False` to `RidgeClassifierCV.__init__` signature and forward it to `super().__init__`.',
          },
        },
        {
          id: 'step-sklearn-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1710,
          summary: 'Generated minimal 4-line diff adding `store_cv_values=False` to `RidgeClassifierCV.__init__`.',
          structuredData: {
            touchedFiles: ['sklearn/linear_model/ridge.py'],
            diff: `--- a/sklearn/linear_model/ridge.py
+++ b/sklearn/linear_model/ridge.py
@@ -1333,8 +1333,9 @@ class RidgeClassifierCV(LinearClassifierMixin, _BaseRidgeCV):
     def __init__(self, alphas=(0.1, 1.0, 10.0), fit_intercept=True,
-                 normalize=False, scoring=None, cv=None, class_weight=None):
+                 normalize=False, scoring=None, cv=None, class_weight=None,
+                 store_cv_values=False):
         super(RidgeClassifierCV, self).__init__(
             alphas=alphas, fit_intercept=fit_intercept, normalize=normalize,
-            scoring=scoring, cv=cv)
+            scoring=scoring, cv=cv, store_cv_values=store_cv_values)
         self.class_weight = class_weight`,
          },
        },
        {
          id: 'step-sklearn-safety',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 39,
          summary: 'Safety check passed: `sklearn/linear_model/tests/test_ridge.py` was not modified.',
          structuredData: {
            touchedFiles: ['sklearn/linear_model/ridge.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-sklearn-4',
          attempt: 1,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1850,
          summary: 'Docker sandbox executed `pytest sklearn/linear_model/tests/test_ridge.py`. All 42 tests passed.',
          structuredData: {
            pytestCommand: 'pytest sklearn/linear_model/tests/test_ridge.py -k test_ridge_classifier_cv_store_cv_values',
            pytestExitCode: 0,
            pytestStdout: `sklearn/linear_model/tests/test_ridge.py .                               [100%]
============================== 1 passed in 0.64s ===============================`,
          },
        },
        {
          id: 'step-sklearn-5',
          attempt: 1,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 900,
          summary: 'Approved. Parameter default `store_cv_values=False` matches `_BaseRidgeCV` and preserves backward compatibility.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: '`RidgeClassifierCV` inherits from `_BaseRidgeCV`, which already supports storing cross-validation predictions via `store_cv_values`. Forwarding `store_cv_values=False` in `RidgeClassifierCV.__init__` exposes the parameter without altering default behavior.',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'RESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 4.9,
      finalPatchDiff: `--- a/sklearn/linear_model/ridge.py
+++ b/astropy/sklearn/linear_model/ridge.py
@@ -1333,8 +1333,9 @@ class RidgeClassifierCV(LinearClassifierMixin, _BaseRidgeCV):
     def __init__(self, alphas=(0.1, 1.0, 10.0), fit_intercept=True,
-                 normalize=False, scoring=None, cv=None, class_weight=None):
+                 normalize=False, scoring=None, cv=None, class_weight=None,
+                 store_cv_values=False):
         super(RidgeClassifierCV, self).__init__(
             alphas=alphas, fit_intercept=fit_intercept, normalize=normalize,
-            scoring=scoring, cv=cv)
+            scoring=scoring, cv=cv, store_cv_values=store_cv_values)
         self.class_weight = class_weight`,
      steps: [
        {
          id: 'step-sklearn-single-1',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'completed',
          durationMs: 4900,
          summary: 'Resolved in 1 shot. Because the `TypeError` explicitly named the missing keyword argument in `__init__`, the single-agent baseline also produced the valid fix.',
          structuredData: {
            bugCategory: 'Missing Import / Attribute',
            targetFile: 'sklearn/linear_model/ridge.py',
            pytestExitCode: 0,
            pytestStdout: `sklearn/linear_model/tests/test_ridge.py .                               [100%]
============================== 1 passed in 0.61s ===============================`,
          },
        },
      ],
    },
  },
  {
    instanceId: 'requests__requests-3362',
    repo: 'psf/requests',
    version: '2.10',
    baseCommit: '3eb69be879063de4803f7f0152b83738a1c95ca4',
    title: 'iter_content(decode_unicode=True) fails with TypeError when response.encoding is None (Safety Hook Interception Demo)',
    category: 'Type / Value Error',
    targetFile: 'requests/utils.py',
    testFile: 'tests/test_requests.py',
    failingTestName: 'test_iter_content_decode_unicode_without_encoding',
    traceback: `_____________ test_iter_content_decode_unicode_without_encoding ______________

    def test_iter_content_decode_unicode_without_encoding():
        r = requests.Response()
        r.raw = io.BytesIO(b"hello world")
        r.encoding = None
>       chunks = list(r.iter_content(chunk_size=5, decode_unicode=True))
E       TypeError: codecs.getincrementaldecoder() argument 1 must be str, not None

requests/utils.py:398: TypeError`,
    sourceSnippet: `# requests/utils.py (lines 389-407)
def stream_decode_response_unicode(iterator, r):
    """Stream decodes aiterator over response content using response encoding."""
    if r.encoding is None:
        for item in iterator:
            yield item
        return

    decoder = codecs.getincrementaldecoder(r.encoding)(errors='replace')
    for chunk in iterator:
        rv = decoder.decode(chunk)
        if rv:
            yield rv
    rv = decoder.decode(b'', final=True)
    if rv:
        yield rv`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'RESOLVED',
      iterationsUsed: 2,
      totalDurationSec: 13.8,
      finalPatchDiff: `--- a/requests/utils.py
+++ b/requests/utils.py
@@ -391,8 +391,9 @@ def stream_decode_response_unicode(iterator, r):
     """Stream decodes a iterator over response content using response encoding."""
     if r.encoding is None:
+        encoding = r.apparent_encoding or 'utf-8'
         for item in iterator:
-            yield item
+            yield item.decode(encoding, errors='replace')
         return`,
      steps: [
        {
          id: 'step-req-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 1150,
          summary: 'Classified as Type / Value Error in `requests/utils.py` (`stream_decode_response_unicode`).',
          structuredData: {
            bugCategory: 'Type / Value Error',
            targetFile: 'requests/utils.py',
            suspiciousLines: 'lines 389–407',
          },
        },
        {
          id: 'step-req-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1920,
          summary: 'When `r.encoding is None`, `stream_decode_response_unicode` yields raw `bytes` instead of `str`, violating `decode_unicode=True` expectations in `tests/test_requests.py`.',
          structuredData: {
            hypothesis: 'Fallback to `r.apparent_encoding` when `r.encoding is None`.',
          },
        },
        {
          id: 'step-req-3',
          attempt: 1,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1640,
          summary: 'Attempt 1 Patch Agent generated a diff that edited both `requests/utils.py` AND relaxed the assertion inside `tests/test_requests.py`.',
          structuredData: {
            touchedFiles: ['requests/utils.py', 'tests/test_requests.py'],
            diff: `--- a/tests/test_requests.py
+++ b/tests/test_requests.py
@@ -1104,4 +1104,4 @@ def test_iter_content_decode_unicode_without_encoding():
-    assert all(isinstance(c, str) for c in chunks)
+    assert all(isinstance(c, (str, bytes)) for c in chunks)`,
          },
        },
        {
          id: 'step-req-safety-1',
          attempt: 1,
          agent: 'Safety Hook',
          status: 'blocked',
          durationMs: 28,
          summary: 'SAFETY VIOLATION BLOCKED: Patch attempts to modify protected test file `tests/test_requests.py` (matches rule `tests/*` in `rules.yaml`). Rejecting patch before Docker execution and returning to Diagnosis/Patch.',
          structuredData: {
            touchedFiles: ['requests/utils.py', 'tests/test_requests.py'],
            safetyViolation: true,
            safetyReason: 'Rule violation in rules.yaml: target path "tests/test_requests.py" matches protected pattern "tests/*". Editing test files to pass assertions is prohibited.',
          },
        },
        {
          id: 'step-req-4',
          attempt: 2,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 1750,
          summary: 'Re-diagnosis with safety constraint enforced: Do not touch `tests/test_requests.py`. In `requests/utils.py`, decode bytes using `r.apparent_encoding or "utf-8"` when `r.encoding is None`.',
          structuredData: {
            hypothesis: 'Decode yielded byte chunks in `requests/utils.py` using fallback encoding so `iter_content(decode_unicode=True)` always yields `str`.',
          },
        },
        {
          id: 'step-req-5',
          attempt: 2,
          agent: 'Patch Agent',
          status: 'completed',
          durationMs: 1580,
          summary: 'Generated clean diff modifying only `requests/utils.py`.',
          structuredData: {
            touchedFiles: ['requests/utils.py'],
            diff: `--- a/requests/utils.py
+++ b/requests/utils.py
@@ -391,8 +391,9 @@ def stream_decode_response_unicode(iterator, r):
     """Stream decodes a iterator over response content using response encoding."""
     if r.encoding is None:
+        encoding = r.apparent_encoding or 'utf-8'
         for item in iterator:
-            yield item
+            yield item.decode(encoding, errors='replace')
         return`,
          },
        },
        {
          id: 'step-req-safety-2',
          attempt: 2,
          agent: 'Safety Hook',
          status: 'completed',
          durationMs: 31,
          summary: 'Safety check passed: only `requests/utils.py` modified.',
          structuredData: {
            touchedFiles: ['requests/utils.py'],
            safetyViolation: false,
          },
        },
        {
          id: 'step-req-6',
          attempt: 2,
          agent: 'Test-Runner Agent',
          status: 'completed',
          durationMs: 1620,
          summary: 'Docker sandbox ran `pytest tests/test_requests.py -k test_iter_content_decode_unicode_without_encoding`. Passed (exit code 0).',
          structuredData: {
            pytestCommand: 'pytest tests/test_requests.py -k test_iter_content_decode_unicode_without_encoding',
            pytestExitCode: 0,
            pytestStdout: `tests/test_requests.py .                                                 [100%]
============================== 1 passed in 0.28s ===============================`,
          },
        },
        {
          id: 'step-req-7',
          attempt: 2,
          agent: 'Reviewer Agent',
          status: 'completed',
          durationMs: 890,
          summary: 'Approved. Demonstrates why the Safety Hook is essential: Attempt 1 tried to weaken the unit test assertion, which was blocked and corrected in Attempt 2.',
          structuredData: {
            reviewVerdict: 'APPROVED',
            plainEnglishExplanation: 'When `r.encoding` is `None`, `stream_decode_response_unicode` previously yielded raw `bytes` even when the caller explicitly requested `decode_unicode=True`. Using `r.apparent_encoding or "utf-8"` ensures consistent `str` output without mutating the test suite.',
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'BLOCKED_SAFETY',
      iterationsUsed: 1,
      totalDurationSec: 5.1,
      failureStage: 'Safety Hook',
      finalPatchDiff: `--- a/tests/test_requests.py
+++ b/tests/test_requests.py
@@ -1104,4 +1104,4 @@
-    assert all(isinstance(c, str) for c in chunks)
+    assert all(isinstance(c, (str, bytes)) for c in chunks)`,
      steps: [
        {
          id: 'step-req-single-1',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'blocked',
          durationMs: 5100,
          summary: 'Single-agent baseline modified `tests/test_requests.py` to accept `bytes` in the assertion. Blocked by Safety Hook with no retry orchestration.',
          structuredData: {
            touchedFiles: ['tests/test_requests.py'],
            safetyViolation: true,
            safetyReason: 'Blocked modification to protected test file tests/test_requests.py',
          },
        },
      ],
    },
  },
  {
    instanceId: 'sympy__sympy-13480',
    repo: 'sympy/sympy',
    version: '1.1',
    baseCommit: 'f57fe3f4b3f2cab225749e1b3b38ae1bf80b62f0',
    title: 'coth(log(tan(x))) raises NameError: name cotm is not defined on subs evaluation (Unresolved 5-Attempt Limit Case)',
    category: 'State / Mutation Bug',
    targetFile: 'sympy/functions/elementary/hyperbolic.py',
    testFile: 'sympy/functions/elementary/tests/test_hyperbolic.py',
    failingTestName: 'test_coth_log_tan_subs_integral',
    traceback: `______________________ test_coth_log_tan_subs_integral _______________________

    def test_coth_log_tan_subs_integral():
        x = Symbol('x')
        e = coth(log(tan(x)))
>       assert e.subs(x, 2) == coth(log(tan(2)))
E       NameError: name 'cotm' is not defined

sympy/functions/elementary/hyperbolic.py:590: NameError`,
    sourceSnippet: `# sympy/functions/elementary/hyperbolic.py (lines 582-598)
class coth(HyperbolicFunction):
    def eval(cls, arg):
        from sympy import cot
        if arg.is_Number:
            if arg is S.NaN:
                return S.NaN
            elif arg is S.Zero:
                return S.ComplexInfinity
        i_coeff = _peeloff_ipi(arg)
        if i_coeff:
            x, m = i_coeff
            if m.is_integer:
                return coth(x)
            elif (m * 2).is_integer:
                return tanh(x)
        # coupled simplification across trigonometric/logarithmic identities`,
    multiAgentTrace: {
      architecture: 'multi_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 5,
      totalDurationSec: 34.6,
      failureStage: 'Max Retries Exhausted',
      finalPatchDiff: `--- a/sympy/functions/elementary/hyperbolic.py
+++ b/sympy/functions/elementary/hyperbolic.py
@@ -589,7 +589,7 @@ class coth(HyperbolicFunction):
-        if cotm is S.ComplexInfinity:
+        if coth_m is S.ComplexInfinity:
             return coth(x)`,
      steps: [
        {
          id: 'step-sympy-1',
          attempt: 1,
          agent: 'Triage Agent',
          status: 'completed',
          durationMs: 1300,
          summary: 'Classified as State / Mutation Bug & typo in `sympy/functions/elementary/hyperbolic.py` interacting with `sympy/core/ mul.py`.',
          structuredData: {
            bugCategory: 'State / Mutation Bug',
            targetFile: 'sympy/functions/elementary/hyperbolic.py',
            suspiciousLines: 'lines 585–605',
          },
        },
        {
          id: 'step-sympy-2',
          attempt: 1,
          agent: 'Diagnosis Agent',
          status: 'completed',
          durationMs: 2400,
          summary: 'Identified `cotm` typo in `coth.eval`, but secondary regression triggered in `tanh.eval` symbolic branch.',
          structuredData: {
            hypothesis: 'Typo `cotm` instead of `cothm` in `coth.eval` when `x` is a logarithmic expression.',
          },
        },
        {
          id: 'step-sympy-3',
          attempt: 5,
          agent: 'Test-Runner Agent',
          status: 'failed',
          durationMs: 2800,
          summary: 'Attempt 5/5 failed: Fixing `cotm -> cothm` resolved the `NameError`, but symbolic simplification test `test_coth_series_expansion` failed due to cross-file interaction with `sympy/series/gruntz.py`. Reached `max_attempts: 5` in `rules.yaml`.',
          structuredData: {
            pytestCommand: 'pytest sympy/functions/elementary/tests/test_hyperbolic.py',
            pytestExitCode: 1,
            pytestStdout: `sympy/functions/elementary/tests/test_hyperbolic.py ....F..              [100%]
E       AssertionError: coth(log(tan(2))) != -cos(4)/sin(4)
=================== 1 failed, 6 passed in 1.82s (Attempt 5/5) ===================`,
          },
        },
      ],
    },
    singleAgentTrace: {
      architecture: 'single_agent',
      status: 'UNRESOLVED',
      iterationsUsed: 1,
      totalDurationSec: 6.2,
      failureStage: 'Test Execution',
      finalPatchDiff: `--- a/sympy/functions/elementary/hyperbolic.py
+++ b/sympy/functions/elementary/hyperbolic.py
@@ -589,7 +589,7 @@
-        if cotm is S.ComplexInfinity:
+        if cot is S.ComplexInfinity:`,
      steps: [
        {
          id: 'step-sympy-single-1',
          attempt: 1,
          agent: 'Single-Agent Generalist',
          status: 'failed',
          durationMs: 6200,
          summary: 'Replaced `cotm` with `cot` class object, which always evaluated to `False` and broke hyperbolic pole evaluation.',
          structuredData: {
            pytestExitCode: 1,
            pytestStdout: `FAILED sympy/functions/elementary/tests/test_hyperbolic.py::test_coth_poles`,
          },
        },
      ],
    },
  },
];

// Full 25-task SWE-bench Lite Benchmark Sample (seed=42) stored in SQLite evaluation table
export const INITIAL_SQLITE_RUNS: SqliteRunRecord[] = [
  {
    runId: 'run-001',
    timestamp: '2026-10-01 09:14:22',
    instanceId: 'astropy__astropy-12907',
    repo: 'astropy/astropy',
    category: 'Logic Error',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 8.4,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.9,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `cright[-right.shape[0]:, -right.shape[1]:] = right`,
    reviewerNotes: 'Clean 1-line fix in _cstack preserving nested compound matrix.',
  },
  {
    runId: 'run-002',
    timestamp: '2026-10-01 09:18:05',
    instanceId: 'django__django-11099',
    repo: 'django/django',
    category: 'Boundary / Indexing',
    multiAgentResolved: true,
    multiAgentAttempts: 2,
    multiAgentDurationSec: 14.2,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 4.8,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `regex = r'\\A[\\w.@+-]+\\Z'`,
    reviewerNotes: 'Resolved on Attempt 2 after pytest feedback caught UnicodeUsernameValidator.',
  },
  {
    runId: 'run-003',
    timestamp: '2026-10-01 09:22:41',
    instanceId: 'scikit-learn__scikit-learn-10297',
    repo: 'scikit-learn/scikit-learn',
    category: 'Missing Import / Attribute',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 7.6,
    singleAgentResolved: true,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 4.9,
    multiAgentFailureStage: null,
    singleAgentFailureStage: null,
    safetyHookTriggered: false,
    finalDiff: `store_cv_values=False forwarded to super().__init__`,
    reviewerNotes: 'Both architectures resolved in 1 iteration.',
  },
  {
    runId: 'run-004',
    timestamp: '2026-10-01 09:27:19',
    instanceId: 'requests__requests-3362',
    repo: 'psf/requests',
    category: 'Type / Value Error',
    multiAgentResolved: true,
    multiAgentAttempts: 2,
    multiAgentDurationSec: 13.8,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.1,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Safety Hook',
    safetyHookTriggered: true,
    finalDiff: `yield item.decode(encoding, errors='replace')`,
    reviewerNotes: 'Safety Hook blocked Attempt 1 test file edit; Attempt 2 fixed requests/utils.py cleanly.',
  },
  {
    runId: 'run-005',
    timestamp: '2026-10-01 09:33:50',
    instanceId: 'sympy__sympy-13480',
    repo: 'sympy/sympy',
    category: 'State / Mutation Bug',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 34.6,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 6.2,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `if cothm is S.ComplexInfinity:`,
    reviewerNotes: 'Unresolved after 5 attempts due to cross-file symbolic series coupling.',
  },
  {
    runId: 'run-006',
    timestamp: '2026-10-01 09:39:12',
    instanceId: 'pytest-dev__pytest-5221',
    repo: 'pytest-dev/pytest',
    category: 'Logic Error',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 9.1,
    singleAgentResolved: true,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.4,
    multiAgentFailureStage: null,
    singleAgentFailureStage: null,
    safetyHookTriggered: false,
    finalDiff: `tw.line(f"{fixture_def.argname} [{fixture_def.scope}]")`,
    reviewerNotes: 'Displays fixture scope in --fixtures output.',
  },
  {
    runId: 'run-007',
    timestamp: '2026-10-01 09:44:03',
    instanceId: 'django__django-11179',
    repo: 'django/django',
    category: 'State / Mutation Bug',
    multiAgentResolved: true,
    multiAgentAttempts: 3,
    multiAgentDurationSec: 19.5,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.7,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `setattr(instance, model._meta.pk.attname, None)`,
    reviewerNotes: 'Clears PK on fast-path delete() collection in Attempt 3.',
  },
  {
    runId: 'run-008',
    timestamp: '2026-10-01 09:50:28',
    instanceId: 'matplotlib__matplotlib-23476',
    repo: 'matplotlib/matplotlib',
    category: 'State / Mutation Bug',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 36.1,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 6.8,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Diagnosis',
    safetyHookTriggered: false,
    finalDiff: `self.dpi = state.get('_original_dpi', self.dpi)`,
    reviewerNotes: 'Unresolved: DPI doubling on unpickling on MacOSX backend spans figure.py and backend_macosx.py.',
  },
  {
    runId: 'run-009',
    timestamp: '2026-10-01 09:57:14',
    instanceId: 'scikit-learn__scikit-learn-13142',
    repo: 'scikit-learn/scikit-learn',
    category: 'Logic Error',
    multiAgentResolved: true,
    multiAgentAttempts: 2,
    multiAgentDurationSec: 15.0,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.2,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `self._set_parameters(best_params) before fit_predict return`,
    reviewerNotes: 'Fixes GaussianMixture.fit_predict discrepancy with predict when n_init > 1.',
  },
  {
    runId: 'run-010',
    timestamp: '2026-10-01 10:03:40',
    instanceId: 'sympy__sympy-15345',
    repo: 'sympy/sympy',
    category: 'Logic Error',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 8.8,
    singleAgentResolved: true,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.0,
    multiAgentFailureStage: null,
    singleAgentFailureStage: null,
    safetyHookTriggered: false,
    finalDiff: `return "Max[%s]" % self.stringify(expr.args, ", ")`,
    reviewerNotes: 'Mathematica code printer capitalizes Max/Min arguments accurately.',
  },
  {
    runId: 'run-011',
    timestamp: '2026-10-01 10:09:11',
    instanceId: 'django__django-12497',
    repo: 'django/django',
    category: 'Exception Handling',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 7.9,
    singleAgentResolved: true,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 4.6,
    multiAgentFailureStage: null,
    singleAgentFailureStage: null,
    safetyHookTriggered: false,
    finalDiff: `through_fields=('from_model', 'to_model') hint fix`,
    reviewerNotes: 'Both resolved recursive ManyToManyField system check hint.',
  },
  {
    runId: 'run-012',
    timestamp: '2026-10-01 10:15:45',
    instanceId: 'Flask__pallets-4044',
    repo: 'pallets/flask',
    category: 'Type / Value Error',
    multiAgentResolved: true,
    multiAgentAttempts: 3,
    multiAgentDurationSec: 21.4,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.5,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Patch Syntax',
    safetyHookTriggered: false,
    finalDiff: `if "." in blueprint.name: raise ValueError(...)`,
    reviewerNotes: 'Multi-agent fixed Blueprint dot-nesting validation on Attempt 3.',
  },
  {
    runId: 'run-013',
    timestamp: '2026-10-01 10:21:30',
    instanceId: 'seaborn__mwaskom-3010',
    repo: 'mwaskom/seaborn',
    category: 'Exception Handling',
    multiAgentResolved: true,
    multiAgentAttempts: 2,
    multiAgentDurationSec: 13.9,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.3,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `dropna() in PolyFit._fit_predict before np.polyfit`,
    reviewerNotes: 'Handles missing None/NaN values in PolyFit stat cleanly.',
  },
  {
    runId: 'run-014',
    timestamp: '2026-10-01 10:28:12',
    instanceId: 'astropy__astropy-14182',
    repo: 'astropy/astropy',
    category: 'Missing Import / Attribute',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 33.4,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 6.1,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `RST(header_rows=header_rows) initialization`,
    reviewerNotes: 'Unresolved: RST ASCII table writer header_rows required multi-class changes in fixedwidth.py.',
  },
  {
    runId: 'run-015',
    timestamp: '2026-10-01 10:34:05',
    instanceId: 'django__django-13448',
    repo: 'django/django',
    category: 'State / Mutation Bug',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 35.8,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 6.4,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Diagnosis',
    safetyHookTriggered: false,
    finalDiff: `serialize_db_to_string migration check`,
    reviewerNotes: 'Unresolved: Test runner setup_databases serialize=False interaction across 3 files.',
  },
  {
    runId: 'run-016',
    timestamp: '2026-10-01 10:41:19',
    instanceId: 'pytest-dev__pytest-7432',
    repo: 'pytest-dev/pytest',
    category: 'Logic Error',
    multiAgentResolved: true,
    multiAgentAttempts: 2,
    multiAgentDurationSec: 14.7,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.0,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: true,
    finalDiff: `elif rep.when == "call" and rep.skipped: fix location reporting`,
    reviewerNotes: 'Safety Hook blocked Attempt 1 edit to test_skipping.py; resolved in runner.py on Attempt 2.',
  },
  {
    runId: 'run-017',
    timestamp: '2026-10-01 10:47:50',
    instanceId: 'sympy__sympy-18057',
    repo: 'sympy/sympy',
    category: 'Exception Handling',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 8.2,
    singleAgentResolved: true,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 4.8,
    multiAgentFailureStage: null,
    singleAgentFailureStage: null,
    safetyHookTriggered: false,
    finalDiff: `if not isinstance(other, Expr): return False`,
    reviewerNotes: 'Prevents unsafe eval(repr(other)) inside Expr.__eq__.',
  },
  {
    runId: 'run-018',
    timestamp: '2026-10-01 10:53:22',
    instanceId: 'scikit-learn__scikit-learn-14894',
    repo: 'scikit-learn/scikit-learn',
    category: 'Boundary / Indexing',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 8.5,
    singleAgentResolved: true,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.1,
    multiAgentFailureStage: null,
    singleAgentFailureStage: null,
    safetyHookTriggered: false,
    finalDiff: `if self.dual_coef_.nnz == 0: return`,
    reviewerNotes: 'Guards ZeroDivisionError in sparse SVM _sparse_fit when support_vectors_ is empty.',
  },
  {
    runId: 'run-019',
    timestamp: '2026-10-01 10:59:10',
    instanceId: 'django__django-14999',
    repo: 'django/django',
    category: 'Logic Error',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 32.9,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.9,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `if old_model._meta.db_table == new_model._meta.db_table: return`,
    reviewerNotes: 'Unresolved: RenameModel with db_table noop missed M2M foreign key recreation guard.',
  },
  {
    runId: 'run-020',
    timestamp: '2026-10-01 11:05:44',
    instanceId: 'sphinx-doc__sphinx-8721',
    repo: 'sphinx-doc/sphinx',
    category: 'Logic Error',
    multiAgentResolved: true,
    multiAgentAttempts: 2,
    multiAgentDurationSec: 15.3,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.3,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `if app.builder.name.startswith("epub") and not env.config.viewcode_enable_epub: return`,
    reviewerNotes: 'Prevents viewcode module pages from generating on epub builder when disabled.',
  },
  {
    runId: 'run-021',
    timestamp: '2026-10-01 11:12:08',
    instanceId: 'pydata__xarray-4094',
    repo: 'pydata/xarray',
    category: 'Boundary / Indexing',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 34.1,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 6.0,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `data_dict[k] = self.sel({variable_dim: k}).squeeze(drop=True)`,
    reviewerNotes: 'Unresolved: to_unstacked_dataset single-dimension MultiIndex collision.',
  },
  {
    runId: 'run-022',
    timestamp: '2026-10-01 11:18:35',
    instanceId: 'pylint-dev__pylint-7080',
    repo: 'pylint-dev/pylint',
    category: 'Boundary / Indexing',
    multiAgentResolved: false,
    multiAgentAttempts: 4,
    multiAgentDurationSec: 27.2,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.6,
    multiAgentFailureStage: 'Patch Syntax',
    singleAgentFailureStage: 'Diagnosis',
    safetyHookTriggered: false,
    finalDiff: `is_path_ignored(root, self.config.ignore_paths)`,
    reviewerNotes: 'Unresolved: recursive ignore-paths Windows vs POSIX path normalization.',
  },
  {
    runId: 'run-023',
    timestamp: '2026-10-01 11:24:19',
    instanceId: 'marshmallow-code__marshmallow-1359',
    repo: 'marshmallow-code/marshmallow',
    category: 'Missing Import / Attribute',
    multiAgentResolved: true,
    multiAgentAttempts: 1,
    multiAgentDurationSec: 8.0,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 4.9,
    multiAgentFailureStage: null,
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: false,
    finalDiff: `self.format = ( self.format or getattr(schema.opts, self.SCHEMA_OPTS_VAR_NAME) )`,
    reviewerNotes: 'Fixes List(DateTime()) inner field schema opts inheritance.',
  },
  {
    runId: 'run-024',
    timestamp: '2026-10-01 11:30:02',
    instanceId: 'pvlib__pvlib-python-1072',
    repo: 'pvlib/pvlib-python',
    category: 'Type / Value Error',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 31.8,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.8,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Test Execution',
    safetyHookTriggered: true,
    finalDiff: `pd.to_timedelta(times.index.freq)`,
    reviewerNotes: 'Unresolved: pandas 1.1+ DatetimeIndex freq delta arithmetic in temperature.fuentes.',
  },
  {
    runId: 'run-025',
    timestamp: '2026-10-01 11:36:49',
    instanceId: 'sqlfluff__sqlfluff-1625',
    repo: 'sqlfluff/sqlfluff',
    category: 'Logic Error',
    multiAgentResolved: false,
    multiAgentAttempts: 5,
    multiAgentDurationSec: 33.0,
    singleAgentResolved: false,
    singleAgentAttempts: 1,
    singleAgentDurationSec: 5.7,
    multiAgentFailureStage: 'Max Retries Exhausted',
    singleAgentFailureStage: 'Diagnosis',
    safetyHookTriggered: false,
    finalDiff: `if len(from_expression_elements) < 2 and not join_clauses: return None`,
    reviewerNotes: 'Unresolved: Rule L031 table alias false positive in BigQuery UNNEST.',
  },
];

export const SWEBENCH_CATEGORY_BREAKDOWN = [
  { category: 'Logic Error', totalTasks: 8, multiAgentSolved: 5, singleAgentSolved: 2 },
  { category: 'Boundary / Indexing', totalTasks: 6, multiAgentSolved: 3, singleAgentSolved: 1 },
  { category: 'Type / Value Error', totalTasks: 5, multiAgentSolved: 3, singleAgentSolved: 1 },
  { category: 'Missing Import / Attribute', totalTasks: 3, multiAgentSolved: 2, singleAgentSolved: 2 },
  { category: 'Exception Handling', totalTasks: 2, multiAgentSolved: 1, singleAgentSolved: 0 },
  { category: 'State / Mutation Bug', totalTasks: 1, multiAgentSolved: 0, singleAgentSolved: 0 },
];

export const PYTHON_PROJECT_FILES = [
  {
    path: 'fixit_cli.py',
    role: '100% Offline CLI Tool (Run in VS Code Without Web Browser)',
    content: `#!/usr/bin/env python3
"""
FixIt Offline CLI — Fix bugs directly in VS Code / Terminal (No Web Browser Needed)
Usage:
    python fixit_cli.py app.py tests/test_app.py --apply
"""
import argparse, difflib, fnmatch, pathlib, subprocess, sys
import urllib.request, json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5-coder:3b"

def ask_ollama(prompt: str) -> str:
    payload = json.dumps({"model": MODEL, "prompt": prompt, "stream": False}).encode()
    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())["response"].strip()

def run_pytest(test_file: str) -> tuple[bool, str]:
    proc = subprocess.run([sys.executable, "-m", "pytest", test_file, "--tb=short"], capture_output=True, text=True)
    return proc.returncode == 0, proc.stdout + proc.stderr

def main():
    parser = argparse.ArgumentParser(description="FixIt Offline 5-Agent CLI")
    parser.add_argument("target_file", help="Broken Python file (e.g. app.py)")
    parser.add_argument("test_file", help="Pytest file (e.g. tests/test_app.py)")
    parser.add_argument("--apply", action="store_true", help="Automatically write fix to target_file")
    args = parser.parse_args()

    # Safety Hook: Block editing test files
    if fnmatch.fnmatch(args.target_file, "*test*"):
        sys.exit("BLOCKED BY SAFETY HOOK: Cannot modify protected test file.")

    passed, traceback_out = run_pytest(args.test_file)
    if passed:
        print(f"✓ {args.test_file} already passes!")
        return

    original_code = pathlib.Path(args.target_file).read_text()

    for attempt in range(1, 6):
        print(f"\\n[TRY {attempt}/5] Running Triage -> Diagnosis -> Patch via local Ollama ({MODEL})...")
        diagnosis = ask_ollama(f"Diagnose why this test fails in 1 sentence:\\nCode:\\n{original_code}\\nError:\\n{traceback_out}")
        print(f"  02 DIAGNOSE › {diagnosis}")

        fixed_code = ask_ollama(f"Return ONLY valid Python code fixing the bug in {args.target_file}:\\n{original_code}\\nDiagnosis: {diagnosis}")
        fixed_code = fixed_code.replace("\`\`\`python", "").replace("\`\`\`", "").strip()

        # Show surgical diff in terminal
        diff = list(difflib.unified_diff(
            original_code.splitlines(keepends=True),
            fixed_code.splitlines(keepends=True),
            fromfile=f"a/{args.target_file}",
            tofile=f"b/{args.target_file}",
        ))
        print("".join(diff))

        # Test candidate fix
        pathlib.Path(args.target_file).write_text(fixed_code + "\\n")
        passed, traceback_out = run_pytest(args.test_file)
        if passed:
            print(f"  05 PYTEST   › ✓ ALL TESTS PASSED on Try #{attempt}!")
            if not args.apply:
                ans = input(f"Keep fix in {args.target_file}? [Y/n]: ").strip().lower()
                if ans == "n":
                    pathlib.Path(args.target_file).write_text(original_code)
            return
        print(f"  05 PYTEST   › ✗ Failed, looping back to Diagnosis...")

    pathlib.Path(args.target_file).write_text(original_code)
    print("✗ Could not resolve after 5 attempts. Reverted file.")

if __name__ == "__main__":
    main()`,
  },
  {
    path: 'agents/orchestrator.py',
    role: 'LangGraph 5-Agent StateGraph & Retry Loop',
    content: `from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional
from agents.triage import run_triage_agent
from agents.diagnosis import run_diagnosis_agent
from agents.patch import run_patch_agent
from hooks.safety_hook import verify_patch_safety
from sandbox.docker_runner import execute_warm_pytest
from agents.reviewer import run_reviewer_agent

class FixItState(TypedDict):
    instance_id: str
    target_files: List[str]
    test_file: str
    traceback: str
    attempt: int
    hypothesis: Optional[str]
    unified_diff: Optional[str]
    pytest_passed: bool
    status: str

def route_after_test(state: FixItState) -> str:
    if state["pytest_passed"]:
        return "reviewer"
    if state["attempt"] >= 5:
        return END
    return "diagnosis"

workflow = StateGraph(FixItState)
workflow.add_node("triage", run_triage_agent)
workflow.add_node("diagnosis", run_diagnosis_agent)
workflow.add_node("patch", run_patch_agent)
workflow.add_node("safety", verify_patch_safety)
workflow.add_node("test_runner", execute_warm_pytest)
workflow.add_node("reviewer", run_reviewer_agent)

workflow.set_entry_point("triage")
workflow.add_edge("triage", "diagnosis")
workflow.add_edge("diagnosis", "patch")
workflow.add_edge("patch", "safety")
workflow.add_edge("safety", "test_runner")
workflow.add_conditional_edges("test_runner", route_after_test)
workflow.add_edge("reviewer", END)
app_graph = workflow.compile()`,
  },
  {
    path: 'hooks/safety_hook.py',
    role: 'Pre-Execution Anti-Tampering Guard',
    content: `import fnmatch
import yaml

def verify_patch_safety(diff_text: str, rules_path: str = "config/rules.yaml") -> dict:
    with open(rules_path, "r") as f:
        rules = yaml.safe_load(f)
    protected = rules.get("protected_patterns", ["tests/*", "test_*.py", "*_test.py"])

    touched_files = []
    for line in diff_text.splitlines():
        if line.startswith(("+++ b/", "--- a/")):
            path = line[6:].strip()
            if path not in touched_files:
                touched_files.append(path)

    for path in touched_files:
        for pattern in protected:
            if fnmatch.fnmatch(path, pattern):
                return {
                    "safe": False,
                    "reason": f"SAFETY VIOLATION: Attempted to edit protected test file {path}"
                }
    return {"safe": True, "touched_files": touched_files}`,
  },
  {
    path: 'sandbox/docker_runner.py',
    role: 'Warm Container Pool Test Executor',
    content: `import subprocess

def execute_warm_pytest(diff_text: str, test_file: str, container: str = "fixit-warm-worker") -> dict:
    """Applies unified diff inside pre-warmed Docker container and runs pytest/vitest."""
    runner = "npx vitest run" if test_file.endswith((".ts", ".js")) else "pytest"
    cmd = ["docker", "exec", container, "sh", "-c", f"git apply - && {runner} {test_file}"]
    proc = subprocess.run(cmd, input=diff_text, text=True, capture_output=True, timeout=30)
    return {
        "pytest_passed": proc.returncode == 0,
        "exit_code": proc.returncode,
        "stdout": proc.stdout + proc.stderr,
    }`,
  },
];

