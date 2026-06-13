import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

type CountFilters = {
  department: string | null;
  maxPrice: number | null;
  query: string | null;
};

function normalizedFilters(request: NextRequest): CountFilters {
  const department = request.nextUrl.searchParams.get("department")?.trim() || null;
  const query = request.nextUrl.searchParams.get("query")?.trim().slice(0, 80) || null;
  const rawMaxPrice = request.nextUrl.searchParams.get("maxPrice");
  const parsedMaxPrice = rawMaxPrice ? Number(rawMaxPrice) : null;
  return {
    department,
    maxPrice: parsedMaxPrice !== null && Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : null,
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
      p_department: filters.department,
      p_max_price: filters.maxPrice,
      p_query: filters.query,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Catalog count failed (${response.status})`);
  return Number(await response.json());
}

export async function GET(request: NextRequest) {
  const filters = normalizedFilters(request);
  const cacheKey = Buffer.from(JSON.stringify(filters)).toString("base64url");
  try {
    const count = await unstable_cache(
      () => requestCount(filters),
      ["marketplace-count", cacheKey],
      { revalidate: 600 },
    )();
    return NextResponse.json(
      { count, approximate: true },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ count: null, approximate: true }, { status: 503 });
  }
}
