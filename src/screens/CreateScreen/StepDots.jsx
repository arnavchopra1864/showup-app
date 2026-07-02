import { STEPS } from "./createScreenConstants";

export function StepDots({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {STEPS.map((label, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? "#7B2FFF" : active ? "rgba(123,47,255,.2)" : "#1a1a1a",
                border: active ? "1.5px solid #7B2FFF" : done ? "none" : "1.5px solid #2a2a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: done ? "#fff" : active ? "#a78bfa" : "#333",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase",
                color: active ? "#a78bfa" : done ? "#555" : "#2a2a2a",
                whiteSpace: "nowrap",
              }}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, marginBottom: 16, background: done ? "#7B2FFF" : "#1e1e1e", transition: "background .3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
