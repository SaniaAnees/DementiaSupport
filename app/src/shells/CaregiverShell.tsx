import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PERSONA_NAV } from '../architecture';

/**
 * Caregiver chrome — edit nav labels/layout here; pages stay feature-local.
 */
export function CaregiverShell({ children, showNav = true }: { children: ReactNode; showNav?: boolean }) {
  const loc = useLocation();
  const setupMemories =
    loc.pathname.includes('/memories') && new URLSearchParams(loc.search).get('setup') === '1';
  const hideOn =
    loc.pathname.startsWith('/onboarding') ||
    loc.pathname === '/disclaimer' ||
    loc.pathname.startsWith('/session') ||
    loc.pathname === '/patient-mode' ||
    setupMemories;

  const navVisible = showNav && !hideOn;

  return (
    <div className="app-shell" data-persona="caregiver">
      {children}
      {navVisible ? (
        <nav className="persona-tabbar" aria-label="Caregiver">
          {PERSONA_NAV.caregiver.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `persona-tab${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
