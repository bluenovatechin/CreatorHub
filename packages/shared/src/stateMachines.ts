/**
 * STATE MACHINES: for each object (creator, campaign, offer, deal) the allowed status changes and WHO
 * may make each one. The API refuses any other change (lib/transition.ts). Diagrams: docs/DATA_MODELS.md.
 */
import type {
  AdminRole, ApplicationStatus, CampaignStatus, ConversationStatus, CreatorStatus, DealStatus, DisputeStatus, OfferStatus,
  ReportStatus,
} from './enums';

/** Who performs a transition. Admin sub-roles act as themselves; super_admin may act as any admin. */
export type Actor = 'creator' | 'brand' | 'system' | AdminRole;

export interface Transition<S extends string> {
  from: readonly S[];
  to: S;
  actors: readonly Actor[];
}

export interface Machine<S extends string> {
  name: string;
  transitions: readonly Transition<S>[];
}

const ADMIN_ACTORS: readonly Actor[] = ['super_admin', 'reviewer', 'campaign_manager', 'finance'];

export function canTransition<S extends string>(machine: Machine<S>, from: S, to: S, actor: Actor): boolean {
  return machine.transitions.some((t) => {
    if (t.to !== to || !t.from.includes(from)) return false;
    if (t.actors.includes(actor)) return true;
    // super_admin can perform any admin transition
    return actor === 'super_admin' && t.actors.some((a) => ADMIN_ACTORS.includes(a));
  });
}

export const creatorMachine: Machine<CreatorStatus> = {
  name: 'creator',
  transitions: [
    { from: ['DRAFT', 'CHANGES_REQUESTED'], to: 'SUBMITTED', actors: ['creator'] },
    { from: ['SUBMITTED'], to: 'UNDER_REVIEW', actors: ['reviewer'] },
    { from: ['UNDER_REVIEW'], to: 'APPROVED', actors: ['reviewer'] },
    { from: ['UNDER_REVIEW'], to: 'CHANGES_REQUESTED', actors: ['reviewer'] },
    { from: ['UNDER_REVIEW'], to: 'REJECTED', actors: ['reviewer'] },
    { from: ['REJECTED'], to: 'DRAFT', actors: ['creator'] },
    { from: ['APPROVED'], to: 'SUSPENDED', actors: ['super_admin'] },
    { from: ['SUSPENDED'], to: 'APPROVED', actors: ['super_admin'] },
  ],
};

export const campaignMachine: Machine<CampaignStatus> = {
  name: 'campaign',
  transitions: [
    { from: ['DRAFT'], to: 'SUBMITTED', actors: ['brand'] },
    { from: ['SUBMITTED'], to: 'IN_REVIEW', actors: ['campaign_manager'] },
    { from: ['IN_REVIEW', 'CREATORS_SELECTED', 'PAYMENT_PENDING'], to: 'SHORTLIST_SENT', actors: ['campaign_manager'] },
    { from: ['SHORTLIST_SENT'], to: 'CREATORS_SELECTED', actors: ['brand'] },
    { from: ['CREATORS_SELECTED', 'SHORTLIST_SENT'], to: 'PAYMENT_PENDING', actors: ['system'] },
    { from: ['PAYMENT_PENDING'], to: 'ACTIVE', actors: ['system'] },
    { from: ['ACTIVE'], to: 'COMPLETED', actors: ['system'] },
    {
      from: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING'],
      to: 'CANCELLED',
      actors: ['brand', 'campaign_manager'],
    },
  ],
};

export const offerMachine: Machine<OfferStatus> = {
  name: 'offer',
  transitions: [
    { from: ['SENT'], to: 'ACCEPTED', actors: ['creator'] },
    { from: ['SENT'], to: 'DECLINED', actors: ['creator'] },
    { from: ['SENT'], to: 'COUNTERED', actors: ['creator'] },
    { from: ['SENT'], to: 'EXPIRED', actors: ['system'] },
    { from: ['SENT', 'COUNTERED'], to: 'WITHDRAWN', actors: ['campaign_manager'] },
    { from: ['COUNTERED'], to: 'SENT', actors: ['campaign_manager'] },
  ],
};

