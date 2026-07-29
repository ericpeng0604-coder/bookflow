#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { fileURLToPath } from "node:url";

const englishFixture = fileURLToPath(new URL("../tests/fixtures/ocr/english.svg", import.meta.url));
const traditionalChineseFixture = fileURLToPath(new URL("../tests/fixtures/ocr/traditional-chinese.svg", import.meta.url));

async function recognize(worker, image) {
  const result = await worker.recognize(image);
  return result.data.text.replace(/\s+/g, " ").trim();
}

const englishWorker = await createWorker("eng");
const englishImage = await sharp(await readFile(englishFixture)).png().toBuffer();
const firstEnglish = await recognize(englishWorker, englishImage);
const secondEnglish = await recognize(englishWorker, englishImage);
assert.match(firstEnglish, /BOOKFLOW TEST/i, `English OCR output was: ${firstEnglish}`);
assert.equal(secondEnglish, firstEnglish, "reused English worker must produce stable output");
await englishWorker.terminate();

const bilingualWorker = await createWorker("eng+chi_tra");
const traditionalChineseImage = await sharp(await readFile(traditionalChineseFixture)).png().toBuffer();
const traditionalChinese = await recognize(bilingualWorker, traditionalChineseImage);
assert.match(
  traditionalChinese.replace(/\s/g, ""),
  /供應鏈測試/,
  `Traditional Chinese OCR output was: ${traditionalChinese}`,
);
await bilingualWorker.terminate();

console.log("Tesseract runtime OCR checks passed (English reuse and Traditional Chinese fallback sample).");
