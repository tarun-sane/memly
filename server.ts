import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create a valid minimal solid PNG buffer of any dimension (for PWA icons)
function createMinimalPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = width * 3 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      // Draw a subtle inner architectural frame
      const border = Math.floor(width * 0.18);
      const isFrame =
        (x === border || x === width - border || y === border || y === height - border) &&
        x >= border &&
        x <= width - border &&
        y >= border &&
        y <= height - border;
      if (isFrame) {
        rawData[px] = 250;
        rawData[px + 1] = 250;
        rawData[px + 2] = 250;
      } else {
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
      }
    }
  }

  const idat = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

function ensurePwaIcons() {
  const publicDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const icons = [
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'pwa-maskable-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];
  for (const icon of icons) {
    const filePath = path.join(publicDir, icon.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, createMinimalPng(icon.size, icon.size, 116, 165, 127));
    }
  }
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  ensurePwaIcons();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // 1. Local Open-Source AI Proxy (Ollama / llama.cpp / LM Studio for gemma4:e2b etc.)
  app.post('/api/local-ai/status', async (req, res) => {
    const { endpoint = 'http://127.0.0.1:11434', provider = 'ollama' } = req.body || {};
    const cleanBase = String(endpoint).replace(/\/+$/, '');
    const startTime = Date.now();

    try {
      const targetUrl =
        provider === 'ollama' ? `${cleanBase}/api/tags` : `${cleanBase}/v1/models`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(502).json({
          online: false,
          latencyMs: Date.now() - startTime,
          error: `Local endpoint returned HTTP ${response.status}`,
        });
      }

      const data = (await response.json()) as {
        models?: Array<{ name?: string; model?: string }>;
        data?: Array<{ id?: string }>;
      };
      const models =
        provider === 'ollama'
          ? (data.models || []).map((m) => m.name || m.model || 'unknown')
          : (data.data || []).map((m) => m.id || 'unknown');

      return res.json({
        online: true,
        latencyMs: Date.now() - startTime,
        models,
      });
    } catch (err) {
      return res.json({
        online: false,
        latencyMs: Date.now() - startTime,
        models: [],
        error: err instanceof Error ? err.message : 'Local AI runtime unreachable from server host',
      });
    }
  });

  app.post('/api/local-ai/generate', async (req, res) => {
    const {
      endpoint = 'http://127.0.0.1:11434',
      provider = 'ollama',
      model = 'gemma4:e2b',
      prompt,
      systemInstruction,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const cleanBase = String(endpoint).replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      if (provider === 'ollama') {
        const response = await fetch(`${cleanBase}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            system: systemInstruction,
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: errText || 'Ollama generation failed' });
        }

        const data = (await response.json()) as { response?: string; model?: string };
        return res.json({
          text: data.response || '',
          modelUsed: data.model || model,
          source: 'local-ollama',
        });
      } else {
        // OpenAI-compatible local server (LM Studio, llama.cpp, vLLM)
        const response = await fetch(`${cleanBase}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
              { role: 'user', content: prompt },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: errText || 'Local OpenAI server failed' });
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          model?: string;
        };
        return res.json({
          text: data.choices?.[0]?.message?.content || '',
          modelUsed: data.model || model,
          source: 'local-openai',
        });
      }
    } catch (err) {
      return res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to connect to local model endpoint',
      });
    }
  });

  // 2. Server-Side Gemini API Routes (Cloud Sanctuary Engine & Seamless Fallback)
  app.post('/api/ai/synthesize', async (req, res) => {
    try {
      const { firstMemory, secondMemory } = req.body || {};
      if (!firstMemory || !secondMemory) {
        return res.status(400).json({ error: 'Both firstMemory and secondMemory are required.' });
      }

      const ai = getGenAIClient();
      const prompt = `You are the archivist of memly, a philosophical and architectural memory sanctuary.
Juxtapose these two past archive entries and synthesize a new, original conceptual Idea or Epiphany that bridges them:

Entry A (${firstMemory.indexCode}, ${firstMemory.createdAt}, ${firstMemory.domain}, ${firstMemory.location || 'Archive'}):
Title: ${firstMemory.title}
Content: ${firstMemory.content}

Entry B (${secondMemory.indexCode}, ${secondMemory.createdAt}, ${secondMemory.domain}, ${secondMemory.location || 'Archive'}):
Title: ${secondMemory.title}
Content: ${secondMemory.content}

Respond in JSON matching the schema with:
- title: An evocative, poetic, and rigorous editorial title (8-13 words).
- synthesisEssay: A two-paragraph reflective synthesis (120-180 words) explaining the hidden structural, sensory, or philosophical bridge between Entry A and Entry B.
- sharedThemes: 4 concise lowercase index descriptor tags.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              synthesisEssay: { type: Type.STRING },
              sharedThemes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['title', 'synthesisEssay', 'sharedThemes'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        ...parsed,
        modelUsed: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini synthesis error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'AI synthesis failed',
      });
    }
  });

  app.post('/api/ai/interrogate', async (req, res) => {
    try {
      const { question, memories } = req.body || {};
      if (!question || !Array.isArray(memories)) {
        return res.status(400).json({ error: 'question and memories array are required.' });
      }

      const archiveContext = memories
        .map(
          (m: {
            indexCode: string;
            createdAt: string;
            kind: string;
            domain: string;
            location?: string;
            title: string;
            content: string;
            tags?: string[];
          }) =>
            `[${m.indexCode}] (${m.createdAt} · ${m.kind} · ${m.domain}${m.location ? ` · ${m.location}` : ''})\nTitle: ${m.title}\nText: ${m.content}\nTags: ${(m.tags || []).join(', ')}`
        )
        .join('\n\n---\n\n');

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Archive Corpus:\n${archiveContext}\n\nArchivist Question: ${question}`,
        config: {
          systemInstruction:
            'You are the memly Archivist. Answer the user’s question by drawing connections across their saved memories and ideas. Always cite specific entries using their exact index code in brackets like [MNM-001] or [MNM-004]. Keep your prose refined, insightful, and concise (2-3 paragraphs).',
        },
      });

      return res.json({
        answer: response.text ?? '',
        modelUsed: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini interrogation error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Archive interrogation failed',
      });
    }
  });

  app.post('/api/ai/analyze-entry', async (req, res) => {
    try {
      const { entry, allMemories } = req.body || {};
      if (!entry) {
        return res.status(400).json({ error: 'entry is required.' });
      }

      const otherSummaries = (allMemories || [])
        .filter((m: { id: string }) => m.id !== entry.id)
        .map(
          (m: { indexCode: string; title: string; domain: string; createdAt: string }) =>
            `${m.indexCode} (${m.createdAt.slice(0, 4)}, ${m.domain}): ${m.title}`
        )
        .join('\n');

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze this memory/idea entry and identify its deepest philosophical/architectural motif, 1 recall question for spaced-repetition testing, and which existing entry from the archive it resonates with most.\n\nEntry (${entry.indexCode}): ${entry.title}\n${entry.content}\n\nOther Archive Entries:\n${otherSummaries}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              coreMotif: {
                type: Type.STRING,
                description: 'A 1-2 sentence distillation of the hidden philosophical or structural motif.',
              },
              recallPrompt: {
                type: Type.STRING,
                description: 'A thoughtful active-recall question to test memory retention of this entry later.',
              },
              suggestedConnectionCode: {
                type: Type.STRING,
                description: 'The indexCode (e.g. MNM-004) of the most resonant entry in the archive.',
              },
              connectionRationale: {
                type: Type.STRING,
                description: 'Why this entry connects to the suggested entry in 1 sentence.',
              },
              suggestedTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'coreMotif',
              'recallPrompt',
              'suggestedConnectionCode',
              'connectionRationale',
              'suggestedTags',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        ...parsed,
        modelUsed: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini analyze-entry error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Entry analysis failed',
      });
    }
  });

  const PORT = Number(process.env.PORT) || 3000;
  const { createServer: createHttpServer } = await import('http');
  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? { server: httpServer } : false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`memly Sanctuary server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
