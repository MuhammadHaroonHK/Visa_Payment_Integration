# API contract — Checkout.com Flow

Status: **implemented for Cards and Apple Pay through Checkout.com Flow,
Payment Sessions, provider verification and signed webhooks.**

The API is the source of truth for prices, method availability, provider mode and
payment status. The browser never sets an amount, currency, provider mode or
final payment status.

## Conventions

- Base path: `/api/v1`
- JSON request and response bodies; UTF-8.
- All amounts are integer minor units (`halalas` for SAR).
- Success responses use `{ "data": ... }`.
- Errors use `{ "error": { "code", "message", "details", "requestId" } }`.
- `POST /orders` and `POST /payments/session` accept an optional
  `Idempotency-Key` header.
- Idempotency keys must contain 8–200 printable ASCII characters and live for 24
  hours.
- Reusing a key with different input returns `409 IDEMPOTENCY_KEY_REUSED`.
- API responses include `Cache-Control: no-store` and `X-Request-Id`.
- Timestamps are ISO 8601 UTC strings.
- CORS is restricted to `CLIENT_ORIGIN`.
- The API is rate limited to 120 requests per minute per IP in non-test mode.
  The signed webhook route is exempt.

## Health

### `GET /health`

```json
{
  "status": "ok",
  "service": "saudi-payments-api",
  "database": "connected",
  "environment": "development",
  "provider": "checkout",
  "providerConfigured": true,
  "timestamp": "2026-10-26T10:00:00.000Z"
}
```

Returns `503` with `status: "degraded"` when MongoDB is disconnected.
`providerConfigured` is true only when the Checkout.com API prefix, public key
and secret key are present.

## Payment methods

### `GET /api/v1/payment-methods`

Returns exactly two methods: `card` and `apple_pay`. Mada, Visa and Mastercard are
card schemes inside `card`, not separate methods.

```json
{
  "data": {
    "methods": [
      {
        "id": "card",
        "name": "Cards",
        "description": "Pay with a Visa, Mastercard or Mada debit or credit card.",
        "availability": "available",
        "mode": "sandbox",
        "flowComponent": "card",
        "providerMethod": "card",
        "providerLabel": "Checkout.com Flow",
        "requirement": "Card details are entered inside Checkout.com Flow",
        "detail": "Flow collects the card details and handles 3D Secure. The application never receives the full card number.",
        "docsUrl": "https://www.checkout.com/docs/payments/add-payment-methods/card-payments",
        "providerReady": true,
        "selectable": true
      },
      {
        "id": "apple_pay",
        "name": "Apple Pay",
        "description": "Pay with a card stored in your Apple Wallet.",
        "availability": "available",
        "mode": "sandbox",
        "flowComponent": "applepay",
        "providerMethod": "applepay",
        "providerLabel": "Checkout.com Flow",
        "requirement": "Requires Apple Pay on a supported device or browser",
        "detail": "Apple Pay is presented by Checkout.com Flow. The domain must be onboarded with Checkout.com before Apple Pay can be used.",
        "docsUrl": "https://www.checkout.com/docs/payments/add-payment-methods/apple-pay/web",
        "providerReady": true,
        "selectable": true
      }
    ],
    "meta": {
      "provider": "checkout",
      "environment": "sandbox",
      "providerConnected": true,
      "providerConfigured": true,
      "publicKey": "pk_test_...",
      "applePayEnabled": true,
      "cardSchemes": ["visa", "mastercard", "mada"],
      "configSource": "server",
      "verifiedAt": null
    }
  }
}
```

`availability` is `available` or `unavailable`. A method is selectable only when
Checkout.com is configured. Apple Pay also requires
`CHECKOUT_APPLE_PAY_ENABLED=true` and a non-empty
`CHECKOUT_APPLE_PAY_DOMAIN`. When the provider is not configured, both methods
are returned with `availability: "unavailable"`, `mode: null` and
`selectable: false`, and `meta.providerConfigured` is false.

The public key is safe to expose. The secret key, webhook signing key and webhook
authorization key are never returned.

