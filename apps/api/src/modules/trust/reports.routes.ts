/**
 * REPORTS (website): a creator reports a campaign, or a brand reports a creator, to the Bluenova team.
 * Mounted at /api/v1/reports by app.ts (creator/brand login required).
 *   POST /reports  { targetType: CAMPAIGN | CREATOR, targetId, reason, details }
 * Only things the person actually deals with can be reported (otherwise 404), one open report per target,
 * at most 10 reports an hour. Logic: trust.service.ts.
 */
import { Router } from 'express';
import { reportCreateSchema } from '@bluenova/shared';
import { rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { h, input, ok } from '../../lib/http';
import { createReport } from './trust.service';

export const reportsRouter = Router();

reportsRouter.post('/', rateLimits.reports, validate({ body: reportCreateSchema }), h(async (req, res) => {
  const d = input<{ targetType: 'CAMPAIGN' | 'CREATOR'; targetId: string; reason: string; details: string }>(req);
  const report = await createReport(req.auth!.role as 'creator' | 'brand', req.auth!.id, d);
  ok(res, { id: String(report._id), status: report.status }, 201);
}));
