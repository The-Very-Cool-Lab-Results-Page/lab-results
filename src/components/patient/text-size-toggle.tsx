'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/ui/cn';

/**
 * A / A+ reading-size control for the patient page. Sets data-reading on <html>,
 * which globals.css uses to scale the root font size (rem-based type scales with
 * it). Persisted per device in localStorage. Patient pages are the only place
 * this mounts, so it never affects the provider side; it resets on unmount.
 */
const STORAGE_KEY = 'reading-size';
type Size = 'base' | 'lg';

function readInitial(): Size {
  if (typeof window === 'undefined') return 'base';
  return localStorage.getItem(STORAGE_KEY) === 'lg' ? 'lg' : 'base';
}

export function TextSizeToggle() {
  // Lazy initializer reads the client-only persisted value; the effect below only
  // syncs the DOM, so no setState runs inside an effect.
  const [size, setSize] = useState<Size>(readInitial);

  useEffect(() => {
    document.documentElement.dataset.reading = size;
    return () => {
      document.documentElement.dataset.reading = 'base';
    };
  }, [size]);

  function choose(next: Size) {
    setSize(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div
      suppressHydrationWarning
      className="inline-flex items-center overflow-hidden rounded-full border border-line"
      role="group"
      aria-label="Text size"
    >
      {(['base', 'lg'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={size === option}
          className={cn(
            'px-2.5 py-1 leading-none transition-colors',
            option === 'base' ? 'text-xs' : 'text-sm',
            size === option ? 'bg-forest text-cream' : 'text-muted hover:text-forest',
          )}
        >
          A{option === 'lg' && <span aria-hidden>+</span>}
          <span className="sr-only">{option === 'lg' ? 'Larger text' : 'Normal text'}</span>
        </button>
      ))}
    </div>
  );
}
