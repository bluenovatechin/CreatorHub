import 'dotenv/config';
import { z } from 'zod';

const base64Key = z.string().refine((k) => Buffer.from(k, 'base64').length === 32, 'must be 32 bytes, base64');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  MONGODB_URI: z.string().min(1).refine((u) => /^mongodb(\+srv)?:\/\//.test(u), 'must be a mongodb URI'),
  CORS_ORIGINS: z.string().min(1).transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  COOKIE_SECURE: z.enum(['true', 'false']).transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional().transform((v) => (v ? v : undefined)),
  JWT_ACCESS_SECRET: z.string().min(40, 'must be at least 40 random characters'), // ≥256 bits for HS256
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().default(900),
  REFRESH_TTL_USER_DAYS: z.coerce.number().int().default(30),
  REFRESH_TTL_ADMIN_HOURS: z.coerce.number().int().default(12),
  OTP_PEPPER: z.string().optional(), // no longer used (phone OTP login was removed)
  // Either one key (DATA_ENCRYPTION_KEY, base64 of 32 bytes — what Render's "generate value" produces)
  // or several versioned keys for rotation (DATA_ENCRYPTION_KEYS as JSON).
  DATA_ENCRYPTION_KEY: base64Key.optional(),
  DATA_ENCRYPTION_KEYS: z.string().optional().transform((s, ctx) => {
    if (!s) return undefined;
    try {
      return z.record(base64Key).parse(JSON.parse(s));
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be JSON like {"v1":"<base64 32 bytes>"}' });
      return z.NEVER;
    }
  }),
  DATA_ENCRYPTION_ACTIVE_VERSION: z.string().default('v1'),
  APP_BASE_URL: z.string().url().default('http://localhost:5180'),
  ADMIN_BASE_URL: z.string().url().default('http://localhost:5181'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend', 'brevo']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  // "Continue with Google": OAuth client ID from Google Cloud Console (public value). Leave empty to hide the button.
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => (v ? v : undefined)),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional().transform((v) => v?.replace(/\s+/g, '')), // Gmail shows app passwords with spaces
  EMAIL_FROM: z.string().default('Bluenova Creator Hub <no-reply@bluenovatech.in>'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  // Number of proxies in front of the API (Render = 1; Vercel rewrite + Render = 2). Needed for correct visitor IPs.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  // TESTING ONLY: lets the live site run without an email service. New accounts are verified automatically,
  // email links are written to the server log, and the website shows a "test version" banner.
  TEST_MODE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

function load() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Never print the values themselves: they are secrets.
    throw new Error(`Invalid environment configuration:\n${issues}\nSee apps/api/.env.example`);
  }
  const parsed = result.data;
  const keys = parsed.DATA_ENCRYPTION_KEYS ?? (parsed.DATA_ENCRYPTION_KEY ? { v1: parsed.DATA_ENCRYPTION_KEY } : undefined);
  if (!keys) throw new Error('Set DATA_ENCRYPTION_KEY (or DATA_ENCRYPTION_KEYS). See apps/api/.env.example');
  const env = { ...parsed, DATA_ENCRYPTION_KEYS: keys };
  if (!env.DATA_ENCRYPTION_KEYS[env.DATA_ENCRYPTION_ACTIVE_VERSION]) {
    throw new Error('DATA_ENCRYPTION_ACTIVE_VERSION must exist in DATA_ENCRYPTION_KEYS');
  }
  if (env.EMAIL_PROVIDER === 'smtp' && (!env.SMTP_USER || !env.SMTP_PASS)) {
    throw new Error('EMAIL_PROVIDER=smtp needs SMTP_USER and SMTP_PASS');
  }
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.EMAIL_PROVIDER === 'console' && !env.TEST_MODE) problems.push('EMAIL_PROVIDER=console is only allowed in production when TEST_MODE=true');
    if (!env.APP_BASE_URL.startsWith('https://') || !env.ADMIN_BASE_URL.startsWith('https://')) problems.push('APP_BASE_URL and ADMIN_BASE_URL must be https');
    if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
    if (env.CORS_ORIGINS.some((o) => o === '*' || o.includes('localhost'))) problems.push('CORS_ORIGINS must not contain * or localhost');
    if (env.CORS_ORIGINS.some((o) => !o.startsWith('https://'))) problems.push('CORS_ORIGINS must be https in production');
    if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) problems.push('RESEND_API_KEY missing');
    if (env.EMAIL_PROVIDER === 'brevo' && !env.BREVO_API_KEY) problems.push('BREVO_API_KEY missing');
    if (problems.length) throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
    if (env.TEST_MODE) {
      // eslint-disable-next-line no-console
      console.warn('WARNING: TEST_MODE is on: accounts are auto-verified and email links go to the server log. Turn it off before real users join.');
    }
  }
  return env;
}

export const env = load();
export type Env = typeof env;
