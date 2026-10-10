/**
 * ADMIN → APPLICATIONS: creators who applied to a campaign. Campaign managers review them.
 * Mounted at /api/v1/admin by admin.routes.ts (admin login already required).
 *
 *   GET  /admin/campaigns/:id/applications    every application for one campaign, with the creator's card
 *   POST /admin/applications/:id/decision     { decision: SHORTLIST, creatorPayout, brandPrice?, note? }
 *                                             → the creator is added to the brand's shortlist (same rules as adding by hand)
 *                                             { decision: DECLINE, note? } → closed; the creator sees the note
 *
 * Brands never see applications; they only see the shortlist. Every decision is audited and the creator notified.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  applicationDecisionSchema, applicationMachine, objectId, rupeesToPaise, suggestBrandPrice, type ApplicationDecisionInput,
} from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { AppError, invalidState, notFound } from '../../lib/errors';
import { h, input, ok, withTransaction } from '../../lib/http';
import { notify } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { ApplicationModel } from '../../models/application';
import { CampaignModel, ShortlistItemModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { getSettings } from '../../models/system';
import { applicationAdminView } from '../serializers';

export const adminApplicationsRouter = Router();
const cm = requireAdmin('campaign_manager');
const SHORTLIST_OPEN = ['IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING'];

adminApplicationsRouter.get('/campaigns/:id/applications', cm, validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  if (!(await CampaignModel.exists({ _id: id }))) throw notFound();
  const list = await ApplicationModel.find({ campaignId: id }).sort({ _id: -1 }).limit(200).lean();
  const creators = await CreatorProfileModel.find({ _id: { $in: list.map((a) => a.creatorId) } }).lean();
  const map = new Map(creators.map((c) => [String(c._id), c]));
  ok(res, list.map((a) => applicationAdminView(a, map.get(String(a.creatorId)) ?? null)));
}));

adminApplicationsRouter.post('/applications/:id/decision', cm,
  validate({ params: z.object({ id: objectId }), body: applicationDecisionSchema }),
  h(async (req, res) => {
    const { id } = input<{ id: string }>(req, 'params');
    const d = input<ApplicationDecisionInput>(req);
    const settings = await getSettings();
    const result = await withTransaction(async (session) => {
      const a = await ApplicationModel.findById(id).session(session);
      if (!a) throw notFound();
      const creator = await CreatorProfileModel.findById(a.creatorId, { userId: 1, status: 1 }).session(session).lean();
      const campaign = await CampaignModel.findById(a.campaignId, { title: 1, status: 1 }).session(session).lean();
      if (!creator || !campaign) throw notFound();

      if (d.decision === 'SHORTLIST') {
        if (!SHORTLIST_OPEN.includes(campaign.status)) throw invalidState();
        if (creator.status !== 'APPROVED') throw new AppError('VALIDATION_ERROR', 'errors.creatorNotApproved');
        if (await ShortlistItemModel.exists({ campaignId: campaign._id, creatorId: creator._id }).session(session)) {
          throw new AppError('CONFLICT', 'errors.alreadyShortlisted');
        }
        applyTransition(a, applicationMachine, 'SHORTLISTED', req.auth!.adminRole!, req.auth!.id);
        const payout = rupeesToPaise(d.creatorPayout);
        const price = d.brandPrice !== undefined ? rupeesToPaise(d.brandPrice) : suggestBrandPrice(payout, settings.defaultMarginBps);
        const [item] = await ShortlistItemModel.create([{
          campaignId: campaign._id, creatorId: creator._id, creatorPayoutPaise: payout, brandPricePaise: price,
          adminNote: d.note, proposedBy: req.auth!.id,
        }], { session });
        a.shortlistItemId = item._id;
      } else {
        applyTransition(a, applicationMachine, 'DECLINED', req.auth!.adminRole!, req.auth!.id, d.note);
        a.decisionNote = d.note;
      }
      a.reviewedBy = req.auth!.id as never;
      a.reviewedAt = new Date();
      await a.save({ session });
      await notify(creator.userId, d.decision === 'SHORTLIST' ? 'creator_application_shortlisted' : 'creator_application_declined',
        { campaign: campaign.title ?? '' }, '/creator/opportunities', session);
      await audit(req, `application.${d.decision.toLowerCase()}`, 'Application', a._id, { changes: { campaignId: String(campaign._id) }, reason: d.note }, session);
      return a;
    });
    const creator = await CreatorProfileModel.findById(result.creatorId).lean();
    ok(res, applicationAdminView(result.toObject(), creator));
  }),
);
