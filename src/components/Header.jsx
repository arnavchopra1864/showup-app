export function Header({ eyebrow, title, outline, sub, onBack }) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#1a0a2e 0%,#0d0d1a 55%,#0D0D0D 100%)",
      padding: "44px 24px 28px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 75% 15%,rgba(123,47,255,.2) 0%,transparent 55%)",
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative" }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: "none", border: "none", color: "#555",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            marginBottom: 12, padding: 0, display: "flex", alignItems: "center", gap: 6,
          }}>
            ← back
          </button>
        )}
        {eyebrow && (
          <div style={{ fontSize: 12, fontWeight: 800, color: "#444", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: "clamp(40px,12vw,56px)", lineHeight: .9,
          color: "#F2F0FF", margin: "0 0 4px", letterSpacing: 1,
        }}>
          {title}
          {outline && (
            <>
              <br />
              <span style={{ WebkitTextStroke: "2px #7B2FFF", color: "transparent" }}>{outline}</span>
            </>
          )}
        </h1>
        {sub && <div style={{ fontSize: 13, color: "#555", marginTop: 10 }}>{sub}</div>}
      </div>
    </div>
  );
}
