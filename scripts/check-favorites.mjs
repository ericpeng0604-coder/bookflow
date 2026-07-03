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
assert.match(cssSource, /\.detail-favorite-button/, "detail favorite button should have a stable style hook");

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
console.log("Favorites checks passed (6/6).");
