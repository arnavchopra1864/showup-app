-- Stripe integration.
-- Money-in: Checkout Sessions created by the create-checkout edge function;
-- the stripe-webhook function (service role) writes payments + ledger rows.
-- Money-out: Stripe Connect Express — each user onboards once via the
-- connect-onboard function, then the cash-out function debits the ledger and
-- sends a Stripe transfer. The client never writes money rows directly.
alter table profiles add column if not exists stripe_account_id text;
