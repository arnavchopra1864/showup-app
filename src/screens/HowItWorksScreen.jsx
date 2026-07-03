import { Shell } from "../components/Shell";
import { Header } from "../components/Header";

const HOW_IT_WORKS = [
  { emoji: "✨", title: "flakes are the currency", body: "buy a stack of gold flakes. you put those on the line instead of cash." },
  { emoji: "🤝", title: "stake them to lock in", body: "everyone drops flakes into the pot to RSVP. actually show up and you get every one of yours back." },
  { emoji: "🪦", title: "flakers pay the rest", body: "bail and your flakes get split between the people who showed. being reliable pays off." },
];

export function HowItWorksScreen({ nav }) {
  return (
    <Shell animClass="slide-in-right">
      <Header eyebrow="the deal" title="how it" outline="works" onBack={nav.pop} />
      <div style={{ padding: "24px 24px 80px" }}>
        {HOW_IT_WORKS.map((s, i) => {
          const last = i === HOW_IT_WORKS.length - 1;
          return (
            <div key={i} className="fade-up" style={{ display: "flex", gap: 16, animationDelay: `${0.1 + i * 0.15}s` }}>
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
    </Shell>
  );
}
