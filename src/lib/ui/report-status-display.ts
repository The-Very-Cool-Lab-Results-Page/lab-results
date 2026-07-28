import type { ReportStatus } from '@/lib/types';
import type { Tone } from './classification-display';

/** Provider-facing label and tone for a report's workflow status. */
export function reportStatusDisplay(status: ReportStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'uploaded':
      return { label: 'Uploaded', tone: 'neutral' };
    case 'extracted':
      return { label: 'Ready to verify', tone: 'neutral' };
    case 'verified':
      return { label: 'Verified', tone: 'neutral' };
    case 'held':
      return { label: 'Held: critical result', tone: 'critical' };
    case 'drafted':
      return { label: 'Draft ready to review', tone: 'high' };
    case 'approved':
      return { label: 'Approved', tone: 'in' };
    case 'sent':
      return { label: 'Sent to patient', tone: 'in' };
  }
}

/**
 * The provider's next action on a report, for the dashboard worklist. `urgency`
 * orders the list so what needs attention floats up: a held critical result is
 * most urgent, then a draft to approve, then reports mid-pipeline, then an
 * approved report waiting to send. A sent report needs nothing, so it returns
 * null and sinks to the bottom.
 */
export function reportAction(status: ReportStatus): { verb: string; urgency: number } | null {
  switch (status) {
    case 'held':
      return { verb: 'Contact patient', urgency: 0 };
    case 'drafted':
      return { verb: 'Review draft', urgency: 1 };
    case 'extracted':
      return { verb: 'Verify results', urgency: 2 };
    case 'verified':
      return { verb: 'Continue', urgency: 2 };
    case 'uploaded':
      return { verb: 'Read the report', urgency: 3 };
    case 'approved':
      return { verb: 'Send to patient', urgency: 4 };
    case 'sent':
      return null;
  }
}

export const PROVIDER_STEPS = ['Upload', 'Verify', 'Review draft', 'Approve', 'Send'];

export function stepIndexForStatus(status: ReportStatus): number {
  switch (status) {
    case 'uploaded':
    case 'extracted':
      return 1;
    case 'verified':
    case 'held':
    case 'drafted':
      return 2;
    case 'approved':
      return 3;
    case 'sent':
      return 4;
  }
}
