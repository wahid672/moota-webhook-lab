# Moota Webhook Testing Lab V1

A small Next.js 16 application for testing Moota Sandbox mutations and webhook delivery. Designed for deployment on Vercel with Supabase as the persistent database.

## V1 features

- Create local test transactions.
- Display pending and paid transactions.
- Create a dummy credit mutation in a Moota Sandbox bank account through the Moota API.
- Ask Moota to push the created mutation to the registered webhook when an ID is returned by the API.
- Receive Moota webhook POST requests at `/api/webhooks/moota`.
- Verify the `Signature` header using HMAC-SHA256 over the raw request body.
- Store webhook deliveries and mutations in Supabase.
- Deduplicate mutations by `mutation_id`.
- Match credit mutations to a pending transaction by order code in note/description; optionally match by amount if exactly one pending transaction has that amount.
- Protect the dashboard and application API with HTTP Basic Auth. The Moota webhook endpoint is excluded from Basic Auth and uses its own signature validation.

## 1. Create Supabase database

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. In Project Settings → API, copy the Project URL and `service_role` key. The service role key is secret and must never be prefixed with `NEXT_PUBLIC_`.

## 2. Prepare Moota Sandbox credentials

1. In Moota, identify the Sandbox bank account and copy its bank ID.
2. Create or copy a Personal API Token with the required mutation permissions.
3. Keep the API token private. The app uses it only on the server to create dummy Sandbox mutations.

Create the webhook after the first Vercel deployment so you already have a stable public endpoint URL.

## 3. Environment variables

Copy `.env.example` to `.env.local` for local development, or add these variables in Vercel → Project → Settings → Environment Variables.

Required for the dashboard and database:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LAB_DASHBOARD_USER`
- `LAB_DASHBOARD_PASSWORD`

For the in-app Sandbox mutation button:

- `MOOTA_API_TOKEN`
- `MOOTA_SANDBOX_BANK_ID`

Required to accept signed Moota webhook deliveries (add after creating the webhook in Moota):

- `MOOTA_WEBHOOK_SECRET`

Optional:

- `AUTO_MATCH_UNIQUE_AMOUNT=true` (enabled only when explicitly set to `true`). If enabled, one pending transaction may be matched by exact amount when no order code appears in the mutation note/description. For real payment workflows, prefer unique order references and consider disabling this fallback.

## 4. Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
# Fill in the environment variables
npm run dev
```

Open `http://localhost:3000`. The local dashboard does not require Basic Auth when both dashboard credentials are omitted. Keep the webhook secret configured if you want to test signed webhook deliveries.

## 5. Deploy to Vercel

1. Push this project to a private GitHub repository, or import the project directory into your preferred Git workflow.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Add the Supabase, dashboard Basic Auth, and Moota API environment variables. `MOOTA_WEBHOOK_SECRET` can be added after creating the webhook.
4. Deploy the project. The dashboard should now load; the webhook receiver will return 503 until its secret is configured.
5. Copy the production domain. In Moota → Integrasi → Webhook, create a webhook and select the Sandbox bank account and incoming/credit mutations.
6. Set the webhook URL to `https://YOUR-VERCEL-DOMAIN/api/webhooks/moota`. Copy the Secret Token generated/shown by Moota and add it to Vercel as `MOOTA_WEBHOOK_SECRET`.
7. Redeploy the Vercel project so the webhook secret is available to the server.

Moota's guide states that the webhook URL and Secret Token cannot be edited after creation. Double-check the endpoint before saving. The dashboard will prompt for the Basic Auth username and password. The Moota webhook route remains public and validates its own `Signature` header.

## 6. Optional: smoke-test the webhook endpoint locally

After `.env.local` contains `MOOTA_WEBHOOK_SECRET` and Supabase settings, start the app in one terminal:

```bash
npm run dev
```

In another terminal, run:

```bash
npm run test:webhook
```

This sends a synthetic, correctly signed webhook payload to the local endpoint. It checks the signature and database processing path, but it is not a real Moota Sandbox mutation. You can set `TEST_WEBHOOK_URL`, `TEST_AMOUNT`, and `TEST_ORDER_CODE` in `.env.local` to customize the test.

## 7. Test the full Moota Sandbox flow

1. Open the Vercel app and authenticate using `LAB_DASHBOARD_USER` and `LAB_DASHBOARD_PASSWORD`.
2. Create a transaction, for example Rp100.000.
3. Click **Kirim mutasi Sandbox** on that pending transaction.
4. The server calls Moota's dummy mutation endpoint with the order code in the note and requests an immediate webhook push if Moota returns a mutation ID.
5. Refresh the dashboard and open the **Webhook** and **Mutasi** tabs.
6. Confirm that a delivery appears with a valid signature and that the mutation is marked matched.

If the dummy mutation endpoint does not return a mutation ID, inspect the Moota API response returned by the route and use Moota's Sandbox/Developer push-test tools to trigger a delivery. The webhook must be registered against the same Sandbox bank account ID.

## API routes

- `GET /api/health` – checks Supabase connectivity and environment configuration (Basic Auth protected on deployment).
- `GET /api/dashboard` – dashboard data.
- `GET /api/transactions` – recent transactions.
- `POST /api/transactions` – create a pending transaction.
- `POST /api/moota/sandbox-mutation` – create a dummy credit mutation in Moota Sandbox and request a webhook push if possible.
- `POST /api/webhooks/moota` – public Moota webhook receiver with signature verification.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `MOOTA_API_TOKEN`, or `MOOTA_WEBHOOK_SECRET` in browser code.
- Use a private GitHub repository. Do not commit `.env.local`.
- The dashboard is protected with HTTP Basic Auth. Use a long unique password.
- The webhook endpoint accepts only requests with a valid Moota HMAC-SHA256 signature.
- A webhook can contain multiple mutation items. Each mutation is deduplicated by `mutation_id`.
- V1 is a testing tool, not a production accounting or payment settlement system. Review matching logic before using it for real customer payments.

## Important Moota API note

The dummy mutation and webhook push routes use the documented Moota v2 paths:

- `POST https://app.moota.co/api/v2/mutation/store/{bank_id}`
- `POST https://app.moota.co/api/v2/mutation/{mutation_id}/webhook`

Moota may change API behavior or response shape. The app reports Moota's response if the API rejects the request or returns an unexpected response.
