/**
 * How long a patient share link stays valid after it is sent (SPEC FR-11).
 * A patient who opens the email late can always be issued a fresh link with
 * re-send, so this favors a shorter privacy window over a long-lived link to
 * health-shaped data. Both data drivers derive their expiry from this one value.
 */
export const SHARE_LINK_TTL_DAYS = 30;
export const SHARE_LINK_TTL_MS = SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Whether a share link's expiry timestamp is in the past. */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}
