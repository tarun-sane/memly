import { MemoryEntry } from '../types/memory';

export interface MnemosyneArchiveBackup {
  application: 'memly — Idea & Memory Sanctuary';
  schemaVersion: '1.2.0';
  exportedAt: string;
  metrics: {
    totalEntries: number;
    totalMemories: number;
    totalIdeas: number;
    totalConnections: number;
  };
  entries: MemoryEntry[];
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Exports the entire current memory archive as a formatted JSON file for local backup.
 */
export function exportArchiveAsJson(memories: MemoryEntry[]): string {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const ideasCount = memories.filter((m) => m.kind === 'idea' || m.kind === 'epiphany').length;
  const connectionsCount = Math.round(
    memories.reduce((sum, m) => sum + m.connectedIds.length, 0) / 2
  );

  const payload: MnemosyneArchiveBackup = {
    application: 'memly — Idea & Memory Sanctuary',
    schemaVersion: '1.2.0',
    exportedAt: now.toISOString(),
    metrics: {
      totalEntries: memories.length,
      totalMemories: memories.length - ideasCount,
      totalIdeas: ideasCount,
      totalConnections: connectionsCount,
    },
    entries: memories,
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const filename = `memly-archive-${dateStamp}.json`;
  triggerFileDownload(blob, filename);
  return filename;
}

/**
 * Exports a single memory or idea entry as a standalone JSON file.
 */
export function exportSingleEntryAsJson(entry: MemoryEntry): string {
  const jsonContent = JSON.stringify(
    {
      application: 'memly — Idea & Memory Sanctuary',
      exportedAt: new Date().toISOString(),
      entry,
    },
    null,
    2
  );
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const filename = `${entry.indexCode.toLowerCase()}-${entry.createdAt}.json`;
  triggerFileDownload(blob, filename);
  return filename;
}

/**
 * Exports the archive as a clean Markdown monograph (.md) for local offline reading.
 */
export function exportArchiveAsMarkdown(memories: MemoryEntry[]): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    '# memly — Personal Idea & Memory Monograph',
    `Exported on ${dateStamp} · ${memories.length} Indexed Entries`,
    '',
    '---',
    '',
  ];

  const sorted = [...memories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const m of sorted) {
    lines.push(`## ${m.indexCode}: ${m.title}`);
    lines.push(
      `Date: ${m.createdAt} · Classification: ${m.kind} · Domain: ${m.domain}${
        m.location ? ` · Location: ${m.location}` : ''
      } · Tone: ${m.emotion}`
    );
    lines.push(`Descriptors: ${m.tags.join(', ')}`);
    lines.push('');
    lines.push(m.content);
    if (m.annotations && m.annotations.length > 0) {
      lines.push('');
      lines.push('### Margin Notes');
      for (const note of m.annotations) {
        lines.push(`- (${note.createdAt}) ${note.text}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const filename = `memly-monograph-${dateStamp}.md`;
  triggerFileDownload(blob, filename);
  return filename;
}

/**
 * Exports the archive as a CSV spreadsheet (.csv).
 */
export function exportArchiveAsCsv(memories: MemoryEntry[]): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'IndexCode',
    'Date',
    'Kind',
    'Domain',
    'Title',
    'Location',
    'Emotion',
    'Tags',
    'ConnectedCount',
    'RevisitedCount',
    'Excerpt',
  ];

  const rows = memories.map((m) =>
    [
      escapeCsv(m.indexCode),
      escapeCsv(m.createdAt),
      escapeCsv(m.kind),
      escapeCsv(m.domain),
      escapeCsv(m.title),
      escapeCsv(m.location),
      escapeCsv(m.emotion),
      escapeCsv(m.tags.join('; ')),
      escapeCsv(m.connectedIds.length),
      escapeCsv(m.revisitedCount),
      escapeCsv(m.excerpt),
    ].join(',')
  );

  const csvString = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
  const filename = `memly-ledger-${dateStamp}.csv`;
  triggerFileDownload(blob, filename);
  return filename;
}

/**
 * Parses and validates an imported JSON backup file (either full archive backup or raw array).
 */
export function parseImportedArchiveJson(rawJson: string): MemoryEntry[] {
  const parsed = JSON.parse(rawJson);
  const candidateArray: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.entries)
      ? parsed.entries
      : parsed?.entry
        ? [parsed.entry]
        : [];

  if (candidateArray.length === 0) {
    throw new Error('No valid memory entries found in the selected JSON file.');
  }

  return candidateArray
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object' && 'title' in item && 'content' in item)
    )
    .map((item, idx) => ({
      id: typeof item.id === 'string' ? item.id : `mem-import-${Date.now()}-${idx}`,
      indexCode:
        typeof item.indexCode === 'string'
          ? item.indexCode
          : `MNM-${String(idx + 1).padStart(3, '0')}`,
      title: String(item.title || 'Untitled Entry'),
      excerpt:
        typeof item.excerpt === 'string'
          ? item.excerpt
          : String(item.content || '').slice(0, 140),
      content: String(item.content || ''),
      kind: (item.kind as MemoryEntry['kind']) || 'memory',
      domain: (item.domain as MemoryEntry['domain']) || 'Architecture',
      emotion: (item.emotion as MemoryEntry['emotion']) || 'Serene',
      createdAt:
        typeof item.createdAt === 'string'
          ? item.createdAt
          : new Date().toISOString().slice(0, 10),
      location: typeof item.location === 'string' ? item.location : undefined,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : ['imported'],
      connectedIds: Array.isArray(item.connectedIds) ? item.connectedIds.map(String) : [],
      visualStudy: (item.visualStudy as MemoryEntry['visualStudy']) || 'pavilion',
      customImageUrl: typeof item.customImageUrl === 'string' ? item.customImageUrl : undefined,
      audioDataUrl: typeof item.audioDataUrl === 'string' ? item.audioDataUrl : undefined,
      audioDurationSec:
        typeof item.audioDurationSec === 'number' ? item.audioDurationSec : undefined,
      audioTranscriptModel:
        typeof item.audioTranscriptModel === 'string' ? item.audioTranscriptModel : undefined,
      extractedEntities: item.extractedEntities as MemoryEntry['extractedEntities'],
      revisitedCount: typeof item.revisitedCount === 'number' ? item.revisitedCount : 1,
      lastRevisited:
        typeof item.lastRevisited === 'string'
          ? item.lastRevisited
          : new Date().toISOString().slice(0, 10),
      isPinned: Boolean(item.isPinned),
      sensory: item.sensory as MemoryEntry['sensory'],
      annotations: Array.isArray(item.annotations)
        ? (item.annotations as MemoryEntry['annotations'])
        : undefined,
      aiReflection: item.aiReflection as MemoryEntry['aiReflection'],
    }));
}
