/**
 * ADMIN PANEL → USERS (super admins only)
 *
 *   /users       UsersPage       table of every account, with tabs (All / Creators / Brands / No role yet / Team) and search
 *                                → calls GET /api/v1/admin/users
 *   /users/:id   UserDetailPage  everything about one account + actions
 *                                → calls GET  /api/v1/admin/users/:id
 *                                → "Set new password" dialog  → POST /api/v1/admin/users/:id/password
 *                                → "Suspend" / "Re-activate"  → POST /api/v1/admin/users/:id/status
 *
 * Why there is no "show password": passwords are stored only as one-way hashes, so nobody (not even us) can read them.
 * To get into a test account, set a new password here. The user is logged out everywhere and gets an email about it.
 */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES, CITIES, catalogLabel } from '@bluenova/shared';
import { Alert, Badge, Button, Card, Dialog, EmptyState, ExternalLink, Field, Input, PasswordInput, PageHeader, cx } from '@bluenova/ui';
import { Search } from 'lucide-react';
import { api, date, label } from '../lib';
import { QState, Status, useAction } from './Pages';

const city = (k: string | null | undefined) => (k ? catalogLabel(CITIES, k, 'en') : '—');
const cat = (k: string) => catalogLabel(CATEGORIES, k, 'en');

/* ---------- types: the exact shapes the API returns (see apps/api/src/modules/admin/users.routes.ts) ---------- */

interface Account {
  id: string; name: string | null; email: string; role: 'creator' | 'brand' | 'admin' | null; adminRole: string | null;
  status: string; emailVerified: boolean; signIn: { password: boolean; google: boolean }; preferredLanguage: string | null;
  createdAt: string | null; lastLoginAt: string | null; passwordChangedAt: string | null;
}
interface UserRow extends Account {
  profile: { kind: 'creator' | 'brand'; id: string; title: string | null; igHandle: string | null; city: string | null; status: string; phone: string | null } | null;
}
interface UserDetail extends Account {
  consents: { type: string; version: string; acceptedAt: string }[];
  activeSessions: { kind: string; ip: string | null; device: string | null; since: string }[];
  creator: {
    id: string; status: string; displayName: string | null; fullName: string | null; phone: string | null; igHandle: string | null;
    city: string | null; categories: string[]; languages: string[]; bio: string | null; gender: string | null; ageGroup: string | null;
    stats: { followers: number | null; avgViews: number | null; engagementRate: number | null };
  } | null;
  brand: {
    id: string; status: string; companyName: string | null; contactName: string | null; designation: string | null; phone: string | null;
    gstin: string | null; industry: string | null; city: string | null; website: string | null;
  } | null;
}
type Counts = { all: number; creator: number; brand: number; none: number; admin: number };

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'creator', label: 'Creators' },
  { key: 'brand', label: 'Brands' },
  { key: 'none', label: 'No role yet' },
  { key: 'admin', label: 'Team' },
] as const;

function RoleBadge({ u }: { u: Account }) {
  if (u.role === 'admin') return <Badge tone="teal">Team · {label(u.adminRole)}</Badge>;
  if (u.role === 'creator') return <Badge tone="blue">Creator</Badge>;
  if (u.role === 'brand') return <Badge tone="amber">Brand</Badge>;
  return <Badge tone="grey">No role yet</Badge>;
}

function SignInMethods({ s }: { s: Account['signIn'] }) {
  return <span className="text-xs text-ink-muted">{[s.password && 'Email + password', s.google && 'Google'].filter(Boolean).join(' · ') || '—'}</span>;
}

