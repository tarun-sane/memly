import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Clock, GitCommitHorizontal, Plus } from 'lucide-react';
import { MemoryEntry } from '../types/memory';

interface TimelineViewProps {
  memories: MemoryEntry[];
  onOpenReader: (entry: MemoryEntry) => void;
  onRevisit: (id: string) => void;
  onOpenCapture: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  memories,
  onOpenReader,
  onRevisit,
  onOpenCapture,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('All');

  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [memories]);

  // Dynamically derive years from actual saved entries
  const yearMetrics = useMemo(() => {
    const yearSet = new Set<string>();
    memories.forEach((m) => {
      if (m.createdAt && m.createdAt.length >= 4) {
        yearSet.add(m.createdAt.slice(0, 4));
      }
    });
    const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
    return years.map((yr) => {
      const matching = memories.filter((m) => m.createdAt.startsWith(yr));
      const ideasCount = matching.filter((m) => m.kind === 'idea' || m.kind === 'epiphany').length;
      const memoriesCount = matching.length - ideasCount;
      const totalRevisits = matching.reduce((acc, item) => acc + item.revisitedCount, 0);
      return {
        year: yr,
        total: matching.length,
        ideasCount,
        memoriesCount,
        totalRevisits,
      };
    });
  }, [memories]);

  const filteredMemories = useMemo(() => {
    if (selectedYear === 'All') return sortedMemories;
    return sortedMemories.filter((m) => m.createdAt.startsWith(selectedYear));
  }, [sortedMemories, selectedYear]);

  const groupedByYear = useMemo(() => {
    const groups: Record<string, MemoryEntry[]> = {};
    filteredMemories.forEach((entry) => {
      const yr = entry.createdAt.slice(0, 4);
      if (!groups[yr]) groups[yr] = [];
      groups[yr].push(entry);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredMemories]);

  const calculateElapsedLabel = (dateStr: string) => {
    const created = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.max(
      0,
      Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    );
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    const months = Math.floor(diffDays / 30.44);
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}m ago` : `${years} years ago`;
  };

  if (memories.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4">
        <h2 className="font-display text-xl text-zinc-900 dark:text-zinc-100">
          No Timeline Entries Yet
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          As you record daily logs, memories, and ideas, your chronological timeline will automatically organize them by year and date.
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Timeline
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Browse your saved memories, daily logs, and ideas in chronological order.
          </p>
        </div>

        {yearMetrics.length > 1 && (
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setSelectedYear('All')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedYear === 'All'
                  ? 'bg-[#74A57F] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              All Years
            </button>
            {yearMetrics.map((ym) => (
              <button
                key={ym.year}
                type="button"
                onClick={() => setSelectedYear(ym.year)}
                className={`px-2.5 py-1.5 text-xs font-mono rounded-md transition-colors tabular-nums whitespace-nowrap shrink-0 ${
                  selectedYear === ym.year
                    ? 'bg-[#74A57F] text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {ym.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Year Summary Cards */}
      {yearMetrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {yearMetrics.map((ym) => {
            const isActive = selectedYear === ym.year;
            return (
              <button
                key={ym.year}
                type="button"
                onClick={() => setSelectedYear(isActive ? 'All' : ym.year)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  isActive
                    ? 'bg-[#74A57F] text-white border-[#74A57F]'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800 hover:border-[#74A57F]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                  <span className={isActive ? 'text-white/80' : 'text-zinc-400'}>
                    YEAR
                  </span>
                  <span>{ym.year}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-normal tabular-nums">{ym.total}</span>
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-white/85' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {ym.memoriesCount}m · {ym.ideasCount}i
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Chronological Stream */}
      <div className="space-y-10">
        {groupedByYear.map(([year, entries]) => (
          <section key={year} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-3 pb-2 border-b lg:border-b-0 border-zinc-200 dark:border-zinc-800">
              <div className="font-display text-3xl text-[#74A57F] dark:text-[#B58ACE] tabular-nums">
                {year}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </div>
            </div>

            <div className="lg:col-span-9 divide-y divide-zinc-200/80 dark:divide-zinc-800/80 border-t border-zinc-200/80 dark:border-zinc-800/80">
              {entries.map((entry) => {
                const linkedEntries = entry.connectedIds
                  .map((id) => memories.find((m) => m.id === id))
                  .filter((m): m is MemoryEntry => Boolean(m));

                return (
                  <article
                    key={entry.id}
                    className="py-5 first:pt-5 flex flex-col sm:flex-row sm:items-start justify-between gap-6 group"
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                        <span className="text-[#74A57F] font-medium">
                          {entry.createdAt}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{calculateElapsedLabel(entry.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.indexCode}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans capitalize">{entry.kind}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{entry.domain}</span>
                      </div>

                      <h3
                        onClick={() => onOpenReader(entry)}
                        className="font-display text-lg font-normal text-zinc-900 dark:text-zinc-100 group-hover:text-[#74A57F] dark:group-hover:text-[#B58ACE] transition-colors cursor-pointer"
                      >
                        {entry.title}
                      </h3>

                      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {entry.excerpt}
                      </p>

                      {linkedEntries.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1 text-[#B58ACE]">
                            <GitCommitHorizontal className="w-3.5 h-3.5" />
                            <span>Linked:</span>
                          </span>
                          {linkedEntries.map((linked, idx) => (
                            <React.Fragment key={linked.id}>
                              <button
                                type="button"
                                onClick={() => onOpenReader(linked)}
                                className="hover:text-[#74A57F] underline decoration-[#74A57F]/50 underline-offset-4 font-mono tabular-nums"
                              >
                                {linked.indexCode}
                              </button>
                              {idx < linkedEntries.length - 1 && <span aria-hidden="true">·</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono tabular-nums flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#74A57F]" />
                        <span>{entry.revisitedCount}×</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRevisit(entry.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#B58ACE] hover:bg-[#9f71ba] rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          Revisit
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReader(entry)}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <span>Open</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
