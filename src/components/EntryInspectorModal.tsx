import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Brain,
  Check,
  Clock,
  Download,
  Edit3,
  Link2,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { LocalAIConfig, MemoryEntry } from '../types/memory';
import { exportSingleEntryAsJson } from '../utils/archiveIO';
import { analyzeMemoryEntry } from '../utils/aiClient';
import { VisualStudyArtwork } from './VisualStudyArtwork';

interface EntryInspectorModalProps {
  entry: MemoryEntry | null;
  allMemories: MemoryEntry[];
  aiConfig: LocalAIConfig;
  onClose: () => void;
  onSelectEntry: (entry: MemoryEntry) => void;
  onUpdateEntry: (updated: MemoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRevisit: (id: string) => void;
  onToggleConnection: (sourceId: string, targetId: string) => void;
}

export const EntryInspectorModal: React.FC<EntryInspectorModalProps> = ({
  entry,
  allMemories,
  aiConfig,
  onClose,
  onSelectEntry,
  onUpdateEntry,
  onDeleteEntry,
  onTogglePin,
  onRevisit,
  onToggleConnection,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTags, setEditTags] = useState('');
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const [newAnnotation, setNewAnnotation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Reading progress state (0 to 100)
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const updateScrollProgress = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollableHeight = el.scrollHeight - el.clientHeight;
    if (scrollableHeight <= 4) {
      setReadingProgress(100);
      return;
    }
    const percent = Math.min(100, Math.max(0, Math.round((el.scrollTop / scrollableHeight) * 100)));
    setReadingProgress(percent);
  };

  useEffect(() => {
    if (entry) {
      setEditTitle(entry.title);
      setEditContent(entry.content);
      setEditLocation(entry.location || '');
      setEditTags(entry.tags.join(', '));
      setIsEditing(false);
      setShowLinkPicker(false);
      setAnalysisError(null);
      setReadingProgress(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      // Measure initial scroll state after render
      const timer = setTimeout(updateScrollProgress, 60);
      return () => clearTimeout(timer);
    }
  }, [entry?.id]);

  if (!entry) return null;

  const connectedEntries = entry.connectedIds
    .map((id) => allMemories.find((m) => m.id === id))
    .filter((m): m is MemoryEntry => Boolean(m));

  const wordCount = entry.content.trim().split(/\s+/).length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 180));

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const firstPara = editContent.trim().split('\n')[0];
    const updatedExcerpt =
      firstPara.length > 145 ? `${firstPara.slice(0, 145)}…` : firstPara;

