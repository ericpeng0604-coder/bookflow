import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20260727060919_secure_book_rls_and_atomic_reservations.sql"),
  "utf8",
);

for (const legacyPolicy of [
  '"Books are publicly readable"',
  '"Users can create their own listings"',
  '"Sellers can update their own listings"',
  '"Sellers can delete their own listings"',
  '"Approved visible books are public and owners can review records"',
  '"Active users can create pending listings"',
  '"Active sellers can update their listings"',
  '"Active sellers and moderators can delete listings"',
]) {
  assert.ok(
    migration.includes(`drop policy if exists ${legacyPolicy} on public.books;`),
    `missing legacy policy drop: ${legacyPolicy}`,
  );
}

assert.match(migration, /review_status = 'approved'[\s\S]*moderation_visibility = 'visible'[\s\S]*lifecycle_state = 'active'/);
assert.match(migration, /public\.is_active_user\(\)/);
assert.match(migration, /from public\.books[\s\S]*for update/);
assert.match(migration, /get diagnostics changed_requests = row_count/);
assert.match(migration, /get diagnostics changed_books = row_count/);
assert.match(migration, /if changed_books <> 1 then/);
assert.match(migration, /respond_to_bundle_purchase_request/);
assert.match(migration, /order by book\.id[\s\S]*for update/);
assert.match(migration, /get diagnostics updated_book_count = row_count/);
assert.match(migration, /if updated_book_count <> active_item_count then/);

console.log("security hardening migration contract passed");
