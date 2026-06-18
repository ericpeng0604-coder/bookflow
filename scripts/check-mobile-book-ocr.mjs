#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const ocr = readFileSync(new URL("../lib/marketplace/free-ocr.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");

assert.match(ocr, /BOOK_OCR_MAX_SIDE = 1400/, "mobile OCR must cap the processed image size");
assert.match(ocr, /createWorker/, "OCR must use reusable Tesseract workers");
assert.match(ocr, /englishWorkerPromise/, "English fast-path worker must be cached");
assert.match(ocr, /combinedWorkerPromise/, "Chinese fallback worker must be cached");
assert.match(ocr, /tessedit_pageseg_mode: "11"/, "book-cover OCR should use sparse-text page segmentation");
assert.match(
  ocr,
  /recognizeBookCover[\s\S]*getWorker\("eng"\)[\s\S]*getWorker\("eng\+chi_tra"\)/,
  "book OCR must try English before loading the larger Chinese fallback",
);
assert.match(ocr, /recognitionCache = new WeakMap/, "repeated clicks for the same photo must reuse the result");
assert.match(ocr, /isReliableBookOcrResult/, "OCR output must pass a reliability gate before filling fields");
assert.match(app, /warmBookOcr\(\)/, "selecting a cover should warm OCR before the user taps recognize");
assert.match(app, /ocrRequestRef/, "reselecting a photo must invalidate an older OCR response");
assert.match(app, /可信度不足，因此沒有覆寫欄位/, "low-confidence OCR must explain that fields were preserved");
assert.match(app, /正在補強繁體中文辨識/, "the UI must expose the slower fallback stage");

console.log("Mobile book OCR performance and reliability checks passed.");
