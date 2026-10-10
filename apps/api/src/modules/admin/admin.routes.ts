/**
 * ADMIN ROUTES (/api/v1/admin/*). Everything here needs an admin login (password + authenticator).
 * Each route also says which team role may use it (requireAdmin). Covers: dashboard counts, creator review,
 * brands, campaigns (claim, matches, shortlist), audit log. Also mounts admin payments, admin → users and
 * admin → my security (recovery codes, new authenticator phone).
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  CAMPAIGN_STATUSES, CREATOR_STATUSES, campaignMachine, creatorDecisionSchema, creatorMachine, matchScore, objectId,
  paginationQuery, rupeesToPaise, shortlistAddSchema, suggestBrandPrice,
  type CreatorDecisionInput, type DeliverableType,
} from '@bluenova/shared';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { AppError, invalidState, notFound } from '../../lib/errors';
import { cursorPage, h, input, ok, withTransaction } from '../../lib/http';
import { notify } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel, ShortlistItemModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, OfferModel } from '../../models/deal';
import { AuditLogModel, getSettings } from '../../models/system';
import { PaymentModel } from '../../models/payment';
import { ApplicationModel } from '../../models/application';
import { ConversationModel } from '../../models/conversation';
import { DisputeModel, ReportModel } from '../../models/trust';
import { EnquiryModel } from '../../models/enquiry';
import { UserModel } from '../../models/user';
import { env } from '../../config/env';
import { email } from '../../providers/email';
import { notificationsRouter } from '../deals/deals.routes';
import { adminPaymentsRouter } from '../payments/payments.routes';
import { adminApplicationsRouter } from './applications.routes';
import { adminDealsRouter } from './deals.routes';
import { adminMessagesRouter } from './messages.routes';
import { adminTrustRouter } from './trust.routes';
import { adminEmailsRouter } from './emails.routes';
import { adminEnquiriesRouter } from './enquiries.routes';
import { adminSecurityRouter } from './security.routes';
import { adminUsersRouter } from './users.routes';
import { meRouter } from '../auth/auth.routes';
import {
  brandAdminView, campaignAdminView, creatorAdminView, dealAdminView, offerAdminView, shortlistAdminView,
} from '../serializers';

export const adminRouter = Router();
adminRouter.use(authenticate('admin'), rateLimits.authed);
adminRouter.use('/me', meRouter);
adminRouter.use('/notifications', notificationsRouter);
adminRouter.use(adminPaymentsRouter);
adminRouter.use(adminUsersRouter); // /admin/users (super_admin only)
adminRouter.use(adminSecurityRouter); // /admin/security (every admin, own account)
adminRouter.use(adminDealsRouter); // /admin/deals (work review queue)
adminRouter.use(adminApplicationsRouter); // /admin/campaigns/:id/applications, /admin/applications/:id/decision
adminRouter.use(adminMessagesRouter); // /admin/conversations (team inbox)
adminRouter.use(adminTrustRouter); // /admin/disputes, /admin/reports, /admin/ratings
adminRouter.use(adminEmailsRouter); // /admin/emails (super_admin: email delivery log)
adminRouter.use(adminEnquiriesRouter); // /admin/enquiries (Contact page messages)

const idParams = validate({ params: z.object({ id: objectId }) });

/* ---------- dashboard ---------- */

