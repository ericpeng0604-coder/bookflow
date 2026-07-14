#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  buildImageSearchPlan,
  buildImageSearchQuery,
  rankImageSearchResults,
} from "../lib/marketplace/image-search.ts";

function book(overrides) {
  return {
    id: overrides.id,
    sellerId: "seller-1",
    listingType: "book",
    itemCategory: "",
    title: "",
    author: "",
    department: "通識",
    course: "",
    teacher: "",
    edition: "",
    publisher: "",
    educationLevel: "",
    grade: "",
    semester: "",
    subject: "",
    volume: "",
    curriculum: "",
    bookType: "",
    isbn13: "",
    approvalNumber: "",
    condition: "良好",
    price: 300,
    imageUrl: "/book.jpg",
    meetup: "",
    description: "",
    contactMethod: "none",
    contactValue: "",
    status: "available",
    reviewStatus: "approved",
    reviewNote: "",
    moderationVisibility: "visible",
    lifecycleState: "active",
    listingConfirmedAt: "2026-07-01T00:00:00.000Z",
    archivedAt: null,
    archiveReason: "",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const plan = buildImageSearchPlan({
  title: "  普通物理學  ",
  author: "Richard   Wolfson",
  edition: "第 4 版",
  publisher: "Pearson",
});

assert.equal(
  buildImageSearchQuery({
    title: "  普通物理學  ",
    author: "Richard   Wolfson",
    edition: "第 4 版",
    publisher: "Pearson",
  }),
  "普通物理學 Richard Wolfson 第 4 版",
  "legacy query helper should still expose the display query",
);
assert.equal(plan.displayQuery, "普通物理學 Richard Wolfson 第 4 版");
assert.ok(plan.candidateQueries.includes("普通物理學 第 4 版"), "plan should search title plus edition");
assert.ok(plan.candidateQueries.includes("普通物理學 Richard Wolfson"), "plan should search title plus author");
assert.ok(plan.candidateQueries.includes("普通物理學"), "plan should search the full title");
assert.deepEqual(
  buildImageSearchPlan({ title: "微積分", author: "微積分", edition: "" }).scoreTokens.title,
  ["微積分"],
  "duplicate OCR tokens should be removed",
);
assert.deepEqual(
  buildImageSearchPlan({ title: "", author: "", edition: "" }).candidateQueries,
  [],
  "empty OCR drafts must not create broad marketplace queries",
);

const ranked = rankImageSearchResults([
  book({ id: "author-only", title: "工程數學", author: "Richard Wolfson", createdAt: "2026-07-03T00:00:00.000Z" }),
  book({ id: "title-edition", title: "普通物理學", author: "Other Author", edition: "第 4 版" }),
  book({ id: "exact", title: "普通物理學", author: "Richard Wolfson", edition: "第 4 版", publisher: "Pearson" }),
], plan);

assert.equal(ranked[0].book.id, "exact", "exact title/author/edition matches should rank first");
assert.ok(
  ranked.findIndex((result) => result.book.id === "title-edition")
    < ranked.findIndex((result) => result.book.id === "author-only"),
  "title plus edition should outrank an author-only match",
);
assert.ok(ranked[0].matchedFields.includes("title"), "ranked results should expose matched fields");

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const projectChecks = readFileSync(new URL("./run-project-checks.mjs", import.meta.url), "utf8");

assert.match(app, /buildImageSearchPlan/, "marketplace app must use the image search plan helper");
assert.match(app, /fetchImageSearchCandidates/, "image search must fetch multiple site-local candidates");
assert.match(app, /rankImageSearchResults/, "image search must rank local demo results with the shared helper");
assert.match(app, /recognizeBookCover\((?:file|ocrFile)/, "image search must start with browser-side book-cover OCR");
assert.match(app, /recognizeBookCoverWithAi\(supabase, (?:file|ocrFile), primaryResult\.text\)/, "weak OCR may use the existing authenticated AI fallback");
assert.match(app, /compressBookOcrImage\(file\)/, "image search must compress the OCR copy before recognition");
assert.match(app, /setListingType\("book"\)/, "image search must target the book marketplace");
assert.match(app, /setImageSearchActive\(true\)/, "image search must enter a dedicated ranked-result mode");
assert.match(app, /setImageSearchActive\(false\)/, "manual search and filter reset must be able to exit image mode");
assert.match(app, /updateMarketplaceQuery\(event\.target\.value\)/, "manual query edits must leave image-search sorting mode");
assert.doesNotMatch(app, /setQuery\(finalPlan\.displayQuery\)/, "image search must not write OCR text into the normal search box");
assert.match(app, /正在比對站內刊登/, "UI must disclose that photo search is site-local");
assert.match(app, /站內找到 \{imageSearchResultCount\} 筆相近結果/, "UI must show the image-search result count");
assert.match(app, /className="visually-hidden"[\s\S]*accept="image\/jpeg,image\/png,image\/webp"/, "image search file input must use the shared hidden utility");
assert.match(app, /accept="image\/jpeg,image\/png,image\/webp"/, "image search upload must accept only supported image formats");
assert.match(app, /IMAGE_SEARCH_MAX_FILE_BYTES = 5 \* 1024 \* 1024/, "image search must enforce the 5MB frontend limit");
assert.doesNotMatch(app, /google\.com|lens\.google|bing\.com|yandex\.com|tineye\.com/i, "image search must not link to external image search");
assert.doesNotMatch(app, /window\.open\(/, "image search must not open an external search tab");
assert.match(queries, /list_books_page/, "candidate search must reuse the existing marketplace RPC");
const candidateFunction = queries.match(
  /export async function fetchImageSearchCandidates[\s\S]*?\r?\n}\r?\n\r?\nexport async function fetchBookById/,
)?.[0] ?? "";
assert.ok(candidateFunction, "candidate search helper must be present");
assert.doesNotMatch(candidateFunction, /from\("books"\)/, "candidate search must not bypass the marketplace listing contract");
assert.match(styles, /image-search-status/, "image search status UI must be styled");
assert.match(styles, /\.visually-hidden[\s\S]*clip: rect\(0 0 0 0\)/, "shared hidden utility must visually hide the image search file input");
assert.match(projectChecks, /check-image-search\.mjs/, "project checks must include the image search contract");

console.log("Advanced site-local image search checks passed.");
