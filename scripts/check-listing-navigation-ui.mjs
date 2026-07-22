#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const header = app.slice(app.indexOf('<header className="site-header">'), app.indexOf("</header>"));
const market = app.slice(app.indexOf('<section className="market"'), app.indexOf('view === "book"'));
const listingForm = app.slice(app.indexOf("function BookFormModal"), app.indexOf("function ContactSettingsModal"));
const nativeDialog = app.slice(app.indexOf("function NativeDialog"), app.indexOf("function ModalShell"));
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
assert.ok(
  css.includes(".market-switch button:focus-visible")
    && css.includes("outline-offset: 3px")
    && !css.includes(".site-header .market-switch button:focus-visible"),
  "market switch keyboard focus must use a scoped visible ring without changing the whole header",
);
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
assert.ok(
  listingForm.includes('className="listing-file-input full visually-hidden"')
    && listingForm.includes("hidden")
    && css.includes(".visually-hidden"),
  "the file control must stay hidden behind the custom upload controls",
);
assert.ok(css.includes(".listing-file-input::file-selector-button"), "the native file button must be styled");
assert.ok(
  nativeDialog.includes("const onCloseRef = useRef(onClose)")
    && nativeDialog.includes("onCloseRef.current = onClose")
    && nativeDialog.includes("dialog.showModal()")
    && nativeDialog.includes("onCloseRef.current()"),
  "native dialog close handlers must stay current without reopening the dialog",
);
assert.ok(
  nativeDialog.includes("closeOnBackdrop = true")
    && nativeDialog.includes("event.target === event.currentTarget")
    && modalShell.includes("closeOnBackdrop={closeOnBackdrop}"),
  "modal backdrop close behavior must be configurable",
);
assert.ok(
  (app.match(/<NativeDialog/g) ?? []).length >= 3
    && !app.includes('role="dialog"'),
  "modal shell and image lightboxes must use native dialogs",
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
assert.doesNotMatch(
  listingForm.slice(0, listingForm.indexOf("useEffect")),
  /window\.localStorage/,
  "listing form render and state initialization must not read browser storage",
);
assert.ok(
  listingForm.includes("課堂名稱（選填）")
    && listingForm.includes('className="field-help-anchor"')
    && listingForm.includes('className="field-help-button"')
    && listingForm.includes("課堂名稱填寫說明")
    && css.includes(".field-help-anchor")
    && css.includes(".field-help-text"),
  "the course field must be presented as classroom name with floating help",
);
assert.ok(
  listingForm.includes("ocrProgress")
    && listingForm.includes('className="ocr-progress"')
    && css.includes(".ocr-progress progress"),
  "book OCR must show a visible progress bar",
);
assert.ok(
  listingForm.includes("imageItems.length > 0 && !isNonBookListing")
    && listingForm.includes('className="photo-assist-title"')
    && listingForm.includes('className="photo-assist-tooltip"')
    && listingForm.includes('role="tooltip"')
    && listingForm.includes('使用封面辨識')
    && !listingForm.includes('ocr-cover-note'),
  "book AI recognition must appear only after upload with one action and floating helper copy",
);
assert.ok(
  css.includes(".photo-assist-tooltip")
    && css.includes(".photo-assist-title:hover .photo-assist-tooltip")
    && css.includes(".photo-assist-title:focus-visible .photo-assist-tooltip"),
  "book AI helper copy must float on hover and keyboard focus",
);
assert.doesNotMatch(
  nativeDialog,
  /previouslyFocused\?\.focus\(\);\s*\};\s*}, \[onClose\]\);/,
  "native dialog focus management must not rerun on every input render",
);

console.log("Listing navigation and upload UI checks passed.");
