/**
 * UI COMPONENTS (Tailwind CSS). Accessible by default: labels linked to inputs, errors announced,
 * dialogs trap focus and close on Esc. Colours/fonts come from tailwind-preset.cjs. Guide: docs/DESIGN.md.
 */
import {
  forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Circle, Eye, EyeOff, Info, Loader2, X, XCircle } from 'lucide-react';

export const cx = (...c: (string | number | false | null | undefined)[]) => c.filter((x) => typeof x === 'string' && x).join(' ');

/* ---------- Button ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'white';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-btn hover:bg-primary-hover active:translate-y-px',
  accent: 'bg-accent text-white shadow-sm hover:bg-accent-hover active:translate-y-px',
  secondary: 'bg-white text-ink border border-line-strong hover:border-primary-300 hover:bg-primary-50',
  ghost: 'text-primary hover:bg-primary-soft',
  danger: 'bg-danger text-white hover:brightness-95',
  white: 'bg-white text-navy shadow-sm hover:bg-primary-50',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, block, size = 'md', icon, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-ctl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55',
        size === 'lg' && 'min-h-12 px-6 text-[15px]', size === 'md' && 'min-h-11 px-4 text-sm', size === 'sm' && 'min-h-9 px-3 text-sm',
        variants[variant], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin', className ?? 'h-5 w-5')} aria-hidden="true" />;
}

/* ---------- Form fields ---------- */

export interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  action?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint + error, wired up for screen readers. */
export function Field({ label, error, hint, required, action, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}{required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
        {action}
      </div>
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined)}
      {hint && !error && <p id={hintId} className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />{error}
        </p>
      )}
    </div>
  );
}

const control = 'block w-full rounded-ctl border bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-bg disabled:text-ink-muted';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode; trailing?: ReactNode }>(
  function Input({ className, invalid, icon, trailing, ...rest }, ref) {
    const input = (
      <input ref={ref} aria-invalid={invalid || undefined}
        className={cx(control, 'min-h-12', icon && 'pl-10', trailing && 'pr-11', invalid ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-line-strong', className)} {...rest} />
    );
    if (!icon && !trailing) return input;
    return (
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
        {input}
        {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    );
  },
);

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode; showLabel?: string; hideLabel?: string }>(
  function PasswordInput({ showLabel = 'Show password', hideLabel = 'Hide password', ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <Input ref={ref} type={show ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} {...rest}
        trailing={(
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? hideLabel : showLabel} aria-pressed={show}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-bg hover:text-ink">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )} />
    );
  },
);

/** Live password checklist + strength bar. */
export function PasswordStrength({ password, labels }: {
  password: string;
  labels: { length: string; mix: string; strength: string; levels: [string, string, string, string, string] };
}) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const colors = ['bg-line', 'bg-danger', 'bg-sun', 'bg-accent', 'bg-success'];
  const rules = [
    { ok: password.length >= 8, text: labels.length },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), text: labels.mix },
  ];
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full transition', i <= score ? colors[score] : 'bg-line')} />)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {rules.map((r) => (
            <li key={r.text} className={cx('flex items-center gap-1', r.ok ? 'text-success' : 'text-ink-muted')}>
              {r.ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}{r.text}
            </li>
          ))}
        </ul>
        {password && <span className="font-semibold text-ink-muted">{labels.strength}: {labels.levels[score]}</span>}
      </div>
    </div>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cx(control, 'min-h-28 py-3', invalid ? 'border-danger' : 'border-line-strong', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} aria-invalid={invalid || undefined}
          className={cx(control, 'min-h-12 appearance-none pr-10', invalid ? 'border-danger' : 'border-line-strong', className)} {...rest}>{children}</select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      </div>
    );
  },
);

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(
  function Checkbox({ label, className, ...rest }, ref) {
    return (
      <label className={cx('flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink', className)}>
        <input ref={ref} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary" {...rest} />
        <span>{label}</span>
      </label>
    );
  },
);

