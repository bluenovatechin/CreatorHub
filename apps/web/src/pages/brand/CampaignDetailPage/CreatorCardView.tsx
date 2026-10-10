import { useTranslation } from 'react-i18next';
import { BadgeCheck, CheckCircle2, Clapperboard, Instagram, MapPin } from 'lucide-react';
import { Avatar, Badge, Button, ExternalLink, Tag, cx } from '@bluenova/ui';
import { categoryLabel, cityLabel, formatINR } from '../../../lib/format';
import type { ShortlistItemView } from '../../../lib/types';
import { CategoryIcon } from '../../../components/icons';

export function CreatorCardView({
  i,
  selectable,
  picked,
  onToggle,
}: {
  i: ShortlistItemView;
  selectable: boolean;
  picked: boolean;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cr = i.creator;
  const lang = i18n.language;

  return (
    <div
      className={cx(
        'flex flex-col rounded-card border bg-white p-5 shadow-card transition',
        picked ? 'border-primary ring-4 ring-primary/10' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={cr?.displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-lg font-bold text-navy">{cr?.displayName}</p>
            {cr?.isPartner && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label={t('status.creator.APPROVED')} />}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            {cr?.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {cityLabel(cr.city, lang)}
              </span>
            )}
            {cr?.igHandle && (
              <span className="flex items-center gap-1">
                <Instagram className="h-3.5 w-3.5" />@{cr.igHandle}
              </span>
            )}
          </p>
        </div>
        {i.status === 'SELECTED' && <Badge tone="green">{t('campaign.selected')}</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {cr?.categories.map((k) => (
          <Tag key={k} icon={<CategoryIcon k={k} />}>
            {categoryLabel(k, lang)}
          </Tag>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-bg p-3">
          <p className="text-xs text-ink-muted">{t('wizard.bands')}</p>
          <p className="font-semibold text-navy">{cr?.stats.followerBand ? t(`band.${cr.stats.followerBand}`) : '—'}</p>
        </div>
        <div className="rounded-xl bg-bg p-3">
          <p className="text-xs text-ink-muted">{t('onboarding.engagement')}</p>
          <p className="font-semibold text-accent">{cr?.stats.engagementRate != null ? `${cr.stats.engagementRate}%` : '—'}</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-faint">{t('common.selfReported')}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {cr?.reels.map((r, n) => (
          <ExternalLink key={r} href={r} className="inline-flex items-center gap-1">
            <Clapperboard className="h-3.5 w-3.5" />
            {t('campaign.viewReel', { n: n + 1 })}
          </ExternalLink>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        <p className="font-display text-xl font-extrabold text-navy">{formatINR(i.brandPricePaise)}</p>
        {selectable && (
          <Button
            variant={picked ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={picked}
            onClick={onToggle}
            icon={picked ? <CheckCircle2 className="h-4 w-4" /> : undefined}
          >
            {picked ? t('campaign.selected') : t('campaign.select')}
          </Button>
        )}
      </div>
    </div>
  );
}
