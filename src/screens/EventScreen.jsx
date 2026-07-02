import { useState, useEffect, useMemo } from "react";
import { Shell } from "../components/Shell";
import { EmptyCard } from "../components/EmptyCard";
import { gf } from "../lib/currency";
import { safeRate, rateProps } from "../lib/reliabilityUtils";
import { fetchEvent, rsvpEvent, withdrawEvent, cancelEvent } from "../lib/events";
import { signInWithGoogle } from "../lib/auth";

export function EventScreen({ event: initialEvent, eventId, nav, userId, balance = Infinity, spendFlakes, refreshBalance, refreshEvents }) {
  const isReal = !!eventId;

  const [event, setEvent]               = useState(initialEvent ?? null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading]           = useState(isReal && !initialEvent);
  const [rsvpState, setRsvpState]       = useState("idle"); // idle | confirming | paid | withdrawConfirm | withdrawn
  const [busy, setBusy]                 = useState(false);
  const [error, setError]               = useState("");
  const [copied, setCopied]             = useState(false);

  // Fetch real event + participants from Supabase
  useEffect(() => {
    if (!isReal) return;
    fetchEvent(eventId).then(({ ok, event: e, participants: ps, error: err }) => {
      if (!ok) { setLoading(false); return; }
      setEvent(e);
      setParticipants(ps ?? []);
      // Seed UI state from current user's participant row
      const mine = ps?.find(p => p.user_id === userId);
      if (mine?.status === "staked")    setRsvpState("paid");
      if (mine?.status === "withdrawn") setRsvpState("withdrawn");
      setLoading(false);
    });
  }, [eventId, userId]);

  const stake   = event?.stake ?? 50;
  const isHost  = !!userId && event?.host_id === userId;
  const isAuthed = !!userId;

  // Derive pot + count from Supabase participants (real path) or mock event (mock path)
  const { paidCount, potAmount } = useMemo(() => {
    if (isReal) {
      const active = participants.filter(p => p.status === "staked");
      return { paidCount: active.length, potAmount: active.length * stake };
    }
    return { paidCount: event?.paidIn ?? 0, potAmount: event?.potTotal ?? 0 };
  }, [isReal, participants, event, stake]);

  // Is the withdrawal deadline past?
  const isLatePeriod = useMemo(() => {
    if (!event?.starts_at) return false;
    const deadline = new Date(event.starts_at).getTime() - (event.withdrawal_hours ?? 24) * 3600 * 1000;
    return Date.now() > deadline;
  }, [event]);


  // Guest list for rendering
  const visibleGuests = useMemo(() => {
    if (!isReal) return event?.guests ?? [];
    return participants.filter(p => p.status !== "withdrawn" || isHost).map(p => ({
      name: p.profile?.name ?? "someone",
      avatar: p.profile?.avatar ?? "?",
      handle: p.profile?.handle,
      status: p.status,
      withdrawnAt: p.withdrawn_at,
      isLateWithdrawal: p.status === "withdrawn" && p.withdrawn_at && isLatePeriod,
      isMe: p.user_id === userId,
      showedCount: p.profile?.showed_count ?? 0,
      totalEvents: p.profile?.total_events ?? 0,
    }));
  }, [isReal, participants, event, isHost, userId, isLatePeriod]);

  const handleRSVP = async () => {
    if (rsvpState === "idle") {
      if (balance < stake) { nav.push("buy"); return; }
      setRsvpState("confirming");
    } else if (rsvpState === "confirming") {
      if (isReal) {
        setBusy(true); setError("");
        const res = await rsvpEvent(eventId);
        setBusy(false);
        if (!res.ok) { setError(res.error || "couldn't lock you in"); setRsvpState("idle"); return; }
        await refreshBalance?.();
        // Refresh participant list
        fetchEvent(eventId).then(({ participants: ps }) => setParticipants(ps ?? []));
      } else {
        spendFlakes?.(stake);
      }
      setRsvpState("paid");
    }
  };

  const handleInvite = async () => {
    const url = isReal
      ? `${window.location.origin}?event=${eventId}`
      : `${window.location.origin}?event=demo`;
    if (navigator.share) {
      try { await navigator.share({ title: event.name, text: `join me at ${event.name}`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignInToRsvp = () => {
    localStorage.setItem("pendingEventId", eventId);
    signInWithGoogle();
  };

  const handleWithdraw = async () => {
    if (rsvpState === "paid") {
      setRsvpState("withdrawConfirm");
    } else if (rsvpState === "withdrawConfirm") {
      if (!isReal) { setRsvpState("withdrawn"); return; }
      setBusy(true); setError("");
      if (isHost) {
        const res = await cancelEvent(eventId);
        setBusy(false);
        if (!res.ok) { setError(res.error || "couldn't cancel event"); setRsvpState("paid"); return; }
        await refreshBalance?.();
        await refreshEvents?.();
        nav.pop();
      } else {
        const res = await withdrawEvent(eventId);
        setBusy(false);
        if (!res.ok) { setError(res.error || "couldn't withdraw"); setRsvpState("paid"); return; }
        await refreshBalance?.();
        await refreshEvents?.();
        fetchEvent(eventId).then(({ participants: ps }) => setParticipants(ps ?? []));
        setRsvpState("withdrawn");
      }
    }
  };

  if (loading) return (
    <Shell>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#333" }}>loading event…</div>
      </div>
    </Shell>
  );

  if (!event) return (
    <Shell>
      <div style={{ background: "linear-gradient(160deg,#1a0a2e 0%,#0d0d1a 60%,#0D0D0D 100%)", padding: "44px 24px 32px" }}>
        <button onClick={nav.pop} style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>← back</button>
      </div>
      <div style={{ padding: 24 }}>
        <EmptyCard emoji="💀" headline="event not found" sub="this link might be expired or invalid" />
      </div>
    </Shell>
  );

  const insufficient = balance < stake;

  // Format starts_at for display if no mock date string
  const displayDate = event.date ?? (event.starts_at ? new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);

  return (
    <Shell>
      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg,#1a0a2e 0%,#0d0d1a 60%,#0D0D0D 100%)", padding: "44px 24px 32px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 20%,rgba(123,47,255,.18) 0%,transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <button onClick={nav.pop} style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12, padding: 0 }}>← back</button>
          {displayDate && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(123,47,255,.18)", border: "1px solid rgba(123,47,255,.4)", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#b388ff", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7B2FFF", display: "inline-block" }} />
              {displayDate}
            </div>
          )}
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(48px,13vw,68px)", lineHeight: .9, color: "#F2F0FF", margin: "0 0 6px", letterSpacing: 1 }}>
            {event.name || "Untitled"}
          </h1>
          {event.location && <p style={{ color: "#666", fontSize: 14, margin: "12px 0 0", fontWeight: 500 }}>📍 {event.location}</p>}
        </div>
      </div>

      <div style={{ padding: "0 20px 80px" }}>
        {/* Pot */}
        <div className="pot-pulse" style={{ marginTop: -1, background: "linear-gradient(135deg,#12082a,#1a0a1e)", border: "1.5px solid rgba(123,47,255,.5)", borderRadius: 20, padding: "26px 24px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>winner's pot</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 80, lineHeight: 1, background: "linear-gradient(135deg,#a855f7,#FF2D78)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2 }}>{gf(potAmount)}</div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{paidCount} {paidCount === 1 ? "person" : "people"} in</div>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,.04)", borderRadius: 12, fontSize: 13 }}>
            <div style={{ color: "#F2F0FF", fontWeight: 700, marginBottom: 4 }}>🏆 show up = get {gf(stake, { long: true })} back</div>
          </div>
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#2a2a3a,transparent)", margin: "20px 0" }} />

        {/* Guest list */}
        {visibleGuests.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#F2F0FF", marginBottom: 4 }}>
              {isHost ? "your crew" : "who's in"}
            </div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 14 }}>{paidCount} locked</div>
            {visibleGuests.map((g, i) => {
              const isWithdrawn = g.status === "withdrawn";
              const isPaid = !isWithdrawn && (g.status === "staked" || g.checked);
              const rate = isReal ? safeRate(g.showedCount, g.totalEvents) : null;
              const { color: rateColor } = rateProps(rate);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: `1px solid ${isPaid ? "#7B2FFF" : isWithdrawn ? "#2a1a1a" : "#1e1e1e"}`, background: isPaid ? "#1a1a2e" : isWithdrawn ? "#1a0d0d" : "#141414", marginBottom: 8, opacity: isWithdrawn ? .6 : 1 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: isPaid ? "rgba(123,47,255,.2)" : "#1c1c1c", border: `1.5px solid ${isPaid ? "#7B2FFF" : "#222"}`, color: isPaid ? "#d4b4fe" : "#444" }}>{g.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isPaid ? "#F2F0FF" : "#555" }}>
                      {g.name}{g.isMe && <span style={{ fontSize: 10, color: "#7B2FFF", marginLeft: 6 }}>you</span>}
                    </div>
                    {rate !== null && (
                      <div style={{ fontSize: 11, color: rateColor, marginTop: 2, opacity: .8 }}>{rate}% show rate</div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: isPaid ? "rgba(123,47,255,.15)" : isWithdrawn ? "rgba(255,45,120,.1)" : "#1a1a1a", color: isPaid ? "#b388ff" : isWithdrawn ? "#FF2D78" : "#3a3a3a", border: `1px solid ${isPaid ? "#7B2FFF" : isWithdrawn ? "rgba(255,45,120,.3)" : "#222"}` }}>
                    {isPaid ? "In 🔥" : isWithdrawn ? (g.isLateWithdrawal && isHost ? "bailed 💸" : "out") : "MIA 👻"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Invite — always visible */}
        <button
          onClick={handleInvite}
          style={{ width: "100%", marginBottom: 20, padding: "13px 0", borderRadius: 14, background: "rgba(123,47,255,.08)", border: "1.5px solid rgba(123,47,255,.25)", color: copied ? "#4ade80" : "#b388ff", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "color .2s" }}
        >
          {copied ? "link copied ✓" : "invite friends 🔗"}
        </button>

        {error && <div style={{ fontSize: 13, color: "#FF2D78", marginBottom: 12, fontWeight: 600 }}>{error}</div>}

        {/* CTAs */}
        {rsvpState === "idle" && (
          !isAuthed ? (
            // Public / unauthenticated view
            <div className="fade-up">
              <div style={{ textAlign: "center", fontSize: 13, color: "#555", marginBottom: 12 }}>stake {gf(stake)} to lock in. show up and get it back — plus a cut of anyone who bails.</div>
              <button className="cta-btn" onClick={handleSignInToRsvp}>sign in to RSVP</button>
            </div>
          ) : insufficient ? (
            <div className="fade-up">
              <div style={{ textAlign: "center", fontSize: 13, color: "#FF2D78", marginBottom: 12 }}>you've got {gf(balance)}, need {gf(stake)} to lock in</div>
              <button className="cta-btn" style={{ background: "linear-gradient(135deg,#F5C451,#ff9f43)", color: "#1a1200" }} onClick={() => nav.push("buy")}>add gold flakes ✨</button>
            </div>
          ) : (
            <div className="fade-up">
              <div style={{ textAlign: "center", fontSize: 13, color: "#555", marginBottom: 12 }}>toss {gf(stake)} in the pot. show up, get it back.</div>
              <button className="cta-btn" onClick={handleRSVP}>I'm in for {gf(stake)}</button>
            </div>
          )
        )}

        {rsvpState === "confirming" && (
          <div className="fade-up">
            <div style={{ background: "#12082a", border: "1.5px solid #7B2FFF", borderRadius: 16, padding: "22px 20px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>your entry</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 56, color: "#F2F0FF", lineHeight: 1 }}>{gf(stake)}</div>
              <div style={{ fontSize: 13, marginTop: 10 }}>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>show up</span><span style={{ color: "#888" }}> → you get it all back</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                <span style={{ color: "#FF2D78", fontWeight: 700 }}>ghost</span><span style={{ color: "#888" }}> → your friends profit off you 💀</span>
              </div>
            </div>
            <button className={`cta-btn${busy ? " disabled" : ""}`} style={{ background: "linear-gradient(135deg,#FF2D78,#ff8c2f)" }} onClick={!busy ? handleRSVP : undefined}>{busy ? "locking in…" : `bet, pay ${gf(stake)}`}</button>
            <div style={{ textAlign: "center", fontSize: 11, color: "#333", marginTop: 10 }}>worst case you lose a few flakes and have to hear about it forever</div>
          </div>
        )}

        {rsvpState === "paid" && (
          <div className="fade-up">
            <div style={{ background: "#0a1a0a", border: "1.5px solid #4ade80", borderRadius: 16, padding: "22px 20px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🔒</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: "#4ade80", letterSpacing: 1 }}>you're locked in</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>now sit back and pray someone bails so you profit 😈</div>
            </div>
            {isHost && (
              <button className="cta-btn" style={{ background: "linear-gradient(135deg,#7B2FFF,#FF2D78)" }} onClick={() => nav.replace("checkin", { event: { name: event.name, location: event.location, starts_at: event.starts_at, isHost: true, potTotal: potAmount }, eventId })}>start check-in 🔲</button>
            )}
            <button onClick={() => setRsvpState("withdrawConfirm")} style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: "#3a3a3a", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 0" }}>
              {isHost ? "cancel this event" : "can't make it? withdraw"}
            </button>
          </div>
        )}

        {rsvpState === "withdrawConfirm" && isHost && (
          <div className="fade-up">
            <div style={{ background: "#1a0808", border: "1.5px solid #FF2D78", borderRadius: 16, padding: "22px 20px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: "#FF2D78", letterSpacing: .5, marginBottom: 10 }}>cancel for everyone?</div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>this will remove the event from everyone's dashboard and refund all stakes in full. this can't be undone.</div>
            </div>
            <button className={`cta-btn${busy ? " disabled" : ""}`} style={{ background: "linear-gradient(135deg,#FF2D78,#c0392b)" }} onClick={!busy ? handleWithdraw : undefined}>
              {busy ? "cancelling…" : "yes, cancel for everyone"}
            </button>
            <button onClick={() => setRsvpState("paid")} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#555", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 0" }}>
              never mind
            </button>
          </div>
        )}

        {rsvpState === "withdrawConfirm" && !isHost && (
          <div className="fade-up">
            <div style={{ background: "#1a0808", border: `1.5px solid ${isLatePeriod ? "#FF2D78" : "#444"}`, borderRadius: 16, padding: "22px 20px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{isLatePeriod ? "💸" : "🚪"}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: isLatePeriod ? "#FF2D78" : "#F2F0FF", letterSpacing: .5, marginBottom: 10 }}>
                {isLatePeriod ? "you'll lose your stake" : "withdraw for free"}
              </div>
              {isLatePeriod
                ? <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>the withdrawal deadline passed. your <span style={{ color: "#FF2D78", fontWeight: 700 }}>{gf(stake)}</span> will be forfeited to the people who show up.</div>
                : <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>you're before the deadline. your <span style={{ color: "#4ade80", fontWeight: 700 }}>{gf(stake)}</span> will be refunded in full.</div>
              }
            </div>
            <button className={`cta-btn${busy ? " disabled" : ""}`} style={{ background: isLatePeriod ? "linear-gradient(135deg,#FF2D78,#c0392b)" : "#111", border: isLatePeriod ? "none" : "1.5px solid #444", color: isLatePeriod ? "#fff" : "#aaa" }} onClick={!busy ? handleWithdraw : undefined}>
              {busy ? "withdrawing…" : isLatePeriod ? `forfeit ${gf(stake)} and bail` : "yes, withdraw"}
            </button>
            <button onClick={() => setRsvpState("paid")} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#555", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 0" }}>
              actually, I'll be there
            </button>
          </div>
        )}

        {rsvpState === "withdrawn" && (
          <div className="fade-up">
            <div style={{ background: "#1a0a0a", border: "1.5px solid #333", borderRadius: 16, padding: "22px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>👋</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#555", letterSpacing: .5 }}>you're out</div>
              <div style={{ fontSize: 13, color: "#444", marginTop: 8 }}>maybe next time. 👻</div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
