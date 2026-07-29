import type { ToneCounts } from '@/lib/ui/results-view';
import { StatusPill } from '@/components/ui/status-pill';

/** The summary box at the top of the results page: a count plus the overall text. */
export function OverallPictureBox({
  inRangeCount,
  totalCount,
  overallText,
  toneCounts,
}: {
  inRangeCount: number;
  totalCount: number;
  overallText: string;
  toneCounts: ToneCounts;
}) {
  // Everything that isn't a plain in-range result: a little outside, flagged to
  // double-check, or not covered yet. Grouped as one neutral share on the bar.
  const neutralCount = toneCounts.flagged + toneCounts.notCovered;
  const segments = [
    { key: 'inRange', value: toneCounts.inRange, className: 'bg-forest' },
    { key: 'outside', value: toneCounts.outside, className: 'bg-amber' },
    { key: 'neutral', value: neutralCount, className: 'bg-line' },
  ];
  // A report with no results at all satisfies "nothing outside the range"
  // vacuously; affirming every result is typical when there are none would be
  // false reassurance, so require at least one in-range result to say it.
  const allInRange =
    toneCounts.inRange > 0 &&
    toneCounts.outside === 0 &&
    neutralCount === 0 &&
    toneCounts.critical === 0;

  return (
    <section className="rounded-[var(--radius-card)] border border-forest/20 bg-forest-soft/50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-paper text-center">
          <span className="font-display text-lg leading-none text-forest">
            {inRangeCount}/{totalCount}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
            in range
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-ink">The overall picture</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/80">{overallText}</p>

          {totalCount > 0 && (
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              {segments.map(({ key, value, className }) =>
                value > 0 ? (
                  <div
                    key={key}
                    className={className}
                    style={{ width: `${(value / totalCount) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {allInRange ? (
              <StatusPill tone="in" label="Every result in the typical range" />
            ) : (
              <>
                <StatusPill tone="in" label="In typical range" />
                <StatusPill tone="high" label="A little outside" />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
