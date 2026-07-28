'use client';

import { useState } from 'react';
import { confirmVerificationAction } from '@/app/provider/actions';
import { previewClassification } from '@/lib/ui/preview-classification';
import { classificationDisplay } from '@/lib/ui/classification-display';
import { cn } from '@/lib/ui/cn';
import { SubmitButton } from '@/components/ui/submit-button';
import { StatusPill } from '@/components/ui/status-pill';
import { PendingNote } from './pending-note';

export interface EditableRow {
  id: string;
  rawName: string;
  analyteId?: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  rawRange: string;
  labFlags: string[];
  lowConfidenceFields: string[];
}

// Grid template shared by the header and every row on desktop, so columns line
// up. On mobile the grid collapses to one column and each field labels itself.
const GRID = 'md:grid md:grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_0.8fr_1.2fr_auto] md:items-center md:gap-3';

const inputBase =
  'w-full rounded border bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-forest/30';

function toNumber(text: string): number | undefined {
  const value = Number(text.replace(/,/g, ''));
  return text.trim() === '' || !Number.isFinite(value) ? undefined : value;
}

function newRow(): EditableRow {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    rawName: '',
    value: '',
    unit: '',
    refLow: '',
    refHigh: '',
    rawRange: '',
    labFlags: [],
    lowConfidenceFields: [],
  };
}

const COLUMNS = ['Test', 'Value', 'Unit', 'Ref low', 'Ref high', 'Will show as'];

export function VerifyTable({ reportId, rows }: { reportId: string; rows: EditableRow[] }) {
  const [editable, setEditable] = useState<EditableRow[]>(rows);

  const update = (index: number, field: keyof EditableRow, value: string) => {
    setEditable((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };
  const remove = (index: number) => setEditable((current) => current.filter((_, i) => i !== index));
  const add = () => setEditable((current) => [...current, newRow()]);
  const reset = () => setEditable(rows.map((row) => ({ ...row })));

  const anyLowConfidence = editable.some((row) => row.lowConfidenceFields.length > 0);

  return (
    <form action={confirmVerificationAction} className="mt-6">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="rows" value={JSON.stringify(editable)} />

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
        {/* Sticky column header, desktop only; on mobile each field self-labels. */}
        <div
          className={cn(
            GRID,
            'sticky top-0 z-10 hidden border-b border-line bg-paper px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted md:block',
          )}
        >
          {COLUMNS.map((column) => (
            <span key={column}>{column}</span>
          ))}
          <span className="sr-only">Remove</span>
        </div>

        <div className="flex flex-col gap-3 p-3 md:gap-0 md:p-0">
          {editable.map((row, index) => {
            const preview = classificationDisplay(
              previewClassification({
                rawName: row.rawName,
                value: row.value,
                unit: row.unit,
                refLow: toNumber(row.refLow),
                refHigh: toNumber(row.refHigh),
                labFlags: row.labFlags,
              }),
            );
            const lowConf = (field: string) => row.lowConfidenceFields.includes(field);
            const cell = (field: string) =>
              cn(inputBase, lowConf(field) ? 'border-amber ring-1 ring-amber/40' : 'border-line');

            // One field: a mobile-only label above the input; desktop uses the header row.
            const field = (label: string, name: keyof EditableRow, ariaLabel: string) => (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted md:hidden">{label}</span>
                <input
                  className={cell(name)}
                  value={row[name] as string}
                  aria-label={ariaLabel}
                  onChange={(e) => update(index, name, e.target.value)}
                />
              </label>
            );

            return (
              <div
                key={row.id}
                className={cn(
                  GRID,
                  'gap-3 rounded-lg border border-line p-3',
                  'md:gap-3 md:rounded-none md:border-0 md:border-b md:border-line/60 md:p-4 md:last:border-0',
                )}
              >
                {field('Test', 'rawName', 'Test name')}
                {field('Value', 'value', 'Value')}
                {field('Unit', 'unit', 'Unit')}
                {field('Ref low', 'refLow', 'Reference low')}
                {field('Ref high', 'refHigh', 'Reference high')}
                <div className="flex items-center justify-between gap-2 md:block">
                  <span className="text-xs font-medium text-muted md:hidden">Will show as</span>
                  {row.rawName.trim() !== '' && (
                    <StatusPill tone={preview.tone} label={preview.label} />
                  )}
                </div>
                <div className="flex justify-end md:block">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-xs text-muted transition-colors hover:text-critical"
                    aria-label={`Remove ${row.rawName || 'row'}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 text-sm font-medium text-forest hover:underline"
      >
        Add a row
      </button>

      {anyLowConfidence && (
        <p className="mt-3 text-xs text-amber">
          Amber fields were read with low confidence. Check them against the report before you
          confirm.
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <SubmitButton pendingLabel="Confirming...">Confirm results</SubmitButton>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-muted transition-colors hover:text-forest"
        >
          Reset changes
        </button>
      </div>
      <PendingNote>
        Classifying each value and drafting the explanation from MedlinePlus. This runs a live model
        call and takes a few seconds.
      </PendingNote>
    </form>
  );
}
