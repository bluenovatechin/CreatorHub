/**
 * PAYMENTS (manual bank/UPI transfers) + the payments on/off switch.
 * While payments are OFF (the default), brand payment routes answer 404 and the team starts campaigns with
 * POST /admin/campaigns/:id/start instead. All amounts are whole paise (₹1 = 100 paise) to avoid rounding errors.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  BLUENOVA_STATE_CODE, campaignMachine, dealMachine, istDateToUtc, objectId, paginationQuery, paymentDetailsSchema,
  paymentReviewSchema, paymentSubmitSchema, rupeesToPaise,
  type PaymentDetailsInput, type PaymentSubmitInput,
} from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { idempotent } from '../../middleware/idempotency';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { AppError, invalidState, notFound } from '../../lib/errors';
import { cursorPage, h, input, ok, withTransaction } from '../../lib/http';
import { notify, notifyAdmins } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel } from '../../models/deal';
import { PaymentModel, type Payment } from '../../models/payment';
import { SettingsModel, getSettings } from '../../models/system';

/* ---------- money maths (all integer paise) ---------- */

export function computeCharges(prices: number[], brandStateCode: string | undefined, gstRateBps: number) {
  const subtotalPaise = prices.reduce((a, b) => a + b, 0);
  const gstPaise = Math.round((subtotalPaise * gstRateBps) / 10_000);
  const intraState = brandStateCode === BLUENOVA_STATE_CODE;
  const cgstPaise = intraState ? Math.floor(gstPaise / 2) : 0;
  const sgstPaise = intraState ? gstPaise - cgstPaise : 0;
  const igstPaise = intraState ? 0 : gstPaise;
  return { subtotalPaise, gst: { rateBps: gstRateBps, cgstPaise, sgstPaise, igstPaise }, totalPaise: subtotalPaise + gstPaise };
}

function publicPaymentDetails(s: Awaited<ReturnType<typeof getSettings>>) {
  const d = s.paymentDetails;
  if (!d?.accountNumber) return null;
  return {
    accountName: d.accountName, bankName: d.bankName, accountNumber: d.accountNumber, ifsc: d.ifsc,
    upiId: d.upiId ?? null, instructions: d.instructions ?? null,
  };
}

type PaymentLike = Payment & { _id: unknown; createdAt?: Date };
function paymentView(p: PaymentLike) {
  return {
    id: String(p._id), status: p.status, method: p.method, reference: p.reference,
    amountPaidPaise: p.amountPaidPaise, totalPaise: p.totalPaise, subtotalPaise: p.subtotalPaise, gst: p.gst,
    paidOn: p.paidOn, payerName: p.payerName, note: p.note ?? null, rejectReason: p.rejectReason ?? null,
    reviewedAt: p.reviewedAt ?? null, createdAt: p.createdAt, dealCount: p.dealIds?.length ?? 0,
  };
}

/* ---------- brand ---------- */

/** While payments are switched off, every payment route behaves as if it doesn't exist. */
async function requirePaymentsEnabled() {
  if (!(await getSettings()).paymentsEnabled) throw notFound();
}

/** Mounted inside the brands router, which already requires a signed-in brand. */
export const brandPaymentsRouter = Router();
// (Express 5 route paths have no regex groups, so the two paths are listed.)
brandPaymentsRouter.use(['/campaigns/:id/checkout', '/campaigns/:id/payments'], h(async (_req, _res, next) => { await requirePaymentsEnabled(); next(); }));

async function ownCampaign(req: Request) {
  const brand = await BrandProfileModel.findOne({ userId: req.auth!.id });
  if (!brand || brand.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'errors.brandProfileIncomplete');
  const campaign = await CampaignModel.findOne({ _id: input<{ id: string }>(req, 'params').id, brandId: brand._id });
  if (!campaign) throw notFound();
  return { brand, campaign };
}

const idParams = validate({ params: z.object({ id: objectId }) });

/** What the brand owes right now: accepted creators not yet paid for. Always calculated on the server. */
brandPaymentsRouter.get('/campaigns/:id/checkout', idParams, h(async (req, res) => {
  const { brand, campaign } = await ownCampaign(req);
  const settings = await getSettings();
  const deals = await DealModel.find({ campaignId: campaign._id, status: 'AWAITING_PAYMENT' }).lean();
  const creators = await CreatorProfileModel.find({ _id: { $in: deals.map((d) => d.creatorId) } }, { displayName: 1 }).lean();
  const names = new Map(creators.map((c) => [String(c._id), c.displayName ?? '']));
  const charges = computeCharges(deals.map((d) => d.brandPricePaise ?? 0), brand.billingAddress?.stateCode ?? undefined, settings.gstRateBps);
  const payments = await PaymentModel.find({ campaignId: campaign._id }).sort({ _id: -1 }).lean();
  ok(res, {
    campaignStatus: campaign.status,
    lines: deals.map((d) => ({ dealId: String(d._id), creator: names.get(String(d.creatorId)) ?? '', brandPricePaise: d.brandPricePaise ?? 0 })),
    ...charges,
    paymentDetails: publicPaymentDetails(settings),
    pending: payments.some((p) => p.status === 'SUBMITTED'),
    payments: payments.map(paymentView),
  });
}));

