// Creates a Stripe Checkout Session for a Gold Flake pack and returns its URL.
// The client redirects there; Stripe hosts the card form. Flakes are credited
// only when the stripe-webhook function sees the payment complete.
//
// Secrets: STRIPE_SECRET_KEY, APP_URL (where Checkout redirects back to).
// Deploy:  supabase functions deploy create-checkout
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// Server-side copy of FLAKE_PACKS — never trust a client-sent flake amount.
const PACK_FLAKES: Record<number, number> = { 5: 50, 10: 100, 20: 200, 50: 500 };

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

  const { usd } = await req.json();
  const flakes = PACK_FLAKES[usd];
  if (!flakes) return json({ error: "invalid pack" }, 400);

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: usd * 100,
        product_data: { name: `${flakes} Gold Flakes ✨` },
      },
    }],
    metadata: { user_id: user.id, usd: String(usd), flakes: String(flakes) },
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancel`,
  });

  return json({ url: session.url });
});
