import { useState, useEffect } from "react";
import { useRouter } from "./hooks/useRouter";
import { USER } from "./data/mockData";
import { GLOBAL_STYLES } from "./styles/globalStyles";
import { HomeScreen } from "./screens/HomeScreen";
import { EventScreen } from "./screens/EventScreen";
import { CreateScreen } from "./screens/CreateScreen";
import { CheckinScreen } from "./screens/CheckinScreen";
import { PayoutScreen } from "./screens/PayoutScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { BuyScreen } from "./screens/BuyScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { HowItWorksScreen } from "./screens/HowItWorksScreen";
import { getProfile } from "./lib/auth";
import { fetchWalletBalance, fetchMyEvents } from "./lib/events";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const LS_PENDING = "showup_pendingEventId";

export default function App() {
  const nav = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading]     = useState(isSupabaseConfigured);
  const [onboarded, setOnboarded] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [account, setAccount]   = useState({ id: null, name: USER.name, handle: USER.handle, avatar: USER.avatar });
  const [goldFlakes, setGoldFlakes] = useState(0);

  // Capture ?event=id from URL; also survives OAuth redirect via localStorage
  const [pendingEventId, setPendingEventId] = useState(() => {
    const urlId = new URLSearchParams(window.location.search).get("event");
    const id    = urlId || localStorage.getItem(LS_PENDING);
    if (id) {
      window.history.replaceState({}, "", window.location.pathname);
      localStorage.setItem(LS_PENDING, id); // persist across OAuth navigation
    }
    return id ?? null;
  });

  const clearPending = () => {
    localStorage.removeItem(LS_PENDING);
    setPendingEventId(null);
  };

  // Once onboarded, navigate to the pending event (if any)
  useEffect(() => {
    if (onboarded && pendingEventId) {
      clearPending();
      nav.push("event", { eventId: pendingEventId });
    }
  }, [onboarded, pendingEventId]);

  const refreshBalance = async () => {
    const { total } = await fetchWalletBalance();
    setGoldFlakes(total);
  };

  const refreshEvents = async (userId) => {
    const { events: fresh } = await fetchMyEvents(userId);
    if (fresh != null) setEvents(fresh);
  };

  // Returning user: session + profile → skip onboarding, load real balance
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setHasSession(true);
        const { profile } = await getProfile();
        if (profile) {
          setAccount({ id: session.user.id, name: profile.name, handle: `@${profile.handle}`, avatar: profile.avatar });
          const { total } = await fetchWalletBalance();
          setGoldFlakes(total);
          await refreshEvents(session.user.id);
          setOnboarded(true);
        }
      }
      setLoading(false);
    });
  }, []);

  const addFlakes   = (n) => setGoldFlakes(b => b + n);
  const spendFlakes = (n) => setGoldFlakes(b => Math.max(0, b - n));

  const handleSignOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setOnboarded(false);
    nav.resetTo("home");
  };

  const handleOnboarded = async ({ name, handle, avatar, purchased }) => {
    let userId = null;
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      const { total } = await fetchWalletBalance();
      setGoldFlakes(total);
    } else {
      setGoldFlakes(purchased + 100);
    }
    setAccount({ id: userId, name, handle, avatar });
    if (userId) await refreshEvents(userId);
    setOnboarded(true); // triggers the pendingEventId effect above
  };

  const handleEventCreated = async () => {
    // CreateScreen already saved to Supabase — just re-fetch the list
    if (account.id) await refreshEvents(account.id);
  };

  const { screen, params } = nav.current;

  if (loading) return <div style={{ background: "#0D0D0D", height: "100vh" }} />;

  // Show event public view only when there's genuinely no session yet.
  // If hasSession is true, the user came back from OAuth and needs to finish
  // onboarding (profile setup) — OnboardingScreen handles that path.
  if (!onboarded && pendingEventId && !hasSession) {
    return (
      <div style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#0D0D0D" }}>
        <style>{GLOBAL_STYLES}</style>
        <EventScreen
          eventId={pendingEventId}
          nav={{ pop: clearPending, push: nav.push }}
          userId={null}
          balance={0}
          refreshBalance={() => {}}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#0D0D0D" }}>
      <style>{GLOBAL_STYLES}</style>
      {!onboarded ? (
        <OnboardingScreen onComplete={handleOnboarded} />
      ) : (
        <>
          {screen === "home"       && <HomeScreen       events={events} nav={nav} user={account} balance={goldFlakes} />}
          {screen === "event"      && <EventScreen      event={params.event} eventId={params.eventId} nav={nav} userId={account.id} balance={goldFlakes} spendFlakes={spendFlakes} refreshBalance={refreshBalance} refreshEvents={() => refreshEvents(account.id)} />}
          {screen === "create"     && <CreateScreen     nav={nav} onEventCreated={handleEventCreated} balance={goldFlakes} />}
          {screen === "checkin"    && <CheckinScreen    event={params.event} eventId={params.eventId} nav={nav} userId={account.id} refreshBalance={refreshBalance} refreshEvents={() => refreshEvents(account.id)} />}
          {screen === "payout"     && <PayoutScreen     event={params.event} eventId={params.eventId} nav={nav} userId={account.id} refreshBalance={refreshBalance} />}
          {screen === "profile"    && <ProfileScreen    nav={nav} user={account} balance={goldFlakes} onSignOut={handleSignOut} />}
          {screen === "buy"        && <BuyScreen        nav={nav} balance={goldFlakes} addFlakes={addFlakes} />}
          {screen === "howitworks" && <HowItWorksScreen nav={nav} />}
        </>
      )}
    </div>
  );
}
