/**
 * DISPLAY HELPERS: category/city names in the current language, dates in Indian format (IST),
 * and the colour for each status pill.
 */
import { CATEGORIES, CITIES, catalogLabel, formatINR } from '@bluenova/shared';
import type { Tone } from '@bluenova/ui';

export { formatINR };

export const categoryLabel = (key: string, lang: string) => catalogLabel(CATEGORIES, key, lang === 'gu' ? 'gu' : 'en');
export const cityLabel = (key: string, lang: string) => catalogLabel(CITIES, key, lang === 'gu' ? 'gu' : 'en');
/** Cities for the search pickers: shown in the current language, also found by typing the other language's name. */
export const cityOptions = (lang: string) =>
  CITIES.map((c) => (lang === 'gu' ? { value: c.key, label: c.gu, alt: c.en } : { value: c.key, label: c.en, alt: c.gu }));

export function formatDate(value: string | Date | null | undefined, lang: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'gu' ? 'gu-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    .format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined, lang: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'gu' ? 'gu-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    .format(new Date(value));
}

/** Status → badge colour (spec §25.3). */
export function statusTone(status: string): Tone {
  if (['DRAFT', 'INCOMPLETE'].includes(status)) return 'grey';
  if (['SUBMITTED', 'UNDER_REVIEW', 'IN_REVIEW', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'LIVE_SUBMITTED', 'CREATORS_SELECTED'].includes(status)) return 'blue';
  if (['CHANGES_REQUESTED', 'REVISION_REQUESTED', 'AWAITING_PAYMENT', 'PAYMENT_PENDING', 'SENT', 'SHORTLIST_SENT', 'COUNTERED'].includes(status)) return 'amber';
  if (['IN_PRODUCTION', 'ACTIVE'].includes(status)) return 'teal';
  if (['APPROVED', 'VERIFIED', 'COMPLETED', 'ACCEPTED'].includes(status)) return 'green';
  return 'red';
}

/** "Riya, Surat" style lists from text areas. */
export const lines = (s: string | undefined) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
export const words = (s: string | undefined) => (s ?? '').split(/\s+/).map((x) => x.trim()).filter(Boolean);
