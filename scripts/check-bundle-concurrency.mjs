#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const base = process.env.STAGING_SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const projectRef = process.env.STAGING_SUPABASE_PROJECT_REF;

if (!base || !anonKey || !serviceKey || !projectRef) {
  throw new Error(
    "STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY, STAGING_SUPABASE_SERVICE_ROLE_KEY, and STAGING_SUPABASE_PROJECT_REF are required.",
  );
}
if (
  process.env.STAGING_BUNDLE_CONCURRENCY_CONFIRM !== "yes"
  || !/^https:\/\//.test(base)
  || anonKey === serviceKey
  || !new URL(base).hostname.startsWith(`${projectRef}.`)
) {
  throw new Error(
    "Refusing to run: set STAGING_BUNDLE_CONCURRENCY_CONFIRM=yes and verify the explicit staging project ref.",
  );
}

async function request(path, key, options = {}) {
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

async function jsonRequest(path, key, options = {}) {
  const response = await request(path, key, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

const suffix = randomUUID();
const password = `BundleConcurrency-${randomUUID()}-A9!`;
const users = [
  { name: "bundle-test-seller", email: `bundle-test-seller-${suffix}@example.invalid` },
  { name: "bundle-test-buyer-one", email: `bundle-test-buyer-one-${suffix}@example.invalid` },
  { name: "bundle-test-buyer-two", email: `bundle-test-buyer-two-${suffix}@example.invalid` },
];
const createdUserIds = [];
const bundleIds = [randomUUID(), randomUUID()];
let bookId;

try {
  for (const user of users) {
    const created = await jsonRequest("/auth/v1/admin/users", serviceKey, {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: { name: user.name, department: "test" },
      }),
    });
    createdUserIds.push(created.id);
  }

  const sellerId = createdUserIds[0];
  const book = await jsonRequest("/rest/v1/books?select=id", serviceKey, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      seller_id: sellerId,
      listing_type: "book",
      item_category: "book",
      title: `bundle-concurrency-${suffix}`,
      author: "test",
      condition: "good",
      meetup: "test",
      status: "available",
      review_status: "approved",
      moderation_visibility: "visible",
      lifecycle_state: "active",
    }),
  });
  bookId = book[0].id;

  await jsonRequest("/rest/v1/bundle_purchase_requests", serviceKey, {
    method: "POST",
    body: JSON.stringify(bundleIds.map((id, index) => ({
      id,
      buyer_id: createdUserIds[index + 1],
      seller_id: sellerId,
      status: "pending",
      message: `bundle-concurrency-${index}`,
    }))),
  });
  await jsonRequest("/rest/v1/bundle_purchase_request_items", serviceKey, {
    method: "POST",
    body: JSON.stringify(bundleIds.map((bundleId) => ({
      bundle_id: bundleId,
      book_id: bookId,
      title_snapshot: "bundle-concurrency",
      price_snapshot: 0,
      edition_snapshot: "",
      image_snapshot: "",
      meetup_snapshot: "test",
    }))),
  });

  const sessions = await Promise.all(users.slice(0, 1).flatMap((user) => [0, 1].map(() =>
    jsonRequest("/auth/v1/token?grant_type=password", anonKey, {
      method: "POST",
      body: JSON.stringify({ email: user.email, password }),
    })
  )));
  const outcomes = await Promise.all(bundleIds.map(async (bundleId, index) => {
    const response = await request("/rest/v1/rpc/respond_to_bundle_purchase_request", anonKey, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessions[index].access_token}` },
      body: JSON.stringify({ target_bundle_id: bundleId, response: "accepted" }),
    });
    return { status: response.status, body: await response.text() };
  }));

  const successes = outcomes.filter((outcome) => outcome.status >= 200 && outcome.status < 300);
  const conflicts = outcomes.filter((outcome) => outcome.body.includes("A selected listing is unavailable"));
  if (successes.length !== 1 || conflicts.length !== 1) {
    throw new Error(`Expected one success and one unavailable conflict; outcomes=${JSON.stringify(outcomes)}`);
  }

  const rows = await jsonRequest(`/rest/v1/books?id=eq.${bookId}&select=status`, serviceKey);
  if (rows.length !== 1 || rows[0].status !== "negotiating") {
    throw new Error(`Expected one negotiating listing; rows=${JSON.stringify(rows)}`);
  }
  console.log("bundle concurrency check passed: one bundle reserved, one conflicted");
} finally {
  await request(`/rest/v1/bundle_purchase_requests?id=in.(${bundleIds.join(",")})`, serviceKey, {
    method: "DELETE",
  }).catch(() => {});
  if (bookId) {
    await request(`/rest/v1/books?id=eq.${bookId}`, serviceKey, { method: "DELETE" }).catch(() => {});
  }
  for (const userId of createdUserIds) {
    await request(`/auth/v1/admin/users/${userId}`, serviceKey, { method: "DELETE" }).catch(() => {});
  }
}
