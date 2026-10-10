/**
 * BRAND ROUTES (website, signed-in brands only): company profile, campaigns (5-step wizard, submit, cancel),
 * shortlist (see the team's suggested creators, select some → offers are sent).
 * Ownership rule: a brand can only ever load its OWN campaigns; anything else is a 404.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  CAMPAIGN_STEP_SCHEMAS, brandOnboardingSchema, campaignMachine, campaignStep1Schema, istDateToUtc, objectId,
  paiseToRupees, reasonSchema, rupeesToPaise, shortlistSelectSchema, todayIST,
  type BrandOnboarding,
} from '@bluenova/shared';
import { authenticate, authorize } from '../../middleware/auth';
import { rateLimits } from '../../middleware/security';
import { idempotent } from '../../middleware/idempotency';
import { validate, zodFields } from '../../middleware/validate';
import { AppError, invalidState, notFound } from '../../lib/errors';
import { cursorPage, h, input, ok, withTransaction } from '../../lib/http';
import { notify, notifyAdmins } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { BrandProfileModel, type BrandProfileDoc } from '../../models/brandProfile';
import { CampaignModel, ShortlistItemModel, type CampaignDoc } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, OfferModel } from '../../models/deal';
import { getSettings } from '../../models/system';
import { UserModel } from '../../models/user';
import { recordConsents } from '../auth/auth.routes';
import { brandPaymentsRouter } from '../payments/payments.routes';
import { brandSelfView, campaignBrandView, shortlistBrandView } from '../serializers';

export const brandsRouter = Router();
brandsRouter.use(['/brands', '/campaigns'], authenticate('app'), authorize('brand'), rateLimits.authed);

async function ownBrand(req: Request): Promise<BrandProfileDoc> {
  const b = await BrandProfileModel.findOne({ userId: req.auth!.id });
  if (!b) throw notFound();
  return b;
}

async function activeBrand(req: Request) {
  const b = await ownBrand(req);
  if (b.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'errors.brandProfileIncomplete');
  return b;
}

/** Loads a campaign owned by the signed-in brand. Someone else's campaign is a 404. */
async function ownCampaign(req: Request): Promise<{ brand: BrandProfileDoc; campaign: CampaignDoc }> {
  const brand = await activeBrand(req);
  const { id } = input<{ id: string }>(req, 'params');
  const campaign = await CampaignModel.findOne({ _id: id, brandId: brand._id });
  if (!campaign) throw notFound();
  return { brand, campaign };
}

const idParams = validate({ params: z.object({ id: objectId }) });

/* ---------- profile ---------- */

async function accountEmail(req: Request) {
  return (await UserModel.findById(req.auth!.id, { email: 1 }).lean())?.email ?? null;
}

brandsRouter.get('/brands/me', h(async (req, res) => ok(res, brandSelfView((await ownBrand(req)).toObject(), await accountEmail(req)))));

brandsRouter.put('/brands/me', validate({ body: brandOnboardingSchema }), h(async (req, res) => {
  const b = await ownBrand(req);
  if (b.status === 'SUSPENDED') throw invalidState();
  const d = input<BrandOnboarding>(req);
  Object.assign(b, {
    companyName: d.companyName, contactName: d.contactName, designation: d.designation, phone: d.phone,
    gstin: d.gstin, industry: d.industry, city: d.city, areas: d.areas, website: d.website, billingAddress: d.billingAddress,
  });
  const firstTime = b.status === 'INCOMPLETE';
  if (firstTime) b.status = 'ACTIVE';
  await b.save();
  if (firstTime) await recordConsents(req, ['brand_agreement']);
  ok(res, brandSelfView(b.toObject(), await accountEmail(req)));
}));

/* ---------- campaigns ---------- */

/** Newest first. ?limit= (default 100) and ?cursor= (the meta.nextCursor of the previous page) for "Load more". */
brandsRouter.get('/campaigns', validate({ query: z.object({ cursor: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(100) }) }), h(async (req, res) => {
  const b = await activeBrand(req);
  const { cursor, limit } = input<{ cursor?: string; limit: number }>(req, 'query');
  const items = await CampaignModel.find({ brandId: b._id, ...(cursor ? { _id: { $lt: cursor } } : {}) }).sort({ _id: -1 }).limit(limit + 1).lean();
  const { page, nextCursor } = cursorPage(items, limit);
  ok(res, page.map(campaignBrandView), 200, { nextCursor });
}));

