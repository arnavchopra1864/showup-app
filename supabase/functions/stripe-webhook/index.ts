// Stripe webhook: credits the ledger when a Checkout payment completes.
// This is the ONLY money-in path — the client never credits itself.
//
// Stripe can't send a Supabase JWT, so deploy with JWT verification off:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Point a Stripe webhook endpoint (event: checkout.session.completed) at
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (from the endpoint's signing secret).
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      req.headers.get("stripe-signature")!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    return new Response(`invalid signature: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { user_id, usd, flakes } = session.metadata ?? {};
    if (!user_id || !flakes) return new Response("missing metadata", { status: 400 });

    // Stripe retries deliveries — both writes are idempotent on the session id.
    const { error: payErr } = await admin.from("payments").upsert({
      user_id,
      provider: "stripe",
      provider_ref: session.id,
      usd_amount: Number(usd),
      flakes: Number(flakes),
      status: "succeeded",
    }, { onConflict: "provider_ref", ignoreDuplicates: true });
    if (payErr) return new Response(payErr.message, { status: 500 });

    const { error: ledgerErr } = await admin.from("ledger_entries").upsert({
      user_id,
      kind: "purchase",
      bucket: "cash",
      amount: Number(flakes),
      idempotency_key: `topup:${session.id}`,
    }, { onConflict: "idempotency_key", ignoreDuplicates: true });
    if (ledgerErr) return new Response(ledgerErr.message, { status: 500 });
  }

  return new Response("ok");
});
