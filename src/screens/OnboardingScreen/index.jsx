import { useState, useEffect } from "react";
import { Shell } from "../../components/Shell";
import { FlakeShop } from "../../components/FlakeShop";
import { gf } from "../../lib/currency";
import { WELCOME_BONUS } from "../../lib/flakes";
import { signInWithGoogle, createProfile } from "../../lib/auth";
import { createCheckout } from "../../lib/wallet";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

const GOLD = "#F5C451";

const HOW_IT_WORKS = [
  { emoji: "✨", title: "flakes are the currency", body: "buy a stack of gold flakes. you put those on the line instead of cash." },
  { emoji: "🤝", title: "stake them to lock in", body: "everyone drops flakes into the pot to RSVP. actually show up and you get every one of yours back." },
  { emoji: "🪦", title: "flakers pay the rest", body: "bail and your flakes get split between the people who showed. being reliable pays off." },
];

const AUTH = 0;
const PROFILE = 1;
const HOW = 2;
const BUY = 3;
const WELCOME = 4;
const TOTAL_STEPS = 5;

const fieldLabel = { fontSize: 12, fontWeight: 800, color: "#888", letterSpacing: .5, marginBottom: 10, textTransform: "uppercase" };

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(AUTH);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [purchased, setPurchased] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const next = () => setStep(s => Math.min(s + 1, WELCOME));

  // Detect OAuth redirect returning — fires when Supabase processes the Google callback
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const advanceIfSignedIn = (session) => {
      if (!session) return;
      const googleName = session.user?.user_metadata?.full_name ?? "";
      if (googleName) setName(googleName);
      setStep(s => s === AUTH ? PROFILE : s);
    };

    supabase.auth.getSession().then(({ data: { session } }) => advanceIfSignedIn(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") advanceIfSignedIn(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogle = async () => {
    setBusy(true); setError("");
    const res = await signInWithGoogle();
    if (!res.ok) { setError(res.error || "couldn't open Google sign-in"); setBusy(false); }
    // on success the browser navigates away — no need to setBusy(false)
  };

  const saveProfile = async () => {
    setBusy(true); setError("");
    const res = await createProfile({ name: name.trim(), handle, avatar: initials(name) });
    setBusy(false);
    if (res.ok) { next(); } else { setError(res.error || "couldn't create your profile"); }
  };

  const finish = () => onComplete({
    name: name.trim(),
    handle: `@${handle.trim().replace(/^@+/, "")}`,
    avatar: initials(name),
    purchased,
  });

  const ProgressDots = () => (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{ width: i === step ? 22 : 6, height: 6, borderRadius: 6, background: i === step ? GOLD : i < step ? "rgba(245,196,81,.4)" : "#1e1e1e", transition: "all .25s" }} />
      ))}
    </div>
  );

  if (step === AUTH) {
    return (
      <Shell animClass="fade-up">
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "64px 24px 32px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 44, marginBottom: 18 }}>✨</div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(44px,13vw,60px)", lineHeight: .9, color: "#F2F0FF", margin: "0 0 6px", letterSpacing: 1 }}>
              welcome to<br /><span style={{ WebkitTextStroke: "2px #7B2FFF", color: "transparent" }}>showup</span>
            </h1>
          </div>
          {error && <div style={{ fontSize: 13, color: "#FF2D78", marginBottom: 16, fontWeight: 600 }}>{error}</div>}
          <button className={`cta-btn${busy ? " disabled" : ""}`} onClick={!busy ? handleGoogle : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <GoogleG />
            {busy ? "opening google..." : "continue with google"}
          </button>
          <ProgressDots />
        </div>
      </Shell>
    );
  }

  if (step === PROFILE) {
    const canAdvance = name.trim().length > 0 && handle.trim().replace(/^@+/, "").length > 0;
    return (
      <Shell animClass="slide-in-right">
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "64px 24px 32px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 44, marginBottom: 18 }}>👋</div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(40px,12vw,54px)", lineHeight: .9, color: "#F2F0FF", margin: "0 0 6px", letterSpacing: 1 }}>who are you?</h1>
            <p style={{ fontSize: 14, color: "#666", margin: "14px 0 36px", lineHeight: 1.5 }}>this is how friends find you and see if you actually show up.</p>

            <div style={fieldLabel}>your name</div>
            <input className="field-input" placeholder="Alex Carter" value={name} onChange={e => setName(e.target.value)} maxLength={30} autoFocus style={{ marginBottom: 24 }} />
            <div style={fieldLabel}>handle</div>
            <input className="field-input" placeholder="@alex" value={handle} onChange={e => setHandle(e.target.value)} maxLength={20} />

            {error && <div style={{ fontSize: 13, color: "#FF2D78", marginTop: 16, fontWeight: 600 }}>{error}</div>}
          </div>
          <button className={`cta-btn${!canAdvance || busy ? " disabled" : ""}`} onClick={canAdvance && !busy ? saveProfile : undefined}>{busy ? "creating..." : "create account"}</button>
          <ProgressDots />
        </div>
      </Shell>
    );
  }

  if (step === HOW) {
    return (
      <Shell animClass="slide-in-right">
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "64px 24px 32px" }}>
          <div style={{ flex: 1 }}>
            <h1 className="fade-up" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(40px,12vw,54px)", lineHeight: .9, color: "#F2F0FF", margin: "0 0 32px", letterSpacing: 1 }}>
              how it<br /><span style={{ WebkitTextStroke: "2px #7B2FFF", color: "transparent" }}>works</span>
            </h1>
            <div>
              {HOW_IT_WORKS.map((s, i) => {
                const last = i === HOW_IT_WORKS.length - 1;
                return (
                  <div key={i} className="fade-up" style={{ display: "flex", gap: 16, animationDelay: `${0.15 + i * 0.18}s` }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "rgba(123,47,255,.12)", border: "1.5px solid rgba(123,47,255,.4)" }}>{s.emoji}</div>
                      {!last && <div style={{ width: 2, flex: 1, minHeight: 26, background: "linear-gradient(#7B2FFF,rgba(123,47,255,.12))", margin: "4px 0" }} />}
                    </div>
                    <div style={{ paddingBottom: last ? 0 : 26, flex: 1, paddingTop: 8 }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: "#F2F0FF", letterSpacing: .5, lineHeight: 1, marginBottom: 8 }}>{s.title}</div>
                      <div style={{ fontSize: 14, color: "#777", lineHeight: 1.5 }}>{s.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button className="cta-btn" onClick={next}>makes sense</button>
          <ProgressDots />
        </div>
      </Shell>
    );
  }

  if (step === BUY) {
    return (
      <Shell animClass="slide-in-right">
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "64px 24px 32px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>💰</div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(38px,11vw,50px)", lineHeight: .92, color: "#F2F0FF", margin: "0 0 12px", letterSpacing: 1 }}>load up your wallet</h1>
            <p style={{ fontSize: 14, color: "#666", margin: "0 0 28px", lineHeight: 1.5 }}>we'll spot you 100 to start, too</p>
            {error && <div style={{ fontSize: 13, color: "#FF2D78", marginBottom: 16, fontWeight: 600 }}>{error}</div>}
            <FlakeShop
              ctaLabel={busy ? "opening checkout..." : "add to wallet"}
              onPurchase={async (flakes, usd) => {
                if (busy) return;
                // Mock mode keeps the local flow; with Supabase we hand off to
                // Stripe Checkout — the user comes back signed in + onboarded,
                // and the webhook credits the flakes.
                if (!isSupabaseConfigured) { setPurchased(p => p + flakes); next(); return; }
                setBusy(true); setError("");
                const res = await createCheckout(usd);
                if (!res.ok) { setError(res.error || "couldn't start checkout"); setBusy(false); return; }
                window.location.assign(res.url);
              }}
              onSkip={next}
              skipLabel="just give me the free flakes"
            />
          </div>
          <ProgressDots />
        </div>
      </Shell>
    );
  }

  const total = purchased + WELCOME_BONUS;
  return (
    <Shell animClass="fade-up">
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "64px 24px 32px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <div className="pop-in" style={{ fontSize: 64, marginBottom: 18 }}>🎁</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#9c8a55", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>welcome gift</div>
          <div className="pot-pulse" style={{ alignSelf: "center", background: "linear-gradient(135deg,rgba(245,196,81,.16),rgba(255,179,71,.05))", border: `1.5px solid ${GOLD}`, borderRadius: 24, padding: "28px 40px", marginBottom: 22 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 72, lineHeight: 1, color: GOLD, letterSpacing: 1 }}>+{gf(WELCOME_BONUS)}</div>
            <div style={{ fontSize: 13, color: "#9c8a55", marginTop: 4 }}>on the house 🎉</div>
          </div>
          <p style={{ fontSize: 15, color: "#888", margin: "0 0 6px", lineHeight: 1.5 }}>
            you're starting with <span style={{ color: GOLD, fontWeight: 700 }}>{gf(total)}</span>.
          </p>
          <p style={{ fontSize: 13, color: "#555", margin: 0 }}>enough to lock into your first few plans. now go make someone commit.</p>
        </div>
        <button className="cta-btn" onClick={finish}>enter showup</button>
        <ProgressDots />
      </div>
    </Shell>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