/* ---------- list ---------- */

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('role') ?? 'all') as (typeof TABS)[number]['key'];
  const [search, setSearch] = useState('');
  const [q, setQ] = useState(''); // the search actually sent (on Enter / button), so we don't call the API on every keystroke

  const query = useQuery({
    queryKey: ['users', tab, q],
    queryFn: () => api.getWithMeta<UserRow[]>(`/admin/users?limit=100${tab !== 'all' ? `&role=${tab}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const counts = query.data?.meta?.counts as Counts | undefined;
  const rows = query.data?.data ?? [];

  return (
    <div>
      <PageHeader title="Users" subtitle="Every account on the website: creators, brands, people who haven't chosen yet, and the team." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'all' ? {} : { role: t.key })}
            className={cx('rounded-full px-3 py-1.5 text-sm font-semibold', tab === t.key ? 'bg-primary text-white' : 'bg-white text-ink-muted ring-1 ring-line hover:bg-bg')}>
            {t.label}{counts ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>
      <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
        <Input aria-label="Search" placeholder="Search name or email" icon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {query.isLoading || query.error ? <QState q={query} /> : rows.length === 0 ? <EmptyState title="No users here" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-ink-muted">
              <tr><th className="p-3">Person</th><th className="p-3">Type</th><th className="p-3">Profile</th><th className="p-3">Phone</th><th className="p-3">Account</th><th className="p-3">Joined</th><th className="p-3">Last login</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-bg">
                  <td className="p-3">
                    <Link className="font-semibold text-primary" to={`/users/${u.id}`}>{u.name ?? '—'}</Link>
                    <div className="text-xs text-ink-muted">{u.email}</div>
                    <SignInMethods s={u.signIn} />
                  </td>
                  <td className="p-3"><RoleBadge u={u} /></td>
                  <td className="p-3">
                    {u.profile ? (
                      <>
                        <div>{u.profile.title ?? <span className="text-ink-muted">not filled yet</span>}{u.profile.igHandle ? <span className="text-ink-muted"> · @{u.profile.igHandle}</span> : null}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">{city(u.profile.city)} <Status s={u.profile.status} /></div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="p-3">{u.profile?.phone ?? '—'}</td>
                  <td className="p-3">
                    <Badge tone={u.status === 'active' ? 'green' : 'red'}>{label(u.status)}</Badge>
                    {!u.emailVerified && <div className="mt-1 text-xs text-warning">Email not verified</div>}
                  </td>
                  <td className="p-3">{date(u.createdAt)}</td>
                  <td className="p-3">{date(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data?.meta?.nextCursor ? <p className="mt-3 text-sm text-ink-muted">Showing the newest 100. Use search to find older accounts.</p> : null}
    </div>
  );
}

/* ---------- one user ---------- */

export function UserDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api.get<UserDetail>(`/admin/users/${id}`) });
  const [pwOpen, setPwOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (q.isLoading || q.error) return <QState q={q} />;
  const u = q.data!;
  const isTeam = u.role === 'admin';

  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div><dt className="text-ink-muted">{k}</dt><dd className="break-words">{v ?? '—'}</dd></div>
  );

  return (
    <div className="space-y-4">
      <Link to="/users" className="text-sm font-semibold text-primary">← Users</Link>
      <PageHeader title={u.name ?? u.email} subtitle={u.email} action={<RoleBadge u={u} />} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Account</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row k="Status" v={<Badge tone={u.status === 'active' ? 'green' : 'red'}>{label(u.status)}</Badge>} />
            <Row k="Email verified" v={u.emailVerified ? 'Yes' : 'No (has not entered the email code yet)'} />
            <Row k="Logs in with" v={<SignInMethods s={u.signIn} />} />
            <Row k="Password" v={u.signIn.password ? 'Set (hidden, stored as a one-way hash)' : 'None (Google-only account)'} />
            <Row k="Password last changed" v={date(u.passwordChangedAt)} />
            <Row k="Language" v={u.preferredLanguage === 'gu' ? 'Gujarati' : 'English'} />
            <Row k="Joined" v={date(u.createdAt)} />
            <Row k="Last login" v={date(u.lastLoginAt)} />
            <Row k="Accepted" v={u.consents.map((c) => `${label(c.type)} ${c.version} (${date(c.acceptedAt)})`).join(', ') || '—'} />
          </dl>

          {u.creator && (
            <>
              <h2 className="mb-3 mt-6 font-semibold">Creator profile <Status s={u.creator.status} /></h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Row k="Display name" v={u.creator.displayName} />
                <Row k="Full name" v={u.creator.fullName} />
                <Row k="WhatsApp / phone" v={u.creator.phone} />
                <Row k="Instagram" v={u.creator.igHandle ? <ExternalLink href={`https://www.instagram.com/${u.creator.igHandle}/`}>@{u.creator.igHandle}</ExternalLink> : null} />
                <Row k="City" v={city(u.creator.city)} />
                <Row k="Categories" v={u.creator.categories.map(cat).join(', ') || null} />
                <Row k="Languages" v={u.creator.languages.join(', ') || null} />
                <Row k="Gender / age" v={`${label(u.creator.gender)} / ${u.creator.ageGroup ?? '—'}`} />
                <Row k="Followers / avg views" v={`${u.creator.stats.followers?.toLocaleString('en-IN') ?? '—'} / ${u.creator.stats.avgViews?.toLocaleString('en-IN') ?? '—'}`} />
                <Row k="Engagement" v={u.creator.stats.engagementRate != null ? `${u.creator.stats.engagementRate}%` : null} />
              </dl>
              {u.creator.bio && <p className="mt-3 text-sm">{u.creator.bio}</p>}
              <Link className="mt-3 inline-block text-sm font-semibold text-primary" to={`/creators/${u.creator.id}`}>Open in the review screen →</Link>
            </>
          )}

          {u.brand && (
            <>
              <h2 className="mb-3 mt-6 font-semibold">Brand profile <Status s={u.brand.status} /></h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Row k="Company" v={u.brand.companyName} />
                <Row k="Contact person" v={`${u.brand.contactName ?? '—'}${u.brand.designation ? ` (${u.brand.designation})` : ''}`} />
                <Row k="Phone" v={u.brand.phone} />
                <Row k="GSTIN" v={u.brand.gstin} />
                <Row k="Industry" v={u.brand.industry ? cat(u.brand.industry) : null} />
                <Row k="City" v={city(u.brand.city)} />
                <Row k="Website" v={u.brand.website ? <ExternalLink href={u.brand.website}>{u.brand.website}</ExternalLink> : null} />
              </dl>
            </>
          )}

          {!u.creator && !u.brand && !isTeam && (
            <Alert tone="blue" title="No profile yet">This person has signed up but hasn't chosen "creator" or "brand" yet.</Alert>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Actions</h2>
            {isTeam ? (
              <p className="mt-2 text-sm text-ink-muted">Team accounts are protected by an authenticator app. Team members change their own password in Settings.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <Button block variant="secondary" onClick={() => setPwOpen(true)}>Set new password</Button>
                <Button block variant={u.status === 'active' ? 'danger' : 'primary'} onClick={() => setStatusOpen(true)}>
                  {u.status === 'active' ? 'Suspend account' : 'Re-activate account'}
                </Button>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Logged-in devices ({u.activeSessions.length})</h2>
            <ul className="mt-2 space-y-2 text-xs text-ink-muted">
              {u.activeSessions.length === 0 && <li>None right now.</li>}
              {u.activeSessions.map((s, i) => (
                <li key={i}><span className="font-semibold text-ink">{date(s.since)}</span> · {s.ip ?? '—'}<div className="truncate">{s.device ?? ''}</div></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <SetPasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} user={u} />
      <StatusDialog open={statusOpen} onClose={() => setStatusOpen(false)} user={u} />
    </div>
  );
}

/* ---------- dialogs (pop-up windows) ---------- */

/** Pop-up: type a new password twice + a reason. The API checks the same password rules as signup. */
function SetPasswordDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: UserDetail }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const close = () => { setPassword(''); setConfirm(''); setReason(''); setDone(false); onClose(); };
  const save = useAction(() => api.post(`/admin/users/${user.id}/password`, { password, reason }), [['user', user.id]]);
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <Dialog open={open} onClose={close} title={`Set a new password for ${user.name ?? user.email}`}
      footer={done ? <Button onClick={close}>Close</Button> : (
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button loading={save.isPending} disabled={!password || password !== confirm || reason.trim().length < 3}
            onClick={() => save.mutate(undefined, { onSuccess: () => { setDone(true); setPassword(''); setConfirm(''); } })}>Save password</Button>
        </>
      )}>
      {done ? (
        <Alert tone="green" title="Password changed">They have been logged out of every device and emailed about the change. Share the new password with them privately.</Alert>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">At least 8 characters with letters and numbers, not a common password, and not containing their name or email.</p>
          <Field label="New password">{(id) => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <Field label="Type it again" error={mismatch ? "Passwords don't match." : undefined}>{(id) => <PasswordInput id={id} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
          <Field label="Reason (saved in the audit log)">{(id) => <Input id={id} maxLength={300} placeholder="e.g. testing, user asked by phone" value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          {save.error && <Alert tone="red">{save.error}</Alert>}
        </div>
      )}
    </Dialog>
  );
}

/** Pop-up: suspend (logs them out everywhere, blocks login) or re-activate, with a reason. */
function StatusDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: UserDetail }) {
  const suspending = user.status === 'active';
  const [reason, setReason] = useState('');
  const close = () => { setReason(''); onClose(); };
  const save = useAction(() => api.post(`/admin/users/${user.id}/status`, { status: suspending ? 'suspended' : 'active', reason }), [['user', user.id], ['users']]);
  return (
    <Dialog open={open} onClose={close} title={suspending ? 'Suspend this account?' : 'Re-activate this account?'}
      footer={(
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant={suspending ? 'danger' : 'primary'} loading={save.isPending} disabled={reason.trim().length < 3}
            onClick={() => save.mutate(undefined, { onSuccess: close })}>{suspending ? 'Suspend' : 'Re-activate'}</Button>
        </>
      )}>
      <p className="mb-4 text-sm text-ink-muted">
        {suspending ? 'They are logged out of every device immediately and cannot log in until re-activated.' : 'They will be able to log in again.'}
      </p>
      <Field label="Reason (saved in the audit log)">{(id) => <Input id={id} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      {save.error && <div className="mt-3"><Alert tone="red">{save.error}</Alert></div>}
    </Dialog>
  );
}
