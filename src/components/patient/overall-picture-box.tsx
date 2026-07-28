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
  // Bar proportions only; the labeled breakdown lives in AtAGlance just below,
  // which keeps the FR-04 (not covered) vs FR-08 (double-check) split honest.
  const segments = [
    { key: 'inRange', value: toneCounts.inRange, bar: 'bg-forest' },
    { key: 'outside', value: toneCounts.outside, bar: 'bg-amber' },
    { key: 'neutral', value: neutralCount, bar: 'bg-line' },
  ];
  const allInRange = toneCounts.outside === 0 && neutralCount === 0 && toneCounts.critical === 0;
  const pct = totalCount > 0 ? Math.round((inRangeCount / totalCount) * 100) : 0;

  return (
    <section className="rounded-[var(--radius-card)] border border-forest/20 bg-forest-soft/50 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <ScoreRing count={inRangeCount} total={totalCount} pct={pct} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-ink">The overall picture</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/80">{overallText}</p>

          {totalCount > 0 && (
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
              {segments.map(({ key, value, bar }) =>
                value > 0 ? (
                  <div
                    key={key}
                    className={bar}
                    style={{ width: `${(value / totalCount) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
          )}

          {allInRange && (
            <div className="mt-4">
              <StatusPill tone="in" label="Every result in the typical range" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** The score ring: an SVG donut whose fill tracks the share of in-range results. */
function ScoreRing({ count, total, pct }: { count: number; total: number; pct: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="var(--color-forest)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-lg leading-none text-forest">
          {count}/{total}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
          in range
        </span>
      </div>
    </div>
  );
}