/** Tap-to-select chips for multi-select lists (categories, cities...). */
export function ChipSelect({
  options, value, onChange, max, labelledBy,
}: {
  options: { value: string; label: string; icon?: ReactNode }[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  labelledBy?: string;
}) {
  const atMax = max !== undefined && value.length >= max;
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            disabled={!selected && atMax}
            onClick={() => onChange(selected ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx(
              'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40',
              selected ? 'border-primary bg-primary text-white shadow-sm' : 'border-line-strong bg-white text-ink hover:border-primary-300 hover:bg-primary-50',
            )}
          >
            {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Large selectable cards (e.g. "I'm a Creator" / "I'm a Brand"). */
export function ChoiceCards<T extends string>({ options, value, onChange, labelledBy }: {
  options: { value: T; title: string; text: string; icon: ReactNode }[];
  value: T | undefined;
  onChange: (v: T) => void;
  labelledBy?: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cx('relative flex items-start gap-3 rounded-card border-2 bg-white p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
              on ? 'border-primary bg-primary-50 shadow-sm' : 'border-line hover:border-primary-300')}>
            <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', on ? 'bg-primary text-white' : 'bg-primary-soft text-primary')} aria-hidden="true">{o.icon}</span>
            <span>
              <span className="block font-semibold text-navy">{o.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{o.text}</span>
            </span>
            {on && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Layout pieces ---------- */

export function Card({ className, children, as: Tag = 'div', padded = true }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article'; padded?: boolean }) {
  return <Tag className={cx('rounded-card border border-line bg-surface shadow-card', padded && 'p-5 sm:p-6', className)}>{children}</Tag>;
}

export function CardHeader({ icon, title, subtitle, action }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">{icon}</span>}
        <div>
          <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'blue' }: { icon: ReactNode; label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'blue' | 'teal' | 'amber' | 'green' }) {
  const t = { blue: 'bg-primary-soft text-primary', teal: 'bg-accent-soft text-accent', amber: 'bg-sun-soft text-warning', green: 'bg-success-soft text-success' }[tone];
  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-card">
      <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5', t)} aria-hidden="true">{icon}</span>
      <p className="mt-4 font-display text-3xl font-extrabold text-navy">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-ink-muted">{label}</p>
      {hint && <p className="mt-2 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
  const s = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' }[size];
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 font-bold text-white', s)} aria-hidden="true">{initials}</span>;
}

export type Tone = 'grey' | 'blue' | 'amber' | 'teal' | 'green' | 'red';
const tones: Record<Tone, string> = {
  grey: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-info-soft text-info ring-sky-200',
  amber: 'bg-warning-soft text-warning ring-amber-200',
  teal: 'bg-accent-soft text-teal-800 ring-teal-200',
  green: 'bg-success-soft text-green-800 ring-green-200',
  red: 'bg-danger-soft text-danger ring-red-200',
};
const toneDot: Record<Tone, string> = { grey: 'bg-slate-400', blue: 'bg-info', amber: 'bg-warning', teal: 'bg-accent', green: 'bg-success', red: 'bg-danger' };

/** Status badge: dot + text, never colour alone. */
export function Badge({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', tones[tone])}>
      <span className={cx('h-1.5 w-1.5 rounded-full', toneDot[tone])} aria-hidden="true" />{children}
    </span>
  );
}

export function Tag({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-lg bg-bg px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}{children}</span>;
}

export function Alert({ tone = 'blue', title, children, action }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'red' ? XCircle : tone === 'green' ? CheckCircle2 : tone === 'amber' ? AlertCircle : Info;
  return (
    <div role="status" className={cx('flex gap-3 rounded-ctl p-4 text-sm ring-1 ring-inset', tones[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx('leading-relaxed', title && 'mt-0.5 opacity-90')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center">
      {icon && <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary [&>svg]:h-7 [&>svg]:w-7" aria-hidden="true">{icon}</span>}
      <p className="font-display text-lg font-bold text-navy">{title}</p>
      {text && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Horizontal progress for multi-step forms. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <p className="mb-3 text-sm font-medium text-ink-muted sm:hidden">{current} / {steps.length} · <span className="font-semibold text-navy">{steps[current - 1]}</span></p>
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? 'done' : n === current ? 'current' : 'todo';
          return (
            <li key={s} className={cx('flex items-center', i < steps.length - 1 && 'flex-1')} aria-current={state === 'current' ? 'step' : undefined}>
              <div className="flex flex-col items-center gap-1.5">
                <span className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition',
                  state === 'done' && 'bg-accent text-white', state === 'current' && 'bg-primary text-white ring-4 ring-primary/15', state === 'todo' && 'border-2 border-line-strong bg-white text-ink-faint',
                )}>{state === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : n}</span>
                <span className={cx('hidden whitespace-nowrap text-xs sm:block', state === 'current' ? 'font-bold text-navy' : 'font-medium text-ink-muted')}>{s}</span>
              </div>
              {i < steps.length - 1 && <span className={cx('mx-2 mb-0 h-0.5 flex-1 rounded-full sm:mb-5', n < current ? 'bg-accent' : 'bg-line')} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Vertical status timeline: what happened, and what's next. */
export function Timeline({ items }: { items: { label: ReactNode; state: 'done' | 'current' | 'todo' | 'failed'; note?: ReactNode }[] }) {
  return (
    <ol className="relative space-y-5">
      {items.map((it, i) => (
        <li key={i} className="relative flex gap-4">
          {i < items.length - 1 && <span className={cx('absolute left-[15px] top-9 h-[calc(100%-12px)] w-0.5', it.state === 'done' ? 'bg-accent' : 'bg-line')} aria-hidden="true" />}
          <span className={cx(
            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            it.state === 'done' && 'bg-accent text-white', it.state === 'current' && 'bg-primary text-white ring-4 ring-primary/15',
            it.state === 'todo' && 'border-2 border-line-strong bg-white text-ink-faint', it.state === 'failed' && 'bg-danger text-white',
          )} aria-hidden="true">{it.state === 'done' ? <Check className="h-4 w-4" /> : it.state === 'failed' ? <X className="h-4 w-4" /> : i + 1}</span>
          <div className="pt-1">
            <p className={cx('font-semibold', it.state === 'todo' ? 'text-ink-faint' : 'text-navy')}>{it.label}</p>
            {it.note && <p className="mt-0.5 text-sm text-ink-muted">{it.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-line/70', className)} aria-hidden="true" />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="space-y-4 py-6" role="status" aria-label={label ?? 'Loading'}>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <Skeleton className="h-40" />
    </div>
  );
}

/** Accessible modal dialog (Esc closes, focus moves inside). */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className="max-h-[90vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-card bg-white p-6 shadow-lift outline-none sm:rounded-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-bg"><X className="h-5 w-5" /></button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

/** Copies text to the clipboard and briefly confirms. */
export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied' }: { value: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
    }} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary-soft">
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}{copied ? copiedLabel : label}
    </button>
  );
}

/** Only renders https links, always with noopener/noreferrer. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  let safe = false;
  try {
    safe = new URL(href).protocol === 'https:';
  } catch {
    safe = false;
  }
  if (!safe) return <span className={className}>{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cx('font-medium text-primary underline-offset-2 hover:underline', className)}>{children}</a>;
}
