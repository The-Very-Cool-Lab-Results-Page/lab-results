import type { Explanation, Report } from '@/lib/types';
import type { ResultsView } from '@/lib/ui/results-view';
import { CLINIC } from '@/lib/clinic';
import { OverallPictureBox } from './overall-picture-box';
import { ResultCard } from './result-card';
import { AtAGlance } from './at-a-glance';
import { Glossary } from './glossary';
import { NextSteps } from './next-steps';
import { PrintButton } from './print-button';
import { CtaBand } from '@/components/ui/cta-band';

export function ResultsPage({
  report,
  explanation,
  view,
  token,
}: {
  report: Report;
  explanation: Explanation;
  view: ResultsView;
  token: string;
}) {
  const firstName = report.patient.name.split(' ')[0];
  const collected = new Date(report.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="hidden print:block">
        <p className="font-display text-lg text-ink">{CLINIC.name}</p>
        <p className="text-sm text-muted">
          {report.patient.name} · collected {collected}
        </p>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
            {firstName}, here are your results, explained simply.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Blood work collected {collected} at {CLINIC.name}.
          </p>
        </div>
        <PrintButton />
      </header>

      <OverallPictureBox
        inRangeCount={view.inRangeCount}
        totalCount={view.totalCount}
        overallText={explanation.overallText}
        toneCounts={view.toneCounts}
      />

      <AtAGlance counts={view.toneCounts} />

      <section>
        <h2 className="mb-3 font-display text-2xl text-ink">Your results</h2>
        <div className="flex flex-col gap-4">
          {view.items.map((item, index) => (
            <ResultCard key={item.key} item={item} index={index} />
          ))}
        </div>
      </section>

      <Glossary classifications={view.items.map((item) => item.classification)} />

      {explanation.sources.length > 0 && (
        <section className="border-t border-line pt-6 text-center">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Sources</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {explanation.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-forest underline underline-offset-2"
                >
                  {source.title}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                    className="h-3 w-3"
                  >
                    <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NextSteps />

      <div className="no-print">
        <CtaBand
          title="Questions about these results?"
          subtitle={`${CLINIC.providerName} usually replies within one business day.`}
          actionLabel={`Message ${CLINIC.providerName}`}
          actionHref={`/r/${token}/ask`}
        />
      </div>
    </div>
  );
}
