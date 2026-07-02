-- Denormalized reliability counters on profiles so any screen can display
-- someone's show-up rate without querying their participant history.
alter table profiles
  add column if not exists showed_count integer not null default 0;
alter table profiles
  add column if not exists total_events  integer not null default 0;

-- Backfill from existing participants (only terminal statuses count)
update profiles p set
  showed_count = (
    select count(*) from participants
    where user_id = p.id and status = 'showed'
  ),
  total_events = (
    select count(*) from participants
    where user_id = p.id and status in ('showed', 'flaked')
  );

-- Re-create close_and_payout to also bump reliability counters at close time.
create or replace function close_and_payout(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid         uuid    := auth.uid();
  v_host_id     uuid;
  v_stake       integer;
  v_showed      integer;
  v_flaked      integer;
  v_total_held  integer;
  v_forfeited   integer;
  v_net_pot     integer;
  v_each_profit integer;
  rec           record;
begin
  select host_id, stake into v_host_id, v_stake from events where id = p_event_id;
  if v_host_id is distinct from v_uid then raise exception 'not the host'; end if;
  if (select status from events where id = p_event_id) <> 'upcoming' then
    raise exception 'event already closed';
  end if;

  -- Host is auto-marked as showed (they were obviously there)
  update participants set status = 'showed', checked_in_at = now()
  where event_id = p_event_id and user_id = v_uid and status = 'staked';

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
