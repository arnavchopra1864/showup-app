-- Open event + participant reads to anonymous users (invite link support) ------
drop policy if exists events_read on events;
create policy events_read on events for select using (true);

drop policy if exists participants_read on participants;
create policy participants_read on participants for select using (true);

-- Add participant insert policy (direct inserts for host-as-participant) -------
drop policy if exists participants_insert on participants;
create policy participants_insert on participants for insert to authenticated
  with check (user_id = auth.uid());

-- Withdrawal support -----------------------------------------------------------
alter table events add column if not exists withdrawal_hours integer not null default 24;

alter table participants
  drop constraint if exists participants_status_check;
alter table participants
  add constraint participants_status_check
    check (status in ('invited','staked','showed','flaked','withdrawn'));

alter table participants add column if not exists withdrawn_at timestamptz;

-- withdraw_from_event ----------------------------------------------------------
create or replace function withdraw_from_event(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid    := auth.uid();
  v_stake   integer;
  v_starts  timestamptz;
  v_w_hours integer;
  v_is_late boolean;
  v_status  text;
begin
  select e.stake, e.starts_at, e.withdrawal_hours
    into v_stake, v_starts, v_w_hours
    from events e where e.id = p_event_id;
  if not found then raise exception 'event not found'; end if;

  select status into v_status
    from participants where event_id = p_event_id and user_id = v_uid;
  if v_status is distinct from 'staked' then
    raise exception 'not staked in this event';
  end if;

  v_is_late := v_starts is not null
    and now() > (v_starts - (v_w_hours || ' hours')::interval);

  update participants
    set status = 'withdrawn', withdrawn_at = now()
    where event_id = p_event_id and user_id = v_uid;

  if not v_is_late then
    insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
    select v_uid, p_event_id, 'stake_return', bucket, -amount,
           'withdraw:' || p_event_id || ':' || v_uid || ':' || le.id
    from ledger_entries le
    where le.event_id = p_event_id
      and le.user_id  = v_uid
      and le.kind     = 'stake_hold';
  end if;

  return jsonb_build_object('is_late', v_is_late);
end; $$;
