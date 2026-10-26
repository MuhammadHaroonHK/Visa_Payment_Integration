# Provider notes — Checkout.com Flow (Cards and Apple Pay)

Reviewed against the public Checkout.com documentation in October 2026. These
notes describe the integration used by this repository and the account tasks
that cannot be completed with code alone.

Official documentation:

- [Get started with Flow](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/get-started-with-flow)
- [CheckoutWebComponents / Flow library](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/flow-library-reference/checkoutwebcomponents)
- [Payment Sessions](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/create-a-payment-session)
- [Apple Pay on the web](https://www.checkout.com/docs/payments/add-payment-methods/apple-pay/web)
- [Mada on the web](https://www.checkout.com/docs/payments/add-payment-methods/mada/web)
- [Card payments](https://www.checkout.com/docs/payments/add-payment-methods/card-payments)
- [API endpoints](https://www.checkout.com/docs/developer-resources/api/api-endpoints)
- [Receive webhooks](https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks/configure-your-webhook-server)

## What is integrated

The checkout exposes exactly two options:

| Option | Server `enabled_payment_methods` | Flow component |
| --- | --- | --- |
| Cards | `["card"]` | `checkout.create("card")` |
| Apple Pay | `["applepay"]` | `checkout.create("applepay")` |

Mada, Visa and Mastercard are card schemes inside the Cards option. They are not
separate checkout methods in this application.

The flow is:

1. The API prices the order server-side.
2. The API creates a Checkout.com Payment Session with the secret key.
3. The API returns the exact Payment Session response, the account public key,
   the environment and the Flow component name.
4. The browser loads the Flow script from
   `https://checkout-web-components.checkout.com/index.js` and mounts only the
   selected component.
5. Flow performs the payment and any 3DS, wallet or redirect action.
6. The API fetches the provider payment and checks amount, currency, reference,
   local payment ID and verification token.
7. Signed webhooks and the verification endpoint update the local status. The
   order is marked paid only for `Captured` or `Paid`.

Provider API base URLs are account-specific:

```text
https://{prefix}.api.checkout.com
https://{prefix}.api.sandbox.checkout.com
```

Do not hard-code `api.sandbox.checkout.com` without the account prefix.

## Required account configuration

Server-only values:

- `CHECKOUT_API_PREFIX`
- `CHECKOUT_SECRET_KEY`
- `CHECKOUT_WEBHOOK_SIGNATURE_KEY`
- `CHECKOUT_WEBHOOK_AUTH_KEY` if the webhook endpoint enforces an
  `Authorization` value
- `CHECKOUT_PROCESSING_CHANNEL_ID` if required by the account

Browser-visible value:

- `CHECKOUT_PUBLIC_KEY`, prefixed with `pk_`

Environment:

- `CHECKOUT_ENVIRONMENT=sandbox` while testing.
- `CHECKOUT_ENVIRONMENT=production` with live keys for production.

Key scopes vary by account and method. The public key needs the Flow and Payment
Session permissions; the secret key needs Payment Sessions and Payments read
access. Confirm the exact scopes in the Checkout.com Dashboard before testing.

Server-to-server requests use `Authorization: Bearer <secret key>`. Checkout.com
returns `401` for Basic auth, even when the secret key itself is valid.

## Cards

- Flow collects the card number. This application never receives or stores it.
- The API enables 3-D Secure for card sessions by default:
  `"3ds": { "enabled": true }`. The live API rejects the string form with
  `3ds_enabled_invalid` even though older published examples use strings.
- The default requested card schemes are Visa, Mastercard and Mada:
  `CHECKOUT_CARD_SCHEMES=visa,mastercard,mada`.
- Capture is immediate in the Payment Session (`capture: true`). Only a
  `Captured` or `Paid` provider status marks the order paid.
- Card schemes actually shown by Flow depend on the account, currency, country
  and acquirer configuration.

### Mada caveat

Checkout.com documents Mada on the web as **Mada through Apple Pay** in Saudi
Arabia. Accepting Mada in the card form requires a merchant ID from a Saudi
acquirer and full capture. Partial capture and partial authorization are not
supported.

The code requests Mada as a card scheme, but that is not proof that the account
is enabled for card-form Mada. Confirm with the Checkout.com account manager and
the acquirer before treating card-form Mada as live. This is why the Apple Pay
path is the safer route for Mada in a Saudi storefront.

## Apple Pay

Apple Pay needs more than API keys:

1. Use an HTTPS domain with a valid TLS certificate.
2. Ask Checkout.com to onboard the exact domain for Apple Pay.
3. Enroll the domain with `POST /applepay/enrollments`.
4. Set `CHECKOUT_APPLE_PAY_ENABLED=true` and `CHECKOUT_APPLE_PAY_DOMAIN`.
5. Test on an Apple Pay-compatible device or browser with a sandbox wallet.

The repository exposes `enrollApplePayDomain(domain)` in
`server/src/providers/checkout/client.js`. It is deliberately not run at startup:
domain enrollment is an account/infrastructure action and must be explicit.

Apple Pay remains visible but disabled when the server has no provider keys,
`CHECKOUT_APPLE_PAY_ENABLED` is false, or `CHECKOUT_APPLE_PAY_DOMAIN` is empty.

## Webhooks

Configure this URL in the Checkout.com Dashboard:

```text
https://<api-host>/api/v1/webhooks/checkout
```

Subscribe to the gateway payment events. The handler accepts:

- `payment_approved`
- `payment_captured`
- `payment_capture_declined`
- `payment_capture_pending`
- `payment_declined`
- `payment_pending`
- `payment_canceled`
- `payment_expired`
- `payment_voided`
- `payment_refunded`

The handler:

- verifies `Cko-Signature` as HMAC-SHA256 over the raw request body;
- optionally requires the configured `Authorization` value;
- persists the event ID uniquely and tolerates duplicate delivery;
- acknowledges quickly and processes asynchronously;
- correlates through `data.metadata.cko_payment_session_id` and the local payment
  metadata;
- re-fetches the provider payment before changing fulfilment state;
- retries pending/failed events at startup and on a one-minute sweep, up to five
  attempts.

Browser callbacks, success URLs and `cko-payment-id` are navigation hints only.
They are never proof of payment. If the follow-up provider lookup fails, the
attempt is retained as `UNKNOWN` and blocked until a retry or signed webhook
resolves it, so the customer is not asked to pay twice.

## Status mapping and fulfilment

| Checkout.com status | Internal status | Order fulfilment |
| --- | --- | --- |
| `Pending` | `PENDING` | No |
| `Authorized` | `AUTHORIZED` | No |
| `Captured` | `CAPTURED` | Yes |
| `Paid` | `SUCCEEDED` | Yes |
| `Declined` | `FAILED` | No |
| `Canceled`, `Voided` | `CANCELLED` | No |
| `Expired` | `EXPIRED` | No |
| `Refunded`, `Partially Refunded` | `REFUNDED` | Refunded state |

The order is marked paid only when the provider status maps to `CAPTURED` or
`SUCCEEDED` and `approved` is not false. An authorization alone leaves the order
open.

## Sandbox checklist

- [ ] Account prefix and base URL confirmed.
- [ ] Public and secret keys created with Flow/Payment Session scopes.
- [ ] Secret key present only in server environment variables.
- [ ] Webhook endpoint configured with the required events.
- [ ] Webhook signature verification tested with a real delivery.
- [ ] Payment Session created with a server-calculated amount.
- [ ] Flow script loaded from the official origin.
- [ ] Card form mounted with Visa, Mastercard and Mada requested.
- [ ] Test card `4242424242424242` approved.
- [ ] 3DS simulator password `Checkout1!` tested.
- [ ] Declined, pending and cancelled cases tested.
- [ ] Apple Pay domain onboarded and enrolled.
- [ ] Apple Pay tested on a compatible device.
- [ ] Card-form Mada confirmed with the acquirer and Checkout.com.
- [ ] Captured and authorized-only webhooks tested.
- [ ] Duplicate and out-of-order webhooks tested.
- [ ] Result pages driven by server-verified status only.

## Out of scope

Refunds, saved cards, Google Pay, STC Pay, Tabby and instalments are not included
in this build. The payment models and endpoints keep provider IDs so those
features can be added later without changing the trust boundary.
