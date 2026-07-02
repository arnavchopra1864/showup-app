export function Shell({ children, animClass = "slide-in-right" }) {
  return (
    <div className={animClass} style={{
      minHeight: "100vh", background: "#0D0D0D",
      display: "flex", justifyContent: "center",
      fontFamily: "'Inter',sans-serif",
      position: "absolute", inset: 0, overflowY: "auto",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </div>
  );
}