brandPaymentsRouter.post('/campaigns/:id/payments', idempotent, validate({ params: z.object({ id: objectId }), body: paymentSubmitSchema }), h(async (req, res) => {
  const { brand, campaign } = await ownCampaign(req);
  const d = input<PaymentSubmitInput>(req);
  const settings = await getSettings();
  if (!publicPaymentDetails(settings)) throw new AppError('INVALID_STATE', 'errors.paymentDetailsMissing');

  const created = await withTransaction(async (session) => {
    if (await PaymentModel.exists({ campaignId: campaign._id, status: 'SUBMITTED' }).session(session)) {
      throw new AppError('CONFLICT', 'errors.paymentAlreadySubmitted');
    }
    const deals = await DealModel.find({ campaignId: campaign._id, status: 'AWAITING_PAYMENT' }).session(session).lean();
    if (deals.length === 0) throw invalidState();
    const charges = computeCharges(deals.map((x) => x.brandPricePaise ?? 0), brand.billingAddress?.stateCode ?? undefined, settings.gstRateBps);
    const amountPaidPaise = rupeesToPaise(d.amountPaid);
    if (amountPaidPaise !== charges.totalPaise) {
      throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { amountPaid: 'errors.amountMismatch' });
    }
    if (await PaymentModel.exists({ method: d.method, reference: d.reference, status: { $in: ['SUBMITTED', 'VERIFIED'] } }).session(session)) {
      throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { reference: 'errors.referenceUsed' });
    }
    const [p] = await PaymentModel.create([{
      campaignId: campaign._id, brandId: brand._id, dealIds: deals.map((x) => x._id), ...charges,
      method: d.method, reference: d.reference, amountPaidPaise, paidOn: istDateToUtc(d.paidOn),
      payerName: d.payerName, note: d.note, submittedBy: req.auth!.id,
    }], { session });
    await notifyAdmins(['finance'], 'admin_payment_submitted', { campaign: campaign.title ?? '', amount: d.amountPaid }, `/payments`, session);
    return p;
  });
  ok(res, paymentView(created.toObject()), 201);
}));

/* ---------- admin (finance) ---------- */

/** Mounted inside the admin router, which already requires a signed-in admin. */
export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(['/payments', '/settings/payment'], h(async (_req, _res, next) => { await requirePaymentsEnabled(); next(); }));

/** Feature switches (super admin). Payments start switched off. */
adminPaymentsRouter.get('/settings/features', h(async (_req, res) => {
  ok(res, { paymentsEnabled: (await getSettings()).paymentsEnabled });
}));

adminPaymentsRouter.put('/settings/features', requireAdmin('super_admin'), validate({ body: z.object({ paymentsEnabled: z.boolean() }) }), h(async (req, res) => {
  const { paymentsEnabled } = input<{ paymentsEnabled: boolean }>(req);
  await SettingsModel.updateOne({ _id: 'global' }, { $set: { paymentsEnabled } }, { upsert: true });
  await audit(req, 'settings.features', 'Settings', undefined, { changes: { paymentsEnabled } });
  ok(res, { paymentsEnabled });
}));

/**
 * Payments switched off: once creators have accepted, the team confirms the campaign with the brand
 * outside the website and starts it here.
 */
adminPaymentsRouter.post('/campaigns/:id/start', requireAdmin('campaign_manager'), idempotent, validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  if ((await getSettings()).paymentsEnabled) throw new AppError('INVALID_STATE', 'errors.usePaymentFlow');
  const { id } = input<{ id: string }>(req, 'params');
  const started = await withTransaction(async (session) => {
    const campaign = await CampaignModel.findById(id).session(session);
    if (!campaign) throw notFound();
    const deals = await DealModel.find({ campaignId: campaign._id, status: 'AWAITING_PAYMENT' }).session(session);
    if (deals.length === 0) throw invalidState();
    for (const deal of deals) {
      applyTransition(deal, dealMachine, 'IN_PRODUCTION', 'system', req.auth!.id, 'confirmed_by_team');
      await deal.save({ session });
      const creator = await CreatorProfileModel.findById(deal.creatorId, { userId: 1 }).session(session).lean();
      if (creator) await notify(creator.userId, 'creator_start_work', { campaign: campaign.title ?? '' }, '/creator/deals', session);
    }
    if (campaign.status === 'PAYMENT_PENDING') {
      applyTransition(campaign, campaignMachine, 'ACTIVE', 'system', req.auth!.id, 'confirmed_by_team');
      await campaign.save({ session });
    }
    const brand = await BrandProfileModel.findById(campaign.brandId, { userId: 1 }).session(session).lean();
    if (brand) await notify(brand.userId, 'brand_campaign_started', { campaign: campaign.title ?? '' }, `/brand/campaigns/${campaign._id}`, session);
    await audit(req, 'campaign.start', 'Campaign', campaign._id, { changes: { deals: deals.length } }, session);
    return deals.length;
  });
  ok(res, { started });
}));

