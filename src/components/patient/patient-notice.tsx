import type { ReactNode } from 'react';
import { CLINIC } from '@/lib/clinic';

type Tone = 'calm' | 'alert';

const ICON: Record<Tone, ReactNode> = {
  // A clock: the link was real and simply timed out.
  calm: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // A broken-link glyph: nothing to open here.
  alert: (
    <>
      <path
        d="M9.5 14.5 8 16a3.5 3.5 0 0 1-5-5l2.5-2.5M14.5 9.5 16 8a3.5 3.5 0 0 0-5-5L9.5 4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m5 5 14 14" strokeLinecap="round" />
    </>
  ),
};

/**
 * The shared "we can't show you results right now" card for the patient route's
 * dead-end states (expired, not-found, error). One layout so the three read as the
 * same product; each caller supplies its own heading and explanation. Every state
 * ends on the same next step: call the clinic, which owns the real link.
 */
export function PatientNotice({
  tone,
  heading,
  children,
}: {
  tone: Tone;
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-[var(--radius-card)] border border-line bg-paper px-6 py-12 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-cream text-muted"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="h-7 w-7"
        >
          {ICON[tone]}
        </svg>
      </span>
      <h1 className="mt-5 font-display text-2xl text-ink">{heading}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
      <p className="mt-6 rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink">
        Call {CLINIC.name} at{' '}
        <a href={`tel:${CLINIC.phone.replace(/[^\d+]/g, '')}`} className="whitespace-nowrap">
          {CLINIC.phone}
        </a>
      </p>
    </div>
  );
}