/**
 * POST /campaigns/:id/duplicate: a new DRAFT copied from one of the brand's own campaigns (any status).
 * Dates are left empty (the old ones are usually in the past), so the wizard opens at the timeline step.
 */
brandsRouter.post('/campaigns/:id/duplicate', idParams, h(async (req, res) => {
  const { brand, campaign: c } = await ownCampaign(req);
  const settings = await getSettings();
  const title = `${c.title ?? 'Campaign'} (copy)`.slice(0, 100);
  const copy = await CampaignModel.create({
    brandId: brand._id, title, goal: c.goal, description: c.description,
    filters: c.filters, deliverables: c.deliverables, creatorsNeeded: c.creatorsNeeded, collabType: c.collabType, product: c.product,
    guidelines: c.guidelines, budget: c.budget, usageRights: c.usageRights, maxRevisions: c.maxRevisions ?? settings.defaultMaxRevisions,
    wizardStep: 4, statusHistory: [{ to: 'DRAFT', by: req.auth!.id, at: new Date(), reason: `copied_from_${c._id}` }],
  });
  ok(res, campaignBrandView(copy.toObject()), 201);
}));

brandsRouter.post('/campaigns', validate({ body: campaignStep1Schema }), h(async (req, res) => {
  const b = await activeBrand(req);
  const d = input<z.infer<typeof campaignStep1Schema>>(req);
  const settings = await getSettings();
  const c = await CampaignModel.create({
    brandId: b._id, ...d, wizardStep: 2, maxRevisions: settings.defaultMaxRevisions,
    filters: { cities: b.areas ?? [] }, // start with the areas from the brand's profile (editable in step 2)
    statusHistory: [{ to: 'DRAFT', by: req.auth!.id, at: new Date() }],
  });
  ok(res, campaignBrandView(c.toObject()), 201);
}));

brandsRouter.get('/campaigns/:id', idParams, h(async (req, res) => {
  const { campaign } = await ownCampaign(req);
  ok(res, campaignBrandView(campaign.toObject()));
}));

function applyStep(c: CampaignDoc, step: number, data: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each case reads different, already validated fields
  const d = data as never as Record<string, any>; // validated by the step schema
  switch (step) {
    case 1:
      Object.assign(c, { title: d.title, goal: d.goal, description: d.description });
      break;
    case 2:
      c.set('filters', {
        categories: d.categories, cities: d.cities, languages: d.languages, followerBands: d.followerBands,
        genders: d.genders, ageGroups: d.ageGroups,
        minEngagementBps: d.minEngagementRate !== undefined ? Math.round(d.minEngagementRate * 100) : undefined,
      });
      break;
    case 3:
      c.set('deliverables', d.deliverables);
      c.creatorsNeeded = d.creatorsNeeded;
      c.collabType = d.collabType;
      c.set('product', d.product && d.collabType !== 'PAID'
        ? { name: d.product.name, valuePaise: rupeesToPaise(d.product.value), shippingRequired: d.product.shippingRequired }
        : undefined);
      break;
    case 4:
      c.startDate = istDateToUtc(d.startDate);
      c.endDate = istDateToUtc(d.endDate);
      c.set('guidelines', {
        dos: d.dos, donts: d.donts, referenceUrls: d.referenceUrls, hashtags: d.hashtags, mentions: d.mentions,
        disclosure: '#ad', // mandatory, never editable
      });
      c.maxRevisions = d.maxRevisions;
      break;
    case 5:
      c.set('budget', {
        suggest: d.budgetSuggest,
        minPaise: !d.budgetSuggest && d.budgetMin !== undefined ? rupeesToPaise(d.budgetMin) : undefined,
        maxPaise: !d.budgetSuggest && d.budgetMax !== undefined ? rupeesToPaise(d.budgetMax) : undefined,
      });
      c.set('usageRights', { isRequired: d.usageRightsRequired, durationDays: d.usageRightsRequired ? d.usageRightsDays : undefined });
      break;
  }
}

