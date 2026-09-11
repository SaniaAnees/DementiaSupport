import { create } from 'zustand';

type LockState = {
  patientLocked: boolean;
  lock: () => void;
  unlock: () => void;
};

export const usePatientLock = create<LockState>((set) => ({
  patientLocked: sessionStorage.getItem('ds_patient_lock') === '1',
  lock: () => {
    sessionStorage.setItem('ds_patient_lock', '1');
    set({ patientLocked: true });
  },
  unlock: () => {
    sessionStorage.removeItem('ds_patient_lock');
    set({ patientLocked: false });
  },
}));
