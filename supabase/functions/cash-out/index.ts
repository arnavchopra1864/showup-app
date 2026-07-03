// Cash out withdrawable (cash-bucket) flakes: debits the ledger, then sends a
// Stripe transfer to the caller's Connect Express account. 10 flakes = $1,
// so cents = flakes × 10. Promo (welcome-bonus) flakes are stake-only.
//
// Secrets: STRIPE_SECRET_KEY.
// Deploy:  supabase functions deploy cash-out
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

  const { flakes } = await req.json();
  if (!Number.isInteger(flakes) || flakes <= 0) return json({ error: "invalid amount" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await admin
    .from("profiles").select("stripe_account_id").eq("id", user.id).single();
  if (!profile?.stripe_account_id) return json({ error: "set up payouts first" }, 400);

  const account = await stripe.accounts.retrieve(profile.stripe_account_id);
  if (!account.payouts_enabled) return json({ error: "finish payout setup with stripe first" }, 400);

  const { data: wallet } = await admin
    .from("wallet_balances").select("cash").eq("user_id", user.id).single();
  if ((wallet?.cash ?? 0) < flakes) return json({ error: "insufficient withdrawable flakes" }, 400);

  // Debit the ledger before moving money so a crash can't pay out twice;
  // if the transfer fails we remove the debit (the one place the append-only
  // ledger gets a compensating delete).
  const key = `cashout:${user.id}:${crypto.randomUUID()}`;
  const { error: debitErr } = await admin.from("ledger_entries").insert({
    user_id: user.id, kind: "withdrawal", bucket: "cash", amount: -flakes, idempotency_key: key,
  });
  if (debitErr) return json({ error: debitErr.message }, 500);

  try {
    await stripe.transfers.create({
      amount: flakes * 10,
      currency: "usd",
      destination: profile.stripe_account_id,
      metadata: { user_id: user.id, ledger_key: key },
    });
  } catch (err) {
    await admin.from("ledger_entries").delete().eq("idempotency_key", key);
    return json({ error: `transfer failed: ${(err as Error).message}` }, 500);
  }

  return json({ ok: true, usd: flakes / 10 });
});
