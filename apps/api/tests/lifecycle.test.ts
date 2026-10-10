/**
 * TESTS: the collaboration lifecycle rules added on top of the work flow: deadline reminders (each once), missed
 * deadlines, automatic approval when the brand doesn't review in time, recorded amendments (each side sees only its
 * own money), team cancellation, and concurrent requests (two clicks at once never both succeed).
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { autoApproveDrafts, remindDeadlines } from '../src/jobs/deadlines';
import { DealModel, OfferModel } from '../src/models/deal';
import { AuditLogModel, NotificationModel } from '../src/models/system';
import { app, approvedCreator, bearer, campaignWithDeal, loginAdmin, useDatabase } from './helpers';

useDatabase('lifecycle_tests');

const DRIVE = 'https://drive.google.com/file/d/abc123/view';

describe('deadlines', () => {
  it('reminds once before the draft is due, then reports the missed deadline once', async () => {
    const { dealId } = await campaignWithDeal('started');
    const deal = (await DealModel.findById(dealId).lean())!;
    const due = deal.deadlines!.draftDue!.getTime();
    const count = (type: string) => NotificationModel.countDocuments({ type, 'params.campaign': 'Diwali sweets launch' });

    const before = await count('creator_draft_due_soon');
    await remindDeadlines(new Date(due - 24 * 3_600_000));
    await remindDeadlines(new Date(due - 23 * 3_600_000)); // second run: nothing new
    expect(await count('creator_draft_due_soon')).toBe(before + 1);

    const missedBefore = await count('creator_deadline_missed');
    await remindDeadlines(new Date(due + 3_600_000));
    await remindDeadlines(new Date(due + 2 * 3_600_000));
    expect(await count('creator_deadline_missed')).toBe(missedBefore + 1);
    expect(await NotificationModel.exists({ type: 'admin_deadline_missed' })).toBeTruthy();

    const cm = await loginAdmin('campaign_manager');
    const overdue = await request(app).get('/api/v1/admin/deals?status=OVERDUE').set(bearer(cm.token)).expect(200);
    expect(overdue.body.data.some((d: { id: string }) => d.id === dealId)).toBe(false); // the draft date isn't really past yet
  });

  it('approves a draft automatically when the brand does not review it in time', async () => {
    const { creator, brand, cm, dealId } = await campaignWithDeal('started');
    await request(app).post(`/api/v1/deals/${dealId}/draft`).set(bearer(creator.token)).send({ url: DRIVE }).expect(200);
    await request(app).post(`/api/v1/admin/deals/${dealId}/draft-review`).set(bearer(cm.token)).send({ decision: 'APPROVE' }).expect(200);
    expect(await autoApproveDrafts(new Date(Date.now() + 86_400_000))).toBe(0); // 1 day: too early
    expect(await autoApproveDrafts(new Date(Date.now() + 6 * 86_400_000))).toBe(1); // default: 5 days
    const d = (await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(creator.token))).body.data;
    expect(d.status).toBe('APPROVED');
    expect(d.submissions.at(-1).reviews.at(-1)).toMatchObject({ by: 'system', decision: 'APPROVE' });
    expect(await NotificationModel.exists({ type: 'brand_draft_auto_approved' })).toBeTruthy();
    expect((await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(brand.token))).body.data.status).toBe('APPROVED');
  });
});

describe('amendments and cancellation', () => {
  it('records amendments with a reason; each side only sees the money it may see', async () => {
    const { creator, brand, cm, dealId } = await campaignWithDeal('started');
    const amend = (token: string, body: object) => request(app).post(`/api/v1/admin/deals/${dealId}/amend`).set(bearer(token)).send(body);
    const reviewer = await loginAdmin('reviewer');
    expect((await amend(reviewer.token, { reason: 'x-test', creatorPayout: 6000 })).status).toBe(403);
    expect((await amend(cm.token, { creatorPayout: 6000 })).status).toBe(400); // reason required
    expect((await amend(cm.token, { reason: 'Nothing really' })).status).toBe(400); // nothing to change
    const r = await amend(cm.token, { reason: 'Creator agreed to an extra story', creatorPayout: 6000, brandPrice: 8000, liveDue: '2099-01-31' }).expect(200);
    expect(r.body.data.creatorPayoutPaise).toBe(600000);

    const forCreator = (await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(creator.token))).body.data;
    expect(forCreator.creatorPayoutPaise).toBe(600000);
    expect(Object.keys(forCreator.amendments[0].changes).sort()).toEqual(['creatorPayoutPaise', 'liveDue']);
    const forBrand = (await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(brand.token))).body.data;
    expect(Object.keys(forBrand.amendments[0].changes).sort()).toEqual(['brandPricePaise', 'liveDue']);
    expect(JSON.stringify(forBrand)).not.toContain('600000'); // the creator's payout never reaches the brand
    expect(await AuditLogModel.exists({ action: 'deal.amend', entityId: dealId })).toBeTruthy();
    expect(await NotificationModel.countDocuments({ type: 'deal_amended' })).toBeGreaterThanOrEqual(2);
  });

  it('the team can cancel an unfinished deal with a reason, once; finished deals cannot be changed', async () => {
    const { creator, cm, dealId } = await campaignWithDeal('started');
    expect((await request(app).post(`/api/v1/admin/deals/${dealId}/cancel`).set(bearer(cm.token)).send({})).status).toBe(400);
    await request(app).post(`/api/v1/admin/deals/${dealId}/cancel`).set(bearer(cm.token)).send({ reason: 'Creator left the platform.' }).expect(200);
    expect((await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(creator.token))).body.data.status).toBe('CANCELLED');
    await request(app).post(`/api/v1/admin/deals/${dealId}/cancel`).set(bearer(cm.token)).send({ reason: 'again' }).expect(409);
    await request(app).post(`/api/v1/admin/deals/${dealId}/amend`).set(bearer(cm.token)).send({ reason: 'late change', creatorPayout: 1 }).expect(409);
    expect(await NotificationModel.exists({ type: 'deal_cancelled' })).toBeTruthy();
  });
});

describe('concurrent requests (two clicks at the same moment)', () => {
  it('only one of two parallel "accept" clicks creates a deal', async () => {
    const { creator, offerId } = await campaignWithDeal('offer');
    const accept = () => request(app).post(`/api/v1/offers/${offerId}/accept`).set(bearer(creator.token));
    const results = await Promise.all([accept(), accept()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await DealModel.countDocuments({ offerId })).toBe(1);
    expect((await OfferModel.findById(offerId).lean())!.status).toBe('ACCEPTED');
  });

  it('only one of two parallel draft sends, and one of two parallel team reviews, succeeds', async () => {
    const { creator, cm, dealId } = await campaignWithDeal('started');
    const send = () => request(app).post(`/api/v1/deals/${dealId}/draft`).set(bearer(creator.token)).send({ url: DRIVE });
    const sent = await Promise.all([send(), send()]);
    expect(sent.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await DealModel.findById(dealId).lean())!.submissions).toHaveLength(1); // no duplicate submission

    const review = () => request(app).post(`/api/v1/admin/deals/${dealId}/draft-review`).set(bearer(cm.token)).send({ decision: 'APPROVE' });
    const reviewed = await Promise.all([review(), review()]);
    expect(reviewed.map((r) => r.status).sort()).toEqual([200, 409]);
    const deal = (await DealModel.findById(dealId).lean())!;
    expect(deal.status).toBe('BRAND_REVIEW');
    expect(deal.submissions[0].reviews).toHaveLength(1);
  });

  it('creators cannot approve their own work or change amounts', async () => {
    const { creator, dealId } = await campaignWithDeal('started');
    await request(app).post(`/api/v1/deals/${dealId}/draft`).set(bearer(creator.token)).send({ url: DRIVE }).expect(200);
    await request(app).post(`/api/v1/admin/deals/${dealId}/draft-review`).set(bearer(creator.token)).send({ decision: 'APPROVE' }).expect(401);
    await request(app).post(`/api/v1/deals/${dealId}/review`).set(bearer(creator.token)).send({ decision: 'APPROVE' }).expect(403);
    await request(app).post(`/api/v1/admin/deals/${dealId}/amend`).set(bearer(creator.token)).send({ reason: 'more money', creatorPayout: 99999 }).expect(401);
    const other = await approvedCreator();
    await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(other.token)).expect(404);
  });
});
