import { pill } from "../../styles/styleHelpers";
import { gf } from "../../lib/currency";

function liveStatus(event) {
  if (event.status === "past" || event.status === "cancelled") return event.status;
  if (!event.starts_at) return event.status ?? "upcoming";
  const h = Math.floor((new Date(event.starts_at) - Date.now()) / 3600000);
  return h <= 4 ? "checkin" : "upcoming";
}

export function EventCard({ event, nav }) {
  const status  = liveStatus(event);
  const isToday = status === "checkin";
  const isPast  = status === "past";
  const hoursSinceStart = event.starts_at ? (Date.now() - new Date(event.starts_at)) / 3600000 : 0;
  const needsClose = isToday && event.isHost && hoursSinceStart >= 3;

  const borderColor = isToday ? "#FF2D78" : isPast ? "#1e2e1e" : "#1e1e2e";
  const bg          = isToday ? "rgba(255,45,120,.04)" : isPast ? "rgba(74,222,128,.02)" : "#111";
  const timeColor   = isToday ? "#FF2D78" : isPast ? "#4ade80" : "#555";

  const handleTap = () => {
    if (isToday) { nav.push("checkin", { event, eventId: event.id }); return; }
    if (isPast)  { nav.push("payout",  { event, eventId: event.id }); return; }
    nav.push("event", { eventId: event.id });
  };

  function timeLabel(hoursAway, status) {
    if (status === "checkin") return "now";
    if (status === "past") return "done";
    if (!hoursAway && hoursAway !== 0) return "?";
    if (hoursAway < 24) return `${hoursAway}h`;
    return `${Math.round(hoursAway / 24)}d`;
  }

  return (
    <div onClick={handleTap} className="event-card" style={{
      background: bg, border: `1px solid ${borderColor}`,
      borderRadius: 18, padding: "18px 20px", cursor: "pointer", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flexShrink: 0, textAlign: "center", width: 42, padding: "6px 0", background: "rgba(255,255,255,.03)", borderRadius: 9 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, lineHeight: 1, color: timeColor }}>
            {timeLabel(event.hoursAway, status)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, lineHeight: 1, color: "#F2F0FF", letterSpacing: .5 }}>
              {event.name || "Untitled event"}
            </div>
            {event.isHost && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: "rgba(123,47,255,.15)", color: "#9b6dff", border: "1px solid rgba(123,47,255,.25)", letterSpacing: .5, textTransform: "uppercase" }}>host</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#3a3a3a", marginTop: 5, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {!isPast ? (
              <>
                <span>{gf(event.potTotal ?? 0)} pot</span>
                <span>{event.paidIn ?? 0}/{event.total ?? 0} in</span>
              </>
            ) : (
              <>
                {(event.profit ?? 0) > 0
                  ? <span style={{ color: "#4ade80", fontWeight: 700 }}>+{gf(event.profit, { decimals: 2 })}</span>
                  : <span>{gf(event.payout ?? 0, { decimals: 2 })} back</span>
                }
                {(event.flaked ?? 0) > 0 && <span>{event.flaked} flaked</span>}
              </>
            )}
          </div>
        </div>
        {isToday && !needsClose && <span style={pill("#FF2D78")}>check in</span>}
        {needsClose && <span style={pill("#fbbf24")}>close out</span>}
        {isPast   && <span style={pill("#4ade80")}>paid out</span>}
        {!isToday && !isPast && <span style={pill("#444")}>in</span>}
      </div>

      {needsClose && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#fbbf24" }}>
          wrap it up! auto-closes soon
        </div>
      )}
    </div>
  );
}
