#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/types.ts", import.meta.url), "utf8");
const cart = readFileSync(new URL("../lib/marketplace/cart.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260723120000_multi_item_orders.sql", import.meta.url), "utf8");

assert.ok(types.includes("export type PurchaseOrderStatus"), "parent order status type must exist");
assert.ok(types.includes("orderId: string | null"), "child requests must expose their parent order");
assert.ok(types.includes("export type CartItem"), "cart item type must exist");
assert.ok(cart.includes("groupCartItems") && cart.includes("hasMeetupConflict"), "cart must group by seller and detect meetup conflicts");
assert.ok(app.includes("<CartModal") && app.includes("create_purchase_order"), "the app must expose a cart checkout and parent-order RPC");
assert.ok(app.includes("逐項") || app.includes("子單"), "the user-facing flow must describe item-level order handling");
assert.ok(migration.includes("create table if not exists public.purchase_orders"), "parent order table migration must exist");
assert.ok(migration.includes("purchase_order_id") && migration.includes("create_purchase_order"), "migration must link child requests and create grouped orders");
assert.ok(migration.includes("enable row level security") && migration.includes("purchase_cart_items"), "cart and order storage must have RLS coverage");
assert.ok(migration.includes("different meetup locations"), "database must reject conflicting fixed meetup locations");

console.log("Multi-item order contracts passed.");
