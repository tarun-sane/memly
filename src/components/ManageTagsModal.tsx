import React, { useMemo, useState } from 'react';
import { Check, Edit3, Search, Tag, Trash2, X } from 'lucide-react';
import { MemoryEntry } from '../types/memory';

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryEntry[];
  onRenameTag: (oldTag: string, newTag: string) => void;
  onBulkRemoveTags: (tagsToRemove: string[]) => void;
  onFilterByTag: (tag: string) => void;
}

export const ManageTagsModal: React.FC<ManageTagsModalProps> = ({
  isOpen,
  onClose,
  memories,
  onRenameTag,
  onBulkRemoveTags,
  onFilterByTag,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const tagInventory = useMemo(() => {
    const map = new Map<string, { count: number; sampleCodes: string[] }>();
    for (const entry of memories) {
      for (const rawTag of entry.tags) {
        const tag = rawTag.trim().toLowerCase();
        if (!tag) continue;
        const current = map.get(tag) || { count: 0, sampleCodes: [] };
        current.count += 1;
        if (current.sampleCodes.length < 3) {
          current.sampleCodes.push(entry.indexCode);
        }
        map.set(tag, current);
      }
    }
    return Array.from(map.entries())
      .map(([tag, info]) => ({
        tag,
        count: info.count,
        sampleCodes: info.sampleCodes,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [memories]);

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tagInventory;
    return tagInventory.filter((item) => item.tag.includes(q));
  }, [tagInventory, searchQuery]);

  if (!isOpen) return null;

  const showTempFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleSelect = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const allVisibleSelected =
    filteredTags.length > 0 && filteredTags.every((t) => selectedTags.includes(t.tag));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredTags.map((t) => t.tag));
      setSelectedTags((prev) => prev.filter((t) => !visibleSet.has(t)));
    } else {
      const merged = new Set([...selectedTags, ...filteredTags.map((t) => t.tag)]);
      setSelectedTags(Array.from(merged));
    }
  };

  const handleStartRename = (tag: string) => {
    setEditingTag(tag);
    setRenameValue(tag);
  };

  const handleConfirmRename = (e: React.FormEvent, oldTag: string) => {
    e.preventDefault();
    const cleaned = renameValue
      .trim()
      .toLowerCase()
      .replace(/,/g, '')
      .replace(/\s+/g, '-');

    if (!cleaned || cleaned === oldTag) {
      setEditingTag(null);
      return;
    }

    onRenameTag(oldTag, cleaned);
    setSelectedTags((prev) => prev.map((t) => (t === oldTag ? cleaned : t)));
    setEditingTag(null);
    showTempFeedback(`Renamed "#${oldTag}" to "#${cleaned}" across archive`);
  };

  const handleRemoveSelected = () => {
    if (selectedTags.length === 0) return;
    const count = selectedTags.length;
    onBulkRemoveTags(selectedTags);
    setSelectedTags([]);
    showTempFeedback(
      `Removed ${count} ${count === 1 ? 'tag' : 'tags'} from all matching entries`
    );
  };

  const handleRemoveSingle = (tag: string) => {
    onBulkRemoveTags([tag]);
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
    showTempFeedback(`Removed "#${tag}" from archive entries`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#74A57F]/25 dark:bg-zinc-950/75 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-tags-modal-title"
        className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#74A57F]" />
              <h2
                id="manage-tags-modal-title"
                className="font-display text-xl font-normal text-zinc-900 dark:text-zinc-100"
              >
                Manage Archive Tags
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Inspect all {tagInventory.length} unique tags across {memories.length} entries, rename descriptors globally, or bulk-remove tags.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-[#74A57F] rounded-lg transition-colors"
            title="Close Manage Tags"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3.5 bg-zinc-50/80 dark:bg-zinc-950/70 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter unique tags..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={handleRemoveSelected}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  Bulk Remove ({selectedTags.length})
                </span>
              </button>
            )}
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
              {filteredTags.length} of {tagInventory.length} tags
            </span>
          </div>
        </div>

        {feedback && (
          <div className="px-6 py-2.5 bg-[#74A57F]/15 border-b border-[#74A57F]/30 text-xs font-mono text-[#456b4e] dark:text-[#98c9a3] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[#74A57F]" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Tag Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {filteredTags.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No tags match your current filter.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-50/40 dark:bg-zinc-950/40">
                  <th className="py-2.5 pl-6 pr-2 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all visible tags"
                      checked={allVisibleSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-[#74A57F] cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-normal">Tag Descriptor</th>
                  <th className="py-2.5 px-3 font-normal">Entries</th>
                  <th className="py-2.5 px-3 font-normal">Indexed In</th>
                  <th className="py-2.5 pr-6 pl-3 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-xs">
                {filteredTags.map((item) => {
                  const isChecked = selectedTags.includes(item.tag);
                  const isEditing = editingTag === item.tag;

                  return (
                    <tr
                      key={item.tag}
                      className={`transition-colors ${
                        isChecked
                          ? 'bg-[#74A57F]/10 dark:bg-[#74A57F]/15'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <td className="py-3 pl-6 pr-2 w-10">
                        <input
                          type="checkbox"
                          aria-label={`Select tag ${item.tag}`}
                          checked={isChecked}
                          onChange={() => handleToggleSelect(item.tag)}
                          className="rounded border-zinc-300 dark:border-zinc-700 accent-[#74A57F] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {isEditing ? (
                          <form
                            onSubmit={(e) => handleConfirmRename(e, item.tag)}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="px-2.5 py-1 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-[#74A57F] rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="px-2.5 py-1 text-xs font-sans font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-md"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTag(null)}
                              className="px-2 py-1 text-xs font-sans text-zinc-500 hover:text-zinc-800"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onFilterByTag(item.tag);
                              onClose();
                            }}
                            title="Filter archive by this tag"
                            className="text-zinc-800 dark:text-zinc-200 hover:text-[#74A57F] dark:hover:text-[#74A57F] font-medium transition-colors"
                          >
                            #{item.tag}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                        {item.count} {item.count === 1 ? 'entry' : 'entries'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {item.sampleCodes.join(' · ')}
                        {item.count > 3 ? ` +${item.count - 3}` : ''}
                      </td>
                      <td className="py-3 pr-6 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartRename(item.tag)}
                            title={`Rename #${item.tag}`}
                            className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-[#74A57F] hover:text-white rounded-md transition-colors inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSingle(item.tag)}
                            title={`Remove #${item.tag} from all entries`}
                            className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs text-zinc-500">
          <span>Click any tag name to filter the Archive view by that descriptor.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
