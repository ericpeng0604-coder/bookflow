import { departments } from "@/lib/demo-data";
import { normalizeTaiwanTextbookQuery } from "./taiwan-textbook.ts";
import type { ListingType } from "@/lib/types";

/** Sentinel for "no max price" — avoids Chinese string comparisons in query logic. */
export const NO_MAX_PRICE = "";
export const ALL_ITEM_CATEGORIES = "全部分類";

export type MarketplaceFilters = {
  listingType: ListingType;
  itemCategory: string | null;
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
  listingType: ListingType,
  itemCategory: string,
  department: string,
  maxPrice: string,
  query: string,
): MarketplaceFilters {
  return {
    listingType,
    itemCategory: listingType === "secondhand" && itemCategory !== ALL_ITEM_CATEGORIES ? itemCategory : null,
    department: listingType === "book" && !isAllDepartments(department) ? department : null,
    maxPrice: parseMaxPriceFilter(maxPrice),
    query: listingType === "book"
      ? normalizeTaiwanTextbookQuery(query) || null
      : query.trim() || null,
  };
}
