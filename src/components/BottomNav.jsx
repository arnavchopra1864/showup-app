import { createPortal } from "react-dom";

const navItem = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", gap: 4, cursor: "pointer",
};

export function BottomNav({ active, onHome, onCreate, onProfile }) {
  // Rendered via a portal straight into <body> so it's never a descendant of
  // Shell's animated wrapper. Shell's entry animations use `animation-fill-mode:
  // both`, which keeps a non-none `transform` on that wrapper permanently (even
  // after the animation finishes) — a transformed ancestor creates a new
  // containing block for `position: fixed` children, which would otherwise pin
  // this nav to Shell's scrolling box instead of the viewport, so it'd scroll
  // away with the page content. Portaling out of that subtree keeps it pinned
  // to the real viewport at all times, including mid-animation.
  return createPortal(
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 420,
      background: "rgba(13,13,13,.95)", backdropFilter: "blur(16px)",
      borderTop: "1px solid #1a1a1a",
      display: "flex", alignItems: "center",
      padding: "12px 0 calc(20px + env(safe-area-inset-bottom, 0px))", zIndex: 100,
    }}>
      <div onClick={onHome} style={navItem}>
        <div style={{ fontSize: 20 }}>🏠</div>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: active === "home" ? "#a78bfa" : "#333" }}>home</div>
        {active === "home" && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7B2FFF" }} />}
      </div>
      <div style={{ flex: 1.2, display: "flex", justifyContent: "center" }}>
        <button onClick={onCreate} style={{
          background: "linear-gradient(135deg,#7B2FFF,#FF2D78)",
          border: "none", borderRadius: 12, padding: "8px 20px",
          fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: 1.5,
          color: "#fff", cursor: "pointer", transition: "transform .12s",
        }}>
          + new event
        </button>
      </div>
      <div onClick={onProfile} style={navItem}>
        <div style={{ fontSize: 20 }}>👤</div>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: active === "profile" ? "#a78bfa" : "#333" }}>profile</div>
        {active === "profile" && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7B2FFF" }} />}
      </div>
    </div>,
    document.body
  );
}
