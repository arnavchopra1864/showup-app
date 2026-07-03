// Creates (at most once) a Stripe Connect Express account for the caller and
// returns an onboarding link — users complete it to receive cash-out payouts.
//
// Secrets: STRIPE_SECRET_KEY, APP_URL.
// Deploy:  supabase functions deploy connect-onboard
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "not signed in" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: profile } = await admin
    .from("profiles").select("stripe_account_id").eq("id", user.id).single();

  let accountId = profile?.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express", metadata: { user_id: user.id } });
    accountId = account.id;
    const { error } = await admin
      .from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
    if (error) return json({ error: error.message }, 500);
  }

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/?checkout=payouts-refresh`,
    return_url: `${appUrl}/?checkout=payouts-done`,
    type: "account_onboarding",
  });

  return json({ url: link.url });
});
