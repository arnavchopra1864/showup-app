import { useState, useEffect } from "react";
import { useRouter } from "./hooks/useRouter";
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
import { getProfile, deleteAccount } from "./lib/auth";
import { fetchWalletBalance, fetchMyEvents, runCheckin, routeCheckin } from "./lib/events";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const LS_PENDING = "showup_pendingEventId";
const LS_PENDING_CHECKIN = "showup_pendingCheckin";

export default function App() {
  const nav = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading]     = useState(isSupabaseConfigured);
  const [onboarded, setOnboarded] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [account, setAccount]   = useState({ id: null, name: "", handle: "", avatar: "" });
  const [goldFlakes, setGoldFlakes] = useState(0);

  // Capture ?event=id (+ optional ?checkin=token from a QR scan) from the URL;
  // both survive the OAuth redirect via localStorage. Read + clear the search
  // in this one initializer (runs before the checkout initializer below).
  const [pendingEventId, setPendingEventId] = useState(() => {
    const params  = new URLSearchParams(window.location.search);
    const urlId   = params.get("event");
    const urlTok  = params.get("checkin");
    const id      = urlId || localStorage.getItem(LS_PENDING);
    if (id)     localStorage.setItem(LS_PENDING, id); // persist across OAuth navigation
    if (urlTok) localStorage.setItem(LS_PENDING_CHECKIN, urlTok);
    if (urlId || urlTok) window.history.replaceState({}, "", window.location.pathname);
    return id ?? null;
  });

  // Check-in token from a scanned QR (?checkin=…), stashed alongside the event id.
  const [pendingCheckin, setPendingCheckin] = useState(() => localStorage.getItem(LS_PENDING_CHECKIN));

  // Capture ?checkout=… from Stripe redirects (Checkout + Connect onboarding)
  const [checkoutStatus, setCheckoutStatus] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("checkout");
    if (status) window.history.replaceState({}, "", window.location.pathname);
    return status;
  });

  // Back from Stripe: land the user on the wallet screen with the result
  useEffect(() => {
    if (onboarded && checkoutStatus) {
      setCheckoutStatus(null);
      nav.push("buy", { checkout: checkoutStatus });
    }
  }, [onboarded, checkoutStatus]);

  const clearPending = () => {
    localStorage.removeItem(LS_PENDING);
    localStorage.removeItem(LS_PENDING_CHECKIN);
    setPendingEventId(null);
    setPendingCheckin(null);
  };

  // Once onboarded, act on the pending deep-link: if it carried a check-in
  // token (QR scan), run the check-in and land on a clear result; otherwise
  // just open the event. A signed-in friend scanning the QR flows straight
  // through here without bouncing back to onboarding.
  useEffect(() => {
    if (!onboarded || !pendingEventId) return;
    const eventId = pendingEventId;
    const token   = pendingCheckin;
    clearPending();
    if (!token) {
      nav.push("event", { eventId });
      return;
    }
    (async () => {
      // Shared with CheckinScreen's in-app scanner: success lands on "you're
      // in", not-a-participant routes to the event (rsvp first), expired/other
      // show the matching failure card — never a dead end.
      const result = await runCheckin(eventId, token);
      if (result.status === "success") {
        await Promise.allSettled([refreshBalance(), refreshEvents(account.id)]);
      }
      routeCheckin(nav, eventId, result);
    })();
  }, [onboarded, pendingEventId, pendingCheckin]);

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
        // getSession() only reads the cached token — a deleted account (e.g.
        // removed from another device) leaves a stale local session behind.
        // Validate server-side and purge it so onboarding starts fresh.
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!user && error?.status !== 0) {
          await supabase.auth.signOut({ scope: "local" });
          setLoading(false);
          return;
        }
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

  const handleDeleteAccount = async () => {
    const res = await deleteAccount();
    if (!res.ok) return res;
    setAccount({ id: null, name: "", handle: "", avatar: "" });
    setGoldFlakes(0);
    setEvents([]);
    setHasSession(false);
    setOnboarded(false);
    nav.resetTo("home");
    return res;
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
          {screen === "event"      && <EventScreen      event={params.event} eventId={params.eventId} nav={nav} userId={account.id} balance={goldFlakes} spendFlakes={spendFlakes} refreshBalance={refreshBalance} refreshEvents={() => refreshEvents(account.id)} notice={params.notice} />}
          {screen === "create"     && <CreateScreen     nav={nav} onEventCreated={handleEventCreated} balance={goldFlakes} />}
          {screen === "checkin"    && <CheckinScreen    event={params.event} eventId={params.eventId} nav={nav} userId={account.id} refreshBalance={refreshBalance} refreshEvents={() => refreshEvents(account.id)} checkinResult={params.checkinResult} />}
          {screen === "payout"     && <PayoutScreen     event={params.event} eventId={params.eventId} nav={nav} userId={account.id} refreshBalance={refreshBalance} />}
          {screen === "profile"    && <ProfileScreen    nav={nav} user={account} balance={goldFlakes} onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} />}
          {screen === "buy"        && <BuyScreen        nav={nav} balance={goldFlakes} addFlakes={addFlakes} refreshBalance={refreshBalance} checkout={params.checkout} />}
          {screen === "howitworks" && <HowItWorksScreen nav={nav} />}
        </>
      )}
    </div>
  );
}
