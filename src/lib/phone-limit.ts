// Phone sign-in daily limit (shared by server code and tests).
export const DAILY_CODE_LIMIT = 5;
/** Seconds a user must wait before asking for another code. */
export const RESEND_WAIT_SECONDS = 60;
const IST_OFFSET_MS = 5.5 * 3600_000;

/** Start of the current India (IST) calendar day, as an ISO timestamp. */
export function istDayStartIso(now = Date.now()) {
  const shifted = now + IST_OFFSET_MS;
  const dayStart = shifted - (shifted % 86_400_000);
  return new Date(dayStart - IST_OFFSET_MS).toISOString();
}
