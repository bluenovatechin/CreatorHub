/**
 * TESTS: business flows end to end — creator onboarding and review, brand campaign → shortlist → offer
 * → deal, payments on/off, ownership checks (nobody can see another account's data).
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/models/system';
import { CreatorProfileModel } from '../src/models/creatorProfile';
import { expireOffers } from '../src/jobs/scheduler';
import { OfferModel } from '../src/models/deal';
import { PaymentModel } from '../src/models/payment';
import {
  activeBrand, app, bearer, campaignSteps, creatorSteps, loginAdmin, onboardedCreator, signup,
  submittedCampaign, todayStr, useDatabase,
} from './helpers';

useDatabase('flow_tests');

describe('creator onboarding', () => {
  it('validates each step, ignores fields users may not set, and re-validates on submit', async () => {
    const c = await signup('creator');
    const r = await request(app).put('/api/v1/creators/me/onboarding/1').set(bearer(c.token))
      .send({ ...creatorSteps[1], status: 'APPROVED', isPartner: true, creatorScore: 100 }).expect(200);
    expect(r.body.data.status).toBe('DRAFT');
    expect(r.body.data.isPartner).toBe(false);
    expect(r.body.data.creatorScore).toBe(60);

    await request(app).put('/api/v1/creators/me/onboarding/3').set(bearer(c.token))
      .send({ reels: ['https://evil.com/reel/AbCdE12345/', 'https://www.instagram.com/reel/XyZaB67890/'] }).expect(400);
    await request(app).put('/api/v1/creators/me/onboarding/9').set(bearer(c.token)).send({}).expect(400);

    // Skipping steps 2–4 and submitting directly is refused.
    const s = await request(app).post('/api/v1/creators/me/submit').set(bearer(c.token)).expect(400);
    expect(s.body.error.message).toBe('errors.profileIncomplete');

    for (const step of [2, 3, 4] as const) {
      await request(app).put(`/api/v1/creators/me/onboarding/${step}`).set(bearer(c.token)).send(creatorSteps[step]).expect(200);
    }
    const ok = await request(app).post('/api/v1/creators/me/submit').set(bearer(c.token)).expect(200);
    expect(ok.body.data.status).toBe('SUBMITTED');
    // Can't edit or resubmit while under review.
    await request(app).put('/api/v1/creators/me/onboarding/2').set(bearer(c.token)).send(creatorSteps[2]).expect(409);
    await request(app).post('/api/v1/creators/me/submit').set(bearer(c.token)).expect(409);
    // Unapproved creators can't see opportunities.
    await request(app).get('/api/v1/opportunities').set(bearer(c.token)).expect(403);
  });
});

describe('admin review', () => {
  it('requires claiming first, records scores, creates the intro reel task and an audit entry', async () => {
    const c = await onboardedCreator();
    const reviewer = await loginAdmin('reviewer');
    const profile = await CreatorProfileModel.findOne({ displayName: 'Riya Eats', status: 'SUBMITTED' }).sort({ _id: -1 });
    const id = String(profile!._id);
    const decision = { decision: 'APPROVED', scores: { quality: 5, consistency: 4, audienceFit: 4, engagement: 4 } };

    await request(app).post(`/api/v1/admin/creators/${id}/decision`).set(bearer(reviewer.token)).send(decision).expect(409);
    await request(app).post(`/api/v1/admin/creators/${id}/claim`).set(bearer(reviewer.token)).expect(200);
    await request(app).post(`/api/v1/admin/creators/${id}/decision`).set(bearer(reviewer.token))
      .send({ decision: 'REJECTED', scores: decision.scores }).expect(400); // reason required
    const r = await request(app).post(`/api/v1/admin/creators/${id}/decision`).set(bearer(reviewer.token)).send(decision).expect(200);
    expect(r.body.data.status).toBe('APPROVED');
    expect(r.body.data.introReelDealId).toBeTruthy();

    const me = await request(app).get('/api/v1/creators/me').set(bearer(c.token)).expect(200);
    expect(me.body.data.isPartner).toBe(true);
    expect(me.body.data.review).toBeNull(); // reviewer scores are not shown to the creator
    const deals = await request(app).get('/api/v1/deals').set(bearer(c.token)).expect(200);
    expect(deals.body.data[0].type).toBe('INTRO_REEL');

    const logs = await AuditLogModel.find({ entityId: profile!._id }).lean();
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['creator.claim', 'creator.approved']));
  });
});

describe('brand → shortlist → offer → deal', () => {
  it('runs end to end with ownership checks and role-specific views', async () => {
    // Approved creator
    const creator = await onboardedCreator();
    const reviewer = await loginAdmin('reviewer');
    const profile = await CreatorProfileModel.findOne({ userId: (await request(app).get('/api/v1/me').set(bearer(creator.token))).body.data.id });
    const cm = await loginAdmin('campaign_manager');
    await request(app).post(`/api/v1/admin/creators/${profile!._id}/claim`).set(bearer(reviewer.token)).expect(200);
    await request(app).post(`/api/v1/admin/creators/${profile!._id}/decision`).set(bearer(reviewer.token))
      .send({ decision: 'APPROVED', scores: { quality: 5, consistency: 5, audienceFit: 5, engagement: 5 } }).expect(200);

    // Brand must complete onboarding before creating campaigns
    const newBrand = await signup('brand');
    await request(app).post('/api/v1/campaigns').set(bearer(newBrand.token)).send(campaignSteps[1]).expect(403);

    const brand = await activeBrand();
    const campaignId = await submittedCampaign(brand.token);

    // Another brand can't see or touch it
    const other = await activeBrand();
    await request(app).get(`/api/v1/campaigns/${campaignId}`).set(bearer(other.token)).expect(404);
    await request(app).post(`/api/v1/campaigns/${campaignId}/cancel`).set(bearer(other.token)).send({ reason: 'test cancel' }).expect(404);
    // Submitted campaigns can't be edited
    await request(app).put(`/api/v1/campaigns/${campaignId}/wizard/1`).set(bearer(brand.token)).send(campaignSteps[1]).expect(409);

    // Campaign manager claims, matches, shortlists, sends
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist`).set(bearer(cm.token))
      .send({ items: [{ creatorId: String(profile!._id), creatorPayout: 8000 }] }).expect(409); // must claim first
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/claim`).set(bearer(cm.token)).expect(200);
    const matches = await request(app).get(`/api/v1/admin/campaigns/${campaignId}/matches`).set(bearer(cm.token)).expect(200);
    expect(matches.body.data.some((m: { creator: { id: string } }) => m.creator.id === String(profile!._id))).toBe(true);
    // Shortlist is empty for the brand before it is sent
    expect((await request(app).get(`/api/v1/campaigns/${campaignId}/shortlist`).set(bearer(brand.token))).body.data).toEqual([]);
    const added = await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist`).set(bearer(cm.token))
      .send({ items: [{ creatorId: String(profile!._id), creatorPayout: 8000, note: 'great fit' }] }).expect(201);
    expect(added.body.data[0].brandPricePaise).toBe(1_070_000); // ₹8,000 at 25% margin → ₹10,700
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist/send`).set(bearer(cm.token)).expect(200);

    // Brand sees price but never payout, margin, notes or contacts
    const sl = await request(app).get(`/api/v1/campaigns/${campaignId}/shortlist`).set(bearer(brand.token)).expect(200);
    const item = sl.body.data[0];
    expect(item.brandPricePaise).toBe(1_070_000);
    const text = JSON.stringify(sl.body);
    for (const forbidden of ['creatorPayoutPaise', 'marginPaise', 'adminNote', 'great fit', 'fullName', 'phone', '9825041234', creator.email]) {
      expect(text).not.toContain(forbidden);
    }

    // Other brand can't select from it
    await request(app).post(`/api/v1/campaigns/${campaignId}/shortlist/select`).set(bearer(other.token)).send({ itemIds: [item.id] }).expect(404);
    await request(app).post(`/api/v1/campaigns/${campaignId}/shortlist/select`).set(bearer(brand.token)).send({ itemIds: [item.id] }).expect(200);

    // Creator sees the offer with payout only
    const offers = await request(app).get('/api/v1/offers').set(bearer(creator.token)).expect(200);
    const offer = offers.body.data[0];
    expect(offer.payoutPaise).toBe(800_000);
    expect(offer.brief.disclosure).toBe('#ad');
    expect(JSON.stringify(offers.body)).not.toMatch(/brandPrice|margin|9825077777|Asha Patel/);

    // Another creator can't act on it
    const stranger = await signup('creator');
    await request(app).post(`/api/v1/offers/${offer.id}/accept`).set(bearer(stranger.token)).expect(404);

    await request(app).post(`/api/v1/offers/${offer.id}/accept`).set(bearer(creator.token)).expect(200);
    await request(app).post(`/api/v1/offers/${offer.id}/accept`).set(bearer(creator.token)).expect(409);

    // Deal views differ per role
    const brandDeals = await request(app).get('/api/v1/deals').set(bearer(brand.token)).expect(200);
    expect(brandDeals.body.data[0].brandPricePaise).toBe(1_070_000);
    expect(JSON.stringify(brandDeals.body)).not.toMatch(/creatorPayout|margin/);
    const creatorDeals = await request(app).get('/api/v1/deals').set(bearer(creator.token)).expect(200);
    const brandDeal = creatorDeals.body.data.find((d: { type: string }) => d.type === 'BRAND');
    expect(brandDeal.creatorPayoutPaise).toBe(800_000);
    expect(brandDeal.status).toBe('AWAITING_PAYMENT');
    expect(JSON.stringify(creatorDeals.body)).not.toMatch(/brandPrice|margin/);
    await request(app).get(`/api/v1/deals/${brandDeal.id}`).set(bearer(other.token)).expect(404);

    const campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).set(bearer(brand.token)).expect(200);
    expect(campaign.body.data.status).toBe('PAYMENT_PENDING');

    /* ---- manual payment (switched off by default) ---- */
    const pay = { method: 'UPI', reference: '412345678901', amountPaid: 12626, paidOn: todayStr(), payerName: 'Surat Sweets' };
    expect((await request(app).get('/api/v1/config').expect(200)).body.data.paymentsEnabled).toBe(false);
    await request(app).get(`/api/v1/campaigns/${campaignId}/checkout`).set(bearer(brand.token)).expect(404);
    await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send(pay).expect(404);
    const superAdmin = await loginAdmin('super_admin');
    await request(app).put('/api/v1/admin/settings/features').set(bearer(cm.token)).send({ paymentsEnabled: true }).expect(403);
    await request(app).put('/api/v1/admin/settings/features').set(bearer(superAdmin.token)).send({ paymentsEnabled: true }).expect(200);
    // With payments on, the team can't skip the payment step.
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/start`).set(bearer(cm.token)).expect(409);
    // No bank details configured yet: brand can't submit a payment.
    await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send(pay).expect(409);
    await request(app).put('/api/v1/admin/settings/payment').set(bearer(cm.token))
      .send({ accountName: 'Bluenova Tech', bankName: 'HDFC Bank', accountNumber: '50200012345678', ifsc: 'HDFC0001234' }).expect(403);
    await request(app).put('/api/v1/admin/settings/payment').set(bearer(superAdmin.token))
      .send({ accountName: 'Bluenova Tech', bankName: 'HDFC Bank', accountNumber: '50200012345678', ifsc: 'HDFC0001234', upiId: 'bluenova@hdfcbank' }).expect(200);

    const checkout = await request(app).get(`/api/v1/campaigns/${campaignId}/checkout`).set(bearer(brand.token)).expect(200);
    // ₹10,700 + 18% GST (Gujarat brand → CGST 9% + SGST 9%) = ₹12,626
    expect(checkout.body.data.subtotalPaise).toBe(1_070_000);
    expect(checkout.body.data.gst.cgstPaise).toBe(96_300);
    expect(checkout.body.data.gst.sgstPaise).toBe(96_300);
    expect(checkout.body.data.totalPaise).toBe(1_262_600);
    expect(checkout.body.data.paymentDetails.ifsc).toBe('HDFC0001234');
    await request(app).get(`/api/v1/campaigns/${campaignId}/checkout`).set(bearer(other.token)).expect(404);

    // Wrong amount, bad reference format and future dates are rejected
    let r = await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send({ ...pay, amountPaid: 10700 }).expect(400);
    expect(r.body.error.fields.amountPaid).toBe('errors.amountMismatch');
    await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send({ ...pay, reference: 'ABC' }).expect(400);
    await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send({ ...pay, paidOn: '2999-01-01' }).expect(400);
    const submitted = await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send(pay).expect(201);
    await request(app).post(`/api/v1/campaigns/${campaignId}/payments`).set(bearer(brand.token)).send(pay).expect(409); // one at a time

    // Only finance can verify; campaign managers can only view
    await request(app).post(`/api/v1/admin/payments/${submitted.body.data.id}/review`).set(bearer(cm.token)).send({ decision: 'VERIFIED' }).expect(403);
    const finance = await loginAdmin('finance');
    await request(app).post(`/api/v1/admin/payments/${submitted.body.data.id}/review`).set(bearer(finance.token)).send({ decision: 'REJECTED' }).expect(400); // reason required
    await request(app).post(`/api/v1/admin/payments/${submitted.body.data.id}/review`).set(bearer(finance.token)).send({ decision: 'VERIFIED' }).expect(200);
    await request(app).post(`/api/v1/admin/payments/${submitted.body.data.id}/review`).set(bearer(finance.token)).send({ decision: 'VERIFIED' }).expect(409);
    const afterPay = await request(app).get(`/api/v1/campaigns/${campaignId}`).set(bearer(brand.token)).expect(200);
    expect(afterPay.body.data.status).toBe('ACTIVE');
    const creatorDeals2 = await request(app).get('/api/v1/deals').set(bearer(creator.token)).expect(200);
    expect(creatorDeals2.body.data.find((d: { type: string }) => d.type === 'BRAND').status).toBe('IN_PRODUCTION');
    expect(await PaymentModel.countDocuments({ status: 'VERIFIED' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'payment.verified' })).toBe(1);

    // Notifications were created for each party
    const notes = await request(app).get('/api/v1/notifications').set(bearer(brand.token)).expect(200);
    expect(notes.body.data.map((n: { type: string }) => n.type)).toEqual(expect.arrayContaining(['brand_shortlist_ready', 'brand_offer_accepted', 'brand_payment_verified']));
  });

  it('with payments switched off, the team starts the campaign after creators accept', async () => {
    const superAdmin = await loginAdmin('super_admin');
    await request(app).put('/api/v1/admin/settings/features').set(bearer(superAdmin.token)).send({ paymentsEnabled: false }).expect(200);
    const creator = await onboardedCreator();
    const reviewer = await loginAdmin('reviewer');
    const me = (await request(app).get('/api/v1/me').set(bearer(creator.token))).body.data;
    const profile = await CreatorProfileModel.findOne({ userId: me.id });
    await request(app).post(`/api/v1/admin/creators/${profile!._id}/claim`).set(bearer(reviewer.token)).expect(200);
    await request(app).post(`/api/v1/admin/creators/${profile!._id}/decision`).set(bearer(reviewer.token))
      .send({ decision: 'APPROVED', scores: { quality: 4, consistency: 4, audienceFit: 4, engagement: 4 } }).expect(200);
    const brand = await activeBrand();
    const campaignId = await submittedCampaign(brand.token);
    const cm = await loginAdmin('campaign_manager');
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/claim`).set(bearer(cm.token)).expect(200);
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist`).set(bearer(cm.token)).send({ items: [{ creatorId: String(profile!._id), creatorPayout: 5000 }] }).expect(201);
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/shortlist/send`).set(bearer(cm.token)).expect(200);
    const sl = await request(app).get(`/api/v1/campaigns/${campaignId}/shortlist`).set(bearer(brand.token)).expect(200);
    await request(app).post(`/api/v1/campaigns/${campaignId}/shortlist/select`).set(bearer(brand.token)).send({ itemIds: [sl.body.data[0].id] }).expect(200);
    const offers = await request(app).get('/api/v1/offers').set(bearer(creator.token)).expect(200);
    await request(app).post(`/api/v1/offers/${offers.body.data[0].id}/accept`).set(bearer(creator.token)).expect(200);

    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/start`).set(bearer(reviewer.token)).expect(403); // wrong role
    const r = await request(app).post(`/api/v1/admin/campaigns/${campaignId}/start`).set(bearer(cm.token)).expect(200);
    expect(r.body.data.started).toBe(1);
    await request(app).post(`/api/v1/admin/campaigns/${campaignId}/start`).set(bearer(cm.token)).expect(409); // nothing left to start
    const c = await request(app).get(`/api/v1/campaigns/${campaignId}`).set(bearer(brand.token)).expect(200);
    expect(c.body.data.status).toBe('ACTIVE');
    const deals = await request(app).get('/api/v1/deals').set(bearer(creator.token)).expect(200);
    expect(deals.body.data.find((d: { type: string }) => d.type === 'BRAND').status).toBe('IN_PRODUCTION');
    await request(app).get('/api/v1/admin/payments').set(bearer(superAdmin.token)).expect(404); // payment pages hidden
  });

  it('expires offers that are not answered in time', async () => {
    await OfferModel.updateMany({}, { $set: { status: 'SENT', expiresAt: new Date(Date.now() - 1000) } });
    const count = await expireOffers();
    expect(count).toBeGreaterThan(0);
    expect(await OfferModel.countDocuments({ status: 'SENT' })).toBe(0);
  });
});

describe('validation and errors', () => {
  it('returns safe error bodies with a request id and no stack trace', async () => {
    const r = await request(app).get('/api/v1/nope').expect(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
    expect(r.body.error.requestId).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts/);
    const bad = await request(app).get('/api/v1/campaigns/not-an-id').set(bearer((await activeBrand()).token)).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized bodies', async () => {
    const { token } = await signup('creator');
    await request(app).put('/api/v1/creators/me/onboarding/1').set(bearer(token))
      .send({ ...creatorSteps[1], bio: 'x'.repeat(200_000) }).expect(400);
  });

  it('sets security headers and disables caching on API responses', async () => {
    const r = await request(app).get('/api/v1/nope');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });
});
