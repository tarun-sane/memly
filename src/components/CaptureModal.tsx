import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Cpu,
  Mic,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  EntryDomain,
  EntryKind,
  ExtractedEntities,
  LocalAIConfig,
  MemoryEntry,
  VisualStudyType,
} from '../types/memory';
import {
  extractEntitiesFromContent,
  suggestTagsFromContent,
  transcribeWithFasterWhisper,
} from '../utils/aiClient';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMemories: MemoryEntry[];
  aiConfig: LocalAIConfig;
  onSave: (entryData: {
    title: string;
    excerpt: string;
    content: string;
    kind: EntryKind;
    domain: EntryDomain;
    emotion: MemoryEntry['emotion'];
    createdAt: string;
    location?: string;
    tags: string[];
    connectedIds: string[];
    visualStudy: VisualStudyType;
    customImageUrl?: string;
    audioDataUrl?: string;
    audioDurationSec?: number;
    audioTranscriptModel?: string;
    extractedEntities?: ExtractedEntities;
    isPinned: boolean;
  }) => void;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  onClose,
  existingMemories,
  aiConfig,
  onSave,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<EntryKind>('memory');
  const [domain, setDomain] = useState<EntryDomain>('Personal');
  const [emotion, setEmotion] = useState<MemoryEntry['emotion']>('Serene');
  const [createdAt, setCreatedAt] = useState(todayIso);
  const [location, setLocation] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visualStudy, setVisualStudy] = useState<VisualStudyType>('horizon');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);

  // Voice recording & Local Speech-to-Text (Faster-Whisper + On-Device STT) state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState<string>('');
  const [audioTranscriptModel, setAudioTranscriptModel] = useState<string>('');
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string | null>(null);
  const [isTranscribingWhisper, setIsTranscribingWhisper] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Cleanup recording on modal close
  useEffect(() => {
    if (!isOpen && isRecording) {
      stopVoiceRecording();
    }
  }, [isOpen]);

  // Existing unique tags in the archive for NLP resonance
  const existingArchiveTags = useMemo(() => {
    const set = new Set<string>();
    existingMemories.forEach((m) => m.tags.forEach((t) => set.add(t.toLowerCase())));
    return Array.from(set);
  }, [existingMemories]);

  // Currently entered tags parsed as a Set
  const currentTagsList = useMemo(() => {
    return tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }, [tagsInput]);

  // Natural Language Analysis helper: suggest tags from title + content
  const suggestedTags = useMemo(() => {
    return suggestTagsFromContent(content, title, domain, kind, existingArchiveTags);
  }, [content, title, domain, kind, existingArchiveTags]);

  // Stage 5 of aoyu Engine: extract People, Locations, Dates, and Themes
  const extractedEntities = useMemo(() => {
    return extractEntitiesFromContent(content, title, location);
  }, [content, title, location]);

  if (!isOpen) return null;

  const handleToggleSuggestedTag = (tag: string) => {
    const lowerTag = tag.toLowerCase().trim();
    if (currentTagsList.includes(lowerTag)) {
      const next = currentTagsList.filter((t) => t !== lowerTag);
      setTagsInput(next.join(', '));
    } else {
      const next = [...currentTagsList, lowerTag];
      setTagsInput(next.join(', '));
    }
  };

  const startVoiceRecording = async () => {
    setVoiceStatusMsg(null);
    audioChunksRef.current = [];

    // 1. Start Web Speech API (On-Device Browser Speech-to-Text) for live dictation
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

    let speechSupported = false;
    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let chunkText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              chunkText += event.results[i][0].transcript + ' ';
            }
          }
          const cleaned = chunkText.trim();
          if (cleaned) {
            setContent((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
            setTitle((prevTitle) => {
              if (prevTitle.trim()) return prevTitle;
              return cleaned.length > 52 ? `${cleaned.slice(0, 52)}…` : cleaned;
            });
          }
        };

        recognition.onerror = () => {
          // Continue MediaRecorder even if Web Speech has an issue
        };

        recognition.start();
        recognitionRef.current = recognition;
        speechSupported = true;
      } catch {
        // Ignore if already started
      }
    }

    // 2. Start MediaRecorder to capture raw audio locally on device & send to Faster-Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Store audio as base64 Data URL for local device persistence
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setAudioDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(audioBlob);

        // Stage 2 of aoyu Engine: Attempt local Faster-Whisper transcription
        setIsTranscribingWhisper(true);
        const whisperResult = await transcribeWithFasterWhisper(audioBlob, aiConfig);
        setIsTranscribingWhisper(false);

        if (whisperResult && whisperResult.text) {
          setContent((prev) => (prev ? `${prev}\n${whisperResult.text}` : whisperResult.text));
          setTitle((prevTitle) =>
            prevTitle.trim()
              ? prevTitle
              : whisperResult.text.slice(0, 52) + (whisperResult.text.length > 52 ? '…' : '')
          );
          setAudioTranscriptModel(whisperResult.modelUsed);
          setVoiceStatusMsg(
            `Transcribed via ${whisperResult.modelUsed} & saved audio to local device storage.`
          );
        } else {
          setAudioTranscriptModel('Faster-Whisper / Local On-Device STT');
          setVoiceStatusMsg(
            speechSupported
              ? 'Voice transcribed locally and audio recording saved on device.'
              : 'Voice recording saved locally on device. (Connect Faster-Whisper on localhost:8000 or use Chrome/Edge for live STT).'
          );
        }

        // Auto-add 'voice-note' tag suggestion
        setTagsInput((prev) => {
          const existing = prev
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
          if (!existing.includes('voice-note')) {
            return [...existing, 'voice-note'].join(', ');
          }
          return prev;
        });
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      setVoiceStatusMsg('Listening... Speak your memory or idea aloud.');
    } catch {
      if (speechSupported) {
        setIsRecording(true);
        setVoiceStatusMsg('Transcribing voice via on-device Speech-to-Text...');
      } else {
        setVoiceStatusMsg(
          'Microphone permission is required to record and transcribe voice locally.'
        );
      }
    }
  };

  const stopVoiceRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleConnection = (id: string) => {
    setSelectedConnectionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    if (isRecording) {
      stopVoiceRecording();
    }

    const cleanTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const finalTags =
      cleanTags.length > 0
        ? cleanTags
        : suggestedTags.length > 0
          ? suggestedTags.slice(0, 3)
          : [kind];

    const firstParagraph = content.trim().split('\n')[0];
    const generatedExcerpt =
      firstParagraph.length > 145 ? `${firstParagraph.slice(0, 145)}…` : firstParagraph;

    onSave({
      title: title.trim(),
      excerpt: generatedExcerpt,
      content: content.trim(),
      kind,
      domain,
      emotion,
      createdAt: createdAt || todayIso,
      location:
        location.trim() ||
        (extractedEntities.locations[0] ? extractedEntities.locations[0] : undefined),
      tags: finalTags,
      connectedIds: selectedConnectionIds,
      visualStudy,
      customImageUrl: customImageUrl.trim() || undefined,
      audioDataUrl: audioDataUrl || undefined,
      audioDurationSec: recordingSeconds > 0 ? recordingSeconds : undefined,
      audioTranscriptModel: audioTranscriptModel || undefined,
      extractedEntities,
      isPinned,
    });

    setTitle('');
    setContent('');
    setLocation('');
    setTagsInput('');
    setCustomImageUrl('');
    setAudioDataUrl('');
    setAudioTranscriptModel('');
    setRecordingSeconds(0);
    setVoiceStatusMsg(null);
    setSelectedConnectionIds([]);
    setIsPinned(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#74A57F]/25 dark:bg-zinc-950/75 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-modal-title"
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-7 space-y-5"
      >
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2
              id="capture-modal-title"
              className="font-display text-xl font-normal text-zinc-900 dark:text-zinc-100"
            >
              New Memory or Idea
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Processed locally by the <span className="font-mono text-[#74A57F]">aoyu Engine</span> pipeline (Voice STT, NLP Tag Suggestions &amp; Entity Extraction).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-[#74A57F] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry title..."
              className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Type
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as EntryKind)}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
              >
                <option value="memory">Memory</option>
                <option value="idea">Idea</option>
                <option value="epiphany">Epiphany</option>
                <option value="observation">Observation</option>
                <option value="fragment">Fragment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as EntryDomain)}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
              >
                <option value="Personal">Personal</option>
                <option value="Design">Design</option>
                <option value="Architecture">Architecture</option>
                <option value="Philosophy">Philosophy</option>
                <option value="Nature">Nature</option>
                <option value="Science">Science</option>
                <option value="Literature">Literature</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F] tabular-nums"
              />
            </div>
          </div>

          {/* Notes & Details + Local Microphone Voice Dictation (Faster-Whisper / Local STT) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Notes &amp; Details
              </label>

              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="px-3 py-1 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5"
                    title="Record your voice and transcribe locally using Faster-Whisper / On-Device STT"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dictate by Voice (Local STT)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span className="font-mono tabular-nums">
                      Stop Recording ({recordingSeconds}s)
                    </span>
                  </button>
                )}
              </div>
            </div>

            {(voiceStatusMsg || isTranscribingWhisper) && (
              <div className="px-3 py-2 bg-[#74A57F]/12 border border-[#74A57F]/30 rounded-lg text-xs font-mono text-[#456b4e] dark:text-[#98c9a3] flex items-center justify-between gap-2">
                <span>
                  {isTranscribingWhisper
                    ? 'aoyu Engine Stage 2: Transcribing audio with local Faster-Whisper...'
                    : voiceStatusMsg}
                </span>
              </div>
            )}

            {audioDataUrl && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-[#74A57F]">
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>Local Voice Recording Ready ({recordingSeconds || 1}s)</span>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <audio controls src={audioDataUrl} className="w-full h-8" />
                  <button
                    type="button"
                    onClick={() => {
                      setAudioDataUrl('');
                      setVoiceStatusMsg(null);
                    }}
                    title="Remove recorded voice clip"
                    className="p-1 text-zinc-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your memory or idea, or press 'Dictate by Voice' to transcribe with local Speech-to-Text..."
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F] leading-relaxed"
            />
          </div>

          {/* Natural Language Tag Suggestions as Selectable Chips */}
          <div className="p-3.5 bg-zinc-50/90 dark:bg-zinc-950/90 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <Sparkles className="w-3.5 h-3.5 text-[#B58ACE]" />
                <span>Suggested Tags (Natural Language Analysis)</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                Click chips to toggle
              </span>
            </div>

            {suggestedTags.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Start typing or dictating your entry above to see real-time NLP tag suggestions.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {suggestedTags.map((tag) => {
                  const isSelected = currentTagsList.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleSuggestedTag(tag)}
                      className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#74A57F] text-white border-[#74A57F]'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-[#B58ACE]/50 hover:border-[#74A57F] hover:text-[#74A57F]'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3 text-[#B58ACE]" />
                      )}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Extracted Entities Preview (Stage 5 of aoyu Engine) */}
            {(extractedEntities.people.length > 0 ||
              extractedEntities.locations.length > 0 ||
              extractedEntities.dates.length > 0) && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1 text-[#74A57F]">
                  <Cpu className="w-3 h-3" />
                  <span>aoyu Entities:</span>
                </span>
                {extractedEntities.people.length > 0 && (
                  <span>People: {extractedEntities.people.join(', ')}</span>
                )}
                {extractedEntities.locations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!location.trim() && extractedEntities.locations[0]) {
                        setLocation(extractedEntities.locations[0]);
                      }
                    }}
                    className="hover:text-[#74A57F] underline underline-offset-2"
                    title="Click to set Location field"
                  >
                    Location: {extractedEntities.locations.join(', ')}
                  </button>
                )}
                {extractedEntities.dates.length > 0 && (
                  <span>Dates: {extractedEntities.dates.join(', ')}</span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Location (Optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or place"
                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#74A57F]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="journal, project, note"
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Cover Motif
              </label>
              <select
                value={visualStudy}
                onChange={(e) => setVisualStudy(e.target.value as VisualStudyType)}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
              >
                <option value="horizon">Horizon Contours</option>
                <option value="pavilion">Architectural Lines</option>
                <option value="observatory">Light Oculus</option>
                <option value="ceramics">Vessel Form</option>
                <option value="botanical">Botanical Study</option>
                <option value="acoustics">Harmonic Geometry</option>
                <option value="typography">Modular Grid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tone
              </label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value as MemoryEntry['emotion'])}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#74A57F]"
              >
                <option value="Serene">Serene</option>
                <option value="Clarifying">Clarifying</option>
                <option value="Contemplative">Contemplative</option>
                <option value="Nostalgic">Nostalgic</option>
                <option value="Luminous">Luminous</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Photograph Attachment (Moondream Analysis — Coming Soon)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#74A57F]/15 file:text-[#456b4e] dark:file:text-[#98c9a3] hover:file:bg-[#74A57F]/25"
              />
            </div>
          </div>

          {existingMemories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Link to Existing Entries ({selectedConnectionIds.length} selected)
              </label>
              <div className="max-h-32 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800/70 bg-zinc-50/50 dark:bg-zinc-950/50">
                {existingMemories.map((item) => {
                  const isChecked = selectedConnectionIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleConnection(item.id)}
                          className="rounded border-zinc-300 accent-[#74A57F]"
                        />
                        <span className="font-mono text-zinc-400 shrink-0 tabular-nums">
                          {item.indexCode}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200 truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 shrink-0 tabular-nums">
                        {item.createdAt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded border-zinc-300 accent-[#74A57F]"
              />
              <span>Pin entry</span>
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors"
              >
                Save Entry Locally
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
