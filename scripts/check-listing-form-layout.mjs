#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const photoAssist = app.slice(app.indexOf('<div className="photo-assist full">'), app.indexOf("</section>", app.indexOf('<div className="photo-assist full">')));

assert.match(css, /\.listing-form-section\s*\{\s*container-type:\s*inline-size;/, "listing sections must provide a responsive query container");
assert.ok(css.includes("@container (max-width: 620px)"), "photo guidance must have a narrow-container layout");
assert.match(css, /\.listing-photo-guide-meta small\s*\{\s*flex:\s*1 1 100%;/, "photo guidance copy must occupy a full readable row");
assert.ok(css.includes("padding-inline-end: 8px;"), "photo guidance metadata must keep a readable edge inset");
assert.match(css, /\.listing-photo-add-button\s*\{\s*width:\s*100%;/, "photo upload action must fill the narrow guidance column");
assert.ok(app.includes("listing-photo-guide full"), "listing form must keep the photo guidance block");
assert.ok(app.includes('className="listing-photo-guide-meta"'), "listing form must keep the guidance metadata block");
assert.ok(app.includes("!isSecondhand && imageItems.length > 0 &&"), "AI photo assist must wait until at least one photo is uploaded");
assert.ok(app.includes('if (!coverId) {') && app.includes('setOcrMessage("請先在照片縮圖上選擇「設為封面」。");'), "missing cover must be reported after the recognition action");
assert.ok(photoAssist.includes("使用照片填寫課本資料"), "photo assist must keep its concise heading");
assert.ok(!photoAssist.includes("拍清楚封面後"), "photo assist must not restore the long explanatory subtitle");
assert.ok(!photoAssist.includes("ocr-privacy-note"), "photo assist must not restore the long privacy paragraph");

console.log("Listing form layout checks passed.");
