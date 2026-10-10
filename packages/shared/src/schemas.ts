/**
 * INPUT RULES (zod) for every form. The website uses them to show errors instantly; the API uses the SAME
 * rules to reject bad input. Error messages are translation keys like 'errors.passwordShort'.
 */
import { z } from 'zod';
import {
  AGE_GROUPS, CAMPAIGN_GOALS, COLLAB_TYPES, CREATOR_DECISIONS, DELIVERABLE_TYPES, DISPUTE_REASONS, FOLLOWER_BANDS,
  GENDERS, LANGUAGES, OFFER_DECLINE_REASONS, REPORT_REASONS, REVIEW_REASON_CODES, UI_LANGUAGES,
} from './enums';
import { CATEGORY_KEYS, CITY_KEYS, STATE_CODES } from './catalog';
import { todayIST } from './utils';
import {
  PAYMENT_REFERENCE_RULES, isDisposableEmail, isPlausibleMobile, isPlausibleName, isValidGstinChecksum,
  passwordProblem, pincodeMatchesState,
} from './validators';

/* ---------- building blocks ---------- */

// eslint-disable-next-line no-control-regex -- matching control characters is the point: they are rejected
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Plain text: trimmed, no control characters. Gujarati and emoji allowed. */
export const plainText = (min: number, max: number) =>
  z.string().trim().min(min, 'errors.tooShort').max(max, 'errors.tooLong')
    .refine((s) => !CONTROL_CHARS.test(s), 'errors.invalidChars');

const optionalText = (max: number) =>
  z.string().trim().max(max, 'errors.tooLong').refine((s) => !CONTROL_CHARS.test(s), 'errors.invalidChars')
    .optional().transform((v) => (v ? v : undefined));

/** Person names: letters (incl. Gujarati), marks, spaces, dots, apostrophes. No placeholders like "test". */
export const personName = (max = 60) =>
  plainText(2, max).transform((s) => s.replace(/\s+/g, ' '))
    .refine((s) => /^[\p{L}\p{M}\s.']+$/u.test(s), 'errors.nameChars')
    .refine(isPlausibleName, 'errors.nameFake');

/** Business / display names: letters, numbers and common punctuation, no placeholders. */
export const businessName = (min: number, max: number) =>
  plainText(min, max).transform((s) => s.replace(/\s+/g, ' '))
    .refine((s) => /^[\p{L}\p{M}\p{N}\s.&'()\-,/+@!]+$/u.test(s), 'errors.invalidChars')
    .refine(isPlausibleName, 'errors.nameFake');

export const emailSchema = z.string().trim().toLowerCase().max(254, 'errors.tooLong')
  .email('errors.email')
  .refine((e) => /\.[a-z]{2,}$/.test(e), 'errors.email')
  .refine((e) => !isDisposableEmail(e), 'errors.emailDisposable');

/** Indian mobile (WhatsApp) number for contact; dummy numbers are rejected. */
export const mobileSchema = z.string().trim().transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''))
  .refine((s) => /^[6-9]\d{9}$/.test(s), 'errors.phone')
  .refine(isPlausibleMobile, 'errors.phoneFake');

export const passwordSchema = z.string().min(1, 'errors.zod.invalid_type').max(128, 'errors.tooLong')
  .superRefine((p, ctx) => {
    const problem = passwordProblem(p);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'errors.invalidId');

export const totpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'errors.otp');

export const httpsUrl = z.string().trim().max(200, 'errors.tooLong').url('errors.url')
  .refine((u) => u.startsWith('https://'), 'errors.httpsOnly')
  .refine((u) => {
    try {
      const host = new URL(u).hostname;
      return host.includes('.') && !/^[\d.]+$/.test(host) && host !== 'localhost';
    } catch {
      return false;
    }
  }, 'errors.url');

export const instagramHandle = z.string().trim()
  .transform((s) => s.replace(/^@/, ''))
  .refine((s) => /^[A-Za-z0-9._]{1,30}$/.test(s) && !s.includes('..'), 'errors.igHandle');

const REEL_RE = /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;
export const instagramPostUrl = z.string().trim().max(300)
  .refine((u) => REEL_RE.test(u), 'errors.reelUrl')
  .transform((u) => u.split('?')[0].replace(/\/?$/, '/'));

/** Whole rupees from the UI; converted to paise on the server. */
export const rupees = (max = 10_00_000) => z.coerce.number().int('errors.wholeNumber').min(0).max(max);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'errors.date');

const uniqueArray = <T extends z.ZodTypeAny>(item: T, min: number, max: number) =>
  z.array(item).min(min, 'errors.selectAtLeast').max(max, 'errors.selectAtMost')
    .refine((a) => new Set(a).size === a.length, 'errors.duplicates');

/* ---------- auth (email + password) ---------- */

export const signupSchema = z.object({
  name: personName(60),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  // No role here on purpose: people choose "creator" or "brand" after their first login (POST /auth/role).
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'errors.consentRequired' }) }),
}).superRefine((v, ctx) => {
  if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'errors.passwordMismatch' });
  const problem = passwordProblem(v.password, { email: v.email, name: v.name });
  if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('errors.email'),
  password: z.string().min(1, 'errors.zod.invalid_type').max(128),
});

