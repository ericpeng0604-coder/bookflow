import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");

assert.match(
  app,
  /const NOTIFICATION_REFRESH_INTERVAL_MS\s*=\s*(?:30\s*\*\s*1000|30_000)\s*;/,
  "unread message fallback polling must use a 30-second interval",
);

const refreshMarker = "const refreshWhenVisible = () =>";
const refreshIndex = app.indexOf(refreshMarker);
assert.notEqual(refreshIndex, -1, "unread message fallback must define a visibility-aware refresh callback");
const effectStart = app.lastIndexOf("  useEffect(() => {", refreshIndex);
const effectEnd = app.indexOf("\n  }, [", refreshIndex);
assert.ok(effectStart >= 0 && effectEnd > refreshIndex, "unread message fallback must run inside a useEffect");
const effect = app.slice(effectStart, effectEnd);

assert.match(effect, /view\s*===\s*["']dashboard["']\s*&&\s*dashboardTab\s*===\s*["']chats["']/, "fallback polling must skip the Messages dashboard tab");
assert.match(effect, /view\s*===\s*["']chat["']/, "fallback polling must skip the active chat view");
assert.match(
  effect,
  /document\.visibilityState\s*!==\s*["']visible["']\s*\)\s*return/,
  "fallback polling must only query while the page is visible",
);
assert.match(effect, /void loadConversationSummary\(\)/, "fallback polling must refresh unread conversation summaries");
assert.match(effect, /setInterval\(refreshWhenVisible,\s*NOTIFICATION_REFRESH_INTERVAL_MS\)/, "fallback polling must use the shared 30-second interval");
assert.match(effect, /clearInterval\(interval\)/, "fallback polling interval must be cleared during cleanup");
assert.match(effect, /removeEventListener\("visibilitychange",\s*refreshWhenVisible\)/, "visibility listener must be removed during cleanup");
assert.doesNotMatch(effect, /\.channel\(|conversation-summaries:/, "fallback polling must not create a Realtime channel");

console.log("Unread message polling checks passed (9/9).");
