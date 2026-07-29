import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = "https://bookflow-green.vercel.app/";
const SUPABASE_URL = "https://rgkpmxbpejfwcuxncadh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJna3BteGJwZWpmd2N1eG5jYWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDQ3MzcsImV4cCI6MjA5NjU4MDczN30.KkMAVHa-PG9hHjEQvj8yPhjJKKvTpElYendcI5aIlnU";
const TOKEN = "bookflow-production-read-load-test-20260729";
const ALLOWED_CONCURRENCY = new Set([5, 10, 25, 50, 100, 200]);

type Scenario = "homepage" | "rpc";
type Result = { ok: boolean; status: string | number; elapsed: number };
type LoadTestInput = {
  scenario?: Scenario;
  concurrency?: number;
  seconds?: number;
  token?: string;
};

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performRequest(scenario: Scenario): Promise<Result> {
  const started = performance.now();
  try {
    const response = scenario === "homepage"
      ? await fetch(SITE_URL, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "BookFlow-authorized-read-load-test/2026-07-29" },
        })
      : await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_books_page`, {
          method: "POST",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "BookFlow-authorized-read-load-test/2026-07-29",
          },
          body: JSON.stringify({
            p_limit: 25,
            p_cursor_created: null,
            p_cursor_id: null,
            p_department: null,
            p_max_price: null,
            p_query: null,
          }),
        });

    const elapsed = performance.now() - started;
    await response.arrayBuffer();
    return { ok: response.ok, status: response.status, elapsed };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error ? error.name : "NetworkError",
      elapsed: performance.now() - started,
    };
  }
}

function isPreviewBranch() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "codex/production-read-load-test-20260729"
  );
}

async function runLoadTest(input: LoadTestInput) {
  if (!isPreviewBranch()) {
    return NextResponse.json({ error: "Preview branch only" }, { status: 404 });
  }

  if (input.token !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scenario = input.scenario;
  const concurrency = Number(input.concurrency);
  const seconds = Number(input.seconds);

  if (
    (scenario !== "homepage" && scenario !== "rpc") ||
    !ALLOWED_CONCURRENCY.has(concurrency) ||
    !Number.isFinite(seconds) ||
    seconds < 5 ||
    seconds > 15
  ) {
    return NextResponse.json({ error: "Invalid bounded test parameters" }, { status: 400 });
  }

  const validatedScenario: Scenario = scenario;
  const results: Result[] = [];
  const stopAt = Date.now() + seconds * 1000;

  async function worker() {
    while (Date.now() < stopAt) {
      results.push(await performRequest(validatedScenario));
      await sleep(1000);
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const duration = (performance.now() - started) / 1000;
  const success = results.filter((result) => result.ok);
  const failed = results.length - success.length;
  const latencies = success.map((result) => result.elapsed);
  const statuses: Record<string, number> = {};
  for (const result of results) {
    const key = String(result.status);
    statuses[key] = (statuses[key] || 0) + 1;
  }
  const errorRatePercent = results.length ? failed / results.length * 100 : 100;
  const p95Ms = percentile(latencies, 0.95);

  return NextResponse.json({
    scenario: validatedScenario,
    concurrency,
    seconds,
    requests: results.length,
    successful: success.length,
    failed,
    reqPerSecond: Number((success.length / duration).toFixed(2)),
    p50Ms: Math.round(percentile(latencies, 0.5)),
    p95Ms: Math.round(p95Ms),
    p99Ms: Math.round(percentile(latencies, 0.99)),
    errorRatePercent: Number(errorRatePercent.toFixed(2)),
    statuses,
    stopThresholdReached: errorRatePercent >= 1 || p95Ms > 1500,
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return runLoadTest({
    token: params.get("token") ?? undefined,
    scenario: (params.get("scenario") ?? undefined) as Scenario | undefined,
    concurrency: Number(params.get("concurrency")),
    seconds: Number(params.get("seconds")),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Omit<LoadTestInput, "token">;
  return runLoadTest({
    ...body,
    token: request.headers.get("x-load-test-token") ?? undefined,
  });
}
