# Architecture

## Runtime

```text
Browser
  Pages / components
        │
        ▼
  checkoutService ── single UI-to-service seam
        │
        └── httpGateway ──► /api/v1 ──► Express API
                                            │
                                            ├── Zod validation
                                            ├── server pricing + catalogue
                                            ├── Mongoose Order / Payment / Idempotency / WebhookEvent
                                            ├── Checkout.com Payment Sessions API
                                            └── Checkout.com Payments API
                                                   ▲
                                                   │ signed webhook
                                            POST /api/v1/webhooks/checkout

Browser ──► https://checkout-web-components.checkout.com/index.js
        └──► Checkout.com Flow (card or Apple Pay component)
```

Vite proxies `/api` to `http://localhost:5000` in development. The browser only
knows `VITE_API_BASE_URL`; provider credentials remain server-side.

## Frontend layers

| Layer | Responsibility | Location |
| --- | --- | --- |
| Routes | URL ownership and page composition | `client/src/app/AppRoutes.jsx` |
| Pages | Layout, form orchestration, loading/error states | `client/src/pages/` |
| Components | Presentation, Flow mount and accessible interactions | `client/src/components/` |
| Hooks | Fetch lifecycle for checkout data and payments | `client/src/hooks/` |
| Service seam | UI-facing contract | `client/src/services/checkoutService.js` |
| HTTP gateway | API calls, order persistence and idempotency keys | `client/src/services/http/` |
| Data / utils | Status copy, static fallback metadata, formatting | `client/src/data/`, `client/src/utils/` |

Pages do not import Axios, Checkout.com SDKs or secrets. They call
`checkoutService` only. The Flow script is loaded dynamically from the official
origin and mounted by `CheckoutFlow`.

## Checkout data flow

1. `CheckoutPage` calls `useCheckoutData`.
2. `checkoutService.getCheckoutData` calls `httpGateway`.
3. In parallel, the gateway loads `GET /payment-methods` and gets or creates an
   open order. The order is stored by public ID in `sessionStorage`; order
   creation is idempotent per browser session. A paid/closed stored order is
   replaced with a fresh order when the customer returns.
4. The server resolves the product catalogue, promotion, VAT, shipping and final
   total. The browser renders the returned order and totals. It never calculates
   a payment amount.
5. The form validates full name, email and selected method.
6. On submit, the browser sends only `orderId`, `methodId` and customer details to
   `POST /payments/session` with an `Idempotency-Key`.
7. The server reloads the order, rejects a closed order, refuses another session
   while an earlier attempt is unresolved, rechecks method availability,
   re-prices the line items and compares the result with the stored total. A
   mismatch returns `409 ORDER_AMOUNT_CHANGED`.
8. The server creates a local `Payment` record and a Checkout.com Payment Session
   with server-owned amount, currency, reference, URLs, metadata and
   `enabled_payment_methods`.
9. The response includes the exact Payment Session response, the public key, the
   environment and the selected Flow component. The browser navigates to
   `/payment/:paymentId`.
10. `CheckoutFlow` loads the official Flow script, initializes
    `CheckoutWebComponents`, checks `isAvailable()`, and mounts `card` or
    `applepay`.
11. `onPaymentCompleted` calls `POST /payments/:paymentId/verify`. The server
    fetches the provider payment and checks amount, currency, reference, local
    payment ID and verification token. If the lookup fails, the attempt becomes
    `UNKNOWN` and stays blocked for a retry or signed webhook.
12. `/payment/:paymentId/result` reads the stored payment. Redirect query values
    `cko-payment-id` and `cko-session-id` trigger a server verification; the query
    is never accepted as a status. An unsettled result can re-run verification
    with the stored provider payment ID without creating a new payment.
13. Signed webhooks can update the same payment later. The order is marked paid
    only for `Captured` or `Paid`.

## Backend layers

| Layer | Responsibility | Location |
| --- | --- | --- |
| App assembly | CORS, Helmet, JSON limit, raw body capture, rate limit, request IDs | `server/src/app.js` |
| Config | Zod-validated environment, Mongo connection, test memory server | `server/src/config/` |
| Routes | Health, methods, orders, payments, webhooks | `server/src/routes/` |
| Middleware | Input validation, error envelope, cache headers | `server/src/middleware/` |
| Domain | Pricing, method configuration, serializers, errors | `server/src/domain/` |
| Models | Order, Payment, Idempotency, WebhookEvent, Counter | `server/src/models/` |
| Services | Order creation, payment transitions, webhook processing, idempotency | `server/src/services/` |
| Providers | Checkout.com HTTP client, session payload, status mapping, signature verification | `server/src/providers/checkout/` |
| Catalogue | Products, promotion, VAT and shipping constants | `server/src/data/catalog.js` |

### Request pipeline

1. `requestContext` assigns or accepts a safe `X-Request-Id`.
2. Helmet sets API security headers; CORS is restricted to `CLIENT_ORIGIN`.
3. `/api` responses are `Cache-Control: no-store` and rate limited, except the
   signed webhook route.
4. `express.json` captures the raw body for webhook signature verification.
5. Zod schemas replace request input with parsed data; unknown fields are
   rejected.
6. Route handlers call services with validated data only.
7. Services load records, recalculate totals and choose provider mode from server
   configuration.
8. Errors return `{ error: { code, message, details, requestId } }` without
   secrets, stack traces or raw provider payloads.

## Money and trust boundary

