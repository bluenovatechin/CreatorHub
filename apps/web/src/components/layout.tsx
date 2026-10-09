/**
 * PAGE FRAMES: PublicLayout (home/marketing pages), AuthLayout (login/signup split screen),
 * AppLayout (creator/brand area: sidebar, bell icon, language switch, logout). Also Logo and LanguageSwitch.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Briefcase, CheckCircle2, Handshake, Home, LayoutDashboard, LogOut, Mail, Megaphone, Menu, Phone, Send,
  Settings, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { Avatar, cx } from '@bluenova/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { setLang, type Lang } from '../lib/i18n';
import { useAppConfig } from '../lib/config';

export function Logo({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Bluenova Creator Hub">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient font-display text-lg font-extrabold text-white shadow-btn" aria-hidden="true">B</span>
      <span className={cx('font-display leading-none', light ? 'text-white' : 'text-navy')}>
        <span className="block text-[17px] font-extrabold tracking-tight">Bluenova</span>
        <span className={cx('block text-[11px] font-semibold uppercase tracking-[0.14em]', light ? 'text-primary-200' : 'text-primary')}>Creator Hub</span>
      </span>
    </Link>
  );
}

export function LanguageSwitch({ dark = false }: { dark?: boolean }) {
  const { i18n, t } = useTranslation();
  const { me } = useAuth();
  const change = (lang: Lang) => {
    setLang(lang);
    if (me) void api.patch('/me/preferences', { preferredLanguage: lang }).catch(() => undefined);
  };
  return (
    <div className={cx('flex rounded-full p-0.5 text-sm', dark ? 'bg-white/10' : 'border border-line bg-white')} role="group" aria-label={t('common.language')}>
      {(['gu', 'en'] as const).map((l) => (
        <button key={l} type="button" onClick={() => change(l)} aria-pressed={i18n.language === l}
          className={cx('min-h-8 rounded-full px-3 font-semibold transition', i18n.language === l ? 'bg-primary text-white shadow-sm' : dark ? 'text-primary-100 hover:text-white' : 'text-ink-muted hover:text-ink')}>
          {l === 'gu' ? 'ગુ' : 'EN'}
        </button>
      ))}
    </div>
  );
}

/** Shown on every page while the live site runs in test mode. */
function TestBanner() {
  const { t } = useTranslation();
  const { testMode } = useAppConfig();
  if (!testMode) return null;
  return <div role="note" className="bg-sun px-4 py-1.5 text-center text-xs font-bold text-navy">🧪 {t('common.testBanner')}</div>;
}

function SkipLink() {
  const { t } = useTranslation();
  return <><TestBanner /><a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-lift">{t('nav.skip')}</a></>;
}