export const emailOnlySchema = z.object({ email: z.string().trim().toLowerCase().max(254).email('errors.email') });
export const tokenSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, 'errors.linkInvalid') });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, 'errors.linkInvalid'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'errors.passwordMismatch' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'errors.zod.invalid_type').max(128),
  password: passwordSchema,
  confirmPassword: z.string(),
}).superRefine((v, ctx) => {
  if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'errors.passwordMismatch' });
  if (v.password === v.currentPassword) ctx.addIssue({ code: 'custom', path: ['password'], message: 'errors.passwordSame' });
});

/* ---------- phone helpers ---------- */

export const roleSelectSchema = z.object({ role: z.enum(['creator', 'brand'], { errorMap: () => ({ message: 'errors.roleRequired' }) }) });
export const adminTotpSchema = z.object({ mfaToken: z.string().min(20).max(2000), code: totpCodeSchema });
export const adminLoginSchema = loginSchema;
/** A one-time recovery code (admins who lost their authenticator phone). Case, spaces and dashes are ignored. */
export const recoveryCodeSchema = z.string().trim().min(12, 'errors.invalidRecoveryCode').max(24, 'errors.invalidRecoveryCode');
export const adminRecoverySchema = z.object({ mfaToken: z.string().min(20).max(2000), code: recoveryCodeSchema });
/** Security changes on the admin's own account ask for the current password again. */
export const confirmPasswordSchema = z.object({ currentPassword: z.string().min(1, 'errors.zod.invalid_type').max(128) });
export const totpConfirmSchema = z.object({ code: totpCodeSchema });
/** Settings: language and whether important notifications are also emailed (at least one must be sent). */
export const preferencesSchema = z.object({
  preferredLanguage: z.enum(UI_LANGUAGES).optional(),
  emailNotifications: z.boolean().optional(),
}).refine((v) => v.preferredLanguage !== undefined || v.emailNotifications !== undefined, 'errors.VALIDATION_ERROR');

/* ---------- creator onboarding ---------- */

/** Areas a creator can make reels/stories in, or a brand wants promotions in (several cities; can be empty). */
export const areasSchema = uniqueArray(z.enum(CITY_KEYS), 0, 30).default([]);

export const creatorStep1ProfileSchema = z.object({
  fullName: personName(60),
  displayName: businessName(2, 40),
  phone: mobileSchema,
  igHandle: instagramHandle,
  city: z.enum(CITY_KEYS),
  areas: areasSchema,
  languages: uniqueArray(z.enum(LANGUAGES), 1, 3),
  gender: z.enum(GENDERS).optional(),
  ageGroup: z.enum(AGE_GROUPS).optional(),
  bio: optionalText(300),
});
export const creatorStep1Schema = creatorStep1ProfileSchema.extend({
  consents: z.object({
    creatorAgreement: z.literal(true, { errorMap: () => ({ message: 'errors.consentRequired' }) }),
  }),
});

export const creatorStep2Schema = z.object({
  categories: uniqueArray(z.enum(CATEGORY_KEYS), 1, 3),
});

export const creatorStep3Schema = z.object({
  reels: z.array(instagramPostUrl).min(2, 'errors.reelsMin').max(3, 'errors.reelsMax')
    .refine((a) => new Set(a).size === a.length, 'errors.duplicates'),
});

/** Price per format, whole rupees. Only the formats Bluenova offers (Reel, Story, Collab). */
export const rateCardSchema = z.object({
  REEL: rupees().optional(),
  STORY: rupees().optional(),
  COLLAB: rupees().optional(),
});

