import { EntryDomain, EntryKind, ExtractedEntities } from '../types/memory';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'was', 'were',
  'are', 'been', 'has', 'had', 'not', 'but', 'what', 'all', 'when', 'where',
  'who', 'will', 'more', 'about', 'into', 'than', 'them', 'some', 'could',
  'would', 'should', 'their', 'there', 'only', 'other', 'then', 'over', 'also',
  'after', 'before', 'through', 'between', 'under', 'while', 'which', 'upon',
  'every', 'within', 'without', 'like', 'just', 'very', 'much', 'many', 'such',
  'even', 'most', 'Being', 'being', 'those', 'these', 'your', 'ours', 'they',
  'were', 'been', 'each', 'both', 'during', 'always', 'never', 'often', 'still',
  'today', 'yesterday', 'felt', 'feel', 'think', 'thought', 'remember', 'noted',
]);

const THEME_LEXICON: Record<string, string[]> = {
  architecture: ['pavilion', 'column', 'concrete', 'timber', 'courtyard', 'stone', 'spatial', 'facade', 'arch', 'vault', 'room', 'building', 'light', 'shadow', 'oculus', 'corridor', 'stair'],
  acoustics: ['sound', 'echo', 'resonance', 'silence', 'quiet', 'rain', 'frequency', 'harmonic', 'chladni', 'listening', 'voice', 'audio', 'whisper', 'tone', 'rhythm'],
  botanical: ['leaf', 'tree', 'ginkgo', 'garden', 'moss', 'forest', 'flora', 'root', 'seed', 'petal', 'canopy', 'herbarium', 'fern', 'branch', 'soil'],
  philosophy: ['time', 'memory', 'consciousness', 'epistemology', 'ontology', 'duration', 'bergson', 'impermanence', 'presence', 'solitude', 'ethics', 'paradox', 'stillness'],
  design: ['typography', 'grid', 'proportion', 'modular', 'craft', 'ceramic', 'vessel', 'form', 'texture', 'material', 'minimalist', 'editorial', 'layout', 'ratio'],
  science: ['optics', 'astronomy', 'entropy', 'thermodynamics', 'spectrum', 'wavelength', 'observation', 'experiment', 'hypothesis', 'geometry', 'vector', 'physics'],
  literature: ['manuscript', 'poem', 'prose', 'essay', 'margin', 'book', 'library', 'letter', 'archive', 'folio', 'narrative', 'metaphor', 'diary'],
  journal: ['morning', 'evening', 'walk', 'coffee', 'conversation', 'reflection', 'daily', 'gratitude', 'habit', 'dream', 'routine'],
  'voice-note': ['transcribed', 'spoken', 'dictated', 'microphone', 'recording', 'whisper'],
};

/**
 * Natural Language Analysis helper function that suggests relevant tags based on the
 * content and title of a new entry, combining semantic theme lexicon matching,
 * archive tag resonance, inline #hashtags, and high-salience terms.
 */
export function suggestTagsFromContent(
  content: string,
  title: string = '',
  domain?: EntryDomain,
  kind?: EntryKind,
  existingArchiveTags: string[] = []
): string[] {
  const combined = `${title} ${content}`.trim();
  if (!combined) return [];

  const lower = combined.toLowerCase();
  const scores = new Map<string, number>();

  const addScore = (tag: string, points: number) => {
    const clean = tag
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '')
      .replace(/^-+|-+$/g, '');
    if (!clean || clean.length < 3 || STOP_WORDS.has(clean)) return;
    scores.set(clean, (scores.get(clean) || 0) + points);
  };

  // 1. Inline #hashtags get highest priority
  const inlineHashtags = Array.from(combined.matchAll(/#([a-zA-Z0-9_-]{3,24})/g));
  for (const match of inlineHashtags) {
    addScore(match[1], 10);
  }

  // 2. Semantic Theme Lexicon matching
  for (const [themeTag, keywords] of Object.entries(THEME_LEXICON)) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\w*\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches && matches.length > 0) {
        addScore(themeTag, matches.length * 3.5);
        if (kw.length >= 4) {
          addScore(kw, matches.length * 2.5);
        }
      }
    }
  }

  // 3. Match against existing unique tags in the user's archive
  for (const archiveTag of existingArchiveTags) {
    const cleanTag = archiveTag.toLowerCase().trim();
    if (cleanTag.length >= 3 && lower.includes(cleanTag)) {
      addScore(cleanTag, 5);
    }
  }

  // 4. Tokenize & compute term frequency + title boost
  const titleWords = new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  );

  const words = lower
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  for (const [word, count] of freq.entries()) {
    // Stem simple plurals if base word also exists
    const base = word.endsWith('s') && word.length > 5 && freq.has(word.slice(0, -1))
      ? word.slice(0, -1)
      : word;

    let points = count * 1.4;
    if (titleWords.has(word)) points += 3;
    if (word.length >= 6 && word.length <= 14) points += 0.8;
    addScore(base, points);
  }

  // 5. Contextual domain & entry kind cues
  if (domain) {
    addScore(domain.toLowerCase(), 1.5);
  }
  if (kind && kind !== 'memory') {
    addScore(kind.toLowerCase(), 1.2);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 8);
}

