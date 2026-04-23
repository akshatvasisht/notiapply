'use client';

interface DetailHeaderProps {
  title: string;
  onBack: () => void;
  badge?: { label: string; color: string; bg: string };
}

export default function DetailHeader({ title, onBack, badge }: DetailHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      minHeight: 44, padding: '0 16px',
      background: 'var(--color-surface-container)', borderBottom: '1px solid var(--color-border)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--color-text-secondary)', padding: '8px 12px',
            display: 'flex', alignItems: 'center', minHeight: 44,
          }}
        >
          ‹ Back
        </button>
      </div>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'center' }}>
        {title}
      </span>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
          color: badge.color, background: badge.bg,
        }}>
          {badge.label}
        </span>
      )}
    </div>
  );
}
