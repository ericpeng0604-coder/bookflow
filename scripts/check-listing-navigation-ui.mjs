#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const header = app.slice(app.indexOf('<header className="site-header">'), app.indexOf("</header>"));
const market = app.slice(app.indexOf('<section className="market"'), app.indexOf('view === "book"'));
const listingForm = app.slice(app.indexOf("function BookFormModal"), app.indexOf("function ContactSettingsModal"));
const modalShell = app.slice(app.indexOf("function ModalShell"), app.indexOf("function ActionDialog"));

assert.ok(
  header.includes('switchListingType(isSecondhandMode ? "book" : "secondhand")'),
  "market switching must remain in the top-right menu",
);
assert.ok(!header.includes(">課本市場</button>"), "desktop navigation must not show a separate textbook market button");
assert.ok(!header.includes(">二手市場</button>"), "desktop navigation must not show a separate secondhand market button");
assert.ok(!header.includes('openListingForm("book")'), "header must not expose a separate textbook listing entry");
assert.ok(!header.includes('openListingForm("secondhand")'), "header must not expose a separate secondhand listing entry");
assert.ok(!market.includes("market-mode-switch"), "the catalog must not expose another market switch");
assert.ok(!listingForm.includes("cover-upload"), "the large duplicate upload card must be removed");
assert.ok(
  listingForm.includes("function preventImplicitSubmit")
    && listingForm.includes("event.nativeEvent.isComposing")
    && listingForm.includes('onKeyDown={preventImplicitSubmit}'),
  "single-line listing fields must not implicitly submit the form on Enter",
);
assert.equal(
  (listingForm.match(/type="file"/g) ?? []).length,
  1,
  "the listing form must contain exactly one file control",
);
assert.ok(listingForm.includes('className="listing-file-input full"'), "the file control must use the styled input");
assert.ok(css.includes(".listing-file-input::file-selector-button"), "the native file button must be styled");
assert.ok(
  modalShell.includes("const onCloseRef = useRef(onClose)")
    && modalShell.includes("onCloseRef.current = onClose")
    && modalShell.includes("onCloseRef.current()"),
  "modal close handlers must stay current without rerunning the focus trap",
);
assert.ok(
  modalShell.includes("closeOnBackdrop = true")
    && modalShell.includes("onClick={closeOnBackdrop ? onClose : undefined}"),
  "modal backdrop close behavior must be configurable",
);
assert.ok(
  listingForm.includes("closeOnBackdrop={false}"),
  "the listing form must not close when text selection drags outside the modal",
);
assert.ok(
  app.includes("listingDepartmentStorageKey")
    && listingForm.includes("savedDepartment")
    && listingForm.includes('field === "department"'),
  "new textbook listings must remember the last selected department only",
);
assert.ok(
  listingForm.includes("ocrProgress")
    && listingForm.includes('className="ocr-progress"')
    && css.includes(".ocr-progress progress"),
  "book OCR must show a visible progress bar",
);
assert.doesNotMatch(
  modalShell,
  /previouslyFocused\?\.focus\(\);\s*\};\s*}, \[onClose\]\);/,
  "modal focus trap must not rerun on every input render",
);

console.log("Listing navigation and upload UI checks passed.");
