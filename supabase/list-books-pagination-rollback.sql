-- Rollback for supabase/list-books-pagination.sql
-- Safe to run multiple times (uses IF EXISTS).

drop function if exists public.get_trade_contacts_batch(uuid[]);
drop function if exists public.list_pending_reviews_page(int, timestamptz, uuid);
drop function if exists public.list_my_books();
drop function if exists public.count_books_filtered(text, int, text);
drop function if exists public.list_books_page(int, timestamptz, uuid, text, int, text);

drop index if exists public.books_public_catalog_dept_idx;
drop index if exists public.books_public_catalog_idx;
