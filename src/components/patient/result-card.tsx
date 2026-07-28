import { cn } from '@/lib/ui/cn';
import type { ResultItem } from '@/lib/ui/results-view';
import { CLINIC } from '@/lib/clinic';
import { RangeMarker } from '@/components/ui/range-marker';
import { StatusPill } from '@/components/ui/status-pill';

/**
 * One test on the patient results page. In the team model a critical result
 * holds the whole report (never sent), so a critical card should not normally
 * appear here; it is handled defensively just in case.
 */
function typicalRangeText(low: number | null, high: number | null): string {
  if (low !== null && high !== null) return `${low} to ${high}`;
  if (high !== null) return `under ${high}`;
  if (low !== null) return `${low} or higher`;
  return '';
}

export function ResultCard({ item, index = 0 }: { item: ResultItem; index?: number }) {
  const isCritical = item.classification.kind === 'range' && item.classification.critical;
  const canDrawMarker = item.display.showMarker && item.numericValue !== null;
  const rangeText = canDrawMarker ? typicalRangeText(item.low, item.high) : '';
  // Staggered entrance, capped so a long report does not crawl in. The class is
  // inert under prefers-reduced-motion (globals.css) and settles before print.
  const animationDelay = `${Math.min(index * 60, 360)}ms`;

  return (
    <article
      style={{ animationDelay }}
      className={cn(
        'animate-fade-rise print-avoid-break rounded-[var(--radius-card)] border bg-paper p-5',
        isCritical ? 'border-critical/40 ring-1 ring-critical/20' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-medium text-ink">{item.displayName}</h3>
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="font-display text-2xl text-ink">{item.value}</span>
          {item.unit && <span className="text-xs text-muted">{item.unit}</span>}
        </div>
      </div>

      <div className="mt-2">
        <StatusPill tone={item.display.tone} label={item.display.label} />
      </div>

      {canDrawMarker && item.numericValue !== null && (
        <>
          <div aria-hidden>
            <RangeMarker
              value={item.numericValue}
              low={item.low ?? undefined}
              high={item.high ?? undefined}
              tone={item.display.tone}
            />
          </div>
          {rangeText && <p className="sr-only">Typical range: {rangeText}.</p>}
        </>
      )}

      {isCritical && (
        <p className="mt-4 rounded-lg bg-critical-soft px-4 py-3 text-sm text-critical">
          Your care team is contacting you directly about this result. If you have not heard from
          them, call {CLINIC.name} at {CLINIC.phone}.
        </p>
      )}

      {!isCritical && item.meaning && (
        <p className="mt-4 text-sm leading-relaxed text-ink/80">{item.meaning}</p>
      )}

      {item.classification.kind === 'implausible' && (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This value looks unusual and will be double-checked with your provider before it is read.
        </p>
      )}
      {item.classification.kind === 'not-covered' && (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          We do not have a plain-language explanation for this test yet. Your provider can walk you
          through it.
        </p>
      )}
      {item.classification.kind === 'unclassifiable' && (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This line could not be read clearly from the report and will be rechecked.
        </p>
      )}

      {!isCritical && item.medlineplusUrl && (
        <a
          href={item.medlineplusUrl}
          target="_blank"
          rel="noreferrer"
          className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest underline underline-offset-2"
        >
          Learn more at MedlinePlus
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </article>
  );
}
