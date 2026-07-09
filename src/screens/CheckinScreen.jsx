import { useState, useEffect, useRef } from "react";
import { Shell } from "../components/Shell";
import { EmptyCard } from "../components/EmptyCard";
import { gf } from "../lib/currency";
import { refreshCheckinToken, checkinWithToken, closeAndPayout, fetchEvent } from "../lib/events";

export function CheckinScreen({ event, eventId, nav, userId, refreshBalance, refreshEvents }) {
  const isReal  = !!eventId;
  const isHost  = event?.isHost ?? false;

  // Host state
  const [token,     setToken]     = useState(null);
  const [guests,    setGuests]    = useState([]);
  const [closing,   setClosing]   = useState(false);
  const [copied,    setCopied]    = useState(false);
  const pollRef    = useRef(null);
  const prevShowed = useRef(0);

  // Guest state
  const [code,       setCode]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [inputErr,   setInputErr]   = useState("");

  // Mock guest state (non-real path)
  const [mockChecked, setMockChecked]   = useState((event?.guests ?? []).filter(g => g.checked));
  const [justArrived, setJustArrived]   = useState(null);
  const [scanState,   setScanState]     = useState("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const scanRef = useRef(null);

  // ── Real host: get initial token + poll participants ──────────────────────
  const getToken = async () => {
    const { ok, token: t } = await refreshCheckinToken(eventId);
    if (ok && t) setToken(t);
  };

  const pollParticipants = async () => {
    const { ok, participants: ps } = await fetchEvent(eventId);
    if (ok && ps) setGuests(ps.filter(p => p.status !== "withdrawn"));
  };

  useEffect(() => {
    if (!isReal || !isHost) return;
    const init = async () => {
      const { ok, token: t } = await refreshCheckinToken(eventId);
      if (!ok || !t) return;
      const res = await checkinWithToken(eventId, t);
      if (res.ok && !res.already) {
        // Token was consumed checking in the host — get a fresh one for guests
        const { ok: ok2, token: t2 } = await refreshCheckinToken(eventId);
        if (ok2 && t2) setToken(t2);
      } else {
        setToken(t);
      }
    };
    init();
    pollParticipants();
    pollRef.current = setInterval(pollParticipants, 5000);
    return () => clearInterval(pollRef.current);
  }, [isReal, isHost]);

  // Refresh token each time a new guest checks in
  useEffect(() => {
    if (!isReal || !isHost) return;
    const showed = guests.filter(g => g.status === "showed").length;
    if (showed > prevShowed.current) getToken();
    prevShowed.current = showed;
  }, [guests]);

  // ── Mock host: simulate arrivals ─────────────────────────────────────────
  useEffect(() => {
    if (isReal || !isHost) return;
    const pending = (event?.guests ?? []).filter(g => !g.checked);
    if (!pending.length) return;
    const t = setTimeout(() => {
      setMockChecked(prev => [...prev, pending[0]]);
      setJustArrived(pending[0].name);
      setTimeout(() => setJustArrived(null), 2500);
    }, 3500);
    return () => clearTimeout(t);
  }, [isReal, isHost]);

  const genMockCode = () => Math.random().toString(16).slice(2, 8).toUpperCase();
  const [mockSeed, setMockSeed] = useState(genMockCode);
  const prevMockCount = useRef(0);
  useEffect(() => {
    if (isReal || !isHost) return;
    if (mockChecked.length > prevMockCount.current) setMockSeed(genMockCode());
    prevMockCount.current = mockChecked.length;
  }, [mockChecked.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInvite = async () => {
    const url = isReal
      ? `${window.location.origin}?event=${eventId}`
      : `${window.location.origin}?event=demo`;
    const name = event?.name ?? "this event";
    if (navigator.share) {
      try { await navigator.share({ title: name, text: `join me at ${name}`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    const res = await closeAndPayout(eventId);
    if (res.ok) {
      // Best-effort refresh — don't let these block or prevent navigation
      await Promise.allSettled([refreshBalance?.(), refreshEvents?.()]);
    }
    nav.replace("payout", { eventId });
  };

  const handleCheckin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setSubmitting(true); setInputErr("");
    const res = await checkinWithToken(eventId, trimmed);
    setSubmitting(false);
    if (res.ok) { setCheckinDone(true); }
    else { setInputErr(res.error || "couldn't check in"); }
  };

  // Mock scan
  const startScan = () => {
    if (scanState !== "idle") return;
    setScanState("scanning"); setScanProgress(0);
    let p = 0;
    scanRef.current = setInterval(() => {
      p += 100 / 28;
      setScanProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(scanRef.current); setTimeout(() => setScanState("success"), 200); }
    }, 60);
  };
  useEffect(() => () => clearInterval(scanRef.current), []);

  if (!event && !eventId) return (
    <Shell>
      <div style={{ padding: "calc(44px + env(safe-area-inset-top, 0px)) 24px 28px" }}>
        <button onClick={nav.pop} style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "10px", margin: "-10px 0 -10px -10px" }}>← back</button>
      </div>
      <div style={{ padding: 24 }}><EmptyCard emoji="🤔" headline="no event found" sub="go back and try again" /></div>
    </Shell>
  );

  const displayGuests = isReal ? guests : (event?.guests ?? []);
  const checkedIn     = isReal
    ? guests.filter(g => g.status === "showed")
    : mockChecked;
  const remaining = displayGuests.length - checkedIn.length;
  const qrValue   = isReal ? token : mockSeed;

  return (
    <Shell>
      <div style={{ background: "linear-gradient(160deg,#1a0a2e 0%,#0d0d1a 55%,#0D0D0D 100%)", padding: "calc(44px + env(safe-area-inset-top, 0px)) 24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 75% 15%,rgba(123,47,255,.2) 0%,transparent 55%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <button onClick={nav.pop} style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "10px", margin: "-10px 0 -10px -10px" }}>← back</button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,45,120,.12)", border: "1px solid rgba(255,45,120,.25)", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#ff6b9d", letterSpacing: 1.2, textTransform: "uppercase" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF2D78", display: "inline-block" }} />tonight
            </div>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, lineHeight: .9, color: "#F2F0FF", margin: "0 0 6px", letterSpacing: 1 }}>{event?.name ?? "check in"}</h1>
          {event?.location && <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>📍 {event.location} · {gf(event.potTotal ?? 0)} pot</div>}
        </div>
      </div>

      <div style={{ padding: "20px 20px 80px" }}>
        {isHost ? (
          <>
            {/* Code card */}
            <div style={{ background: "linear-gradient(135deg,#12082a,#1a0a1e)", border: "1.5px solid rgba(123,47,255,.4)", borderRadius: 20, padding: "26px 24px 22px", textAlign: "center", marginBottom: 20, position: "relative" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 18 }}>show this to your crew</div>
              <div style={{ padding: "24px 0", background: "rgba(123,47,255,.07)", borderRadius: 16, boxShadow: "0 0 48px rgba(123,47,255,.2)" }}>
                {qrValue
                  ? <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 72, letterSpacing: 14, color: "#F2F0FF", lineHeight: 1, userSelect: "text", WebkitUserSelect: "text" }}>{qrValue}</div>
                  : <div style={{ fontSize: 13, color: "#555", fontWeight: 700, padding: "24px 0" }}>generating…</div>
                }
              </div>
              <div style={{ fontSize: 11, color: "#333", marginTop: 14 }}>refreshes after each scan</div>
              {justArrived && (
                <div className="fade-up" style={{ position: "absolute", top: 14, right: 14, background: "rgba(74,222,128,.15)", border: "1px solid rgba(74,222,128,.35)", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>
                  {justArrived} is in ✓
                </div>
              )}
            </div>

            {/* Invite */}
            <button
              onClick={handleInvite}
              style={{ width: "100%", marginBottom: 16, padding: "13px 0", borderRadius: 14, background: "rgba(123,47,255,.08)", border: "1.5px solid rgba(123,47,255,.25)", color: copied ? "#4ade80" : "#b388ff", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "color .2s" }}
            >
              {copied ? "link copied ✓" : "invite friends 🔗"}
            </button>

            {/* Guest list */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#555", letterSpacing: 1.5, textTransform: "uppercase" }}>
                {displayGuests.length === 0 ? "no guests yet" : `${checkedIn.length}/${displayGuests.length} checked in`}
              </div>
              {displayGuests.length > 0 && (
                remaining > 0
                  ? <div style={{ fontSize: 11, color: "#FF2D78", fontWeight: 700 }}>{remaining} still out there</div>
                  : <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>everyone's in 🔒</div>
              )}
            </div>

            {displayGuests.length === 0
              ? <EmptyCard emoji="👀" headline="no one yet" sub="share the event link so people can pay in" />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {displayGuests.map((g, i) => {
                    const isIn = isReal ? g.status === "showed" : checkedIn.some(c => c.name === g.name);
                    const name = isReal ? (g.profile?.name ?? "someone") : g.name;
                    const avatar = isReal ? (g.profile?.avatar ?? "?") : g.avatar;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 14, background: isIn ? "rgba(74,222,128,.05)" : "#111", border: `1px solid ${isIn ? "rgba(74,222,128,.2)" : "#1a1a1a"}`, transition: "all .5s ease" }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: isIn ? "rgba(74,222,128,.15)" : "#1a1a1a", border: `1.5px solid ${isIn ? "rgba(74,222,128,.4)" : "#222"}`, color: isIn ? "#4ade80" : "#333" }}>{avatar}</div>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: isIn ? "#F2F0FF" : "#444" }}>{name}</div>
                        <div style={{ fontSize: 18 }}>{isIn ? "✅" : "⏳"}</div>
                      </div>
                    );
                  })}
                </div>
              )
            }

            {isReal && (
              <button
                className={`cta-btn${closing ? " disabled" : ""}`}
                style={{ background: closing ? "#222" : "linear-gradient(135deg,#7B2FFF,#FF2D78)" }}
                onClick={!closing ? handleClose : undefined}
              >
                {closing ? "closing…" : "close check-in → pay out"}
              </button>
            )}
          </>
        ) : (
          /* Guest view */
          isReal ? (
            checkinDone ? (
              <div className="pop-in" style={{ background: "linear-gradient(135deg,#0a1a0a,#0f1f0a)", border: "1.5px solid rgba(74,222,128,.4)", borderRadius: 20, padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 52, color: "#4ade80", lineHeight: .92, marginBottom: 10 }}>you're in</div>
                <div style={{ fontSize: 13, color: "#555" }}>checked in · sit tight and pray someone bails 😈</div>
              </div>
            ) : (
              <div>
                <div style={{ background: "linear-gradient(135deg,#12082a,#1a0a1e)", border: "1.5px solid rgba(123,47,255,.4)", borderRadius: 20, padding: "28px 24px", textAlign: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔲</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#F2F0FF", marginBottom: 8 }}>enter the code</div>
                  <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>find the host and type the code from their screen</div>
                  <input
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 6)); setInputErr(""); }}
                    onKeyDown={e => e.key === "Enter" && handleCheckin()}
                    placeholder="A3F72B"
                    maxLength={6}
                    autoFocus
                    style={{ width: "100%", textAlign: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, letterSpacing: 12, background: "#0d0d0d", border: "1.5px solid #2a2a2a", borderRadius: 14, color: "#F2F0FF", padding: "16px 0", boxSizing: "border-box", outline: "none" }}
                  />
                  {inputErr && <div style={{ fontSize: 13, color: "#FF2D78", marginTop: 10, fontWeight: 600 }}>{inputErr}</div>}
                </div>
                <button
                  className={`cta-btn${(!code.trim() || submitting) ? " disabled" : ""}`}
                  onClick={code.trim() && !submitting ? handleCheckin : undefined}
                >
                  {submitting ? "checking in…" : "check in"}
                </button>
              </div>
            )
          ) : (
            /* Mock scan UI */
            scanState === "success" ? (
              <div className="pop-in" style={{ background: "linear-gradient(135deg,#0a1a0a,#0f1f0a)", border: "1.5px solid rgba(74,222,128,.4)", borderRadius: 20, padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 52, color: "#4ade80", lineHeight: .92, marginBottom: 10 }}>you're in</div>
                <div style={{ fontSize: 13, color: "#555" }}>checked in · pot locked when everyone's here</div>
              </div>
            ) : (
              <div onClick={startScan} style={{ borderRadius: 20, overflow: "hidden", cursor: scanState === "idle" ? "pointer" : "default", position: "relative", aspectRatio: "1", background: "#0a0a0f", border: `1.5px solid ${scanState === "scanning" ? "#7B2FFF" : "#1a1a1a"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color .3s" }}>
                {scanState === "idle" && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 52, marginBottom: 14 }}>📷</div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: "#F2F0FF", marginBottom: 6 }}>tap to scan</div>
                    <div style={{ fontSize: 12, color: "#333" }}>find the host</div>
                  </div>
                )}
                {scanState === "scanning" && (
                  <>
                    {[
                      { top: "18%", left: "18%", borderTop: "3px solid #7B2FFF", borderLeft: "3px solid #7B2FFF" },
                      { top: "18%", right: "18%", borderTop: "3px solid #7B2FFF", borderRight: "3px solid #7B2FFF" },
                      { bottom: "18%", left: "18%", borderBottom: "3px solid #7B2FFF", borderLeft: "3px solid #7B2FFF" },
                      { bottom: "18%", right: "18%", borderBottom: "3px solid #7B2FFF", borderRight: "3px solid #7B2FFF" },
                    ].map((s, i) => <div key={i} style={{ position: "absolute", width: 30, height: 30, borderRadius: 3, ...s }} />)}
                    <div style={{ position: "absolute", left: "18%", right: "18%", height: 2, background: "linear-gradient(90deg,transparent,#7B2FFF,#FF2D78,#7B2FFF,transparent)", top: `${18 + (scanProgress / 100) * 64}%`, transition: "top .06s linear", boxShadow: "0 0 14px rgba(123,47,255,.9)" }} />
                  </>
                )}
              </div>
            )
          )
        )}
      </div>
    </Shell>
  );
}
