import { supabase, isSupabaseConfigured } from "./supabase";

// Money-in: Stripe Checkout via the create-checkout edge function (the
// stripe-webhook function credits the ledger when payment lands).
// Money-out: Stripe Connect transfers via the cash-out function.
// The client never writes money rows itself.

// supabase.functions.invoke buries the response body on non-2xx; dig the
// real error message out of it.
async function invokeFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error ?? msg; } catch { /* keep generic message */ }
    return { ok: false, error: msg };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, ...data };
}

// Returns { ok, url } — redirect the browser to url to pay.
export async function createCheckout(usd) {
  if (!isSupabaseConfigured) return { ok: false, error: "stripe needs supabase configured" };
  return invokeFn("create-checkout", { usd });
}

// Returns { ok, url } — redirect to url to complete Stripe Express onboarding.
export async function connectOnboard() {
  if (!isSupabaseConfigured) return { ok: false, error: "stripe needs supabase configured" };
  return invokeFn("connect-onboard", {});
}

// Returns { ok, usd } — debits the ledger and sends a Stripe transfer.
export async function cashOut(flakes) {
  if (!isSupabaseConfigured) return { ok: true, usd: flakes / 10 };
  return invokeFn("cash-out", { flakes });
}

// Full wallet including the cash/promo split (only cash is withdrawable).
export async function fetchWallet() {
  if (!isSupabaseConfigured) return { ok: true, cash: 0, promo: 0, total: 0 };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true, cash: 0, promo: 0, total: 0 };
  const { data, error } = await supabase
    .from("wallet_balances")
    .select("cash, promo, total")
    .eq("user_id", user.id)
    .single();
  if (error) return { ok: false, error: error.message, cash: 0, promo: 0, total: 0 };
  return { ok: true, cash: data?.cash ?? 0, promo: data?.promo ?? 0, total: data?.total ?? 0 };
}

// Whether the user has started Stripe Express onboarding for payouts.
export async function fetchPayoutAccount() {
  if (!isSupabaseConfigured) return { ok: true, connected: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true, connected: false };
  const { data } = await supabase
    .from("profiles").select("stripe_account_id").eq("id", user.id).single();
  return { ok: true, connected: !!data?.stripe_account_id };
}
