import { AIReflectionNote, LocalAIConfig, MemoryEntry } from '../types/memory';

export interface LocalAIHealthResult {
  online: boolean;
  latencyMs: number;
  models: string[];
  connectionMethod: 'browser-direct' | 'local-server-proxy' | 'offline';
  error?: string;
}

/**
 * Checks whether the user's local open-source AI runtime (Ollama / LM Studio running gemma4:e2b)
 * is reachable either directly from the browser (localhost) or via the local Express server proxy.
 */
export async function checkLocalAIHealth(config: LocalAIConfig): Promise<LocalAIHealthResult> {
  const cleanEndpoint = config.endpoint.replace(/\/+$/, '');
  const start = performance.now();

  // 1. Try direct browser connection to the user's local machine (works even when app is hosted in cloud if OLLAMA_ORIGINS="*" is set)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const url =
      config.engineMode === 'local-ollama'
        ? `${cleanEndpoint}/api/tags`
        : `${cleanEndpoint}/v1/models`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const models: string[] =
        config.engineMode === 'local-ollama'
          ? (data.models || []).map((m: { name?: string; model?: string }) => m.name || m.model || '')
          : (data.data || []).map((m: { id?: string }) => m.id || '');
      return {
        online: true,
        latencyMs: Math.round(performance.now() - start),
        models: models.filter(Boolean),
        connectionMethod: 'browser-direct',
      };
    }
  } catch {
    // Fall through to local server proxy check
  }

  // 2. Try via the Express server proxy (works automatically when running npm run dev locally without CORS headers)
  try {
    const res = await fetch('/api/local-ai/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: cleanEndpoint,
        provider: config.engineMode === 'local-ollama' ? 'ollama' : 'openai',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.online) {
        return {
          online: true,
          latencyMs: data.latencyMs || Math.round(performance.now() - start),
          models: data.models || [],
          connectionMethod: 'local-server-proxy',
        };
      }
    }
  } catch {
    // Ignore
  }

  return {
    online: false,
    latencyMs: Math.round(performance.now() - start),
    models: [],
    connectionMethod: 'offline',
    error: `Local runtime at ${cleanEndpoint} is not currently responding.`,
  };
}

/**
 * Generates text from the user's local open-source model (e.g. gemma4:e2b) via browser-direct or server proxy.
 */
async function generateWithLocalModel(
  config: LocalAIConfig,
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelLabel: string }> {
  const cleanEndpoint = config.endpoint.replace(/\/+$/, '');
  const provider = config.engineMode === 'local-ollama' ? 'ollama' : 'openai';

  // Try direct browser fetch to localhost first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    if (provider === 'ollama') {
      const res = await fetch(`${cleanEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelTag,
          prompt,
          system: systemInstruction,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        return {
          text: data.response || '',
          modelLabel: `${config.modelTag} · Local Ollama`,
        };
      }
    } else {
      const res = await fetch(`${cleanEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelTag,
          messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        return {
          text: data.choices?.[0]?.message?.content || '',
          modelLabel: `${config.modelTag} · Local OpenAI Engine`,
        };
      }
    }
  } catch {
    // Fall through to Express proxy
  }

  // Try Express local proxy
  const proxyRes = await fetch('/api/local-ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: cleanEndpoint,
      provider,
      model: config.modelTag,
      prompt,
      systemInstruction,
    }),
  });

  if (!proxyRes.ok) {
    throw new Error(`Local model ${config.modelTag} at ${cleanEndpoint} is unreachable.`);
  }

  const proxyData = await proxyRes.json();
  return {
    text: proxyData.text || '',
    modelLabel: `${config.modelTag} · Local Runtime`,
  };
}

/**
 * Synthesizes two past memories into a new conceptual idea using either Local Open-Source AI (gemma4:e2b)
 * or Server-Side Gemini API.
 */
export async function synthesizeMemoryPair(
  firstMemory: MemoryEntry,
  secondMemory: MemoryEntry,
  config: LocalAIConfig
): Promise<{
  title: string;
  synthesisEssay: string;
  sharedThemes: string[];
  modelUsed: string;
}> {
  if (config.engineMode !== 'cloud-gemini') {
    try {
      const prompt = `Synthesize a new philosophical or architectural idea that bridges these two past memories:
Memory 1 (${firstMemory.indexCode}, ${firstMemory.createdAt}): ${firstMemory.title} — ${firstMemory.content}
Memory 2 (${secondMemory.indexCode}, ${secondMemory.createdAt}): ${secondMemory.title} — ${secondMemory.content}

Format your response strictly as JSON with keys:
"title": "An evocative 8-12 word title",
"synthesisEssay": "A two-paragraph reflective synthesis (120-160 words)",
"sharedThemes": ["tag1", "tag2", "tag3", "tag4"]`;

      const { text, modelLabel } = await generateWithLocalModel(
        config,
        prompt,
        'You are the archivist of Mnemosyne. Output valid JSON only.'
      );
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || `Bridge: ${firstMemory.indexCode} & ${secondMemory.indexCode}`,
          synthesisEssay: parsed.synthesisEssay || text,
          sharedThemes: Array.isArray(parsed.sharedThemes)
            ? parsed.sharedThemes.map(String)
            : ['synthesis', 'bridge'],
          modelUsed: modelLabel,
        };
      }
      return {
        title: `Harmonic Bridge: ${firstMemory.title.slice(0, 24)} & ${secondMemory.title.slice(0, 24)}`,
        synthesisEssay: text.trim(),
        sharedThemes: ['synthesis', 'local-ai'],
        modelUsed: modelLabel,
      };
    } catch (err) {
      if (!config.autoFallbackToCloud) {
        throw err;
      }
    }
  }

  const res = await fetch('/api/ai/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstMemory, secondMemory }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Synthesis request failed');
  }

  const data = await res.json();
  return {
    title: data.title,
    synthesisEssay: data.synthesisEssay,
    sharedThemes: data.sharedThemes || [],
    modelUsed:
      config.engineMode !== 'cloud-gemini'
        ? `${data.modelUsed} (Cloud Fallback — Local ${config.modelTag} Offline)`
        : `${data.modelUsed} · Cloud Sanctuary`,
  };
}