export const creatorStep4Schema = z.object({
  followers: z.coerce.number({ invalid_type_error: 'errors.wholeNumber' }).int('errors.wholeNumber').min(100, 'errors.followersMin').max(100_000_000, 'errors.followersMax'),
  avgViews: z.coerce.number({ invalid_type_error: 'errors.wholeNumber' }).int('errors.wholeNumber').min(0).max(1_000_000_000),
  engagementRate: z.coerce.number({ invalid_type_error: 'errors.number' }).min(0.01, 'errors.engagementRange').max(50, 'errors.engagementRange')
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, 'errors.decimals'),
  rateCard: rateCardSchema,
  acceptsBarter: z.boolean(),
}).superRefine((v, ctx) => {
  // Average views above 50x followers is not realistic for typical reels.
  if (v.avgViews > v.followers * 50) ctx.addIssue({ code: 'custom', path: ['avgViews'], message: 'errors.viewsUnrealistic' });
  const hasRate = Object.values(v.rateCard).some((r) => r !== undefined && r > 0);
  if (!hasRate && !v.acceptsBarter) ctx.addIssue({ code: 'custom', path: ['rateCard'], message: 'errors.rateRequired' });
});

/** Everything a creator must have before submitting for review (server re-validates stored data). */
export const creatorSubmitSchema = creatorStep1ProfileSchema
  .merge(creatorStep2Schema).merge(creatorStep3Schema).and(creatorStep4Schema);

export const CREATOR_STEP_SCHEMAS = {
  1: creatorStep1Schema,
  2: creatorStep2Schema,
  3: creatorStep3Schema,
  4: creatorStep4Schema,
} as const;

/* ---------- brand onboarding ---------- */

export const gstinSchema = z.string().trim().toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'errors.gstin')
  .refine(isValidGstinChecksum, 'errors.gstinChecksum');

export const brandProfileSchema = z.object({
  companyName: businessName(2, 100),
  contactName: personName(60),
  designation: optionalText(60),
  phone: mobileSchema,
  gstin: z.union([gstinSchema, z.literal('')]).optional().transform((v) => (v ? v : undefined)),
  industry: z.enum(CATEGORY_KEYS),
  city: z.enum(CITY_KEYS),
  areas: areasSchema,
  website: z.union([httpsUrl, z.literal('')]).optional().transform((v) => (v ? v : undefined)),
  billingAddress: z.object({
    line1: plainText(3, 120),
    line2: optionalText(120),
    city: plainText(2, 60),
    stateCode: z.enum(STATE_CODES),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'errors.pincode'),
  }),
}).superRefine((v, ctx) => {
  if (!pincodeMatchesState(v.billingAddress.pincode, v.billingAddress.stateCode)) {
    ctx.addIssue({ code: 'custom', path: ['billingAddress', 'pincode'], message: 'errors.pincodeState' });
  }
  if (v.gstin && v.gstin.slice(0, 2) !== v.billingAddress.stateCode) {
    ctx.addIssue({ code: 'custom', path: ['gstin'], message: 'errors.gstinState' });
  }
});
export const brandOnboardingSchema = brandProfileSchema.and(z.object({
  consents: z.object({
    brandAgreement: z.literal(true, { errorMap: () => ({ message: 'errors.consentRequired' }) }),
  }),
}));

/* ---------- campaign wizard ---------- */

export const campaignStep1Schema = z.object({
  title: plainText(3, 100),
  goal: z.enum(CAMPAIGN_GOALS),
  description: plainText(20, 2000),
});

export const campaignStep2Schema = z.object({
  categories: uniqueArray(z.enum(CATEGORY_KEYS), 1, 16),
  cities: uniqueArray(z.enum(CITY_KEYS), 0, 21),
  languages: uniqueArray(z.enum(LANGUAGES), 0, 3),
  followerBands: uniqueArray(z.enum(FOLLOWER_BANDS), 0, 5),
  genders: uniqueArray(z.enum(GENDERS), 0, 4),
  ageGroups: uniqueArray(z.enum(AGE_GROUPS), 0, 4),
  minEngagementRate: z.coerce.number().min(0).max(100).optional(),
});

