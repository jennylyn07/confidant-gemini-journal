import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. Top-Level Request Deserialization (Mandatory Ordering Guarantee)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize GoogleGenAI lazily and cache instance to reuse HTTP keep-alive connections
let geminiClientInstance: GoogleGenAI | null = null;
const getGeminiClient = () => {
  if (!geminiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is missing.');
    }
    geminiClientInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return geminiClientInstance;
};

// Resilient Model Fallback Ladder (Ordered by availability & latency per Directive #6)
const FALLBACK_MODELS = [
  'gemini-3.6-flash',      // Primary high-speed reasoning model
  'gemini-3.1-flash-lite',  // High-availability low-latency fallback
  'gemini-flash-latest',   // Dynamic alias for latest available Flash model
  'gemini-3.7-flash',      // Deep reasoning fallback
];

interface FallbackOptions {
  systemInstruction?: string;
  temperature?: number;
}

// Helper to extract clean human-readable error messages from GenAI SDK error payloads
function parseGenAIError(err: any): { message: string; isRecoverable: boolean; code?: number | string } {
  const rawMsg = err?.message || (typeof err === 'string' ? err : '');
  let code: number | string | undefined = err?.status || err?.code;
  let cleanMsg = rawMsg;

  try {
    // If error message is a serialized JSON object from Google APIs
    if (rawMsg.trim().startsWith('{') && rawMsg.trim().endsWith('}')) {
      const parsed = JSON.parse(rawMsg.trim());
      if (parsed?.error) {
        code = parsed.error.code || parsed.error.status || code;
        cleanMsg = parsed.error.message || cleanMsg;
      }
    }
  } catch {
    // Keep fallback text
  }

  const lowerMsg = cleanMsg.toLowerCase();
  const lowerCode = String(code || '').toLowerCase();

  // Recognize network transport drops, rate limits, surges, and transient service errors as recoverable
  const isRecoverable =
    code === 503 ||
    code === 429 ||
    code === 404 ||
    code === 500 ||
    code === 502 ||
    code === 504 ||
    lowerCode.includes('unavailable') ||
    lowerCode.includes('resource_exhausted') ||
    lowerCode.includes('econnreset') ||
    lowerCode.includes('etimedout') ||
    lowerCode.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('high demand') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('try again later') ||
    lowerMsg.includes('overloaded');

  return { message: cleanMsg, isRecoverable, code };
}

async function generateContentWithFallback(
  contents: any,
  options: FallbackOptions = {}
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastErrorSummary: string = '';

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
        },
      });

      const extractedText =
        response?.text ||
        response?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ||
        '';

      if (extractedText.trim().length > 0) {
        return { text: extractedText, modelUsed: model };
      }
    } catch (err: any) {
      const { message, code } = parseGenAIError(err);
      lastErrorSummary = message;

      console.info(
        `[Gemini Fallback Matrix] Tier ${i + 1} (${model}) temporarily unreachable (${message}${code ? `, code: ${code}` : ''}). Advancing to tier ${i + 2}...`
      );
      // Seamlessly advance to the next model in the fallback ladder
    }
  }

  throw new Error(
    lastErrorSummary
      ? `AI reflection service is currently busy (${lastErrorSummary}). Please retry in a few moments.`
      : 'All Gemini models in fallback ladder are currently unreachable. Please retry.'
  );
}

