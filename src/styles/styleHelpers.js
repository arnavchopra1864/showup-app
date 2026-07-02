export function pill(color) {
  return {
    fontSize: 10, fontWeight: 800, padding: "4px 11px",
    borderRadius: 20, letterSpacing: .5, whiteSpace: "nowrap",
    background: `${color}18`, color, border: `1px solid ${color}44`,
  };
}