export const campaignStep3Schema = z.object({
  deliverables: z.array(z.object({
    type: z.enum(DELIVERABLE_TYPES),
    quantity: z.coerce.number().int().min(1).max(10),
  })).min(1, 'errors.selectAtLeast').max(5),
  creatorsNeeded: z.coerce.number().int().min(1).max(50),
  collabType: z.enum(COLLAB_TYPES),
  product: z.object({
    name: plainText(2, 100),
    value: rupees(10_00_000),
    shippingRequired: z.boolean(),
  }).optional(),
}).superRefine((v, ctx) => {
  if (v.collabType !== 'PAID' && !v.product) {
    ctx.addIssue({ code: 'custom', path: ['product'], message: 'errors.productRequired' });
  }
});

const listOf = (maxItems: number, maxLen: number) => z.array(plainText(1, maxLen)).max(maxItems, 'errors.selectAtMost');

export const campaignStep4Schema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  dos: listOf(10, 200),
  donts: listOf(10, 200),
  referenceUrls: z.array(httpsUrl).max(5),
  hashtags: z.array(z.string().trim().regex(/^#[\p{L}\p{N}_]{1,50}$/u, 'errors.hashtag')).max(10),
  mentions: z.array(z.string().trim().regex(/^@[A-Za-z0-9._]{1,30}$/, 'errors.mention')).max(5),
  maxRevisions: z.coerce.number().int().min(0).max(3),
}).superRefine((v, ctx) => {
  if (v.startDate < todayIST()) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'errors.dateInPast' });
  if (v.endDate <= v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'errors.endBeforeStart' });
  const days = (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000;
  if (days > 180) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'errors.campaignTooLong' });
});

export const campaignStep5Schema = z.object({
  budgetSuggest: z.boolean(),
  budgetMin: rupees(1_00_00_000).optional(),
  budgetMax: rupees(1_00_00_000).optional(),
  usageRightsRequired: z.boolean(),
  usageRightsDays: z.coerce.number().int().min(0).max(365).optional(),
}).superRefine((v, ctx) => {
  if (!v.budgetSuggest) {
    if (v.budgetMin === undefined || v.budgetMax === undefined) {
      ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'errors.budgetRequired' });
    } else if (v.budgetMin > v.budgetMax) {
      ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'errors.budgetRange' });
    }
  }
});

export const CAMPAIGN_STEP_SCHEMAS = {
  1: campaignStep1Schema,
  2: campaignStep2Schema,
  3: campaignStep3Schema,
  4: campaignStep4Schema,
  5: campaignStep5Schema,
} as const;

export const reasonSchema = z.object({ reason: plainText(3, 500) });

export const shortlistSelectSchema = z.object({
  itemIds: z.array(objectId).min(1).max(50).refine((a) => new Set(a).size === a.length, 'errors.duplicates'),
});

/* ---------- manual payments ---------- */

export const PAYMENT_METHODS = ['UPI', 'IMPS', 'NEFT', 'RTGS', 'CHEQUE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentSubmitSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().toUpperCase().max(30),
  amountPaid: z.coerce.number({ invalid_type_error: 'errors.wholeNumber' }).int('errors.wholeNumber').min(1).max(10_00_00_000),
  paidOn: isoDate,
  payerName: businessName(2, 100),
  note: optionalText(300),
}).superRefine((v, ctx) => {
  if (!PAYMENT_REFERENCE_RULES[v.method].test(v.reference)) {
    ctx.addIssue({ code: 'custom', path: ['reference'], message: `errors.reference${v.method}` });
  }
  const today = todayIST();
  if (v.paidOn > today) ctx.addIssue({ code: 'custom', path: ['paidOn'], message: 'errors.dateFuture' });
  const days = (Date.parse(today) - Date.parse(v.paidOn)) / 86_400_000;
  if (days > 30) ctx.addIssue({ code: 'custom', path: ['paidOn'], message: 'errors.paymentTooOld' });
});

export const paymentDetailsSchema = z.object({
  accountName: businessName(2, 100),
  bankName: businessName(2, 100),
  accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'errors.accountNumber'),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'errors.ifsc'),
  upiId: z.union([z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'errors.upi'), z.literal('')])
    .optional().transform((v) => (v ? v : undefined)),
  instructions: optionalText(500),
});

export const paymentReviewSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  reason: optionalText(500),
}).refine((v) => v.decision === 'VERIFIED' || (v.reason && v.reason.length >= 3), { path: ['reason'], message: 'errors.reasonRequired' });

/* ---------- offers ---------- */

export const offerDeclineSchema = z.object({
  reason: z.enum(OFFER_DECLINE_REASONS),
  note: optionalText(300),
});