## Orders

### `POST /api/v1/orders`

Creates an order from product references and quantities. The server resolves
names, prices, discount, tax, shipping and total.

```json
{
  "items": [{ "productId": "riwaq-esp-01", "quantity": 1 }],
  "promotionCode": "WELCOME100",
  "currency": "SAR",
  "locale": "en-SA"
}
```

Validation is strict. Unknown fields such as `unitPriceMinor`, `totalMinor`,
`provider`, `mode` and `amountMinor` are rejected. `promotionCode` is optional or
`null`. `currency` must be `SAR`; `locale` is `en-SA` or `ar-SA`.

Response `201`:

```json
{
  "data": {
    "order": {
      "id": "ord_09d5c9bc-6b0f-4e3d-b5f3-b16e2fe7a523",
      "reference": "ORD-2026-0001",
      "status": "open",
      "currency": "SAR",
      "locale": "en-SA",
      "country": "SA",
      "items": [
        {
          "id": "riwaq-esp-01",
          "productId": "riwaq-esp-01",
          "reference": "RIWAQ-ESP-01",
          "name": "Riwāq Home Espresso Machine",
          "description": "Brushed steel · 1.2 L · Saudi plug",
          "quantity": 1,
          "unitPriceMinor": 129900,
          "lineTotalMinor": 129900
        }
      ],
      "discount": {
        "code": "WELCOME100",
        "label": "Welcome offer",
        "amountMinor": 10000
      },
      "tax": { "label": "VAT (15%)", "rate": 0.15, "amountMinor": 17985 },
      "shipping": {
        "label": "Delivery",
        "detail": "Standard · 2–4 business days",
        "amountMinor": 0
      },
      "totals": {
        "currency": "SAR",
        "quantity": 1,
        "subtotalMinor": 129900,
        "discountMinor": 10000,
        "taxableBaseMinor": 119900,
        "taxMinor": 17985,
        "taxRate": 0.15,
        "shippingMinor": 0,
        "totalMinor": 137885,
        "items": ["...same item array..."]
      },
      "createdAt": "2026-10-26T10:00:00.000Z",
      "updatedAt": "2026-10-26T10:00:00.000Z"
    },
    "totals": { "...same totals object..." }
  }
}
```

Errors: `400 VALIDATION_ERROR`, `422 INVALID_PRODUCT`, `422 INVALID_PROMOTION`,
`422 PROMOTION_NOT_ELIGIBLE`, `409 IDEMPOTENCY_KEY_REUSED`.

### `GET /api/v1/orders/:orderId`

Returns `{ "data": { "order": ..., "totals": ... } }`. Unknown orders return
`404 NOT_FOUND`.

## Payment session

### `POST /api/v1/payments/session`

Creates the local payment record and the Checkout.com Payment Session.

```json
{
  "orderId": "ord_09d5c9bc-6b0f-4e3d-b5f3-b16e2fe7a523",
  "methodId": "card",
  "customer": {
    "fullName": "Layla Al-Harbi",
    "email": "layla@example.com"
  }
}
```

`methodId` is `card` or `apple_pay`. Unknown fields are rejected.

Rules:

- The order must exist and have status `open`.
- The order must not have a payment in `PENDING`, `AUTHORIZED` or `UNKNOWN`;
  those attempts must settle before another session is created.
- The method must exist and be `selectable` in the server configuration.
- The server re-prices the stored line items. A mismatch returns
  `409 ORDER_AMOUNT_CHANGED`.
- The amount, currency, reference and success/failure URLs come from the server.
- `enabled_payment_methods` is `["card"]` or `["applepay"]`.
- Card sessions enable 3D Secure and capture immediately. Apple Pay sessions do
  not send the card 3DS block.
- The optional processing channel ID is included when configured.
- Idempotency applies to the whole operation.

Response `201`:

