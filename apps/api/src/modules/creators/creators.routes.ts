import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  CREATOR_STEP_SCHEMAS, creatorMachine, creatorSubmitSchema, followerBand, objectId, offerDeclineSchema, offerMachine,
  campaignMachine, paiseToRupees, rupeesToPaise,
  type CreatorStep1, type CreatorStep2, type CreatorStep3, type CreatorStep4,
} from '@bluenova/shared';
import { authenticate, authorize } from '../../middleware/auth';
import { rateLimits } from '../../middleware/security';
import { validate, zodFields } from '../../middleware/validate';
import { AppError, invalidState, notFound } from '../../lib/errors';
import { h, input, ok, withTransaction } from '../../lib/http';
import { notify, notifyAdmins } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel, ShortlistItemModel } from '../../models/campaign';
import { CreatorProfileModel, type CreatorProfileDoc } from '../../models/creatorProfile';
import { DealModel, OfferModel } from '../../models/deal';
import { UserModel } from '../../models/user';
import { recordConsents } from '../auth/auth.routes';
import { creatorSelfView, offerCreatorView, opportunityView } from '../serializers';

export const creatorsRouter = Router();
creatorsRouter.use(['/creators', '/opportunities', '/offers'], authenticate('app'), authorize('creator'), rateLimits.authed);

/** The signed-in creator's own profile. Ownership comes from the token, never from the URL. */
async function ownProfile(req: Request): Promise<CreatorProfileDoc> {
  const p = await CreatorProfileModel.findOne({ userId: req.auth!.id });
  if (!p) throw notFound();
  return p;
}

const EDITABLE: readonly string[] = ['DRAFT', 'CHANGES_REQUESTED'];

creatorsRouter.get('/creators/me', h(async (req, res) => {
  ok(res, creatorSelfView((await ownProfile(req)).toObject()));
}));

creatorsRouter.put('/creators/me/onboarding/:step',
  validate({ params: z.object({ step: z.enum(['1', '2', '3', '4']) }) }),
  h(async (req, res) => {
    const step = Number(input<{ step: string }>(req, 'params').step) as 1 | 2 | 3 | 4;
    const parsed = CREATOR_STEP_SCHEMAS[step].safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', zodFields(parsed.error));
    const p = await ownProfile(req);
    if (!EDITABLE.includes(p.status)) throw invalidState();

    if (step === 1) {
      const d = parsed.data as CreatorStep1;
      Object.assign(p, {
        fullName: d.fullName, displayName: d.displayName, phone: d.phone, city: d.city, languages: d.languages,
        gender: d.gender, ageGroup: d.ageGroup, bio: d.bio,
      });
      p.set('instagram.handle', d.igHandle);
      await recordConsents(req, ['creator_agreement']);
    } else if (step === 2) {
      p.categories = (parsed.data as CreatorStep2).categories;
    } else if (step === 3) {
      p.set('reels', (parsed.data as CreatorStep3).reels.map((url) => ({ url, addedAt: new Date() })));
    } else {
      const d = parsed.data as CreatorStep4;
      p.set('instagram.followers', d.followers);
      p.set('instagram.avgViews', d.avgViews);
      p.set('instagram.engagementBps', Math.round(d.engagementRate * 100));
      p.set('instagram.followerBand', followerBand(d.followers));
      p.set('instagram.statsSource', 'manual');
      p.set('instagram.statsUpdatedAt', new Date());
      const rate: Record<string, number> = {};
      for (const [k, v] of Object.entries(d.rateCard)) if (v !== undefined) rate[k] = rupeesToPaise(v);
      p.set('rateCardPaise', rate);
      p.acceptsBarter = d.acceptsBarter;
    }
    p.onboardingStep = Math.min(5, Math.max(p.onboardingStep, step + 1));
    await p.save();
    ok(res, creatorSelfView(p.toObject()));
  }),
);

