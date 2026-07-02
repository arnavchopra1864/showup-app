-- Add 'cancelled' to events status ------------------------------------------
alter table events drop constraint if exists events_status_check;
alter table events add constraint events_status_check
  check (status in ('upcoming', 'checkin', 'past', 'cancelled'));

-- cancel_event: host-only, refunds all staked participants -------------------
create or replace function cancel_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_host_id uuid;
begin
  select host_id into v_host_id from events where id = p_event_id;
  if v_host_id is distinct from v_uid then
    raise exception 'only the host can cancel this event';
  end if;

  -- refund every staked participant's stake_hold entries
  insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
  select le.user_id, p_event_id, 'stake_return', le.bucket, -le.amount,
         'cancel:' || p_event_id || ':' || le.user_id || ':' || le.id
  from ledger_entries le
  where le.event_id = p_event_id
    and le.kind     = 'stake_hold';

  -- mark all staked participants withdrawn
  update participants
     set status = 'withdrawn', withdrawn_at = now()
   where event_id = p_event_id and status = 'staked';

  -- mark event cancelled
  update events set status = 'cancelled' where id = p_event_id;
end; $$;
