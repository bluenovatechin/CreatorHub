/**
 * TESTS: disputes (pause a running deal; the team continues or cancels it), ratings after completed deals,
 * reports about campaigns/creators, and the team dashboard counts for the new queues.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CreatorProfileModel } from '../src/models/creatorProfile';
import { NotificationModel } from '../src/models/system';
import { app, bearer, campaignWithDeal, loginAdmin, useDatabase } from './helpers';

useDatabase('trust_tests');

const DRIVE = 'https://drive.google.com/file/d/abc123/view';
const REEL = 'https://www.instagram.com/reel/AbCdE12345/';
const PROBLEM = 'The brand changed the brief after I started filming.';

async function completedDeal() {
  const ctx = await campaignWithDeal('started');
  const post = (token: string, path: string, body: object) => request(app).post(`/api/v1${path}`).set(bearer(token)).send(body).expect((r) => {
    if (r.status >= 300) throw new Error(`${path} → ${r.status} ${JSON.stringify(r.body)}`);
  });
  await post(ctx.creator.token, `/deals/${ctx.dealId}/draft`, { url: DRIVE });
  await post(ctx.cm.token, `/admin/deals/${ctx.dealId}/draft-review`, { decision: 'APPROVE' });
  await post(ctx.brand.token, `/deals/${ctx.dealId}/review`, { decision: 'APPROVE' });
  await post(ctx.creator.token, `/deals/${ctx.dealId}/live`, { url: REEL });
  await post(ctx.cm.token, `/admin/deals/${ctx.dealId}/live-review`, { decision: 'VERIFY' });
  return ctx;
}

describe('disputes', () => {
  it('pause the deal; each side sees only its own text; the team continues it from where it was', async () => {
    const { creator, brand, cm, dealId } = await campaignWithDeal('started');
    const deal = (token: string) => request(app).get(`/api/v1/deals/${dealId}`).set(bearer(token)).then((r) => r.body.data);
    await request(app).post(`/api/v1/deals/${dealId}/draft`).set(bearer(creator.token)).send({ url: DRIVE }).expect(200);

    const dispute = (token: string, body: object) => request(app).post(`/api/v1/deals/${dealId}/dispute`).set(bearer(token)).send(body);
    expect((await dispute(creator.token, { reason: 'BRIEF_CHANGED', description: 'short' })).status).toBe(400);
    await dispute(creator.token, { reason: 'BRIEF_CHANGED', description: PROBLEM }).expect(201);
    expect((await dispute(brand.token, { reason: 'QUALITY', description: 'A second dispute on the same deal.' })).status).toBe(409);

    const forCreator = await deal(creator.token);
    expect(forCreator.status).toBe('DISPUTED');
    expect(forCreator.dispute).toMatchObject({ status: 'OPEN', raisedByMe: true, description: PROBLEM });
    const forBrand = await deal(brand.token);
    expect(forBrand.dispute).toMatchObject({ status: 'OPEN', raisedByMe: false, description: null }); // the other side's text stays private
    expect(await NotificationModel.exists({ type: 'deal_disputed' })).toBeTruthy();
    // Nothing moves while the deal is paused.
    const paused = await request(app).post(`/api/v1/admin/deals/${dealId}/draft-review`).set(bearer(cm.token)).send({ decision: 'APPROVE' });
    expect(paused.status).toBe(409);
    expect(paused.body.error.message).toBe('errors.dealDisputed');
    expect((await request(app).post(`/api/v1/deals/${dealId}/draft`).set(bearer(creator.token)).send({ url: DRIVE })).status).toBe(409);

    const reviewer = await loginAdmin('reviewer');
    const list = await request(app).get('/api/v1/admin/disputes').set(bearer(cm.token)).expect(200);
    const disputeId = list.body.data.find((d: { dealId: string }) => d.dealId === dealId).id;
    await request(app).post(`/api/v1/admin/disputes/${disputeId}/resolve`).set(bearer(reviewer.token)).send({ outcome: 'CONTINUE', note: 'ok' }).expect(403);
    await request(app).post(`/api/v1/admin/disputes/${disputeId}/resolve`).set(bearer(cm.token)).send({ outcome: 'CONTINUE', note: 'Brand agreed to the original brief.' }).expect(200);
    const after = await deal(brand.token);
    expect(after.status).toBe('DRAFT_SUBMITTED'); // back exactly where it was
    expect(after.dispute).toMatchObject({ status: 'RESOLVED', resolution: { outcome: 'CONTINUE', note: 'Brand agreed to the original brief.' } });
    await request(app).post(`/api/v1/admin/disputes/${disputeId}/resolve`).set(bearer(cm.token)).send({ outcome: 'CANCEL', note: 'again' }).expect(409);
  });

  it('the team can cancel a disputed deal; a campaign with only cancelled deals is not marked completed', async () => {
    const { creator, brand, cm, dealId, campaignId } = await campaignWithDeal('started');
    await request(app).post(`/api/v1/deals/${dealId}/dispute`).set(bearer(brand.token)).send({ reason: 'DEADLINE', description: 'The creator has not replied for two weeks.' }).expect(201);
    const id = (await request(app).get('/api/v1/admin/disputes').set(bearer(cm.token))).body.data.find((d: { dealId: string }) => d.dealId === dealId).id;
    await request(app).post(`/api/v1/admin/disputes/${id}/resolve`).set(bearer(cm.token)).send({ outcome: 'CANCEL', note: 'Cancelled after talking to both sides.' }).expect(200);
    expect((await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(creator.token))).body.data.status).toBe('CANCELLED');
    expect((await request(app).get(`/api/v1/campaigns/${campaignId}`).set(bearer(brand.token))).body.data.status).toBe('ACTIVE');
  });
});

describe('ratings', () => {
  it('each side rates once after completion; the creator profile keeps the average', async () => {
    const { creator, brand, dealId, creator: { profileId } } = await completedDeal();
    const rate = (token: string, body: object) => request(app).post(`/api/v1/deals/${dealId}/rating`).set(bearer(token)).send(body);
    expect((await rate(brand.token, { stars: 6 })).status).toBe(400);
    const r = await rate(brand.token, { stars: 5, comment: 'Lovely reel, on time.' }).expect(201);
    expect(r.body.data.myRating).toEqual({ stars: 5, comment: 'Lovely reel, on time.' });
    const twice = await rate(brand.token, { stars: 1 });
    expect(twice.status).toBe(409);
    expect(twice.body.error.message).toBe('errors.alreadyRated');
    await rate(creator.token, { stars: 4 }).expect(201);

    const p = await CreatorProfileModel.findById(profileId).lean();
    expect(p).toMatchObject({ ratingAvg: 5, ratingCount: 1, completedDeals: 1 });
    const cm = await loginAdmin('campaign_manager');
    const team = await request(app).get(`/api/v1/admin/ratings?targetType=CREATOR&targetId=${profileId}`).set(bearer(cm.token)).expect(200);
    expect(team.body.data.ratings[0]).toMatchObject({ stars: 5, comment: 'Lovely reel, on time.' });

    const running = await campaignWithDeal('started');
    const early = await request(app).post(`/api/v1/deals/${running.dealId}/rating`).set(bearer(running.brand.token)).send({ stars: 3 });
    expect(early.status).toBe(409);
    expect(early.body.error.message).toBe('errors.rateAfterCompletion');
  });
});

describe('reports and the dashboard', () => {
  it('people can report only what they deal with; moderators review; the dashboard counts every queue', async () => {
    const { creator, brand, campaignId, creator: { profileId } } = await campaignWithDeal('offer');
    const report = (token: string, body: object) => request(app).post('/api/v1/reports').set(bearer(token)).send(body);
    const about = { reason: 'FAKE', details: 'This campaign asks creators to pay a fee first.' };

    await report(creator.token, { targetType: 'CAMPAIGN', targetId: campaignId, ...about }).expect(201);
    const dup = await report(creator.token, { targetType: 'CAMPAIGN', targetId: campaignId, ...about });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('errors.alreadyReported');
    expect((await report(creator.token, { targetType: 'CAMPAIGN', targetId: '64b000000000000000000000', ...about })).status).toBe(404);
    expect((await report(creator.token, { targetType: 'CREATOR', targetId: profileId, ...about })).status).toBe(403);
    await report(brand.token, { targetType: 'CREATOR', targetId: profileId, reason: 'ABUSE', details: 'Rude messages to our staff.' }).expect(201);
    expect((await report(brand.token, { targetType: 'CAMPAIGN', targetId: campaignId, ...about })).status).toBe(403);

    const finance = await loginAdmin('finance');
    await request(app).get('/api/v1/admin/reports').set(bearer(finance.token)).expect(403);
    const reviewer = await loginAdmin('reviewer');
    const list = await request(app).get('/api/v1/admin/reports').set(bearer(reviewer.token)).expect(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    const first = list.body.data.find((r: { targetType: string }) => r.targetType === 'CAMPAIGN');
    expect(first.targetName).toBe('Diwali sweets launch');
    await request(app).post(`/api/v1/admin/reports/${first.id}/review`).set(bearer(reviewer.token)).send({ outcome: 'ACTIONED', note: 'Campaign paused.' }).expect(200);
    await request(app).post(`/api/v1/admin/reports/${first.id}/review`).set(bearer(reviewer.token)).send({ outcome: 'DISMISSED' }).expect(409);
    expect(await NotificationModel.exists({ type: 'report_reviewed' })).toBeTruthy();

    const dash = await request(app).get('/api/v1/admin/dashboard').set(bearer(reviewer.token)).expect(200);
    for (const k of ['workToReview', 'applicationsWaiting', 'messagesWaiting', 'openDisputes', 'openReports']) expect(typeof dash.body.data[k]).toBe('number');
    expect(dash.body.data.openReports).toBeGreaterThanOrEqual(1);
  });
});