/* ---------- admin ---------- */

const score = z.coerce.number().int().min(1).max(5);
export const creatorDecisionSchema = z.object({
  decision: z.enum(CREATOR_DECISIONS),
  scores: z.object({ quality: score, consistency: score, audienceFit: score, engagement: score }).optional(),
  reasonCode: z.enum(REVIEW_REASON_CODES).optional(),
  reasonText: optionalText(1000),
}).superRefine((v, ctx) => {
  if (v.decision !== 'CHANGES_REQUESTED' && !v.scores) {
    ctx.addIssue({ code: 'custom', path: ['scores'], message: 'errors.scoresRequired' });
  }
  if (v.decision !== 'APPROVED' && (!v.reasonCode || !v.reasonText)) {
    ctx.addIssue({ code: 'custom', path: ['reasonText'], message: 'errors.reasonRequired' });
  }
});

export const shortlistAddSchema = z.object({
  items: z.array(z.object({
    creatorId: objectId,
    creatorPayout: rupees(1_00_00_000),
    brandPrice: rupees(1_00_00_000).optional(),
    note: optionalText(500),
  }).refine((i) => i.brandPrice === undefined || i.brandPrice >= i.creatorPayout, {
    path: ['brandPrice'], message: 'errors.priceBelowPayout',
  })).min(1).max(50),
});

export const paginationQuery = z.object({
  cursor: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreatorStep1 = z.infer<typeof creatorStep1Schema>;
export type CreatorStep2 = z.infer<typeof creatorStep2Schema>;
export type CreatorStep3 = z.infer<typeof creatorStep3Schema>;
export type CreatorStep4 = z.infer<typeof creatorStep4Schema>;
export type BrandOnboarding = z.infer<typeof brandOnboardingSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PaymentSubmitInput = z.infer<typeof paymentSubmitSchema>;
export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;
export type CreatorDecisionInput = z.infer<typeof creatorDecisionSchema>;

/* ---------- deliverables: draft link → review → live post link → verified ---------- */

/** A review note. Required when asking for changes or rejecting, so the creator knows what to fix. */
const reviewWithNote = <D extends [string, ...string[]]>(decisions: D, needsNote: D[number]) =>
  z.object({ decision: z.enum(decisions), note: optionalText(1000) })
    .refine((v) => v.decision !== needsNote || (v.note?.length ?? 0) >= 3, { path: ['note'], message: 'errors.reasonRequired' });

/** Creator: the draft (any safe https link, e.g. Google Drive or an unlisted video) and an optional note. */
export const draftSubmitSchema = z.object({ url: httpsUrl, note: optionalText(1000) });
/** Creator: the published Instagram post/reel. */
export const liveSubmitSchema = z.object({ url: instagramPostUrl, note: optionalText(1000) });
/** Team: APPROVE = forward to the brand (brand deals) or approve (intro reel); REVISION = back to the creator. */
export const teamDraftReviewSchema = reviewWithNote(['APPROVE', 'REVISION'], 'REVISION');
/** Brand: approve the draft, or ask for changes (limited by the campaign's revision count). */
export const brandDraftReviewSchema = reviewWithNote(['APPROVE', 'REVISION'], 'REVISION');
/** Team: the live post is up and correct (VERIFY → completed), or not (REJECT → creator fixes and resubmits). */
export const liveReviewSchema = reviewWithNote(['VERIFY', 'REJECT'], 'REJECT');

/* ---------- campaign applications (creator → Bluenova team) ---------- */

/** Creator: why they fit this campaign, and optionally the price they'd like (whole rupees). */
export const applicationSubmitSchema = z.object({
  pitch: plainText(20, 1000),
  proposedRate: rupees(1_00_00_000).optional(),
});
/** Team: SHORTLIST puts the creator on the brand's shortlist at this payout (and price); DECLINE closes it. */
export const applicationDecisionSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('SHORTLIST'),
    creatorPayout: rupees(1_00_00_000).refine((v) => v > 0, 'errors.zod.too_small'),
    brandPrice: rupees(1_00_00_000).optional(),
    note: optionalText(500),
  }),
  z.object({ decision: z.literal('DECLINE'), note: optionalText(500) }),
]).refine((v) => v.decision !== 'SHORTLIST' || v.brandPrice === undefined || v.brandPrice >= v.creatorPayout, {
  path: ['brandPrice'], message: 'errors.priceBelowPayout',
});
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;