- All money values are integer minor units (halalas for SAR).
- `server/src/domain/pricing.js` is the canonical calculation: line totals,
  discount cap, taxable base, rounded 15% VAT, shipping and total.
- The browser cannot submit prices, discount amounts, tax, totals, provider mode
  or live mode. Unknown fields fail validation.
- The order stores a priced snapshot. Payment creation re-prices from the current
  catalogue and refuses a changed total.
- A new session is refused while an earlier attempt is pending, authorized or
  unresolved, preventing a duplicate charge during webhook processing.
- Payment amount comes from the recalculated order total, never from the client.
- A payment stores the method snapshot used at creation, so later catalogue
  changes do not rewrite the record.
- Browser callbacks, success URLs and `cko-payment-id` are navigation hints only.
- Webhook signatures are HMAC-SHA256 over the raw body, compared in constant time.
- Fulfilment requires `Captured` or `Paid`; an authorization alone leaves the
  order open.

## Method and provider ownership

`server/src/domain/paymentMethods.js` owns the method list and selection rules.
The catalogue has exactly two methods:

| Method | Flow component | Payment Session method | Enabled when |
| --- | --- | --- | --- |
| `card` | `card` | `card` | Checkout.com API prefix, public key and secret key are present |
| `apple_pay` | `applepay` | `applepay` | The card conditions plus `CHECKOUT_APPLE_PAY_ENABLED=true` and `CHECKOUT_APPLE_PAY_DOMAIN` |

`mode` is `sandbox` or `live`, derived from `CHECKOUT_ENVIRONMENT`; the browser
cannot set it. When the provider is not configured, both methods are returned as
unavailable and cannot be selected. There is no mock or demo provider path in the
shipped application.

## Payment statuses

| Checkout.com status | Internal status | Order fulfilment |
| --- | --- | --- |
| `Pending` | `PENDING` | No |
| `Authorized`, `Card Verified` | `AUTHORIZED` | No |
| `Captured` | `CAPTURED` | Yes |
| `Paid` | `SUCCEEDED` | Yes |
| `Declined` | `FAILED` | No |
| `Canceled`, `Voided` | `CANCELLED` | No |
| `Expired` | `EXPIRED` | No |
| `Refunded`, `Partially Refunded` | `REFUNDED` | Refunded state |

`CREATED` is used before the Payment Session is created; `REQUIRES_ACTION` means
Flow must present the payment step. Unknown provider statuses map to `UNKNOWN`
and do not fulfil the order.

## Webhook processing

1. Verify `Cko-Signature` against the raw body; optionally require the configured
   `Authorization` value.
2. Validate the event envelope, then persist the event ID uniquely.
3. Respond `200` quickly; process asynchronously with `setImmediate`.
4. Correlate through `data.metadata.local_payment_id`,
   `data.metadata.cko_payment_session_id` and the provider payment ID.
5. Re-fetch the provider payment, match it to the attempt and apply the status.
6. Retry pending/failed events at startup and on a one-minute sweep, up to five
   attempts. Stale `processing` claims are released after five minutes.
7. Duplicate delivery is acknowledged without double-processing.

## Routes

```text
/                                  → redirect to /checkout
/checkout                          → server-backed checkout
/payment/:paymentId                → Checkout.com Flow mount
/payment/:paymentId/result         → server-verified result
*                                  → 404
```

## Database

- `Order`: public ID, reference, status, line snapshot, discount, tax, shipping,
  totals, latest payment.
- `Payment`: public ID, order reference, method snapshot, amount/currency,
  provider, mode, internal status, provider session/payment IDs, verification
  token/source, failure code, timestamps.
- `WebhookEvent`: unique event ID, type, provider IDs, local payment ID, raw
  payload hash, processing status, attempts, TTL.
- `Idempotency`: scoped key, request hash, pending/completed state, stored
  response, 24-hour TTL.
- `Counter`: monotonic order reference sequence.

Tests always use an isolated `mongodb-memory-server` instance when
`NODE_ENV=test`, even if a `MONGODB_URI` is present. Development and production
require a reachable `MONGODB_URI`.

## Security implemented

- Server-only provider secrets; no secret in a `VITE_*` variable.
- Zod validation with strict unknown-field rejection.
- Idempotency for order and payment-session creation.
- Server-side method gating, pricing and amount verification.
- CORS allowlist, Helmet, JSON body limit, rate limiting, request IDs.
- `no-store` on API responses.
- Generic error envelope; no provider or database internals exposed.
- Public payment projection omits customer email and provider secrets.
- Webhook signature verification and idempotent event storage.
- Payment status is reconciled from the provider, never from the client.

## Production requirements

- `MONGODB_URI`, `CHECKOUT_ENVIRONMENT=production`, account prefix, scoped public
  and secret keys, and a webhook signing key.
- HTTPS for the storefront and API.
- Apple Pay domain onboarding and enrollment before enabling Apple Pay.
- Mada card-form support confirmed with the acquirer and Checkout.com.
- Webhook endpoint configured with the supported payment events.
- CSP allows the Checkout.com Flow origins and the Apple Pay JS origins for
  script, connect, frame and image, following the provider's current guidance.
- Server logging/alerting and secrets management appropriate to the deployment.

## Testing strategy

Server tests stub the Checkout.com HTTP API and cover Payment Session creation,
provider verification, amount tampering, signed and duplicate webhooks, final
status handling and provider failures. Client tests cover the two-option
checkout, Flow initialization for card and Apple Pay, Apple Pay availability,
result routing and safe error states. Pricing and hash helpers have unit tests.
