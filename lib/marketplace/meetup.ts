import type { MeetupMode } from "@/lib/types";

export const MEETUP_MODE_OPTIONS: ReadonlyArray<readonly [MeetupMode, string]> = [
  ["fixed_location", "贈送者指定位置"],
  ["mutual_discussion", "雙方討論地點"],
  ["applicant_preferred", "配合申請者"],
];

export const DEFAULT_MEETUP_MODE: MeetupMode = "fixed_location";

export function isMeetupMode(value: unknown): value is MeetupMode {
  return value === "fixed_location" || value === "mutual_discussion" || value === "applicant_preferred";
}

export function normalizeMeetupMode(value: unknown): MeetupMode {
  return isMeetupMode(value) ? value : DEFAULT_MEETUP_MODE;
}

export function meetupModeLabel(value: unknown): string {
  const mode = normalizeMeetupMode(value);
  return MEETUP_MODE_OPTIONS.find(([key]) => key === mode)?.[1] || "贈送者指定位置";
}
