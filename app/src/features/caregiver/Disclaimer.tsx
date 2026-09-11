import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BrandMark, Button, Panel } from '../../shared/ui';
import { db } from '../../shared/db';

export function DisclaimerPage() {
  const nav = useNavigate();
  return (
    <div className="app-shell page-pad" style={{ display: 'grid', alignContent: 'center', minHeight: '100dvh' }}>
      <BrandMark />
      <div style={{ height: 28 }} />

      <motion.div
        className="hero-atmosphere"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 22, position: 'relative', zIndex: 1 }}
      >
        <p className="eyebrow" style={{ position: 'relative', zIndex: 1 }}>
          Cognitive care
        </p>
        <h1 className="display-title" style={{ position: 'relative', zIndex: 1, marginBottom: 12 }}>
          Care that stays
          <br />
          on this device
        </h1>
        <p className="lede" style={{ marginBottom: 0, position: 'relative', zIndex: 1 }}>
          Set up once. Run calm daily memory sessions offline. Track whether things look better, worse, or the same —
          without guessing.
        </p>
      </motion.div>

      <Panel style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 750, marginBottom: 8, letterSpacing: '-0.02em' }}>Before you continue</div>
        <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.55, fontSize: 15 }}>
          DementiaSupport is cognitive engagement and caregiver monitoring. It is <strong>not</strong> a medical device
          and does not diagnose or replace clinical care.
        </p>
      </Panel>

      <div className="list-stack" style={{ marginBottom: 22 }}>
        {[
          { t: 'No ads or social feed', c: 'var(--vital-glow)', ink: 'var(--vital-deep)' },
          { t: 'Patient mode locked with your PIN', c: 'var(--mind-glow)', ink: '#1d4ed8' },
          { t: 'Sessions work with airplane mode on', c: 'var(--energy-glow)', ink: '#92400e' },
        ].map((row, i) => (
          <motion.div
            key={row.t}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + i * 0.06 }}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '14px 16px',
              background: 'var(--sheet)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 650,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                background: row.c,
                color: row.ink,
                display: 'grid',
                placeItems: 'center',
                fontSize: 13,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            {row.t}
          </motion.div>
        ))}
      </div>

      <Button
        large
        onClick={async () => {
          await db.meta.put({ key: 'disclaimer_seen', value: '1' });
          nav('/onboarding/caregiver', { replace: true });
        }}
      >
        I understand — start setup
      </Button>
    </div>
  );
}
