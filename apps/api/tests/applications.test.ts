/**
 * TESTS: campaign applications. Approved creators apply to open campaigns in their categories; the Bluenova team
 * shortlists (the creator then appears on the brand's shortlist) or declines; creators can withdraw.
 * Brands never see applications. One application per creator per campaign.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CampaignModel, ShortlistItemModel } from '../src/models/campaign';
import { NotificationModel } from '../src/models/system';
import { activeBrand, app, approvedCreator, bearer, loginAdmin, onboardedCreator, submittedCampaign, useDatabase } from './helpers';

useDatabase('applications_tests');

const PITCH = 'I post Surat food reels every week and my audience loves sweets.';

async function openCampaign() {
  const brand = await activeBrand();
  const campaignId = await submittedCampaign(brand.token);
  const cm = await loginAdmin('campaign_manager');
  await request(app).post(`/api/v1/admin/campaigns/${campaignId}/claim`).set(bearer(cm.token)).expect(200);
  return { brand, campaignId, cm };
}

describe('applications', () => {
  it('creator applies once; the team shortlists; the brand sees only the shortlist', async () => {
    const { brand, campaignId, cm } = await openCampaign();
    const creator = await approvedCreator();
    const apply = (token: string, body: object) => request(app).post(`/api/v1/opportunities/${campaignId}/apply`).set(bearer(token)).send(body);

    const before = await request(app).get('/api/v1/opportunities').set(bearer(creator.token)).expect(200);
    expect(before.body.data.find((o: { id: string }) => o.id === campaignId).application).toBeNull();
    expect((await apply(creator.token, { pitch: 'Too short' })).status).toBe(400);
    const created = await apply(creator.token, { pitch: PITCH, proposedRate: 6000 }).expect(201);
    expect(created.body.data).toMatchObject({ status: 'SUBMITTED', proposedRatePaise: 600000, campaignTitle: 'Diwali sweets launch' });
    const again = await apply(creator.token, { pitch: PITCH });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('errors.alreadyApplied');
    const after = (await request(app).get('/api/v1/opportunities').set(bearer(creator.token))).body.data.find((o: { id: string }) => o.id === campaignId);
    expect(after).toMatchObject({ interested: true, application: { status: 'SUBMITTED' } });
    expect(await NotificationModel.exists({ type: 'admin_application_received' })).toBeTruthy();

    // Not approved yet → refused. Brands and reviewers can't see or decide applications.
    const pending = await onboardedCreator();
    expect((await apply(pending.token, { pitch: PITCH })).status).toBe(403);
    await request(app).get(`/api/v1/admin/campaigns/${campaignId}/applications`).set(bearer(brand.token)).expect(401);
    const reviewer = await loginAdmin('reviewer');
    await request(app).get(`/api/v1/admin/campaigns/${campaignId}/applications`).set(bearer(reviewer.token)).expect(403);

    const list = await request(app).get(`/api/v1/admin/campaigns/${campaignId}/applications`).set(bearer(cm.token)).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].creator.displayName).toBe('Riya Eats');
    const appId = list.body.data[0].id;
    const decide = (body: object) => request(app).post(`/api/v1/admin/applications/${appId}/decision`).set(bearer(cm.token)).send(body);
    expect((await decide({ decision: 'SHORTLIST', creatorPayout: 6000, brandPrice: 5000 })).status).toBe(400); // price below payout
    const ok = await decide({ decision: 'SHORTLIST', creatorPayout: 6000 }).expect(200);
    expect(ok.body.data.status).toBe('SHORTLISTED');
    expect((await decide({ decision: 'DECLINE' })).status).toBe(409); // already decided
    const item = await ShortlistItemModel.findOne({ campaignId, creatorId: creator.profileId }).lean();
    expect(item!.creatorPayoutPaise).toBe(600000);
    expect(item!.brandPricePaise).toBeGreaterThan(600000); // suggested price includes Bluenova's margin

    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist/send`).set(bearer(cm.token)).expect(200);
    const sl = await request(app).get(`/api/v1/campaigns/${campaignId}/shortlist`).set(bearer(brand.token)).expect(200);
    expect(sl.body.data).toHaveLength(1);
    expect(JSON.stringify(sl.body.data)).not.toContain(PITCH); // the brand never sees the application
    expect(await NotificationModel.exists({ type: 'creator_application_shortlisted' })).toBeTruthy();
  });

  it('the team can decline (the creator sees why), and creators can withdraw their own only', async () => {
    const { campaignId, cm } = await openCampaign();
    const a = await approvedCreator();
    const b = await approvedCreator();
    const idOf = async (token: string) => (await request(app).post(`/api/v1/opportunities/${campaignId}/apply`).set(bearer(token)).send({ pitch: PITCH }).expect(201)).body.data.id as string;
    const aId = await idOf(a.token);
    const bId = await idOf(b.token);

    await request(app).post(`/api/v1/admin/applications/${aId}/decision`).set(bearer(cm.token)).send({ decision: 'DECLINE', note: 'We need creators with 50k+ followers for this one.' }).expect(200);
    const mine = await request(app).get('/api/v1/applications').set(bearer(a.token)).expect(200);
    expect(mine.body.data[0]).toMatchObject({ status: 'DECLINED', decisionNote: 'We need creators with 50k+ followers for this one.' });

    await request(app).post(`/api/v1/applications/${bId}/withdraw`).set(bearer(a.token)).expect(404); // not theirs
    await request(app).post(`/api/v1/applications/${bId}/withdraw`).set(bearer(b.token)).expect(200);
    await request(app).post(`/api/v1/applications/${bId}/withdraw`).set(bearer(b.token)).expect(409);
  });

  it('only open campaigns in the creator\'s categories accept applications', async () => {
    const { campaignId } = await openCampaign();
    const creator = await approvedCreator();
    await CampaignModel.updateOne({ _id: campaignId }, { $set: { 'filters.categories': ['fashion'] } });
    await request(app).post(`/api/v1/opportunities/${campaignId}/apply`).set(bearer(creator.token)).send({ pitch: PITCH }).expect(404);
  });
});
