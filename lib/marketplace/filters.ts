import { departments } from "@/lib/demo-data";

/** Sentinel for "no max price" — avoids Chinese string comparisons in query logic. */
export const NO_MAX_PRICE = "";

export type MarketplaceFilters = {
  department: string | null;
  maxPrice: number | null;
  query: string | null;
};

export function isAllDepartments(department: string) {
  return department === departments[0];
}

export function parseMaxPriceFilter(maxPrice: string): number | null {
  if (!maxPrice) return null;
  const value = Number(maxPrice);
  return Number.isFinite(value) ? value : null;
}

export function buildMarketplaceFilters(
  department: string,
  maxPrice: string,
  query: string,
): MarketplaceFilters {
  return {
    department: isAllDepartments(department) ? null : department,
    maxPrice: parseMaxPriceFilter(maxPrice),
    query: query.trim() || null,
  };
}
