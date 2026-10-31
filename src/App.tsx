import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  Cpu,
  Download,
  Grid,
  List,
  Mic,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Square,
  Sun,
  Tag,
  Trash2,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import { INITIAL_MEMORIES } from './data/initialMemories';
import {
  ActiveNavTab,
  ArchiveLayoutMode,
  EntryDomain,
  EntryKind,
  LocalAIConfig,
  MemoryEntry,
} from './types/memory';
import { exportArchiveAsJson } from './utils/archiveIO';
import {
  extractEntitiesFromContent,
  suggestTagsFromContent,
  transcribeWithFasterWhisper,
} from './utils/aiClient';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { VisualStudyArtwork } from './components/VisualStudyArtwork';
import { ConstellationView } from './components/ConstellationView';
import { TimelineView } from './components/TimelineView';
import { EchoesView } from './components/EchoesView';
import { CaptureModal } from './components/CaptureModal';
import { EntryInspectorModal } from './components/EntryInspectorModal';
import { LocalAIAndVaultModal } from './components/LocalAIAndVaultModal';
import { ManageTagsModal } from './components/ManageTagsModal';

const STORAGE_KEY = 'mnemosyne_archive_entries_v2';
const THEME_KEY = 'mnemosyne_theme_v1';
const AI_CONFIG_KEY = 'mnemosyne_local_ai_config_v1';

const DEFAULT_AI_CONFIG: LocalAIConfig = {
  engineMode: 'local-ollama',
  endpoint: 'http://localhost:11434',
  modelTag: 'gemma4:e2b',
  whisperEndpoint: 'http://localhost:8000',
  whisperModel: 'Systran/faster-whisper-small',
  embeddingModel: 'nomic-embed-text',
  autoFallbackToCloud: true,
};

