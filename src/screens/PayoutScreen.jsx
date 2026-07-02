import { useState, useEffect } from "react";
import { Shell } from "../components/Shell";
import { EmptyCard } from "../components/EmptyCard";
import { calcPayout } from "../lib/payoutMath";
import { fetchPayoutData } from "../lib/events";
import { gf } from "../lib/currency";

export function PayoutScreen({ event: initialEvent, eventId, nav, userId, refreshBalance }) {
  const isReal = !!eventId;

  const [realData, setRealData] = useState(null);
  const [loading,  setLoading]  = useState(isReal);

  const [stage,          setStage]          = useState(0);
  const [flakersShown,   setFlakersShown]   = useState(0);
  const [showupsVisible, setShowupsVisible] = useState(false);
  const [payoutVisible,  setPayoutVisible]  = useState(false);
  const [shareVisible,   setShareVisible]   = useState(false);

  useEffect(() => {
    if (!isReal) return;
    fetchPayoutData(eventId, userId).then(data => {
      setRealData(data.ok ? data : null);
      setLoading(false);
      refreshBalance?.();
    });
  }, [eventId, userId]);

  if (loading) return (
    <Shell>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#333" }}>tallying up…</div>
      </div>
    </Shell>
  );

  // Derive display values from real or mock source
  const event         = isReal ? realData?.event : initialEvent;
  const stake         = realData?.stake ?? event?.stake ?? 50;
  const showedGuests  = isReal ? (realData?.showed ?? []) : (event?.guests ?? []).filter(g => g.checked);
  const flakedGuests  = isReal ? (realData?.flaked ?? []) : (event?.guests ?? []).filter(g => !g.checked);
  const myStatus      = isReal ? realData?.myStatus : "showed";
  const iShowed       = myStatus === "showed";

  // Payout math
  const flaked        = flakedGuests.length;
  const totalPaid     = isReal
    ? showedGuests.length + flakedGuests.length
    : (event?.paidIn ?? (event?.guests?.length ?? 0));
  const totalAttended = showedGuests.length;
  const computed      = calcPayout(stake, totalPaid, totalAttended);
  const payout        = isReal ? (realData?.myPayout ?? 0) : (event?.payout ?? computed.payout);
  const profit        = isReal ? (realData?.myProfit ?? 0) : (event?.profit ?? computed.profit);
  const fee           = isReal ? (realData?.fee ?? 0) : computed.fee;

  if (!event) return (
    <Shell>
      <div style={{ padding: "44px 24px 28px" }}>
        <button onClick={nav.pop} style={{ background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>← back</button>
      </div>
      <div style={{ padding: 24 }}><EmptyCard emoji="💀" headline="no payout data" sub="something went wrong" /></div>
    </Shell>
  );

  const fullyDone = shareVisible;

  const handleTap = () => {
    if (stage === 0) { setStage(1); return; }
    if (stage === 1) { setStage(2); return; }
    if (stage === 2 && flakersShown < flakedGuests.length) { setFlakersShown(f => f + 1); return; }
    if (!showupsVisible) { setShowupsVisible(true); return; }
    if (!payoutVisible)  { setPayoutVisible(true);  return; }
    if (!shareVisible)   { setShareVisible(true);   return; }
  };

  return (
    <Shell>
      {!fullyDone && <div onClick={handleTap} style={{ position: "fixed", inset: 0, zIndex: 10, cursor: "pointer" }} />}

      <div style={{ background: "linear-gradient(160deg,#1a0a2e 0%,#0d0d1a 55%,#0D0D0D 100%)", padding: "44px 24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 20%,rgba(255,45,120,.12) 0%,transparent 58%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {stage === 0 ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: "#F2F0FF", lineHeight: .95, marginBottom: 8 }}>results are in</div>
              <div style={{ fontSize: 13, color: "#444" }}>tap to reveal</div>
            </div>
          ) : (
            <div className="fade-up">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,45,120,.15)", border: "1px solid rgba(255,45,120,.3)", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#ff6b9d", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF2D78", display: "inline-block" }} />event over
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(40px,12vw,56px)", lineHeight: .9, color: "#F2F0FF", margin: "0 0 6px", letterSpacing: 1 }}>{event.name}</h1>
              {event.location && <p style={{ color: "#555", fontSize: 13, margin: "8px 0 0" }}>📍 {event.location}</p>}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "24px 20px 80px" }}>
        {stage >= 2 && flakedGuests.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#FF2D78", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
              {flakersShown === 0 ? "checking who bailed..." : `${flakersShown} flaked 🪦`}
            </div>
            {flakedGuests.map((person, i) => {
              const revealed = i < flakersShown;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, background: revealed ? "#1a0a0e" : "#111", border: `1px solid ${revealed ? "rgba(255,45,120,.25)" : "#1a1a1a"}`, marginBottom: 8, transition: "all .4s ease" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: revealed ? "rgba(255,45,120,.15)" : "#1a1a1a", border: `1.5px solid ${revealed ? "#FF2D78" : "#222"}`, color: revealed ? "#ff6b9d" : "#333" }}>
                    {revealed ? person.avatar : "??"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: revealed ? "#F2F0FF" : "#222" }}>{revealed ? person.name : "???"}</div>
                    {revealed && <div style={{ fontSize: 11, color: "#FF2D78", marginTop: 2 }}>donated {gf(stake)} to the pot 👀</div>}
                  </div>
                  {revealed && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(255,45,120,.12)", color: "#FF2D78", border: "1px solid rgba(255,45,120,.25)" }}>ghost 🪦</span>}
                </div>
              );
            })}
          </div>
        )}

        {stage >= 2 && flakedGuests.length === 0 && !showupsVisible && (
          <div className="fade-up" style={{ marginBottom: 24, textAlign: "center", padding: "20px", background: "rgba(74,222,128,.05)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 14 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>nobody flaked</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>rare. truly rare.</div>
          </div>
        )}

        {showupsVisible && showedGuests.length > 0 && (
          <div className="fade-up" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#4ade80", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>{showedGuests.length} showed up 🔥</div>
            {showedGuests.map((person, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, background: "rgba(74,222,128,.05)", border: "1px solid rgba(74,222,128,.2)", marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: person.isMe ? "linear-gradient(135deg,#7B2FFF44,#FF2D7844)" : "rgba(74,222,128,.12)", border: `1.5px solid ${person.isMe ? "#7B2FFF" : "#4ade80"}`, color: person.isMe ? "#c4b5fd" : "#4ade80" }}>{person.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F2F0FF" }}>
                    {person.name}{person.isMe && <span style={{ fontSize: 10, color: "#7B2FFF", marginLeft: 6 }}>you</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: person.isMe ? "rgba(123,47,255,.15)" : "rgba(74,222,128,.1)", color: person.isMe ? "#c4b5fd" : "#4ade80", border: `1px solid ${person.isMe ? "rgba(123,47,255,.3)" : "rgba(74,222,128,.25)"}` }}>showed 🔥</span>
              </div>
            ))}
          </div>
        )}

        {payoutVisible && (
          <div className="fade-up glow-green" style={{ background: "linear-gradient(135deg,#0a1a0a,#0f1f0a)", border: `1.5px solid ${iShowed ? "rgba(74,222,128,.35)" : "rgba(255,45,120,.3)"}`, borderRadius: 20, padding: "28px 24px", textAlign: "center", marginBottom: 20 }}>
            {iShowed ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 8 }}>your payout</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 80, lineHeight: 1, background: "linear-gradient(135deg,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2, marginBottom: 4 }}>{gf(payout)}</div>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
                  {profit > 0
                    ? <span>you made <span style={{ color: "#4ade80", fontWeight: 700 }}>+{gf(profit)}</span> off your flaky friends 😈</span>
                    : flaked === 0
                      ? <span style={{ color: "#4ade80" }}>everyone showed. clean sweep 💚</span>
                      : <span style={{ color: "#4ade80" }}>your {gf(stake)} back 💚</span>
                  }
                  {fee > 0 && <div style={{ fontSize: 11, color: "#2a2a2a", marginTop: 8 }}>{gf(fee)} platform fee on forfeited stakes</div>}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>💸</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: "#FF2D78", marginBottom: 8 }}>you flaked</div>
                <div style={{ fontSize: 13, color: "#555" }}>your {gf(stake)} went to the people who actually showed up.</div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.05)" }}>
              {[
                { val: gf(stake * flaked), label: "forfeited" },
                { val: showedGuests.length, label: "showed" },
                { val: flaked, label: "flaked" },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#F2F0FF" }}>{item.val}</div>
                    <div style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: .8, textTransform: "uppercase" }}>{item.label}</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 1, background: "#1e1e1e", height: 32 }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {shareVisible && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="cta-btn">share your results 📣</button>
            <button className="cta-btn" style={{ background: "#111", color: "#888", border: "1.5px solid #1e1e1e" }} onClick={() => nav.push("create")}>run it back 🔁</button>
            <button style={{ background: "none", border: "none", color: "#444", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }} onClick={() => nav.resetTo("home")}>back to home</button>
          </div>
        )}

        {!fullyDone && stage > 0 && (
          <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#2a2a2a", fontWeight: 600, letterSpacing: .5, pointerEvents: "none" }}>
            tap to continue
          </div>
        )}
      </div>
    </Shell>
  );
}
