-- PostgREST cannot resolve the text RPC when the legacy enum overload is also exposed.
-- The current client sends response as text, so keep one unambiguous public signature.
drop function if exists public.respond_to_purchase_request(uuid, public.request_status);

notify pgrst, 'reload schema';
