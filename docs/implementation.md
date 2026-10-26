# Implementation notes — Cards and Apple Pay

Status: **implemented in code, pending live sandbox verification with account
credentials**. The repository now uses Checkout.com Flow, Payment Sessions,
server-side payment verification and signed webhooks. A real Checkout.com
sandbox payment has not been executed in this environment because account keys,
the API prefix, the webhook signing key and Apple Pay domain onboarding are not
present in the repository.

## What is delivered

### Server

- Express 5 API with Helmet, CORS, JSON limits, rate limiting, request IDs and
  `Cache-Control: no-store`.
- Zod-validated environment with production guards.
- MongoDB/Mongoose models for orders, payments, idempotency records, webhook
  events and order-reference counters.
- Isolated `mongodb-memory-server` startup whenever `NODE_ENV=test`, so tests
  never touch a real database.
- Strict request validation; unknown fields are rejected, including client
  prices, discounts, totals, provider and mode.
- Server-owned product catalogue, `WELCOME100` promotion, 15% VAT, delivery and
  final total.
- Idempotency for order and payment-session creation with request hashing and a
  24-hour TTL.
- Order re-pricing immediately before payment creation, returning
  `409 ORDER_AMOUNT_CHANGED` on mismatch.
- A second payment session is refused with `409 ORDER_PAYMENT_IN_PROGRESS` while
  an earlier attempt is pending, authorized or unresolved.
- If provider verification fails after a browser callback, the attempt is kept
  as `UNKNOWN` and blocked for retry or webhook resolution instead of allowing a
  second payment.
- Checkout.com HTTP client using Bearer auth with the secret key and the
  account-specific API base URL.
- Provider request and response logging for debugging, with Payment Session
  secrets, card data, customer email and phone numbers redacted. Successful
  response bodies are hidden in production.
- Payment Session payload builder with server-owned amount, currency, reference,
  URLs, customer, items, metadata, `enabled_payment_methods` and `capture`.
- Card sessions enable 3-D Secure; Apple Pay sessions use the `applepay` method.
- Provider payment verification through `GET /payments/{id}`.
- Amount, currency, reference, local payment ID and verification token matching.
- Raw-body webhook signature verification with constant-time HMAC comparison.
- Optional webhook `Authorization` value.
- Unique webhook event persistence, async processing, duplicate tolerance and
  retry sweep.
- Order fulfilment only for `Captured` or `Paid` provider status.
- Safe public payment projection: no customer email, secret key, webhook key or
  raw provider payload after completion.

### Client

- Checkout shows exactly two options: **Cards** and **Apple Pay**.
- Server availability controls whether each option can be selected.
- No mock, demo, simulation or design-preview payment path is shipped.
- `CheckoutFlow` loads the official Flow script from
  `https://checkout-web-components.checkout.com/index.js`.
- It initializes `CheckoutWebComponents` with the public key, environment,
  locale and exact Payment Session response.
- It mounts `checkout.create("card")` for Cards and
  `checkout.create("applepay")` for Apple Pay.
- `isAvailable()` is checked before mounting. Apple Pay shows a clear unavailable
  message on unsupported devices or unenrolled domains.
- `onPaymentCompleted` calls the server verification endpoint. The browser never
  treats the callback as proof of payment. A verification failure opens the safe
  result screen with a retry instead of leaving the Flow form active.
- The result page uses the stored server status and accepts `cko-payment-id` or
  `cko-session-id` only as a trigger for server verification.
- Existing submitted payments show a recorded result instead of remounting Flow.
- Pending or authorized payments do not offer a new checkout until they settle.
- Unsettled results can refresh the stored provider status without creating a
  payment.
- Returning to checkout after a completed order creates a fresh order.

### Tests

- Server: 32 tests across API integration and pricing files.
- Client: 25 tests across checkout, payment step, payment methods and formatting.
- The server tests stub Checkout.com HTTP calls and cover:
  - two-method catalogue and provider metadata;
  - order pricing, tampering and idempotency;
  - card and Apple Pay Payment Session creation;
  - provider verification and authorization-only handling;
  - amount mismatch rejection;
  - signed, duplicate and invalid webhooks;
  - provider failure mapping, duplicate-payment prevention, uncertain
    verification recovery and the removed mock endpoint.
- The client tests cover:
  - exactly two methods;
  - form submission for Cards and Apple Pay;
  - unconfigured provider handling;
  - Flow initialization for card and Apple Pay;
  - Apple Pay unavailability;
  - synchronous payment verification and result routing;
  - pending and authorized attempts not offering a new payment;
  - verification failures not offering another checkout;
  - final payment handling and missing sessions.
- `npm run lint` and `npm run build` pass.

## Key files

### Server

