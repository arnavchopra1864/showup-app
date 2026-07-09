-- Fix refresh_checkin_token: gen_random_bytes() lives in pgcrypto, which on
-- hosted Supabase is installed into the `extensions` schema (see the
-- unqualified `create extension "pgcrypto"` in 0001_init.sql:6). The function
-- is `security definer set search_path = public`, so the unqualified call to
-- gen_random_bytes(3) fails with "function gen_random_bytes(integer) does not
-- exist" once the search_path is pinned. We keep search_path pinned (it's
-- there for security-definer hygiene) and instead generate the token from
-- gen_random_uuid(), which is a pg_catalog builtin in PG13+ and always
-- resolves regardless of extension schema placement.
--
-- Output format is unchanged: 6 uppercase hex characters. A uuid's hex body
-- (with hyphens stripped) is a random hex string, so taking its first 6
-- characters and upper-casing them is equivalent in shape/entropy to
-- upper(encode(gen_random_bytes(3), 'hex')).
create or replace function refresh_checkin_token(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_host  uuid;
  v_token text;
begin
  select host_id into v_host from events where id = p_event_id;
  if v_host is distinct from v_uid then raise exception 'not the host'; end if;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into event_checkin_tokens (event_id, token, expires_at)
  values (p_event_id, v_token, now() + interval '130 seconds')
  on conflict (event_id) do update
    set token = excluded.token, expires_at = excluded.expires_at;

  return v_token;
end; $$;
