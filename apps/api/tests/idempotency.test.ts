/**
 * TESTS: doing important things only once. The same request sent twice with the same Idempotency-Key header
 * (double click, network retry) is done once and gets the same answer; a changed request is refused; failures
 * are not remembered; and database uniqueness rules stop races even without a key.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DealModel, OfferModel } from '../src/models/deal';
import { IdempotencyKeyModel } from '../src/models/idempotency';
import { PaymentModel } from '../src/models/payment';
import { app, bearer, campaignWithDeal, useDatabase } from './helpers';

useDatabase('idempotency_tests');

describe('Idempotency-Key on important actions', () => {
  it('accepting an offer twice with the same key creates one deal and replays the same answer', async () => {
    const { creator, offerId } = await campaignWithDeal('offer');
    const accept = (key?: string, body: object = {}) => {
      const r = request(app).post(`/api/v1/offers/${offerId}/accept`).set(bearer(creator.token));
      return (key ? r.set('Idempotency-Key', key) : r).send(body);
    };
    await accept('bad key!').expect(400); // only letters, digits, - and _

    const first = await accept('accept-offer-key-1').expect(200);
    const second = await accept('accept-offer-key-1').expect(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await DealModel.countDocuments({ offerId })).toBe(1);

    const changed = await accept('accept-offer-key-1', { extra: true }).expect(409); // same key, different request
    expect(changed.body.error.message).toBe('errors.idempotencyMismatch');
    await accept().expect(409); // without a key the normal state check still blocks a second accept
  });

  it('does not remember failures, so the same key works once the problem is fixed', async () => {
    const { creator, cm, campaignId, offerId } = await campaignWithDeal('offer');
    const start = () => request(app).post(`/api/v1/admin/campaigns/${campaignId}/start`).set(bearer(cm.token)).set('Idempotency-Key', 'start-campaign-1');
    await start().expect(409); // nobody has accepted yet: nothing to start
    expect(await IdempotencyKeyModel.countDocuments({ status: 'done', responseStatus: { $gte: 300 } })).toBe(0); // failure not saved
    await request(app).post(`/api/v1/offers/${offerId}/accept`).set(bearer(creator.token)).expect(200);
    const ok = await start().expect(200);
    expect(ok.body.data.started).toBe(1);
    const replay = await start().expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.data.started).toBe(1);
  });

  it('keys belong to one user: another user with the same key is not given the first answer', async () => {
    const a = await campaignWithDeal('offer');
    const b = await campaignWithDeal('offer');
    await request(app).post(`/api/v1/offers/${a.offerId}/accept`).set(bearer(a.creator.token)).set('Idempotency-Key', 'shared-key-123').expect(200);
    const other = await request(app).post(`/api/v1/offers/${b.offerId}/accept`).set(bearer(b.creator.token)).set('Idempotency-Key', 'shared-key-123').expect(200);
    expect(other.headers['idempotent-replayed']).toBeUndefined();
    expect((await OfferModel.findById(b.offerId).lean())!.status).toBe('ACCEPTED');
  });
});

describe('database uniqueness rules (races without a key)', () => {
  it('allows only one deal per offer and one waiting payment per campaign', async () => {
    const { offerId } = await campaignWithDeal('accepted');
    const deal = await DealModel.findOne({ offerId }).lean();
    const { _id: _ignored, ...copy } = deal!;
    await expect(DealModel.create(copy)).rejects.toMatchObject({ code: 11000 });

    const base = {
      campaignId: deal!.campaignId, brandId: deal!.brandId, dealIds: [deal!._id], subtotalPaise: 100, totalPaise: 118,
      gst: { rateBps: 1800, cgstPaise: 9, sgstPaise: 9, igstPaise: 0 }, method: 'UPI', amountPaidPaise: 118,
      paidOn: new Date(), payerName: 'Asha Patel', submittedBy: deal!.brandId,
    };
    await PaymentModel.create({ ...base, reference: 'UTR000000000001' });
    await expect(PaymentModel.create({ ...base, reference: 'UTR000000000002' })).rejects.toMatchObject({ code: 11000 });
    // Once finance has decided on the first, a new submission is possible again.
    await PaymentModel.updateMany({ campaignId: deal!.campaignId }, { $set: { status: 'REJECTED' } });
    await PaymentModel.create({ ...base, reference: 'UTR000000000003' });
  });
});
