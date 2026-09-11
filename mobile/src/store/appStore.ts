import { create } from 'zustand';
import type { SyncUiStatus } from '../sync/syncService';

type AppStore = {
  ready: boolean;
  syncStatus: SyncUiStatus;
  activePatientId: string | null;
  setReady: (v: boolean) => void;
  setSyncStatus: (s: SyncUiStatus) => void;
  setActivePatientId: (id: string | null) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  ready: false,
  syncStatus: 'local_only',
  activePatientId: null,
  setReady: (ready) => set({ ready }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setActivePatientId: (activePatientId) => set({ activePatientId }),
}));
