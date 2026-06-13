import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deliverNotificationEmails } from "@/lib/server/notification-email";
import { deliverBrowserPush } from "@/lib/server/notification-push";

function storagePath(imageUrl: string) {
  if (!imageUrl) return null;
  try {
    const path = decodeURIComponent(new URL(imageUrl).pathname);
    const marker = "/storage/v1/object/public/book-images/";
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(index + marker.length) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service is not configured" }, { status: 503 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const { data: lifecycle, error: lifecycleError } = await admin.rpc("process_listing_lifecycle", {
    reference_time: now.toISOString(),
  });
  if (lifecycleError) {
    return NextResponse.json({ error: lifecycleError.message }, { status: 500 });
  }

  const cleanupBefore = new Date(now.getTime() - 365 * 86400000).toISOString();
  const { data: dueBooks, error: dueError } = await admin
    .from("books")
    .select("id,seller_id,image_url")
    .eq("lifecycle_state", "archived")
    .lte("archived_at", cleanupBefore)
    .limit(100);
  if (dueError) {
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  let deleted = 0;
  let sanitized = 0;
  let cleanupFailed = 0;
  for (const book of dueBooks ?? []) {
    const { count, error: requestError } = await admin
      .from("purchase_requests")
      .select("id", { count: "exact", head: true })
      .eq("book_id", book.id);
    if (requestError) {
      cleanupFailed += 1;
      continue;
    }

    const imagePath = storagePath(String(book.image_url || ""));
    if (imagePath) {
      const { error: storageError } = await admin.storage.from("book-images").remove([imagePath]);
      if (storageError) {
        cleanupFailed += 1;
        continue;
      }
    }

    if ((count ?? 0) === 0) {
      const { error: deleteError } = await admin.from("books").delete().eq("id", book.id);
      if (deleteError) {
        cleanupFailed += 1;
        continue;
      }
      await admin.from("listing_lifecycle_logs").insert({
        seller_id: book.seller_id,
        action: "listing_deleted",
        reason: "archived_one_year_without_requests",
        metadata: { deleted_book_id: book.id },
      });
      deleted += 1;
      continue;
    }

    await admin.from("book_contact_preferences").delete().eq("book_id", book.id);
    const { error: sanitizeError } = await admin
      .from("books")
      .update({
        image_url: "",
        meetup: "資料已依保留政策移除",
        description: "",
        lifecycle_state: "withdrawn",
        sanitized_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", book.id)
      .eq("lifecycle_state", "archived");
    if (sanitizeError) {
      cleanupFailed += 1;
      continue;
    }
    await admin.from("listing_lifecycle_logs").insert({
      seller_id: book.seller_id,
      book_id: book.id,
      action: "listing_sanitized",
      reason: "archived_one_year_with_history",
    });
    sanitized += 1;
  }

  let email = { enabled: false, sent: 0, failed: 0 };
  try {
    email = await deliverNotificationEmails(admin, { limit: 100 });
  } catch (error) {
    email = { enabled: true, sent: 0, failed: 1 };
    console.error("Lifecycle email delivery failed", error);
  }

  let push = { enabled: false, sent: 0, failed: 0, skipped: 0 };
  try {
    push = await deliverBrowserPush(admin, { limit: 100 });
  } catch (error) {
    push = { enabled: true, sent: 0, failed: 1, skipped: 0 };
    console.error("Lifecycle browser push delivery failed", error);
  }

  return NextResponse.json({
    ok: true,
    lifecycle,
    cleanup: { deleted, sanitized, failed: cleanupFailed },
    email,
    push,
  });
}