export const dealMachine: Machine<DealStatus> = {
  name: 'deal',
  transitions: [
    { from: ['AWAITING_PAYMENT'], to: 'IN_PRODUCTION', actors: ['system'] },
    { from: ['AWAITING_PAYMENT'], to: 'CANCELLED', actors: ['brand', 'campaign_manager'] },
    { from: ['IN_PRODUCTION', 'REVISION_REQUESTED'], to: 'DRAFT_SUBMITTED', actors: ['creator'] },
    { from: ['DRAFT_SUBMITTED'], to: 'BRAND_REVIEW', actors: ['campaign_manager'] },
    { from: ['DRAFT_SUBMITTED'], to: 'REVISION_REQUESTED', actors: ['campaign_manager'] },
    { from: ['BRAND_REVIEW'], to: 'APPROVED', actors: ['brand', 'system'] },
    { from: ['BRAND_REVIEW'], to: 'REVISION_REQUESTED', actors: ['brand'] },
    { from: ['APPROVED'], to: 'LIVE_SUBMITTED', actors: ['creator'] },
    { from: ['LIVE_SUBMITTED'], to: 'VERIFIED', actors: ['campaign_manager'] },
    { from: ['LIVE_SUBMITTED'], to: 'APPROVED', actors: ['campaign_manager'] },
    { from: ['VERIFIED'], to: 'COMPLETED', actors: ['system'] },
    {
      from: ['IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'LIVE_SUBMITTED'],
      to: 'DISPUTED',
      actors: ['brand', 'creator', 'campaign_manager'],
    },
    // Resolving a dispute (team only): continue from where the deal was, or cancel it.
    // The dispute record remembers the earlier status; disputes.service.ts only ever returns the deal to THAT status.
    ...(['IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'LIVE_SUBMITTED'] as const)
      .map((to) => ({ from: ['DISPUTED'] as const, to, actors: ['campaign_manager'] as const })),
    { from: ['DISPUTED'], to: 'CANCELLED', actors: ['campaign_manager'] },
    // The team may also cancel a running deal directly (reason required, audited, both sides told).
    {
      from: ['IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'LIVE_SUBMITTED'],
      to: 'CANCELLED',
      actors: ['campaign_manager'],
    },
  ],
};

export const disputeMachine: Machine<DisputeStatus> = {
  name: 'dispute',
  transitions: [{ from: ['OPEN'], to: 'RESOLVED', actors: ['campaign_manager'] }],
};

export const reportMachine: Machine<ReportStatus> = {
  name: 'report',
  transitions: [
    { from: ['OPEN'], to: 'ACTIONED', actors: ['reviewer', 'campaign_manager'] },
    { from: ['OPEN'], to: 'DISMISSED', actors: ['reviewer', 'campaign_manager'] },
  ],
};

/** Applications: the team shortlists (the brand then sees the creator on the shortlist) or declines; the creator may withdraw. */
export const applicationMachine: Machine<ApplicationStatus> = {
  name: 'application',
  transitions: [
    { from: ['SUBMITTED'], to: 'SHORTLISTED', actors: ['campaign_manager'] },
    { from: ['SUBMITTED'], to: 'DECLINED', actors: ['campaign_manager'] },
    { from: ['SUBMITTED'], to: 'WITHDRAWN', actors: ['creator'] },
  ],
};

/** Conversations with the team: the team closes them; a new message from either side re-opens them. */
export const conversationMachine: Machine<ConversationStatus> = {
  name: 'conversation',
  transitions: [
    { from: ['OPEN'], to: 'CLOSED', actors: ['reviewer', 'campaign_manager', 'finance'] },
    { from: ['CLOSED'], to: 'OPEN', actors: ['creator', 'brand', 'reviewer', 'campaign_manager', 'finance'] },
  ],
};

/** INTRO_REEL deals: no payment, no brand review; admin approves drafts directly. */
export const introDealMachine: Machine<DealStatus> = {
  name: 'introDeal',
  transitions: [
    { from: ['IN_PRODUCTION', 'REVISION_REQUESTED'], to: 'DRAFT_SUBMITTED', actors: ['creator'] },
    { from: ['DRAFT_SUBMITTED'], to: 'APPROVED', actors: ['campaign_manager', 'reviewer'] },
    { from: ['DRAFT_SUBMITTED'], to: 'REVISION_REQUESTED', actors: ['campaign_manager', 'reviewer'] },
    { from: ['APPROVED'], to: 'LIVE_SUBMITTED', actors: ['creator'] },
    { from: ['LIVE_SUBMITTED'], to: 'VERIFIED', actors: ['campaign_manager', 'reviewer'] },
    { from: ['LIVE_SUBMITTED'], to: 'APPROVED', actors: ['campaign_manager', 'reviewer'] },
    { from: ['VERIFIED'], to: 'COMPLETED', actors: ['system'] },
  ],
};
