import { useState } from "react";
import { FLAKE_PACKS } from "../lib/flakes";

const GOLD = "#F5C451";

export function FlakeShop({ onPurchase, ctaLabel = "add gold flakes", onSkip, skipLabel }) {
  const [sel, setSel] = useState(FLAKE_PACKS.find(p => p.popular) ?? FLAKE_PACKS[0]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {FLAKE_PACKS.map(p => {
          const active = sel.usd === p.usd;
          return (
            <button key={p.usd} onClick={() => setSel(p)} style={{
              position: "relative", padding: "20px 12px", borderRadius: 16, cursor: "pointer",
              background: active ? "linear-gradient(135deg,rgba(245,196,81,.18),rgba(255,179,71,.05))" : "#111",
              border: active ? `1.5px solid ${GOLD}` : "1.5px solid #1e1e1e",
              transition: "all .15s", textAlign: "center",
            }}>
              {p.popular && (
                <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, letterSpacing: .8, textTransform: "uppercase", color: "#0D0D0D", background: GOLD, borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>popular</span>
              )}
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, lineHeight: 1, color: active ? GOLD : "#888", letterSpacing: 1 }}>{p.flakes} ✨</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? "#F2F0FF" : "#444", marginTop: 6 }}>${p.usd}</div>
            </button>
          );
        })}
      </div>

      <button className="cta-btn" style={{ background: `linear-gradient(135deg,${GOLD},#ff9f43)`, color: "#1a1200" }} onClick={() => onPurchase(sel.flakes, sel.usd)}>
        {ctaLabel} for ${sel.usd}
      </button>

      {onSkip && (
        <button onClick={onSkip} style={{ width: "100%", background: "none", border: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 6, padding: "12px 0" }}>
          {skipLabel ?? "maybe later"}
        </button>
      )}
    </div>
  );
}
