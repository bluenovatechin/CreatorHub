/**
 * NOTIFICATION EMAILS: which in-app notifications are ALSO emailed, and their text (English / Gujarati).
 * Used by lib/notify.ts (decides whether to queue an email) and jobs/emailOutbox.ts (builds and sends it).
 * Only events a person must act on or would want to know quickly are emailed; everything else stays in-app.
 * Team (admin) notifications are never emailed: the team works from the admin dashboard.
 * Keep the meaning in line with the website texts (apps/web/src/i18n → notif.*).
 */
import { env } from '../config/env';
import type { EmailMessage } from './email';

type Lang = 'en' | 'gu';
type Params = Record<string, string | number>;
type Texts = Record<Lang, (p: Params) => string>;

const T: Record<string, Texts> = {
  creator_approved: { en: () => 'You are approved! You are now an Official Bluenova Creator Partner.', gu: () => 'તમે approve થયા! હવે તમે Official Bluenova Creator Partner છો.' },
  creator_changes_requested: { en: () => 'Your creator profile needs a few changes.', gu: () => 'તમારી creator profile માં થોડા ફેરફાર જરૂરી છે.' },
  creator_rejected: { en: () => 'Your creator application was not approved this time.', gu: () => 'આ વખતે તમારી creator application approve ન થઈ.' },
  creator_new_offer: { en: (p) => `New offer: ${p.campaign}. Please reply before it expires.`, gu: (p) => `નવી offer: ${p.campaign}. Offer પૂરી થાય તે પહેલાં જવાબ આપો.` },
  creator_start_work: { en: (p) => `"${p.campaign}" has started. You can begin creating.`, gu: (p) => `"${p.campaign}" શરૂ થયું. હવે content બનાવવાનું શરૂ કરો.` },
  creator_application_shortlisted: { en: (p) => `You were shortlisted for "${p.campaign}".`, gu: (p) => `તમે "${p.campaign}" માટે shortlist થયા છો.` },
  creator_application_declined: { en: (p) => `Your application for "${p.campaign}" was not selected this time.`, gu: (p) => `"${p.campaign}" માટેની તમારી application આ વખતે પસંદ ન થઈ.` },
  creator_revision_requested: { en: (p) => `Changes were requested for "${p.campaign}".`, gu: (p) => `"${p.campaign}" માટે ફેરફાર માંગવામાં આવ્યા છે.` },
  creator_draft_approved: { en: (p) => `Your draft for "${p.campaign}" was approved. Post it and send the live link.`, gu: (p) => `"${p.campaign}" માટેનો તમારો draft approve થયો. Post કરો અને live link મોકલો.` },
  creator_live_rejected: { en: (p) => `Your live post for "${p.campaign}" needs a fix.`, gu: (p) => `"${p.campaign}" ની તમારી live post માં સુધારો જરૂરી છે.` },
  creator_deal_completed: { en: (p) => `"${p.campaign}" is completed. Thank you!`, gu: (p) => `"${p.campaign}" પૂર્ણ થયું. આભાર!` },
  creator_draft_due_soon: { en: (p) => `Reminder: your draft for "${p.campaign}" is due on ${p.date}.`, gu: (p) => `યાદ અપાવીએ: "${p.campaign}" નો draft ${p.date} સુધીમાં આપવાનો છે.` },
  creator_live_due_soon: { en: (p) => `Reminder: your post for "${p.campaign}" should be live by ${p.date}.`, gu: (p) => `યાદ અપાવીએ: "${p.campaign}" ની post ${p.date} સુધીમાં live કરવાની છે.` },
  creator_deadline_missed: { en: (p) => `The deadline for "${p.campaign}" has passed. Please send your work or message the Bluenova team.`, gu: (p) => `"${p.campaign}" ની deadline પૂરી થઈ ગઈ છે. તમારું કામ મોકલો અથવા Bluenova team ને message કરો.` },
  brand_shortlist_ready: { en: (p) => `Your shortlist for "${p.campaign}" is ready.`, gu: (p) => `"${p.campaign}" માટે તમારો shortlist તૈયાર છે.` },
  brand_offer_accepted: { en: (p) => `${p.creator} accepted your campaign "${p.campaign}".`, gu: (p) => `${p.creator} એ તમારું campaign "${p.campaign}" સ્વીકાર્યું.` },
  brand_campaign_started: { en: (p) => `Your campaign "${p.campaign}" has started.`, gu: (p) => `તમારું campaign "${p.campaign}" શરૂ થયું.` },
  brand_draft_ready: { en: (p) => `A draft from ${p.creator} for "${p.campaign}" is ready for your review.`, gu: (p) => `"${p.campaign}" માટે ${p.creator} નો draft તમારા review માટે તૈયાર છે.` },
  brand_deal_completed: { en: (p) => `${p.creator} completed their post for "${p.campaign}".`, gu: (p) => `${p.creator} એ "${p.campaign}" માટેની post પૂર્ણ કરી.` },
  brand_campaign_completed: { en: (p) => `Your campaign "${p.campaign}" is completed.`, gu: (p) => `તમારું campaign "${p.campaign}" પૂર્ણ થયું.` },
  brand_draft_auto_approved: { en: (p) => `The draft from ${p.creator} for "${p.campaign}" was approved automatically because the review time ended.`, gu: (p) => `Review નો સમય પૂરો થતાં "${p.campaign}" માટે ${p.creator} નો draft આપમેળે approve થયો.` },
  brand_payment_verified: { en: (p) => `Payment verified for "${p.campaign}".`, gu: (p) => `"${p.campaign}" માટે payment verify થયું.` },
  brand_payment_rejected: { en: (p) => `We couldn't verify your payment for "${p.campaign}".`, gu: (p) => `"${p.campaign}" માટે તમારું payment verify ન થઈ શક્યું.` },
  message_from_team: { en: (p) => `New message from the Bluenova team: ${p.subject}`, gu: (p) => `Bluenova team તરફથી નવો message: ${p.subject}` },
  deal_disputed: { en: (p) => `A collaboration in "${p.campaign}" is paused while the Bluenova team looks into a problem.`, gu: (p) => `"${p.campaign}" નું એક collab અટકાવ્યું છે; Bluenova team સમસ્યા જોઈ રહી છે.` },
  dispute_resolved: { en: (p) => `The problem in "${p.campaign}" was resolved.`, gu: (p) => `"${p.campaign}" ની સમસ્યા ઉકેલાઈ.` },
  deal_amended: { en: (p) => `The terms of your collaboration in "${p.campaign}" were updated by the Bluenova team.`, gu: (p) => `Bluenova team એ "${p.campaign}" ના collab ની શરતો બદલી છે.` },
  deal_cancelled: { en: (p) => `A collaboration in "${p.campaign}" was cancelled by the Bluenova team.`, gu: (p) => `Bluenova team એ "${p.campaign}" નું એક collab cancel કર્યું.` },
};

/** Does this notification type also go out by email? */
export const isEmailed = (type: string) => type in T;

export function notificationEmail(to: string, lang: Lang, type: string, params: Params, link: string | null): EmailMessage {
  const sentence = (T[type]?.[lang] ?? T[type]?.en)?.(params) ?? 'You have an update on Bluenova.';
  const url = link ? `${env.APP_BASE_URL}${link}` : env.APP_BASE_URL;
  const open = lang === 'gu' ? 'Bluenova પર ખોલો' : 'Open in Bluenova';
  const off = lang === 'gu'
    ? 'આ emails બંધ કરવા: Settings → Email notifications.'
    : 'To stop these emails: Settings → Email notifications.';
  return {
    to,
    subject: sentence.length > 90 ? `${sentence.slice(0, 87)}…` : sentence,
    text: `${sentence}\n\n${open}:\n${url}\n\n${off}\n\n— Bluenova Creator Hub`,
    link: url,
  };
}
