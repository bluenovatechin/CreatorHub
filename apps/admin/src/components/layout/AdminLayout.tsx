import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Contact, FileClock, Inbox, LayoutDashboard, LogOut, MailCheck, Megaphone, Settings, ShieldAlert, Users, Wallet,
} from 'lucide-react';
import { Avatar, cx } from '@bluenova/ui';
import { can, useAdmin, useFeatures } from '../../lib';
import { AdminLogo } from '../../pages/auth';

export function AdminLayout() {
  const { me, signOut } = useAdmin();
  const { paymentsEnabled } = useFeatures();
  const navigate = useNavigate();
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true, end: true },
    { to: '/creators', label: 'Creators', icon: Users, show: can(me, 'reviewer', 'campaign_manager') },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone, show: can(me, 'campaign_manager') },
    { to: '/deals', label: 'Work review', icon: ClipboardCheck, show: can(me, 'reviewer', 'campaign_manager') },
    { to: '/inbox', label: 'Inbox', icon: Inbox, show: can(me, 'reviewer', 'campaign_manager', 'finance') },
    { to: '/trust', label: 'Disputes & reports', icon: ShieldAlert, show: can(me, 'reviewer', 'campaign_manager') },
    { to: '/payments', label: 'Payments', icon: Wallet, show: paymentsEnabled && can(me, 'finance', 'campaign_manager') },
    { to: '/users', label: 'Users', icon: Contact, show: me?.adminRole === 'super_admin' },
    { to: '/audit-logs', label: 'Audit log', icon: FileClock, show: me?.adminRole === 'super_admin' },
    { to: '/emails', label: 'Email log', icon: MailCheck, show: me?.adminRole === 'super_admin' },
    { to: '/settings', label: 'Settings', icon: Settings, show: true },
  ].filter((i) => i.show);
  const logout = async () => { await signOut(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy px-4 py-5 text-white lg:flex">
        <AdminLogo light />
        <nav className="mt-8 flex-1">
          <ul className="space-y-1">
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-white text-navy' : 'text-primary-100 hover:bg-white/10')}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rounded-card bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={me?.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{me?.name}</p>
              <p className="truncate text-xs capitalize text-primary-200">{me?.adminRole.replace('_', ' ')}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-primary-100 hover:bg-white/10">
            <LogOut className="h-4 w-4" />Log out
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <AdminLogo />
            <button type="button" onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-bg" aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2">
            {items.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold', isActive ? 'bg-primary text-white' : 'text-ink-muted')}>
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        {me?.adminTotpRequired === false && (
          <div role="alert" className="bg-danger px-4 py-2 text-center text-sm font-semibold text-white">
            Two-step login is OFF (testing). Anyone with an admin password can get in. Turn it back on: ADMIN_TOTP_REQUIRED=true on the API.
          </div>
        )}
        <main className="mx-auto max-w-6xl animate-fade-up px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
