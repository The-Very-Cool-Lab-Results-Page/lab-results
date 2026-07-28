import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireProvider } from '@/lib/auth/session';
import { signOutAction } from '@/app/provider/actions';
import { APP_NAME, CLINIC } from '@/lib/clinic';
import { SidebarNav } from '@/components/provider/sidebar-nav';

/** Gates every authenticated provider page and provides the workspace shell. */
export default async function ProviderAppLayout({ children }: { children: ReactNode }) {
  await requireProvider();

  return (
    <div className="flex min-h-screen bg-cream">
      <a
        href="#provider-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded focus:bg-forest focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </a>

      {/* Sidebar spine: brand, navigation, account. Desktop only. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-paper md:sticky md:top-0 md:flex md:h-screen">
        <div className="border-b border-line px-5 py-5">
          <Link href="/provider" className="block">
            <span className="font-display text-lg leading-tight text-ink">{APP_NAME}</span>
            <span className="mt-0.5 block text-xs text-muted">Provider workspace</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-xs font-semibold text-forest">
              DA
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {CLINIC.providerName}
              </span>
              <span className="block truncate text-xs text-muted">{CLINIC.name}</span>
            </span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-line/40 hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (the sidebar is hidden on small screens). */}
        <header className="flex items-center justify-between border-b border-line bg-paper px-4 py-4 md:hidden">
          <Link href="/provider" className="font-display text-lg text-ink">
            {APP_NAME}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-muted transition-colors hover:text-forest"
            >
              Sign out
            </button>
          </form>
        </header>

        <main id="provider-main" className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-10 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
