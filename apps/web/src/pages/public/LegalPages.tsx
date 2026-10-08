import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck } from 'lucide-react';

/**
 * Privacy Policy and Terms of Use.
 * The English text is the governing version; Gujarati readers get a plain-language summary on top.
 * Keep this text in sync with what the app really collects and does.
 */

const UPDATED = '8 October 2026';
const CONTACT = 'Bluenova Creator Hub · +91 76002 36644 · bluenovatech.in';

interface Section { id: string; title: string; body: (string | string[])[] }

const PRIVACY: Section[] = [
  { id: 'who', title: '1. Who we are', body: [
    `Bluenova Creator Hub ("Bluenova", "we", "us") is a platform that connects brands with content creators for collaborations. This policy explains what personal data we collect through this website, why, and the choices you have. Contact: ${CONTACT}.`,
  ] },
  { id: 'collect', title: '2. What we collect', body: [
    'Account details: your name, email address, the account type you choose (creator or brand) and your password. Your password is stored only as a secure one-way hash (argon2id); nobody at Bluenova can read it.',
    'Creator profile: full name, display name, WhatsApp number, Instagram handle, city, content languages, optional gender and age group, short bio, categories, links to your reels, follower count, average views, engagement rate and your expected prices.',
    'Brand profile: company name, contact person, designation, mobile number, GSTIN (optional), industry, city, website and billing address.',
    'Activity on the platform: campaigns you create, shortlists, offers, collaborations, review decisions and in-app notifications.',
    'Security information: IP address, browser and device type, login times, failed login attempts, and a record of actions taken by the Bluenova team.',
    'If payments are made through the website: the transaction details you submit (method, reference number, amount, date, payer name). We never collect card numbers, UPI PINs or banking passwords.',
  ] },
  { id: 'use', title: '3. How we use your data', body: [[
    'To create and secure your account, verify your email and let you log in.',
    'To review creator applications and match creators with suitable brand campaigns.',
    'To run collaborations: briefs, shortlists, offers, deadlines and notifications.',
    'To send you service emails (verification, password reset, important updates). We do not send marketing emails without your consent.',
    'To prevent fraud and abuse, protect accounts and investigate security incidents.',
    'To meet legal obligations, such as tax and accounting records.',
  ], 'We do not sell your personal data, and we do not use it for third-party advertising.'] },
  { id: 'share', title: '4. Who can see your information', body: [[
    'Brands see a creator\'s display name, city, languages, categories, follower range, engagement rate, creator score, Instagram handle and reel links — only in shortlists and collaborations. Brands never see a creator\'s full name, phone number or email.',
    'Creators see the brand\'s company name and campaign brief. Creators never see a brand\'s contact person, phone number or email.',
    'The Bluenova team sees the information needed for their role (for example, reviewers see creator profiles). Team access is protected by two-step verification and important actions are logged.',
    'Service providers that help us run the platform — database hosting (MongoDB Atlas), website hosting and email delivery — process data only on our instructions.',
    'Authorities, when required by law or to protect the rights and safety of users and Bluenova.',
  ]] },
  { id: 'cookies', title: '5. Cookies and browser storage', body: [
    'We use one essential cookie to keep you logged in securely. It cannot be read by scripts on the page and is sent only to our login service. We also save your language choice (Gujarati or English) in your browser. We do not use advertising or tracking cookies.',
  ] },
  { id: 'security', title: '6. How we protect your data', body: [
    'Encrypted connections (HTTPS), hashed passwords, limits on repeated login attempts, short-lived login sessions, restricted team access with two-step verification, and audit records of team actions. No system is completely secure, but we work to protect your data and will inform you and the authorities of a personal-data breach as required by law.',
  ] },
  { id: 'retention', title: '7. How long we keep data', body: [
    'We keep your data while your account is active. If you ask us to delete your account, we delete or anonymise your personal data within 30 days, except records we must keep by law (for example, tax and accounting records, which may be kept for up to 8 years). Security logs are kept for up to 180 days.',
  ] },
  { id: 'rights', title: '8. Your rights', body: [
    'Under India\'s Digital Personal Data Protection Act, 2023 you can ask us to: give you a summary of the personal data we hold about you; correct or update it; delete it; and withdraw consent (this may mean we can no longer provide the service). You can also nominate another person to exercise these rights if you are unable to. You can update most profile details yourself; for anything else, contact us using the details below. You may also approach the Data Protection Board of India if you are not satisfied with our response.',
  ] },
  { id: 'children', title: '9. Age requirement', body: [
    'You must be at least 18 years old to use Bluenova Creator Hub. We do not knowingly collect personal data from children.',
  ] },
  { id: 'changes', title: '10. Changes to this policy', body: [
    'We may update this policy. If the changes are important, we will tell you on the website or by email before they take effect. The "last updated" date shows the latest version.',
  ] },
  { id: 'contact', title: '11. Contact and grievances', body: [
    `For questions, requests about your data, or complaints, contact us: ${CONTACT}. We will respond as soon as possible and within the time required by law.`,
  ] },
];

