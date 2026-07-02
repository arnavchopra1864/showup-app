import { useState } from "react";
import { Shell } from "../../components/Shell";
import { Header } from "../../components/Header";
import { StepDots } from "./StepDots";
import { gf } from "../../lib/currency";
import { STAKE_OPTIONS, TIME_CHIPS, STEPS, CONF_OPTS } from "./createScreenConstants";
import { createEvent } from "../../lib/events";

export function CreateScreen({ nav, onEventCreated, balance = Infinity }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", date: "", time: "", customTime: false,
    location: "", stake: 50, confirmation: ["qr"],
    maxGuests: "", description: "",
  });
  const [done,      setDone]      = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [createdId, setCreatedId] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canAdvance = [
    form.name.trim().length > 0,
    !!(form.date && form.location),
    form.stake > 0,
    true,
  ][step];

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      if (balance < form.stake) { nav.push("buy"); return; }
      setSaving(true);
      const res = await createEvent(form);
      setSaving(false);
      const realId = res.ok && !res.mock ? res.event?.id : null;
      setCreatedId(realId);
      onEventCreated(form);
      setDone(true);
    }
  };

  const eventLink = createdId
    ? `${window.location.origin}?event=${createdId}`
    : `${window.location.origin}?event=preview`;
  const confLabels = form.confirmation.map(c => CONF_OPTS.find(o => o.id === c)?.label).filter(Boolean);

  const fieldLabel = { fontSize: 12, fontWeight: 800, color: "#888", letterSpacing: .5, marginBottom: 10, textTransform: "uppercase" };

  if (done) return (
    <Shell>
      <Header title="it's" outline="alive" onBack={() => nav.resetTo("home")} />
      <div style={{ padding: "24px 20px 80px" }}>
        {/* Event details */}
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "16px 18px", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#F2F0FF", lineHeight: 1, marginBottom: 12 }}>{form.name || "Untitled"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              form.date && { icon: "📅", text: [form.date, form.time].filter(Boolean).join(" · ") },
              form.location && { icon: "📍", text: form.location },
              { icon: "💸", text: `${gf(form.stake)} stake per person` },
            ].filter(Boolean).map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555" }}>
                <span style={{ width: 18, textAlign: "center" }}>{row.icon}</span><span>{row.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fire + send it */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔥</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 40, color: "#F2F0FF", lineHeight: 1, marginBottom: 6 }}>send it</div>
          <div style={{ fontSize: 13, color: "#444" }}>before people cook up excuses</div>
        </div>

        {/* Actions */}
        <button
          className="cta-btn"
          style={{ marginBottom: 10, background: copied ? "linear-gradient(135deg,#1a3a1a,#0f2a0f)" : undefined, color: copied ? "#4ade80" : undefined, border: copied ? "1.5px solid #4ade80" : undefined }}
          onClick={() => { navigator.clipboard?.writeText(eventLink); setCopied(true); setTimeout(() => setCopied(false), 2200); }}
        >
          {copied ? "✓ link copied" : "copy link"}
        </button>
        <button className="cta-btn" style={{ background: "#111", border: "1.5px solid #1e1e1e", color: "#666" }}>
          💬 drop it in the group chat
        </button>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <Header title="make em" outline="commit" onBack={nav.pop} />
      <div style={{ padding: "28px 20px 80px" }}>
        <StepDots step={step} />

        {/* Preview pill shown from step 1+ */}
        {step >= 1 && form.name && (
          <div style={{ background: "linear-gradient(135deg,#12082a,#1a0a1e)", border: "1.5px solid rgba(123,47,255,.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#444", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>preview</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: "#F2F0FF", lineHeight: .95, marginBottom: 8 }}>{form.name}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {form.date && <span style={{ fontSize: 11, color: "#888", background: "#1e1e1e", padding: "3px 10px", borderRadius: 20 }}>📅 {[form.date, form.time].filter(Boolean).join(" · ")}</span>}
              {form.location && <span style={{ fontSize: 11, color: "#888", background: "#1e1e1e", padding: "3px 10px", borderRadius: 20 }}>📍 {form.location}</span>}
              {form.stake && <span style={{ fontSize: 11, color: "#a78bfa", background: "rgba(123,47,255,.12)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(123,47,255,.25)" }}>💸 {gf(form.stake)} pot</span>}
            </div>
          </div>
        )}

        {step === 0 && (
          <div className="fade-up">
            <div style={fieldLabel}>what are we calling this?</div>
            <input className="field-input" placeholder="Rooftop pre-game, beach day..." value={form.name} onChange={e => set("name", e.target.value)} maxLength={40} autoFocus style={{ marginBottom: 28 }} />
            <div style={fieldLabel}>who's this for?</div>
            <input className="field-input" placeholder="the boys, the book club..." value={form.maxGuests} onChange={e => set("maxGuests", e.target.value)} style={{ marginBottom: 28 }} />
            <div style={fieldLabel}>anything else they should know?</div>
            <textarea className="field-input" placeholder="bring a jacket, it's byob..." value={form.description} onChange={e => set("description", e.target.value)} rows={3} style={{ resize: "none", lineHeight: 1.5 }} />
          </div>
        )}

        {step === 1 && (
          <div className="fade-up">
            <div style={fieldLabel}>when?</div>
            <input className="field-input" type="date" value={form.date} min={new Date().toISOString().split("T")[0]} onChange={e => set("date", e.target.value)} style={{ marginBottom: 20 }} />
            <div style={fieldLabel}>what time?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: form.customTime ? 10 : 28 }}>
              {TIME_CHIPS.map(t => (
                <button key={t} onClick={() => { set("time", t); set("customTime", false); }} style={{ padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, background: form.time === t && !form.customTime ? "rgba(123,47,255,.2)" : "#111", border: form.time === t && !form.customTime ? "1.5px solid #7B2FFF" : "1.5px solid #1e1e1e", color: form.time === t && !form.customTime ? "#c4b5fd" : "#444", transition: "all .15s" }}>{t}</button>
              ))}
              <button onClick={() => { set("customTime", true); set("time", ""); }} style={{ padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, background: form.customTime ? "rgba(123,47,255,.2)" : "#111", border: form.customTime ? "1.5px solid #7B2FFF" : "1.5px solid #1e1e1e", color: form.customTime ? "#c4b5fd" : "#444" }}>custom</button>
            </div>
            {form.customTime && <input className="field-input" type="time" value={form.time} onChange={e => set("time", e.target.value)} autoFocus style={{ marginBottom: 28 }} />}
            <div style={fieldLabel}>where at?</div>
            <input className="field-input" placeholder="Lustre Pearl, someone's backyard..." value={form.location} onChange={e => set("location", e.target.value)} style={{ marginBottom: 28 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 13, background: "rgba(123,47,255,.1)", border: "1.5px solid #7B2FFF" }}>
              <span style={{ fontSize: 20 }}>🔲</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F2F0FF" }}>QR scan</div>
                <div style={{ fontSize: 11, color: "#555" }}>host shows a rotating code — guests scan to check in</div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-up">
            <div style={fieldLabel}>set the stakes</div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 12 }}>everyone chips in Gold Flakes ✨. show up to win them back.</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {STAKE_OPTIONS.map(amt => (
                <button key={amt} onClick={() => set("stake", amt)} style={{ flex: 1, padding: "18px 0", borderRadius: 14, cursor: "pointer", fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 1, background: form.stake === amt ? "linear-gradient(135deg,#7B2FFF,#FF2D78)" : "#111", color: form.stake === amt ? "#fff" : "#333", border: form.stake === amt ? "none" : "1.5px solid #1e1e1e", transition: "all .15s" }}>{gf(amt)}</button>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid #1e1e1e", fontSize: 12, color: "#555", marginBottom: 28 }}>
              {form.stake === 20  && "😌 casual. flakers won't even flinch."}
              {form.stake === 50  && "🎯 the sweet spot. stings just enough."}
              {form.stake === 100 && "😤 you're serious. flakers will hear about this."}
              {form.stake === 200 && "💀 high stakes. may cause group chat drama."}
            </div>
            <div style={fieldLabel}>where does the pot go?</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { id: "split", label: "Split among showups 💸", desc: "flakers fund the loyal" },
                { id: "round", label: "Buy a round 🍻",         desc: "pool goes toward the tab" },
              ].map(opt => (
                <div key={opt.id} style={{ flex: 1, padding: "14px 12px", borderRadius: 14, background: "#111", border: "1.5px solid #1e1e1e", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: "#333" }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fade-up">
            <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 24 }}>looks good. once you send it, people can pay in and the pot starts building.</div>
            {balance < form.stake && (
              <div style={{ background: "rgba(255,45,120,.08)", border: "1px solid rgba(255,45,120,.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#FF2D78", fontWeight: 600 }}>
                you've got {gf(balance)} — need {gf(form.stake)} to host this event. top up first.
              </div>
            )}
            <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
              {[
                { icon: "🎉", label: "event",  value: form.name || "Untitled" },
                form.date && { icon: "📅", label: "when",  value: [form.date, form.time].filter(Boolean).join(" · ") },
                form.location && { icon: "📍", label: "where", value: form.location },
                { icon: "💸", label: "stake",  value: `${gf(form.stake)} per person` },
                confLabels.length > 0 && { icon: "✅", label: "proof",  value: confLabels.join(" + ") },
              ].filter(Boolean).map((row, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < arr.length - 1 ? "1px solid #1a1a1a" : "none" }}>
                  <span style={{ width: 22, textAlign: "center", fontSize: 16 }}>{row.icon}</span>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: .8, width: 36 }}>{row.label}</div>
                  <div style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 600, flex: 1 }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: "18px 20px", border: "1.5px solid #222", borderRadius: 16, background: "none", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>back</button>
          )}
          {step === STEPS.length - 1 && balance < form.stake ? (
            <button className="cta-btn" style={{ flex: 1, background: "linear-gradient(135deg,#F5C451,#ff9f43)", color: "#1a1200" }} onClick={() => nav.push("buy")}>
              add gold flakes ✨
            </button>
          ) : (
            <button className={`cta-btn${!canAdvance || saving ? " disabled" : ""}`} style={{ flex: 1 }} onClick={canAdvance && !saving ? next : undefined}>
              {saving ? "creating…" : step === STEPS.length - 1 ? "create event" : "next"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
