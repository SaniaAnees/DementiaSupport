import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PERSONA_NAV } from '../architecture';

/**
 * Family members — simpler chrome than caregiver (view progress, share memories).
 * Edit tab labels in architecture.ts PERSONA_NAV.family.
 */
export function FamilyShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell" data-persona="family">
      {children}
      <nav className="persona-tabbar" aria-label="Family">
        {PERSONA_NAV.family.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.to === '/family'}
            className={({ isActive }) => `persona-tab${isActive ? ' is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