adminRouter.get('/dashboard', h(async (_req, res) => {
  const [pendingCreators, underReview, campaignsToReview, campaignsInReview, offersSent, awaitingPayment, approvedCreators, paymentsToVerify] = await Promise.all([
    CreatorProfileModel.countDocuments({ status: 'SUBMITTED' }),
    CreatorProfileModel.countDocuments({ status: 'UNDER_REVIEW' }),
    CampaignModel.countDocuments({ status: 'SUBMITTED' }),
    CampaignModel.countDocuments({ status: 'IN_REVIEW' }),
    OfferModel.countDocuments({ status: 'SENT', expiresAt: { $gt: new Date() } }),
    DealModel.countDocuments({ status: 'AWAITING_PAYMENT' }),
    CreatorProfileModel.countDocuments({ status: 'APPROVED' }),
    PaymentModel.countDocuments({ status: 'SUBMITTED' }),
  ]);
  // Queues added in phases 7–10: work waiting for review, new applications, unread messages, open disputes and reports.
  const [workToReview, applicationsWaiting, messagesWaiting, openDisputes, openReports, openEnquiries, overdueWork] = await Promise.all([
    DealModel.countDocuments({ status: { $in: ['DRAFT_SUBMITTED', 'LIVE_SUBMITTED'] } }),
    ApplicationModel.countDocuments({ status: 'SUBMITTED' }),
    ConversationModel.countDocuments({ unreadByTeam: { $gt: 0 } }),
    DisputeModel.countDocuments({ status: 'OPEN' }),
    ReportModel.countDocuments({ status: 'OPEN' }),
    EnquiryModel.countDocuments({ status: 'OPEN' }),
    DealModel.countDocuments({ $or: [
      { status: { $in: ['IN_PRODUCTION', 'REVISION_REQUESTED'] }, 'deadlines.draftDue': { $lt: new Date() } },
      { status: 'APPROVED', 'deadlines.liveDue': { $lt: new Date() } },
    ] }),
  ]);
  const { paymentsEnabled } = await getSettings();
  ok(res, {
    pendingCreators, underReview, campaignsToReview, campaignsInReview, offersSent, awaitingPayment, approvedCreators, paymentsToVerify,
    workToReview, applicationsWaiting, messagesWaiting, openDisputes, openReports, openEnquiries, overdueWork, paymentsEnabled,
  });
}));

/* ---------- creators ---------- */

const creatorRoles = requireAdmin('reviewer', 'campaign_manager');

adminRouter.get('/creators', creatorRoles,
  validate({ query: paginationQuery.extend({ status: z.enum(CREATOR_STATUSES).optional(), q: z.string().trim().max(60).optional() }) }),
  h(async (req, res) => {
    const { status, q, cursor, limit } = input<{ status?: string; q?: string; cursor?: string; limit: number }>(req, 'query');
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // escaped: no regex injection
      filter.$or = [{ displayName: rx }, { fullName: rx }, { 'instagram.handle': rx }];
    }
    if (cursor) filter._id = { $lt: cursor };
    const items = await CreatorProfileModel.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const { page, nextCursor } = cursorPage(items, limit);
    ok(res, page.map((p) => creatorAdminView(p)), 200, { nextCursor });
  }),
);

adminRouter.get('/creators/:id', creatorRoles, idParams, h(async (req, res) => {
  const p = await CreatorProfileModel.findById(input<{ id: string }>(req, 'params').id).select('+internalTags +internalNotes').lean();
  if (!p) throw notFound();
  const user = await UserModel.findById(p.userId, { email: 1 }).lean();
  const deals = await DealModel.find({ creatorId: p._id }).sort({ _id: -1 }).limit(20).lean();
  ok(res, { ...creatorAdminView(p, user), deals: deals.map(dealAdminView) });
}));

adminRouter.post('/creators/:id/claim', requireAdmin('reviewer'), idParams, h(async (req, res) => {
  const p = await CreatorProfileModel.findById(input<{ id: string }>(req, 'params').id);
  if (!p) throw notFound();
  applyTransition(p, creatorMachine, 'UNDER_REVIEW', req.auth!.adminRole!, req.auth!.id);
  p.set('review.claimedBy', req.auth!.id);
  await p.save();
  await audit(req, 'creator.claim', 'CreatorProfile', p._id);
  ok(res, creatorAdminView(p.toObject()));
}));

