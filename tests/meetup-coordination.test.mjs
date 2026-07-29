import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditMeetupInfo,
  meetupInfoSummary,
  normalizeMeetupInfo,
} from "../lib/marketplace/meetup-coordination.ts";

const parties = {
  requestStatus: "reserved",
  buyerId: "buyer-1",
  sellerId: "seller-1",
};

test("fixed listing location can only be changed by the seller", () => {
  assert.equal(canEditMeetupInfo({ ...parties, meetupMode: "fixed_location", currentUserId: "buyer-1" }), false);
  assert.equal(canEditMeetupInfo({ ...parties, meetupMode: "fixed_location", currentUserId: "seller-1" }), true);
});

test("non-fixed meetup modes allow either transaction party", () => {
  for (const meetupMode of ["mutual_discussion", "applicant_preferred"]) {
    assert.equal(canEditMeetupInfo({ ...parties, meetupMode, currentUserId: "buyer-1" }), true);
    assert.equal(canEditMeetupInfo({ ...parties, meetupMode, currentUserId: "seller-1" }), true);
  }
});

test("completed and cancelled transactions cannot change meetup info", () => {
  for (const requestStatus of ["completed", "cancelled", "rejected", "expired"]) {
    assert.equal(canEditMeetupInfo({ ...parties, requestStatus, meetupMode: "mutual_discussion", currentUserId: "buyer-1" }), false);
  }
});

test("meetup values are trimmed and capped at the shared field limit", () => {
  const result = normalizeMeetupInfo(`  ${"地".repeat(130)}  `, "  星期三下午  ");
  assert.equal(result.location.length, 120);
  assert.equal(result.time, "星期三下午");
});

test("summary uses listing location as the fixed-location fallback", () => {
  assert.deepEqual(
    meetupInfoSummary({ location: "", time: "星期三下午", fallbackLocation: "圖書館一樓" }),
    { location: "圖書館一樓", time: "星期三下午" },
  );
});