/** Submit for review. Re-validates EVERYTHING stored, regardless of which steps the client claims to have done. */
creatorsRouter.post('/creators/me/submit', h(async (req, res) => {
  const p = await ownProfile(req);
  if (!EDITABLE.includes(p.status)) throw invalidState();
  const rate: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.rateCardPaise ?? {})) if (typeof v === 'number') rate[k] = paiseToRupees(v);
  const candidate = {
    fullName: p.fullName, displayName: p.displayName, phone: p.phone, igHandle: p.instagram?.handle, city: p.city,
    languages: p.languages, gender: p.gender ?? undefined, ageGroup: p.ageGroup ?? undefined, bio: p.bio ?? undefined,
    categories: p.categories, reels: (p.reels ?? []).map((r) => r.url),
    followers: p.instagram?.followers, avgViews: p.instagram?.avgViews,
    engagementRate: p.instagram?.engagementBps != null ? p.instagram.engagementBps / 100 : undefined,
    rateCard: rate, acceptsBarter: p.acceptsBarter,
  };
  const parsed = creatorSubmitSchema.safeParse(candidate);
  const user = await UserModel.findById(req.auth!.id, { consents: 1 }).lean();
  const consented = ['terms', 'creator_agreement'].every((t) => user?.consents?.some((c) => c.type === t));
  if (!parsed.success || !consented) {
    throw new AppError('VALIDATION_ERROR', 'errors.profileIncomplete', parsed.success ? { consents: 'errors.consentRequired' } : zodFields(parsed.error));
  }
  applyTransition(p, creatorMachine, 'SUBMITTED', 'creator', req.auth!.id);
  p.submittedAt = new Date();
  await p.save();
  await notifyAdmins(['reviewer'], 'admin_creator_submitted', { name: p.displayName ?? '' }, `/creators/${p._id}`);
  ok(res, creatorSelfView(p.toObject()));
}));

/** A rejected creator may start again after the waiting period. */
creatorsRouter.post('/creators/me/reapply', h(async (req, res) => {
  const p = await ownProfile(req);
  if (p.status !== 'REJECTED' || (p.reapplyAfter && p.reapplyAfter.getTime() > Date.now())) throw invalidState();
  applyTransition(p, creatorMachine, 'DRAFT', 'creator', req.auth!.id);
  p.onboardingStep = 1;
  await p.save();
  ok(res, creatorSelfView(p.toObject()));
}));

/* ---------- opportunities ---------- */

const OPEN_CAMPAIGN = ['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING', 'ACTIVE'];

async function approvedProfile(req: Request) {
  const p = await ownProfile(req);
  if (p.status !== 'APPROVED') throw new AppError('FORBIDDEN', 'errors.notApprovedYet');
  return p;
}

creatorsRouter.get('/opportunities', h(async (req, res) => {
  const p = await approvedProfile(req);
  const campaigns = await CampaignModel.find({
    status: { $in: OPEN_CAMPAIGN },
    'filters.categories': { $in: p.categories },
    endDate: { $gte: new Date() },
  }).select('+interestedCreatorIds').sort({ _id: -1 }).limit(50).lean();
  const brands = await BrandProfileModel.find({ _id: { $in: campaigns.map((c) => c.brandId) } }, { companyName: 1 }).lean();
  const names = new Map(brands.map((b) => [String(b._id), b.companyName ?? null]));
  ok(res, campaigns.map((c) => opportunityView(
    c, names.get(String(c.brandId)) ?? null,
    (c.interestedCreatorIds ?? []).some((x) => String(x) === String(p._id)),
  )));
}));

creatorsRouter.post('/opportunities/:id/interest',
  validate({ params: z.object({ id: objectId }), body: z.object({ interested: z.boolean() }) }),
  h(async (req, res) => {
    const p = await approvedProfile(req);
    const { id } = input<{ id: string }>(req, 'params');
    const { interested } = input<{ interested: boolean }>(req);
    const update = interested ? { $addToSet: { interestedCreatorIds: p._id } } : { $pull: { interestedCreatorIds: p._id } };
    const r = await CampaignModel.updateOne({ _id: id, status: { $in: OPEN_CAMPAIGN }, 'filters.categories': { $in: p.categories } }, update);
    if (r.matchedCount === 0) throw notFound();
    ok(res, { interested });
  }),
);

/* ---------- offers ---------- */

async function ownOffer(req: Request) {
  const p = await ownProfile(req);
  const { id } = input<{ id: string }>(req, 'params');
  const offer = await OfferModel.findOne({ _id: id, creatorId: p._id }); // 404 if not theirs
  if (!offer) throw notFound();
  return { p, offer };
}

async function offerView(offerId: unknown) {
  const o = await OfferModel.findById(offerId).lean();
  if (!o) throw notFound();
  const c = await CampaignModel.findById(o.campaignId).lean();
  const b = c ? await BrandProfileModel.findById(c.brandId, { companyName: 1 }).lean() : null;
  return offerCreatorView(o, c, b?.companyName ?? null);
}