adminRouter.post('/creators/:id/decision', requireAdmin('reviewer'), validate({ params: z.object({ id: objectId }), body: creatorDecisionSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const d = input<CreatorDecisionInput>(req);
  const settings = await getSettings();

  const result = await withTransaction(async (session) => {
    const p = await CreatorProfileModel.findById(id).session(session);
    if (!p) throw notFound();
    applyTransition(p, creatorMachine, d.decision, req.auth!.adminRole!, req.auth!.id, d.reasonText);
    p.set('review.scores', d.scores);
    p.set('review.reasonCode', d.reasonCode);
    p.set('review.reasonText', d.reasonText);
    p.set('review.reviewedBy', req.auth!.id);
    p.set('review.reviewedAt', new Date());
    if (d.decision === 'APPROVED') {
      p.isPartner = true;
      p.partnerSince = new Date();
      if (!p.introReelDealId) {
        const [deal] = await DealModel.create([{
          type: 'INTRO_REEL', creatorId: p._id, status: 'IN_PRODUCTION',
          deliverables: [{ type: 'REEL', quantity: 1 }],
          deadlines: { draftDue: new Date(Date.now() + 7 * 86_400_000), liveDue: new Date(Date.now() + 14 * 86_400_000) },
          statusHistory: [{ to: 'IN_PRODUCTION', by: req.auth!.id, at: new Date() }],
        }], { session });
        p.introReelDealId = deal._id;
      }
    }
    if (d.decision === 'REJECTED') p.reapplyAfter = new Date(Date.now() + settings.reapplyAfterDays * 86_400_000);
    await p.save({ session });
    const type = { APPROVED: 'creator_approved', CHANGES_REQUESTED: 'creator_changes_requested', REJECTED: 'creator_rejected' }[d.decision];
    await notify(p.userId, type, {}, d.decision === 'APPROVED' ? '/creator/dashboard' : '/creator/status', session);
    await audit(req, `creator.${d.decision.toLowerCase()}`, 'CreatorProfile', p._id, { changes: { scores: d.scores, reasonCode: d.reasonCode }, reason: d.reasonText }, session);
    return p;
  });
  ok(res, creatorAdminView(result.toObject()));
}));

/* ---------- brands ---------- */

adminRouter.get('/brands', requireAdmin('campaign_manager'), validate({ query: paginationQuery }), h(async (req, res) => {
  const { cursor, limit } = input<{ cursor?: string; limit: number }>(req, 'query');
  const items = await BrandProfileModel.find(cursor ? { _id: { $lt: cursor } } : {}).sort({ _id: -1 }).limit(limit + 1).lean();
  const { page, nextCursor } = cursorPage(items, limit);
  ok(res, page.map((b) => brandAdminView(b)), 200, { nextCursor });
}));

/* ---------- campaigns ---------- */

const cm = requireAdmin('campaign_manager');

adminRouter.get('/campaigns', cm,
  validate({ query: paginationQuery.extend({ status: z.enum(CAMPAIGN_STATUSES).optional() }) }),
  h(async (req, res) => {
    const { status, cursor, limit } = input<{ status?: string; cursor?: string; limit: number }>(req, 'query');
    const filter: Record<string, unknown> = status ? { status } : { status: { $ne: 'DRAFT' } };
    if (cursor) filter._id = { $lt: cursor };
    const items = await CampaignModel.find(filter).select('+interestedCreatorIds').sort({ _id: -1 }).limit(limit + 1).lean();
    const { page, nextCursor } = cursorPage(items, limit);
    const brands = await BrandProfileModel.find({ _id: { $in: page.map((c) => c.brandId) } }, { companyName: 1 }).lean();
    const names = new Map(brands.map((b) => [String(b._id), b.companyName ?? null]));
    ok(res, page.map((c) => ({ ...campaignAdminView(c), companyName: names.get(String(c.brandId)) ?? null })), 200, { nextCursor });
  }),
);

adminRouter.get('/campaigns/:id', cm, idParams, h(async (req, res) => {
  const c = await CampaignModel.findById(input<{ id: string }>(req, 'params').id).select('+interestedCreatorIds').lean();
  if (!c || c.status === 'DRAFT') throw notFound();
  const brand = await BrandProfileModel.findById(c.brandId).lean();
  const brandUser = brand ? await UserModel.findById(brand.userId, { email: 1 }).lean() : null;
  const items = await ShortlistItemModel.find({ campaignId: c._id }).lean();
  const creators = await CreatorProfileModel.find({ _id: { $in: items.map((i) => i.creatorId) } }).lean();
  const crMap = new Map(creators.map((x) => [String(x._id), x]));
  const offers = await OfferModel.find({ campaignId: c._id }).lean();
  const deals = await DealModel.find({ campaignId: c._id }).select('+marginPaise').lean();
  ok(res, {
    ...campaignAdminView(c),
    brand: brand ? brandAdminView(brand, brandUser) : null,
    shortlist: items.map((i) => shortlistAdminView(i, crMap.get(String(i.creatorId)) ?? null)),
    offers: offers.map(offerAdminView),
    deals: deals.map(dealAdminView),
  });
}));

