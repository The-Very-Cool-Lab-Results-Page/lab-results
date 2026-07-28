'use client';

import { useEffect } from 'react';

/**
 * Scrolls to the top whenever `trigger` changes. The report workflow advances in
 * place (read, verify, draft, approve, send all revalidate the same URL rather
 * than navigating), so the browser keeps the old scroll position and drops the
 * provider halfway down the next section. Keying this on report.status scrolls
 * back to the top on each transition, the way a real page navigation would.
 */
export function ScrollReset({ trigger }: { trigger: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [trigger]);
  return null;
}