adminPaymentsRouter.get('/payments', requireAdmin('finance', 'campaign_manager'),
  validate({ query: paginationQuery.extend({ status: z.enum(['SUBMITTED', 'VERIFIED', 'REJECTED']).optional() }) }),
  h(async (req, res) => {
    const { status, cursor, limit } = input<{ status?: string; cursor?: string; limit: number }>(req, 'query');
    const filter: Record<string, unknown> = status ? { status } : {};
    if (cursor) filter._id = { $lt: cursor };
    const items = await PaymentModel.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const { page, nextCursor } = cursorPage(items, limit);
    const [campaigns, brands] = await Promise.all([
      CampaignModel.find({ _id: { $in: page.map((p) => p.campaignId) } }, { title: 1 }).lean(),
      BrandProfileModel.find({ _id: { $in: page.map((p) => p.brandId) } }, { companyName: 1, gstin: 1 }).lean(),
    ]);
    const cMap = new Map(campaigns.map((c) => [String(c._id), c.title ?? '']));
    const bMap = new Map(brands.map((b) => [String(b._id), b]));
    ok(res, page.map((p) => ({
      ...paymentView(p), campaignId: String(p.campaignId), campaignTitle: cMap.get(String(p.campaignId)) ?? '',
      companyName: bMap.get(String(p.brandId))?.companyName ?? '', gstin: bMap.get(String(p.brandId))?.gstin ?? null,
    })), 200, { nextCursor });
  }),
);

/** Finance checks the bank statement, then verifies (work starts) or rejects (brand can resubmit). */
adminPaymentsRouter.post('/payments/:id/review', requireAdmin('finance'), idempotent,
  validate({ params: z.object({ id: objectId }), body: paymentReviewSchema }),
  h(async (req, res) => {
    const { id } = input<{ id: string }>(req, 'params');
    const d = input<{ decision: 'VERIFIED' | 'REJECTED'; reason?: string }>(req);
    const result = await withTransaction(async (session) => {
      const p = await PaymentModel.findOne({ _id: id, status: 'SUBMITTED' }).session(session);
      if (!p) throw invalidState();
      p.status = d.decision;
      p.reviewedBy = req.auth!.id as never;
      p.reviewedAt = new Date();
      if (d.decision === 'REJECTED') p.rejectReason = d.reason;
      await p.save({ session });
      const campaign = await CampaignModel.findById(p.campaignId).session(session);
      const brand = await BrandProfileModel.findById(p.brandId, { userId: 1 }).session(session).lean();
      if (d.decision === 'VERIFIED') {
        const deals = await DealModel.find({ _id: { $in: p.dealIds }, status: 'AWAITING_PAYMENT' }).session(session);
        for (const deal of deals) {
          applyTransition(deal, dealMachine, 'IN_PRODUCTION', 'system', req.auth!.id, 'payment_verified');
          await deal.save({ session });
          const creator = await CreatorProfileModel.findById(deal.creatorId, { userId: 1 }).session(session).lean();
          if (creator) await notify(creator.userId, 'creator_start_work', { campaign: campaign?.title ?? '' }, '/creator/deals', session);
        }
        if (campaign && campaign.status === 'PAYMENT_PENDING') {
          applyTransition(campaign, campaignMachine, 'ACTIVE', 'system', req.auth!.id, 'payment_verified');
          await campaign.save({ session });
        }
        if (brand) await notify(brand.userId, 'brand_payment_verified', { campaign: campaign?.title ?? '' }, `/brand/campaigns/${p.campaignId}`, session);
      } else if (brand) {
        await notify(brand.userId, 'brand_payment_rejected', { campaign: campaign?.title ?? '' }, `/brand/campaigns/${p.campaignId}/payment`, session);
      }
      await audit(req, `payment.${d.decision.toLowerCase()}`, 'Payment', p._id, {
        changes: { amountPaidPaise: p.amountPaidPaise, method: p.method, reference: p.reference }, reason: d.reason,
      }, session);
      return p;
    });
    ok(res, paymentView(result.toObject()));
  }),
);

adminPaymentsRouter.get('/settings/payment', requireAdmin('finance'), h(async (_req, res) => {
  const s = await getSettings();
  ok(res, { ...publicPaymentDetails(s), configured: !!publicPaymentDetails(s), gstRateBps: s.gstRateBps });
}));

adminPaymentsRouter.put('/settings/payment', requireAdmin('super_admin'), validate({ body: paymentDetailsSchema }), h(async (req, res) => {
  const d = input<PaymentDetailsInput>(req);
  const before = publicPaymentDetails(await getSettings());
  await SettingsModel.updateOne({ _id: 'global' }, {
    $set: { paymentDetails: { ...d, updatedBy: req.auth!.id, updatedAt: new Date() } },
  }, { upsert: true });
  await audit(req, 'settings.payment_details', 'Settings', undefined, {
    changes: { before: before ? { ...before, accountNumber: `…${before.accountNumber?.slice(-4)}` } : null, after: { ...d, accountNumber: `…${d.accountNumber.slice(-4)}` } },
  });
  ok(res, publicPaymentDetails(await getSettings()));
}));
