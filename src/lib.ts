import type { Market } from "./types";

export const STARTING_BALANCE = 1000;

export function totalPool(pool: Record<string, number>): number {
  return Object.values(pool).reduce((a, b) => a + b, 0);
}

/** V1 ratio pricing: pool[outcome] / sum(pool). Even split while the pool is empty. */
export function price(m: Pick<Market, "pool" | "outcomes">, outcome: string): number {
  const total = totalPool(m.pool);
  if (total === 0) return 1 / m.outcomes.length;
  return (m.pool[outcome] ?? 0) / total;
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const cents = (p: number) => `${Math.min(99, Math.max(1, Math.round(p * 100)))}¢`;
export const fmt = (n: number) => Math.round(n).toLocaleString();

/** Pari-mutuel payout for one position on a resolved market. */
export function payoutFor(
  market: Pick<Market, "pool" | "resolvedOutcome">,
  outcome: string,
  amount: number
): number {
  const win = market.resolvedOutcome;
  if (!win) return 0;
  const winPool = market.pool[win] ?? 0;
  if (winPool === 0) return amount; // nobody backed the winner: refund everyone
  return outcome === win ? (amount / winPool) * totalPool(market.pool) : 0;
}