const TERMS: Section[] = [
  { id: 'about', title: '1. About these terms', body: [
    'These Terms of Use ("Terms") are an agreement between you and Bluenova Creator Hub ("Bluenova"). By creating an account or using the website you agree to these Terms and to our Privacy Policy. Sections 5 and 6 are the Creator terms and Brand terms referred to during onboarding.',
  ] },
  { id: 'eligibility', title: '2. Who can use Bluenova', body: [[
    'You must be at least 18 years old and able to enter into a binding contract.',
    'If you register for a business, you confirm that you are authorised to act for it.',
    'All information you provide must be true, accurate and kept up to date. One account per person or business.',
  ]] },
  { id: 'account', title: '3. Your account', body: [
    'Keep your password secret and do not share your account. You are responsible for activity on your account. Tell us immediately if you think someone else has accessed it. Bluenova will never ask for your password.',
  ] },
  { id: 'service', title: '4. How the platform works', body: [
    'Creators apply and are reviewed by Bluenova. Brands submit campaign requirements. Bluenova proposes a shortlist of suitable creators; brands choose creators; Bluenova sends offers; creators accept or decline. Bluenova manages each collaboration. Bluenova decides at its discretion whether to approve creators, accept campaigns or propose creators, and does not guarantee any number of offers, collaborations, views, sales or other results.',
  ] },
  { id: 'creators', title: '5. Creator terms', body: [[
    'Your profile, statistics and reels must be genuine. Do not use bought followers, fake engagement or someone else\'s content.',
    'Content must be original, follow the campaign brief and be delivered by the agreed deadlines.',
    'Every paid or sponsored post must be clearly labelled (for example "#ad" or Instagram\'s "Paid partnership" label), as required by the ASCI influencer advertising guidelines and Indian consumer law.',
    'Keep any non-public information about brands and campaigns confidential.',
    'Your payout for each collaboration is the amount shown in the offer you accept. Bluenova will share how and when it is paid.',
  ]] },
  { id: 'brands', title: '6. Brand terms', body: [[
    'Business details, including GSTIN and billing address, must be accurate.',
    'Products, services and claims in your brief must be lawful, truthful and not misleading.',
    'Where a collaboration involves a product (barter), deliver it to the creator on time and in good condition.',
    'Use creator content only as agreed in the campaign (including any usage-rights period).',
    'Fees, taxes and payment terms for each campaign are agreed with Bluenova in writing.',
  ]] },
  { id: 'nodirect', title: '7. No direct deals', body: [
    'Bluenova introduces brands and creators to each other. For 12 months after an introduction through Bluenova, brands and creators agree not to make paid collaboration arrangements directly with each other, or through anyone else, without Bluenova\'s written consent. Do not share phone numbers, email addresses or other contact details to get around Bluenova.',
  ] },
  { id: 'ip', title: '8. Content and intellectual property', body: [
    'Creators keep ownership of their content. By delivering content for a collaboration, the creator gives the brand the right to use it as agreed in that campaign, and gives Bluenova the right to show the content link, display name and partnership (for example, the Official Creator Partner introduction) to promote the platform. The Bluenova name, logo and website belong to Bluenova.',
  ] },
  { id: 'prohibited', title: '9. Things you must not do', body: [[
    'Give false information, impersonate anyone or create multiple accounts.',
    'Post or request illegal, hateful, obscene, defamatory or misleading content.',
    'Harass, threaten or abuse other users or the Bluenova team.',
    'Copy, scrape or misuse the platform or other users\' data.',
    'Try to break, overload or get around the website\'s security.',
  ]] },
  { id: 'suspension', title: '10. Suspension and closing accounts', body: [
    'Bluenova may suspend or close an account that breaks these Terms, provides false information or puts other users at risk. You may stop using Bluenova at any time and ask us to delete your account; obligations that apply to collaborations already accepted continue until they are completed or cancelled.',
  ] },
  { id: 'disclaimer', title: '11. Disclaimer', body: [
    'Bluenova is provided "as is". We work to keep it available, accurate and secure, but we do not guarantee that it will always be uninterrupted or error-free. We are not responsible for Instagram or other third-party services.',
  ] },
  { id: 'liability', title: '12. Limitation of liability', body: [
    'To the extent permitted by law, Bluenova is not liable for indirect or consequential losses, and Bluenova\'s total liability for any claim relating to a collaboration is limited to the amount Bluenova received for that collaboration. Nothing in these Terms limits liability that cannot be limited by law.',
  ] },
  { id: 'indemnity', title: '13. Your responsibility', body: [
    'You agree to compensate Bluenova for losses caused by your breach of these Terms, your content, or your violation of any law or third-party right.',
  ] },
  { id: 'changes', title: '14. Changes to these Terms', body: [
    'We may update these Terms. If the changes are important, we will tell you before they take effect. Continuing to use Bluenova after that means you accept the updated Terms.',
  ] },
  { id: 'law', title: '15. Governing law', body: [
    'These Terms are governed by the laws of India. Disputes will be handled by the competent courts in Gujarat, India.',
  ] },
  { id: 'contact', title: '16. Contact', body: [`${CONTACT}`] },
];

