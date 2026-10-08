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
  JWT_ACCESS_SECRET: z.string().min(64),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().default(900),
  REFRESH_TTL_USER_DAYS: z.coerce.number().int().default(30),
  REFRESH_TTL_ADMIN_HOURS: z.coerce.number().int().default(12),
  OTP_PEPPER: z.string().min(32),
  DATA_ENCRYPTION_KEYS: z.string().transform((s, ctx) => {
    try {
      const parsed = z.record(base64Key).parse(JSON.parse(s));
      return parsed;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be JSON like {"v1":"<base64 32 bytes>"}' });
      return z.NEVER;
    }
  }),
  DATA_ENCRYPTION_ACTIVE_VERSION: z.string().default('v1'),
  APP_BASE_URL: z.string().url().default('http://localhost:5180'),
  ADMIN_BASE_URL: z.string().url().default('http://localhost:5181'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional().transform((v) => v?.replace(/\s+/g, '')), // Gmail shows app passwords with spaces
  EMAIL_FROM: z.string().default('Bluenova Creator Hub <no-reply@bluenovatech.in>'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

function load() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Never print the values themselves: they are secrets.
    throw new Error(`Invalid environment configuration:\n${issues}\nSee apps/api/.env.example`);
  }
  const env = result.data;
  if (!env.DATA_ENCRYPTION_KEYS[env.DATA_ENCRYPTION_ACTIVE_VERSION]) {
    throw new Error('DATA_ENCRYPTION_ACTIVE_VERSION must exist in DATA_ENCRYPTION_KEYS');
  }
  if (env.EMAIL_PROVIDER === 'smtp' && (!env.SMTP_USER || !env.SMTP_PASS)) {
    throw new Error('EMAIL_PROVIDER=smtp needs SMTP_USER and SMTP_PASS in apps/api/.env');
  }
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.EMAIL_PROVIDER === 'console') problems.push('EMAIL_PROVIDER=console is not allowed in production');
    if (!env.APP_BASE_URL.startsWith('https://') || !env.ADMIN_BASE_URL.startsWith('https://')) problems.push('APP_BASE_URL and ADMIN_BASE_URL must be https');
    if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
    if (env.CORS_ORIGINS.some((o) => o === '*' || o.includes('localhost'))) problems.push('CORS_ORIGINS must not contain * or localhost');
    if (env.CORS_ORIGINS.some((o) => !o.startsWith('https://'))) problems.push('CORS_ORIGINS must be https in production');
    if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) problems.push('RESEND_API_KEY missing');
    if (problems.length) throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  }
  return env;
}

export const env = load();
export type Env = typeof env;
