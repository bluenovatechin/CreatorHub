/**
 * TESTS: notification emails through the outbox. Sent once in the person's language; turned-off emails are skipped;
 * temporary failures are retried, permanent ones fail with the reason; never two emails for one notification
 * (even with two senders at once); the daily limit; the admin email log and retry button; the email preference.
 */
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { processEmailOutbox } from '../src/jobs/emailOutbox';
import { notify } from '../src/lib/notify';
import { EmailJobModel } from '../src/models/emailJob';
import { UserModel } from '../src/models/user';
import { EmailSendError, consoleEmail, setEmailProviderForTests } from '../src/providers/email';
import { app, bearer, loginAdmin, signup, useDatabase } from './helpers';

useDatabase('notifications_tests');
afterEach(() => setEmailProviderForTests(null));

// Notification emails only (the signup code email to the same address is not one).
const inbox = (to: string) => consoleEmail.sent.filter((m) => m.to === to && !m.code);
const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
async function userWithNotification(type = 'creator_approved') {
  const c = await signup('creator');
  const u = await UserModel.findOne({ email: c.email }).lean();
  await notify(u!._id, type, { campaign: 'Diwali sweets launch' }, '/creator');
  return { ...c, userId: String(u!._id) };
}

describe('notification emails (outbox)', () => {
  it('sends an important notification once, in the person\'s language; unimportant ones stay in-app', async () => {
    const c = await userWithNotification('creator_approved');
    const u = await UserModel.findById(c.userId).lean();
    await notify(u!._id, 'creator_offer_expired', { campaign: 'x' }, '/creator'); // not an email type
    expect(await EmailJobModel.countDocuments({ userId: c.userId })).toBe(1);
    await processEmailOutbox();
    expect(inbox(c.email)).toHaveLength(1);
    expect(inbox(c.email)[0].subject).toContain('approve'); // Gujarati text (default language) keeps the English word
    expect(inbox(c.email)[0].text).toContain('/creator');
    await processEmailOutbox();
    expect(inbox(c.email)).toHaveLength(1); // never sent again
    expect((await EmailJobModel.findOne({ userId: c.userId }).lean())!.status).toBe('SENT');
  });

  it('respects "email me about updates" being turned off, and validates the preference', async () => {
    const c = await signup('brand');
    await request(app).patch('/api/v1/me/preferences').set(bearer(c.token)).send({}).expect(400);
    const me = await request(app).patch('/api/v1/me/preferences').set(bearer(c.token)).send({ emailNotifications: false }).expect(200);
    expect(me.body.data.emailNotifications).toBe(false);
    const u = await UserModel.findOne({ email: c.email }).lean();
    await notify(u!._id, 'brand_shortlist_ready', { campaign: 'x' }, '/brand');
    await processEmailOutbox();
    expect(inbox(c.email)).toHaveLength(0);
    expect((await EmailJobModel.findOne({ userId: u!._id }).lean())!.status).toBe('SKIPPED');
  });

  it('retries temporary failures later, fails permanent ones with the reason, and the admin can retry', async () => {
    const t = await userWithNotification();
    setEmailProviderForTests({ send: async () => { throw new EmailSendError('Brevo refused the email: too many requests', true); } });
    await processEmailOutbox();
    let job = (await EmailJobModel.findOne({ userId: t.userId }).lean())!;
    expect(job).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'Brevo refused the email: too many requests' });
    expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()); // waits before the next try
    setEmailProviderForTests(null);
    await processEmailOutbox(); // not due yet
    expect(inbox(t.email)).toHaveLength(0);
    await processEmailOutbox(later(2));
    expect(inbox(t.email)).toHaveLength(1);

    const p = await userWithNotification();
    setEmailProviderForTests({ send: async () => { throw new EmailSendError('Brevo refused the email: sender not verified', false); } });
    await processEmailOutbox();
    job = (await EmailJobModel.findOne({ userId: p.userId }).lean())!;
    expect(job.status).toBe('FAILED');
    setEmailProviderForTests(null);

    const admin = await loginAdmin('super_admin');
    const log = await request(app).get('/api/v1/admin/emails?status=FAILED').set(bearer(admin.token)).expect(200);
    expect(log.body.data.find((e: { id: string }) => e.id === String(job._id))).toMatchObject({ to: p.email, lastError: 'Brevo refused the email: sender not verified' });
    await request(app).post(`/api/v1/admin/emails/${job._id}/retry`).set(bearer(admin.token)).expect(200);
    await processEmailOutbox();
    expect(inbox(p.email)).toHaveLength(1);
    const reviewer = await loginAdmin('reviewer');
    await request(app).get('/api/v1/admin/emails').set(bearer(reviewer.token)).expect(403); // super admins only
  });

  it('never sends two emails for one notification, even with two senders running at once', async () => {
    const c = await userWithNotification();
    const job = (await EmailJobModel.findOne({ userId: c.userId }).lean())!;
    await expect(EmailJobModel.create({ ...job, _id: undefined })).rejects.toMatchObject({ code: 11000 });
    await Promise.all([processEmailOutbox(), processEmailOutbox(), processEmailOutbox()]);
    expect(inbox(c.email)).toHaveLength(1);
  });

  it('stops at the daily limit and sends the rest later', async () => {
    const c = await userWithNotification();
    const before = env.EMAIL_DAILY_LIMIT;
    (env as { EMAIL_DAILY_LIMIT: number }).EMAIL_DAILY_LIMIT = 0;
    try {
      expect(await processEmailOutbox()).toBe(0);
      expect(inbox(c.email)).toHaveLength(0);
    } finally {
      (env as { EMAIL_DAILY_LIMIT: number }).EMAIL_DAILY_LIMIT = before;
    }
    await processEmailOutbox();
    expect(inbox(c.email)).toHaveLength(1);
  });
});
