import { env } from '../../config/env.js'

export class CheckoutApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'CheckoutApiError'
    this.status = options.status ?? 502
    this.code = options.code ?? 'CHECKOUT_PROVIDER_ERROR'
    this.providerRequestId = options.providerRequestId ?? null
    this.providerStatus = options.providerStatus ?? null
  }
}

export function checkoutApiBaseUrl() {
  const suffix =
    env.CHECKOUT_ENVIRONMENT === 'sandbox'
      ? 'api.sandbox.checkout.com'
      : 'api.checkout.com'

  return `https://${env.CHECKOUT_API_PREFIX}.${suffix}`
}

function authorizationHeader() {
  // Checkout.com server-side API keys use the Bearer scheme. Basic auth is
  // rejected with 401 even when the secret key itself is valid.
  return `Bearer ${env.CHECKOUT_SECRET_KEY}`
}

const REDACTED_KEYS = new Set([
  'authorization',
  'cvv',
  'cvc',
  'email',
  'expiry_month',
  'expiry_year',
  'last4',
  'local_payment_token',
  'number',
  'payment_session_secret',
  'payment_session_token',
  'phone',
])

function redact(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        REDACTED_KEYS.has(key) ? '[redacted]' : redact(entry),
      ]),
    )
  }

  return value
}

function parseRequestBody(options) {
  if (!options.body || env.IS_PRODUCTION) return undefined

  try {
    return redact(JSON.parse(options.body))
  } catch {
    return '[unparseable request body]'
  }
}

function logProviderResponse({
  method,
  path,
  status,
  providerRequestId,
  durationMs,
  body,
}) {
  if (env.IS_TEST) return

  const entry = {
    method,
    path,
    status,
    providerRequestId,
    durationMs,
    body:
      env.IS_PRODUCTION && status >= 200 && status < 300
        ? '[body hidden in production]'
        : redact(body),
  }

  if (status >= 200 && status < 300) {
    console.log('[checkout] API response', entry)
  } else {
    console.error('[checkout] API error response', entry)
  }
}

async function request(path, options = {}) {
  if (!env.CHECKOUT_API_PREFIX || !env.CHECKOUT_SECRET_KEY) {
    throw new CheckoutApiError(
      'Checkout.com is not configured on this server.',
      {
        status: 503,
        code: 'CHECKOUT_NOT_CONFIGURED',
      },
    )
  }

  const method = options.method ?? 'GET'
  const url = `${checkoutApiBaseUrl()}${path}`
  const startedAt = Date.now()
  let response

  if (!env.IS_TEST) {
    console.log('[checkout] API request', {
      method,
      url,
      body: parseRequestBody(options),
    })
  }

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorizationHeader(),
        ...options.headers,
      },
      signal: AbortSignal.timeout(env.CHECKOUT_REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (!env.IS_TEST) {
      console.error('[checkout] API request failed', {
        method,
        path,
        durationMs: Date.now() - startedAt,
        error: error?.message ?? error,
        code:
          error?.name === 'TimeoutError'
            ? 'CHECKOUT_TIMEOUT'
            : 'CHECKOUT_NETWORK_ERROR',
      })
    }

    throw new CheckoutApiError(
      'Checkout.com could not be reached. Please try again.',
      {
        code:
          error?.name === 'TimeoutError'
            ? 'CHECKOUT_TIMEOUT'
            : 'CHECKOUT_NETWORK_ERROR',
      },
    )
  }

  const providerRequestId =
    response.headers.get('cko-request-id') ??
    response.headers.get('x-request-id') ??
    null
  const rawBody = await response.text()
  let body = null

  if (rawBody) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      logProviderResponse({
        method,
        path,
        status: response.status,
        providerRequestId,
        durationMs: Date.now() - startedAt,
        body: rawBody,
      })

      throw new CheckoutApiError(
        'Checkout.com returned an unreadable response.',
        {
          providerRequestId,
          providerStatus: response.status,
        },
      )
    }
  }

  logProviderResponse({
    method,
    path,
    status: response.status,
    providerRequestId,
    durationMs: Date.now() - startedAt,
    body,
  })

  if (!response.ok) {
    throw new CheckoutApiError(
      'Checkout.com could not complete the request. Please try again.',
      {
        providerRequestId,
        providerStatus: response.status,
        code:
          response.status === 429
            ? 'CHECKOUT_RATE_LIMITED'
            : 'CHECKOUT_PROVIDER_ERROR',
      },
    )
  }

  return { body, requestId: providerRequestId, status: response.status }
}

export async function createPaymentSession(payload) {
  const { body } = await request('/payment-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (
    !body?.id ||
    !body?.payment_session_token ||
    !body?.payment_session_secret
  ) {
    throw new CheckoutApiError(
      'Checkout.com returned an incomplete Payment Session.',
    )
  }

  return body
}

export async function getPayment(providerPaymentId) {
  const { body } = await request(
    `/payments/${encodeURIComponent(providerPaymentId)}`,
    { method: 'GET' },
  )

  if (!body?.id) {
    throw new CheckoutApiError('Checkout.com returned an incomplete payment.')
  }

  return body
}

export async function enrollApplePayDomain(domain) {
  const { body } = await request('/applepay/enrollments', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  })

  return body
}
