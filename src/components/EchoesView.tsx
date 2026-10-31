import React, { useMemo, useState } from 'react';
import {
  Brain,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { EntryDomain, LocalAIConfig, MemoryEntry } from '../types/memory';
import { interrogateArchive, synthesizeMemoryPair } from '../utils/aiClient';

interface EchoesViewProps {
  memories: MemoryEntry[];
  aiConfig: LocalAIConfig;
  onOpenReader: (entry: MemoryEntry) => void;
  onRevisit: (id: string) => void;
  onOpenAIConfig: () => void;
  onOpenCapture: () => void;
  onCreateSynthesis: (data: {
    title: string;
    excerpt: string;
    content: string;
    domain: EntryDomain;
    tags: string[];
    parentIds: [string, string];
  }) => void;
}

export const EchoesView: React.FC<EchoesViewProps> = ({
  memories,
  aiConfig,
  onOpenReader,
  onRevisit,
  onOpenAIConfig,
  onOpenCapture,
  onCreateSynthesis,
}) => {
  const [firstId, setFirstId] = useState<string>(() => memories[0]?.id || '');
  const [secondId, setSecondId] = useState<string>(() => memories[1]?.id || memories[0]?.id || '');
  const [synthesisTitle, setSynthesisTitle] = useState('');
  const [synthesisNotes, setSynthesisNotes] = useState('');
  const [synthesizedTags, setSynthesizedTags] = useState<string[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisModelLabel, setSynthesisModelLabel] = useState<string | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isCardRevealed, setIsCardRevealed] = useState(false);

  const [question, setQuestion] = useState('');
  const [interrogationAnswer, setInterrogationAnswer] = useState<string | null>(null);
  const [interrogationModel, setInterrogationModel] = useState<string | null>(null);
  const [isInterrogating, setIsInterrogating] = useState(false);

  const firstMemory = useMemo(
    () => memories.find((m) => m.id === firstId) || memories[0],
    [memories, firstId]
  );

  const secondMemory = useMemo(
    () => memories.find((m) => m.id === secondId) || memories[1] || memories[0],
    [memories, secondId]
  );

  const activeFlashcard = useMemo(() => {
    if (memories.length === 0) return null;
    return memories[flashcardIndex % memories.length];
  }, [memories, flashcardIndex]);

  const handleDrawRandomPair = () => {
    if (memories.length < 2) return;
    const idxA = Math.floor(Math.random() * memories.length);
    let idxB = Math.floor(Math.random() * memories.length);
    if (idxB === idxA) {
      idxB = (idxA + 1) % memories.length;
    }
    setFirstId(memories[idxA].id);
    setSecondId(memories[idxB].id);
    setSynthesisModelLabel(null);
  };

  const combinedTags = useMemo(() => {
    if (synthesizedTags.length > 0) return synthesizedTags;
    if (!firstMemory || !secondMemory) return ['synthesis'];
    return Array.from(
      new Set([...firstMemory.tags.slice(0, 3), ...secondMemory.tags.slice(0, 3)])
    );
  }, [firstMemory, secondMemory, synthesizedTags]);

  const handleAISynthesize = async () => {
    if (!firstMemory || !secondMemory) return;
    setIsSynthesizing(true);
    setSynthesisError(null);
    try {
      const result = await synthesizeMemoryPair(firstMemory, secondMemory, aiConfig);
      setSynthesisTitle(result.title);
      setSynthesisNotes(result.synthesisEssay);
      if (result.sharedThemes.length > 0) {
        setSynthesizedTags(result.sharedThemes);
      }
      setSynthesisModelLabel(result.modelUsed);
    } catch (err) {
      setSynthesisError(
        err instanceof Error ? err.message : 'Failed to generate synthesis with AI.'
      );
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSynthesizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstMemory || !secondMemory || !synthesisTitle.trim() || !synthesisNotes.trim()) return;

    onCreateSynthesis({
      title: synthesisTitle.trim(),
      excerpt:
        synthesisNotes.trim().slice(0, 140) + (synthesisNotes.length > 140 ? '…' : ''),
      content: `${synthesisNotes.trim()}\n\nSynthesized from ${firstMemory.indexCode} (${firstMemory.title}) and ${secondMemory.indexCode} (${secondMemory.title}).`,
      domain: firstMemory.domain,
      tags: combinedTags,
      parentIds: [firstMemory.id, secondMemory.id],
    });

    setSynthesisTitle('');
    setSynthesisNotes('');
    setSynthesizedTags([]);
    setSynthesisModelLabel(null);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const handleAskArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setIsInterrogating(true);
    try {
      const result = await interrogateArchive(question.trim(), memories, aiConfig);
      setInterrogationAnswer(result.answer);
      setInterrogationModel(result.modelUsed);
    } catch (err) {
      setInterrogationAnswer(
        err instanceof Error
          ? `Unable to reach model: ${err.message}`
          : 'Unable to complete archive query.'
      );
    } finally {
      setIsInterrogating(false);
    }
  };

  const renderFormattedAnswer = (text: string) => {
    const parts = text.split(/(\[MNM-\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(MNM-\d+)\]$/);
      if (match) {
        const code = match[1];
        const target = memories.find((m) => m.indexCode === code);
        if (target) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onOpenReader(target)}
              className="mx-0.5 font-mono text-xs text-[#74A57F] dark:text-[#B58ACE] underline underline-offset-4 hover:text-[#5e8f69]"
            >
              {code}
            </button>
          );
        }
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  if (memories.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4">
        <h2 className="font-display text-xl text-zinc-900 dark:text-zinc-100">
          No Entries to Synthesize Yet
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Add memories, ideas, or daily logs in the Archive view first. Once saved, you can review them with Active Recall, bridge two memories together, or query your archive with local AI.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenCapture}
            className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Entry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Echoes &amp; AI Synthesis
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Review past entries, bridge two memories into a new idea, or ask questions across your archive.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAIConfig}
          className="text-xs font-mono text-[#74A57F] dark:text-[#B58ACE] hover:underline underline-offset-4 tabular-nums"
        >
          AI Engine ·{' '}
          {aiConfig.engineMode === 'cloud-gemini'
            ? 'gemini-3.8-flash'
            : `${aiConfig.modelTag} (${aiConfig.endpoint})`}
        </button>
      </div>

      {/* Section 1: Active Recall & Ask Archive */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
              <span>Active Recall Review</span>
              <span>
                Entry {(flashcardIndex % memories.length) + 1} of {memories.length}
              </span>
            </div>

            {activeFlashcard && (
              <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-3">
                <div className="text-xs font-mono text-[#74A57F] tabular-nums">
                  {activeFlashcard.createdAt} · {activeFlashcard.location || activeFlashcard.domain}
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tags: <span className="font-mono text-[#B58ACE]">{activeFlashcard.tags.join(' · ')}</span>
                </div>

                {!isCardRevealed ? (
                  <div className="py-5 text-center space-y-3">
                    <p className="font-display text-base text-zinc-700 dark:text-zinc-300">
                      {activeFlashcard.aiReflection?.recallPrompt ||
                        `Recall your entry from ${activeFlashcard.createdAt} (${activeFlashcard.domain}).`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCardRevealed(true)}
                      className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#B58ACE] hover:bg-[#9f71ba] rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal Entry</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 space-y-2 border-t border-zinc-200/70 dark:border-zinc-800">
                    <div className="font-display text-lg text-zinc-900 dark:text-zinc-100">
                      {activeFlashcard.title}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {activeFlashcard.excerpt}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeFlashcard && (
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsCardRevealed((v) => !v)}
                className="text-xs text-zinc-500 hover:text-[#74A57F] inline-flex items-center gap-1"
              >
                {isCardRevealed ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Reveal</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onRevisit(activeFlashcard.id);
                  setIsCardRevealed(false);
                  setFlashcardIndex((i) => i + 1);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors"
              >
                Mark Revisited · Next
              </button>
            </div>
          )}
        </div>

        {/* Ask the Archive */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  Ask Your Archive
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Query your {memories.length} saved {memories.length === 1 ? 'entry' : 'entries'} using <span className="font-mono text-[#74A57F]">{aiConfig.modelTag}</span>.
                </p>
              </div>
              <MessageSquare className="w-4 h-4 text-[#74A57F] shrink-0" />
            </div>

            <form onSubmit={handleAskArchive} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your saved memories, ideas, or daily logs..."
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
              />
              <button
                type="submit"
                disabled={isInterrogating || !question.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isInterrogating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Querying...</span>
                  </>
                ) : (
                  <span>Ask Archive</span>
                )}
              </button>
            </form>

            {interrogationAnswer && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-2">
                {interrogationModel && (
                  <div className="text-[11px] font-mono text-[#74A57F] dark:text-[#B58ACE]">
                    Model · {interrogationModel}
                  </div>
                )}
                <div className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {renderFormattedAnswer(interrogationAnswer)}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Bridge Two Entries */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Synthesize Two Entries
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select two entries to combine into a new linked idea.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {memories.length >= 2 && (
              <button
                type="button"
                onClick={handleDrawRandomPair}
                className="px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-[#74A57F] rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#74A57F]" />
                <span>Random Pair</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSynthesizing || !firstMemory || !secondMemory}
              onClick={handleAISynthesize}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#B58ACE] hover:bg-[#9f71ba] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Drafting...</span>
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5" />
                  <span>Draft with AI ({aiConfig.modelTag})</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <label className="block text-xs text-[#74A57F] font-mono">01. First Entry</label>
                <select
                  value={firstMemory?.id || ''}
                  onChange={(e) => setFirstId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                >
                  {memories.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.indexCode} — {m.title}
                    </option>
                  ))}
                </select>
                {firstMemory && (
                  <div className="pt-1 space-y-1.5">
                    <div className="text-xs font-mono text-zinc-500 tabular-nums">
                      {firstMemory.createdAt} · {firstMemory.domain}
                    </div>
                    <h4 className="font-display text-base text-zinc-900 dark:text-zinc-100">
                      {firstMemory.title}
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {firstMemory.excerpt}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <label className="block text-xs text-[#B58ACE] font-mono">02. Second Entry</label>
                <select
                  value={secondMemory?.id || ''}
                  onChange={(e) => setSecondId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                >
                  {memories.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.indexCode} — {m.title}
                    </option>
                  ))}
                </select>
                {secondMemory && (
                  <div className="pt-1 space-y-1.5">
                    <div className="text-xs font-mono text-zinc-500 tabular-nums">
                      {secondMemory.createdAt} · {secondMemory.domain}
                    </div>
                    <h4 className="font-display text-base text-zinc-900 dark:text-zinc-100">
                      {secondMemory.title}
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {secondMemory.excerpt}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSynthesizeSubmit}
            className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              {synthesisModelLabel && (
                <div className="text-[11px] font-mono text-[#74A57F] dark:text-[#B58ACE]">
                  Generated by {synthesisModelLabel}
                </div>
              )}
              {synthesisError && (
                <div className="text-xs text-red-600 dark:text-red-400">{synthesisError}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Synthesis Title
                </label>
                <input
                  type="text"
                  required
                  value={synthesisTitle}
                  onChange={(e) => setSynthesisTitle(e.target.value)}
                  placeholder="Title of the synthesized idea..."
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Synthesis Notes
                </label>
                <textarea
                  rows={4}
                  required
                  value={synthesisNotes}
                  onChange={(e) => setSynthesisNotes(e.target.value)}
                  placeholder="Write how these two entries connect..."
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:border-[#74A57F]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
              <span className="text-xs text-zinc-400 font-mono truncate">
                Links {firstMemory?.indexCode} + {secondMemory?.indexCode}
              </span>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5 shrink-0"
              >
                {justSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save Synthesis</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};
