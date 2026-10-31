import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Cpu,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Layers,
  Mic,
  RefreshCw,
  Terminal,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { LocalAIConfig, MemoryEntry } from '../types/memory';
import {
  exportArchiveAsCsv,
  exportArchiveAsJson,
  exportArchiveAsMarkdown,
  parseImportedArchiveJson,
} from '../utils/archiveIO';
import { checkLocalAIHealth, LocalAIHealthResult } from '../utils/aiClient';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface LocalAIAndVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryEntry[];
  onImportMemories: (entries: MemoryEntry[], mode: 'merge' | 'replace') => void;
  aiConfig: LocalAIConfig;
  onUpdateAIConfig: (newConfig: LocalAIConfig) => void;
  inlinePage?: boolean;
}

const PRESET_LOCAL_MODELS = [
  { tag: 'gemma4:e2b', label: 'Gemma 4 E2B (Recommended Edge 2B)' },
  { tag: 'gemma3:4b', label: 'Gemma 3 4B' },
  { tag: 'llama3.2:3b', label: 'Llama 3.2 3B' },
  { tag: 'qwen2.5:3b', label: 'Qwen 2.5 3B' },
];

const AOYU_PIPELINE_STAGES = [
  {
    step: '01',
    title: 'Extracts file metadata & validates uploaded content',
    model: 'Local File & MIME Validator',
    status: 'Active Locally',
    desc: 'Validates manuscript text, audio streams, image attachments, and JSON schema integrity before pipeline execution.',
  },
  {
    step: '02',
    title: 'Transcribes audio using local open-source voice models',
    model: 'Faster-Whisper / On-Device STT',
    status: 'Active Locally',
    desc: 'Converts spoken voice recordings from the microphone into structured text using local Faster-Whisper (localhost:8000) or on-device speech recognition.',
  },
  {
    step: '03',
    title: 'Analyzes photographs using Moondream',
    model: 'Moondream Vision 2B',
    status: 'In Feature · Coming Soon...',
    desc: 'Extracts visual descriptions, architectural motifs, and scene lighting from attached photographs entirely on-device.',
  },
  {
    step: '04',
    title: 'Generates summaries using local language models',
    model: 'Gemma 4 E2B / Llama 3.2 / Qwen 2.5',
    status: 'Active Locally',
    desc: 'Distills long-form memories into concise editorial excerpts, philosophical motifs, and active-recall prompts via Ollama or LM Studio.',
  },
  {
    step: '05',
    title: 'Extracts entities such as people, locations, dates, and themes',
    model: 'aoyu NLP Entity & Tag Engine',
    status: 'Active Locally',
    desc: 'Identifies proper names, geographic places, temporal anchors, and thematic tag suggestions as selectable chips.',
  },
  {
    step: '06',
    title: 'Converts content into vector embeddings using Nomic Embed Text',
    model: 'nomic-embed-text',
    status: 'In-Future · Coming Soon...',
    desc: 'Generates high-dimensional local semantic vectors for deep cross-archive similarity search and clustering.',
  },
  {
    step: '07',
    title: 'Stores the processed information locally',
    model: 'Device LocalStorage & Portable JSON Vault',
    status: 'Active Locally',
    desc: 'Persists manuscripts, voice recordings, entities, and connections directly on your machine with zero cloud lock-in.',
  },
];

