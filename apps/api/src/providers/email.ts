/**
 * SENDING EMAIL. EMAIL_PROVIDER in .env picks how:
 *   console  print to the terminal (development, tests)      smtp   Gmail via Nodemailer (works locally)
 *   brevo    Brevo HTTPS API (works on Render's free plan)   resend Resend HTTPS API
 * Use sendInBackground(emails.xxx(...)) from routes so a slow mail server never slows a request.
 * Notification emails (offers, reviews, messages…) don't come here directly: they go through the email outbox
 * (jobs/emailOutbox.ts), which records delivery and retries temporary failures.
 * Email texts (templates) are at the bottom of this file.
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Main link in the email, shown in the development terminal. */
  link?: string;
  /** One-time code shown large in the email (and in the development terminal). */
  code?: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<void>;
}

/**
 * A provider said no. `transient` = worth trying again later (rate limit, provider outage);
 * false = it will never work as is (bad address, unverified sender, wrong key).
 */
export class EmailSendError extends Error {
  constructor(message: string, readonly transient: boolean) {
    super(message);
  }
}

/** Should the email outbox retry after this error? Network problems and timeouts: yes. */
export function isTransientEmailError(err: unknown): boolean {
  if (err instanceof EmailSendError) return err.transient;
  const smtpCode = (err as { responseCode?: unknown })?.responseCode;
  if (typeof smtpCode === 'number') return smtpCode < 500; // SMTP 4xx = try later, 5xx = permanent
  return true;
}

const httpTransient = (status: number) => status === 429 || status >= 500;

/** Development only: prints the email's link in the terminal. Refused in production by env validation. */
class ConsoleEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    if (env.NODE_ENV === 'production' && !env.TEST_MODE) throw new Error('Console email provider cannot be used in production');
    if (env.NODE_ENV === 'test') {
      this.sent.push(msg);
      return;
    }
    // eslint-disable-next-line no-console
    console.log([
      '',
      `  ✉️  Email to ${msg.to} — ${msg.subject}`,
      msg.code ? `     Code:  ${msg.code}` : msg.link ? `     Open this link:  ${msg.link}` : `     ${msg.text.split('\n')[0]}`,
      '',
    ].join('\n'));
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const BUTTON_LABEL: Record<string, string> = {
  '/reset-password': 'Set a new password / નવો password સેટ કરો',
  '/login': 'Log in / Log in કરો',
};

/** Simple branded HTML version (the plain-text version is always sent too). */
export function renderHtml(msg: EmailMessage): string {
  const path = msg.link ? new URL(msg.link).pathname : '';
  const paragraphs = msg.text
    .split('\n\n')
    .map((p) => {
      const lines = p.split('\n').filter((l) => l !== msg.link);
      return lines.length ? `<p style="margin:0 0 14px;line-height:1.6">${lines.map(escapeHtml).join('<br>')}</p>` : '';
    })
    .join('');
  const button = msg.link
    ? `<p style="margin:22px 0"><a href="${escapeHtml(msg.link)}" style="background:#1647D8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(BUTTON_LABEL[path] ?? 'Open')}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#5B6476">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(msg.link)}</span></p>`
    : '';
  const codeBox = msg.code
    ? `<p style="margin:20px 0;text-align:center"><span style="display:inline-block;background:#EAF0FE;color:#0B1F4D;font-size:32px;font-weight:700;letter-spacing:10px;padding:14px 22px;border-radius:12px;font-family:Consolas,monospace">${escapeHtml(msg.code)}</span></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F6F8FC;font-family:Arial,'Noto Sans Gujarati',sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3E8F0">
    <tr><td style="background:#0B1F4D;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">Bluenova Creator Hub</td></tr>
    <tr><td style="padding:24px">${codeBox}${paragraphs}${button}</td></tr>
  </table></td></tr></table></body></html>`;
}

class SmtpEmailProvider implements EmailProvider {
  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // TLS from the start; port 587 upgrades with STARTTLS
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Fail fast if the host blocks outgoing mail ports (Render's free plan does).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  async send(msg: EmailMessage) {
    // Gmail only allows sending as the signed-in account, so the From address is that account.
    const from = env.SMTP_HOST.includes('gmail') ? `Bluenova Creator Hub <${env.SMTP_USER}>` : env.EMAIL_FROM;
    await this.transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: renderHtml(msg) });
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`\n  ✉️  Email sent to ${msg.to} — ${msg.subject}\n`);
    }
  }
}

class ResendEmailProvider implements EmailProvider {
  async send(msg: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: renderHtml(msg) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Resend explains the problem (unverified domain, test-mode recipient limit, bad key…): surface it.
      const body = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
      const reason = body.message ?? `HTTP ${res.status}`;
      logger.error({ status: res.status, reason }, 'Resend email send failed');
      throw new EmailSendError(`Resend refused the email: ${reason}`, httpTransient(res.status));
    }
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`
  ✉️  Email sent to ${msg.to} — ${msg.subject}
`);
    }
  }
}

