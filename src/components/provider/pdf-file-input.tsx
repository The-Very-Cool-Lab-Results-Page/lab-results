'use client';

import { useRef, useState, type DragEvent } from 'react';

/**
 * A styled PDF picker for the extract step. Wraps a hidden file input so the
 * enclosing form still posts `pdf` to extractReportAction unchanged, but the
 * provider sees a real drop target and the chosen filename instead of the
 * browser's bare "Choose File" control. Client-side only: it reflects the
 * selection, it does not read or upload the bytes itself.
 */
export function PdfFileInput({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files;
    if (dropped.length > 0 && inputRef.current) {
      inputRef.current.files = dropped;
      setFileName(dropped[0].name);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose a report PDF"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer items-center gap-4 rounded-[var(--radius-card)] border border-dashed px-4 py-4 text-left transition-colors ${
        dragging ? 'border-forest bg-forest-soft/50' : 'border-line bg-paper hover:border-forest/60'
      }`}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-forest"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          className="h-5 w-5"
        >
          <path d="M12 16V5m0 0L8 9m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">
          {fileName ?? 'Choose a PDF or drag one here'}
        </span>
        <span className="block truncate text-xs text-muted">
          {fileName ? 'Click to replace' : 'PDF up to 15 MB, or skip to use a synthetic sample'}
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="application/pdf"
        aria-label="Report PDF"
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}
