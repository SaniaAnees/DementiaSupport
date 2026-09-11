import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { HYBRID } from './architecture';
import { db } from './shared/db';
import { getOnboardingStep } from './shared/onboarding';
import { CaregiverShell } from './shells/CaregiverShell';
import { PatientShell } from './shells/PatientShell';
import { CaregiverHome } from './features/caregiver/Home';
import { NewPatient, EditPatient } from './features/caregiver/PatientEditor';
import { DisclaimerPage } from './features/caregiver/Disclaimer';
import { SettingsPage } from './features/caregiver/Settings';
import { MemoriesPage } from './features/memories/MemoriesPage';
import { ProgressPage } from './features/insights/ProgressPage';
import { SessionStart } from './features/patient-session/SessionStart';
import { SessionPlay } from './features/patient-session/SessionPlay';
import { SessionSummary } from './features/patient-session/SessionSummary';
import { PatientModeHome } from './features/patient-mode/PatientModeHome';
import { CaregiverOnboarding } from './features/onboarding/CaregiverOnboarding';
import { FamilyHome } from './features/family/FamilyHome';
import { usePatientLock } from './features/patient-mode/lockStore';

function RootRedirect() {
  const nav = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const step = await getOnboardingStep();
      if (step === 'disclaimer') nav('/disclaimer', { replace: true });
      else if (step === 'caregiver') nav('/onboarding/caregiver', { replace: true });
      else if (step === 'patient') nav('/patient/new', { replace: true });
      else if (step === 'memories') {
        const patient = await db.patients.toCollection().first();
        if (patient) nav(`/patient/${patient.id}/memories?setup=1`, { replace: true });
        else nav('/patient/new', { replace: true });
      } else setDone(true);
    })();
  }, [nav]);

  if (!done) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Loading…</div>
      </div>
    );
  }
  return (
    <CaregiverShell>
      <CaregiverHome />
    </CaregiverShell>
  );
}

function LockGuard({ children }: { children: ReactNode }) {
  const locked = usePatientLock((s) => s.patientLocked);
  const loc = useLocation();
  const patientPaths = ['/patient-mode', '/session'];
  const onPatientSurface = patientPaths.some((p) => loc.pathname.startsWith(p));
  if (locked && !onPatientSurface) {
    return <Navigate to="/patient-mode" replace />;
  }
  return <>{children}</>;
}

function WithCaregiver({ children }: { children: ReactNode }) {
  return <CaregiverShell>{children}</CaregiverShell>;
}

function WithPatient({ children }: { children: ReactNode }) {
  return <PatientShell>{children}</PatientShell>;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void HYBRID; // keep architecture module referenced for tooling
    db.open().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>DementiaSupport</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <LockGuard>
        <Routes>
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/onboarding/caregiver" element={<CaregiverOnboarding />} />
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/patient/new"
            element={
              <WithCaregiver>
                <NewPatient />
              </WithCaregiver>
            }
          />
          <Route
            path="/patient/:id/edit"
            element={
              <WithCaregiver>
                <EditPatient />
              </WithCaregiver>
            }
          />
          <Route
            path="/patient/:id/memories"
            element={
              <WithCaregiver>
                <MemoriesPage />
              </WithCaregiver>
            }
          />
          <Route
            path="/progress"
            element={
              <WithCaregiver>
                <ProgressPage />
              </WithCaregiver>
            }
          />
          <Route
            path="/settings"
            element={
              <WithCaregiver>
                <SettingsPage />
              </WithCaregiver>
            }
          />
          <Route path="/family" element={<FamilyHome />} />
          <Route
            path="/patient-mode"
            element={
              <WithPatient>
                <PatientModeHome />
              </WithPatient>
            }
          />
          <Route
            path="/session/start"
            element={
              <WithPatient>
                <SessionStart />
              </WithPatient>
            }
          />
          <Route
            path="/session/play"
            element={
              <WithPatient>
                <SessionPlay />
              </WithPatient>
            }
          />
          <Route
            path="/session/summary"
            element={
              <WithPatient>
                <SessionSummary />
              </WithPatient>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LockGuard>
    </BrowserRouter>
  );
}
