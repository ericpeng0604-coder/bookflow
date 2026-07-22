import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.BOOKFLOW_SOURCE_MODE !== "workspace") {
    return Response.json({ status: "unavailable" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  try {
    const manifest = process.env.BOOKFLOW_SOURCE_FINGERPRINT
      ? {
          schemaVersion: 1,
          mode: process.env.BOOKFLOW_SOURCE_MODE,
          commit: process.env.BOOKFLOW_SOURCE_COMMIT,
          dirty: process.env.BOOKFLOW_SOURCE_DIRTY === "true",
          fingerprint: process.env.BOOKFLOW_SOURCE_FINGERPRINT,
        }
      : JSON.parse(await readFile(join(process.cwd(), ".next", "bookflow-source.json"), "utf8"));
    return Response.json({ status: "ok", ...manifest }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { status: "error", message: "Local source manifest is missing. Restart with npm run dev:latest." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