export default function App() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [memories, setMemories] = useState<MemoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial entries
    }
    return INITIAL_MEMORIES;
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [aiConfig, setAiConfig] = useState<LocalAIConfig>(() => {
    try {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_AI_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<ActiveNavTab>('archive');
  const [layoutMode, setLayoutMode] = useState<ArchiveLayoutMode>('ledger');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [kindFilter, setKindFilter] = useState<EntryKind | 'all' | 'journal' | 'pinned'>('all');
  const [domainFilter, setDomainFilter] = useState<EntryDomain | 'All'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'revisited'>('newest');

  // Multi-select state for bulk deletion in Archive Ledger / Grid
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Quick Daily Log state + Quick Voice Dictation state
  const [dailyLogTitle, setDailyLogTitle] = useState<string>('');
  const [dailyLogText, setDailyLogText] = useState<string>('');
  const [isDailyRecording, setIsDailyRecording] = useState<boolean>(false);
  const [dailyAudioDataUrl, setDailyAudioDataUrl] = useState<string>('');
  const dailyRecorderRef = useRef<MediaRecorder | null>(null);
  const dailyRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const dailyAudioChunksRef = useRef<Blob[]>([]);

  const [isCaptureOpen, setIsCaptureOpen] = useState<boolean>(false);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [isManageTagsOpen, setIsManageTagsOpen] = useState<boolean>(false);
  const [inspectedEntryId, setInspectedEntryId] = useState<string | null>(null);
  const [constellationFocusId, setConstellationFocusId] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3200);
  };

  // Sync theme with document root
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [isDark]);

  // Persist memories
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // Ignore
    }
  }, [memories]);

  // Persist Local AI config
  useEffect(() => {
    try {
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfig));
    } catch {
      // Ignore
    }
  }, [aiConfig]);

  // Keep selectedIds synced with existing memories
  useEffect(() => {
    const validIds = new Set(memories.map((m) => m.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [memories]);

  // Keyboard shortcut Cmd/Ctrl+K for instant retrieval search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('archive');
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setInspectedEntryId(null);
        setIsCaptureOpen(false);
        setIsVaultOpen(false);
        setIsManageTagsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const inspectedEntry = useMemo(
    () => memories.find((m) => m.id === inspectedEntryId) || null,
    [memories, inspectedEntryId]
  );

  const uniqueTagCount = useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => m.tags.forEach((t) => set.add(t.toLowerCase())));
    return set.size;
  }, [memories]);

  // Filtered and sorted memories for the Archive view
  const filteredMemories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = memories.filter((entry) => {
      if (kindFilter === 'pinned' && !entry.isPinned) return false;
      if (kindFilter === 'journal' && !entry.tags.includes('journal')) return false;
      if (
        kindFilter !== 'all' &&
        kindFilter !== 'pinned' &&
        kindFilter !== 'journal' &&
        entry.kind !== kindFilter
      ) {
        return false;
      }
      if (domainFilter !== 'All' && entry.domain !== domainFilter) {
        return false;
      }
      if (!q) return true;

      const matchesTitle = entry.title.toLowerCase().includes(q);
      const matchesContent = entry.content.toLowerCase().includes(q);
      const matchesCode = entry.indexCode.toLowerCase().includes(q);
      const matchesLocation = entry.location?.toLowerCase().includes(q) || false;
      const matchesTags = entry.tags.some((t) => t.toLowerCase().includes(q));
      const matchesDomain = entry.domain.toLowerCase().includes(q);
      return (
        matchesTitle ||
        matchesContent ||
        matchesCode ||
        matchesLocation ||
        matchesTags ||
        matchesDomain
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt.localeCompare(a.createdAt);
      if (sortBy === 'oldest') return a.createdAt.localeCompare(b.createdAt);
      return b.revisitedCount - a.revisitedCount;
    });
  }, [memories, searchQuery, kindFilter, domainFilter, sortBy]);

  // Handlers
  const handleAddMemory = (
    newEntryData: Omit<MemoryEntry, 'id' | 'indexCode' | 'revisitedCount' | 'lastRevisited'>
  ) => {
    const nextNumber =
      memories.reduce((max, item) => {
        const num = parseInt(item.indexCode.replace(/\D/g, ''), 10);
        return Number.isNaN(num) ? max : Math.max(max, num);
      }, 0) + 1;
    const indexCode = `MNM-${String(nextNumber).padStart(3, '0')}`;
    const newId = `mem-${Date.now()}`;

    const createdEntry: MemoryEntry = {
      ...newEntryData,
      id: newId,
      indexCode,
      revisitedCount: 1,
      lastRevisited: todayIso,
    };

    setMemories((prev) => {
      const updatedExisting = prev.map((item) => {
        if (createdEntry.connectedIds.includes(item.id) && !item.connectedIds.includes(newId)) {
          return { ...item, connectedIds: [...item.connectedIds, newId] };
        }
        return item;
      });
      return [createdEntry, ...updatedExisting];
    });

    showToast(`Saved ${indexCode} locally via aoyu Engine`);
  };

  // Quick Voice Dictation for Daily Log
  const toggleDailyVoiceDictation = async () => {
    if (isDailyRecording) {
      if (dailyRecognitionRef.current) {
        try {
          dailyRecognitionRef.current.stop();
        } catch {
          // Ignore
        }
        dailyRecognitionRef.current = null;
      }
      if (dailyRecorderRef.current && dailyRecorderRef.current.state !== 'inactive') {
        dailyRecorderRef.current.stop();
      }
      setIsDailyRecording(false);
      return;
    }

    dailyAudioChunksRef.current = [];
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          let chunk = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              chunk += event.results[i][0].transcript + ' ';
            }
          }
          const clean = chunk.trim();
          if (clean) {
            setDailyLogText((prev) => (prev ? `${prev} ${clean}` : clean));
          }
        };
        recognition.start();
        dailyRecognitionRef.current = recognition;
      } catch {
        // Ignore
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      dailyRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          dailyAudioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (dailyAudioChunksRef.current.length === 0) return;
        const blob = new Blob(dailyAudioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setDailyAudioDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);

        const whisperRes = await transcribeWithFasterWhisper(blob, aiConfig);
        if (whisperRes && whisperRes.text) {
          setDailyLogText((prev) => (prev ? `${prev} ${whisperRes.text}` : whisperRes.text));
          showToast(`Transcribed with ${whisperRes.modelUsed}`);
        } else {
          showToast('Voice note recorded & transcribed locally');
        }
      };

      recorder.start();
      setIsDailyRecording(true);
      showToast('Listening... Speak your memory or idea aloud');
    } catch {
      if (SpeechRecognitionAPI) {
        setIsDailyRecording(true);
        showToast('Listening via On-Device Speech-to-Text...');
      } else {
        showToast('Microphone permission is needed for voice capture');
      }
    }
  };

  // Quick Daily Log submission (automatically tagged with 'journal' + NLP suggested tags)
  const handleDailyLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = dailyLogText.trim();
    if (!trimmedContent) return;

    if (isDailyRecording) {
      toggleDailyVoiceDictation();
    }

    // Extract any #hashtags typed inline + NLP suggested tags + 'journal'
    const inlineTags = Array.from(trimmedContent.matchAll(/#([a-zA-Z0-9_-]+)/g)).map((m) =>
      m[1].toLowerCase()
    );
    const nlpSuggested = suggestTagsFromContent(trimmedContent, dailyLogTitle, 'Personal', 'memory').slice(0, 2);
    const baseTags = dailyAudioDataUrl ? ['journal', 'voice-note'] : ['journal'];
    const tags = Array.from(new Set([...baseTags, ...inlineTags, ...nlpSuggested]));

    const firstLine = trimmedContent.split('\n')[0];
    const autoTitle =
      dailyLogTitle.trim() ||
      (firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine) ||
      `Daily Log — ${todayIso}`;

    const excerpt =
      trimmedContent.length > 145 ? `${trimmedContent.slice(0, 145)}…` : trimmedContent;

    const extractedEntities = extractEntitiesFromContent(trimmedContent, autoTitle);

    handleAddMemory({
      title: autoTitle,
      excerpt,
      content: trimmedContent,
      kind: 'memory',
      domain: 'Personal',
      emotion: 'Serene',
      createdAt: todayIso,
      location: extractedEntities.locations[0] || undefined,
      tags,
      connectedIds: [],
      visualStudy: 'horizon',
      audioDataUrl: dailyAudioDataUrl || undefined,
      audioTranscriptModel: dailyAudioDataUrl ? 'Faster-Whisper / Local STT' : undefined,
      extractedEntities,
      isPinned: false,
    });

    setDailyLogTitle('');
    setDailyLogText('');
    setDailyAudioDataUrl('');
  };

  // Manage Tags Handlers (Rename & Bulk Remove)
  const handleRenameTag = (oldTag: string, newTag: string) => {
    const cleanOld = oldTag.trim().toLowerCase();
    const cleanNew = newTag.trim().toLowerCase();
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    setMemories((prev) =>
      prev.map((entry) => {
        const hasOld = entry.tags.some((t) => t.toLowerCase() === cleanOld);
        if (!hasOld) return entry;
        const updatedTags = Array.from(
          new Set(
            entry.tags.map((t) => (t.toLowerCase() === cleanOld ? cleanNew : t.toLowerCase()))
          )
        );
        return { ...entry, tags: updatedTags };
      })
    );
  };

  const handleBulkRemoveTags = (tagsToRemove: string[]) => {
    const removeSet = new Set(tagsToRemove.map((t) => t.toLowerCase()));
    if (removeSet.size === 0) return;

    setMemories((prev) =>
      prev.map((entry) => {
        const filtered = entry.tags.filter((t) => !removeSet.has(t.toLowerCase()));
        if (filtered.length === entry.tags.length) return entry;
        return {
          ...entry,
          tags: filtered.length > 0 ? filtered : [entry.kind],
        };
      })
    );
  };

  // Multi-select handlers for Ledger View
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allVisibleSelected =
    filteredMemories.length > 0 &&
    filteredMemories.every((entry) => selectedIds.includes(entry.id));

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredMemories.map((m) => m.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filteredMemories.map((m) => m.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const toRemove = new Set(selectedIds);

    setMemories((prev) =>
      prev
        .filter((m) => !toRemove.has(m.id))
        .map((m) => ({
          ...m,
          connectedIds: m.connectedIds.filter((cId) => !toRemove.has(cId)),
        }))
    );

    if (inspectedEntryId && toRemove.has(inspectedEntryId)) {
      setInspectedEntryId(null);
    }

    setSelectedIds([]);
    showToast(`Deleted ${count} selected ${count === 1 ? 'entry' : 'entries'}`);
  };

  const handleQuickJsonExport = () => {
    const filename = exportArchiveAsJson(memories);
    showToast(`Exported ${memories.length} entries to ${filename}`);
  };

  const handleImportMemories = (imported: MemoryEntry[], mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      setMemories(imported);
      setSelectedIds([]);
      return;
    }
    setMemories((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newItems = imported.filter((m) => !existingIds.has(m.id));
      return [...newItems, ...prev];
    });
  };

  const handleCreateSynthesis = (data: {
    title: string;
    excerpt: string;
    content: string;
    domain: EntryDomain;
    tags: string[];
    parentIds: [string, string];
  }) => {
    handleAddMemory({
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      kind: 'idea',
      domain: data.domain,
      emotion: 'Clarifying',
      createdAt: todayIso,
      tags: data.tags,
      connectedIds: [data.parentIds[0], data.parentIds[1]],
      visualStudy: 'acoustics',
      isPinned: false,
    });
  };

  const handleUpdateEntry = (updated: MemoryEntry) => {
    setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleDeleteEntry = (id: string) => {
    setMemories((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m) => ({
          ...m,
          connectedIds: m.connectedIds.filter((cId) => cId !== id),
        }))
    );
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleTogglePin = (id: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPinned: !m.isPinned } : m))
    );
  };

  const handleRevisit = (id: string) => {
    setMemories((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              revisitedCount: m.revisitedCount + 1,
              lastRevisited: todayIso,
            }
          : m
      )
    );
  };

  const handleToggleConnection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id === sourceId) {
          const exists = m.connectedIds.includes(targetId);
          return {
            ...m,
            connectedIds: exists
              ? m.connectedIds.filter((id) => id !== targetId)
              : [...m.connectedIds, targetId],
          };
        }
        if (m.id === targetId) {
          const exists = m.connectedIds.includes(sourceId);
          return {
            ...m,
            connectedIds: exists
              ? m.connectedIds.filter((id) => id !== sourceId)
              : [...m.connectedIds, sourceId],
          };
        }
        return m;
      })
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setKindFilter('all');
    setDomainFilter('All');
    setSortBy('newest');
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-200">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#archive"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('archive');
            }}
            className="font-display text-xl font-semibold tracking-tight text-[#74A57F] dark:text-[#74A57F] whitespace-nowrap shrink-0"
          >
            memly
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'archive'
                  ? 'text-[#74A57F] border-[#74A57F]'
                  : 'border-transparent hover:text-[#74A57F]'
              }`}
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('constellation')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'constellation'
                  ? 'text-[#74A57F] border-[#74A57F]'
                  : 'border-transparent hover:text-[#74A57F]'
              }`}
            >
              Constellation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'timeline'
                  ? 'text-[#74A57F] border-[#74A57F]'
                  : 'border-transparent hover:text-[#74A57F]'
              }`}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('echoes')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'echoes'
                  ? 'text-[#74A57F] border-[#74A57F]'
                  : 'border-transparent hover:text-[#74A57F]'
              }`}
            >
              Echoes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('local-ai')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'local-ai'
                  ? 'text-[#B58ACE] border-[#B58ACE]'
                  : 'border-transparent hover:text-[#B58ACE]'
              }`}
            >
              Local AI
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsCaptureOpen(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </button>
          </div>
        </div>
      </header>

      {/* STATUS TOAST NOTIFICATION */}
      {statusToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-[#74A57F] text-white rounded-xl shadow-lg text-xs font-mono">
          <Check className="w-4 h-4 text-white shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* OFFLINE LOCAL CACHING INDICATOR */}
      {!isOnline && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 px-3.5 py-2 bg-[#B58ACE] text-white rounded-xl shadow-lg text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Local Mode Active</span>
        </div>
      )}

      {/* MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 space-y-8">
        {activeTab === 'archive' && (
          <>
            {/* DAILY LOG QUICK CAPTURE SECTION (With Voice Microphone & Auto-Tagging) */}
            <section
              aria-label="Daily Log"
              className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#74A57F]" />
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Daily Log &amp; Voice Capture
                  </h2>
                  <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                    ·
                  </span>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {todayIso}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#74A57F] dark:text-[#B58ACE]">
                  aoyu Engine · Faster-Whisper STT &amp; NLP Auto-Tagging
                </span>
              </div>

              <form onSubmit={handleDailyLogSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <input
                    type="text"
                    value={dailyLogTitle}
                    onChange={(e) => setDailyLogTitle(e.target.value)}
                    placeholder={`Log title (optional — defaults to Daily Log — ${todayIso})`}
                    className="sm:col-span-4 px-3.5 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F]"
                  />
                  <div className="sm:col-span-8 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      value={dailyLogText}
                      onChange={(e) => setDailyLogText(e.target.value)}
                      placeholder="Write or click the microphone to dictate a memory or idea..."
                      className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F]"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleDailyVoiceDictation}
                        title={
                          isDailyRecording
                            ? 'Stop voice recording'
                            : 'Dictate memory or idea with your voice (Local Speech-to-Text)'
                        }
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isDailyRecording
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-[#B58ACE] text-white hover:bg-[#9f71ba]'
                        }`}
                      >
                        {isDailyRecording ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Voice</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>Voice</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Save Daily Log
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </section>

            {/* WORKSPACE TOOLBAR (Search, Filters, Manage Tags, Delete Selected, Export JSON, Local AI) */}
            <section className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-3.5">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search entries, tags, or dates (⌘K)..."
                    className="w-full pl-10 pr-9 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Interactive Segmented Filter */}
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg border border-zinc-200/60 dark:border-zinc-800 overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'journal', label: 'Daily Logs' },
                      { id: 'memory', label: 'Memories' },
                      { id: 'idea', label: 'Ideas' },
                      { id: 'pinned', label: 'Pinned' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setKindFilter(tab.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        kindFilter === tab.id
                          ? 'bg-[#74A57F] text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Action Controls: Delete Selected, Category, Sort, Manage Tags, Export JSON, Local AI, View Switcher, Theme */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="tabular-nums">Delete Selected ({selectedIds.length})</span>
                    </button>
                  )}

                  <select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value as EntryDomain | 'All')}
                    aria-label="Filter by category"
                    className="px-2.5 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-[#74A57F]"
                  >
                    <option value="All">All Categories</option>
                    <option value="Personal">Personal</option>
                    <option value="Design">Design</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Philosophy">Philosophy</option>
                    <option value="Nature">Nature</option>
                    <option value="Science">Science</option>
                    <option value="Literature">Literature</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'newest' | 'oldest' | 'revisited')
                    }
                    aria-label="Sort entries"
                    className="px-2.5 py-1.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-[#74A57F]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="revisited">Most Revisited</option>
                  </select>

                  {/* MANAGE TAGS MODAL TRIGGER */}
                  <button
                    type="button"
                    onClick={() => setIsManageTagsOpen(true)}
                    title="View, rename, or bulk-remove tags across the archive"
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-[#74A57F] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Tag className="w-3.5 h-3.5 text-[#74A57F]" />
                    <span>Manage Tags ({uniqueTagCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickJsonExport}
                    title="Export current memory archive as a JSON file"
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-[#74A57F] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-[#74A57F]" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVaultOpen(true)}
                    title="Configure Local AI (Gemma 4 E2B, Faster-Whisper), aoyu Engine & Offline Guide"
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-[#B58ACE] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Cpu className="w-3.5 h-3.5 text-[#B58ACE]" />
                    <span className="font-mono">{aiConfig.modelTag}</span>
                  </button>

                  {!isInstalled && isInstallable && (
                    <button
                      type="button"
                      onClick={install}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Install App</span>
                    </button>
                  )}

                  {/* Layout Switcher: Ledger vs Grid */}
                  <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('ledger')}
                      title="Archive Ledger View"
                      className={`p-1.5 rounded-md transition-colors ${
                        layoutMode === 'ledger'
                          ? 'bg-[#74A57F] text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('bento')}
                      title="Editorial Grid View"
                      className={`p-1.5 rounded-md transition-colors ${
                        layoutMode === 'bento'
                          ? 'bg-[#74A57F] text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Theme Switcher */}
                  <button
                    type="button"
                    onClick={() => setIsDark((prev) => !prev)}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    className="p-2 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-[#74A57F] transition-colors"
                  >
                    {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Active Filter Indicator */}
              {(searchQuery || kindFilter !== 'all' || domainFilter !== 'All') && (
                <div className="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="font-mono tabular-nums">
                    Showing {filteredMemories.length} of {memories.length} entries
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 text-[#74A57F] hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear filters</span>
                  </button>
                </div>
              )}

              {/* ARCHIVE CONTENT: EMPTY STATE, LEDGER WITH CHECKBOXES, OR BENTO GRID */}
              {memories.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4">
                  <h3 className="font-display text-2xl font-normal text-zinc-900 dark:text-zinc-100">
                    Your memly Archive is Ready
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Start by writing or dictating a quick entry in the <strong>Daily Log</strong> above, creating a full memory or idea, or importing an existing <code className="font-mono">.json</code> backup file.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCaptureOpen(true)}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Memory or Idea</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsVaultOpen(true)}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#B58ACE] hover:bg-[#9f71ba] rounded-lg transition-colors"
                    >
                      Import JSON Backup / Configure Local AI
                    </button>
                  </div>
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-3">
                  <div className="font-display text-xl text-zinc-900 dark:text-zinc-100">
                    No matching entries found
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No entries match your current filter or search query.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : layoutMode === 'ledger' ? (
                /* ARCHIVE LEDGER VIEW WITH ROW CHECKBOXES */
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                          <th className="py-3 pl-4 pr-2 w-10">
                            <input
                              type="checkbox"
                              aria-label="Select all entries"
                              checked={allVisibleSelected}
                              onChange={handleToggleSelectAllVisible}
                              className="rounded border-zinc-300 dark:border-zinc-700 accent-[#74A57F] cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-4 font-normal">Index</th>
                          <th className="py-3 px-4 font-normal">Date</th>
                          <th className="py-3 px-4 font-normal">Title &amp; Excerpt</th>
                          <th className="py-3 px-4 font-normal">Type · Category</th>
                          <th className="py-3 px-4 font-normal">Tags</th>
                          <th className="py-3 px-4 font-normal text-right">Links</th>
                          <th className="py-3 px-4 font-normal text-right">Revisits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-xs">
                        {filteredMemories.map((entry) => {
                          const isChecked = selectedIds.includes(entry.id);
                          return (
                            <tr
                              key={entry.id}
                              onClick={() => setInspectedEntryId(entry.id)}
                              className={`cursor-pointer transition-colors group ${
                                isChecked
                                  ? 'bg-[#74A57F]/12 dark:bg-[#74A57F]/20'
                                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              <td
                                className="py-3 pl-4 pr-2 w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${entry.title}`}
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectRow(entry.id)}
                                  className="rounded border-zinc-300 dark:border-zinc-700 accent-[#74A57F] cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-4 font-mono text-[#74A57F] dark:text-[#74A57F] tabular-nums whitespace-nowrap">
                                {entry.indexCode}
                              </td>
                              <td className="py-3 px-4 font-mono text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                                {entry.createdAt}
                              </td>
                              <td className="py-3 px-4 max-w-md">
                                <div className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[#74A57F] dark:group-hover:text-[#B58ACE] transition-colors truncate flex items-center gap-1.5">
                                  {entry.audioDataUrl && (
                                    <Volume2 className="w-3.5 h-3.5 text-[#B58ACE] shrink-0" />
                                  )}
                                  <span className="truncate">{entry.title}</span>
                                </div>
                                <div className="text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                  {entry.excerpt}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                <span className="capitalize">{entry.kind}</span> · {entry.domain}
                              </td>
                              <td className="py-3 px-4 font-mono text-[#74A57F] dark:text-[#B58ACE] whitespace-nowrap">
                                {entry.tags.slice(0, 3).join(' · ')}
                              </td>
                              <td className="py-3 px-4 font-mono text-right text-zinc-600 dark:text-zinc-300 tabular-nums">
                                {entry.connectedIds.length}
                              </td>
                              <td className="py-3 px-4 font-mono text-right text-zinc-600 dark:text-zinc-300 tabular-nums">
                                {entry.revisitedCount}×
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* EDITORIAL BENTO GRID VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMemories.map((entry) => {
                    const isChecked = selectedIds.includes(entry.id);
                    return (
                      <article
                        key={entry.id}
                        onClick={() => setInspectedEntryId(entry.id)}
                        className={`group bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[#74A57F]'
                            : 'border-zinc-200/90 dark:border-zinc-800 hover:border-[#74A57F]'
                        }`}
                      >
                        <div>
                          <VisualStudyArtwork
                            study={entry.visualStudy}
                            customImageUrl={entry.customImageUrl}
                            title={entry.title}
                            indexCode={entry.indexCode}
                            className="h-40"
                          />

                          <div className="p-6 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                                <span className="capitalize font-sans text-[#74A57F] font-medium">
                                  {entry.kind}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-sans">{entry.domain}</span>
                                <span aria-hidden="true">·</span>
                                <span>{entry.createdAt}</span>
                              </div>

                              <div
                                className="flex items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${entry.title}`}
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectRow(entry.id)}
                                  className="rounded border-zinc-300 dark:border-zinc-700 accent-[#74A57F] cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(entry.id)}
                                  title={entry.isPinned ? 'Pinned' : 'Pin entry'}
                                  className={`p-1 rounded-md transition-colors ${
                                    entry.isPinned
                                      ? 'text-[#74A57F]'
                                      : 'text-zinc-300 dark:text-zinc-700 hover:text-[#74A57F]'
                                  }`}
                                >
                                  <Bookmark
                                    className="w-3.5 h-3.5"
                                    fill={entry.isPinned ? 'currentColor' : 'none'}
                                  />
                                </button>
                              </div>
                            </div>

                            <h3 className="font-display text-xl font-normal text-zinc-900 dark:text-zinc-100 group-hover:text-[#74A57F] dark:group-hover:text-[#B58ACE] transition-colors leading-snug">
                              {entry.title}
                            </h3>

                            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-3">
                              {entry.excerpt}
                            </p>
                          </div>
                        </div>

                        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-mono text-[#74A57F] dark:text-[#B58ACE] truncate">
                            {entry.tags.slice(0, 3).join(' · ')}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {entry.connectedIds.length} links · {entry.revisitedCount}×
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'constellation' && (
          <ConstellationView
            memories={memories}
            selectedMemoryId={constellationFocusId}
            onSelectMemory={(entry) => setConstellationFocusId(entry.id)}
            onOpenReader={(entry) => setInspectedEntryId(entry.id)}
            onToggleConnection={handleToggleConnection}
            onOpenCapture={() => setIsCaptureOpen(true)}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            memories={memories}
            onOpenReader={(entry) => setInspectedEntryId(entry.id)}
            onRevisit={handleRevisit}
            onOpenCapture={() => setIsCaptureOpen(true)}
          />
        )}

        {activeTab === 'echoes' && (
          <EchoesView
            memories={memories}
            aiConfig={aiConfig}
            onOpenReader={(entry) => setInspectedEntryId(entry.id)}
            onRevisit={handleRevisit}
            onOpenAIConfig={() => setActiveTab('local-ai')}
            onOpenCapture={() => setIsCaptureOpen(true)}
            onCreateSynthesis={handleCreateSynthesis}
          />
        )}

        {activeTab === 'local-ai' && (
          <LocalAIAndVaultModal
            isOpen={true}
            inlinePage={true}
            onClose={() => setActiveTab('archive')}
            memories={memories}
            onImportMemories={handleImportMemories}
            aiConfig={aiConfig}
            onUpdateAIConfig={setAiConfig}
          />
        )}
      </main>

      {/* MINIMALIST FOOTER */}
      <footer className="border-t border-zinc-200/80 dark:border-zinc-800/80 mt-12">
        <div className="max-w-[1360px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="font-mono tabular-nums">
            <span className="text-[#74A57F] font-semibold">memly</span> · {memories.length}{' '}
            {memories.length === 1 ? 'entry' : 'entries'} stored locally · aoyu Engine
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setIsManageTagsOpen(true)}
              className="hover:text-[#74A57F] transition-colors"
            >
              Manage Tags ({uniqueTagCount})
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleQuickJsonExport}
              className="hover:text-[#74A57F] transition-colors"
            >
              Export JSON
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('local-ai')}
              className="hover:text-[#B58ACE] transition-colors"
            >
              Local AI ({aiConfig.modelTag}) &amp; Offline Guide
            </button>
          </div>
        </div>
      </footer>

      {/* CAPTURE NEW MEMORY / IDEA MODAL */}
      <CaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        existingMemories={memories}
        aiConfig={aiConfig}
        onSave={handleAddMemory}
      />

      {/* MANAGE TAGS MODAL */}
      <ManageTagsModal
        isOpen={isManageTagsOpen}
        onClose={() => setIsManageTagsOpen(false)}
        memories={memories}
        onRenameTag={handleRenameTag}
        onBulkRemoveTags={handleBulkRemoveTags}
        onFilterByTag={(tag) => {
          setActiveTab('archive');
          setSearchQuery(tag);
        }}
      />

      {/* MANUSCRIPT READER & INSPECTOR DRAWER */}
      <EntryInspectorModal
        entry={inspectedEntry}
        allMemories={memories}
        aiConfig={aiConfig}
        onClose={() => setInspectedEntryId(null)}
        onSelectEntry={(target) => setInspectedEntryId(target.id)}
        onUpdateEntry={handleUpdateEntry}
        onDeleteEntry={handleDeleteEntry}
        onTogglePin={handleTogglePin}
        onRevisit={handleRevisit}
        onToggleConnection={handleToggleConnection}
      />

      {/* ARCHIVE VAULT, JSON BACKUP & LOCAL AI RUNTIME MODAL */}
      <LocalAIAndVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        memories={memories}
        onImportMemories={handleImportMemories}
        aiConfig={aiConfig}
        onUpdateAIConfig={setAiConfig}
      />
    </div>
  );
}
