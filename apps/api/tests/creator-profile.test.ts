/**
 * TESTS: approved creators keeping their profile current. Only the allowed fields change (identity stays locked),
 * onboarding's realism rules still apply, only approved creators may use it, and "not available" removes the
 * creator from the team's match list for new campaigns.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CreatorProfileModel } from '../src/models/creatorProfile';
import { activeBrand, app, approvedCreator, bearer, loginAdmin, onboardedCreator, submittedCampaign, useDatabase } from './helpers';

useDatabase('creator_profile_tests');

const update = {
  bio: 'Surat food reels every week.', languages: ['gu', 'hi'],
  reels: ['https://www.instagram.com/reel/AbCdE12345/', 'https://www.instagram.com/reel/NewOne67890/'],
  available: true, followers: 52000, avgViews: 21000, engagementRate: 4.8, rateCard: { REEL: 9000 }, acceptsBarter: false,
};

describe('approved creator profile updates', () => {
  it('changes only the allowed fields, keeps rules, and is for approved creators only', async () => {
    const c = await approvedCreator();
    const put = (token: string, body: object) => request(app).put('/api/v1/creators/me/profile').set(bearer(token)).send(body);
    const r = await put(c.token, { ...update, displayName: 'Hacked Name', igHandle: 'someone.else', categories: ['fashion'] }).expect(200);
    expect(r.body.data).toMatchObject({ bio: 'Surat food reels every week.', displayName: 'Riya Eats', igHandle: 'riya.eats' });
    expect(r.body.data.categories).toEqual(['food', 'travel']); // locked
    const p = await CreatorProfileModel.findById(c.profileId).lean();
    expect(p!.instagram).toMatchObject({ followers: 52000, statsSource: 'manual' });
    expect(p!.rateCardPaise!.REEL).toBe(900000);

    expect((await put(c.token, { ...update, avgViews: 99_000_000 })).status).toBe(400); // unrealistic views
    const pending = await onboardedCreator();
    expect((await put(pending.token, update)).status).toBe(409); // not approved yet: onboarding is used instead
    const brand = await activeBrand();
    expect((await put(brand.token, update)).status).toBe(403);
  });

  it('"not available" leaves the creator out of new campaign matches', async () => {
    const c = await approvedCreator();
    const brand = await activeBrand();
    const campaignId = await submittedCampaign(brand.token);
    const cm = await loginAdmin('campaign_manager');
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/claim`).set(bearer(cm.token)).expect(200);
    const ids = async () => (await request(app).get(`/api/v1/admin/campaigns/${campaignId}/matches`).set(bearer(cm.token)).expect(200))
      .body.data.map((m: { creator: { id: string } }) => m.creator.id);
    expect(await ids()).toContain(c.profileId);
    await request(app).put('/api/v1/creators/me/profile').set(bearer(c.token)).send({ ...update, available: false }).expect(200);
    expect(await ids()).not.toContain(c.profileId);
  });
});
