import { useState, useEffect } from "react";
import { Shell } from "../components/Shell";
import { BottomNav } from "../components/BottomNav";
import { EmptyCard } from "../components/EmptyCard";
import { USER } from "../data/mockData";
import { safeRate, rateProps } from "../lib/reliabilityUtils";
import { gf } from "../lib/currency";
import { fetchMyHistory, fetchCrossedPaths } from "../lib/social";

export function ProfileScreen({ nav, user = USER, balance = USER.goldFlakes, onSignOut }) {
  const [tab, setTab] = useState("history");

  const [history,        setHistory]        = useState([]);
  const [people,         setPeople]         = useState([]);
  const [stats,          setStats]          = useState({ showed: 0, totalEvents: 0, streak: 0, totalEarned: 0 });
  const [loadingHistory, setLoadingHistory] = useState(!!user.id);
  const [loadingPeople,  setLoadingPeople]  = useState(!!user.id);

  useEffect(() => {
    if (!user.id) return;
    fetchMyHistory(user.id).then(res => {
      if (res.ok) { setHistory(res.history); setStats(res.stats); }
      setLoadingHistory(false);
    });
    fetchCrossedPaths(user.id).then(res => {
      if (res.ok) setPeople(res.people);
      setLoadingPeople(false);
    });
  }, [user.id]);

  const isNewUser = stats.totalEvents === 0;
  const showRate  = safeRate(stats.showed, stats.totalEvents);
  const { label: rateLabel, color: rateColor } = rateProps(showRate);
  const miniHistory = history.slice(0, 10).map(h => h.showed);

  return (
    <Shell animClass="slide-in-right">
      <div style={{ background: "linear-gradient(160deg,#1a0a2e 0%,#0d0d1a 55%,#0D0D0D 100%)", padding: "48px 24px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 20%,rgba(123,47,255,.18) 0%,transparent 58%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 1, background: "linear-gradient(135deg,#7B2FFF44,#FF2D7844)", border: "2px solid rgba(123,47,255,.5)", color: "#d4b4fe", boxShadow: "0 0 24px rgba(123,47,255,.25)" }}>{user.avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, lineHeight: .9, color: "#F2F0FF", letterSpacing: 1 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>{user.handle}</div>
          </div>
          <button onClick={() => nav.push("buy")} style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, cursor: "pointer", background: "linear-gradient(135deg,rgba(245,196,81,.22),rgba(255,179,71,.08))", border: "1.5px solid rgba(245,196,81,.6)", borderRadius: 16, padding: "9px 13px", boxShadow: "0 0 28px rgba(245,196,81,.2)" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✨</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, lineHeight: 1, color: "#F5C451", letterSpacing: .5 }}>{balance}</div>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#b89a3a", marginTop: 2 }}>add flakes →</div>
            </div>
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 20px 100px" }}>
        {/* Reliability card */}
        {isNewUser ? (
          <div style={{ background: "linear-gradient(135deg,#12082a,#1a0a1e)", border: "1.5px solid rgba(123,47,255,.2)", borderRadius: 18, padding: "24px 22px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🌱</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: "#F2F0FF", marginBottom: 6 }}>no rep yet</div>
            <div style={{ fontSize: 12, color: "#444" }}>go to an event. then we'll talk.</div>
          </div>
        ) : (
          <div style={{ background: "linear-gradient(135deg,#12082a,#1a0a1e)", border: "1.5px solid rgba(123,47,255,.3)", borderRadius: 18, padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 52, color: rateColor, lineHeight: 1 }}>{showRate}%</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>showed {stats.showed} of {stats.totalEvents} events</div>
              </div>
              {rateLabel && (
                <div style={{ background: `${rateColor}15`, border: `1px solid ${rateColor}44`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, color: rateColor }}>{rateLabel}</div>
              )}
            </div>
            {miniHistory.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#333", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>last {miniHistory.length} event{miniHistory.length !== 1 ? "s" : ""}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {miniHistory.map((showed, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: showed ? "#4ade80" : "#FF2D78", opacity: showed ? .85 : .6 }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 18, padding: "18px 20px", marginBottom: 16, display: "flex", alignItems: "center" }}>
          {[
            { val: stats.streak > 0 ? `🔥 ${stats.streak}` : "--",                                    label: "streak", color: stats.streak > 0 ? "#F2F0FF" : "#2a2a2a" },
            { val: stats.totalEarned > 0 ? `+${gf(stats.totalEarned)}` : gf(0),                       label: "earned", color: stats.totalEarned > 0 ? "#4ade80" : "#2a2a2a" },
            { val: stats.totalEvents || "--",                                                           label: "events", color: stats.totalEvents > 0 ? "#F2F0FF" : "#2a2a2a" },
          ].map((item, i) => (
            <div key={item.label} style={{ flex: 1, display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: 1, background: "#1e1e1e", height: 36, marginRight: 16 }} />}
              <div style={{ textAlign: i === 0 ? "left" : "center", flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: item.color, lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: .8, marginTop: 3 }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {["history", "people"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 16px", borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", background: tab === t ? "rgba(123,47,255,.18)" : "transparent", border: tab === t ? "1.5px solid rgba(123,47,255,.4)" : "1.5px solid transparent", color: tab === t ? "#c4b5fd" : "#333", transition: "all .15s" }}>{t}</button>
          ))}
        </div>

        {tab === "history" && (
          loadingHistory
            ? <div style={{ fontSize: 13, color: "#333", textAlign: "center", padding: "32px 0" }}>loading…</div>
            : history.length === 0
              ? <EmptyCard emoji="📭" headline="nothing yet" sub="your event history shows up here" />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: e.showed ? "rgba(74,222,128,.03)" : "rgba(255,45,120,.03)", border: `1px solid ${e.showed ? "rgba(74,222,128,.12)" : "rgba(255,45,120,.1)"}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: e.showed ? "#4ade80" : "#FF2D78", opacity: e.showed ? .85 : .6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: e.showed ? "#F2F0FF" : "#555" }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{e.date}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {e.showed
                          ? <><div style={{ fontSize: 13, fontWeight: 700, color: e.profit > 0 ? "#4ade80" : "#666" }}>{e.profit > 0 ? `+${gf(e.profit, { decimals: 2 })}` : `${gf(e.payout, { decimals: 2 })} back`}</div><div style={{ fontSize: 10, color: "#333", marginTop: 1 }}>showed</div></>
                          : <><div style={{ fontSize: 13, fontWeight: 700, color: "#FF2D78" }}>-{gf(e.loss)}</div><div style={{ fontSize: 10, color: "#333", marginTop: 1 }}>missed</div></>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )
        )}

        {tab === "people" && (
          loadingPeople
            ? <div style={{ fontSize: 13, color: "#333", textAlign: "center", padding: "32px 0" }}>loading…</div>
            : people.length === 0
              ? <EmptyCard emoji="👀" headline="nobody yet" sub="people you go to events with show up here" />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {people.map(p => {
                    const rate      = safeRate(p.showedCount, p.totalEvents);
                    const { color } = rateProps(rate);
                    return (
                      <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "#111", border: "1px solid #1a1a1a" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: `${color}18`, border: `1.5px solid ${color}44`, color }}>{p.avatar}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#F2F0FF" }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                            {p.sharedEvents === 1 ? "1 event together" : `${p.sharedEvents} events together`}
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color, lineHeight: 1 }}>{rate !== null ? `${rate}%` : "--"}</div>
                      </div>
                    );
                  })}
                </div>
              )
        )}
      </div>

      <div style={{ padding: "0 20px 110px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onSignOut} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, cursor: "pointer", background: "transparent", border: "1.5px solid rgba(255,45,120,.2)", color: "#FF2D78", fontSize: 13, fontWeight: 700, textAlign: "left" }}>
          sign out
        </button>
      </div>

      <BottomNav
        active="profile"
        onHome={() => nav.resetTo("home")}
        onCreate={() => nav.push("create")}
        onProfile={() => {}}
      />
    </Shell>
  );
}
