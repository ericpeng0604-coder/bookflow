import assert from "node:assert/strict";
import test from "node:test";
import { addCartItem, canCheckoutGroup, cartItemFromBook, groupCartItems, reconcileCart } from "../lib/marketplace/cart.ts";

const book = (id, sellerId, meetup = "虎科圖書館") => ({
  id, sellerId, listingType: "book", title: id, price: 100, imageUrl: "", meetupMode: "fixed_location", meetup,
  status: "available", lifecycleState: "active", reviewStatus: "approved",
});

test("cart groups items by seller and totals each group", () => {
  const items = [cartItemFromBook(book("a", "seller-1")), cartItemFromBook(book("b", "seller-1")), cartItemFromBook(book("c", "seller-2"))];
  const groups = groupCartItems(items);
  assert.deepEqual(groups.map((group) => [group.sellerId, group.items.length, group.totalPrice]), [["seller-1", 2, 200], ["seller-2", 1, 100]]);
});

test("cart rejects a seller group with conflicting fixed meetup locations", () => {
  const group = groupCartItems([cartItemFromBook(book("a", "seller-1", "圖書館")), cartItemFromBook(book("b", "seller-1", "校門口"))])[0];
  assert.equal(group.hasMeetupConflict, true);
  assert.equal(canCheckoutGroup(group), false);
});

test("cart add is idempotent and reconciliation removes unavailable or duplicate items", () => {
  const item = cartItemFromBook(book("a", "seller-1"));
  assert.equal(addCartItem([item], item).length, 1);
  const result = reconcileCart([item, item, cartItemFromBook(book("missing", "seller-1"))], [book("a", "seller-1")]);
  assert.deepEqual(result.map((candidate) => candidate.bookId), ["a"]);
});
