/**
 * Sends one test email with the current email settings.
 *   npm run email:test -- --to you@gmail.com
 */
import { emailSchema } from '@bluenova/shared';
import { env } from '../config/env';
import { email } from '../providers/email';

async function main() {
  const i = process.argv.indexOf('--to');
  const to = emailSchema.parse(i >= 0 ? process.argv[i + 1] : undefined);
  await email.send({
    to,
    subject: 'Test email from Bluenova Creator Hub',
    text: `This is a test email. If you can read this, email sending works.\n\nEmail mode: ${env.EMAIL_PROVIDER}`,
  });
  // eslint-disable-next-line no-console
  console.log(env.EMAIL_PROVIDER === 'console'
    ? '\nEMAIL_PROVIDER is "console", so nothing was really sent. Set EMAIL_PROVIDER=smtp in apps/api/.env.'
    : `\n✅ Test email sent to ${to}. Check the inbox (and the spam folder).`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`\n❌ Could not send: ${err instanceof Error ? err.message : err}\n   Check SMTP_USER and SMTP_PASS (must be a Google App password) in apps/api/.env.`);
  process.exit(1);
});
