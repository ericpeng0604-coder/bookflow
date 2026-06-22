#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAndValidateListingFields } from "../lib/marketplace/listing-validation.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const headers = read("next.config.ts");
for (const expected of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
]) {
  assert.match(headers, new RegExp(expected), `missing security header ${expected}`);
}
assert.doesNotMatch(headers, /script-src[^"]+\*/, "CSP script policy must not use wildcard sources");
assert.doesNotMatch(headers, /cdn\.jsdelivr\.net/, "Tesseract script must not depend on jsDelivr");

const apiSecurity = read("lib/server/api-security.ts");
assert.match(apiSecurity, /createHash\("sha256"\)/);
assert.match(apiSecurity, /JSON_CONTENT_TYPES/);
assert.match(apiSecurity, /content-length/);
assert.match(apiSecurity, /consume_api_rate_limit/);
assert.match(apiSecurity, /Retry-After/);

const validListing = normalizeAndValidateListingFields({
  title: " 國中數學 ",
  author: "作者",
  edition: "第 1 版",
  publisher: "康軒版",
  course: "",
  teacher: "",
  meetup: "圖書館",
  description: "書況良好",
  educationLevel: "junior_high",
  grade: "7",
  semester: "first",
  subject: "數學",
  volume: "第1冊",
  curriculum: "108課綱",
  bookType: "textbook",
  isbn13: "9789570000016",
  approvalNumber: "國審字第113001號",
  price: 300,
});
assert.ok("value" in validListing);
assert.equal(validListing.value.publisher, "康軒");
assert.equal(validListing.value.title, "國中數學");

const invalidPrice = normalizeAndValidateListingFields({
  ...validListing.value,
  price: Number.NaN,
});
assert.ok("error" in invalidPrice);
const invalidIsbn = normalizeAndValidateListingFields({
  ...validListing.value,
  isbn13: "9789570000018",
});
assert.ok("error" in invalidIsbn);

const app = read("components/marketplace-app.tsx");
assert.doesNotMatch(app, /window\.(prompt|confirm)/, "important actions must use in-app dialogs");
assert.match(app, /bookflow-listing-draft-v1/, "listing drafts must persist locally");
assert.doesNotMatch(app, /保留刊登草稿|離開並保留草稿/, "closing a listing form must not show a draft confirmation");
assert.match(
  app,
  /function requestClose\(\)[\s\S]*localStorage\.setItem\(draftStorageKey, JSON\.stringify\(draft\)\)[\s\S]*onClose\(\)/,
  "closing a listing form must synchronously save changed text before closing",
);
assert.match(app, /rankTaiwanTextbookCandidates/, "multi-source OCR candidates must be ranked");
assert.match(app, /detectIsbnBarcode/, "EAN-13 ISBN scanning must be wired");
assert.match(app, /我已確認不是買錯版本/, "buyers must confirm textbook version details");

const migration = read("supabase/migrations/20260622090000_site_quality_hardening.sql");
for (const expected of [
  "consume_api_rate_limit",
  "api_abuse_events",
  "book_ocr_quota_reservations",
  "student_verification_audit_logs",
  "account_deletion_requests",
  "anonymize_account_for_deletion",
  "textbook_ocr_feedback",
  "moderation_audit_logs",
  "books_isbn13_check",
  "education_level",
]) {
  assert.match(migration, new RegExp(expected), `hardening migration missing ${expected}`);
}

const accountRoute = read("app/api/account/delete/route.ts");
assert.match(accountRoute, /authClient\.auth\.getUser\(accessToken\)/);
assert.match(accountRoute, /confirmation !== "DELETE"/);
assert.match(accountRoute, /deleteUser\(authData\.user\.id, true\)/);
assert.match(accountRoute, /enforceRateLimit/);

const sw = read("public/sw.js");
assert.match(sw, /skipWaiting/);
assert.match(sw, /clients\.claim/);
assert.match(sw, /requested\.origin === self\.location\.origin/);

for (const file of [
  "app/robots.ts",
  "app/sitemap.ts",
  "app/manifest.ts",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/safety/page.tsx",
]) {
  assert.ok(read(file).length > 100, `${file} must contain substantive content`);
}

console.log("Site quality hardening checks passed.");
