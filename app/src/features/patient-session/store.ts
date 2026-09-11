import { create } from 'zustand';
import type { BuiltSessionItem, LangCode, SessionType } from '../../shared/types';

export type LiveResult = {
  itemId: string;
  memoryId?: string;
  outcome: 'correct' | 'wrong' | 'skipped';
  responseMs: number;
  hintsUsed: number;
  repetitions: number;
  transcript: string;
};

type SessionState = {
  patientId: string | null;
  sessionId: string | null;
  sessionType: SessionType | null;
  languageCode: LangCode;
  items: BuiltSessionItem[];
  step: number;
  results: LiveResult[];
  maxMinutes: number;
  pauseBeforeHintMs: number;
  startedAtMs: number;
  setSession: (p: {
    patientId: string;
    sessionId: string;
    sessionType: SessionType;
    languageCode: LangCode;
    items: BuiltSessionItem[];
    maxMinutes: number;
    pauseBeforeHintMs: number;
  }) => void;
  next: () => void;
  pushResult: (r: LiveResult) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  patientId: null,
  sessionId: null,
  sessionType: null,
  languageCode: 'en',
  items: [],
  step: 0,
  results: [],
  maxMinutes: 10,
  pauseBeforeHintMs: 5000,
  startedAtMs: 0,
  setSession: (p) =>
    set({
      patientId: p.patientId,
      sessionId: p.sessionId,
      sessionType: p.sessionType,
      languageCode: p.languageCode,
      items: p.items,
      maxMinutes: p.maxMinutes,
      pauseBeforeHintMs: p.pauseBeforeHintMs,
      step: 0,
      results: [],
      startedAtMs: Date.now(),
    }),
  next: () => set((s) => ({ step: s.step + 1 })),
  pushResult: (r) => set((s) => ({ results: [...s.results, r] })),
  reset: () =>
    set({
      patientId: null,
      sessionId: null,
      sessionType: null,
      languageCode: 'en',
      items: [],
      step: 0,
      results: [],
      startedAtMs: 0,
    }),
}));
