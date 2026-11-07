# Moota Webhook Testing Lab V1.1

A Next.js application for testing Moota Sandbox mutations and webhook delivery. It is designed to deploy on Vercel and use Supabase provisioned from the Vercel Marketplace.

## What changed in V1.1

- Supabase no longer needs to be created manually in the Supabase dashboard.
- Connect a Supabase resource from Vercel Marketplace. Vercel synchronizes the Supabase API and Postgres connection environment variables to the Vercel project.
- The first Production deployment automatically applies the SQL files in `supabase/migrations/` before building Next.js.
- Database migrations are tracked in `private.schema_migrations`, protected by a PostgreSQL advisory lock, and checked with SHA-256 checksums.
- Preview deployments skip migrations so a preview build cannot unexpectedly change the shared Production database schema.
- The app accepts the current Marketplace variable `SUPABASE_SECRET_KEY`, with legacy service-role key fallbacks for local/manual setups.

## Features

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

## 1. Deploy and provision Supabase from Vercel

You do not need to create a Supabase project separately or copy Supabase keys manually.

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Open the new Vercel project, then go to **Storage** (or **Marketplace / Integrations**, depending on the dashboard layout).
4. Choose **Connect Store / Create New**, select **Supabase**, and follow the authorization and resource-creation steps.
5. Connect the new Supabase resource to this Vercel project and make sure it is available to the **Production** environment.
6. Vercel automatically adds the Supabase API variables and Postgres connection variables. Do not manually create or rename them.
7. Configure the non-Supabase variables listed below, then deploy.

The Marketplace integration currently supplies variables including `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `POSTGRES_URL`, and `POSTGRES_URL_NON_POOLING`. The application uses the secret key only on the server. The migration script prefers `POSTGRES_URL` (transaction-pooler compatible) and falls back to `POSTGRES_URL_NON_POOLING`.

**Important:** Vercel cannot create a paid/owned Supabase resource silently from a normal Git deployment. You must authorize the Marketplace integration and select/create the Supabase resource once in the Vercel dashboard. After that, environment-variable wiring and schema creation are automatic.

## 2. Configure only the non-Supabase environment variables

In Vercel → Project → Settings → Environment Variables, add:

Required for dashboard protection:

- `LAB_DASHBOARD_USER`
- `LAB_DASHBOARD_PASSWORD`

Required for the in-app Sandbox mutation button:

- `MOOTA_API_TOKEN`
- `MOOTA_SANDBOX_BANK_ID`

Required to accept signed Moota webhook deliveries (add after creating the webhook in Moota):

- `MOOTA_WEBHOOK_SECRET`

Optional:

- `AUTO_MATCH_UNIQUE_AMOUNT=true` (enabled only when explicitly set to `true`). If enabled, one pending transaction may be matched by exact amount when no order code appears in the mutation note/description. For real payment workflows, prefer unique order references and consider disabling this fallback.

Do not add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `POSTGRES_URL`, or `POSTGRES_URL_NON_POOLING` manually when the Marketplace integration is connected.

## 3. Automatic database setup

The Vercel build command is configured in `vercel.json`:

```bash
npm run db:migrate && npm run build
```

On a Vercel **Production** deployment, `scripts/migrate.mjs`:

1. Connects to the Supabase Postgres database using the Marketplace-provided connection string.
2. Creates a private migration-history table if it does not exist.
3. Applies each `.sql` file in `supabase/migrations/` once, in filename order.
4. Records the migration filename and SHA-256 checksum.
5. Fails the deployment if a migration fails or an already-applied migration was edited.

This means the initial production deployment creates the `transactions`, `webhook_deliveries`, and `moota_mutations` tables and their indexes and RLS settings automatically. You do not need to open the Supabase SQL Editor.

**Migration rule:** Never edit a migration file after it has been applied. Add a new, timestamped `.sql` file for future schema changes.

Preview deployments skip migrations intentionally. Deploy Production once first to initialize the schema; Preview deployments can then use that initialized database. If you previously overrode the Build Command in Vercel Project Settings, remove that override or set it to `npm run db:migrate && npm run build` so the migration step is not bypassed. If you later want isolated preview databases, configure separate Supabase preview resources/branches rather than pointing previews at Production.

## 4. Configure Moota Sandbox

1. In Moota, identify the Sandbox bank account and copy its bank ID.
2. Create or copy a Personal API Token with the required mutation permissions.
3. Add the token to Vercel as `MOOTA_API_TOKEN` and the Sandbox bank ID as `MOOTA_SANDBOX_BANK_ID`.
4. Deploy the project.
5. After the deployment is live, create a webhook in Moota for the Sandbox bank account and incoming/credit mutations.
6. Set the webhook URL to `https://YOUR-VERCEL-DOMAIN/api/webhooks/moota`.
7. Copy the Secret Token generated/shown by Moota and add it to Vercel as `MOOTA_WEBHOOK_SECRET`.
8. Redeploy so the webhook secret is available to the server.

Moota's guide states that the webhook URL and Secret Token cannot be edited after creation. Double-check the endpoint before saving.

## 5. Run locally (optional)

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
# Fill in the local Supabase and Moota values
npm run dev
```

For local development, `.env.local` needs `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`), and the Moota/dashboard variables you intend to test. To run the schema migration locally, also set `POSTGRES_URL` (or `POSTGRES_URL_NON_POOLING`) and execute:

```bash
RUN_DB_MIGRATIONS=true npm run db:migrate
```

Local migrations are opt-in. The script skips automatically during Vercel Preview builds and runs during Vercel Production builds.

## 6. Test the full Moota Sandbox flow

1. Open the Vercel app and authenticate using `LAB_DASHBOARD_USER` and `LAB_DASHBOARD_PASSWORD`.
2. Create a transaction, for example Rp100.000.
3. Click **Kirim mutasi Sandbox** on that pending transaction.
4. The server calls Moota's dummy mutation endpoint with the order code in the note and requests an immediate webhook push if possible.
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

- Never expose `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MOOTA_API_TOKEN`, or `MOOTA_WEBHOOK_SECRET` in browser code.
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