export const LocalAIAndVaultModal: React.FC<LocalAIAndVaultModalProps> = ({
  isOpen,
  onClose,
  memories,
  onImportMemories,
  aiConfig,
  onUpdateAIConfig,
  inlinePage = false,
}) => {
  const [activeSection, setActiveSection] = useState<
    'local-ai' | 'aoyu-pipeline' | 'local-run' | 'backup'
  >('local-ai');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [health, setHealth] = useState<LocalAIHealthResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    if ((isOpen || inlinePage) && activeSection === 'local-ai') {
      handleTestConnection();
    }
  }, [isOpen, inlinePage, activeSection]);

  if (!isOpen && !inlinePage) return null;

  const archiveSizeBytes = new Blob([JSON.stringify(memories, null, 2)]).size;
  const formattedBytes =
    archiveSizeBytes > 1024
      ? `${(archiveSizeBytes / 1024).toFixed(1)} KB`
      : `${archiveSizeBytes} B`;

  const handleTestConnection = async () => {
    setIsCheckingHealth(true);
    try {
      const result = await checkLocalAIHealth(aiConfig);
      setHealth(result);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleExportJson = () => {
    const filename = exportArchiveAsJson(memories);
    setExportStatus(`Exported ${filename}`);
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleExportMarkdown = () => {
    const filename = exportArchiveAsMarkdown(memories);
    setExportStatus(`Exported ${filename}`);
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleExportCsv = () => {
    const filename = exportArchiveAsCsv(memories);
    setExportStatus(`Exported ${filename}`);
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const importedEntries = parseImportedArchiveJson(text);
        onImportMemories(importedEntries, importMode);
        setImportFeedback({
          type: 'success',
          message: `Successfully ${
            importMode === 'merge' ? 'merged' : 'restored'
          } ${importedEntries.length} entries from ${file.name}.`,
        });
      } catch (err) {
        setImportFeedback({
          type: 'error',
          message:
            err instanceof Error ? err.message : 'Invalid JSON archive file format.',
        });
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const contentBody = (
    <div
      className={
        inlinePage
          ? 'bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6'
          : 'w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6'
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2
            id="vault-modal-title"
            className="font-display text-2xl font-normal text-zinc-900 dark:text-zinc-100"
          >
            Local Open-Source AI Studio, aoyu Engine &amp; Offline Vault
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Connect local open-source AI models (Gemma 4 E2B, Faster-Whisper STT), explore the 7-stage <span className="font-mono text-[#74A57F]">aoyu Engine</span> pipeline, and run <span className="font-semibold text-[#74A57F]">memly</span> 100% offline.
          </p>
        </div>
        {!inlinePage && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-[#74A57F] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveSection('local-ai')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeSection === 'local-ai'
              ? 'bg-[#74A57F] text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Connect Local AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('aoyu-pipeline')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeSection === 'aoyu-pipeline'
              ? 'bg-[#74A57F] text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>How AI Works (aoyu Engine)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('local-run')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeSection === 'local-run'
              ? 'bg-[#74A57F] text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Run Locally Offline (No Internet)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('backup')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeSection === 'backup'
              ? 'bg-[#74A57F] text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>JSON Backup &amp; Restore</span>
        </button>
      </div>

      {/* TAB 1: CONNECT LOCAL AI MODELS */}
      {activeSection === 'local-ai' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  id: 'local-ollama',
                  title: 'Local Ollama Runtime',
                  desc: 'Connects to gemma4:e2b / llama3.2 on localhost:11434',
                },
                {
                  id: 'local-openai',
                  title: 'Local OpenAI Server',
                  desc: 'LM Studio, llama.cpp, or vLLM on localhost:1234',
                },
                {
                  id: 'cloud-gemini',
                  title: 'Cloud Sanctuary',
                  desc: 'Built-in Gemini 3.8 Flash server engine',
                },
              ] as const
            ).map((option) => {
              const isSelected = aiConfig.engineMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    onUpdateAIConfig({
                      ...aiConfig,
                      engineMode: option.id,
                      endpoint:
                        option.id === 'local-ollama'
                          ? 'http://localhost:11434'
                          : option.id === 'local-openai'
                            ? 'http://localhost:1234'
                            : aiConfig.endpoint,
                    })
                  }
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    isSelected
                      ? 'bg-[#74A57F] text-white border-[#74A57F]'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-[#74A57F]'
                  }`}
                >
                  <div className="text-xs font-semibold">{option.title}</div>
                  <div
                    className={`text-[11px] mt-1 leading-snug ${
                      isSelected ? 'text-white/90' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {option.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Local LLM + Faster-Whisper Configuration */}
          <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Local Language Model Endpoint URL
                </label>
                <input
                  type="text"
                  value={aiConfig.endpoint}
                  onChange={(e) =>
                    onUpdateAIConfig({ ...aiConfig, endpoint: e.target.value })
                  }
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Open-Source LLM Model Tag
                </label>
                <input
                  type="text"
                  value={aiConfig.modelTag}
                  onChange={(e) =>
                    onUpdateAIConfig({ ...aiConfig, modelTag: e.target.value })
                  }
                  placeholder="gemma4:e2b"
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                />
              </div>
            </div>

            {/* Faster-Whisper Local Voice STT Endpoint */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/70">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Local Faster-Whisper Voice Endpoint (Stage 2 Audio STT)
                </label>
                <input
                  type="text"
                  value={aiConfig.whisperEndpoint || 'http://localhost:8000'}
                  onChange={(e) =>
                    onUpdateAIConfig({ ...aiConfig, whisperEndpoint: e.target.value })
                  }
                  placeholder="http://localhost:8000"
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Faster-Whisper Model ID
                </label>
                <input
                  type="text"
                  value={aiConfig.whisperModel || 'Systran/faster-whisper-small'}
                  onChange={(e) =>
                    onUpdateAIConfig({ ...aiConfig, whisperModel: e.target.value })
                  }
                  placeholder="Systran/faster-whisper-small"
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                />
              </div>
            </div>

            {/* Quick Preset Model Buttons */}
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Quick-select open-source weights:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_LOCAL_MODELS.map((preset) => (
                  <button
                    key={preset.tag}
                    type="button"
                    onClick={() =>
                      onUpdateAIConfig({ ...aiConfig, modelTag: preset.tag })
                    }
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                      aiConfig.modelTag === preset.tag
                        ? 'bg-[#B58ACE] text-white border-[#B58ACE]'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-[#74A57F]'
                    }`}
                  >
                    {preset.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Connection Diagnostic Bar */}
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs font-mono tabular-nums">
                {isCheckingHealth ? (
                  <span className="text-zinc-500">Pinging {aiConfig.endpoint}...</span>
                ) : health?.online ? (
                  <span className="text-[#74A57F]">
                    Connected ({health.latencyMs}ms · {health.connectionMethod}) ·{' '}
                    {health.models.length > 0
                      ? `Detected: ${health.models.slice(0, 3).join(', ')}`
                      : `Ready for ${aiConfig.modelTag}`}
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Local endpoint not detected at {aiConfig.endpoint}.{' '}
                    {aiConfig.autoFallbackToCloud
                      ? 'Cloud fallback active.'
                      : 'Start Ollama locally below.'}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                <span>Test Local Connection</span>
              </button>
            </div>

            {/* Seamless Fallback Option */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConfig.autoFallbackToCloud}
                  onChange={(e) =>
                    onUpdateAIConfig({
                      ...aiConfig,
                      autoFallbackToCloud: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 accent-[#74A57F]"
                />
                <span>
                  Automatically fall back to Cloud Sanctuary if local <code className="font-mono">{aiConfig.modelTag}</code> is offline
                </span>
              </label>
            </div>
          </div>

          {/* Quick How-to Connect Guide */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Quick Guide: How to Connect Your Local Open-Source AI Model
            </h3>
            <ol className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Install <strong>Ollama</strong> from <code className="font-mono">ollama.com</code> on your Mac, Linux, or Windows machine.
              </li>
              <li>
                Run <code className="font-mono text-[#74A57F]">OLLAMA_ORIGINS="*" ollama serve</code> in your terminal and pull a model with <code className="font-mono text-[#74A57F]">ollama run gemma4:e2b</code> (or <code className="font-mono">llama3.2:3b</code>).
              </li>
              <li>
                For local voice transcription with <strong>Faster-Whisper</strong>, run <code className="font-mono text-[#B58ACE]">docker run -p 8000:8000 fedirz/faster-whisper-server:latest-cpu</code> (or use the built-in On-Device Browser Speech-to-Text automatically).
              </li>
              <li>
                Click <strong>Test Local Connection</strong> above — once connected, all AI synthesis, archive queries, and voice transcriptions run directly on your hardware!
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB 2: HOW THE AI WORKS (AOYU ENGINE 7-STAGE PIPELINE) */}
      {activeSection === 'aoyu-pipeline' && (
        <div className="space-y-5">
          <div className="p-5 bg-[#74A57F]/10 dark:bg-[#74A57F]/15 border border-[#74A57F]/30 rounded-xl space-y-1.5">
            <div className="text-xs font-mono text-[#456b4e] dark:text-[#98c9a3]">
              Architecture Specification · Asynchronous Local Pipeline
            </div>
            <h3 className="font-display text-lg text-zinc-900 dark:text-zinc-100">
              How the AI Works in memly — The aoyu Engine
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              The <strong>aoyu Engine</strong> processes every captured memory, voice note, and uploaded file through a 7-stage asynchronous pipeline designed for complete local privacy:
            </p>
          </div>

          <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800 border border-zinc-200/90 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
            {AOYU_PIPELINE_STAGES.map((stage) => {
              const isComingSoon = stage.status.toLowerCase().includes('coming soon');
              return (
                <div
                  key={stage.step}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-[#74A57F] text-white tabular-nums shrink-0">
                      {stage.step}
                    </span>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {stage.title}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {stage.desc}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 space-y-1 pl-10 sm:pl-0">
                    <div className="text-xs font-mono text-[#74A57F] dark:text-[#B58ACE]">
                      {stage.model}
                    </div>
                    <div
                      className={`text-[11px] font-mono ${
                        isComingSoon
                          ? 'text-[#B58ACE]'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {stage.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: RUN LOCALLY & OFFLINE WITHOUT INTERNET */}
      {activeSection === 'local-run' && (
        <div className="space-y-5">
          <div className="p-5 bg-[#74A57F]/10 dark:bg-[#74A57F]/15 border border-[#74A57F]/30 rounded-xl flex items-start gap-3.5">
            <WifiOff className="w-5 h-5 text-[#74A57F] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                100% Air-Gapped Offline Execution (Zero Internet Required)
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Once downloaded to your local machine (or installed as a standalone PWA), <strong>memly</strong> stores all entries in local device storage, caches all interface assets via Service Worker, and communicates strictly with <code className="font-mono">127.0.0.1</code> for AI inference.
              </p>
            </div>
          </div>

          {/* Step 1: Download & Build Locally */}
          <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="text-xs font-mono text-[#74A57F]">
              01. Download Project &amp; Run on Your Machine (Works Offline)
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              After downloading or unzipping this repository to your computer, run <code className="font-mono">npm install</code> once while online. From then on, you can disconnect from the internet completely and start the local server anytime:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#74A57F] text-white px-3.5 py-2.5 rounded-lg font-mono text-xs overflow-x-auto">
              <code>npm install &amp;&amp; npm run build &amp;&amp; npm start</code>
              <button
                type="button"
                onClick={() =>
                  copyCommand('npm install && npm run build && npm start', 'build-start')
                }
                className="p-1 text-white/80 hover:text-white shrink-0"
                title="Copy command"
              >
                {copiedCmd === 'build-start' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Opens at http://localhost:3000 — zero external internet requests required.
            </p>
          </div>

          {/* Step 2: Pull and Serve Gemma 4 E2B with Ollama */}
          <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="text-xs font-mono text-[#74A57F]">
              02. Run Local Language Model (Gemma 4 E2B) Offline via Ollama
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Pull the weights once, then serve <strong>Gemma 4 E2B</strong> locally on your machine with zero internet connection:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#74A57F] text-white px-3.5 py-2.5 rounded-lg font-mono text-xs overflow-x-auto">
              <code>OLLAMA_ORIGINS="*" ollama serve &amp;&amp; ollama run gemma4:e2b</code>
              <button
                type="button"
                onClick={() =>
                  copyCommand(
                    'OLLAMA_ORIGINS="*" ollama serve && ollama run gemma4:e2b',
                    'ollama'
                  )
                }
                className="p-1 text-white/80 hover:text-white shrink-0"
                title="Copy command"
              >
                {copiedCmd === 'ollama' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Step 3: Local Faster-Whisper Speech-to-Text */}
          <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#B58ACE]">
              <Mic className="w-3.5 h-3.5" />
              <span>03. Run Local Faster-Whisper Voice Transcription Server</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              To transcribe voice notes offline using open-source <strong>Faster-Whisper</strong> on <code className="font-mono">http://localhost:8000</code>:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#B58ACE] text-white px-3.5 py-2.5 rounded-lg font-mono text-xs overflow-x-auto">
              <code>docker run --rm -p 8000:8000 fedirz/faster-whisper-server:latest-cpu</code>
              <button
                type="button"
                onClick={() =>
                  copyCommand(
                    'docker run --rm -p 8000:8000 fedirz/faster-whisper-server:latest-cpu',
                    'whisper'
                  )
                }
                className="p-1 text-white/80 hover:text-white shrink-0"
                title="Copy command"
              >
                {copiedCmd === 'whisper' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Step 4: Install Standalone Offline Desktop/Mobile PWA */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-[#74A57F]">
                04. Install Standalone Offline Application (PWA)
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                {isInstalled
                  ? 'memly is installed and running in standalone mode with offline service-worker caching active.'
                  : 'Install memly to your desktop dock or home screen for instant offline launch without needing a terminal.'}
              </p>
            </div>

            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Standalone App</span>
              </button>
            )}

            {!isInstalled && !isInstallable && isIOS && (
              <span className="text-xs font-mono text-zinc-500 shrink-0">
                Safari: Tap Share → Add to Home Screen
              </span>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: JSON BACKUP & RESTORE */}
      {activeSection === 'backup' && (
        <div className="space-y-6">
          <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#74A57F] tabular-nums">
                  Local Data Sovereignty · {memories.length} entries · {formattedBytes}
                </div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Export Complete memly Archive as JSON
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Downloads a structured, portable <code className="font-mono">.json</code> snapshot containing all manuscripts, voice notes, entities, and associative links.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportJson}
                className="px-4 py-2.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <FileJson className="w-4 h-4" />
                <span>Export JSON Backup</span>
              </button>
            </div>

            <div className="pt-4 border-t border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Additional archival formats:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-[#74A57F] rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-[#74A57F]" />
                  <span>Export Markdown Monograph (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-[#74A57F] rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#B58ACE]" />
                  <span>Export CSV Ledger (.csv)</span>
                </button>
              </div>
            </div>

            {exportStatus && (
              <div className="flex items-center gap-2 text-xs text-[#74A57F] font-mono">
                <Check className="w-3.5 h-3.5" />
                <span>{exportStatus}</span>
              </div>
            )}
          </div>

          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Restore or Merge from Local JSON File
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Import a previously exported <code className="font-mono">memly-archive-*.json</code> backup file.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                  className="px-2.5 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200"
                >
                  <option value="merge">Merge with current entries</option>
                  <option value="replace">Replace entire archive</option>
                </select>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-[#B58ACE] hover:bg-[#9f71ba] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload JSON</span>
                </button>
              </div>
            </div>

            {importFeedback && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  importFeedback.type === 'success'
                    ? 'bg-[#74A57F]/15 text-[#456b4e] dark:text-[#98c9a3] border border-[#74A57F]/30'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                }`}
              >
                {importFeedback.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (inlinePage) {
    return contentBody;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#74A57F]/25 dark:bg-zinc-950/75 backdrop-blur-xs">
      {contentBody}
    </div>
  );
};
