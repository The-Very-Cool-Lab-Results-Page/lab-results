'use client';

import { useActionState } from 'react';
import { signInAction, type FormState } from '@/app/provider/actions';
import { APP_NAME } from '@/lib/clinic';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';

const initialState: FormState = {};

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest text-cream"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
                strokeLinejoin="round"
              />
              <path d="M13 4v4h4M9.5 13.5h5M12 11v5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-base text-ink">{APP_NAME}</span>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
          <h1 className="font-display text-2xl text-ink">Provider sign in</h1>
          <p className="mt-1 text-sm text-muted">Sign in to review and approve patient results.</p>

          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue="dr.anderson@demo.clinic"
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue="demo-password-2026"
            />
            {state.error && (
              <p role="alert" className="text-sm text-critical">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="mt-1 w-full justify-center">
              {pending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Demo account, pre-filled. Synthetic data only, no real patient information.
        </p>
      </div>
    </main>
  );
}
