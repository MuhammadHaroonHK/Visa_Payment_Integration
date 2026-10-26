# Sahla — Cards and Apple Pay with Checkout.com Flow

A checkout demo for the Saudi market with a React storefront and an Express +
MongoDB API. The server owns orders, totals and payment sessions. The browser
mounts **Checkout.com Flow** for the two supported payment options:

| Option | Flow component | Payment Session method |
| --- | --- | --- |
| **Cards** | `card` | `card` |
| **Apple Pay** | `applepay` | `applepay` |

Mada, Visa and Mastercard are card schemes inside the Cards option. Mada is not
a separate checkout method. STC Pay, Tabby, Google Pay and instalments are not
part of this build.

No real money moves while the server is configured for the Checkout.com sandbox.

## What is implemented

- Two-option checkout: Cards and Apple Pay.
- Server-created Checkout.com Payment Sessions with server-owned amount,
  currency and reference.
- `enabled_payment_methods` restricted to `card` or `applepay` per attempt.
- Checkout.com Flow loaded from the official script origin at runtime.
- Server-side payment verification through `GET /payments/{id}`.
- Signed webhook endpoint with HMAC-SHA256 raw-body verification.
- Idempotent webhook storage and asynchronous processing.
- Duplicate-payment guard while an earlier attempt is pending, authorized or
  unverified.
- Payment is marked captured/paid only for `Captured` or `Paid` provider status.
  An `Authorized`-only payment leaves the order open.
- Server-priced orders with 15% VAT and promotion rules.
- Idempotency keys for order creation and payment-session creation.
- Safe payment projection: no secret keys, no customer email, no raw provider
  payloads after completion.
- API integration tests, pricing tests and UI tests.
- In-memory MongoDB in test mode; production requires `MONGODB_URI`.

## Stack

- React 19 + Vite 8 + Tailwind CSS v4
- React Router, React Hook Form, Zod
- Node.js 20.19+ (22 recommended) + Express 5
- MongoDB + Mongoose 8
- Checkout.com Flow and Payment Sessions API
- Helmet, CORS, rate limiting
- Vitest, React Testing Library, Supertest
- `mongodb-memory-server` for tests

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

This starts:

- API: `http://localhost:5000`
- Web: `http://localhost:5173`

The Vite server proxies `/api` to the API. The root route redirects to
`/checkout`.

## Checkout.com configuration

Copy the server example and fill in the account values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Required server values:

| Variable | Purpose |
| --- | --- |
| `CHECKOUT_ENVIRONMENT` | `sandbox` or `production`. |
| `CHECKOUT_API_PREFIX` | Account-specific prefix in `https://{prefix}.api.sandbox.checkout.com`. |
| `CHECKOUT_PUBLIC_KEY` | Public key (`pk_*`) used by Flow in the browser. |
| `CHECKOUT_SECRET_KEY` | Server-only key used to create Payment Sessions and fetch payments. |
| `CHECKOUT_WEBHOOK_SIGNATURE_KEY` | HMAC key used to verify `Cko-Signature`. |

Optional server values:

| Variable | Purpose |
| --- | --- |
| `CHECKOUT_WEBHOOK_AUTH_KEY` | Exact `Authorization` value expected on webhook requests. |
| `CHECKOUT_PROCESSING_CHANNEL_ID` | Processing channel sent on Payment Sessions when required by the account. |
| `CHECKOUT_APPLE_PAY_ENABLED` | Enables Apple Pay in the method catalogue. Default `false`. |
| `CHECKOUT_APPLE_PAY_DOMAIN` | Domain onboarded with Checkout.com for Apple Pay. |
| `CHECKOUT_CARD_SCHEMES` | Flow card schemes, default `visa,mastercard,mada`. |
| `CHECKOUT_REQUEST_TIMEOUT_MS` | Provider request timeout. Default `10000`. |

The browser receives only the public key and the Payment Session response. It
never receives `CHECKOUT_SECRET_KEY`, the webhook key or provider credentials.

### Apple Pay

Apple Pay needs more than API keys:

1. Use an HTTPS domain with a valid TLS certificate.
2. Ask Checkout.com to onboard that exact domain for Apple Pay.
3. Call `POST /applepay/enrollments` with the domain. A helper exists in
   `server/src/providers/checkout/client.js` (`enrollApplePayDomain`).
4. Set `CHECKOUT_APPLE_PAY_ENABLED=true` and `CHECKOUT_APPLE_PAY_DOMAIN`.
5. Test on an Apple Pay-compatible device or browser with a sandbox wallet.

Apple Pay will be visible but disabled until the server has Checkout.com keys and
both `CHECKOUT_APPLE_PAY_ENABLED=true` and a non-empty
`CHECKOUT_APPLE_PAY_DOMAIN`.

### Mada note

Checkout.com documents Mada on the web as Mada through Apple Pay in Saudi Arabia.
Accepting Mada in the card form requires a merchant ID from a Saudi acquirer and
full capture. Confirm both with the Checkout.com account manager before assuming
that card-form Mada is live. The default Flow card schemes request Visa,
Mastercard and Mada, but the provider decides what is available for the account.