```json
{
  "data": {
    "payment": {
      "id": "pmt_ccda31a1-0f4a-4a7a-b32e-e9f52a8e24c4",
      "mode": "sandbox",
      "environment": "sandbox",
      "provider": "checkout",
      "providerLabel": "Checkout.com Flow",
      "providerReady": true,
      "status": "REQUIRES_ACTION",
      "orderId": "ord_09d5c9bc-6b0f-4e3d-b5f3-b16e2fe7a523",
      "orderReference": "ORD-2026-0001",
      "amountMinor": 137885,
      "currency": "SAR",
      "methodId": "card",
      "methodName": "Cards",
      "methodAvailability": "available",
      "method": {
        "id": "card",
        "name": "Cards",
        "availability": "available",
        "description": "Pay with a Visa, Mastercard or Mada debit or credit card.",
        "requirement": "Card details are entered inside Checkout.com Flow",
        "detail": "Flow collects the card details and handles 3D Secure. The application never receives the full card number.",
        "docsUrl": "https://www.checkout.com/docs/payments/add-payment-methods/card-payments",
        "providerLabel": "Checkout.com Flow",
        "providerMethod": "card",
        "flowComponent": "card"
      },
      "customer": { "fullName": "Layla Al-Harbi" },
      "flow": {
        "connected": true,
        "publicKey": "pk_test_...",
        "environment": "sandbox",
        "component": "card",
        "cardSchemes": ["visa", "mastercard", "mada"],
        "session": {
          "id": "ps_...",
          "payment_session_token": "...",
          "payment_session_secret": "..."
        }
      },
      "verification": { "source": "none", "verifiedAt": null },
      "providerStatus": null,
      "failureCode": null,
      "order": { "...full order..." },
      "totals": { "...full totals..." },
      "createdAt": "2026-10-26T10:00:10.000Z",
      "updatedAt": "2026-10-26T10:00:10.000Z"
    }
  }
}
```

`flow.session` is the exact Checkout.com Payment Session response while the
attempt is ready for Flow. It is set to `null` after a final status or once a
provider payment has been recorded. The browser uses `flow.session`,
`flow.publicKey`, `flow.environment` and `flow.component` to initialize Flow. The
server's secret key is never included.

Errors:

- `404 NOT_FOUND` for an unknown order.
- `409 ORDER_NOT_PAYABLE` for a closed/paid order.
- `409 ORDER_PAYMENT_IN_PROGRESS` when a provider payment is still pending or
  authorized.
- `409 ORDER_AMOUNT_CHANGED` if re-pricing disagrees with the stored total.
- `422 PAYMENT_METHOD_UNAVAILABLE` for an unknown or unavailable method.
- `502 PROVIDER_ERROR` when Checkout.com rejects or cannot complete the Payment
  Session request.
- `503 PROVIDER_NOT_CONFIGURED` when provider keys are missing.
- `409 IDEMPOTENCY_KEY_REUSED` for a key reused with different input.

On a Payment Session provider failure, the local payment is stored as `FAILED`
with a safe `failureCode` and the order remains open. `error.details` includes
`providerStatus` and, when Checkout.com returns one, `providerRequestId` to help
correlate the failure with the server-side provider log. Provider responses are
logged with session secrets, card data and customer email redacted.

## Payment status

### `GET /api/v1/payments/:paymentId`

Returns `{ "data": { "payment": ... } }` with the stored order and totals.
Customer email, provider secrets and raw provider responses after completion are
not returned.

Internal status values:

`CREATED`, `PENDING`, `REQUIRES_ACTION`, `AUTHORIZED`, `CAPTURED`, `SUCCEEDED`,
`FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, `UNKNOWN`.

Provider status mapping:

| Checkout.com status | Internal status |
| --- | --- |
| `Pending` | `PENDING` |
| `Authorized` | `AUTHORIZED` |
| `Captured` | `CAPTURED` |
| `Paid` | `SUCCEEDED` |
| `Declined` | `FAILED` |
| `Canceled`, `Voided` | `CANCELLED` |
| `Expired` | `EXPIRED` |
| `Refunded`, `Partially Refunded` | `REFUNDED` |

The order is marked `paid` only for `Captured` or `Paid`, and only when
`approved` is not false.

### `POST /api/v1/payments/:paymentId/verify`

Optionally accepts a provider payment ID from the browser. For redirect flows the
browser can send `cko-payment-id` or `cko-session-id`; both are accepted by the
Checkout.com payment lookup.

```json
{ "providerPaymentId": "pay_..." }
```

If the body is empty, the server uses the stored provider payment ID. If no
provider payment exists yet, it returns a pending verification result.

```json
{
  "data": {
    "payment": { "...safe payment projection..." },
    "verification": {
      "verified": true,
      "source": "provider",
      "verifiedAt": "2026-10-26T10:01:00.000Z",
      "reason": null
    }
  }
}
```

No provider payment yet:

```json
{
  "data": {
    "payment": { "...safe payment projection..." },
    "verification": {
      "verified": false,
      "source": "none",
      "verifiedAt": null,
      "reason": "provider_payment_pending"
    }
  }
}
```

The server fetches the payment from Checkout.com and verifies that the amount,
currency, reference, local payment ID and verification token match. A mismatch
returns `409 PROVIDER_PAYMENT_MISMATCH`. The endpoint never accepts a status or
amount from the client.

If the provider lookup fails after the browser supplied a provider payment ID,
the attempt is stored as `UNKNOWN` with `failureCode: "VERIFICATION_PENDING"` and
the provider ID is retained. This blocks another Payment Session until a retry or
a signed webhook resolves the attempt. Do not ask the customer to pay again from
an unverified result screen.

## Webhooks

### `POST /api/v1/webhooks/checkout`

Receives Checkout.com gateway events.

Headers:

- `Cko-Signature`: HMAC-SHA256 over the raw request body, hex encoded.
- `Authorization`: optional; required only when `CHECKOUT_WEBHOOK_AUTH_KEY` is
  configured.

Behaviour:

- Invalid or missing signatures return `401 INVALID_WEBHOOK_SIGNATURE`.
- The event ID is persisted uniquely.
- Duplicate deliveries return `200 { "received": true }` without reprocessing.
- The route acknowledges quickly and processes the event asynchronously.
- The handler correlates through `data.metadata.cko_payment_session_id` and the
  local payment metadata.
- It re-fetches the provider payment before changing fulfilment state.
- Events outside the supported gateway payment set are marked `ignored`.
- A failed provider or mismatch leaves the event marked `failed` for retry.
- Pending events are retried at startup and on a one-minute sweep, up to five
  attempts.

Supported event types include `payment_approved`, `payment_captured`,
`payment_capture_declined`, `payment_capture_pending`, `payment_declined`,
`payment_pending`, `payment_canceled`, `payment_expired`, `payment_voided` and
`payment_refunded`.

Browser callbacks and redirects are navigation hints only. They are never proof
of payment.

## Error codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid fields or unknown fields |
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 400 | `INVALID_WEBHOOK_PAYLOAD` | Webhook missing ID, type or data ID |
| 401 | `INVALID_WEBHOOK_SIGNATURE` | Signature or authorization check failed |
| 404 | `NOT_FOUND` | Unknown resource or route |
| 409 | `ORDER_NOT_PAYABLE` | Order is no longer open |
| 409 | `ORDER_PAYMENT_IN_PROGRESS` | Provider payment is pending, authorized or unresolved |
| 409 | `ORDER_AMOUNT_CHANGED` | Re-pricing disagrees with the stored total |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Key reused with different input |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | First request with this key is still running |
| 409 | `PROVIDER_PAYMENT_MISMATCH` | Provider payment does not match the attempt |
| 422 | `PAYMENT_METHOD_UNAVAILABLE` | Unknown or unavailable payment method |
| 502 | `PROVIDER_ERROR` | Checkout.com request failed |
| 503 | `PROVIDER_NOT_CONFIGURED` | Provider keys are missing |
| 503 | `WEBHOOK_NOT_CONFIGURED` | Webhook signing key is missing |
| 429 | `RATE_LIMITED` | Too many requests |