adminRouter.post('/campaigns/:id/claim', cm, idParams, h(async (req, res) => {
  const c = await CampaignModel.findById(input<{ id: string }>(req, 'params').id);
  if (!c) throw notFound();
  applyTransition(c, campaignMachine, 'IN_REVIEW', req.auth!.adminRole!, req.auth!.id);
  c.assignedManagerId = req.auth!.id as never;
  await c.save();
  await audit(req, 'campaign.claim', 'Campaign', c._id);
  ok(res, campaignAdminView(c.toObject()));
}));

/** Ranked creators for a campaign with the score breakdown (spec §12). */
adminRouter.get('/campaigns/:id/matches', cm, idParams, h(async (req, res) => {
  const c = await CampaignModel.findById(input<{ id: string }>(req, 'params').id).lean();
  if (!c || c.status === 'DRAFT') throw notFound();
  const already = await ShortlistItemModel.find({ campaignId: c._id }, { creatorId: 1 }).lean();
  const exclude = already.map((i) => i.creatorId);
  const categories = c.filters?.categories ?? [];
  const creators = await CreatorProfileModel.find({
    status: 'APPROVED', 'availability.open': { $ne: false }, _id: { $nin: exclude },
    ...(categories.length ? { categories: { $in: categories } } : {}),
  }).limit(300).lean();
  const mainDeliverable = c.deliverables?.[0]?.type as DeliverableType | undefined;
  const budgetPerCreatorPaise = c.budget?.maxPaise && c.creatorsNeeded ? Math.floor(c.budget.maxPaise / c.creatorsNeeded) : undefined;
  const ranked = creators.map((cr) => ({
    creator: creatorAdminView(cr),
    score: matchScore({
      categories: cr.categories ?? [], city: cr.city ?? '', areas: cr.areas ?? [], languages: cr.languages ?? [],
      followerBand: (cr.instagram?.followerBand ?? 'NANO') as never,
      rateCardPaise: (cr.rateCardPaise ?? {}) as never, creatorScore: cr.creatorScore,
    }, {
      categories, cities: c.filters?.cities ?? [], languages: c.filters?.languages ?? [],
      followerBands: c.filters?.followerBands ?? [], mainDeliverable, budgetPerCreatorPaise,
    }),
  })).sort((a, b) => b.score.total - a.score.total).slice(0, 50);
  ok(res, ranked);
}));

const SHORTLIST_OPEN = ['IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING'];

adminRouter.post('/campaigns/:id/shortlist', cm, validate({ params: z.object({ id: objectId }), body: shortlistAddSchema }), h(async (req, res) => {
  const c = await CampaignModel.findById(input<{ id: string }>(req, 'params').id).lean();
  if (!c) throw notFound();
  if (!SHORTLIST_OPEN.includes(c.status)) throw invalidState();
  const { items } = input<z.infer<typeof shortlistAddSchema>>(req);
  const settings = await getSettings();
  const creators = await CreatorProfileModel.find({ _id: { $in: items.map((i) => i.creatorId) }, status: 'APPROVED' }).lean();
  if (creators.length !== new Set(items.map((i) => i.creatorId)).size) throw new AppError('VALIDATION_ERROR', 'errors.creatorNotApproved');
  const created = [];
  for (const i of items) {
    const payout = rupeesToPaise(i.creatorPayout);
    const price = i.brandPrice !== undefined ? rupeesToPaise(i.brandPrice) : suggestBrandPrice(payout, settings.defaultMarginBps);
    const doc = await ShortlistItemModel.create({
      campaignId: c._id, creatorId: i.creatorId, creatorPayoutPaise: payout, brandPricePaise: price,
      adminNote: i.note, proposedBy: req.auth!.id,
    });
    created.push(doc);
    await audit(req, 'shortlist.add', 'ShortlistItem', doc._id, { changes: { campaignId: String(c._id), creatorId: i.creatorId, payout, price } });
  }
  const crMap = new Map(creators.map((x) => [String(x._id), x]));
  ok(res, created.map((d) => shortlistAdminView(d.toObject(), crMap.get(String(d.creatorId)) ?? null)), 201);
}));

