/**
 * TESTS: the work after a deal starts. Creator sends a draft link → team reviews → brand reviews (brand deals) →
 * creator sends the live post link → team verifies → deal (and campaign) completed. Also: who may do each step,
 * contact details hidden between brand and creator, the revision limit, the intro reel path and the team queue.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { NotificationModel } from '../src/models/system';
import { app, approvedCreator, bearer, campaignWithDeal, loginAdmin, useDatabase } from './helpers';

useDatabase('deliverables_tests');

const DRIVE = 'https://drive.google.com/file/d/abc123/view';
const REEL = 'https://www.instagram.com/reel/AbCdE12345/';

describe('brand deal: draft → reviews → live → completed', () => {
  it('runs the whole path with the right person at each step', async () => {
    const { creator, brand, cm, campaignId, dealId } = await campaignWithDeal('started');
    const other = await approvedCreator();
    const reviewer = await loginAdmin('reviewer');
    const deal = (token: string) => request(app).get(`/api/v1/deals/${dealId}`).set(bearer(token)).expect(200).then((r) => r.body.data);
    const post = (token: string, path: string, body: object) => request(app).post(`/api/v1${path}`).set(bearer(token)).send(body);

    // Creator sends a draft. Bad links, the brand and other creators are refused.
    expect((await post(creator.token, `/deals/${dealId}/draft`, { url: 'http://insecure.example.com/x' })).status).toBe(400);
    expect((await post(brand.token, `/deals/${dealId}/draft`, { url: DRIVE })).status).toBe(403);
    expect((await post(other.token, `/deals/${dealId}/draft`, { url: DRIVE })).status).toBe(404);
    await post(creator.token, `/deals/${dealId}/draft`, { url: DRIVE, note: 'First cut. WhatsApp me on 98250 41234' }).expect(200);
    expect((await deal(brand.token)).submissions).toEqual([]); // the brand sees nothing until the team forwards it

    // Team: reviewers can't handle brand deals; sending back needs a note.
    expect((await post(reviewer.token, `/admin/deals/${dealId}/draft-review`, { decision: 'APPROVE' })).status).toBe(409);
    expect((await post(cm.token, `/admin/deals/${dealId}/draft-review`, { decision: 'REVISION' })).status).toBe(400);
    await post(cm.token, `/admin/deals/${dealId}/draft-review`, { decision: 'REVISION', note: 'Show the box in the first 3 seconds.' }).expect(200);
    const afterTeam = await deal(creator.token);
    expect(afterTeam.status).toBe('REVISION_REQUESTED');
    expect(afterTeam.submissions[0].reviews[0]).toMatchObject({ by: 'team', decision: 'REVISION', note: 'Show the box in the first 3 seconds.' });

    // Second draft → forwarded to the brand, who sees it with the creator's phone number hidden.
    await post(creator.token, `/deals/${dealId}/draft`, { url: `${DRIVE}2`, note: 'Fixed. Call 98250 41234 if needed' }).expect(200);
    await post(cm.token, `/admin/deals/${dealId}/draft-review`, { decision: 'APPROVE' }).expect(200);
    const forBrand = await deal(brand.token);
    expect(forBrand.status).toBe('BRAND_REVIEW');
    expect(forBrand.submissions).toHaveLength(1);
    expect(forBrand.submissions[0].url).toBe(`${DRIVE}2`);
    expect(forBrand.submissions[0].note).not.toContain('98250');
    expect(forBrand.submissions[0].reviews).toEqual([]); // team-internal reviews stay internal
    expect(await NotificationModel.exists({ type: 'brand_draft_ready' })).toBeTruthy();

    // Brand asks for changes (contact details hidden from the creator), then approves the next draft.
    await post(brand.token, `/deals/${dealId}/review`, { decision: 'REVISION', note: 'Louder music please, or email me at asha@suratsweets.in' }).expect(200);
    const brandNote = (await deal(creator.token)).submissions.at(-1).reviews.at(-1);
    expect(brandNote.by).toBe('brand');
    expect(brandNote.note).not.toContain('asha@suratsweets.in');
    expect((await deal(brand.token)).revisionsLeft).toBe(1);
    await post(creator.token, `/deals/${dealId}/draft`, { url: `${DRIVE}3` }).expect(200);
    await post(cm.token, `/admin/deals/${dealId}/draft-review`, { decision: 'APPROVE' }).expect(200);
    await post(brand.token, `/deals/${dealId}/review`, { decision: 'APPROVE' }).expect(200);
    expect((await deal(creator.token)).status).toBe('APPROVED');

    // Live link: must be an Instagram post; the team can send it back, then verifies.
    expect((await post(creator.token, `/deals/${dealId}/live`, { url: DRIVE })).status).toBe(400);
    await post(creator.token, `/deals/${dealId}/live`, { url: REEL }).expect(200);
    expect((await post(cm.token, `/admin/deals/${dealId}/live-review`, { decision: 'REJECT' })).status).toBe(400); // note required
    await post(cm.token, `/admin/deals/${dealId}/live-review`, { decision: 'REJECT', note: '#ad is missing from the caption.' }).expect(200);
    expect((await deal(creator.token)).status).toBe('APPROVED');
    expect((await deal(brand.token)).submissions.filter((s: { kind: string }) => s.kind === 'LIVE')).toEqual([]); // not verified yet
    await post(creator.token, `/deals/${dealId}/live`, { url: REEL }).expect(200);
    await post(cm.token, `/admin/deals/${dealId}/live-review`, { decision: 'VERIFY' }).expect(200);

    const done = await deal(brand.token);
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBeTruthy();
    expect(done.submissions.some((s: { kind: string; url: string }) => s.kind === 'LIVE' && s.url === REEL)).toBe(true);
    const campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).set(bearer(brand.token)).expect(200);
    expect(campaign.body.data.status).toBe('COMPLETED'); // its only deal is done
    // Nothing more can happen to a completed deal.
    expect((await post(creator.token, `/deals/${dealId}/live`, { url: REEL })).status).toBe(409);
  });

  it('stops the brand from asking for more changes than the campaign allows', async () => {
    const { creator, brand, cm, dealId } = await campaignWithDeal('started');
    const cycle = async () => {
      await request(app).post(`/api/v1/deals/${dealId}/draft`).set(bearer(creator.token)).send({ url: DRIVE }).expect(200);
      await request(app).post(`/api/v1/admin/deals/${dealId}/draft-review`).set(bearer(cm.token)).send({ decision: 'APPROVE' }).expect(200);
      return request(app).post(`/api/v1/deals/${dealId}/review`).set(bearer(brand.token)).send({ decision: 'REVISION', note: 'Another change please.' });
    };
    expect((await cycle()).status).toBe(200); // the test campaign allows 2 revisions
    expect((await cycle()).status).toBe(200);
    const third = await cycle();
    expect(third.status).toBe(409);
    expect(third.body.error.message).toBe('errors.revisionLimit');
    await request(app).post(`/api/v1/deals/${dealId}/review`).set(bearer(brand.token)).send({ decision: 'APPROVE' }).expect(200);
  });
});

describe('intro reel and the team queue', () => {
  it('reviewers approve and verify intro reels; brands never see them; the queue shows waiting work', async () => {
    const creator = await approvedCreator();
    const me = (await request(app).get('/api/v1/me').set(bearer(creator.token))).body.data;
    const introId = me.creator.introReelDealId as string;
    const { brand } = await campaignWithDeal('started');

    await request(app).post(`/api/v1/deals/${introId}/draft`).set(bearer(creator.token)).send({ url: DRIVE }).expect(200);
    const queue = await request(app).get('/api/v1/admin/deals').set(bearer(creator.reviewer.token)).expect(200);
    expect(queue.body.data.map((d: { id: string }) => d.id)).toContain(introId);
    expect(queue.body.data.every((d: { type: string }) => d.type === 'INTRO_REEL')).toBe(true); // reviewers only see intro reels

    await request(app).post(`/api/v1/admin/deals/${introId}/draft-review`).set(bearer(creator.reviewer.token)).send({ decision: 'APPROVE' }).expect(200);
    await request(app).post(`/api/v1/deals/${introId}/live`).set(bearer(creator.token)).send({ url: REEL }).expect(200);
    await request(app).post(`/api/v1/admin/deals/${introId}/live-review`).set(bearer(creator.reviewer.token)).send({ decision: 'VERIFY' }).expect(200);
    const intro = await request(app).get(`/api/v1/deals/${introId}`).set(bearer(creator.token)).expect(200);
    expect(intro.body.data.status).toBe('COMPLETED');
    await request(app).get(`/api/v1/deals/${introId}`).set(bearer(brand.token)).expect(404);
    await request(app).get('/api/v1/admin/deals').set(bearer(brand.token)).expect(401); // website accounts can't use admin routes
  });
});
