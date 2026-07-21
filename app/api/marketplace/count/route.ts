import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/server/api-security";
import { normalizeTaiwanTextbookQuery } from "@/lib/marketplace/taiwan-textbook";

type CountFilters = {
  listingType: string;
  itemCategory: string | null;
  department: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  query: string | null;
};

type CountRequestBody = {
  listingType?: unknown;
  itemCategory?: unknown;
  department?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  query?: unknown;
};

class InvalidCountRequestError extends Error {}

function optionalTextField(value: unknown, field: string) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new InvalidCountRequestError(`${field} must be a string`);
  return value.trim();
}

function normalizedFilters(body: CountRequestBody): CountFilters {
  const rawListingType = optionalTextField(body.listingType, "listingType");
  if (rawListingType && !["book", "secondhand", "giveaway"].includes(rawListingType)) {
    throw new InvalidCountRequestError("listingType must be book, secondhand, or giveaway");
  }
  const listingType = rawListingType || "book";
  const itemCategory = optionalTextField(body.itemCategory, "itemCategory") || null;
  const department = optionalTextField(body.department, "department") || null;
  const rawQuery = optionalTextField(body.query, "query").slice(0, 80);
  const query = (listingType === "book" ? normalizeTaiwanTextbookQuery(rawQuery) : rawQuery) || null;
  const rawMaxPrice = body.maxPrice;
  const rawMinPrice = body.minPrice;
  if (rawMinPrice !== undefined && rawMinPrice !== null && typeof rawMinPrice !== "number" && typeof rawMinPrice !== "string") {
    throw new InvalidCountRequestError("minPrice must be a number");
  }
  if (rawMaxPrice !== undefined && rawMaxPrice !== null && typeof rawMaxPrice !== "number" && typeof rawMaxPrice !== "string") {
    throw new InvalidCountRequestError("maxPrice must be a number");
  }
  const parsedMinPrice =
    typeof rawMinPrice === "number" || typeof rawMinPrice === "string"
      ? Number(rawMinPrice)
      : null;
  const parsedMaxPrice =
    typeof rawMaxPrice === "number" || typeof rawMaxPrice === "string"
      ? Number(rawMaxPrice)
      : null;
  if (parsedMinPrice !== null && (!Number.isFinite(parsedMinPrice) || parsedMinPrice < 0)) {
    throw new InvalidCountRequestError("minPrice must be a non-negative number");
  }
  if (parsedMaxPrice !== null && (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0)) {
    throw new InvalidCountRequestError("maxPrice must be a non-negative number");
  }
  if (parsedMinPrice !== null && parsedMaxPrice !== null && parsedMinPrice > parsedMaxPrice) {
    throw new InvalidCountRequestError("minPrice cannot exceed maxPrice");
  }
  return {
    listingType,
    itemCategory: listingType === "secondhand" ? itemCategory : null,
    department,
    minPrice: listingType === "giveaway" ? 0 : parsedMinPrice !== null && Number.isFinite(parsedMinPrice) ? parsedMinPrice : null,
    maxPrice: listingType === "giveaway" ? 0 : parsedMaxPrice !== null && Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : null,
    query,
  };
}

async function requestCount(filters: CountFilters) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase is not configured");

  const response = await fetch(`${url}/rest/v1/rpc/count_books_filtered`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_listing_type: filters.listingType,
      p_item_category: filters.itemCategory,
      p_department: filters.department,
      p_min_price: filters.minPrice,
      p_max_price: filters.maxPrice,
      p_query: filters.query,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Catalog count failed (${response.status})`);
  return Number(await response.json());
}

async function readCountBody(request: NextRequest): Promise<CountRequestBody> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new InvalidCountRequestError("request body must be an object");
    }
    return body as CountRequestBody;
  } catch {
    throw new InvalidCountRequestError("request body must be valid JSON");
  }
}

export async function POST(request: NextRequest) {
  try {
    const filters = normalizedFilters(await readCountBody(request));
    const cacheKey = Buffer.from(JSON.stringify(filters)).toString("base64url");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRoleKey) {
      const admin = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const rateLimited = await enforceRateLimit(admin, request, {
        scope: "marketplace-count",
        limit: 120,
        windowSeconds: 60,
      });
      if (rateLimited) return rateLimited;
    }
    const count = await unstable_cache(
      () => requestCount(filters),
      ["marketplace-count", cacheKey],
      { revalidate: 600 },
    )();
    return NextResponse.json(
      { count, approximate: true },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } },
    );
  } catch (error) {
    if (error instanceof InvalidCountRequestError) {
      return NextResponse.json({ error: "搜尋條件格式不正確" }, { status: 400 });
    }
    return NextResponse.json({ count: null, approximate: true }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST /api/marketplace/count with JSON filters." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
