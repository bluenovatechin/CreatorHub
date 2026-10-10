/**
 * CONTACT (public website): POST /api/v1/contact { name, email, phone?, topic, message, website? }
 * Anyone may send; at most 5 per hour per network. "website" is a hidden trap field: when a bot fills it, we reply
 * as if it worked but save nothing. The team sees enquiries in the admin Inbox (modules/admin/enquiries.routes.ts).
 */
import { Router } from 'express';
import { contactSchema, type ContactInput } from '@bluenova/shared';
import { rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { h, input, ok } from '../../lib/http';
import { notifyAdmins } from '../../lib/notify';
import { EnquiryModel } from '../../models/enquiry';

export const contactRouter = Router();

contactRouter.post('/', rateLimits.contact, validate({ body: contactSchema }), h(async (req, res) => {
  const d = input<ContactInput>(req);
  if (d.website) return ok(res, { sent: true }, 201); // spam bot: looks fine to it, nothing stored
  const e = await EnquiryModel.create({ name: d.name, email: d.email, phone: d.phone, topic: d.topic, message: d.message, ip: req.ip });
  await notifyAdmins(['reviewer', 'campaign_manager', 'finance'], 'admin_enquiry_received', { name: d.name }, `/inbox?tab=enquiries&e=${e._id}`);
  ok(res, { sent: true }, 201);
}));
