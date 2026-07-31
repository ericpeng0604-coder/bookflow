import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const channelMarker = "conversation-summaries:";
const channelIndex = app.indexOf(channelMarker);
assert.notEqual(channelIndex, -1, "conversation summary realtime channel must exist");

const effectStart = app.lastIndexOf("  useEffect(() => {", channelIndex);
const effectEnd = app.indexOf("\n  }, [", channelIndex);
assert.ok(effectStart >= 0 && effectEnd > channelIndex, "conversation summary channel must be created inside a useEffect");
const effect = app.slice(effectStart, effectEnd);

assert.match(effect, /store\.currentUser/, "conversation summaries must require an authenticated user");
assert.match(effect, /dashboardTab/, "conversation summaries must be scoped to the Messages dashboard tab");
assert.match(
  effect,
  /view\s*===\s*[\"']dashboard[\"']\s*&&\s*dashboardTab\s*===\s*[\"']chats[\"']\s*\)\s*\|\|\s*view\s*===\s*[\"']chat[\"']|view\s*!==\s*[\"']dashboard[\"'][\s\S]*dashboardTab\s*!==\s*[\"']chats[\"'][\s\S]*view\s*!==\s*[\"']chat[\"']|view\s*!==\s*[\"']chat[\"'][\s\S]*view\s*!==\s*[\"']dashboard[\"'][\s\S]*dashboardTab\s*!==\s*[\"']chats[\"']/, 
  "conversation summaries must only run for the Messages list or active chat",
);
assert.match(effect, /removeChannel\(channel\)/, "conversation summary realtime channel must be removed during cleanup");

console.log("Realtime subscription scope checks passed (4/4).");