/** Brevo HTTPS API: works where mail ports are blocked; the sender address must be verified in Brevo. */
class BrevoEmailProvider implements EmailProvider {
  async send(msg: EmailMessage) {
    const m = env.EMAIL_FROM.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    const sender = m ? { name: m[1] || 'Bluenova Creator Hub', email: m[2] } : { name: 'Bluenova Creator Hub', email: env.EMAIL_FROM.trim() };
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'api-key': env.BREVO_API_KEY ?? '' },
      body: JSON.stringify({ sender, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, htmlContent: renderHtml(msg) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      const reason = body.message ?? `HTTP ${res.status}`;
      logger.error({ status: res.status, reason }, 'Brevo email send failed');
      throw new EmailSendError(`Brevo refused the email: ${reason}`, httpTransient(res.status));
    }
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`
  ✉️  Email sent to ${msg.to} — ${msg.subject}
`);
    }
  }
}

export const consoleEmail = new ConsoleEmailProvider();
export const email: EmailProvider =
  env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider()
    : env.EMAIL_PROVIDER === 'resend' ? new ResendEmailProvider()
      : env.EMAIL_PROVIDER === 'brevo' ? new BrevoEmailProvider()
        : consoleEmail;

let providerOverride: EmailProvider | null = null;
/** The provider the email outbox uses (tests can swap in a failing one). */
export const emailProvider = (): EmailProvider => providerOverride ?? email;
/** Tests only. */
export function setEmailProviderForTests(p: EmailProvider | null) {
  if (env.NODE_ENV !== 'test') throw new Error('test only');
  providerOverride = p;
}

/**
 * Sends an email WITHOUT making the request wait for it ("fire and forget").
 * Why: a slow or blocked mail server must never freeze signup/login. Failures are logged, never shown
 * to the user (that could reveal whether an account exists). In development, if sending fails, the
 * code/link is printed in the terminal so the developer is never stuck.
 */
export function sendInBackground(msg: EmailMessage): void {
  email.send(msg).catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error({ reason }, 'email delivery failed');
    if (env.NODE_ENV === 'development' && (msg.link || msg.code)) {
      // eslint-disable-next-line no-console
      console.log([
        '',
        `  ⚠️  Email to ${msg.to} could NOT be sent: ${reason}`,
        msg.code ? `     Code (for testing):  ${msg.code}` : `     Link (for testing):  ${msg.link}`,
        '',
      ].join('\n'));
    }
  });
}

/* ---------- templates (plain text; bilingual where users see them) ---------- */

const footer = '\n\n— Bluenova Creator Hub\n+91 76002 36644 · bluenovatech.in\nBluenova will never ask for your password.';

export const emails = {
  /** Minimal: just the 6-digit code. Profile details are entered after login. */
  otp: (to: string, code: string): EmailMessage => ({
    to, code,
    subject: `${code} is your Bluenova verification code`,
    text: `Your Bluenova Creator Hub verification code is ${code}.\n\nતમારો verification code ${code} છે.\n\nIt expires in 10 minutes. If you didn't sign up, you can ignore this email.`,
  }),
  /** Deliberately minimal: only the verification button. Profile details are entered after login. */
  alreadyRegistered: (to: string, link: string): EmailMessage => ({
    to, link,
    subject: 'You already have a Bluenova account',
    text: `Someone tried to sign up with this email, but an account already exists.\nIf it was you, log in or reset your password here:\n${link}\n\nIf it wasn't you, you can ignore this email.${footer}`,
  }),
  reset: (to: string, name: string, link: string): EmailMessage => ({
    to, link,
    subject: 'Reset your password — Bluenova Creator Hub',
    text: `Hi ${name},\n\nUse this link to set a new password:\n${link}\n\nપાસવર્ડ બદલવા ઉપરની link ખોલો.\nThe link expires in 1 hour and works once. If you ask for another reset email, only the newest link works. If you didn't ask for this, ignore this email — your password stays the same.${footer}`,
  }),
  passwordChanged: (to: string, name: string): EmailMessage => ({
    to,
    subject: 'Your Bluenova password was changed',
    text: `Hi ${name},\n\nYour password was just changed and you were logged out on all devices.\nIf this wasn't you, reset your password immediately and contact us on +91 76002 36644.${footer}`,
  }),
  /** Admins only (English). Sent whenever a recovery code is used to log in. */
  recoveryCodeUsed: (to: string, name: string, left: number): EmailMessage => ({
    to,
    subject: 'A Bluenova admin recovery code was used',
    text: `Hi ${name},\n\nSomeone just signed in to your Bluenova admin account with a recovery code instead of the authenticator app. You have ${left} recovery code${left === 1 ? '' : 's'} left.\n\nIf this was you: open Admin → Settings → Security and set up your authenticator on your new phone.\nIf this wasn't you: tell the super admin immediately. Your password and recovery codes must be replaced.${footer}`,
  }),
  /** Admins only (English). Sent when the authenticator or the recovery codes change. */
  adminSecurityChanged: (to: string, name: string, what: 'authenticator' | 'recovery_codes'): EmailMessage => ({
    to,
    subject: 'Your Bluenova admin security settings changed',
    text: `Hi ${name},\n\n${what === 'authenticator'
      ? 'Your admin account now uses a new authenticator app. Codes from the old app no longer work, and other devices were logged out.'
      : 'New recovery codes were created for your admin account. The old codes no longer work.'}\nIf this wasn't you, tell the super admin immediately.${footer}`,
  }),
};
