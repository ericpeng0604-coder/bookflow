import { NextResponse } from "next/server";
import { dashboardEnabled, getDashboardStore } from "@/lib/release-dashboard-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!dashboardEnabled()) {
    return NextResponse.json({ status: "unavailable" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json(
    { status: "ok", job: getDashboardStore().job },
    { headers: { "cache-control": "no-store" } },
  );
}
