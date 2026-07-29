'use server';

import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'node:crypto';
import { getReport, getShareLinkByToken, markShareLinkOpened } from '@/lib/data';
import {
  clearDobAttempts,
  DOB_HELP_AFTER_ATTEMPTS,
  isDobConfirmed,
  recordFailedDobAttempt,
  setDobConfirmed,
} from '@/lib/auth/dob-gate';
import { sendQuestion } from '@/lib/email';

export interface DobState {
  error?: string;
  /** After a few misses, offer the clinic's number alongside the refusal. */
  showClinicHelp?: boolean;
}

export interface AskState {
  error?: string;
  sent?: boolean;
}

function datesMatch(entered: string, stored: string): boolean {
  const a = Buffer.from(entered);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

function lastNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
}

export async function confirmDobAction(_prev: DobState, formData: FormData): Promise<DobState> {
  const token = String(formData.get('token') ?? '');
  const lastName = String(formData.get('lastName') ?? '')
    .trim()
    .toLowerCase();
  const month = String(formData.get('month') ?? '').padStart(2, '0');
  const day = String(formData.get('day') ?? '').padStart(2, '0');
  const year = String(formData.get('year') ?? '').padStart(4, '0');
  const iso = `${year}-${month}-${day}`;
  if (lastName.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { error: 'Enter your last name and date of birth.' };
  }

  const link = await getShareLinkByToken(token);
  const report = link ? await getReport(link.reportId) : null;
  if (link === null || report === null) {
    return { error: 'This link is no longer valid.' };
  }

  // Both factors checked; a single generic error avoids revealing which was wrong.
  // The entered and stored last name and date of birth are never logged.
  const dobOk = datesMatch(iso, report.patient.dob);
  const lastNameOk = lastName === lastNameOf(report.patient.name);
  if (!dobOk || !lastNameOk) {
    // Tries stay unlimited; after a few the form adds the clinic's number rather
    // than repeating an error that reads as broken. Counting stores no values.
    const attempts = await recordFailedDobAttempt(token);
    return {
      error: 'That information did not match. Please check your last name and date of birth.',
      showClinicHelp: attempts >= DOB_HELP_AFTER_ATTEMPTS,
    };
  }

  await setDobConfirmed(token);
  await clearDobAttempts(token);
  // Record the first successful open (FR-11). Best-effort: this is an audit timestamp,
  // so a failure here must never block a patient who already passed the two-factor gate.
  try {
    await markShareLinkOpened(token);
  } catch {
    // Swallowed on purpose; never log the token (safety rule 5).
  }
  redirect(`/r/${token}`);
}

export async function askQuestionAction(_prev: AskState, formData: FormData): Promise<AskState> {
  const token = String(formData.get('token') ?? '');
  if (!(await isDobConfirmed(token))) {
    redirect(`/r/${token}`);
  }
  const question = String(formData.get('question') ?? '').trim();
  if (question.length === 0) {
    return { error: 'Write your question first.' };
  }
  // Notify the office. Offline this records the event only; the question text is not
  // persisted or logged (safety rule 5) — notify-only delivery is the real-PHI design.
  await sendQuestion();
  return { sent: true };
}
