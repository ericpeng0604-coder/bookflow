export type BookStatus = "available" | "negotiating" | "sold";
export type RequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "moderator" | "admin";
export type AccountStatus = "active" | "suspended";
export type ModerationVisibility = "visible" | "hidden";
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
  | "account_suspended";

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
  status: BookStatus;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  moderationVisibility: ModerationVisibility;
  createdAt: string;
};

export type PurchaseRequest = {
  id: string;
  bookId: string;
  buyerId: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
};

export type TradeContact = {
  id: string;
  name: string;
  email: string;
  department: string;
};

export type Notification = {
  id: string;
  type: NotificationType;
  bookId: string | null;
  requestId: string | null;
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
