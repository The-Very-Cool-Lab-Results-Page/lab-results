import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import type { Tone } from '@/lib/ui/classification-display';

const TONE_STYLES: Record<Tone, string> = {
  in: 'bg-forest-soft text-forest',
  high: 'bg-amber-soft text-amber',
  low: 'bg-amber-soft text-amber',
  critical: 'bg-critical-soft text-critical',
  neutral: 'bg-line/70 text-ink',
};

// A glyph per tone so state reads at a glance, not by color alone (also helps
// color-blind users and anyone skimming). Drawn at 14px on currentColor, so each
// icon inherits its pill's text color. Paths are inside a shared <svg> wrapper.
const TONE_ICONS: Record<Tone, ReactNode> = {
  in: <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />,
  high: <path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />,
  low: <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />,
  critical: (
    <>
      <path d="M12 9v4" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <path
        d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        strokeLinejoin="round"
      />
    </>
  ),
  neutral: <path d="M6 12h12" strokeLinecap="round" />,
};

export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONE_STYLES[tone],
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        aria-hidden
        className="h-3.5 w-3.5 shrink-0"
      >
        {TONE_ICONS[tone]}
      </svg>
      {label}
    </span>
  );
}
