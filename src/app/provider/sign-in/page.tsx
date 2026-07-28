'use client';

import { useActionState } from 'react';
import { signInAction, type FormState } from '@/app/provider/actions';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';

const initialState: FormState = {};

const PRINCIPLES = [
  'AI transcribes the report and never invents a value.',
  'Deterministic code, not the model, decides what needs attention.',
  'You approve every word before a patient can read it.',
];

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <main className="min-h-screen md:grid md:grid-cols-2">
      {/* Brand panel: sets the tone and states the safety model. Desktop only;
          on mobile the sign-in card carries a compact brand line instead. */}
      <aside className="hidden flex-col justify-between bg-forest px-10 py-12 text-cream md:flex">
        <p className="text-xs font-semibold uppercase tracking-widest text-cream/90">
          Lab Result Explainer
        </p>
        <div className="max-w-sm">
          <h2 className="font-display text-3xl leading-tight">
            Lab results, explained in plain language.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-cream/90">
            Education for patients, never medical advice. Two human gates stand between an uploaded
            report and anything a patient reads.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {PRINCIPLES.map((principle) => (
              <li key={principle} className="flex gap-3 text-sm text-cream/90">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.25}
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-cream/70"
                >
                  <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {principle}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-cream/90">Synthetic data only. No real patient information.</p>
      </aside>

      <div className="flex min-h-screen flex-col justify-center px-6 py-16 md:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-forest md:hidden">
              Lab Result Explainer
            </p>
            <h1 className="mt-3 font-display text-2xl text-ink md:mt-0">Provider sign in</h1>
            <p className="mt-2 text-sm text-muted">
              One demo account in this version. All data is synthetic.
            </p>
          </div>

          <form action={formAction} className="mt-8 flex flex-col gap-4">
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
            <Button type="submit" disabled={pending}>
              {pending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            Demo credentials are pre-filled for the walkthrough.
          </p>
        </div>
      </div>
    </main>
  );
}
