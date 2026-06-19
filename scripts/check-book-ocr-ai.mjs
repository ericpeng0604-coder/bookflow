#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  BOOK_OCR_AI_DEFAULT_MODEL,
  buildBookCoverPrompt,
  buildGatewayBookCoverRequest,
  buildOpenAiBookCoverRequest,
  extractGatewayOutputText,
  extractOpenAiOutputText,
  normalizeAiBookCover,
  parseBookCoverOutputText,
} from "../lib/server/book-ocr-ai.ts";

assert.equal(BOOK_OCR_AI_DEFAULT_MODEL, "gpt-5.4-mini");

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

const request = buildOpenAiBookCoverRequest({
  model: BOOK_OCR_AI_DEFAULT_MODEL,
  imageDataUrl: "data:image/jpeg;base64,AA==",
  localOcrText: "",
});
assert.equal(request.input[0].content[1].detail, "high");
assert.equal(request.text.format.strict, true);
assert.equal(request.text.format.schema.additionalProperties, false);

const gatewayRequest = buildGatewayBookCoverRequest({
  model: BOOK_OCR_AI_DEFAULT_MODEL,
  imageDataUrl: "data:image/jpeg;base64,AA==",
  localOcrText: "",
});
assert.equal(gatewayRequest.model, "openai/gpt-5.4-mini");
assert.equal(gatewayRequest.max_tokens, 500);
assert.equal(gatewayRequest.stream, false);
assert.equal("max_completion_tokens" in gatewayRequest, false);
assert.equal(gatewayRequest.messages[0].content[1].image_url.detail, "high");
assert.equal(gatewayRequest.response_format.type, "json_schema");
assert.equal("strict" in gatewayRequest.response_format.json_schema, false);
assert.equal("providerOptions" in gatewayRequest, false);
assert.equal(
  extractGatewayOutputText({
    choices: [{ message: { content: "{\"is_book_cover\":true}" } }],
  }),
  "{\"is_book_cover\":true}",
);
assert.equal(
  parseBookCoverOutputText("```json\n{\"is_book_cover\":false}\n```").is_book_cover,
  false,
);

assert.equal(
  extractOpenAiOutputText({
    output: [{ content: [{ type: "output_text", text: "{\"title\":\"普通物理學\"}" }] }],
  }),
  "{\"title\":\"普通物理學\"}",
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
assert.match(route, /consume_book_ocr_quota/, "AI route must consume persistent quota before calling OpenAI");
assert.match(route, /image\.size > BOOK_OCR_AI_MAX_FILE_BYTES/, "AI route must enforce image size");
assert.match(route, /OPENAI_API_KEY/, "AI route must keep the OpenAI key server-side");
assert.match(route, /VERCEL_OIDC_TOKEN/, "Vercel deployments must support zero-config OIDC auth");
assert.match(
  route,
  /request\.headers\.get\("x-vercel-oidc-token"\)/,
  "Vercel Functions must read the runtime OIDC token from the request header",
);
assert.match(route, /ai-gateway\.vercel\.sh/, "OIDC fallback must use Vercel AI Gateway");
assert.match(route, /v1\/chat\/completions/, "AI Gateway must use its documented image-compatible Chat Completions API");
assert.doesNotMatch(route, /console\.(log|info|debug)/, "AI route must not log uploaded image data");
assert.match(client, /Authorization: `Bearer \$\{token\}`/, "browser request must forward the signed-in session");
assert.match(app, /result\.needsAiFallback/, "cloud AI must only run after local OCR requests fallback");
assert.match(app, /previous\.title\.trim\(\) \? previous\.title/, "OCR must preserve user-entered titles");
assert.match(app, /ocr-privacy-note/, "the UI must disclose temporary cloud processing");
assert.match(migration, /primary key \(user_id, usage_date\)/, "quota must be persisted per user and UTC day");
assert.match(migration, /request_count < daily_limit/, "quota increment must stop at the configured limit");
assert.match(migration, /grant execute[\s\S]*to service_role/, "only the server role may consume quota");
assert.match(env, /^OPENAI_API_KEY=$/m);
assert.match(env, /^BOOK_OCR_AI_MODEL=gpt-5\.4-mini$/m);

console.log("AI book-cover fallback checks passed.");
