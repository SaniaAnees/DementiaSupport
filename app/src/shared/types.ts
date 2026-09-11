export type SyncStatus = 'pending' | 'synced' | 'error';
export type LangCode = 'en' | 'hi' | 'bn' | 'as';
export type MemoryCategory = 'person' | 'place' | 'object';
export type RelationChip =
  | 'daughter'
  | 'son'
  | 'spouse'
  | 'home'
  | 'temple'
  | 'neighbour'
  | 'custom';
export type SessionType = 'morning' | 'evening';
export type ItemType = 'memory_teach' | 'memory_quiz' | 'orientation';
export type AnswerOutcome = 'correct' | 'wrong' | 'skipped';
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed';

export const LANG_LABELS: Record<LangCode, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  as: 'Assamese',
};

export const RELATION_CHIPS: RelationChip[] = [
  'daughter',
  'son',
  'spouse',
  'home',
  'temple',
  'neighbour',
  'custom',
];

export interface Caregiver {
  id: string;
  name: string;
  pinHash: string; // simple hash for MVP PIN
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Patient {
  id: string;
  caregiverId: string;
  fullName: string;
  preferredName?: string;
  age?: number;
  hometown?: string;
  languageCode: LangCode;
  dementiaNotes?: string;
  medicalRecommendations?: string;
  morningHour: number;
  morningMinute: number;
  eveningHour: number;
  eveningMinute: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Memory {
  id: string;
  patientId: string;
  localUri: string;
  thumbnailUri?: string;
  caption: string;
  shortLabel: string;
  relation: RelationChip;
  aliases: string[];
  category: MemoryCategory;
  voiceLabelUri?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Session {
  id: string;
  patientId: string;
  sessionType: SessionType;
  status: SessionStatus;
  scheduledFor: string; // ISO date of intended day + type
  startedAt?: string;
  endedAt?: string;
  accuracy?: number;
  avgResponseMs?: number;
  hintsUsed: number;
  repetitions: number;
  compositeScore?: number;
  hintRate?: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface SessionItem {
  id: string;
  sessionId: string;
  itemType: ItemType;
  memoryId?: string;
  promptText: string;
  expectedAnswers: string[];
  sortOrder: number;
  localUri?: string;
  caption?: string;
  hintText?: string;
  chipOptions?: string[];
  spokenPrompt?: string;
}

export interface AnswerLog {
  id: string;
  sessionId: string;
  sessionItemId: string;
  patientId: string;
  sessionType: SessionType;
  memoryId?: string;
  outcome: AnswerOutcome;
  responseMs: number;
  repetitions: number;
  hintsUsed: number;
  transcript?: string;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface CaregiverAlert {
  id: string;
  patientId: string;
  severity: 'info' | 'watch' | 'attention';
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

export interface SoftConstraints {
  shorterSessions: boolean;
  moreHints: boolean;
  avoidTopics: string[];
  maxMinutes: number;
  warmupCount: number;
  quizCount: number;
  pauseBeforeHintMs: number;
}

export type BuiltSessionItem = SessionItem;
