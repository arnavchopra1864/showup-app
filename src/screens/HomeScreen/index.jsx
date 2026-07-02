import { useState } from "react";
import { Shell } from "../../components/Shell";
import { Header } from "../../components/Header";
import { BottomNav } from "../../components/BottomNav";
import { EmptyCard } from "../../components/EmptyCard";
import { gf } from "../../lib/currency";
import { EventCard } from "./EventCard";

export function HomeScreen({ events, nav, user, balance = 0 }) {
  const [tab, setTab] = useState("upcoming");
  const firstName = (user?.name ?? "AC").split(/\s+/)[0];

  const liveStatus = e => {
    if (e.status === "past" || e.status === "cancelled") return e.status;
    if (!e.starts_at) return e.status ?? "upcoming";
    return Math.floor((new Date(e.starts_at) - Date.now()) / 3600000) <= 4 ? "checkin" : "upcoming";
  };
  const myEvents      = events.filter(e => e.myStatus === "paid" || e.isHost);
  const checkinEvents = myEvents.filter(e => liveStatus(e) === "checkin");
  const upcomingRest  = myEvents.filter(e => liveStatus(e) === "upcoming");
  const pastEvents    = myEvents.filter(e => liveStatus(e) === "past");
  const tabContent    = tab === "upcoming" ? upcomingRest : pastEvents;

  const atStake = myEvents
    .filter(e => e.status !== "past")
    .reduce((s, e) => s + (e.stake ?? 0), 0);
  const active = myEvents.filter(e => e.status !== "past").length;

  return (
    <Shell animClass="slide-in-left">
      <Header eyebrow={`hey ${firstName} 👋`} title="what's" outline="the move?" />

      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        {active > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#F2F0FF", lineHeight: 1 }}>{gf(atStake)}</div>
            <div style={{ fontSize: 11, color: "#2a2a2a", fontWeight: 600 }}>at stake across {active} event{active !== 1 ? "s" : ""}</div>
          </div>
        ) : (
          <div />
        )}
        <button onClick={() => nav.push("buy")} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: "linear-gradient(135deg,rgba(245,196,81,.18),rgba(255,179,71,.05))", border: "1.5px solid rgba(245,196,81,.5)", borderRadius: 12, padding: "7px 11px", boxShadow: "0 0 18px rgba(245,196,81,.15)", flexShrink: 0 }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>✨</span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, lineHeight: 1, color: "#F5C451", letterSpacing: .5 }}>{balance}</div>
            <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "#b89a3a", marginTop: 1 }}>add flakes →</div>
          </div>
        </button>
      </div>

      <div style={{ padding: "0 20px" }}>
        {checkinEvents.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#FF2D78", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12, marginTop: 6 }}>
              {checkinEvents.length > 1 ? `${checkinEvents.length} events tonight` : "tonight"}
            </div>
            {checkinEvents.map(e => <EventCard key={e.id} event={e} nav={nav} />)}
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginBottom: 16, marginTop: 4 }}>
          {["upcoming", "past"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 10, cursor: "pointer",
              fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase",
              background: tab === t ? "rgba(123,47,255,.18)" : "transparent",
              border: tab === t ? "1.5px solid rgba(123,47,255,.4)" : "1.5px solid transparent",
              color: tab === t ? "#c4b5fd" : "#333", transition: "all .15s",
            }}>{t}</button>
          ))}
        </div>

        <div style={{ paddingBottom: 110 }}>
          {tabContent.length === 0
            ? <EmptyCard
                emoji={tab === "upcoming" ? "👻" : "📭"}
                headline={tab === "upcoming" ? "nothing lined up" : "no history yet"}
                sub={tab === "upcoming" ? "make your friends put skin in the game" : "payouts show up here"}
              />
            : tabContent.map(e => <EventCard key={e.id} event={e} nav={nav} />)
          }
        </div>
      </div>

      <BottomNav
        active="home"
        onHome={() => {}}
        onCreate={() => nav.push("create")}
        onProfile={() => nav.push("profile")}
      />
    </Shell>
  );
}
