#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  BOOK_OCR_AI_DEFAULT_MODEL,
  buildBookCoverPrompt,
  buildGeminiBookCoverRequest,
  extractGeminiOutputText,
  extractSafeProviderErrorCode,
  normalizeAiBookCover,
  parseBookCoverOutputText,
} from "../lib/server/book-ocr-ai.ts";

assert.equal(BOOK_OCR_AI_DEFAULT_MODEL, "gemini-2.5-flash");

const normalized = normalizeAiBookCover({
  is_book_cover: true,
  confidence: 88,
  title: "  普通物理學  ",
  author: "Richard   Wolfson",
  edition: "下冊",
  publisher: "Pearson",
});
assert.equal(normalized.usable, true);
assert.deepEqual(normalized.draft, {
  title: "普通物理學",
  author: "Richard Wolfson",
  edition: "下冊",
  publisher: "Pearson",
});

const normalizedVolume = normalizeAiBookCover({
  is_book_cover: true,
  confidence: 90,
  title: "普通物理學",
  author: "Richard Wolfson",
  edition: "Essential University Physics, 4e",
  publisher: "Pearson",
  volume: "上冊",
});
assert.equal(normalizedVolume.draft.edition, "上冊 / Essential University Physics, 4e");

assert.equal(normalizeAiBookCover({
  is_book_cover: true,
  confidence: 20,
  title: "可能是一本書",
  author: null,
  edition: null,
  publisher: null,
}).usable, false);

const prompt = buildBookCoverPrompt("ee7亂碼");
assert.match(prompt, /Untrusted local OCR hint/);
assert.match(prompt, /Do not infer missing values/);
assert.match(prompt, /stylized Traditional Chinese title/);
assert.match(prompt, /\[上冊\]/);

const request = buildGeminiBookCoverRequest({
  model: BOOK_OCR_AI_DEFAULT_MODEL,
  imageMimeType: "image/jpeg",
  imageBase64: "AA==",
  localOcrText: "",
});
assert.equal(request.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
assert.equal(request.contents[0].parts[1].inlineData.data, "AA==");
assert.equal(request.generationConfig.responseMimeType, "application/json");
assert.equal(request.generationConfig.responseJsonSchema.additionalProperties, false);
assert.equal(request.generationConfig.maxOutputTokens, 1200);
assert.equal(request.generationConfig.thinkingConfig.thinkingBudget, 0);
assert.equal(
  extractGeminiOutputText({
    candidates: [{ content: { parts: [
      { text: "{\"is_book_" },
      { text: "cover\":true}" },
    ] } }],
  }),
  "{\"is_book_cover\":true}",
);
assert.equal(
  extractSafeProviderErrorCode({ error: { status: "RESOURCE_EXHAUSTED" } }),
  "RESOURCE_EXHAUSTED",
);
assert.equal(
  extractSafeProviderErrorCode({ error: { status: "unsafe code with spaces" } }),
  "",
);
assert.equal(
  parseBookCoverOutputText("```json\n{\"is_book_cover\":false}\n```").is_book_cover,
  false,
);
assert.equal(
  parseBookCoverOutputText("Here is the result:\n{\"is_book_cover\":true,\"title\":\"微積分\"}\nDone.")
    .title,
  "微積分",
);
assert.throws(
  () => parseBookCoverOutputText("{\"is_book_cover\":true"),
  /incomplete JSON/,
);

const route = readFileSync(new URL("../app/api/ai/book-cover/route.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/marketplace/book-ocr-ai.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260618090000_book_ocr_ai_quota.sql", import.meta.url),
  "utf8",
);
const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

assert.match(route, /authClient\.auth\.getUser\(token\)/, "AI route must authenticate the access token");
assert.match(route, /reserve_book_ocr_quota/, "AI route must reserve persistent quota before calling Gemini");
assert.match(route, /finalize_book_ocr_quota/, "AI route must complete or release the quota reservation");
assert.match(client, /X-Idempotency-Key/, "browser requests must use an idempotency key");
assert.match(route, /image\.size > BOOK_OCR_AI_MAX_FILE_BYTES/, "AI route must enforce image size");
assert.match(route, /GEMINI_API_KEY/, "AI route must keep the Gemini key server-side");
assert.match(route, /generativelanguage\.googleapis\.com/, "AI route must call the official Gemini API");
assert.match(route, /x-goog-api-key/, "Gemini authentication must stay in a server-side header");
assert.match(route, /Gemini \$\{aiResponse\.status\}/, "Gemini failures must expose only a safe status diagnostic");
assert.doesNotMatch(route, /console\.(log|info|debug)/, "AI route must not log uploaded image data");
assert.match(client, /Authorization: `Bearer \$\{token\}`/, "browser request must forward the signed-in session");
assert.match(app, /const needsAiFallback =[\s\S]*if \(needsAiFallback && supabase\)/, "cloud AI must only run after local OCR requests fallback");
assert.match(
  app,
  /let ocrDraft = needsAiFallback\s*\?\s*\{[\s\S]*?title: "",[\s\S]*?author: "",[\s\S]*?edition: "",[\s\S]*?\}\s*:\s*\{[\s\S]*?title: mergedLocalDraft\.title,[\s\S]*?edition: mergedLocalDraft\.edition/,
  "weak local OCR must remain unapplied when cloud fallback fails",
);
assert.doesNotMatch(
  app,
  /previous\.publisher\.trim\(\) \? previous\.publisher : ocrDraft\.publisher/,
  "OCR must not populate metadata fields removed from the listing form",
);
assert.match(app, /previous\.title\.trim\(\) \? previous\.title/, "OCR must preserve user-entered titles");
assert.match(app, /ocr-privacy-note/, "the UI must disclose temporary cloud processing");
const hardeningMigration = readFileSync(
  new URL("../supabase/migrations/20260622090000_site_quality_hardening.sql", import.meta.url),
  "utf8",
);
assert.match(migration, /primary key \(user_id, usage_date\)/, "daily usage must remain persisted");
assert.match(hardeningMigration, /pg_advisory_xact_lock/, "quota reservations must serialize concurrent requests");
assert.match(hardeningMigration, /status in \('reserved', 'completed', 'released'\)/, "quota must support release after provider failure");
assert.match(hardeningMigration, /grant execute[\s\S]*reserve_book_ocr_quota[\s\S]*to service_role/, "only the server role may reserve quota");
assert.match(env, /^GEMINI_API_KEY=$/m);
assert.match(env, /^BOOK_OCR_AI_MODEL=gemini-2\.5-flash$/m);

console.log("AI book-cover fallback checks passed.");