/**
 * Extracts structured entities (People, Locations, Dates, Themes) for the aoyu Engine pipeline (Stage 5).
 */
export function extractEntitiesFromContent(
  content: string,
  title: string = '',
  locationField: string = ''
): ExtractedEntities {
  const fullText = `${title}. ${content}`.trim();
  if (!fullText) {
    return { people: [], locations: [], dates: [], themes: [] };
  }

  // Dates: ISO dates, years (1900-2099), months + days, seasons
  const dateMatches = new Set<string>();
  const isoRegex = /\b\d{4}-\d{2}-\d{2}\b/g;
  const yearRegex = /\b(19\d{2}|20\d{2})\b/g;
  const monthRegex =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?\b/gi;
  const seasonRegex = /\b(Spring|Summer|Autumn|Winter)\s*(19\d{2}|20\d{2})?\b/gi;

  (fullText.match(isoRegex) || []).forEach((d) => dateMatches.add(d));
  (fullText.match(monthRegex) || []).forEach((d) => dateMatches.add(d.trim()));
  (fullText.match(seasonRegex) || []).forEach((d) => dateMatches.add(d.trim()));
  (fullText.match(yearRegex) || []).forEach((d) => dateMatches.add(d));

  // Locations: explicit location field + prepositional phrases ("in Kyoto", "at Zumthor's...", etc.)
  const locationMatches = new Set<string>();
  if (locationField.trim()) {
    locationMatches.add(locationField.trim());
  }
  const locPrepRegex =
    /\b(?:in|at|near|from|across|towards)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g;
  let locMatch: RegExpExecArray | null;
  const bannedCapitals = new Set([
    'The', 'This', 'That', 'When', 'Where', 'While', 'After', 'Before', 'During',
    'Spring', 'Summer', 'Autumn', 'Winter', 'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ]);
  while ((locMatch = locPrepRegex.exec(fullText)) !== null) {
    const candidate = locMatch[1].trim();
    const firstToken = candidate.split(/\s+/)[0];
    if (!bannedCapitals.has(firstToken) && candidate.length >= 3) {
      locationMatches.add(candidate);
    }
  }

  // People: Capitalized two-word proper names or honorifics/references ("with [Name]", "by [Name]")
  const peopleMatches = new Set<string>();
  const personContextRegex =
    /\b(?:with|by|from|met|spoke to|according to|architect|philosopher|writer|friend|professor|dr\.|mr\.|ms\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = personContextRegex.exec(fullText)) !== null) {
    const candidate = pMatch[1].trim();
    const firstToken = candidate.split(/\s+/)[0];
    if (!bannedCapitals.has(firstToken) && !locationMatches.has(candidate)) {
      peopleMatches.add(candidate);
    }
  }

  // Themes: derived from suggestTagsFromContent
  const themes = suggestTagsFromContent(content, title).slice(0, 5);

  return {
    people: Array.from(peopleMatches).slice(0, 4),
    locations: Array.from(locationMatches).slice(0, 4),
    dates: Array.from(dateMatches).slice(0, 4),
    themes,
  };
}
