import type { PurchaseRequest, RequestStatus } from "@/lib/types";

export const GIVEAWAY_ACTIVE_REQUEST_STATUSES: RequestStatus[] = [
  "pending",
  "waitlisted",
  "awaiting_recipient_confirmation",
  "reserved",
  "awaiting_confirmation",
];

export function sortGiveawayRequests(
  requests: PurchaseRequest[],
  verifiedUserIds: ReadonlySet<string>,
) {
  return [...requests].sort((left, right) => {
    const verificationOrder = Number(verifiedUserIds.has(right.buyerId)) - Number(verifiedUserIds.has(left.buyerId));
    if (verificationOrder !== 0) return verificationOrder;
    return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  });
}

export function giveawayRequestLabel(status: RequestStatus) {
  const labels: Partial<Record<RequestStatus, string>> = {
    pending: "等待贈送者選擇",
    waitlisted: "候補中",
    awaiting_recipient_confirmation: "等待受贈者確認",
    reserved: "已保留・待面交",
    awaiting_confirmation: "等待雙方完成確認",
    completed: "已完成",
    rejected: "已拒絕",
    cancelled: "已取消",
    expired: "已失去保留資格",
  };
  return labels[status] ?? status;
}

export function giveawayChatBanner(status: RequestStatus) {
  if (status === "pending" || status === "waitlisted") {
    return "尚未選定受贈者，贈送者正在確認領取安排。";
  }
  if (status === "awaiting_recipient_confirmation") {
    return "贈送者已選定受贈者，等待對方在 24 小時內確認。";
  }
  if (status === "reserved") return "已保留・待面交，請在聊天室確認面交安排。";
  if (status === "awaiting_confirmation") return "面交完成需要雙方確認，聊天不會自動判定完成。";
  return "";
}
