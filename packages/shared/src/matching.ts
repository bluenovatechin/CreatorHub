import type { DeliverableType, FollowerBand } from './enums';

export interface MatchCreator {
  categories: string[];
  city: string;
  languages: string[];
  followerBand: FollowerBand;
  rateCardPaise: Partial<Record<DeliverableType, number>>;
  creatorScore: number;
}

export interface MatchCampaign {
  categories: string[];
  cities: string[];
  languages: string[];
  followerBands: string[];
  mainDeliverable?: DeliverableType;
  budgetPerCreatorPaise?: number;
}

export interface MatchBreakdown {
  category: number;
  city: number;
  language: number;
  followerBand: number;
  budget: number;
  creatorScore: number;
  total: number;
}

const overlap = (a: string[], b: string[]) => a.some((x) => b.includes(x));

/** Match score 0–100 (spec §12). Empty campaign filters count as a match. */
export function matchScore(c: MatchCreator, m: MatchCampaign): MatchBreakdown {
  const category = m.categories.length === 0 || overlap(c.categories, m.categories) ? 35 : 0;
  const city = m.cities.length === 0 || m.cities.includes(c.city) ? 20 : 0;
  const language = m.languages.length === 0 || overlap(c.languages, m.languages) ? 15 : 0;
  const followerBand = m.followerBands.length === 0 || m.followerBands.includes(c.followerBand) ? 10 : 0;
  let budget = 5; // unknown budget or rate: neutral
  if (m.budgetPerCreatorPaise !== undefined && m.mainDeliverable) {
    const rate = c.rateCardPaise[m.mainDeliverable];
    if (rate !== undefined) budget = rate <= m.budgetPerCreatorPaise ? 10 : 0;
  }
  const creatorScore = Math.round(Math.max(0, Math.min(100, c.creatorScore)) / 10);
  return {
    category, city, language, followerBand, budget, creatorScore,
    total: category + city + language + followerBand + budget + creatorScore,
  };
}
