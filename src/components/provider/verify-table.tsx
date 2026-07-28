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

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-3 font-medium">Test</th>
              <th className="px-3 py-3 font-medium">Value</th>
              <th className="px-3 py-3 font-medium">Unit</th>
              <th className="px-3 py-3 font-medium">Ref low</th>
              <th className="px-3 py-3 font-medium">Ref high</th>
              <th className="px-3 py-3 font-medium">Will show as</th>
              <th className="px-3 py-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
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
              return (
                <tr key={row.id} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2">
                    <input
                      className={cell('rawName')}
                      value={row.rawName}
                      aria-label="Test name"
                      onChange={(e) => update(index, 'rawName', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={cell('value')}
                      value={row.value}
                      aria-label="Value"
                      onChange={(e) => update(index, 'value', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={cell('unit')}
                      value={row.unit}
                      aria-label="Unit"
                      onChange={(e) => update(index, 'unit', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={cell('refLow')}
                      value={row.refLow}
                      aria-label="Reference low"
                      onChange={(e) => update(index, 'refLow', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={cell('refHigh')}
                      value={row.refHigh}
                      aria-label="Reference high"
                      onChange={(e) => update(index, 'refHigh', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {row.rawName.trim() !== '' && (
                      <StatusPill tone={preview.tone} label={preview.label} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-xs text-muted hover:text-critical"
                      aria-label={`Remove ${row.rawName || 'row'}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
