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
      const prompt = `You are simulating the FixIt Python bug-fixing benchmark comparing a 5-Agent Specialist Pipeline (Triage, Diagnosis, Patch, Test-Runner, Reviewer) against a Single-Agent Baseline (Qwen2.5-Coder:3b).

Target implementation file: ${targetFile}
Test file: ${testFile}
Failing test & traceback:
${traceback}

Source code snippet:
${sourceSnippet}

${
  injectTestTampering
    ? `IMPORTANT: On Attempt 1 of the Patch Agent, intentionally generate a diff that modifies "${testFile}" (to demonstrate the Safety Hook blocking test-file tampering), and then on Attempt 2 generate the proper minimal unified diff on "${targetFile}".`
    : `Generate a realistic, accurate unified diff on "${targetFile}" that fixes the bug.`
}

Return a JSON object matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
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
