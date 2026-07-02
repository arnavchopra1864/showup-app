-- Token table for rotating check-in codes -----------------------------------
create table if not exists event_checkin_tokens (
  event_id   uuid primary key references events(id) on delete cascade,
  token      text not null,
  expires_at timestamptz not null
);
alter table event_checkin_tokens enable row level security;
-- All access via SECURITY DEFINER RPCs; no direct client reads
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'event_checkin_tokens' and policyname = 'checkin_tokens_deny'
  ) then
    execute 'create policy checkin_tokens_deny on event_checkin_tokens using (false)';
  end if;
end $$;

-- Host generates / rotates a 6-char code ------------------------------------
create or replace function refresh_checkin_token(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_host  uuid;
  v_token text;
begin
  select host_id into v_host from events where id = p_event_id;
  if v_host is distinct from v_uid then raise exception 'not the host'; end if;

  v_token := upper(encode(gen_random_bytes(3), 'hex'));

  insert into event_checkin_tokens (event_id, token, expires_at)
  values (p_event_id, v_token, now() + interval '130 seconds')
  on conflict (event_id) do update
    set token = excluded.token, expires_at = excluded.expires_at;

  return v_token;
end; $$;

-- Guest checks in with the host's code --------------------------------------
create or replace function checkin_with_token(p_event_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_token   text;
  v_expires timestamptz;
  v_status  text;
begin
  select token, expires_at into v_token, v_expires
  from event_checkin_tokens where event_id = p_event_id;
  if not found             then raise exception 'no active check-in session'; end if;
  if now() > v_expires     then raise exception 'code expired — ask the host to refresh'; end if;
  if upper(p_token) <> v_token then raise exception 'wrong code'; end if;

  if (select status from events where id = p_event_id) in ('past','cancelled') then
    raise exception 'check-in is closed';
  end if;

  select status into v_status from participants
  where event_id = p_event_id and user_id = v_uid;
  if v_status is null     then raise exception 'you''re not in this event'; end if;
  if v_status = 'showed'  then return jsonb_build_object('already', true);  end if;
  if v_status <> 'staked' then raise exception 'cannot check in — status: %', v_status; end if;

  update participants set status = 'showed', checked_in_at = now()
  where event_id = p_event_id and user_id = v_uid;

  return jsonb_build_object('already', false);
end; $$;

-- Host closes check-in and distributes the pot ------------------------------
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

  -- Total currently held = all stake_holds minus any early-withdrawal returns
  select coalesce(-sum(amount), 0)::integer into v_total_held
  from ledger_entries
  where event_id = p_event_id and kind in ('stake_hold','stake_return');

  -- Forfeited = held minus what showed participants will get back
  v_forfeited   := greatest(v_total_held - v_showed * v_stake, 0);
  v_net_pot     := (v_forfeited * 9) / 10;
  v_each_profit := case when v_showed > 0 then v_net_pot / v_showed else 0 end;

  for rec in
    select user_id from participants where event_id = p_event_id and status = 'showed'
  loop
    -- Return their stake (mirrors the stake_hold buckets exactly)
    insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
    select rec.user_id, p_event_id, 'stake_return', le.bucket, -le.amount,
           'payout_return:' || p_event_id || ':' || rec.user_id || ':' || le.id
    from ledger_entries le
    where le.event_id = p_event_id
      and le.user_id  = rec.user_id
      and le.kind     = 'stake_hold';

    -- Profit goes to cash
    if v_each_profit > 0 then
      insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
      values (rec.user_id, p_event_id, 'payout', 'cash', v_each_profit,
              'payout_profit:' || p_event_id || ':' || rec.user_id);
    end if;
  end loop;

  update events set status = 'past' where id = p_event_id;
  delete from event_checkin_tokens where event_id = p_event_id;

  return jsonb_build_object(
    'showed',       v_showed,
    'flaked',       v_flaked,
    'stake',        v_stake,
    'each_payout',  v_stake + v_each_profit,
    'net_pot',      v_net_pot
  );
end; $$;
