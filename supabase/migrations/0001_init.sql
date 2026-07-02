-- ShowUp Phase 1 schema: profiles, events, participation, check-ins, and a
-- two-bucket Gold Flakes ledger (cash = withdrawable, promo = stake-only).
-- All balance changes are append-only ledger rows written by SECURITY DEFINER
-- functions so clients can never mint or move flakes directly.

create extension if not exists "pgcrypto";

-- Profiles ------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  handle      text not null unique check (handle ~ '^[a-z0-9_]{2,20}$'),
  avatar      text not null default 'ME',
  created_at  timestamptz not null default now()
);

-- Events --------------------------------------------------------------------
create table events (
  id                   uuid primary key default gen_random_uuid(),
  host_id              uuid not null references profiles (id) on delete cascade,
  name                 text not null,
  location             text,
  starts_at            timestamptz,
  stake                integer not null check (stake > 0),
  status               text not null default 'upcoming'
                         check (status in ('upcoming','checkin','past')),
  confirmation_methods text[] not null default '{qr}',
  created_at           timestamptz not null default now()
);

-- One row per person per event. `status` tracks the escrow lifecycle.
create table participants (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events (id) on delete cascade,
  user_id       uuid not null references profiles (id) on delete cascade,
  status        text not null default 'invited'
                  check (status in ('invited','staked','showed','flaked')),
  staked_at     timestamptz,
  checked_in_at timestamptz,
  unique (event_id, user_id)
);

create table checkins (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  method      text not null,
  token       text,
  verified_at timestamptz not null default now()
);

-- Payments (money-in). Rows are written by the Stripe webhook (service role).
create table payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  provider     text not null,
  provider_ref text not null unique,
  usd_amount   integer not null,
  flakes       integer not null,
  status       text not null default 'pending'
                 check (status in ('pending','succeeded','failed')),
  created_at   timestamptz not null default now()
);

-- Ledger --------------------------------------------------------------------
-- Signed amounts: credits positive, debits negative. bucket separates
-- withdrawable cash from non-withdrawable promo (the free welcome flakes).
create table ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  event_id        uuid references events (id) on delete set null,
  kind            text not null check (kind in (
                    'welcome_bonus','purchase','stake_hold','stake_return',
                    'payout','fee','withdrawal')),
  bucket          text not null check (bucket in ('cash','promo')),
  amount          integer not null,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);

create index ledger_entries_user_idx on ledger_entries (user_id);

create view wallet_balances as
  select
    p.id as user_id,
    coalesce(sum(l.amount) filter (where l.bucket = 'cash'), 0)  as cash,
    coalesce(sum(l.amount) filter (where l.bucket = 'promo'), 0) as promo,
    coalesce(sum(l.amount), 0)                                   as total
  from profiles p
  left join ledger_entries l on l.user_id = p.id
  group by p.id;

-- Functions -----------------------------------------------------------------
-- Idempotent: each user can only ever receive the welcome bonus once.
create or replace function grant_welcome_bonus()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into ledger_entries (user_id, kind, bucket, amount, idempotency_key)
  values (auth.uid(), 'welcome_bonus', 'promo', 100, 'welcome:' || auth.uid())
  on conflict (idempotency_key) do nothing;
end; $$;

-- Escrow stake: debit the stake (promo first, then cash) and mark the
-- participant as staked, atomically. Raises if the caller can't cover it.
create or replace function stake_in_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_stake  integer;
  v_promo  integer;
  v_cash   integer;
  v_key    text := 'stake:' || p_event_id || ':' || v_uid;
begin
  select stake into v_stake from events where id = p_event_id;
  if v_stake is null then raise exception 'event not found'; end if;

  select promo, cash into v_promo, v_cash from wallet_balances where user_id = v_uid;
  if coalesce(v_promo,0) + coalesce(v_cash,0) < v_stake then
    raise exception 'insufficient flakes';
  end if;

  -- Spend promo first to cap withdrawable liability, then top up from cash.
  if v_promo >= v_stake then
    insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
    values (v_uid, p_event_id, 'stake_hold', 'promo', -v_stake, v_key || ':promo');
  else
    if v_promo > 0 then
      insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
      values (v_uid, p_event_id, 'stake_hold', 'promo', -v_promo, v_key || ':promo');
    end if;
    insert into ledger_entries (user_id, event_id, kind, bucket, amount, idempotency_key)
    values (v_uid, p_event_id, 'stake_hold', 'cash', -(v_stake - greatest(v_promo,0)), v_key || ':cash');
  end if;

  insert into participants (event_id, user_id, status, staked_at)
  values (p_event_id, v_uid, 'staked', now())
  on conflict (event_id, user_id)
  do update set status = 'staked', staked_at = now();
end; $$;

-- Row level security --------------------------------------------------------
alter table profiles       enable row level security;
alter table events         enable row level security;
alter table participants   enable row level security;
alter table checkins       enable row level security;
alter table payments       enable row level security;
alter table ledger_entries enable row level security;

-- Profiles are visible to any signed-in user (handles, rep, avatars); you can
-- only edit your own.
create policy profiles_read   on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid());

-- You can see events you host or are a participant in.
create policy events_read on events for select to authenticated using (
  host_id = auth.uid()
  or exists (select 1 from participants pa where pa.event_id = id and pa.user_id = auth.uid())
);
create policy events_insert on events for insert to authenticated with check (host_id = auth.uid());
create policy events_update on events for update to authenticated using (host_id = auth.uid());

create policy participants_read on participants for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid())
);

create policy checkins_read on checkins for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid())
);

-- Wallet rows are private. Inserts happen only through the functions above and
-- the Stripe webhook (service role), never direct client writes.
create policy ledger_read   on ledger_entries for select to authenticated using (user_id = auth.uid());
create policy payments_read on payments       for select to authenticated using (user_id = auth.uid());