brandsRouter.put('/campaigns/:id/wizard/:step',
  validate({ params: z.object({ id: objectId, step: z.enum(['1', '2', '3', '4', '5']) }) }),
  h(async (req, res) => {
    const step = Number(input<{ step: string }>(req, 'params').step) as 1 | 2 | 3 | 4 | 5;
    const parsed = CAMPAIGN_STEP_SCHEMAS[step].safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', zodFields(parsed.error));
    const { campaign } = await ownCampaign(req);
    if (campaign.status !== 'DRAFT') throw invalidState();
    applyStep(campaign, step, parsed.data as Record<string, unknown>);
    campaign.wizardStep = Math.min(6, Math.max(campaign.wizardStep, step + 1));
    await campaign.save();
    ok(res, campaignBrandView(campaign.toObject()));
  }),
);

/** Rebuilds the wizard input from stored data so submit re-validates everything server-side. */
function storedSteps(c: CampaignDoc): Record<number, unknown> {
  return {
    1: { title: c.title, goal: c.goal, description: c.description },
    2: {
      categories: c.filters?.categories ?? [], cities: c.filters?.cities ?? [], languages: c.filters?.languages ?? [],
      followerBands: c.filters?.followerBands ?? [], genders: c.filters?.genders ?? [], ageGroups: c.filters?.ageGroups ?? [],
      minEngagementRate: c.filters?.minEngagementBps != null ? c.filters.minEngagementBps / 100 : undefined,
    },
    3: {
      deliverables: (c.deliverables ?? []).map((x) => ({ type: x.type, quantity: x.quantity })),
      creatorsNeeded: c.creatorsNeeded, collabType: c.collabType,
      product: c.product?.name ? { name: c.product.name, value: paiseToRupees(c.product.valuePaise ?? 0), shippingRequired: Boolean(c.product.shippingRequired) } : undefined,
    },
    4: {
      startDate: c.startDate ? todayIST(c.startDate) : undefined, endDate: c.endDate ? todayIST(c.endDate) : undefined,
      dos: c.guidelines?.dos ?? [], donts: c.guidelines?.donts ?? [], referenceUrls: c.guidelines?.referenceUrls ?? [],
      hashtags: c.guidelines?.hashtags ?? [], mentions: c.guidelines?.mentions ?? [], maxRevisions: c.maxRevisions,
    },
    5: {
      budgetSuggest: c.budget?.suggest ?? undefined,
      budgetMin: c.budget?.minPaise != null ? paiseToRupees(c.budget.minPaise) : undefined,
      budgetMax: c.budget?.maxPaise != null ? paiseToRupees(c.budget.maxPaise) : undefined,
      usageRightsRequired: c.usageRights?.isRequired ?? false,
      usageRightsDays: c.usageRights?.durationDays ?? undefined,
    },
  };
}

brandsRouter.post('/campaigns/:id/submit', idParams, h(async (req, res) => {
  const { campaign } = await ownCampaign(req);
  if (campaign.status !== 'DRAFT') throw invalidState();
  const stored = storedSteps(campaign);
  const fields: Record<string, string> = {};
  for (const step of [1, 2, 3, 4, 5] as const) {
    const r = CAMPAIGN_STEP_SCHEMAS[step].safeParse(stored[step]);
    if (!r.success) for (const [k, v] of Object.entries(zodFields(r.error))) fields[`step${step}.${k}`] = v;
  }
  if (Object.keys(fields).length) throw new AppError('VALIDATION_ERROR', 'errors.campaignIncomplete', fields);
  applyTransition(campaign, campaignMachine, 'SUBMITTED', 'brand', req.auth!.id);
  campaign.submittedAt = new Date();
  await campaign.save();
  await notifyAdmins(['campaign_manager'], 'admin_campaign_submitted', { campaign: campaign.title ?? '' }, `/campaigns/${campaign._id}`);
  ok(res, campaignBrandView(campaign.toObject()));
}));