/**
 * Interrogates the entire memory archive in natural language using gemma4:e2b or Gemini.
 */
export async function interrogateArchive(
  question: string,
  memories: MemoryEntry[],
  config: LocalAIConfig
): Promise<{ answer: string; modelUsed: string }> {
  if (config.engineMode !== 'cloud-gemini') {
    try {
      const context = memories
        .map(
          (m) =>
            `[${m.indexCode}] (${m.createdAt} · ${m.domain}): ${m.title}\n${m.excerpt}`
        )
        .join('\n\n');
      const prompt = `Archive Entries:\n${context}\n\nQuestion: ${question}\n\nAnswer thoughtfully in 2 paragraphs, citing entries by their code like [MNM-001].`;

      const { text, modelLabel } = await generateWithLocalModel(
        config,
        prompt,
        'You are the Mnemosyne Archivist. Ground your answer in the user’s saved memories and cite [MNM-XXX] codes.'
      );
      return { answer: text.trim(), modelUsed: modelLabel };
    } catch (err) {
      if (!config.autoFallbackToCloud) {
        throw err;
      }
    }
  }

  const res = await fetch('/api/ai/interrogate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, memories }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Archive interrogation failed');
  }

  const data = await res.json();
  return {
    answer: data.answer,
    modelUsed:
      config.engineMode !== 'cloud-gemini'
        ? `${data.modelUsed} (Cloud Fallback — Local ${config.modelTag} Offline)`
        : `${data.modelUsed} · Cloud Sanctuary`,
  };
}

/**
 * Generates a deep structural & philosophical reflection for a single memory entry.
 */
export async function analyzeMemoryEntry(
  entry: MemoryEntry,
  allMemories: MemoryEntry[],
  config: LocalAIConfig
): Promise<AIReflectionNote> {
  if (config.engineMode !== 'cloud-gemini') {
    try {
      const otherList = allMemories
        .filter((m) => m.id !== entry.id)
        .map((m) => `${m.indexCode}: ${m.title}`)
        .join('; ');
      const prompt = `Analyze this memory entry (${entry.indexCode}: ${entry.title}):
"${entry.content}"
Other entries in archive: ${otherList}

Return JSON only with keys:
"coreMotif": "1-2 sentence philosophical motif",
"recallPrompt": "1 active-recall question to test memory of this entry later",
"suggestedConnectionCode": "MNM-XXX code of most related entry",
"connectionRationale": "1 sentence explaining why they connect",
"suggestedTags": ["tag1", "tag2", "tag3"]`;

      const { text, modelLabel } = await generateWithLocalModel(
        config,
        prompt,
        'You are the memly Archivist. Respond with valid JSON only.'
      );
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          coreMotif: parsed.coreMotif || text.slice(0, 180),
          recallPrompt:
            parsed.recallPrompt || `What sensory detail anchored "${entry.title}"?`,
          suggestedConnectionCode: parsed.suggestedConnectionCode || 'MNM-001',
          connectionRationale:
            parsed.connectionRationale || 'Shared thematic resonance across time.',
          suggestedTags: Array.isArray(parsed.suggestedTags)
            ? parsed.suggestedTags.map(String)
            : entry.tags,
          modelUsed: modelLabel,
        };
      }
    } catch (err) {
      if (!config.autoFallbackToCloud) {
        throw err;
      }
    }
  }

  const res = await fetch('/api/ai/analyze-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry, allMemories }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Entry analysis failed');
  }

  const data = await res.json();
  return {
    coreMotif: data.coreMotif,
    recallPrompt: data.recallPrompt,
    suggestedConnectionCode: data.suggestedConnectionCode,
    connectionRationale: data.connectionRationale,
    suggestedTags: data.suggestedTags || [],
    modelUsed:
      config.engineMode !== 'cloud-gemini'
        ? `${data.modelUsed} (Cloud Fallback — Local ${config.modelTag} Offline)`
        : `${data.modelUsed} · Cloud Sanctuary`,
  };
}

/**
 * Transcribes recorded voice audio using a local Faster-Whisper server
 * (e.g., faster-whisper-server on http://localhost:8000/v1/audio/transcriptions)
 * as part of Stage 2 of the aoyu Engine pipeline.
 */
export async function transcribeWithFasterWhisper(
  audioBlob: Blob,
  config: LocalAIConfig
): Promise<{ text: string; modelUsed: string } | null> {
  const whisperBase = (config.whisperEndpoint || 'http://localhost:8000').replace(/\/+$/, '');
  const whisperModel = config.whisperModel || 'Systran/faster-whisper-small';

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice-memory.webm');
    formData.append('model', whisperModel);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${whisperBase}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.text === 'string' && data.text.trim()) {
        return {
          text: data.text.trim(),
          modelUsed: `Faster-Whisper (${whisperModel}) · Local`,
        };
      }
    }
  } catch {
    // Faster-Whisper endpoint not running directly or blocked by CORS
  }

  return null;
}

export { suggestTagsFromContent, extractEntitiesFromContent } from './tagSuggestions';

