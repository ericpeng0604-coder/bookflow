import type { Book, CartItem } from "@/lib/types";

export const CART_STORAGE_KEY = "bookflow-cart-v1";

export type CartGroup = {
  sellerId: string;
  items: CartItem[];
  totalPrice: number;
  meetupLocations: string[];
  hasMeetupConflict: boolean;
};

export function cartItemFromBook(book: Book): CartItem {
  return {
    bookId: book.id,
    sellerId: book.sellerId,
    listingType: book.listingType,
    title: book.title,
    price: book.listingType === "giveaway" ? 0 : book.price,
    meetupMode: book.meetupMode,
    meetup: book.meetup.trim(),
    imageUrl: book.imageUrl,
    addedAt: new Date().toISOString(),
  };
}

export function readCart(storage?: Storage | null): CartItem[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(CART_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[], storage?: Storage | null) {
  storage?.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function addCartItem(items: CartItem[], item: CartItem) {
  return items.some((candidate) => candidate.bookId === item.bookId) ? items : [...items, item];
}

export function removeCartItem(items: CartItem[], bookId: string) {
  return items.filter((item) => item.bookId !== bookId);
}

export function reconcileCart(items: CartItem[], books: Book[]) {
  const available = new Map(books.map((book) => [book.id, book]));
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const book = available.get(item.bookId);
    if (!book || seen.has(book.id) || book.status !== "available" || book.lifecycleState !== "active" || book.reviewStatus !== "approved") {
      return [];
    }
    seen.add(book.id);
    return [cartItemFromBook(book)];
  });
}

export function groupCartItems(items: CartItem[]): CartGroup[] {
  const groups = new Map<string, CartItem[]>();
  for (const item of items) groups.set(item.sellerId, [...(groups.get(item.sellerId) || []), item]);
  return [...groups.entries()].map(([sellerId, sellerItems]) => {
    const meetupLocations = [...new Set(sellerItems.map((item) => item.meetup.trim()).filter(Boolean))];
    return {
      sellerId,
      items: sellerItems,
      totalPrice: sellerItems.reduce((total, item) => total + item.price, 0),
      meetupLocations,
      hasMeetupConflict: meetupLocations.length > 1,
    };
  });
}

export function canCheckoutGroup(group: CartGroup) {
  return !group.hasMeetupConflict;
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return typeof item.bookId === "string"
    && typeof item.sellerId === "string"
    && typeof item.title === "string"
    && typeof item.price === "number";
}