brandsRouter.post('/campaigns/:id/cancel', validate({ params: z.object({ id: objectId }), body: reasonSchema }), h(async (req, res) => {
  const { campaign } = await ownCampaign(req);
  const { reason } = input<{ reason: string }>(req);
  await withTransaction(async (session) => {
    const c = await CampaignModel.findById(campaign._id).session(session);
    if (!c) throw notFound();
    applyTransition(c, campaignMachine, 'CANCELLED', 'brand', req.auth!.id, reason);
    await c.save({ session });
    await OfferModel.updateMany(
      { campaignId: c._id, status: { $in: ['SENT', 'COUNTERED'] } },
      { $set: { status: 'WITHDRAWN' }, $push: { statusHistory: { to: 'WITHDRAWN', by: req.auth!.id, reason: 'campaign_cancelled', at: new Date() } } },
      { session },
    );
    await DealModel.updateMany(
      { campaignId: c._id, status: 'AWAITING_PAYMENT' },
      { $set: { status: 'CANCELLED' }, $push: { statusHistory: { from: 'AWAITING_PAYMENT', to: 'CANCELLED', by: req.auth!.id, reason: 'campaign_cancelled', at: new Date() } } },
      { session },
    );
  });
  const fresh = await CampaignModel.findById(campaign._id).lean();
  ok(res, campaignBrandView(fresh!));
}));

/* ---------- shortlist ---------- */

brandsRouter.get('/campaigns/:id/shortlist', idParams, h(async (req, res) => {
  const { campaign } = await ownCampaign(req);
  const items = await ShortlistItemModel.find({ campaignId: campaign._id, status: { $in: ['PROPOSED', 'SELECTED', 'REJECTED_BY_BRAND'] } }).lean();
  // Brands only see the shortlist after Bluenova sends it.
  if (['DRAFT', 'SUBMITTED', 'IN_REVIEW'].includes(campaign.status)) return ok(res, []);
  const creators = await CreatorProfileModel.find({ _id: { $in: items.map((i) => i.creatorId) } }).lean();
  const map = new Map(creators.map((c) => [String(c._id), c]));
  ok(res, items.map((i) => shortlistBrandView(i, map.get(String(i.creatorId)) ?? null)));
}));

brandsRouter.post('/campaigns/:id/shortlist/select', idempotent,
  validate({ params: z.object({ id: objectId }), body: shortlistSelectSchema }),
  h(async (req, res) => {
    const { campaign } = await ownCampaign(req);
    const { itemIds } = input<{ itemIds: string[] }>(req);
    if (campaign.status !== 'SHORTLIST_SENT') throw invalidState();
    const settings = await getSettings();

    await withTransaction(async (session) => {
      const c = await CampaignModel.findById(campaign._id).session(session);
      if (!c || c.status !== 'SHORTLIST_SENT') throw invalidState();
      const items = await ShortlistItemModel.find({ _id: { $in: itemIds }, campaignId: c._id, status: 'PROPOSED' }).session(session);
      if (items.length !== itemIds.length) throw new AppError('VALIDATION_ERROR', 'errors.invalidShortlistSelection');
      const start = c.startDate ?? new Date();
      const end = c.endDate ?? new Date(start.getTime() + 14 * 86_400_000);
      const draftDue = new Date(Math.min(start.getTime() + 7 * 86_400_000, end.getTime()));
      const expiresAt = new Date(Date.now() + settings.offerExpiryHours * 3_600_000);
      for (const item of items) {
        item.status = 'SELECTED';
        await item.save({ session });
        const [offer] = await OfferModel.create([{
          campaignId: c._id, creatorId: item.creatorId, shortlistItemId: item._id, payoutPaise: item.creatorPayoutPaise,
          deliverables: c.deliverables, deadlines: { draftDue, liveDue: end },
          briefSnapshot: {
            title: c.title, description: c.description, dos: c.guidelines?.dos, donts: c.guidelines?.donts,
            referenceUrls: c.guidelines?.referenceUrls, hashtags: c.guidelines?.hashtags,
            mentions: c.guidelines?.mentions, disclosure: '#ad',
          },
          expiresAt, statusHistory: [{ to: 'SENT', by: req.auth!.id, at: new Date() }],
        }], { session });
        const creator = await CreatorProfileModel.findById(item.creatorId, { userId: 1 }).session(session).lean();
        if (creator) await notify(creator.userId, 'creator_new_offer', { campaign: c.title ?? '' }, `/creator/offers/${offer._id}`, session);
      }
      applyTransition(c, campaignMachine, 'CREATORS_SELECTED', 'brand', req.auth!.id);
      await c.save({ session });
      await notifyAdmins(['campaign_manager'], 'admin_creators_selected', { campaign: c.title ?? '', count: items.length }, `/campaigns/${c._id}`, session);
    });
    const fresh = await CampaignModel.findById(campaign._id).lean();
    ok(res, campaignBrandView(fresh!));
  }),
);

brandsRouter.use(brandPaymentsRouter);