creatorsRouter.get('/offers', h(async (req, res) => {
  const p = await ownProfile(req);
  const offers = await OfferModel.find({ creatorId: p._id }).sort({ _id: -1 }).limit(50).lean();
  const campaigns = await CampaignModel.find({ _id: { $in: offers.map((o) => o.campaignId) } }).lean();
  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));
  const brands = await BrandProfileModel.find({ _id: { $in: campaigns.map((c) => c.brandId) } }, { companyName: 1 }).lean();
  const bMap = new Map(brands.map((b) => [String(b._id), b.companyName ?? null]));
  ok(res, offers.map((o) => {
    const c = cMap.get(String(o.campaignId)) ?? null;
    return offerCreatorView(o, c, c ? bMap.get(String(c.brandId)) ?? null : null);
  }));
}));

creatorsRouter.get('/offers/:id', validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  const { offer } = await ownOffer(req);
  ok(res, await offerView(offer._id));
}));

creatorsRouter.post('/offers/:id/accept', validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  const { p, offer } = await ownOffer(req);
  if (p.status !== 'APPROVED') throw new AppError('FORBIDDEN', 'errors.notApprovedYet');
  if (offer.status !== 'SENT' || offer.expiresAt.getTime() <= Date.now()) throw invalidState();

  await withTransaction(async (session) => {
    const o = await OfferModel.findOne({ _id: offer._id, status: 'SENT' }).session(session);
    if (!o) throw invalidState();
    const item = await ShortlistItemModel.findById(o.shortlistItemId).session(session);
    const campaign = await CampaignModel.findById(o.campaignId).session(session);
    if (!item || !campaign) throw notFound();
    applyTransition(o, offerMachine, 'ACCEPTED', 'creator', req.auth!.id);
    await o.save({ session });
    await DealModel.create([{
      type: 'BRAND', campaignId: campaign._id, brandId: campaign.brandId, creatorId: p._id, offerId: o._id,
      brandPricePaise: item.brandPricePaise, creatorPayoutPaise: item.creatorPayoutPaise,
      marginPaise: item.brandPricePaise - item.creatorPayoutPaise,
      deliverables: o.deliverables, deadlines: o.deadlines, maxRevisions: campaign.maxRevisions,
      status: 'AWAITING_PAYMENT',
      statusHistory: [{ to: 'AWAITING_PAYMENT', by: req.auth!.id, at: new Date() }],
    }], { session });
    if (campaign.status === 'CREATORS_SELECTED' || campaign.status === 'SHORTLIST_SENT') {
      applyTransition(campaign, campaignMachine, 'PAYMENT_PENDING', 'system');
      await campaign.save({ session });
    }
    const brand = await BrandProfileModel.findById(campaign.brandId, { userId: 1 }).session(session).lean();
    if (brand) await notify(brand.userId, 'brand_offer_accepted', { creator: p.displayName ?? '', campaign: campaign.title ?? '' }, `/brand/campaigns/${campaign._id}`, session);
    await notifyAdmins(['campaign_manager'], 'admin_offer_accepted', { creator: p.displayName ?? '', campaign: campaign.title ?? '' }, `/campaigns/${campaign._id}`, session);
  });
  ok(res, await offerView(offer._id));
}));

creatorsRouter.post('/offers/:id/decline',
  validate({ params: z.object({ id: objectId }), body: offerDeclineSchema }),
  h(async (req, res) => {
    const { p, offer } = await ownOffer(req);
    if (offer.status !== 'SENT' || offer.expiresAt.getTime() <= Date.now()) throw invalidState();
    const body = input<{ reason: 'busy' | 'budget_low' | 'category_mismatch' | 'other'; note?: string }>(req);
    applyTransition(offer, offerMachine, 'DECLINED', 'creator', req.auth!.id, body.reason);
    offer.decline = { reason: body.reason, note: body.note };
    await offer.save();
    const campaign = await CampaignModel.findById(offer.campaignId, { title: 1 }).lean();
    await notifyAdmins(['campaign_manager'], 'admin_offer_declined', { creator: p.displayName ?? '', campaign: campaign?.title ?? '' }, `/campaigns/${offer.campaignId}`);
    ok(res, await offerView(offer._id));
  }),
);
