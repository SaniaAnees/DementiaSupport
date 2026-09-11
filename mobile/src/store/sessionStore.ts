import { create } from 'zustand';
import type { BuiltSessionItem, SessionType } from '../types/models';

export type LiveResult = {
  itemId: string;
  isCorrect: boolean;
  responseMs: number;
  hintsUsed: number;
  repetitions: number;
  transcript: string;
};

type SessionStore = {
  patientId: string | null;
  sessionId: string | null;
  sessionType: SessionType | null;
  items: BuiltSessionItem[];
  stepIndex: number;
  results: LiveResult[];
  startedAt: string | null;
  setSession: (payload: {
    patientId: string;
    sessionId: string;
    sessionType: SessionType;
    items: BuiltSessionItem[];
    startedAt: string;
  }) => void;
  setStep: (index: number) => void;
  pushResult: (result: LiveResult) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  patientId: null,
  sessionId: null,
  sessionType: null,
  items: [],
  stepIndex: 0,
  results: [],
  startedAt: null,
  setSession: (payload) =>
    set({
      patientId: payload.patientId,
      sessionId: payload.sessionId,
      sessionType: payload.sessionType,
      items: payload.items,
      startedAt: payload.startedAt,
      stepIndex: 0,
      results: [],
    }),
  setStep: (index) => set({ stepIndex: index }),
  pushResult: (result) => set((s) => ({ results: [...s.results, result] })),
  reset: () =>
    set({
      patientId: null,
      sessionId: null,
      sessionType: null,
      items: [],
      stepIndex: 0,
      results: [],
      startedAt: null,
    }),
}));
