import type { ReactNode } from 'react';
import { CLINIC } from '@/lib/clinic';
import { Disclaimer } from '@/components/ui/disclaimer';
import { TextSizeToggle } from '@/components/patient/text-size-toggle';

/**
 * Shared chrome for every patient view. The disclaimer lives here so no patient
 * page can render without it (FR-12).
 */
export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#patient-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-forest focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to results
      </a>
      <header className="no-print border-b border-line bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-4 text-sm sm:px-6">
          <span className="whitespace-nowrap">
            <span className="font-display text-lg text-ink">{CLINIC.name}</span>
            <span className="hidden text-muted sm:inline"> · Lab results</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden whitespace-nowrap text-muted sm:inline">
              Shared by {CLINIC.providerName}
            </span>
            <TextSizeToggle />
          </span>
        </div>
      </header>
      <main
        id="patient-main"
        className="reading-scope mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6"
      >
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center sm:px-6">
          <Disclaimer />
        </div>
      </footer>
    </div>
  );
}
