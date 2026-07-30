#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const checks = [
  ["messages dashboard has a scoped layout hook", /dashboardTab === "chats"[\s\S]*chat-dashboard-page/.test(app)],
  ["desktop standalone messages use the available width", /\.chat-route-page \.conversation-layout\s*\{[\s\S]*?width:\s*100%\s*;/.test(css)],
  ["desktop empty chat state fills the conversation panel", /\.chat-route-page \.conversation-panel\s*>\s*\.empty\.small\s*\{[\s\S]*?flex:\s*1 1 auto\s*;[\s\S]*?width:\s*100%\s*;/.test(css)],
  ["mobile collapsed messages stay full width", /\.chat-dashboard-page \.conversation-layout\.chat-list-collapsed\s*,\s*\.chat-route-page \.conversation-layout\.chat-list-collapsed\s*\{\s*grid-template-columns:\s*1fr\s*;/.test(css)],
  ["mobile messages list is not capped at three rows", /\.chat-dashboard-page \.conversation-list\s*,\s*\.chat-route-page \.conversation-list\s*\{[\s\S]*?max-height:\s*none\s*;/.test(css)],
  ["mobile messages list fills its shell", /\.chat-dashboard-page \.conversation-list-shell\s*,\s*\.chat-route-page \.conversation-list-shell\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column[\s\S]*?min-height:\s*0\s*;/.test(css) && /\.chat-dashboard-page \.conversation-list\s*,\s*\.chat-route-page \.conversation-list\s*\{[\s\S]*?flex:\s*1 1 auto\s*;[\s\S]*?min-height:\s*0\s*;/.test(css)],
  ["mobile list toggle stays inside the header", /\.chat-dashboard-page \.conversation-list-header\s*,\s*\.chat-route-page \.conversation-list-header\s*\{[\s\S]*?box-sizing:\s*border-box[\s\S]*?padding-inline:\s*8px[\s\S]*?overflow:\s*visible[\s\S]*?\}/.test(css) && /\.chat-dashboard-page \.chat-list-toggle\s*,\s*\.chat-route-page \.chat-list-toggle\s*\{[\s\S]*?min-width:\s*max-content[\s\S]*?margin-right:\s*2px[\s\S]*?padding-inline:\s*7px[\s\S]*?\}/.test(css)],
];

for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
const failed = checks.filter(([, passed]) => !passed);
if (failed.length > 0) process.exit(1);
console.log(`Mobile messages layout checks passed (${checks.length}/${checks.length}).`);