const SUMMARY_GU = {
  privacy: [
    'અમે ફક્ત જરૂરી માહિતી લઈએ છીએ: નામ, email, password (સુરક્ષિત hash તરીકે), અને profile ની details.',
    'Brands ને તમારો phone, email કે પૂરું નામ ક્યારેય દેખાતું નથી. Creators ને brand ની contact details દેખાતી નથી.',
    'અમે તમારો data વેચતા નથી અને advertising માટે વાપરતા નથી.',
    'Login રાખવા માટે ફક્ત એક જરૂરી cookie વાપરીએ છીએ. કોઈ tracking cookies નથી.',
    'તમે તમારો data જોવા, સુધારવા કે delete કરાવવા માટે અમારો સંપર્ક કરી શકો છો (DPDP Act, 2023).',
    'Bluenova વાપરવા માટે ઉંમર ઓછામાં ઓછી 18 વર્ષ હોવી જોઈએ.',
  ],
  terms: [
    'સાચી માહિતી આપો અને તમારો password કોઈને ન આપો.',
    'Creators: original content, deadline સાચવો, અને દરેક paid post પર "#ad" / "Paid partnership" label ફરજિયાત છે.',
    'Brands: સાચી business details, કાયદેસર products અને સાચા દાવા.',
    'Bluenova દ્વારા મળેલા brand કે creator સાથે 12 મહિના સુધી Bluenova ની મંજૂરી વગર સીધી deal ન કરવી.',
    'નિયમ તોડનાર account Bluenova suspend કરી શકે છે.',
    'English version માન્ય ગણાશે. ભારતના કાયદા લાગુ પડે છે.',
  ],
};

function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { t, i18n } = useTranslation();
  const sections = kind === 'privacy' ? PRIVACY : TERMS;
  const Icon = kind === 'privacy' ? ShieldCheck : FileText;
  return (
    <div className="mx-auto max-w-content px-4 py-12 sm:py-16">
      <div className="max-w-3xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-navy">{t(kind === 'privacy' ? 'legal.privacy' : 'legal.terms')}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t('legal.updated', { date: UPDATED })}</p>
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <nav aria-label={t('legal.contents')} className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('legal.contents')}</p>
          <ul className="sticky top-24 mt-3 space-y-1.5 text-sm">
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-ink-muted hover:text-primary">{s.title}</a></li>)}
          </ul>
        </nav>
        <article className="max-w-3xl space-y-8">
          {i18n.language === 'gu' && (
            <section lang="gu" className="rounded-card border border-primary-100 bg-primary-50 p-6">
              <h2 className="font-display text-lg font-bold text-navy">{t('legal.summary')}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                {SUMMARY_GU[kind].map((x) => <li key={x} className="flex gap-2"><span className="text-primary">•</span>{x}</li>)}
              </ul>
            </section>
          )}
          {sections.map((s) => (
            <section key={s.id} id={s.id} lang="en" className="scroll-mt-24">
              <h2 className="font-display text-xl font-bold text-navy">{s.title}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink">
                {s.body.map((b, i) => (Array.isArray(b)
                  ? <ul key={i} className="space-y-2">{b.map((li) => <li key={li} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />{li}</li>)}</ul>
                  : <p key={i}>{b}</p>))}
              </div>
            </section>
          ))}
          <p className="border-t border-line pt-6 text-sm text-ink-muted">
            {t('legal.questions')} {kind === 'privacy'
              ? <Link to="/terms" className="font-semibold text-primary hover:underline">{t('legal.terms')}</Link>
              : <Link to="/privacy" className="font-semibold text-primary hover:underline">{t('legal.privacy')}</Link>}
          </p>
        </article>
      </div>
    </div>
  );
}

export const PrivacyPage = () => <LegalPage kind="privacy" />;
export const TermsPage = () => <LegalPage kind="terms" />;
