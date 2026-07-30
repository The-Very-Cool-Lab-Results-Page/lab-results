import { StatusPill } from '@/components/ui/status-pill';
import type { Tone } from '@/lib/ui/classification-display';

/**
 * The rows the patient will see that the explanation text does not cover — implausible,
 * not covered, unreadable. Drafting is only given `range` rows (src/lib/draft/build-input.ts),
 * so without this the provider approves text describing a subset while the patient page
 * renders the rest below it. The approval gate (FR-10) should show everything that reaches
 * the patient. Status labels only: the wording for these rows is rendered by the patient
 * page from its classification, never drafted or edited here.
 */

export interface UnexplainedRow {
  id: string;
  displayName: string;
  value: string;
  unit?: string;
  statusLabel: string;
  tone: Tone;
}

export function UnexplainedRowsNote({ rows }: { rows: UnexplainedRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper p-5">
      <h3 className="font-medium text-ink">Also on the patient&apos;s page</h3>
      <p className="mt-1 max-w-prose text-sm text-muted">
        {rows.length === 1 ? 'This result is' : 'These results are'} not part of the explanation
        above. The patient sees {rows.length === 1 ? 'it' : 'them'} with the status below and no
        explanation.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-ink">{row.displayName}</span>
            <span className="text-sm text-muted">
              {row.value}
              {row.unit ? ` ${row.unit}` : ''}
            </span>
            <StatusPill tone={row.tone} label={row.statusLabel} />
          </li>
        ))}
      </ul>
    </div>
  );
}
