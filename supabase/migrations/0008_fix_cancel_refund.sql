-- Fix cancel_event double refunds ---------------------------------------------
-- The 0003 version refunded every stake_hold row on the event, including
-- participants who had already withdrawn early and been refunded via
-- stake_return — cancelling would credit them a second time. It also had no
-- status guard, so cancelling an already-closed event would re-return stakes
-- that close_and_payout had already paid back (different idempotency prefix,
-- so the keys wouldn't catch it).
create or replace function cancel_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_host_id uuid;
  v_status  text;
begin
  select host_id, status into v_host_id, v_status from events where id = p_event_id;
  if v_host_id is distinct from v_uid then
    raise exception 'only the host can cancel this event';
  end if;
  if v_status <> 'upcoming' then
    raise exception 'event already closed';
  end if;

  -- refund stake_hold entries only for participants still staked
  insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
  select le.user_id, p_event_id, 'stake_return', le.bucket, -le.amount,
         'cancel:' || p_event_id || ':' || le.user_id || ':' || le.id
  from ledger_entries le
  where le.event_id = p_event_id
    and le.kind     = 'stake_hold'
    and le.user_id in (
      select user_id from participants
      where event_id = p_event_id and status = 'staked'
    );

  -- mark all staked participants withdrawn
  update participants
     set status = 'withdrawn', withdrawn_at = now()
   where event_id = p_event_id and status = 'staked';

  -- mark event cancelled
  update events set status = 'cancelled' where id = p_event_id;

  delete from event_checkin_tokens where event_id = p_event_id;
end; $$;
