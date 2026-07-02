import { supabase, isSupabaseConfigured } from "./supabase";
import { calcPayout } from "./payoutMath";

// Shape Supabase event rows into the object HomeScreen/EventCard expects
function normalizeEvent(e, userId) {
  const active    = (e.participants ?? []).filter(p => p.status === "staked");
  const mine      = (e.participants ?? []).find(p => p.user_id === userId);
  const hoursAway = e.starts_at
    ? Math.floor((new Date(e.starts_at) - Date.now()) / 3600000)
    : 48;
  const derivedStatus = e.status === "past" || e.status === "cancelled"
    ? e.status
    : hoursAway <= 4 ? "checkin" : "upcoming";

  return {
    id:       e.id,
    name:     e.name,
    location: e.location ?? "",
    date:     e.starts_at
      ? new Date(e.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "",
    stake:      e.stake,
    potTotal:   active.length * e.stake,
    paidIn:     active.length,
    total:      (e.participants ?? []).filter(p => p.status !== "withdrawn").length,
    status:     derivedStatus,
    starts_at:  e.starts_at ?? null,
    hoursAway,
    myStatus:   mine?.status === "staked" ? "paid" : undefined,
    isHost:     e.host_id === userId,
    flakeRisks: 0,
    guests: (e.participants ?? [])
      .filter(p => p.status !== "withdrawn")
      .map(p => ({
        name:    p.profile?.name ?? "someone",
        avatar:  p.profile?.avatar ?? "?",
        isMe:    p.user_id === userId,
        checked: p.status === "staked",
      })),
  };
}

export async function fetchMyEvents(userId) {
  if (!isSupabaseConfigured) return { ok: true, events: [] };

  const SELECT = "*, participants(user_id, status, profile:profiles!user_id(name, avatar))";

  // Events where the user is the host (exclude cancelled)
  const { data: hosted, error } = await supabase
    .from("events")
    .select(SELECT)
    .eq("host_id", userId)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  // Event IDs where the user is an active participant (not host, not withdrawn)
  const { data: participations } = await supabase
    .from("participants")
    .select("event_id")
    .eq("user_id", userId)
    .in("status", ["staked", "showed"]);

  const hostedIds = new Set((hosted ?? []).map(e => e.id));
  const guestIds  = (participations ?? []).map(p => p.event_id).filter(id => !hostedIds.has(id));

  let guestEvents = [];
  if (guestIds.length > 0) {
    const { data } = await supabase.from("events").select(SELECT).in("id", guestIds).neq("status", "cancelled").order("starts_at", { ascending: true });
    guestEvents = data ?? [];
  }

  const all = [...(hosted ?? []), ...guestEvents];
  return { ok: true, events: all.map(e => normalizeEvent(e, userId)) };
}

function parseTimeChip(t) {
  if (!t) return "00:00";
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const pm = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (pm) {
    let h = parseInt(pm[1]);
    if (pm[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (pm[3].toUpperCase() === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${pm[2]}`;
  }
  return "00:00";
}

export async function createEvent(form) {
  if (!isSupabaseConfigured) return { ok: true, mock: true, id: `mock-${Date.now()}` };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  let starts_at = null;
  if (form.date) {
    starts_at = new Date(`${form.date}T${parseTimeChip(form.time)}`).toISOString();
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      host_id: user.id,
      name: form.name,
      location: form.location || null,
      starts_at,
      stake: form.stake,
      confirmation_methods: form.confirmation ?? ["qr"],
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  // Host auto-stakes on creation
  const { error: stakeErr } = await supabase.rpc("stake_in_event", { p_event_id: event.id });
  if (stakeErr) console.warn("Host auto-stake failed:", stakeErr.message);

  return { ok: true, event };
}

export async function fetchEvent(eventId) {
  if (!isSupabaseConfigured) return { ok: false, error: "supabase not configured" };
  try {
    const { data: event, error } = await supabase
      .from("events")
      .select("*, host:profiles!host_id(name, handle, avatar)")
      .eq("id", eventId)
      .single();

    if (error) return { ok: false, error: error.message };

    const { data: participants } = await supabase
      .from("participants")
      .select("*, profile:profiles!user_id(name, handle, avatar, showed_count, total_events)")
      .eq("event_id", eventId);

    return { ok: true, event, participants: participants ?? [] };
  } catch (e) {
    return { ok: false, error: e.message || "network error" };
  }
}

export async function rsvpEvent(eventId) {
  if (!isSupabaseConfigured) return { ok: true, mock: true };
  const { error } = await supabase.rpc("stake_in_event", { p_event_id: eventId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function cancelEvent(eventId) {
  if (!isSupabaseConfigured) return { ok: true, mock: true };
  const { error } = await supabase.rpc("cancel_event", { p_event_id: eventId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function withdrawEvent(eventId) {
  if (!isSupabaseConfigured) return { ok: true, mock: true, isLate: false };
  const { data, error } = await supabase.rpc("withdraw_from_event", { p_event_id: eventId });
  return error ? { ok: false, error: error.message } : { ok: true, isLate: data?.is_late ?? false };
}

export async function refreshCheckinToken(eventId) {
  if (!isSupabaseConfigured) return { ok: true, token: "DEMO01" };
  try {
    const { data, error } = await supabase.rpc("refresh_checkin_token", { p_event_id: eventId });
    return error ? { ok: false, error: error.message } : { ok: true, token: data };
  } catch (e) {
    return { ok: false, error: e.message || "network error" };
  }
}

export async function checkinWithToken(eventId, token) {
  if (!isSupabaseConfigured) return { ok: true, already: false };
  try {
    const { data, error } = await supabase.rpc("checkin_with_token", { p_event_id: eventId, p_token: token });
    return error ? { ok: false, error: error.message } : { ok: true, already: data?.already ?? false };
  } catch (e) {
    return { ok: false, error: e.message || "network error" };
  }
}

export async function closeAndPayout(eventId) {
  if (!isSupabaseConfigured) return { ok: true, showed: 3, flaked: 1, stake: 50, each_payout: 95, net_pot: 45 };
  try {
    const { data, error } = await supabase.rpc("close_and_payout", { p_event_id: eventId });
    return error ? { ok: false, error: error.message } : { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: e.message || "network error" };
  }
}

export async function fetchPayoutData(eventId, userId) {
  const { ok, event, participants } = await fetchEvent(eventId);
  if (!ok || !event) return { ok: false };

  const showed = participants.filter(p => p.status === "showed");
  const flaked = participants.filter(p => p.status === "flaked");
  const computed = calcPayout(event.stake, showed.length + flaked.length, showed.length);
  const mine = participants.find(p => p.user_id === userId);
  const iShowed = mine?.status === "showed";

  return {
    ok: true,
    event,
    showed: showed.map(p => ({ name: p.profile?.name ?? "someone", avatar: p.profile?.avatar ?? "?", isMe: p.user_id === userId })),
    flaked: flaked.map(p => ({ name: p.profile?.name ?? "someone", avatar: p.profile?.avatar ?? "?", isMe: p.user_id === userId })),
    myPayout: iShowed ? computed.payout : 0,
    myProfit: iShowed ? computed.profit : 0,
    myStatus: mine?.status ?? null,
    stake: event.stake,
    fee: computed.fee,
  };
}

export async function fetchWalletBalance() {
  if (!isSupabaseConfigured) return { ok: true, total: 0 };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true, total: 0 };
  const { data } = await supabase
    .from("wallet_balances")
    .select("total")
    .eq("user_id", user.id)
    .single();
  return { ok: true, total: data?.total ?? 0 };
}
