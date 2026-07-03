-- Account deletion ------------------------------------------------------------
-- delete_account(): the caller deletes their own account. Their wallet balance
-- is forfeited: ledger rows cascade away with the profile, and there is no
-- refund or cash-out on the way out. Upcoming events they host are cancelled
-- first (reusing cancel_event) so other participants get their stakes back.
-- Stakes the caller has escrowed in other people's events simply vanish with
-- their ledger rows — close_and_payout recomputes the held total from the
-- surviving rows, so pot math stays consistent and nobody inherits the
-- forfeited flakes.
--
-- Deleting from auth.users cascades to profiles (fk) and from there to
-- events, participants, checkins, payments and ledger_entries.
create or replace function delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  rec   record;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  for rec in
    select id from events where host_id = v_uid and status = 'upcoming'
  loop
    perform cancel_event(rec.id);
  end loop;

  delete from auth.users where id = v_uid;
end; $$;

revoke execute on function delete_account() from public, anon;