/* ---------------- Public site ---------------- */

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-20 bg-navy text-primary-100">
      <div className="mx-auto grid max-w-content gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-200">{t('footer.tagline')}</p>
          <p className="mt-4 flex items-center gap-2 text-sm text-primary-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('safety.otp')}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{t('footer.platform')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/for-creators">{t('nav.forCreators')}</Link></li>
            <li><Link className="hover:text-white" to="/for-brands">{t('nav.forBrands')}</Link></li>
            <li><Link className="hover:text-white" to="/signup">{t('nav.signup')}</Link></li>
            <li><Link className="hover:text-white" to="/login">{t('nav.login')}</Link></li>
            <li><Link className="hover:text-white" to="/privacy">{t('legal.privacy')}</Link></li>
            <li><Link className="hover:text-white" to="/terms">{t('legal.terms')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{t('common.contact')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="flex items-center gap-2 hover:text-white" href="tel:+917600236644"><Phone className="h-4 w-4" aria-hidden="true" />+91 76002 36644</a></li>
            <li><a className="flex items-center gap-2 hover:text-white" href="https://bluenovatech.in" target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4" aria-hidden="true" />bluenovatech.in</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-content px-4 py-5 text-xs text-primary-300">{t('footer.rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const dash = me ? (me.role ? `/${me.role}` : '/welcome/role') : null;
  const links = [
    { to: '/for-creators', label: t('nav.forCreators') },
    { to: '/for-brands', label: t('nav.forBrands') },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label={t('nav.menu')}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-semibold transition', isActive ? 'text-primary' : 'text-ink-muted hover:text-navy')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LanguageSwitch /></div>
            {dash ? (
              <Link to={dash} className="inline-flex min-h-10 items-center gap-2 rounded-ctl bg-primary px-4 text-sm font-semibold text-white shadow-btn hover:bg-primary-hover">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />{t('nav.dashboard')}
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden min-h-10 items-center rounded-ctl px-3 text-sm font-semibold text-navy hover:bg-primary-50 sm:inline-flex">{t('nav.login')}</Link>
                <Link to="/signup" className="inline-flex min-h-10 items-center rounded-ctl bg-primary px-4 text-sm font-semibold text-white shadow-btn hover:bg-primary-hover">{t('nav.signup')}</Link>
              </>
            )}
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-navy hover:bg-bg md:hidden" onClick={() => setOpen((o) => !o)}
              aria-expanded={open} aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-line bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label={t('nav.menu')}>
              {links.map((l) => <Link key={l.to} to={l.to} className="rounded-lg px-3 py-3 font-semibold text-navy hover:bg-bg">{l.label}</Link>)}
              {!me && <Link to="/login" className="rounded-lg px-3 py-3 font-semibold text-navy hover:bg-bg">{t('nav.login')}</Link>}
            </nav>
            <div className="mt-3"><LanguageSwitch /></div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

/* ---------------- Auth (split screen) ---------------- */

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const points = [
    { icon: CheckCircle2, text: t('auth.side1') },
    { icon: Handshake, text: t('auth.side2') },
    { icon: ShieldCheck, text: t('auth.side3') },
  ];
  return (
    <div className="flex min-h-screen bg-white">
      <SkipLink />
      <aside className="relative hidden w-[44%] max-w-xl overflow-hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
        <Logo light />
        <div className="relative mt-auto">
          <h2 className="font-display text-3xl font-extrabold leading-tight">{t('auth.sideTitle')}</h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Icon className="h-5 w-5 text-white" aria-hidden="true" /></span>{text}
              </li>
            ))}
          </ul>
          <p className="mt-12 flex items-center gap-2 text-sm text-primary-200"><Phone className="h-4 w-4" aria-hidden="true" />+91 76002 36644 · bluenovatech.in</p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <div className="lg:invisible"><Logo /></div>
          <LanguageSwitch />
        </div>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-md animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- Signed-in app ---------------- */

interface NavItem { to: string; label: string; icon: typeof Home; end?: boolean }

export function AppLayout({ area }: { area: 'creator' | 'brand' }) {
  const { t } = useTranslation();
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.getWithMeta<unknown[]>('/notifications').then((r) => Number(r.meta?.unread ?? 0)),
    refetchInterval: 60_000,
  });

  const items: NavItem[] = area === 'creator'
    ? me?.creator?.status === 'APPROVED'
      ? [
        { to: '/creator', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: '/creator/opportunities', label: t('nav.opportunities'), icon: Sparkles },
        { to: '/creator/offers', label: t('nav.offers'), icon: Mail },
        { to: '/creator/deals', label: t('nav.deals'), icon: Handshake },
        { to: '/creator/settings', label: t('nav.settings'), icon: Settings },
      ]
      : [
        { to: '/creator/status', label: t('nav.dashboard'), icon: LayoutDashboard },
        { to: '/creator/settings', label: t('nav.settings'), icon: Settings },
      ]
    : me?.brand?.status === 'ACTIVE'
      ? [
        { to: '/brand', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: '/brand/campaigns', label: t('nav.campaigns'), icon: Megaphone },
        { to: '/brand/deals', label: t('nav.deals'), icon: Handshake },
        { to: '/brand/settings', label: t('nav.settings'), icon: Settings },
      ]
      : [
        { to: '/brand/onboarding', label: t('nav.dashboard'), icon: Briefcase },
        { to: '/brand/settings', label: t('nav.settings'), icon: Settings },
      ];

  const displayName = area === 'brand' ? me?.brand?.companyName ?? me?.name : me?.creator?.displayName ?? me?.name;
  const logout = async () => { await signOut(); navigate('/'); };

  return (
    <div className="min-h-screen bg-bg pb-20 lg:pb-0">
      <SkipLink />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-4 py-5 lg:flex">
        <Logo to={`/${area}`} />
        <nav className="mt-8 flex-1" aria-label={t('nav.menu')}>
          <ul className="space-y-1">
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => cx(
                  'flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-primary text-white shadow-btn' : 'text-ink-muted hover:bg-primary-50 hover:text-navy',
                )}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rounded-card border border-line bg-bg p-3">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-navy">{displayName}</p>
              <p className="truncate text-xs text-ink-muted">{me?.email}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-ink-muted hover:bg-white hover:text-danger">
            <LogOut className="h-4 w-4" aria-hidden="true" />{t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-lg">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="lg:hidden"><Logo to={`/${area}`} /></div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <Link to={`/${area}/notifications`} className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-bg hover:text-navy" aria-label={t('nav.notifications')}>
                <Bell className="h-5 w-5" aria-hidden="true" />
                {!!unread.data && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-white">
                    {unread.data > 9 ? '9+' : unread.data}
                  </span>
                )}
              </Link>
              <button type="button" onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-bg hover:text-danger lg:hidden" aria-label={t('nav.logout')}>
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl animate-fade-up px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden" aria-label={t('nav.menu')}>
        <ul className="flex">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end} className={({ isActive }) => cx('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-primary' : 'text-ink-faint')}>
                {({ isActive }) => (
                  <>
                    <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition', isActive && 'bg-primary-soft')}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
