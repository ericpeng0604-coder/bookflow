import type {
  Book,
  BookStatus,
  Notification,
  NotificationType,
  Profile,
  PurchaseRequest,
  Report,
  ReportReason,
  ReportTargetType,
  RequestStatus,
  ReviewStatus,
  TradeContact,
  ContactMethod,
  UserRole,
} from "@/lib/types";

export function mapBook(row: Record<string, unknown>): Book {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    title: String(row.title),
    author: String(row.author),
    department: String(row.department || ""),
    course: String(row.course || ""),
    teacher: String(row.teacher || ""),
    edition: String(row.edition || ""),
    condition: String(row.condition),
    price: Number(row.price),
    imageUrl: String(row.image_url),
    meetup: String(row.meetup),
    description: String(row.description || ""),
    contactMethod: String(row.contact_method || "none") as ContactMethod,
    contactValue: String(row.contact_value || ""),
    status: row.status as BookStatus,
    reviewStatus: (row.review_status || "pending") as ReviewStatus,
    reviewNote: String(row.review_note || ""),
    moderationVisibility: String(row.moderation_visibility || "visible") as Book["moderationVisibility"],
    lifecycleState: String(row.lifecycle_state || "active") as Book["lifecycleState"],
    listingConfirmedAt: String(row.listing_confirmed_at || row.created_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    archiveReason: String(row.archive_reason || ""),
    createdAt: String(row.created_at),
  };
}

export function mapRequest(row: Record<string, unknown>): PurchaseRequest {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    buyerId: String(row.buyer_id),
    message: String(row.message),
    status: row.status as RequestStatus,
    createdAt: String(row.created_at),
  };
}

export function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    type: row.type as NotificationType,
    bookId: row.book_id ? String(row.book_id) : null,
    requestId: row.request_id ? String(row.request_id) : null,
    title: String(row.title),
    message: String(row.message || ""),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  };
}

export function mapReport(row: Record<string, unknown>): Report {
  return {
    id: String(row.id),
    reporterId: String(row.reporter_id),
    reporterName: String(row.reporter_name || "使用者"),
    targetType: row.target_type as ReportTargetType,
    targetId: String(row.target_id),
    targetName: String(row.target_name || "未知對象"),
    bookId: row.book_id ? String(row.book_id) : null,
    bookTitle: row.book_title ? String(row.book_title) : null,
    reason: row.reason as ReportReason,
    details: String(row.details || ""),
    status: row.status as Report["status"],
    resolutionNote: String(row.resolution_note || ""),
    createdAt: String(row.created_at),
  };
}

export function mapPublicProfile(row: Record<string, string>): Profile {
  return {
    id: String(row.id),
    name: String(row.name),
    email: "",
    department: String(row.department || ""),
    role: "user",
    accountStatus: "active",
    suspendedAt: null,
    suspensionReason: "",
  };
}

export function mapPartyProfile(row: Record<string, string>): Profile {
  return mapPublicProfile(row);
}

export function mapAdminProfile(row: Record<string, string>): Profile {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    department: String(row.department || ""),
    role: (row.role || "user") as UserRole,
    accountStatus: (row.account_status || "active") as Profile["accountStatus"],
    suspendedAt: row.suspended_at ? String(row.suspended_at) : null,
    suspensionReason: String(row.suspension_reason || ""),
  };
}

export function mapTradeContact(row: Record<string, unknown>): TradeContact {
  return {
    id: String(row.id),
    name: String(row.name),
    method: String(row.method) as TradeContact["method"],
    value: String(row.value),
    department: String(row.department),
  };
}
