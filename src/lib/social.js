import { supabase, isSupabaseConfigured } from "./supabase";

export async function fetchMyHistory(userId) {
  if (!isSupabaseConfigured || !userId) {
    return { ok: true, history: [], stats: { showed: 0, totalEvents: 0, streak: 0, totalEarned: 0 } };
  }

  const { data: parts, error } = await supabase
    .from("participants")
    .select("status, event:events!event_id(id, name, starts_at, stake)")
    .eq("user_id", userId)
    .in("status", ["showed", "flaked"]);

  if (error) return { ok: false, error: error.message };

  const completed = (parts ?? []).filter(p => p.event);
  if (completed.length === 0) {
    return { ok: true, history: [], stats: { showed: 0, totalEvents: 0, streak: 0, totalEarned: 0 } };
  }

  const eventIds = completed.map(p => p.event.id);

  const { data: ledger } = await supabase
    .from("ledger_entries")
    .select("event_id, kind, amount")
    .eq("user_id", userId)
    .in("kind", ["payout", "stake_return"])
    .in("event_id", eventIds);

  const payoutMap = {};
  for (const l of ledger ?? []) {
    if (!payoutMap[l.event_id]) payoutMap[l.event_id] = { profit: 0, stakeBack: 0 };
    if (l.kind === "payout")       payoutMap[l.event_id].profit    += l.amount;
    if (l.kind === "stake_return") payoutMap[l.event_id].stakeBack += l.amount;
  }

  const history = completed
    .map(p => {
      const ev  = p.event;
      const pay = payoutMap[ev.id] ?? {};
      return {
        name:      ev.name,
        date:      ev.starts_at
          ? new Date(ev.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          : "",
        starts_at: ev.starts_at,
        showed:    p.status === "showed",
        profit:    pay.profit    ?? 0,
        payout:    (pay.stakeBack ?? 0) + (pay.profit ?? 0),
        loss:      p.status === "flaked" ? ev.stake : 0,
      };
    })
    .sort((a, b) => {
      if (!a.starts_at) return 1;
      if (!b.starts_at) return -1;
      return new Date(b.starts_at) - new Date(a.starts_at);
    });

  const showed      = history.filter(h => h.showed).length;
  const totalEvents = history.length;
  const totalEarned = history.reduce((sum, h) => sum + h.profit, 0);

  let streak = 0;
  for (const h of history) {
    if (h.showed) streak++;
    else break;
  }

  return { ok: true, history, stats: { showed, totalEvents, streak, totalEarned } };
}

export async function fetchCrossedPaths(userId) {
  if (!isSupabaseConfigured || !userId) return { ok: true, people: [] };

  const { data: myParts } = await supabase
    .from("participants")
    .select("event_id")
    .eq("user_id", userId)
    .in("status", ["staked", "showed", "flaked"]);

  const eventIds = (myParts ?? []).map(p => p.event_id);
  if (eventIds.length === 0) return { ok: true, people: [] };

  const { data: coParts } = await supabase
    .from("participants")
    .select("user_id, event_id, profile:profiles!user_id(name, handle, avatar, showed_count, total_events)")
    .in("event_id", eventIds)
    .in("status", ["staked", "showed", "flaked"])
    .neq("user_id", userId);

  const map = {};
  for (const p of coParts ?? []) {
    if (!map[p.user_id]) {
      map[p.user_id] = {
        userId:       p.user_id,
        name:         p.profile?.name          ?? "someone",
        handle:       p.profile?.handle        ?? "",
        avatar:       p.profile?.avatar        ?? "?",
        showedCount:  p.profile?.showed_count  ?? 0,
        totalEvents:  p.profile?.total_events  ?? 0,
        sharedEvents: 0,
      };
    }
    map[p.user_id].sharedEvents++;
  }

  const people = Object.values(map).sort((a, b) => b.sharedEvents - a.sharedEvents);
  return { ok: true, people };
}
