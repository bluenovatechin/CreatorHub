/**
 * Role-based views. Responses are ALWAYS built here from explicit allow-lists;
 * raw Mongoose documents are never sent to clients.
 */
import type { Campaign, ShortlistItem } from '../models/campaign';
import type { CreatorProfile } from '../models/creatorProfile';
import type { BrandProfile } from '../models/brandProfile';
import type { Deal, Offer } from '../models/deal';

/**
 * Serializers accept both hydrated documents (`doc.toObject()`) and `.lean()` results.
 * Mongoose types those two shapes differently (DocumentArray vs plain arrays), so the input
 * is typed loosely here; the OUTPUT is what matters for security and is built from explicit fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WithId<T> = { [K in keyof T]?: any } & { _id: unknown; createdAt?: Date; updatedAt?: Date } & Record<string, any>;
const id = (v: unknown) => (v ? String(v) : null);
const history = (h: { from?: string | null; to?: string | null; at?: Date | null; reason?: string | null }[] | undefined, withReason = false) =>
  (h ?? []).map((x) => ({ from: x.from ?? null, to: x.to ?? null, at: x.at ?? null, ...(withReason ? { reason: x.reason ?? null } : {}) }));

/* ---------- creator ---------- */

function creatorCore(p: WithId<CreatorProfile>) {
  return {
    id: id(p._id),
    displayName: p.displayName ?? null,
    city: p.city ?? null,
    languages: p.languages ?? [],
    categories: p.categories ?? [],
    igHandle: p.instagram?.handle ?? null,
    reels: (p.reels ?? []).map((r: { url: string }) => r.url),
    stats: {
      followers: p.instagram?.followers ?? null,
      avgViews: p.instagram?.avgViews ?? null,
      engagementRate: p.instagram?.engagementBps != null ? p.instagram.engagementBps / 100 : null,
      followerBand: p.instagram?.followerBand ?? null,
    },
    isPartner: p.isPartner,
    creatorScore: p.creatorScore,
  };
}

export function creatorSelfView(p: WithId<CreatorProfile>) {
  const showReason = p.status === 'CHANGES_REQUESTED' || p.status === 'REJECTED';
  return {
    ...creatorCore(p),
    slug: p.slug,
    status: p.status,
    onboardingStep: p.onboardingStep,
    fullName: p.fullName ?? null,
    phone: p.phone ?? null,
    gender: p.gender ?? null,
    ageGroup: p.ageGroup ?? null,
    bio: p.bio ?? null,
    rateCardPaise: p.rateCardPaise ?? {},
    acceptsBarter: p.acceptsBarter,
    availability: p.availability,
    partnerSince: p.partnerSince ?? null,
    introReelDealId: id(p.introReelDealId),
    ratingAvg: p.ratingAvg,
    completedDeals: p.completedDeals,
    referralCode: p.referralCode,
    review: showReason ? { reasonCode: p.review?.reasonCode ?? null, reasonText: p.review?.reasonText ?? null } : null,
    reapplyAfter: p.reapplyAfter ?? null,
    statusHistory: history(p.statusHistory),
  };
}

/** What a brand may see about a creator (shortlist cards, deals). No contacts, no payout, no full name. */
export function creatorCardView(p: WithId<CreatorProfile>) {
  return creatorCore(p);
}

export function creatorAdminView(p: WithId<CreatorProfile>, user?: { email?: string | null } | null) {
  return {
    ...creatorSelfView(p),
    email: user?.email ?? null,
    userId: id(p.userId),
    review: p.review ? {
      scores: p.review.scores ?? null,
      reasonCode: p.review.reasonCode ?? null,
      reasonText: p.review.reasonText ?? null,
      reviewedBy: id(p.review.reviewedBy),
      reviewedAt: p.review.reviewedAt ?? null,
      claimedBy: id(p.review.claimedBy),
    } : null,
    internalTags: p.internalTags ?? [],
    internalNotes: p.internalNotes ?? null,
    submittedAt: p.submittedAt ?? null,
    statusHistory: history(p.statusHistory, true),
    createdAt: p.createdAt,
  };
}

/* ---------- brand ---------- */

export function brandSelfView(b: WithId<BrandProfile>, accountEmail?: string | null) {
  return {
    id: id(b._id),
    status: b.status,
    companyName: b.companyName ?? null,
    contactName: b.contactName ?? null,
    designation: b.designation ?? null,
    phone: b.phone ?? null,
    email: accountEmail ?? null,
    gstin: b.gstin ?? null,
    industry: b.industry ?? null,
    city: b.city ?? null,
    website: b.website ?? null,
    billingAddress: b.billingAddress ?? null,
  };
}

export function brandAdminView(b: WithId<BrandProfile>, user?: { email?: string | null } | null) {
  return { ...brandSelfView(b, user?.email), internalNotes: b.internalNotes ?? null, createdAt: b.createdAt };
}

/* ---------- campaign ---------- */

