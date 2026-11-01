/** Medals for a finished run, by score. Pure: no Phaser. */
export type Medal = 'bronze' | 'silver' | 'gold';

/** The lowest score that earns each medal. */
export const MEDAL_THRESHOLDS: Record<Medal, number> = { bronze: 10, silver: 25, gold: 50 };

const ORDER: readonly Medal[] = ['bronze', 'silver', 'gold'];

/** The medal a score earns, or null below the bronze threshold (or for a score that is not a number). */
export function medalOf(score: number): Medal | null {
  if (!Number.isFinite(score)) return null;
  if (score >= MEDAL_THRESHOLDS.gold) return 'gold';
  if (score >= MEDAL_THRESHOLDS.silver) return 'silver';
  if (score >= MEDAL_THRESHOLDS.bronze) return 'bronze';
  return null;
}

/** 0 for no medal, then 1 bronze, 2 silver, 3 gold. */
export function rankOf(medal: Medal | null): number {
  return medal ? ORDER.indexOf(medal) + 1 : 0;
}

/** The better of two medals (null is the worst). */
export function betterMedal(a: Medal | null, b: Medal | null): Medal | null {
  return rankOf(b) > rankOf(a) ? b : a;
}

/** A stored value as a medal; anything that is not a medal name is null. */
export function parseMedal(raw: string | null | undefined): Medal | null {
  const value = raw?.trim();
  return ORDER.find((m) => m === value) ?? null;
}