/* ---------- messages (each creator/brand ↔ the Bluenova team) ---------- */

export const messageBodySchema = z.object({ body: plainText(1, 2000) });
/** Creator/brand: start a conversation, optionally about one of their own campaigns or deals. */
export const conversationCreateSchema = z.object({
  subject: plainText(3, 120),
  body: plainText(1, 2000),
  topic: z.object({ type: z.enum(['CAMPAIGN', 'DEAL']), id: objectId }).optional(),
});
/** Team: start a conversation with one creator/brand account. */
export const adminConversationCreateSchema = z.object({ userId: objectId, subject: plainText(3, 120), body: plainText(1, 2000) });
export const conversationStatusSchema = z.object({ status: z.enum(['OPEN', 'CLOSED']) });

/* ---------- disputes, reports, ratings ---------- */

/** Creator or brand: something is wrong with a running deal. The deal pauses until the team resolves it. */
export const disputeCreateSchema = z.object({ reason: z.enum(DISPUTE_REASONS), description: plainText(20, 2000) });
/** Team: CONTINUE returns the deal to where it was; CANCEL ends it. Both sides see the note. */
export const disputeResolveSchema = z.object({ outcome: z.enum(['CONTINUE', 'CANCEL']), note: plainText(3, 1000) });
/** Creator reports a campaign; brand reports a creator (only ones they actually deal with). */
export const reportCreateSchema = z.object({
  targetType: z.enum(['CAMPAIGN', 'CREATOR']),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: plainText(10, 1000),
});
export const reportReviewSchema = z.object({ outcome: z.enum(['ACTIONED', 'DISMISSED']), note: optionalText(1000) });
/** After a completed brand deal, each side rates the other once (team-only for now). */
export const ratingSchema = z.object({ stars: z.coerce.number().int().min(1, 'errors.stars').max(5, 'errors.stars'), comment: optionalText(500) });

/* ---------- deal amendments and cancellation (team only) ---------- */

/** Change agreed terms after acceptance. At least one field, always a reason; every change is recorded on the deal. */
export const dealAmendSchema = z.object({
  reason: plainText(3, 500),
  creatorPayout: rupees(1_00_00_000).optional(),
  brandPrice: rupees(1_00_00_000).optional(),
  draftDue: isoDate.optional(),
  liveDue: isoDate.optional(),
  maxRevisions: z.coerce.number().int().min(0).max(5).optional(),
}).refine((v) => ['creatorPayout', 'brandPrice', 'draftDue', 'liveDue', 'maxRevisions'].some((k) => v[k as keyof typeof v] !== undefined), {
  path: ['_'], message: 'errors.nothingToChange',
}).refine((v) => v.brandPrice === undefined || v.creatorPayout === undefined || v.brandPrice >= v.creatorPayout, {
  path: ['brandPrice'], message: 'errors.priceBelowPayout',
}).refine((v) => !v.draftDue || !v.liveDue || v.draftDue <= v.liveDue, { path: ['liveDue'], message: 'errors.liveBeforeDraft' });
export type DealAmendInput = z.infer<typeof dealAmendSchema>;
export const dealCancelSchema = z.object({ reason: plainText(3, 500) });

/* ---------- public contact form (visitors, no account needed) ---------- */

export const contactSchema = z.object({
  name: personName(60),
  email: emailSchema,
  phone: z.union([mobileSchema, z.literal('')]).optional().transform((v) => (v ? v : undefined)),
  topic: z.enum(['CREATOR', 'BRAND', 'OTHER']),
  message: plainText(10, 2000),
  // Hidden "website" field: real people leave it empty; simple spam bots fill every field.
  website: z.string().max(200).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

/* ---------- approved creators: keep the profile up to date ---------- */

/**
 * What an APPROVED creator may change without a new review: bio, languages, best reels, self-reported stats,
 * rate card, barter, and whether they're available for new campaigns. Name, Instagram handle, city and categories
 * stay locked (changing them needs the team: Messages). Same rules as onboarding.
 */
export const creatorPartnerUpdateSchema = z.object({
  bio: optionalText(300),
  areas: areasSchema,
  languages: uniqueArray(z.enum(LANGUAGES), 1, 3),
  reels: creatorStep3Schema.shape.reels,
  available: z.boolean(),
}).and(creatorStep4Schema);
export type CreatorPartnerUpdate = z.infer<typeof creatorPartnerUpdateSchema>;
