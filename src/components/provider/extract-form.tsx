'use client';

import { useActionState } from 'react';
import { extractReportAction, type FormState } from '@/app/provider/actions';
import { SubmitButton } from '@/components/ui/submit-button';

const initialState: FormState = {};

/**
 * The read-the-report step. A rejected file or a failed transcription comes back
 * as an inline message on this form: the report stays at this step with nothing
 * saved, so the provider can attach a different file and try again.
 */
export function ExtractForm({ reportId }: { reportId: string }) {
  const [state, formAction] = useActionState(extractReportAction, initialState);

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="reportId" value={reportId} />
      <label className="block text-sm text-muted">
        Report PDF <span className="text-muted/70">(optional in v1)</span>
        <input
          type="file"
          name="pdf"
          accept="application/pdf"
          className="mt-1 block text-sm text-ink"
        />
      </label>
      <p className="mt-1 max-w-prose text-xs text-muted">
        With a PDF and an API key configured, the report is transcribed live. Otherwise a synthetic
        sample is used so the flow can be walked without credentials.
      </p>
      {state.error && (
        <p role="alert" className="mt-3 max-w-prose text-sm text-critical">
          {state.error}
        </p>
      )}
      <div className="mt-4">
        <SubmitButton pendingLabel="Reading...">Read the results</SubmitButton>
      </div>
    </form>
  );
}
