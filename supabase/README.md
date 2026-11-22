# LOCZ Supabase order backend

The static GitHub Pages website uses a public Supabase project URL/key to invoke an Edge Function. The function validates orders, calls restricted Postgres RPC functions to create/claim an idempotent order, and sends the owner notification through Brevo. Supabase's service-role key and Brevo API key remain server-side.

## One-time project setup

1. In Supabase, create or select the LOCZ project. Copy its **Project URL** and **anon/publishable key** into `supabase-config.js`. Those are public browser settings; do not use the service-role/secret key there.
2. In Brevo, activate Transactional Email, create a sender using `loczqatar@gmail.com`, and complete the verification code sent to that mailbox. Generate a Brevo API key. A sender using a free email provider may be rewritten to a Brevo address; confirm the actual sender in a live test email.
3. Install Node.js and the Supabase CLI. From the repository root, sign in and link the project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Apply the Postgres schema and restricted order RPC functions:

   ```powershell
   npx supabase db push --remote --yes
   ```

5. In **Supabase → Edge Functions → Secrets**, set:

   - `BREVO_API_KEY` — Brevo API key.
   - `LOCZ_FROM_EMAIL` — `loczqatar@gmail.com`, after Brevo verifies it as a sender.
   - `LOCZ_FROM_NAME` — `LOCZ Orders`.
   - `LOCZ_NOTIFICATION_EMAIL` — `loczqatar@gmail.com`.
   - `ALLOWED_ORIGINS` — `https://matrix10102.github.io,https://loczqatar.dpdns.org` (keep only site origins LOCZ uses).

   Supabase injects `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions. Never copy the service-role key or Brevo key into website code or chat.

6. Deploy the function:

   ```powershell
   npx supabase functions deploy create-order --remote=YOUR_PROJECT_REF --yes
   ```

7. Deploy the static website to GitHub Pages. The frontend remains unavailable for online submission until `supabase-config.js` has the project URL/key and the Edge Function is deployed. It will not display an order-success state while that configuration is missing.

## Email and order behavior

- The function accepts only the server-listed available product (Carpet Cleaning), validates all customer details and quantities, and ignores client-supplied product names/prices.
- Supabase Postgres stores an order reference, payload hash, and email-send state. A database function serializes retries and prevents the same checkout idempotency key from creating duplicate notices. Brevo receives an order-stable idempotency key too.
- On provider failure, the Edge Function marks the order retryable and the checkout shows an error/retry control. On success, the browser shows the order reference and LOCZ contact numbers; WhatsApp is optional.
- No prices or totals are included because LOCZ has not provided them.

## Local checks

```powershell
node --test supabase/functions/_shared/order.test.mjs supabase/functions/create-order/handler.test.mjs
node --check shop.js
node --check supabase/functions/create-order/handler.mjs
```

These tests mock Supabase and Brevo. They do not prove live delivery. Complete a real order with the deployed project and verify the email arrives at `loczqatar@gmail.com` before calling the feature live.
