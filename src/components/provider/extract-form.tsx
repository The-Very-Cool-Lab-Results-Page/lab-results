'use client';

import { useActionState } from 'react';
import { extractReportAction, type FormState } from '@/app/provider/actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { PdfFileInput } from './pdf-file-input';
import { PendingNote } from './pending-note';

const initialState: FormState = {};

/**
 * The read-the-report step. A rejected file or a failed transcription comes back
 * as an inline message on this form: the report stays at this step with nothing
 * saved, so the provider can attach a different file and try again.
 */
export function ExtractForm({ reportId }: { reportId: string }) {
  const [state, formAction] = useActionState(extractReportAction, initialState);

  return (
    <form action={formAction} className="mt-6 max-w-xl">
      <input type="hidden" name="reportId" value={reportId} />
      <p className="mb-2 text-sm font-medium text-ink">
        Report PDF <span className="font-normal text-muted">(optional in v1)</span>
      </p>
      <PdfFileInput name="pdf" />
      <p className="mt-2 max-w-prose text-xs text-muted">
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
      <PendingNote>
        Transcribing the report line by line. With a PDF this is a live model call and takes a few
        seconds.
      </PendingNote>
    </form>
  );
}
