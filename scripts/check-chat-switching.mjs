import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");

assert.match(
  app,
  /<TradeChatPanel\s+key=\{expandedConversationId\}/,
  "each selected conversation must receive an isolated chat component state",
);
assert.match(
  app,
  /const \[messages, setMessages\] = useState<TradeMessage\[\]>\(\[\]\);[\s\S]*const \[imageUrls, setImageUrls\] = useState<Record<string, string>>\(\{\}\);/,
  "newly mounted chat panels must start with empty conversation content",
);
assert.match(
  app,
  /if \(!active\) return;[\s\S]*setMessages\(page\.messages\)/,
  "a stale conversation response must not replace the active conversation",
);
assert.match(
  app,
  /return \(\) => \{\s*active = false;\s*void client\.removeChannel\(channel\);/,
  "conversation cleanup must invalidate async work before removing realtime",
);

console.log("Chat switching state checks passed (4/4).");
