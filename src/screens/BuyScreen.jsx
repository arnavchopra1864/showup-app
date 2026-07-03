import { useState, useEffect } from "react";
import { Shell } from "../components/Shell";
import { Header } from "../components/Header";
import { FlakeShop } from "../components/FlakeShop";
import { gf } from "../lib/currency";
import { WELCOME_BONUS } from "../lib/flakes";
import { createCheckout } from "../lib/wallet";
import { isSupabaseConfigured } from "../lib/supabase";

// `checkout` comes from the ?checkout= redirect param Stripe sends us back
// with: success | cancel
export function BuyScreen({ nav, balance = 0, addFlakes, refreshBalance, checkout }) {
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(() =>
    checkout === "success" ? { color: "#4ade80", text: "payment received ✨" } :
    checkout === "cancel" ? { color: "#888", text: "checkout canceled" } :
    null
  );

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(t);
  }, [banner]);

  // Back from a successful Checkout: the webhook credits the ledger a moment
  // after the redirect, so poll the balance until it lands.
  useEffect(() => {
    if (checkout !== "success" || !isSupabaseConfigured) return;
    let tries = 0;
    const timer = setInterval(async () => {
      await refreshBalance?.();
      if (++tries >= 5) clearInterval(timer);
    }, 1500);
    return () => clearInterval(timer);
  }, [checkout]);

  const buy = async (flakes, usd) => {
    if (busy) return;
    if (!isSupabaseConfigured) {
      addFlakes?.(flakes);
      setAdded(flakes);
      setTimeout(() => nav.pop(), 900);
      return;
    }
    setBusy(true); setError("");
    const res = await createCheckout(usd);
    if (!res.ok) { setError(res.error || "couldn't start checkout"); setBusy(false); return; }
    window.location.assign(res.url); // off to Stripe's hosted card form
  };

  return (
    <Shell>
      <Header eyebrow="gold flakes" title="your" outline="wallet" onBack={nav.pop} />
      <div style={{ padding: "24px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginBottom: 24 }}>
          <button onClick={() => nav.push("howitworks")} style={{ padding: "7px 11px", borderRadius: 10, cursor: "pointer", background: "transparent", border: "1.5px solid #1e1e1e", color: "#555", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
            ✨ how it works
          </button>
          <div style={{ width: "50%", background: "linear-gradient(135deg,rgba(245,196,81,.14),rgba(255,179,71,.04))", border: "1px solid rgba(245,196,81,.3)", borderRadius: 16, padding: "14px 16px", textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9c8a55", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>your balance</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, color: "#F5C451", lineHeight: 1 }}>{gf(balance)}</div>
          </div>
        </div>

        {banner && (
          <div className="pop-in" style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: banner.color, border: `1px solid ${banner.color}33`, background: `${banner.color}11`, borderRadius: 10, padding: "7px 12px", marginBottom: 16 }}>
            {banner.text}
          </div>
        )}

        {added > 0 ? (
          <div className="pop-in" style={{ textAlign: "center", padding: "32px 20px", background: "linear-gradient(135deg,rgba(245,196,81,.14),rgba(255,179,71,.04))", border: "1px solid rgba(245,196,81,.3)", borderRadius: 18 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✨</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, color: "#F5C451", lineHeight: 1 }}>+{gf(added)}</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>added to your wallet</div>
          </div>
        ) : (
          <FlakeShop onPurchase={buy} ctaLabel={busy ? "opening checkout..." : "buy gold flakes"} />
        )}

        {error && <div style={{ fontSize: 13, color: "#FF2D78", marginTop: 14, fontWeight: 600 }}>{error}</div>}

        <div style={{ marginTop: 24, borderTop: "1px solid #1a1a1a", paddingTop: 24 }}>
          <div style={{ fontSize: 13, color: "#444", marginBottom: 12, lineHeight: 1.5 }}>
            your free {WELCOME_BONUS} welcome flakes won't be cashable.
          </div>
          <button disabled style={{ width: "100%", padding: "16px", borderRadius: 14, cursor: "default", background: "transparent", border: "1.5px solid #2a2a2a", color: "#555", fontSize: 14, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", opacity: .7 }}>
            coming later
          </button>
        </div>
      </div>
    </Shell>
  );
}
