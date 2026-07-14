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
  Conversation,
  ContactMethod,
  Feedback,
  StudentVerification,
  RiskEvidence,
  RiskLevel,
  RiskPolicy,
  RiskProfile,
  TradeReview,
  TradeReviewTag,
  TrustBadge,
  TrustBadgeStatus,
  TrustBadgeType,
  UserRole,
} from "@/lib/types";

export function mapBook(row: Record<string, unknown>): Book {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    listingType: String(row.listing_type || "book") as Book["listingType"],
    itemCategory: String(row.item_category || "book"),
    title: String(row.title),
    author: String(row.author),
    department: String(row.department || ""),
    course: String(row.course || ""),
    teacher: String(row.teacher || ""),
    edition: String(row.edition || ""),
    publisher: String(row.publisher || ""),
    educationLevel: String(row.education_level || ""),
    grade: String(row.grade || ""),
    semester: String(row.semester || ""),
    subject: String(row.subject || ""),
    volume: String(row.volume || ""),
    curriculum: String(row.curriculum || ""),
    bookType: String(row.book_type || ""),
    isbn13: String(row.isbn13 || ""),
    approvalNumber: String(row.approval_number || ""),
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
    preferredMeetupLocation: String(row.preferred_meetup_location || ""),
    preferredMeetupTime: String(row.preferred_meetup_time || ""),
    status: row.status as RequestStatus,
    titleSnapshot: String(row.title_snapshot || ""),
    priceSnapshot: Number(row.price_snapshot || 0),
    editionSnapshot: String(row.edition_snapshot || ""),
    imageSnapshot: String(row.image_snapshot || ""),
    meetupSnapshot: String(row.meetup_snapshot || ""),
    reservationExpiresAt: row.reservation_expires_at ? String(row.reservation_expires_at) : null,
    sellerHandoffAt: row.seller_handoff_at ? String(row.seller_handoff_at) : null,
    buyerConfirmedAt: row.buyer_confirmed_at ? String(row.buyer_confirmed_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    cancellationReason: String(row.cancellation_reason || ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
  };
}

export function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    buyerId: String(row.buyer_id),
    sellerId: String(row.seller_id),
    status: String(row.status || "active") as Conversation["status"],
    closedReason: String(row.closed_reason || ""),
    lastMessageAt: String(row.last_message_at || row.created_at),
    unreadCount: Number(row.unread_count || 0),
    createdAt: String(row.created_at),
  };
}

export function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    type: row.type as NotificationType,
    bookId: row.book_id ? String(row.book_id) : null,
    requestId: row.request_id ? String(row.request_id) : null,
    conversationId: row.conversation_id ? String(row.conversation_id) : null,
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

export function mapFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name || "使用者"),
    category: String(row.category || "other"),
    message: String(row.message || ""),
    status: String(row.status || "pending") as Feedback["status"],
    resolutionNote: String(row.resolution_note || ""),
    createdAt: String(row.created_at),
  };
}

export function mapStudentVerification(row: Record<string, unknown>): StudentVerification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name || "使用者"),
    imagePath: String(row.image_path || ""),
    ocrText: String(row.ocr_text || ""),
    qualityFlags: typeof row.quality_flags === "object" && row.quality_flags !== null
      ? row.quality_flags as Record<string, unknown>
      : {},
    status: String(row.status || "pending") as StudentVerification["status"],
    reviewNote: String(row.review_note || ""),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
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

function jsonArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function mapRiskEvidence(row: Record<string, unknown>): RiskEvidence {
  return {
    id: String(row.id),
    requestId: row.request_id ? String(row.request_id) : undefined,
    reviewerId: row.reviewer_id ? String(row.reviewer_id) : undefined,
    reviewerName: row.reviewer_name ? String(row.reviewer_name) : undefined,
    targetType: row.target_type as RiskEvidence["targetType"],
    targetId: row.target_id ? String(row.target_id) : undefined,
    reason: row.reason as RiskEvidence["reason"],
    details: row.details ? String(row.details) : undefined,
    status: row.status as RiskEvidence["status"],
    resolutionNote: row.resolution_note ? String(row.resolution_note) : undefined,
    rating: row.rating === undefined ? undefined : Number(row.rating),
    tags: Array.isArray(row.tags) ? row.tags.map(String) as TradeReviewTag[] : undefined,
    comment: row.comment ? String(row.comment) : undefined,
    createdAt: String(row.created_at),
  };
}

export function mapTradeReview(row: Record<string, unknown>): TradeReview {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    reviewerId: String(row.reviewer_id),
    reviewerName: String(row.reviewer_name || "使用者"),
    revieweeId: String(row.reviewee_id),
    rating: Number(row.rating || 0),
    tags: Array.isArray(row.tags) ? row.tags.map(String) as TradeReviewTag[] : [],
    comment: String(row.comment || ""),
    createdAt: String(row.created_at),
  };
}

export function mapTrustBadge(row: Record<string, unknown>): TrustBadge {
  return {
    userId: String(row.user_id),
    badgeType: String(row.badge_type) as TrustBadgeType,
    status: String(row.status || "approved") as TrustBadgeStatus,
    label: String(row.label || (row.badge_type === "buyer" ? "推薦買家" : "優良賣家")),
    reviewNote: String(row.review_note || ""),
    updatedAt: String(row.updated_at || row.approved_at || ""),
  };
}

export function mapRiskProfile(row: Record<string, unknown>): RiskProfile {
  return {
    userId: String(row.user_id),
    userName: String(row.user_name || "使用者"),
    userDepartment: String(row.user_department || ""),
    completedTradeCount: Number(row.completed_trade_count || 0),
    reviewCount: Number(row.review_count || 0),
    averageRating: Number(row.average_rating || 0),
    lowRatingCount: Number(row.low_rating_count || 0),
    resolvedReportCount: Number(row.resolved_report_count || 0),
    seriousReportCount: Number(row.serious_report_count || 0),
    riskScore: Number(row.risk_score || 0),
    riskLevel: String(row.risk_level || "low") as RiskLevel,
    sellerBadgeEligible: Boolean(row.seller_badge_eligible),
    buyerBadgeEligible: Boolean(row.buyer_badge_eligible),
    sellerBadgeStatus: String(row.seller_badge_status || "pending") as TrustBadgeStatus,
    buyerBadgeStatus: String(row.buyer_badge_status || "pending") as TrustBadgeStatus,
    reviewEvidence: jsonArray(row.review_evidence).map(mapRiskEvidence),
    reportEvidence: jsonArray(row.report_evidence).map(mapRiskEvidence),
    computedAt: String(row.computed_at),
  };
}

export function mapRiskPolicy(row: Record<string, unknown>): RiskPolicy {
  return {
    minCompletedTrades: Number(row.min_completed_trades || 0),
    goodBadgeMinAverage: Number(row.good_badge_min_average || 0),
    goodBadgeMaxSeriousReports: Number(row.good_badge_max_serious_reports || 0),
    mediumRiskScore: Number(row.medium_risk_score || 0),
    highRiskScore: Number(row.high_risk_score || 0),
    oneStarPenalty: Number(row.one_star_penalty || 0),
    twoStarPenalty: Number(row.two_star_penalty || 0),
    threeStarPenalty: Number(row.three_star_penalty || 0),
    fraudReportWeight: Number(row.fraud_report_weight || 0),
    harassmentReportWeight: Number(row.harassment_report_weight || 0),
    noShowReportWeight: Number(row.no_show_report_weight || 0),
    misleadingReportWeight: Number(row.misleading_report_weight || 0),
    duplicateReportWeight: Number(row.duplicate_report_weight || 0),
    otherReportWeight: Number(row.other_report_weight || 0),
    updatedAt: String(row.updated_at),
  };
}
