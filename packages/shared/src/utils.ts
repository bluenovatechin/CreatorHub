/**
 * SMALL HELPERS: follower band from follower count, safe redirect paths, India-time dates, hiding contact details in text.
 */
import type { FollowerBand } from './enums';

export function followerBand(followers: number): FollowerBand {
  if (followers >= 1_000_000) return 'MEGA';
  if (followers >= 500_000) return 'MACRO';
  if (followers >= 100_000) return 'MID';
  if (followers >= 10_000) return 'MICRO';
  return 'NANO';
}

/**
 * Only allow same-app relative redirects. Blocks open redirects such as
 * "//evil.com", "/\\evil.com" and "https://evil.com".
 */
export function safeRedirect(next: string | null | undefined, fallback: string): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex -- matching control characters is the point: they are rejected
  if (/[\u0000-\u001F\u007F]/.test(next)) return fallback;
  if (/^\/[^/]*:/.test(next)) return fallback;
  return next;
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

export function istDateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00+05:30`);
}

/** Replace contact details in free text (used for chat and notes shared between brand and creator). */
export function maskContactDetails(text: string): { text: string; masked: boolean } {
  const replacement = '[hidden by Bluenova]';
  const patterns = [
    /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
    /\b[\w.-]{2,256}@[a-zA-Z]{2,64}\b/g, // UPI id
    /(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b/g, // Indian mobile
    /(^|\s)@[A-Za-z0-9._]{2,30}\b/g, // @handles
  ];
  let out = text;
  for (const p of patterns) out = out.replace(p, (m) => (m.startsWith(' ') ? ` ${replacement}` : replacement));
  return { text: out, masked: out !== text };
}
