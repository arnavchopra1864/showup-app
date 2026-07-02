import { useState } from "react";
import { Shell } from "../components/Shell";
import { Header } from "../components/Header";
import { FlakeShop } from "../components/FlakeShop";
import { gf } from "../lib/currency";

export function BuyScreen({ nav, balance = 0, addFlakes }) {
  const [added, setAdded] = useState(0);

  const buy = (flakes) => {
    addFlakes?.(flakes);
    setAdded(flakes);
    setTimeout(() => nav.pop(), 900);
  };

  return (
    <Shell>
      <Header eyebrow="gold flakes" title="your" outline="wallet" onBack={nav.pop} />
      <div style={{ padding: "24px 20px 80px" }}>
        <div style={{ background: "linear-gradient(135deg,rgba(245,196,81,.14),rgba(255,179,71,.04))", border: "1px solid rgba(245,196,81,.3)", borderRadius: 16, padding: "16px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9c8a55", letterSpacing: 1, textTransform: "uppercase" }}>your balance</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, color: "#F5C451", lineHeight: 1 }}>{gf(balance)}</div>
        </div>

        {added > 0 ? (
          <div className="pop-in" style={{ textAlign: "center", padding: "32px 20px", background: "linear-gradient(135deg,rgba(245,196,81,.14),rgba(255,179,71,.04))", border: "1px solid rgba(245,196,81,.3)", borderRadius: 18 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✨</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, color: "#F5C451", lineHeight: 1 }}>+{gf(added)}</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>added to your wallet</div>
          </div>
        ) : (
          <FlakeShop onPurchase={buy} ctaLabel="buy gold flakes" />
        )}

        <button onClick={() => nav.push("howitworks")} style={{ width: "100%", marginTop: 16, padding: "13px 16px", borderRadius: 14, cursor: "pointer", background: "transparent", border: "1.5px solid #1e1e1e", color: "#444", fontSize: 13, fontWeight: 700, textAlign: "left" }}>
          ✨ how it works
        </button>

        <div style={{ marginTop: 24, borderTop: "1px solid #1a1a1a", paddingTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#333", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>cash out</div>
          <div style={{ fontSize: 13, color: "#444", marginBottom: 16, lineHeight: 1.5 }}>convert your flakes back to real money. coming soon.</div>
          <button disabled style={{ width: "100%", padding: "16px", borderRadius: 14, cursor: "not-allowed", background: "transparent", border: "1.5px solid #1e1e1e", color: "#333", fontSize: 14, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", opacity: .5 }}>
            cash out {gf(balance)}
          </button>
        </div>
      </div>
    </Shell>
  );
}
