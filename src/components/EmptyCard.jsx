export function EmptyCard({ emoji, headline, sub }) {
  return (
    <div style={{
      textAlign: "center", padding: "44px 24px",
      background: "#111", borderRadius: 18, border: "1px solid #1a1a1a",
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: "#2a2a2a", marginBottom: 6 }}>{headline}</div>
      <div style={{ fontSize: 12, color: "#2a2a2a" }}>{sub}</div>
    </div>
  );
}
