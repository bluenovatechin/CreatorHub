/**
 * SEARCHABLE PICKERS for long lists (e.g. 120+ Gujarat cities), used by the website and the admin panel.
 *   SearchSelect       pick ONE  (a creator's or brand's home city)
 *   SearchMultiSelect  pick MANY (areas a creator covers / a brand wants promotions in), shown as removable chips
 * Typing filters the list (matches English or Gujarati, anywhere in the name), the first match is highlighted
 * automatically, and the typed letters are marked in each name. Keyboard: ↑/↓ move, Enter picks, Esc closes.
 * Accessible: combobox + listbox roles, aria-activedescendant, labels from <Field>.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cx } from './components';

export interface SearchOption { value: string; label: string; /** Extra words that also match (e.g. the name in the other language). */ alt?: string }

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKC').trim();

/** Wraps the first occurrence of `q` in <mark> so the person sees why an option matched. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? norm(text).indexOf(norm(q)) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-sun-soft px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function useFiltered(options: SearchOption[], query: string) {
  return useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    const starts: SearchOption[] = [];
    const contains: SearchOption[] = [];
    for (const o of options) {
      const hay = norm(`${o.label} ${o.alt ?? ''}`);
      if (norm(o.label).startsWith(q) || norm(o.alt ?? '').startsWith(q)) starts.push(o);
      else if (hay.includes(q)) contains.push(o);
    }
    return [...starts, ...contains]; // names that START with the text come first
  }, [options, query]);
}

interface ListProps {
  id: string; options: SearchOption[]; active: number; query: string; selected: (v: string) => boolean;
  onPick: (o: SearchOption) => void; onHover: (i: number) => void; empty: ReactNode;
}

function OptionList({ id, options, active, query, selected, onPick, onHover, empty }: ListProps) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    ref.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <ul ref={ref} id={id} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-ctl border border-line bg-white py-1 shadow-lift">
      {options.length === 0 ? <li className="px-3.5 py-2.5 text-sm text-ink-muted">{empty}</li> : options.map((o, i) => (
        <li key={o.value} id={`${id}-${i}`} data-index={i} role="option" aria-selected={selected(o.value)}
          onMouseDown={(e) => { e.preventDefault(); onPick(o); }} onMouseEnter={() => onHover(i)}
          className={cx('flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-sm', i === active ? 'bg-primary-50 text-navy' : 'text-ink')}>
          <span><Highlight text={o.label} q={query} />{o.alt && <span className="ml-1.5 text-ink-muted"><Highlight text={o.alt} q={query} /></span>}</span>
          {selected(o.value) && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
        </li>
      ))}
    </ul>
  );
}

/** Shared keyboard handling for both pickers. */
function useListKeys(count: number, onEnter: (i: number) => void, setOpen: (v: boolean) => void) {
  const [active, setActive] = useState(0);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(count - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { if (count > 0) { e.preventDefault(); onEnter(active); } }
    else if (e.key === 'Escape') setOpen(false);
  };
  return { active, setActive, onKeyDown };
}

export function SearchSelect({ id, options, value, onChange, placeholder, invalid, empty = 'No match', disabled }: {
  id?: string; options: SearchOption[]; value: string | null | undefined; onChange: (v: string) => void;
  placeholder?: string; invalid?: boolean; empty?: ReactNode; disabled?: boolean;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const listId = `${inputId}-list`;
  const current = options.find((o) => o.value === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = useFiltered(options, query);
  const pick = (o: SearchOption) => { onChange(o.value); setQuery(''); setOpen(false); };
  const { active, setActive, onKeyDown } = useListKeys(filtered.length, (i) => filtered[i] && pick(filtered[i]), setOpen);
  useEffect(() => setActive(0), [query, setActive]); // the first match is always highlighted
  return (
    <div className="relative">
      <input id={inputId} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={open && filtered.length ? `${listId}-${active}` : undefined} aria-invalid={invalid || undefined} disabled={disabled}
        value={open ? query : current ? `${current.label}${current.alt ? ` · ${current.alt}` : ''}` : ''}
        placeholder={current ? `${current.label}${current.alt ? ` · ${current.alt}` : ''}` : placeholder}
        onFocus={() => { setQuery(''); setOpen(true); }} onBlur={() => setOpen(false)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKeyDown}
        className={cx('block min-h-12 w-full rounded-ctl border bg-white px-3.5 pr-10 text-[15px] text-ink placeholder:text-ink-faint transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-bg',
          invalid ? 'border-danger' : 'border-line-strong')} />
      <ChevronDown className="pointer-events-none absolute right-3.5 top-4 h-4 w-4 text-ink-faint" aria-hidden="true" />
      {open && <OptionList id={listId} options={filtered} active={active} query={query} selected={(v) => v === value} onPick={pick} onHover={setActive} empty={empty} />}
    </div>
  );
}

export function SearchMultiSelect({ id, options, value, onChange, placeholder, invalid, max, empty = 'No match', removeLabel = 'Remove' }: {
  id?: string; options: SearchOption[]; value: string[]; onChange: (v: string[]) => void;
  placeholder?: string; invalid?: boolean; max?: number; empty?: ReactNode; removeLabel?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const listId = `${inputId}-list`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = useFiltered(options, query);
  const atMax = max !== undefined && value.length >= max;
  const toggle = (o: SearchOption) => {
    if (value.includes(o.value)) onChange(value.filter((v) => v !== o.value));
    else if (!atMax) onChange([...value, o.value]);
    setQuery('');
  };
  const { active, setActive, onKeyDown } = useListKeys(filtered.length, (i) => filtered[i] && toggle(filtered[i]), setOpen);
  useEffect(() => setActive(0), [query, setActive]);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div className="relative">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-medium text-white">
              {label(v)}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${removeLabel} ${label(v)}`} className="rounded-full p-0.5 hover:bg-white/20">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input id={inputId} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={open && filtered.length ? `${listId}-${active}` : undefined} aria-invalid={invalid || undefined}
        value={query} placeholder={placeholder} disabled={atMax && !open}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKeyDown}
        className={cx('block min-h-12 w-full rounded-ctl border bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-bg',
          invalid ? 'border-danger' : 'border-line-strong')} />
      {open && <OptionList id={listId} options={filtered} active={active} query={query} selected={(v) => value.includes(v)} onPick={toggle} onHover={setActive} empty={empty} />}
    </div>
  );
}
