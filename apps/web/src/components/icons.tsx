import {
  Briefcase, Building2, Car, Clapperboard, Cpu, Dumbbell, GraduationCap, HeartPulse, IndianRupee, Megaphone, Plane,
  Shirt, Sofa, Sparkles, Store, UtensilsCrossed, type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  business: Briefcase,
  marketing: Megaphone,
  tech: Cpu,
  finance: IndianRupee,
  real_estate: Building2,
  food: UtensilsCrossed,
  fashion: Shirt,
  beauty: Sparkles,
  health: HeartPulse,
  fitness: Dumbbell,
  travel: Plane,
  education: GraduationCap,
  automobile: Car,
  home_interior: Sofa,
  local_business: Store,
  entertainment: Clapperboard,
};

export function CategoryIcon({ k, className }: { k: string; className?: string }) {
  const Icon = CATEGORY_ICONS[k] ?? Sparkles;
  return <Icon className={className ?? 'h-4 w-4'} aria-hidden="true" />;
}
