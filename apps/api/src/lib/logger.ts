import pino from 'pino';
import { env } from '../config/env';

/** Paths that must never reach the logs. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.otp', '*.code', '*.pan', '*.account', '*.vpa', '*.password', '*.token',
  '*.accessToken', '*.refreshToken', '*.mfaToken', '*.phone', '*.totpSecret',
];

export const logger = pino({
  // Development terminal stays quiet: only warnings and errors (plus the OTP box and the ready message).
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'warn' : 'info'),
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,req,res,responseTime' } } }
    : {}),
});
