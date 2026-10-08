/**
 * Real-world checks that catch false or made-up information, beyond simple formats.
 * Used by the browser (instant feedback) and the server (enforcement).
 */

const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** GSTIN check digit (15th character) per the official mod-36 algorithm. */
export function isValidGstinChecksum(gstin: string): boolean {
  const g = gstin.toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GST_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] === g[14];
}

/**
 * India Post PIN zones (first digit) per GST state code.
 * Catches PIN codes that can't belong to the chosen state.
 */
const PIN_ZONES: Record<string, string[]> = {
  '01': ['1'], '02': ['1'], '03': ['1'], '04': ['1'], '05': ['2'], '06': ['1'], '07': ['1'], '08': ['3'],
  '09': ['2'], '10': ['8'], '11': ['7'], '12': ['7'], '13': ['7'], '14': ['7'], '15': ['7'], '16': ['7'],
  '17': ['7'], '18': ['7'], '19': ['7'], '20': ['8'], '21': ['7'], '22': ['4'], '23': ['4'], '24': ['3'],
  '26': ['3'], '27': ['4'], '29': ['5'], '30': ['4'], '31': ['6'], '32': ['6'], '33': ['6'], '34': ['5', '6'],
  '35': ['7'], '36': ['5'], '37': ['5'], '38': ['1'],
};

export function pincodeMatchesState(pincode: string, stateCode: string): boolean {
  if (!/^[1-9]\d{5}$/.test(pincode)) return false;
  if (stateCode === '24') return /^3[6-9]/.test(pincode); // Gujarat: 36xxxx–39xxxx
  const zones = PIN_ZONES[stateCode];
  return !zones || zones.includes(pincode[0]);
}

/** Indian mobile number that isn't an obvious dummy (9999999999, 9876543210 …). */
export function isPlausibleMobile(tenDigits: string): boolean {
  if (!/^[6-9]\d{9}$/.test(tenDigits)) return false;
  if (/^(\d)\1{9}$/.test(tenDigits)) return false;
  if (['9876543210', '9123456789', '6789012345', '7890123456', '8901234567'].includes(tenDigits)) return false;
  if (/(\d)\1{6,}/.test(tenDigits)) return false; // 7+ identical digits in a row
  return true;
}

const FAKE_NAMES = new Set([
  'test', 'testing', 'tester', 'asdf', 'asd', 'qwerty', 'abc', 'abcd', 'xyz', 'null', 'none', 'na', 'n/a',
  'admin', 'demo', 'fake', 'dummy', 'user', 'name', 'first last', 'john doe', 'jane doe', 'aaa', 'xxx',
]);

/** Rejects placeholder names like "test", "asdf", "aaaa". */
export function isPlausibleName(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (FAKE_NAMES.has(n)) return false;
  const letters = n.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  if (/^(.)\1+$/u.test(letters)) return false; // "aaaa"
  if (/(.)\1{3,}/u.test(n)) return false; // 4+ identical characters in a row
  return true;
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'tempmail.com',
  'temp-mail.org', 'tempmail.net', 'yopmail.com', 'trashmail.com', 'getnada.com', 'nada.email', 'dispostable.com',
  'throwawaymail.com', 'maildrop.cc', 'fakeinbox.com', 'moakt.com', 'emailondeck.com', 'mintemail.com', 'mohmal.com',
  'tempail.com', 'burnermail.io', 'mailnesia.com', 'mytemp.email', 'spamgourmet.com', 'tempr.email', 'discard.email',
  'mail.tm', 'emailfake.com', 'fakemail.net', 'byom.de', 'inboxkitten.com', 'mailpoof.com', 'tmpmail.org',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return DISPOSABLE_DOMAINS.has(domain);
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'admin123', 'welcome1', 'welcome123', 'abc12345', 'abcd1234', 'letmein1', 'india123', 'india@123',
  'pass@123', 'password@123', 'bluenova', 'bluenova1', 'bluenova123', 'creator123', 'brand1234',
]);

/** Returns an i18n error key, or null when the password is acceptable. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < 8) return 'errors.passwordShort';
  if (password.length > 128) return 'errors.tooLong';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'errors.passwordMix';
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'errors.passwordCommon';
  const local = context.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'errors.passwordPersonal';
  const first = context.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) return 'errors.passwordPersonal';
  if (/^(.)\1+$/.test(password)) return 'errors.passwordCommon';
  return null;
}

/** 0–4 score for the strength meter (display only; the rules above are what's enforced). */
export function passwordScore(password: string): number {
  if (!password) return 0;
  let s = 0;
  if (password.length >= 8) s++;
  if (password.length >= 12) s++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
  return Math.min(4, s);
}

/** Bank/UPI transaction reference formats used in India. */
export const PAYMENT_REFERENCE_RULES: Record<string, RegExp> = {
  UPI: /^\d{12}$/, // UPI transaction ID (RRN): 12 digits
  IMPS: /^\d{12}$/, // IMPS RRN: 12 digits
  NEFT: /^[A-Z0-9]{16}$/, // NEFT UTR: 16 characters
  RTGS: /^[A-Z0-9]{22}$/, // RTGS UTR: 22 characters
  CHEQUE: /^\d{6}$/, // cheque number
};