## Commands

```bash
npm run dev             # API + web
npm run dev:server      # API only
npm run dev:client      # web only
npm run lint            # both workspaces
npm test                # client + server tests
npm run test:server     # Supertest API and pricing tests
npm run test:client     # Vitest + RTL tests
npm run build           # production client build
npm run preview         # preview the client build on port 4173
```

## Routes

| Route | Purpose |
| --- | --- |
| `/checkout` | Server-loaded order, customer details and the two payment options |
| `/payment/:paymentId` | Mounts the selected Checkout.com Flow component |
| `/payment/:paymentId/result` | Server-verified result; accepts `cko-payment-id` or `cko-session-id` |
| `/api/v1/...` | Express API, proxied by Vite in development |
| `/health` | API, database and provider configuration health |

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service, database and provider configuration |
| `GET` | `/api/v1/payment-methods` | Cards and Apple Pay availability plus public Flow metadata |
| `POST` | `/api/v1/orders` | Create a server-priced order; accepts `Idempotency-Key` |
| `GET` | `/api/v1/orders/:orderId` | Retrieve a stored order and totals |
| `POST` | `/api/v1/payments/session` | Create the local payment and Checkout.com Payment Session |
| `GET` | `/api/v1/payments/:paymentId` | Retrieve a safe payment projection and order |
| `POST` | `/api/v1/payments/:paymentId/verify` | Fetch the provider payment and reconcile local status |
| `POST` | `/api/v1/webhooks/checkout` | Checkout.com signed webhook receiver |

Full request/response shapes and error codes are in
[docs/api-contract.md](docs/api-contract.md).

## Trust boundary

- All amounts are integer minor units (halalas for SAR).
- The browser posts only product IDs, quantities, a promotion code, method ID and
  customer name/email.
- The API resolves the catalogue and promotion, calculates VAT and shipping, and
  stores the authoritative total.
- The total is recalculated again immediately before a Payment Session is created.
- A new Payment Session is refused while an earlier attempt is pending,
  authorized or unresolved, preventing a duplicate charge.
- The browser cannot set the provider amount, currency, method or status.
- `onPaymentCompleted`, success URLs and `cko-payment-id` are navigation hints.
  The server verifies the provider status and signed webhooks.
- The order is marked paid only when the provider status is `Captured` or `Paid`.
- Webhook signatures use HMAC-SHA256 over the raw body and are compared with
  `Cko-Signature` using a constant-time comparison.
- Webhook event IDs are persisted uniquely; duplicate and out-of-order delivery
  are tolerated.

## Webhooks

Configure this URL in the Checkout.com Dashboard:

```text
https://<your-api-host>/api/v1/webhooks/checkout
```

Subscribe to the gateway payment events, including:

- `payment_approved`
- `payment_captured`
- `payment_declined`
- `payment_pending`
- `payment_canceled`
- `payment_expired`

The handler verifies the signature, stores the event, responds `200` quickly and
processes it asynchronously. It correlates events through
`data.metadata.cko_payment_session_id` and the local payment metadata, then
re-fetches the provider payment before updating the local record.

## Testing

```bash
npm test
```

The server tests stub the Checkout.com HTTP API and cover Payment Session
creation, provider verification, amount tampering, signed webhooks, duplicate
webhooks and provider failures. The client tests cover the two-option checkout,
Flow initialization, Apple Pay availability and result routing.

For manual sandbox testing:

- Test card `4242424242424242` approves.
- Use the 3DS simulator password `Checkout1!` when prompted.
- Provider setup, Mada caveats, Apple Pay enrollment and the sandbox checklist
  are in [docs/provider-notes.md](docs/provider-notes.md).
- Architecture and implementation details are in
  [docs/architecture.md](docs/architecture.md) and
  [docs/implementation.md](docs/implementation.md).

## Project structure

```text
client/                    React storefront
  src/components/payment/  Checkout.com Flow mount
  src/pages/               Checkout, payment step and result pages
server/                    Express + MongoDB API
  src/providers/checkout/  Payment Sessions, payments and webhook verification
  src/routes/              Orders, methods, payments and webhooks
  src/services/            Payment and webhook orchestration
docs/                      API contract and provider notes
```

## Production checklist

- [ ] `MONGODB_URI` is set.
- [ ] `CHECKOUT_ENVIRONMENT=production`.
- [ ] Account prefix, public key, secret key and webhook signing key are set.
- [ ] Webhook endpoint is configured with the correct events.
- [ ] Apple Pay domain is onboarded and enrolled before enabling Apple Pay.
- [ ] Mada card-form support is confirmed with the acquirer and Checkout.com.
- [ ] HTTPS is used for the storefront and API.
- [ ] CSP allows `https://*.checkout.com` for script, connect, frame and image.
- [ ] Test cards, declines, 3DS and webhook retries are exercised in sandbox.
