export type EntryKind = 'idea' | 'memory' | 'epiphany' | 'fragment' | 'observation';

export type EntryDomain =
  | 'Architecture'
  | 'Philosophy'
  | 'Design'
  | 'Nature'
  | 'Literature'
  | 'Science'
  | 'Personal';

export type VisualStudyType =
  | 'pavilion'
  | 'ceramics'
  | 'observatory'
  | 'botanical'
  | 'acoustics'
  | 'typography'
  | 'horizon'
  | 'none';

export interface MarginAnnotation {
  id: string;
  text: string;
  createdAt: string;
}

export interface SensoryCoordinates {
  season?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  weather?: string;
  ambientDecibels?: number;
  lightKelvin?: number;
}

export interface ExtractedEntities {
  people: string[];
  locations: string[];
  dates: string[];
  themes: string[];
}

export interface AIReflectionNote {
  coreMotif: string;
  recallPrompt: string;
  suggestedConnectionCode: string;
  connectionRationale: string;
  suggestedTags: string[];
  modelUsed: string;
}

export interface MemoryEntry {
  id: string;
  indexCode: string;
  title: string;
  excerpt: string;
  content: string;
  kind: EntryKind;
  domain: EntryDomain;
  emotion: 'Serene' | 'Nostalgic' | 'Luminous' | 'Contemplative' | 'Clarifying';
  createdAt: string; // ISO date string YYYY-MM-DD
  location?: string;
  tags: string[];
  connectedIds: string[]; // IDs of related past memories or ideas
  visualStudy: VisualStudyType;
  customImageUrl?: string;
  audioDataUrl?: string;
  audioDurationSec?: number;
  audioTranscriptModel?: string;
  extractedEntities?: ExtractedEntities;
  revisitedCount: number;
  lastRevisited: string; // ISO date string YYYY-MM-DD
  isPinned: boolean;
  sensory?: SensoryCoordinates;
  annotations?: MarginAnnotation[];
  aiReflection?: AIReflectionNote;
}

export type ActiveNavTab = 'archive' | 'constellation' | 'timeline' | 'echoes' | 'local-ai';
export type ArchiveLayoutMode = 'bento' | 'ledger';

export type AIEngineMode = 'local-ollama' | 'local-openai' | 'cloud-gemini';

export interface LocalAIConfig {
  engineMode: AIEngineMode;
  endpoint: string; // e.g., http://localhost:11434
  modelTag: string; // e.g., gemma4:e2b
  whisperEndpoint?: string; // e.g., http://localhost:8000 (Faster-Whisper server)
  whisperModel?: string; // e.g., Systran/faster-whisper-small
  embeddingModel?: string; // e.g., nomic-embed-text
  autoFallbackToCloud: boolean;
}