function campaignCore(c: WithId<Campaign>) {
  return {
    id: id(c._id),
    title: c.title ?? null,
    goal: c.goal ?? null,
    description: c.description ?? null,
    filters: {
      categories: c.filters?.categories ?? [],
      cities: c.filters?.cities ?? [],
      languages: c.filters?.languages ?? [],
      followerBands: c.filters?.followerBands ?? [],
      genders: c.filters?.genders ?? [],
      ageGroups: c.filters?.ageGroups ?? [],
      minEngagementRate: c.filters?.minEngagementBps != null ? c.filters.minEngagementBps / 100 : null,
    },
    deliverables: (c.deliverables ?? []).map((d: { type: string; quantity: number }) => ({ type: d.type, quantity: d.quantity })),
    creatorsNeeded: c.creatorsNeeded ?? null,
    collabType: c.collabType ?? null,
    product: c.product?.name ? { name: c.product.name, valuePaise: c.product.valuePaise, shippingRequired: c.product.shippingRequired } : null,
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
    guidelines: {
      dos: c.guidelines?.dos ?? [],
      donts: c.guidelines?.donts ?? [],
      referenceUrls: c.guidelines?.referenceUrls ?? [],
      hashtags: c.guidelines?.hashtags ?? [],
      mentions: c.guidelines?.mentions ?? [],
      disclosure: c.guidelines?.disclosure ?? '#ad',
    },
    maxRevisions: c.maxRevisions,
    status: c.status,
    createdAt: c.createdAt,
  };
}

export function campaignBrandView(c: WithId<Campaign>) {
  return {
    ...campaignCore(c),
    budget: c.budget ?? null,
    usageRights: c.usageRights ?? null,
    wizardStep: c.wizardStep,
    statusHistory: history(c.statusHistory),
  };
}

export function campaignAdminView(c: WithId<Campaign>) {
  return {
    ...campaignBrandView(c),
    brandId: id(c.brandId),
    assignedManagerId: id(c.assignedManagerId),
    interestedCount: c.interestedCreatorIds?.length ?? 0,
    submittedAt: c.submittedAt ?? null,
    statusHistory: history(c.statusHistory, true),
  };
}

/** Opportunity feed for creators: no brand contacts, no brand budget. */
export function opportunityView(c: WithId<Campaign>, companyName: string | null, interested: boolean) {
  const core = campaignCore(c);
  return {
    id: core.id, title: core.title, goal: core.goal, description: core.description, companyName,
    deliverables: core.deliverables, categories: core.filters.categories, cities: core.filters.cities,
    collabType: core.collabType, product: core.product, startDate: core.startDate, endDate: core.endDate,
    interested,
  };
}

/* ---------- shortlist ---------- */

export function shortlistBrandView(item: WithId<ShortlistItem>, creator: WithId<CreatorProfile> | null) {
  return {
    id: id(item._id),
    status: item.status,
    brandPricePaise: item.brandPricePaise,
    creator: creator ? creatorCardView(creator) : null,
  };
}

export function shortlistAdminView(item: WithId<ShortlistItem>, creator: WithId<CreatorProfile> | null) {
  return {
    ...shortlistBrandView(item, creator),
    creatorPayoutPaise: item.creatorPayoutPaise,
    marginPaise: item.brandPricePaise - item.creatorPayoutPaise,
    matchScore: item.matchScore ?? null,
    adminNote: item.adminNote ?? null,
    creatorId: id(item.creatorId),
  };
}

/* ---------- offers ---------- */

export function offerCreatorView(o: WithId<Offer>, campaign: WithId<Campaign> | null, companyName: string | null) {
  const expired = o.status === 'SENT' && o.expiresAt.getTime() <= Date.now();
  return {
    id: id(o._id),
    status: expired ? 'EXPIRED' : o.status,
    payoutPaise: o.payoutPaise,
    deliverables: (o.deliverables ?? []).map((d: { type: string; quantity: number }) => ({ type: d.type, quantity: d.quantity })),
    deadlines: o.deadlines,
    brief: o.briefSnapshot,
    expiresAt: o.expiresAt,
    decline: o.decline?.reason ? o.decline : null,
    companyName,
    campaign: campaign ? {
      id: id(campaign._id), title: campaign.title, goal: campaign.goal, collabType: campaign.collabType,
      product: campaign.product?.name ? { name: campaign.product.name, valuePaise: campaign.product.valuePaise } : null,
      startDate: campaign.startDate, endDate: campaign.endDate,
    } : null,
    createdAt: o.createdAt,
  };
}

export function offerAdminView(o: WithId<Offer>) {
  return {
    id: id(o._id), status: o.status, creatorId: id(o.creatorId), payoutPaise: o.payoutPaise,
    expiresAt: o.expiresAt, decline: o.decline?.reason ? o.decline : null, createdAt: o.createdAt,
  };
}

/* ---------- deals ---------- */

function dealCore(d: WithId<Deal>) {
  return {
    id: id(d._id),
    type: d.type,
    status: d.status,
    campaignId: id(d.campaignId),
    deliverables: (d.deliverables ?? []).map((x: { type: string; quantity: number }) => ({ type: x.type, quantity: x.quantity })),
    deadlines: d.deadlines ?? null,
    maxRevisions: d.maxRevisions,
    brandRevisionsUsed: d.brandRevisionsUsed,
    statusHistory: history(d.statusHistory),
    createdAt: d.createdAt,
  };
}

export function dealCreatorView(d: WithId<Deal>, extra: { campaignTitle?: string | null; companyName?: string | null }) {
  return { ...dealCore(d), creatorPayoutPaise: d.creatorPayoutPaise ?? null, ...extra };
}

export function dealBrandView(d: WithId<Deal>, extra: { campaignTitle?: string | null; creator?: ReturnType<typeof creatorCardView> | null }) {
  return { ...dealCore(d), brandPricePaise: d.brandPricePaise ?? null, ...extra };
}

export function dealAdminView(d: WithId<Deal> & { marginPaise?: number | null }) {
  return {
    ...dealCore(d),
    creatorId: id(d.creatorId),
    brandId: id(d.brandId),
    brandPricePaise: d.brandPricePaise ?? null,
    creatorPayoutPaise: d.creatorPayoutPaise ?? null,
    marginPaise: d.marginPaise ?? null,
    statusHistory: history(d.statusHistory, true),
  };
}
