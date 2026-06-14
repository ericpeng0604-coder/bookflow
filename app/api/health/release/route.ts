export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
