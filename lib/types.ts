export type BookStatus = "available" | "negotiating" | "sold";
export type RequestStatus =
  | "pending"
  | "waitlisted"
  | "reserved"
  | "awaiting_confirmation"
  | "completed"
  | "rejected"
  | "cancelled"
  | "expired";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "moderator" | "admin";
export type AccountStatus = "active" | "suspended";
export type StudentVerificationStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type ModerationVisibility = "visible" | "hidden";
export type ListingLifecycleState = "active" | "archived" | "withdrawn";
export type ContactMethod = "none" | "email" | "line";
export type ListingType = "book" | "secondhand";
export type ReportTargetType = "book" | "user";
export type ReportStatus = "pending" | "resolved" | "dismissed";
export type ReportReason =
  | "misleading"
  | "fraud"
  | "duplicate"
  | "harassment"
  | "no_show"
  | "other";
export type NotificationType =
  | "request_created"
  | "request_accepted"
  | "request_rejected"
  | "trade_completed"
  | "book_approved"
  | "book_rejected"
  | "book_hidden"
  | "account_suspended"
  | "trade_message"
  | "order_reminder"
  | "order_expired"
  | "reservation_cancelled"
  | "handoff_confirmation"
  | "book_sold"
  | "listing_lifecycle";

export type Profile = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  accountStatus: AccountStatus;
  suspendedAt: string | null;
  suspensionReason: string;
};

export type Book = {
  id: string;
  sellerId: string;
  listingType: ListingType;
  itemCategory: string;
  title: string;
  author: string;
  department: string;
  course: string;
  teacher: string;
  edition: string;
  publisher: string;
  educationLevel: string;
  grade: string;
  semester: string;
  subject: string;
  volume: string;
  curriculum: string;
  bookType: string;
  isbn13: string;
  approvalNumber: string;
  condition: string;
  price: number;
  imageUrl: string;
  meetup: string;
  description: string;
  contactMethod: ContactMethod;
  contactValue: string;
  status: BookStatus;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  moderationVisibility: ModerationVisibility;
  lifecycleState: ListingLifecycleState;
  listingConfirmedAt: string;
  archivedAt: string | null;
  archiveReason: string;
  createdAt: string;
};

export type SellerLifecycle = {
  lastActiveAt: string;
  listingsConfirmedAt: string;
  firstListingNoticeAt: string | null;
};

export type PurchaseRequest = {
  id: string;
  bookId: string;
  buyerId: string;
  message: string;
  preferredMeetupLocation: string;
  preferredMeetupTime: string;
  status: RequestStatus;
  titleSnapshot: string;
  priceSnapshot: number;
  editionSnapshot: string;
  imageSnapshot: string;
  meetupSnapshot: string;
  reservationExpiresAt: string | null;
  sellerHandoffAt: string | null;
  buyerConfirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string;
  createdAt: string;
  updatedAt: string;
};

export type TradeContact = {
  id: string;
  name: string;
  method: Exclude<ContactMethod, "none">;
  value: string;
  department: string;
};

export type TradeMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imagePaths: string[];
  recalledAt: string | null;
  createdAt: string;
};

export type ConversationStatus = "active" | "closed";

export type Conversation = {
  id: string;
  bookId: string;
  buyerId: string;
  sellerId: string;
  status: ConversationStatus;
  closedReason: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
};

export type OrderEvent = {
  id: string;
  requestId: string;
  eventType: string;
  actorId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type Notification = {
  id: string;
  type: NotificationType;
  bookId: string | null;
  requestId: string | null;
  conversationId: string | null;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type Report = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  targetName: string;
  bookId: string | null;
  bookTitle: string | null;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolutionNote: string;
  createdAt: string;
};

export type FeedbackStatus = "pending" | "resolved";

export type Feedback = {
  id: string;
  userId: string;
  userName: string;
  category: string;
  message: string;
  status: FeedbackStatus;
  resolutionNote: string;
  createdAt: string;
};

export type StudentVerification = {
  id: string;
  userId: string;
  userName: string;
  imagePath: string;
  ocrText: string;
  qualityFlags: Record<string, unknown>;
  status: StudentVerificationStatus;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type TradeReviewTag =
  | "item_as_described"
  | "punctual"
  | "clear_communication"
  | "no_show"
  | "misleading"
  | "other";

export type TradeReview = {
  id: string;
  requestId: string;
  reviewerId: string;
  reviewerName: string;
  revieweeId: string;
  rating: number;
  tags: TradeReviewTag[];
  comment: string;
  createdAt: string;
};

export type RiskLevel = "low" | "medium" | "high";
export type TrustBadgeType = "seller" | "buyer";
export type TrustBadgeStatus = "pending" | "approved" | "rejected";

export type TrustBadge = {
  userId: string;
  badgeType: TrustBadgeType;
  status: TrustBadgeStatus;
  label: string;
  reviewNote: string;
  updatedAt: string;
};

export type RiskEvidence = {
  id: string;
  requestId?: string;
  reviewerId?: string;
  reviewerName?: string;
  targetType?: ReportTargetType;
  targetId?: string;
  reason?: ReportReason;
  details?: string;
  status?: ReportStatus;
  resolutionNote?: string;
  rating?: number;
  tags?: TradeReviewTag[];
  comment?: string;
  createdAt: string;
};

export type RiskProfile = {
  userId: string;
  userName: string;
  userDepartment: string;
  completedTradeCount: number;
  reviewCount: number;
  averageRating: number;
  lowRatingCount: number;
  resolvedReportCount: number;
  seriousReportCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
  sellerBadgeEligible: boolean;
  buyerBadgeEligible: boolean;
  sellerBadgeStatus: TrustBadgeStatus;
  buyerBadgeStatus: TrustBadgeStatus;
  reviewEvidence: RiskEvidence[];
  reportEvidence: RiskEvidence[];
  computedAt: string;
};

export type RiskPolicy = {
  minCompletedTrades: number;
  goodBadgeMinAverage: number;
  goodBadgeMaxSeriousReports: number;
  mediumRiskScore: number;
  highRiskScore: number;
  oneStarPenalty: number;
  twoStarPenalty: number;
  threeStarPenalty: number;
  fraudReportWeight: number;
  harassmentReportWeight: number;
  noShowReportWeight: number;
  misleadingReportWeight: number;
  duplicateReportWeight: number;
  otherReportWeight: number;
  updatedAt: string;
};
