import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;

function createGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function checkSafetyHook(diffText: string, protectedPatterns: string[]) {
  const touchedFiles: string[] = [];
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ b/') || line.startsWith('--- a/')) {
      const f = line.slice(6).trim();
      if (f && f !== '/dev/null' && !touchedFiles.includes(f)) {
        touchedFiles.push(f);
      }
    }
  }

  for (const file of touchedFiles) {
    const base = file.split('/').pop() || file;
    const isTestFile =
      file.startsWith('tests/') ||
      file.includes('/tests/') ||
      base.startsWith('test_') ||
      base.endsWith('_test.py') ||
      base === 'conftest.py' ||
      protectedPatterns.some((p) => {
        const clean = p.replace(/\*/g, '');
        return clean && file.includes(clean);
      });

    if (isTestFile) {
      return {
        safe: false,
        touchedFiles,
        reason: `BLOCKED BY SAFETY HOOK: Patch modifies protected test file '${file}'. Agents are prohibited from weakening unit tests.`,
      };
    }
  }

  return {
    safe: true,
    touchedFiles: touchedFiles.length > 0 ? touchedFiles : ['target_module.py'],
    reason: 'Verified patch modifies only source implementation files.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/analyze-custom-bug', async (req, res) => {
    const {
      targetFile = 'module.py',
      testFile = 'tests/test_module.py',
      traceback = '',
      sourceSnippet = '',
      protectedPatterns = ['tests/*', 'test_*.py', '*_test.py', 'conftest.py'],
      injectTestTampering = false,
    } = req.body || {};

    const ai = createGenAIClient();

    if (!ai) {
      return res.status(503).json({
        error: 'Live model runtime unavailable; using local deterministic trace engine.',
      });
    }

    try {
      const prompt = `You are the FixIt 5-Agent Code Repair Engine (Triage, Diagnosis, Patch, Test-Runner, Reviewer).
Inspect the uploaded source file ("${targetFile}") and error log/traceback carefully.
Look for ALL bugs including:
- Python IndentationError (e.g., an 'if', 'elif', 'else', 'for', 'while', 'def', 'try', 'except' statement without an indented block before the next statement or 'def')
- SyntaxError (missing colons, unmatched parentheses)
- Runtime errors (ZeroDivisionError, IndexError, KeyError, TypeError)
- Logic or arithmetic bugs

Target implementation file: ${targetFile}
Test file: ${testFile}
Failing test & traceback:
${traceback}

Source code:
${sourceSnippet}

Generate:
1. A valid unified diff ("unifiedDiff") on "${targetFile}" fixing all errors.
2. The complete, syntactically valid fixed file ("fixedFullCode") with 100% valid indentation so running "py ${targetFile}" succeeds without any IndentationError or SyntaxError.

Return a JSON object matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bugCategory: {
                type: Type.STRING,
                description: 'One of: Logic Error, Type / Value Error, Boundary / Indexing, Missing Import / Attribute, State / Mutation Bug, Exception Handling',
              },
              suspiciousLines: { type: Type.STRING },
              hypothesis: { type: Type.STRING },
              rootCauseDetail: { type: Type.STRING },
              unifiedDiff: {
                type: Type.STRING,
                description: 'Standard unified diff starting with --- a/... and +++ b/...',
              },
              fixedFullCode: {
                type: Type.STRING,
                description: 'The complete fixed source code of the entire file with valid Python/code indentation.',
              },
              pytestStdout: { type: Type.STRING },
              plainEnglishExplanation: { type: Type.STRING },
              singleAgentDiff: { type: Type.STRING },
              singleAgentResolved: { type: Type.BOOLEAN },
              singleAgentSummary: { type: Type.STRING },
            },
            required: [
              'bugCategory',
              'suspiciousLines',
              'hypothesis',
              'rootCauseDetail',
              'unifiedDiff',
              'fixedFullCode',
              'pytestStdout',
              'plainEnglishExplanation',
              'singleAgentDiff',
              'singleAgentResolved',
              'singleAgentSummary',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const safetyCheck = checkSafetyHook(parsed.unifiedDiff || '', protectedPatterns);

      return res.json({
        ...parsed,
        safetyCheck,
      });
    } catch (err: any) {
      console.error('Error in /api/analyze-custom-bug:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to execute live agent pipeline.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FixIt Research Workbench running on http://localhost:${PORT}`);
  });
}

startServer();