| File | Responsibility |
| --- | --- |
| `server/src/app.js` | Express assembly, raw body capture and webhook route |
| `server/src/server.js` | Listen, startup webhook recovery and graceful shutdown |
| `server/src/config/env.js` | Zod environment validation and production guards |
| `server/src/config/database.js` | Mongo connection and test memory server |
| `server/src/domain/paymentMethods.js` | Two-method catalogue and runtime availability |
| `server/src/domain/serializers.js` | Safe order/payment projections and Flow config |
| `server/src/providers/checkout/client.js` | Checkout.com HTTP client |
| `server/src/providers/checkout/paymentSessions.js` | Payment Session request builder |
| `server/src/providers/checkout/payments.js` | Status mapping and payment matching |
| `server/src/providers/checkout/webhooks.js` | Webhook signature verification |
| `server/src/services/paymentService.js` | Session creation, verification and fulfilment |
| `server/src/services/checkoutWebhookService.js` | Event persistence, correlation and retry |
| `server/src/models/Payment.js` | Provider session/payment fields and statuses |
| `server/src/models/WebhookEvent.js` | Idempotent webhook storage |
| `server/src/routes/payments.js` | Session, lookup and verify endpoints |
| `server/src/routes/webhooks.js` | Signed webhook receiver |
| `server/test/api.test.js` | Supertest integration tests |

### Client

| File | Responsibility |
| --- | --- |
| `client/src/services/checkoutService.js` | UI service seam |
| `client/src/services/http/httpGateway.js` | API calls, order persistence and idempotency |
| `client/src/pages/CheckoutPage.jsx` | Two-method checkout |
| `client/src/components/payment/CheckoutFlow.jsx` | Official Flow script and component mount |
| `client/src/pages/PaymentStepPage.jsx` | Payment session and final-state handling |
| `client/src/pages/PaymentResultPage.jsx` | Verified result and redirect query handling |
| `client/src/components/payment-status/PaymentResultView.jsx` | Result presentation |
| `client/src/data/paymentStatus.js` | Internal status and result mapping |
| `client/src/pages/CheckoutPage.test.jsx` | Checkout UI and submission tests |
| `client/src/pages/PaymentStepPage.test.jsx` | Flow mount and verification tests |

## API surface

| Method | Endpoint |
| --- | --- |
| `GET` | `/health` |
| `GET` | `/api/v1/payment-methods` |
| `POST` | `/api/v1/orders` |
| `GET` | `/api/v1/orders/:orderId` |
| `POST` | `/api/v1/payments/session` |
| `GET` | `/api/v1/payments/:paymentId` |
| `POST` | `/api/v1/payments/:paymentId/verify` |
| `POST` | `/api/v1/webhooks/checkout` |

See [api-contract.md](api-contract.md) for shapes, rules and error codes.

## Configuration

Required for provider traffic:

```text
CHECKOUT_ENVIRONMENT=sandbox
CHECKOUT_API_PREFIX=...
CHECKOUT_PUBLIC_KEY=pk_...
CHECKOUT_SECRET_KEY=sk_...
CHECKOUT_WEBHOOK_SIGNATURE_KEY=...
```

Optional:

```text
CHECKOUT_WEBHOOK_AUTH_KEY=...
CHECKOUT_PROCESSING_CHANNEL_ID=pc_...
CHECKOUT_APPLE_PAY_ENABLED=true
CHECKOUT_APPLE_PAY_DOMAIN=checkout.example.com
CHECKOUT_CARD_SCHEMES=visa,mastercard,mada
CHECKOUT_REQUEST_TIMEOUT_MS=10000
```

Apple Pay is selectable only when the provider is configured **and** both Apple
Pay values are present.

## Trust boundary

The browser submits:

```json
{
  "orderId": "ord_...",
  "methodId": "card",
  "customer": {
    "fullName": "Layla Al-Harbi",
    "email": "layla@example.com"
  }
}
```

It cannot submit prices, discounts, tax, totals, provider, mode or success
status. The server resolves the order, recalculates the total, checks method
selection, creates the provider session and persists the result.

Only `VITE_API_BASE_URL` is browser-visible. Checkout.com secrets remain
server-side. The Payment Session response is browser-visible because Flow
requires it; it does not contain the secret key.

## Limitations and next verification

- Real Checkout.com sandbox calls, webhook deliveries and Apple Pay have not been
  executed here. They require account-specific values.
- Apple Pay needs HTTPS, an onboarded domain, enrollment and a compatible device.
- Card-form Mada needs confirmation from the acquirer and Checkout.com. The
  documented Saudi web path is Mada through Apple Pay.
- `mongodb-memory-server` is test-only; production requires a reachable database.
- There is no authentication, customer account or dashboard in this demo. Payment
  lookup relies on opaque public IDs.
- Refunds, saved cards, Google Pay, STC Pay, Tabby and instalments are out of
  scope.

## Sandbox verification steps

1. Fill `server/.env` with sandbox values.
2. Start MongoDB and run `npm run dev`.
3. Confirm `/health` reports `providerConfigured: true`.
4. Confirm `/api/v1/payment-methods` returns Cards and Apple Pay as available
   (Apple Pay only when configured).
5. Pay with `4242424242424242`; use 3DS password `Checkout1!`.
6. Confirm the result page reports a server-verified captured status.
7. Send a real webhook and confirm signature verification, event processing and
   idempotency.
8. Test Apple Pay on a compatible device after domain onboarding.
