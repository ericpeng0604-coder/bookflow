#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  importTypeScriptModule,
  nodeSupportsStripTypes,
  projectRoot,
} from "./lib/check-runner.mjs";

const source = readFileSync(join(projectRoot, "lib/marketplace/favorites.ts"), "utf8");
const appSource = readFileSync(join(projectRoot, "components/marketplace-app.tsx"), "utf8");
const cssSource = readFileSync(join(projectRoot, "app/globals.css"), "utf8");
assert.match(source, /bookflow-favorites-v1/, "favorites.ts should keep the legacy storage key");
assert.match(source, /bookflow-favorites-synced-v2/, "favorites.ts should keep the sync marker key");
assert.match(appSource, /className=\{`detail-favorite-button/, "book detail page should expose favorite toggle");
assert.match(appSource, /toggleFavorite\(selectedBook\.id, event\)/, "detail favorite button should reuse shared favorite toggle");
assert.match(appSource, /className="favorites-shelf"/, "dashboard favorites should expose a dedicated shelf section");
assert.match(appSource, /id="favorites-shelf-title"[^>]*>我的收藏/, "favorites shelf should have a visible heading");
assert.match(appSource, /取消收藏《\$\{book\.title\}》/, "favorite removal should identify the book in its accessible label");
assert.match(appSource, /title=\{`取消收藏《\$\{book\.title\}》`\}/, "favorite removal should expose a visible tooltip");
assert.match(appSource, /favoriteBooks\.length === 0 && <EmptyDashboard text="你還沒有收藏任何課本" \/>/, "favorites should retain an explicit empty state");
assert.match(appSource, /<ResilientBookCover book=\{book\} \/>/, "favorite cards should use the resilient cover renderer");
assert.match(appSource, /onError=\{\(\) => setImageFailed\(true\)\}/, "favorite cover failures should render a fallback instead of a broken image");
assert.match(cssSource, /\.detail-favorite-button/, "detail favorite button should have a stable style hook");
assert.match(cssSource, /\.favorites-grid \.book-card \{ position: relative;/, "favorite cards should contain their action button");
assert.match(cssSource, /\.favorites-grid \.book-card-main \{ width: 100%;/, "favorite card main action should fill the card");
assert.match(cssSource, /\.favorites-shelf-heading/, "favorites shelf heading should have dedicated styling");
assert.match(cssSource, /\.card-image-fallback/, "favorite cover fallback should have a visible style");
assert.match(cssSource, /@media \(min-width: 981px\) and \(max-width: 1180px\)/, "header should have a medium-width responsive guard");

if (!nodeSupportsStripTypes()) {
  throw new Error("check-favorites requires Node with --experimental-strip-types support");
}

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    dump: () => new Map(store),
  };
}

const storage = createLocalStorageMock();
globalThis.window = { localStorage: storage };

const favorites = await importTypeScriptModule("lib/marketplace/favorites.ts");

assert.deepEqual([...favorites.readFavoriteIds()], []);

storage.setItem("bookflow-favorites-v1", JSON.stringify(["book-a", "book-b", 42, "book-c"]));
assert.deepEqual([...favorites.readFavoriteIds()].sort(), ["book-a", "book-b", "book-c"]);

storage.setItem("bookflow-favorites-v1", "{not-json");
assert.deepEqual([...favorites.readFavoriteIds()], []);

const toggledOn = favorites.toggleFavoriteId(new Set(), "book-1");
assert.deepEqual([...toggledOn], ["book-1"]);
assert.equal(storage.getItem("bookflow-favorites-v1"), JSON.stringify(["book-1"]));

const toggledOff = favorites.toggleFavoriteId(new Set(["book-1", "book-2"]), "book-1");
assert.deepEqual([...toggledOff].sort(), ["book-2"]);
assert.equal(storage.getItem("bookflow-favorites-v1"), JSON.stringify(["book-2"]));

storage.removeItem("bookflow-favorites-synced-v2");
assert.equal(favorites.legacyFavoritesNeedSync(), true);
favorites.clearLegacyFavorites();
assert.equal(storage.getItem("bookflow-favorites-v1"), null);
assert.equal(storage.getItem("bookflow-favorites-synced-v2"), "1");
assert.equal(favorites.legacyFavoritesNeedSync(), false);

delete globalThis.window;
console.log("Favorites checks passed (storage, presentation, and interaction hooks).");
