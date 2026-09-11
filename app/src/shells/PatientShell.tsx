import type { ReactNode } from 'react';

/**
 * Patient chrome — dark, calm, no dense nav. Edit atmosphere in tokens + .patient-shell CSS.
 */
export function PatientShell({ children }: { children: ReactNode }) {
  return (
    <div className="patient-shell" data-persona="patient">
      {children}
    </div>
  );
}
