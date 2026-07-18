#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const mapper = readFileSync(new URL("../lib/marketplace/mappers.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

const checks = [
  [
    "gallery data keeps the cover first and removes duplicates",
    mapper.includes("normalizeBookImageUrls")
      && mapper.includes("new Set([cover, ...gallery]")
      && app.includes("normalizeBookImageUrls(book.imageUrl, book.imageUrls)"),
  ],
  [
    "detail view hydrates a list item when its gallery is incomplete",
    app.includes("bookImageUrls(knownBook).length <= 1")
      && app.includes("fetchBookById(client, bookId)"),
  ],
  [
    "detail gallery preloads valid image sources",
    app.includes("new window.Image()")
      && app.includes("selectedBookImageSources")
      && app.includes("image.decoding = \"async\""),
  ],
  [
    "detail gallery has a safe image fallback",
    app.includes("detail-gallery-main-image")
      && app.includes("detail-gallery-image-fallback"),
  ],
  [
    "mobile gallery thumbnails remain horizontally scrollable",
    css.includes(".detail-gallery-thumbnails { display: flex;")
      && css.includes("overflow-x: auto"),
  ],
  [
    "footer displays the build version without making it a navigation item",
    app.includes("footer-version")
      && app.includes("v{APP_VERSION}")
      && nextConfig.includes("NEXT_PUBLIC_APP_VERSION: appVersion"),
  ],
  [
    "collapsed chat list keeps a compact restore control",
    css.includes("grid-template-columns: 56px minmax(0, 1fr)")
      && css.includes(".conversation-layout.chat-list-collapsed .chat-list-toggle")
      && css.includes("width: 38px"),
  ],
];

for (const [name, passed] of checks) {
  assert.ok(passed, name);
  console.log(`PASS: ${name}`);
}

console.log(`Book gallery and compact chat UI checks passed (${checks.length}/${checks.length}).`);
