export type BookStatus = "available" | "negotiating" | "sold";
export type RequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type Profile = {
  id: string;
  name: string;
  email: string;
  department: string;
};

export type Book = {
  id: string;
  sellerId: string;
  title: string;
  author: string;
  isbn: string;
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