// 2. Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 3. Shared Reflection & Brainstorming Handler
async function handleReflectionRequest(req: Request, res: Response, forcedMode?: string) {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const history = Array.isArray(body.history) ? body.history : [];
    const mode = forcedMode || (typeof body.mode === 'string' ? body.mode : 'reflection');

    if (!prompt && history.length === 0) {
      return res.status(400).json({ error: 'Prompt or conversation history is required.' });
    }

    let systemInstruction = `You are Confidant, an insightful, compassionate, and sharp reflection partner and thought companion.
You help the user explore their thoughts, reflect on experiences, gain emotional clarity, brainstorm possibilities, and distill actionable next steps.
Format your responses using clean Markdown with readable paragraphs, bullet points when appropriate, and thoughtful follow-up questions.`;

    if (mode === 'summary') {
      systemInstruction += `\nMode: EXECUTIVE SUMMARY. Synthesize key themes, emotional highlights, core challenges, and milestones from the journal entry into a clear, elegant summary.`;
    } else if (mode === 'brainstorm') {
      systemInstruction += `\nMode: CREATIVE BRAINSTORMING. Generate innovative angles, diverse perspectives, alternative approaches, and stimulating ideas based on what the user shared.`;
    } else if (mode === 'action_plan') {
      systemInstruction += `\nMode: ACTIONABLE NEXT STEPS. Break down the user's reflection into practical, high-impact action items with prioritized milestones and gentle accountability.`;
    } else {
      systemInstruction += `\nMode: DEEP REFLECTION. Offer empathetic insights, identify patterns or cognitive reframes, validate feelings, and ask 1-2 open-ended reflective questions to deepen self-awareness.`;
    }

    // Build Gemini contents array from history
    const contents: any[] = [];

    for (const msg of history) {
      if (msg && typeof msg.content === 'string' && msg.content.trim()) {
        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    if (prompt) {
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });
    }

    const { text, modelUsed } = await generateContentWithFallback(contents, {
      systemInstruction,
      temperature: mode === 'brainstorm' ? 0.9 : 0.6,
    });

    return res.json({
      text,
      modelUsed,
      mode,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in reflection/brainstorm handler:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate reflection with Gemini.',
    });
  }
}

// 4. Primary Multi-turn Reflection Endpoint
app.post('/api/gemini/reflect', (req: Request, res: Response) => {
  return handleReflectionRequest(req, res);
});

// 5. Dedicated Brainstorm Ideas Endpoint
app.post('/api/gemini/brainstorm', (req: Request, res: Response) => {
  return handleReflectionRequest(req, res, 'brainstorm');
});

// 6. Dedicated Action Plan Endpoint
app.post(['/api/gemini/action_plan', '/api/gemini/action-plan'], (req: Request, res: Response) => {
  return handleReflectionRequest(req, res, 'action_plan');
});

// 7. Summarize and Tag Entry Endpoint
app.post('/api/gemini/summarize', async (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const textContent = typeof body.text === 'string' ? body.text.trim() : '';

    if (!textContent) {
      return res.status(400).json({ error: 'Text content is required for summarization.' });
    }

    const systemInstruction = `You are a reflection analyst. Given a journal entry or reflection conversation, extract:
1. A concise, evocative title (under 8 words).
2. A 1-2 sentence executive summary.
3. 3-4 thematic tags (lowercase, hyphenated if multi-word, e.g. ["gratitude", "career-growth", "mindfulness"]).
4. Suggested primary mood/state (choose from: "reflective", "energized", "calm", "focused", "curious", "grateful", "overwhelmed").

Return ONLY valid JSON matching this schema:
{
  "title": "string",
  "summary": "string",
  "tags": ["string"],
  "mood": "string"
}`;

    const { text } = await generateContentWithFallback(
      [{ role: 'user', parts: [{ text: textContent }] }],
      { systemInstruction, temperature: 0.3 }
    );

    // Clean JSON response from markdown wrappers if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    const parsed = JSON.parse(cleaned.trim());
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/summarize:', error);
    // Return graceful fallback
    return res.json({
      title: 'Personal Reflection',
      summary: 'A thoughtful reflection entry.',
      tags: ['journal', 'reflection'],
      mood: 'reflective',
    });
  }
});

// 8. Catch-all JSON 404 for unhandled API routes (prevents Vite SPA fallback from returning HTML)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 9. Start Server with Vite Middleware in Development / Static Dist in Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Confidant server running on http://localhost:${PORT}`);
  });
}

startServer();