    onUpdateEntry({
      ...entry,
      title: editTitle.trim() || entry.title,
      content: editContent.trim() || entry.content,
      excerpt: updatedExcerpt,
      location: editLocation.trim() || undefined,
      tags: editTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    });
    setIsEditing(false);
  };

  const handleAddAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnotation.trim()) return;
    const updatedAnnotations = [
      ...(entry.annotations || []),
      {
        id: `ann-${Date.now()}`,
        text: newAnnotation.trim(),
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ];
    onUpdateEntry({
      ...entry,
      annotations: updatedAnnotations,
    });
    setNewAnnotation('');
  };

  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const reflection = await analyzeMemoryEntry(entry, allMemories, aiConfig);
      onUpdateEntry({
        ...entry,
        aiReflection: reflection,
      });
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unable to generate AI reflection.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const suggestedTargetEntry = entry.aiReflection?.suggestedConnectionCode
    ? allMemories.find((m) => m.indexCode === entry.aiReflection?.suggestedConnectionCode)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#74A57F]/25 dark:bg-zinc-950/75 backdrop-blur-xs">
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollProgress}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col justify-between overflow-y-auto shadow-2xl"
      >
        <div>
          {/* Sticky Top Reader Bar with Subtle Reading Progress Indicator */}
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs border-b border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                <span className="text-[#74A57F] font-medium">{entry.indexCode}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize font-sans">{entry.kind}</span>
                <span aria-hidden="true">·</span>
                <span className="font-sans">{entry.domain}</span>
                <span aria-hidden="true">·</span>
                <span>{readingTimeMin} min read</span>
                <span aria-hidden="true">·</span>
                <span
                  title="Reading scroll progress"
                  className="text-[#74A57F] dark:text-[#B58ACE] font-mono tabular-nums"
                >
                  {readingProgress}% read
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => exportSingleEntryAsJson(entry)}
                  className="p-1.5 text-zinc-500 hover:text-[#74A57F] hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Export this entry as JSON"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onRevisit(entry.id)}
                  className="px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  title="Increment revisit counter"
                >
                  <Clock className="w-3.5 h-3.5 text-[#74A57F]" />
                  <span className="font-mono tabular-nums">{entry.revisitedCount}×</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTogglePin(entry.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    entry.isPinned
                      ? 'text-[#74A57F] bg-[#74A57F]/15'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  title={entry.isPinned ? 'Unpin from Sanctuary Shelf' : 'Pin to Sanctuary Shelf'}
                >
                  <Bookmark className="w-4 h-4" fill={entry.isPinned ? 'currentColor' : 'none'} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing((prev) => !prev)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isEditing
                      ? 'text-[#74A57F] bg-[#74A57F]/15'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  title="Edit Manuscript"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDeleteEntry(entry.id);
                    onClose();
                  }}
                  className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                  title="Delete Entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-zinc-500 hover:text-[#74A57F] rounded-lg transition-colors"
                  title="Close Reader"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Subtle Reading Progress Bar */}
            <div
              role="progressbar"
              aria-label="Reading progress"
              aria-valuenow={readingProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
            >
              <div
                className="h-full transition-all duration-150 ease-out"
                style={{
                  width: `${readingProgress}%`,
                  background: 'linear-gradient(90deg, #74A57F 0%, #B58ACE 100%)',
                }}
              />
            </div>
          </div>

          {/* Visual Study Artwork Banner */}
          <VisualStudyArtwork
            study={entry.visualStudy}
            customImageUrl={entry.customImageUrl}
            title={entry.title}
            indexCode={entry.indexCode}
            className="h-56"
          />

          {/* Main Manuscript Body or Edit Form */}
          <div className="p-6 sm:p-8 space-y-8">
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-base font-display bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Manuscript Content
                  </label>
                  <textarea
                    rows={8}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 leading-relaxed focus:outline-none focus:border-[#74A57F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Descriptors (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="space-y-3">
                  {/* Unboxed Metadata Line */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                    <span>Recorded {entry.createdAt}</span>
                    {entry.location && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-sans">
                          <MapPin className="w-3 h-3 text-[#74A57F]" />
                          {entry.location}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">{entry.emotion} resonance</span>
                    <span aria-hidden="true">·</span>
                    <span>Last revisited {entry.lastRevisited}</span>
                  </div>

                  <h1 className="font-display text-2xl sm:text-3xl font-normal text-zinc-900 dark:text-zinc-100 leading-tight">
                    {entry.title}
                  </h1>
                </div>

                {/* Local Voice Recording Playback if captured via microphone */}
                {entry.audioDataUrl && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5 text-[#74A57F]">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Stored Local Voice Note</span>
                      </span>
                      <span>{entry.audioTranscriptModel || 'Faster-Whisper · Local STT'}</span>
                    </div>
                    <audio controls src={entry.audioDataUrl} className="w-full h-9" />
                  </div>
                )}

                {/* Multi-paragraph Editorial Prose */}
                <div className="space-y-4 text-[15px] text-zinc-700 dark:text-zinc-300 leading-[1.75] max-w-[68ch]">
                  {entry.content.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Extracted Entities (Stage 5 of aoyu Engine) if present */}
                {entry.extractedEntities &&
                  (entry.extractedEntities.people.length > 0 ||
                    entry.extractedEntities.locations.length > 0 ||
                    entry.extractedEntities.dates.length > 0) && (
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400 space-y-1 font-mono">
                      <div className="text-[11px] text-[#74A57F]">
                        aoyu Engine · Extracted Entities
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {entry.extractedEntities.people.length > 0 && (
                          <span>People: {entry.extractedEntities.people.join(', ')}</span>
                        )}
                        {entry.extractedEntities.locations.length > 0 && (
                          <span>Locations: {entry.extractedEntities.locations.join(', ')}</span>
                        )}
                        {entry.extractedEntities.dates.length > 0 && (
                          <span>Dates: {entry.extractedEntities.dates.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  )}

                {/* Unboxed Descriptors */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4 text-xs">
                  <span className="text-zinc-400 dark:text-zinc-500">Descriptors</span>
                  <span className="font-mono text-[#74A57F] dark:text-[#B58ACE]">
                    {entry.tags.join(' · ')}
                  </span>
                </div>
              </>
            )}

            {/* AI Archivist Motif Reflection (Gemma 4 E2B / Gemini) */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    AI Archivist Reflection & Motif Analysis
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Distill the structural motif and discover hidden cross-archive connections using <span className="font-mono text-[#74A57F]">{aiConfig.modelTag}</span>.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleRunAIAnalysis}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] disabled:opacity-60 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-3.5 h-3.5" />
                      <span>{entry.aiReflection ? 'Refresh Analysis' : 'Analyze with AI'}</span>
                    </>
                  )}
                </button>
              </div>

              {analysisError && (
                <div className="text-xs text-red-600 dark:text-red-400">{analysisError}</div>
              )}

              {entry.aiReflection && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
                  <div className="font-mono text-[11px] text-[#74A57F] dark:text-[#B58ACE]">
                    Model · {entry.aiReflection.modelUsed}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Core Motif:{' '}
                    </span>
                    <span className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {entry.aiReflection.coreMotif}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Recall Prompt:{' '}
                    </span>
                    <span className="text-zinc-600 dark:text-zinc-300 italic">
                      "{entry.aiReflection.recallPrompt}"
                    </span>
                  </div>
                  {suggestedTargetEntry && (
                    <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3">
                      <div className="text-zinc-600 dark:text-zinc-300">
                        <span className="font-mono text-[#74A57F] dark:text-[#B58ACE]">
                          {suggestedTargetEntry.indexCode}
                        </span>{' '}
                        — {entry.aiReflection.connectionRationale}
                      </div>
                      {!entry.connectedIds.includes(suggestedTargetEntry.id) && (
                        <button
                          type="button"
                          onClick={() => onToggleConnection(entry.id, suggestedTargetEntry.id)}
                          className="px-2.5 py-1 text-xs font-medium bg-[#B58ACE] hover:bg-[#9f71ba] text-white rounded-md whitespace-nowrap shrink-0"
                        >
                          + Link {suggestedTargetEntry.indexCode}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Marginalia & Dated Annotations */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Marginalia & Temporal Annotations ({(entry.annotations || []).length})
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Layer new thoughts onto this memory without altering the original manuscript.
                </p>
              </div>

              {(entry.annotations || []).length > 0 && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {(entry.annotations || []).map((note) => (
                    <div key={note.id} className="py-2.5 space-y-1 text-xs">
                      <div className="font-mono text-[11px] text-zinc-400 tabular-nums">
                        Noted on {note.createdAt}
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {note.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddAnnotation} className="flex gap-2">
                <input
                  type="text"
                  value={newAnnotation}
                  onChange={(e) => setNewAnnotation(e.target.value)}
                  placeholder="Add a margin note or subsequent reflection..."
                  className="flex-1 px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg inline-flex items-center gap-1.5 shrink-0"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Add Note</span>
                </button>
              </form>
            </div>

            {/* Associative Memory Filaments Section */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Connected Past Memories & Ideas ({connectedEntries.length})
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Direct associative bridges traversing your archive.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLinkPicker((prev) => !prev)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#B58ACE] hover:bg-[#9f71ba] rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{showLinkPicker ? 'Done Linking' : 'Link Memory'}</span>
                </button>
              </div>

              {showLinkPicker && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {allMemories
                    .filter((m) => m.id !== entry.id)
                    .map((candidate) => {
                      const isLinked = entry.connectedIds.includes(candidate.id);
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => onToggleConnection(entry.id, candidate.id)}
                          className="w-full py-2 px-2 text-left text-xs flex items-center justify-between gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md transition-colors"
                        >
                          <span className="truncate text-zinc-800 dark:text-zinc-200">
                            <span className="font-mono text-zinc-400 mr-2 tabular-nums">
                              {candidate.indexCode}
                            </span>
                            {candidate.title}
                          </span>
                          <span
                            className={`font-mono text-[11px] shrink-0 ${
                              isLinked
                                ? 'text-[#74A57F] dark:text-[#B58ACE] font-medium'
                                : 'text-zinc-400'
                            }`}
                          >
                            {isLinked ? 'Linked ✓' : '+ Link'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {connectedEntries.map((conn) => (
                  <div
                    key={conn.id}
                    onClick={() => onSelectEntry(conn)}
                    className="py-3.5 flex items-start justify-between gap-4 group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {conn.indexCode} · {conn.createdAt} · {conn.domain}
                      </div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[#74A57F] dark:group-hover:text-[#B58ACE] transition-colors">
                        {conn.title}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                        {conn.excerpt}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-[#74A57F] shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
