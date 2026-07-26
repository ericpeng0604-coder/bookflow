#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/marketplace/use-marketplace-workspace.ts", import.meta.url), "utf8");
const activeApp = app.replace(/\/\*[\s\S]*?\*\//g, "");

assert.match(workspace, /export function useMarketplaceWorkspace/);
assert.match(workspace, /loadWorkspaceTabData/);
assert.match(workspace, /loadModerationData/);
assert.match(workspace, /runGuarded\(`workspace:\$\{tab\}`/);
assert.match(workspace, /onOrdersLoaded/);
assert.match(workspace, /studentVerification/);
assert.match(workspace, /conversationPage/);
assert.match(workspace, /clearWorkspace/);
assert.match(workspace, /reloadAfterUserMutation/);
assert.match(activeApp, /useMarketplaceWorkspace\(\{/);
assert.match(activeApp, /onWorkspaceOrdersLoaded/);
assert.match(activeApp, /onWorkspaceConversationPageLoaded/);
assert.doesNotMatch(activeApp, /loadWorkspaceTabData/);
assert.doesNotMatch(activeApp, /loadModerationData/);
assert.doesNotMatch(activeApp, /const reloadAfterUserMutation/);
assert.match(activeApp, /clearWorkspace\(\)/);

console.log("Marketplace workspace module checks passed (10/10).");
