/**
 * ADMIN → WEBSITE ENQUIRIES (reviewers, campaign managers, finance): messages from the public Contact page.
 *   GET  /admin/enquiries?status=OPEN|HANDLED   newest first (listing personal data is audited)
 *   POST /admin/enquiries/:id/handled           mark as handled (after replying by email or phone)
 */
import { Router } from 'express';
import { z } from 'zod';
import { objectId } from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit, auditView } from '../../lib/audit';
import { invalidState } from '../../lib/errors';
import { h, input, ok } from '../../lib/http';
import { EnquiryModel } from '../../models/enquiry';

export const adminEnquiriesRouter = Router();
adminEnquiriesRouter.use('/enquiries', requireAdmin('reviewer', 'campaign_manager', 'finance'));

adminEnquiriesRouter.get('/enquiries', validate({ query: z.object({ status: z.enum(['OPEN', 'HANDLED']).default('OPEN') }) }), h(async (req, res) => {
  const { status } = input<{ status: string }>(req, 'query');
  const list = await EnquiryModel.find({ status }).sort({ _id: -1 }).limit(100).lean();
  await auditView(req, 'enquiry.list', 'Enquiry', undefined);
  ok(res, list.map((e) => ({
    id: String(e._id), name: e.name, email: e.email, phone: e.phone ?? null, topic: e.topic, message: e.message,
    status: e.status, createdAt: e.createdAt, handledAt: e.handledAt ?? null,
  })));
}));

adminEnquiriesRouter.post('/enquiries/:id/handled', validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const r = await EnquiryModel.updateOne({ _id: id, status: 'OPEN' }, { $set: { status: 'HANDLED', handledBy: req.auth!.id, handledAt: new Date() } });
  if (r.modifiedCount !== 1) throw invalidState();
  await audit(req, 'enquiry.handled', 'Enquiry', id);
  ok(res, { handled: true });
}));
