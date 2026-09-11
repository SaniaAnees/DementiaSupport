import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: light
            ? 'linear-gradient(145deg, #2ee6c5 0%, #00a88e 100%)'
            : 'linear-gradient(145deg, #12c4a8 0%, #007a68 100%)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: light ? '0 8px 24px rgba(46,230,197,0.25)' : '0 10px 28px rgba(0,122,104,0.28)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="1.6" opacity="0.35" />
          <path
            d="M12 7.2v9.6M8.2 12h7.6"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 650,
            fontSize: 20,
            letterSpacing: '-0.03em',
            color: light ? 'var(--patient-ink)' : 'var(--ink)',
            lineHeight: 1.05,
          }}
        >
          DementiaSupport
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: light ? 'var(--patient-mute)' : 'var(--ink-3)',
            marginTop: 3,
          }}
        >
          Daily memory care
        </div>
      </div>
    </div>
  );
}

/** Oura / WHOOP-style score ring */
export function ScoreRing({
  value,
  label,
  size = 120,
  color = 'var(--vital)',
  track = 'rgba(12,18,34,0.08)',
  ink = 'var(--ink)',
  mute = 'var(--ink-3)',
}: {
  value: number; // 0-100
  label: string;
  size?: number;
  color?: string;
  track?: string;
  ink?: string;
  mute?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = c - (clamped / 100) * c;
  return (
    <div style={{ width: size, textAlign: 'center' }}>
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: size * 0.26,
            fontWeight: 650,
            fill: ink,
          }}
        >
          {Number.isFinite(clamped) ? Math.round(clamped) : '—'}
        </text>
        <text
          x="50%"
          y="66%"
          textAnchor="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: mute, letterSpacing: '0.06em' }}
        >
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  right,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  right?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="display-title" style={{ marginBottom: lede ? 12 : 0 }}>
            {title}
          </h1>
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Panel({
  children,
  style,
  flush,
}: {
  children: ReactNode;
  style?: CSSProperties;
  flush?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'var(--sheet)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: flush ? 0 : 20,
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </motion.section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'health' | 'warn' | 'danger' | 'mind';
}) {
  const tones = {
    default: { bg: 'var(--fill)', color: 'var(--ink)', chip: 'var(--ink-3)' },
    health: { bg: 'var(--vital-glow)', color: 'var(--vital-deep)', chip: 'var(--vital-deep)' },
    mind: { bg: 'var(--mind-glow)', color: '#1d4ed8', chip: '#1d4ed8' },
    warn: { bg: 'var(--energy-glow)', color: '#92400e', chip: '#92400e' },
    danger: { bg: 'var(--alert-glow)', color: 'var(--alert)', chip: 'var(--alert)' },
  }[tone];
  return (
    <div
      style={{
        background: tones.bg,
        borderRadius: 'var(--r-md)',
        padding: '16px 15px 14px',
        minHeight: 104,
        border: '1px solid rgba(255,255,255,0.65)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: '0.08em', textTransform: 'uppercase', color: tones.chip, marginBottom: 10 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 650,
          letterSpacing: '-0.04em',
          color: tones.color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {hint ? <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 10, fontWeight: 500 }}>{hint}</div> : null}
    </div>
  );
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  tone,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'ok';
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '16px 16px',
        background: 'var(--sheet)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        color: 'inherit',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {leading}
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background:
              tone === 'danger' ? 'var(--alert)' : tone === 'ok' ? 'var(--vital)' : 'var(--line-2)',
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>{title}</div>
          {subtitle ? (
            <div
              style={{
                fontSize: 13,
                color:
                  tone === 'danger' ? 'var(--alert)' : tone === 'ok' ? 'var(--vital-deep)' : 'var(--ink-2)',
                marginTop: 3,
                fontWeight: tone ? 650 : 500,
                textTransform: tone ? 'capitalize' : undefined,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {trailing ??
        (onClick ? (
          <span style={{ color: 'var(--ink-3)', fontSize: 22, lineHeight: 1, fontWeight: 300 }}>›</span>
        ) : null)}
    </Comp>
  );
}

export function Button({
  children,
  variant = 'primary',
  large,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'patient';
  large?: boolean;
}) {
  const styles: Record<string, CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg, #121a2b 0%, #0c1222 100%)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 10px 28px rgba(12,18,34,0.22)',
    },
    secondary: {
      background: 'var(--sheet)',
      color: 'var(--ink)',
      border: '1px solid var(--line-2)',
      boxShadow: 'var(--shadow-sm)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)',
      border: 'none',
      boxShadow: 'none',
    },
    patient: {
      background: 'linear-gradient(180deg, #3af0cf 0%, #2ee6c5 100%)',
      color: '#04261f',
      border: 'none',
      boxShadow: '0 12px 32px rgba(46,230,197,0.28)',
    },
  };

  return (
    <button
      {...props}
      style={{
        width: '100%',
        minHeight: large ? 60 : 52,
        borderRadius: 18,
        padding: large ? '16px 20px' : '13px 18px',
        fontWeight: 750,
        fontSize: large ? 16 : 15,
        letterSpacing: '-0.02em',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.42 : 1,
        ...styles[variant],
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  as = 'input',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    as?: 'input' | 'textarea';
  }) {
  const shared = {
    ...props,
    style: {
      width: '100%',
      borderRadius: 14,
      border: '1.5px solid var(--line-2)',
      padding: '14px 14px',
      background: 'var(--fill)',
      color: 'var(--ink)',
      outline: 'none',
      minHeight: as === 'textarea' ? 100 : 50,
      fontWeight: 500,
      ...(props.style as object),
    },
  };
  return (
    <label style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</span>
      {as === 'textarea' ? <textarea {...shared} /> : <input {...shared} />}
    </label>
  );
}

export function StatusPill({ label }: { label: string }) {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px',
        borderRadius: 999,
        background: online ? 'var(--vital-glow)' : 'var(--energy-glow)',
        color: online ? 'var(--vital-deep)' : '#92400e',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: online ? 'var(--vital)' : 'var(--energy)',
        }}
      />
      {label}
    </span>
  );
}

export function BackLink({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--mind)',
        fontWeight: 750,
        padding: 0,
        marginBottom: 18,
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      ← {label}
    </button>
  );
}