adminRouter.post('/shortlist-items/:id/withdraw', cm, idParams, h(async (req, res) => {
  const item = await ShortlistItemModel.findOneAndUpdate(
    { _id: input<{ id: string }>(req, 'params').id, status: 'PROPOSED' }, { $set: { status: 'WITHDRAWN' } }, { new: true },
  ).lean();
  if (!item) throw invalidState();
  await audit(req, 'shortlist.withdraw', 'ShortlistItem', item._id);
  ok(res, shortlistAdminView(item, null));
}));

adminRouter.post('/campaigns/:id/shortlist/send', cm, idParams, h(async (req, res) => {
  const c = await CampaignModel.findById(input<{ id: string }>(req, 'params').id);
  if (!c) throw notFound();
  const proposed = await ShortlistItemModel.countDocuments({ campaignId: c._id, status: 'PROPOSED' });
  if (proposed === 0) throw new AppError('VALIDATION_ERROR', 'errors.shortlistEmpty');
  applyTransition(c, campaignMachine, 'SHORTLIST_SENT', req.auth!.adminRole!, req.auth!.id);
  await c.save();
  const brand = await BrandProfileModel.findById(c.brandId, { userId: 1 }).lean();
  if (brand) await notify(brand.userId, 'brand_shortlist_ready', { campaign: c.title ?? '' }, `/brand/campaigns/${c._id}`);
  await audit(req, 'shortlist.send', 'Campaign', c._id, { changes: { proposed } });
  ok(res, campaignAdminView(c.toObject()));
}));

/* ---------- audit log (read-only) ---------- */

adminRouter.get('/audit-logs', requireAdmin('super_admin'), validate({ query: paginationQuery }), h(async (req, res) => {
  const { cursor, limit } = input<{ cursor?: string; limit: number }>(req, 'query');
  const items = await AuditLogModel.find(cursor ? { _id: { $lt: cursor } } : {}).sort({ _id: -1 }).limit(limit + 1).lean();
  const { page, nextCursor } = cursorPage(items, limit);
  const actors = await UserModel.find({ _id: { $in: page.map((a) => a.actorId) } }, { name: 1 }).lean();
  const names = new Map(actors.map((a) => [String(a._id), a.name ?? null]));
  ok(res, page.map((a) => ({
    id: String(a._id), actorId: a.actorId ? String(a.actorId) : null, actorName: a.actorId ? names.get(String(a.actorId)) ?? null : null,
    adminRole: a.adminRole ?? null, action: a.action, entityType: a.entityType, entityId: a.entityId ? String(a.entityId) : null,
    changes: a.changes ?? null, reason: a.reason ?? null, ip: a.ip ?? null, createdAt: a.createdAt,
  })), 200, { nextCursor });
}));

/* ---------- email check (super admin) ---------- */

/**
 * POST /admin/settings/test-email: sends ONE email to the logged-in super admin, from THIS server, and waits
 * for the answer (normal emails are sent in the background, so their errors only appear in the server log).
 * Shows the exact reason when sending fails (e.g. Brevo "unrecognised IP address", unverified sender,
 * or SMTP blocked on Render's free plan). Used by admin Settings → "Email delivery".
 */
adminRouter.post('/settings/test-email', requireAdmin('super_admin'), h(async (req, res) => {
  const me = await UserModel.findById(req.auth!.id, { email: 1 }).lean();
  if (!me) throw notFound();
  const setup = { provider: env.EMAIL_PROVIDER, from: env.EMAIL_FROM, testMode: env.TEST_MODE, to: me.email };
  let reason: string | null = null;
  try {
    await email.send({
      to: me.email,
      subject: 'Bluenova test email (from the live server)',
      text: `This test email was sent by the Bluenova API.
Email mode: ${env.EMAIL_PROVIDER}

If you can read this, signup codes and password emails will be delivered too.`,
    });
  } catch (err) {
    reason = err instanceof Error ? err.message : String(err);
  }
  await audit(req, 'settings.test_email', 'Settings', undefined, { changes: { provider: env.EMAIL_PROVIDER, sent: !reason } });
  ok(res, { sent: !reason, reason, ...setup });
}));
