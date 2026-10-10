/**
 * TESTS: brand area additions. Campaign list paging, "copy campaign" (a fresh draft without dates), and ownership:
 * a brand can never see, copy, edit, submit or cancel another brand's campaign.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DealModel } from '../src/models/deal';
import { activeBrand, app, bearer, brandProfile, campaignSteps, campaignWithDeal, creatorSteps, signup, submittedCampaign, useDatabase } from './helpers';

useDatabase('brand_tests');

describe('brand campaigns', () => {
  it('pages through campaigns and copies one into a new draft without dates', async () => {
    const brand = await activeBrand();
    const first = await submittedCampaign(brand.token);
    await submittedCampaign(brand.token);
    const page1 = await request(app).get('/api/v1/campaigns?limit=1').set(bearer(brand.token)).expect(200);
    expect(page1.body.data).toHaveLength(1);
    const page2 = await request(app).get(`/api/v1/campaigns?limit=1&cursor=${page1.body.meta.nextCursor}`).set(bearer(brand.token)).expect(200);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);

    const copy = await request(app).post(`/api/v1/campaigns/${first}/duplicate`).set(bearer(brand.token)).expect(201);
    expect(copy.body.data).toMatchObject({ status: 'DRAFT', title: 'Diwali sweets launch (copy)', startDate: null, endDate: null, wizardStep: 4 });
    expect(copy.body.data.filters.categories).toEqual(campaignSteps[2].categories);
    // The copy can't be submitted until it has new dates.
    const early = await request(app).post(`/api/v1/campaigns/${copy.body.data.id}/submit`).set(bearer(brand.token)).expect(400);
    expect(Object.keys(early.body.error.fields).some((k) => k.startsWith('step4.'))).toBe(true);
  });

  it('never lets a brand touch another brand\'s campaign', async () => {
    const owner = await activeBrand();
    const other = await activeBrand();
    const id = await submittedCampaign(owner.token);
    const as = (method: 'get' | 'post' | 'put', path: string, body: object = {}) => request(app)[method](`/api/v1${path}`).set(bearer(other.token)).send(body);
    await as('get', `/campaigns/${id}`).expect(404);
    await as('post', `/campaigns/${id}/duplicate`).expect(404);
    await as('put', `/campaigns/${id}/wizard/1`, campaignSteps[1]).expect(404);
    await as('post', `/campaigns/${id}/submit`).expect(404);
    await as('post', `/campaigns/${id}/cancel`, { reason: 'not mine' }).expect(404);
    await as('get', `/campaigns/${id}/shortlist`).expect(404);
    expect((await as('get', '/campaigns')).body.data).toEqual([]);
  });
});

describe('formats and areas (2026-10-10)', () => {
  it('campaigns accept Reel/Story/Collab only; brand areas become a new campaign\'s cities; old deals still open', async () => {
    const brand = await activeBrand();
    await request(app).put('/api/v1/brands/me').set(bearer(brand.token)).send({ ...brandProfile, areas: ['surat', 'vapi', 'bardoli'] }).expect(200);
    const me = await request(app).get('/api/v1/brands/me').set(bearer(brand.token)).expect(200);
    expect(me.body.data.areas).toEqual(['surat', 'vapi', 'bardoli']);

    const created = await request(app).post('/api/v1/campaigns').set(bearer(brand.token)).send(campaignSteps[1]).expect(201);
    expect(created.body.data.filters.cities).toEqual(['surat', 'vapi', 'bardoli']);
    const id = created.body.data.id as string;
    const step3 = (type: string) => request(app).put(`/api/v1/campaigns/${id}/wizard/3`).set(bearer(brand.token))
      .send({ ...campaignSteps[3], deliverables: [{ type, quantity: 1 }] });
    expect((await step3('POST')).status).toBe(400);
    expect((await step3('CAROUSEL')).status).toBe(400);
    expect((await step3('COLLAB')).status).toBe(200);

    // A deal saved before the change (with an old format) still loads for both sides.
    const { creator, dealId } = await campaignWithDeal('started');
    await DealModel.updateOne({ _id: dealId }, { $set: { deliverables: [{ type: 'POST', quantity: 1 }] } });
    const old = await request(app).get(`/api/v1/deals/${dealId}`).set(bearer(creator.token)).expect(200);
    expect(old.body.data.deliverables).toEqual([{ type: 'POST', quantity: 1 }]);
  });

  it('creators save the areas they cover during onboarding', async () => {
    const c = await signup('creator');
    const r = await request(app).put('/api/v1/creators/me/onboarding/1').set(bearer(c.token))
      .send({ ...creatorSteps[1], areas: ['surat', 'navsari'] }).expect(200);
    expect(r.body.data.areas).toEqual(['surat', 'navsari']);
    await request(app).put('/api/v1/creators/me/onboarding/1').set(bearer(c.token)).send({ ...creatorSteps[1], areas: ['nowhere'] }).expect(400);
  });
});
