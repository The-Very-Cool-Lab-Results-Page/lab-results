'use client';

import { useFormStatus } from 'react-dom';

/**
 * Reassuring in-progress text shown only while the enclosing form is submitting.
 * The extract and draft steps are live model calls that take several seconds; a
 * bare spinner reads as a hang, so this names what is happening. Must render
 * inside the same <form> as its SubmitButton (useFormStatus reads that form).
 */
export function PendingNote({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
      <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-forest" />
      {children}
    </p>
  );
}
