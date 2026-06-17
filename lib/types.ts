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
export type StudentVerificationStatus = "pending" | "approved" | "rejected";
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
  userEmail: string;
  imagePath: string;
  ocrText: string;
  qualityFlags: Record<string, unknown>;
  status: StudentVerificationStatus;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
