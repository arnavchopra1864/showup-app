-- Auto-close stale events ----------------------------------------------------
-- Until now close_and_payout could only be called by the host from
-- CheckinScreen. If the host forgot, everyone's staked flakes were held
-- forever and nobody was ever marked flaked. A pg_cron job now sweeps events
-- still 'upcoming' 12 hours after starts_at:
--   * check-in ran (someone showed, or a check-in token was ever issued)
--     -> run the normal payout; anyone still staked flaked
--   * check-in never ran -> guests had no way to check in, so blaming them
--     is wrong; void the event and refund every stake (like cancel_event)

-- 1. Core payout logic, shared by the host RPC and the sweeper ----------------
--    Same body as 0005's close_and_payout, minus the auth.uid() checks:
--    the caller supplies the host id (used to auto-mark the host as showed).
create or replace function close_event_payout(p_event_id uuid, p_host_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stake       integer;
  v_showed      integer;
  v_flaked      integer;
  v_total_held  integer;
  v_forfeited   integer;
  v_net_pot     integer;
  v_each_profit integer;
  rec           record;
begin
  select stake into v_stake from events where id = p_event_id;
  if (select status from events where id = p_event_id) <> 'upcoming' then
    raise exception 'event already closed';
  end if;

  -- Host is auto-marked as showed (they were obviously there)
  update participants set status = 'showed', checked_in_at = now()
  where event_id = p_event_id and user_id = p_host_id and status = 'staked';

  -- Everyone still staked at close time = flaked
  update participants set status = 'flaked'
  where event_id = p_event_id and status = 'staked';

  select
    count(*) filter (where status = 'showed'),
    count(*) filter (where status = 'flaked')
  into v_showed, v_flaked
  from participants where event_id = p_event_id;

  select coalesce(-sum(amount), 0)::integer into v_total_held
  from ledger_entries
  where event_id = p_event_id and kind in ('stake_hold','stake_return');

  v_forfeited   := greatest(v_total_held - v_showed * v_stake, 0);
  v_net_pot     := (v_forfeited * 9) / 10;
  v_each_profit := case when v_showed > 0 then v_net_pot / v_showed else 0 end;

  for rec in
    select user_id from participants where event_id = p_event_id and status = 'showed'
  loop
    insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
    select rec.user_id, p_event_id, 'stake_return', le.bucket, -le.amount,
           'payout_return:' || p_event_id || ':' || rec.user_id || ':' || le.id
    from ledger_entries le
    where le.event_id = p_event_id
      and le.user_id  = rec.user_id
      and le.kind     = 'stake_hold';

    if v_each_profit > 0 then
      insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
      values (rec.user_id, p_event_id, 'payout', 'cash', v_each_profit,
              'payout_profit:' || p_event_id || ':' || rec.user_id);
    end if;
  end loop;

  update events set status = 'past' where id = p_event_id;
  delete from event_checkin_tokens where event_id = p_event_id;

  -- Bump reliability counters on profiles
  update profiles set
    showed_count = showed_count + 1,
    total_events  = total_events  + 1
  where id in (
    select user_id from participants where event_id = p_event_id and status = 'showed'
  );
  update profiles set
    total_events = total_events + 1
  where id in (
    select user_id from participants where event_id = p_event_id and status = 'flaked'
  );

  return jsonb_build_object(
    'showed',       v_showed,
    'flaked',       v_flaked,
    'stake',        v_stake,
    'each_payout',  v_stake + v_each_profit,
    'net_pot',      v_net_pot
  );
end; $$;

-- Internal only: never callable from the client
revoke execute on function close_event_payout(uuid, uuid) from public, anon, authenticated;

-- 2. Host RPC becomes a thin auth wrapper -------------------------------------
create or replace function close_and_payout(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_host_id uuid;
begin
  select host_id into v_host_id from events where id = p_event_id;
  if v_host_id is distinct from v_uid then raise exception 'not the host'; end if;
  return close_event_payout(p_event_id, v_host_id);
end; $$;

-- 3. The sweeper ---------------------------------------------------------------
create or replace function auto_close_stale_events(p_grace interval default interval '12 hours')
returns integer language plpgsql security definer set search_path = public as $$
declare
  rec     record;
  v_count integer := 0;
begin
  for rec in
    select id, host_id from events
    where status = 'upcoming'
      and starts_at is not null
      and starts_at < now() - p_grace
    for update skip locked
  loop
    if exists (select 1 from participants where event_id = rec.id and status = 'showed')
       or exists (select 1 from event_checkin_tokens where event_id = rec.id)
    then
      -- Check-in ran: normal payout, stragglers flaked
      perform close_event_payout(rec.id, rec.host_id);
    else
      -- Check-in never ran: nobody could have checked in — void & refund
      -- (only holds of still-staked participants, so early withdrawers who
      -- already got a stake_return aren't refunded twice)
      insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
      select le.user_id, rec.id, 'stake_return', le.bucket, -le.amount,
             'autoclose_void:' || rec.id || ':' || le.user_id || ':' || le.id
      from ledger_entries le
      where le.event_id = rec.id
        and le.kind     = 'stake_hold'
        and le.user_id in (
          select user_id from participants
          where event_id = rec.id and status = 'staked'
        );

      update participants
         set status = 'withdrawn', withdrawn_at = now()
       where event_id = rec.id and status = 'staked';

      update events set status = 'cancelled' where id = rec.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

revoke execute on function auto_close_stale_events(interval) from public, anon, authenticated;

-- 4. Schedule: every 15 minutes -------------------------------------------------
-- pg_cron ships with Supabase (hosted and local CLI). If the extension is
-- unavailable in some environment, warn instead of failing the migration.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'auto-close-stale-events',
    '*/15 * * * *',
    'select auto_close_stale_events()'
  );
exception when others then
  raise warning 'pg_cron unavailable (%): run auto_close_stale_events() on a schedule some other way', sqlerrm;
end $$;
