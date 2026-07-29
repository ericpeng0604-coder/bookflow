import type { MeetupMode, RequestStatus } from "@/lib/types";

export const MEETUP_INFO_MAX_LENGTH = 120;

const EDITABLE_REQUEST_STATUSES: ReadonlySet<RequestStatus> = new Set([
  "pending",
  "waitlisted",
  "awaiting_recipient_confirmation",
  "reserved",
  "awaiting_confirmation",
]);

export function canEditMeetupInfo({
  requestStatus,
  meetupMode,
  currentUserId,
  buyerId,
  sellerId,
}: {
  requestStatus: RequestStatus;
  meetupMode: MeetupMode;
  currentUserId: string;
  buyerId: string;
  sellerId: string;
}) {
  if (!EDITABLE_REQUEST_STATUSES.has(requestStatus)) return false;
  const isBuyer = currentUserId === buyerId;
  const isSeller = currentUserId === sellerId;
  if (!isBuyer && !isSeller) return false;
  return meetupMode !== "fixed_location" || isSeller;
}

export function normalizeMeetupInfo(location: string, time: string) {
  return {
    location: location.trim().slice(0, MEETUP_INFO_MAX_LENGTH),
    time: time.trim().slice(0, MEETUP_INFO_MAX_LENGTH),
  };
}

export function meetupInfoSummary({
  location,
  time,
  fallbackLocation = "",
}: {
  location: string;
  time: string;
  fallbackLocation?: string;
}) {
  return {
    location: location.trim() || fallbackLocation.trim(),
    time: time.trim(),
  };
}
