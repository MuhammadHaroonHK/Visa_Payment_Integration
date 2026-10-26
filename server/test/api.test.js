import { createHmac, randomUUID } from 'node:crypto'
import request from 'supertest'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createApp } from '../src/app.js'
import {
  clearDatabase,
  connectDatabase,
  disconnectDatabase,
} from '../src/config/database.js'
import { Order } from '../src/models/Order.js'
import { Payment } from '../src/models/Payment.js'
import { WebhookEvent } from '../src/models/WebhookEvent.js'

const app = createApp()
const webhookKey = 'whsec_test'

function key(prefix) {
  return `${prefix}-${randomUUID()}`
}

const orderInput = {
  items: [{ productId: 'riwaq-esp-01', quantity: 1 }],
  promotionCode: 'WELCOME100',
  locale: 'en-SA',
  currency: 'SAR',
}

const customer = {
  fullName: 'Layla Al-Harbi',
  email: 'layla@example.com',
}

const providerState = {
  sessionSequence: 0,
  lastSessionPayload: null,
  lastAuthorization: null,
  failSession: false,
  failPayment: false,
  paymentStatus: 'Captured',
  paymentApproved: true,
  paymentOverride: null,
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cko-request-id': 'req_test_123',
    },
  })
}

function providerPayment(providerPaymentId, overrides = {}) {
  const session = providerState.lastSessionPayload ?? {}

  return {
    id: providerPaymentId,
    amount: session.amount,
    currency: session.currency,
    reference: session.reference,
    status: providerState.paymentStatus,
    approved: providerState.paymentApproved,
    metadata: session.metadata ?? {},
    ...providerState.paymentOverride,
    ...overrides,
  }
}

function installProviderFetchMock() {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const urlString = String(url)
    providerState.lastAuthorization = options.headers?.Authorization

    if (
      urlString.endsWith('/payment-sessions') &&
      options.method === 'POST'
    ) {
      if (providerState.failSession) {
        return jsonResponse({ error: 'provider unavailable' }, 500)
      }

      const payload = JSON.parse(options.body)
      providerState.lastSessionPayload = payload
      providerState.sessionSequence += 1
      const id = `ps_test_${providerState.sessionSequence}`

      return jsonResponse(
        {
          id,
          payment_session_token: `pst_${id}`,
          payment_session_secret: `pss_${id}`,
          amount: payload.amount,
          currency: payload.currency,
          payment_methods: [
            { type: payload.enabled_payment_methods[0] },
          ],
          metadata: payload.metadata,
        },
        201,
      )
    }

    if (urlString.includes('/payments/')) {
      if (providerState.failPayment) {
        return jsonResponse({ error: 'provider unavailable' }, 503)
      }

      const providerPaymentId = decodeURIComponent(
        urlString.split('/payments/')[1],
      )

      return jsonResponse(providerPayment(providerPaymentId))
    }

    return jsonResponse({ error: 'not found' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function createOrder(overrides = {}) {
  const response = await request(app)
    .post('/api/v1/orders')
    .set('Idempotency-Key', key('order'))
    .send({ ...orderInput, ...overrides })

  expect(response.status).toBe(201)
  return response.body.data
}

async function createPayment(orderId, methodId = 'card') {
  return request(app)
    .post('/api/v1/payments/session')
    .set('Idempotency-Key', key('payment'))
    .send({ orderId, methodId, customer })
}

async function waitForPayment(publicId, expectedStatus) {
  const deadline = Date.now() + 3000
  let lastPayment = null

  while (Date.now() < deadline) {
    lastPayment = await Payment.findOne({ publicId }).lean()

    if (lastPayment?.status === expectedStatus) return lastPayment

    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  throw new Error(
    `Payment ${publicId} did not reach ${expectedStatus}; last status was ${lastPayment?.status}.`,
  )
}

async function waitForWebhookEvent(eventId, expectedStatus) {
  const deadline = Date.now() + 3000
  let lastEvent = null

  while (Date.now() < deadline) {
    lastEvent = await WebhookEvent.findOne({ eventId }).lean()

    if (lastEvent?.status === expectedStatus) return lastEvent

    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  throw new Error(
    `Webhook ${eventId} did not reach ${expectedStatus}; last status was ${lastEvent?.status}.`,
  )
}

function signWebhook(rawBody) {
  return createHmac('sha256', webhookKey).update(rawBody).digest('hex')
}

describe('Checkout.com payments API', () => {
  beforeAll(async () => {
    await connectDatabase()
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  beforeEach(async () => {
    await clearDatabase()
    providerState.sessionSequence = 0
    providerState.lastSessionPayload = null
    providerState.lastAuthorization = null
    providerState.failSession = false
    providerState.failPayment = false
    providerState.paymentStatus = 'Captured'
    providerState.paymentApproved = true
    providerState.paymentOverride = null
    installProviderFetchMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports health only when the database is connected', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'connected',
      provider: 'checkout',
      providerConfigured: true,
    })
    expect(response.body).not.toHaveProperty('mockPaymentsEnabled')
    expect(response.headers['x-request-id']).toBeTruthy()
  })

  it('returns exactly Cards and Apple Pay', async () => {
    const response = await request(app).get('/api/v1/payment-methods')

    expect(response.status).toBe(200)
    expect(response.body.data.methods).toHaveLength(2)
    expect(
      response.body.data.methods.map((method) => method.id),
    ).toEqual(['card', 'apple_pay'])

    const methods = Object.fromEntries(
      response.body.data.methods.map((method) => [method.id, method]),
    )

    expect(methods.card).toMatchObject({
      name: 'Cards',
      availability: 'available',
      mode: 'sandbox',
      selectable: true,
      providerReady: true,
      providerMethod: 'card',
      flowComponent: 'card',
    })
    expect(methods.apple_pay).toMatchObject({
      name: 'Apple Pay',
      availability: 'available',
      mode: 'sandbox',
      selectable: true,
      providerReady: true,
      providerMethod: 'applepay',
      flowComponent: 'applepay',
    })
    expect(response.body.data.meta).toMatchObject({
      provider: 'checkout',
      environment: 'sandbox',
      providerConnected: true,
      publicKey: 'pk_test_public',
      applePayEnabled: true,
      configSource: 'server',
    })
    expect(response.body.data.meta.cardSchemes).toEqual([
      'visa',
      'mastercard',
      'mada',
    ])
    expect(JSON.stringify(response.body)).not.toContain('sk_test_secret')
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('creates a server-priced order and returns the expected VAT total', async () => {
    const data = await createOrder()

    expect(data.order.reference).toMatch(/^ORD-\d{4}-\d{4}$/)
    expect(data.order.items[0]).toMatchObject({
      id: 'riwaq-esp-01',
      quantity: 1,
      unitPriceMinor: 129900,
      lineTotalMinor: 129900,
    })
    expect(data.order.discount).toMatchObject({
      code: 'WELCOME100',
      amountMinor: 10000,
    })
    expect(data.totals).toMatchObject({
      subtotalMinor: 129900,
      discountMinor: 10000,
      taxableBaseMinor: 119900,
      taxMinor: 17985,
      shippingMinor: 0,
      totalMinor: 137885,
      currency: 'SAR',
    })
  })

  it('rejects client-supplied prices and unknown fields', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .send({
        ...orderInput,
        items: [
          {
            productId: 'riwaq-esp-01',
            quantity: 1,
            unitPriceMinor: 1,
          },
        ],
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects unknown products and promotions', async () => {
    const productResponse = await request(app)
      .post('/api/v1/orders')
      .send({
        ...orderInput,
        items: [{ productId: 'not-a-product', quantity: 1 }],
      })

    expect(productResponse.status).toBe(422)
    expect(productResponse.body.error.code).toBe('INVALID_PRODUCT')

    const promotionResponse = await request(app)
      .post('/api/v1/orders')
      .send({ ...orderInput, promotionCode: 'NOTREAL' })

    expect(promotionResponse.status).toBe(422)
    expect(promotionResponse.body.error.code).toBe('INVALID_PROMOTION')
  })

  it('makes order creation idempotent and rejects key reuse', async () => {
    const idempotencyKey = key('order-idempotent')
    const first = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(orderInput)
    const second = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(orderInput)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.data.order.id).toBe(first.body.data.order.id)

    const conflicting = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...orderInput, promotionCode: null })

    expect(conflicting.status).toBe(409)
    expect(conflicting.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('returns a stored order by public id', async () => {
    const created = await createOrder()
    const response = await request(app).get(
      `/api/v1/orders/${created.order.id}`,
    )

    expect(response.status).toBe(200)
    expect(response.body.data.order.id).toBe(created.order.id)
    expect(response.body.data.totals.totalMinor).toBe(137885)
  })

  it('creates a Checkout.com card Payment Session', async () => {
    const order = await createOrder()
    const response = await createPayment(order.order.id)

    expect(response.status).toBe(201)
    expect(response.body.data.payment).toMatchObject({
      mode: 'sandbox',
      provider: 'checkout',
      providerLabel: 'Checkout.com Flow',
      providerReady: true,
      status: 'REQUIRES_ACTION',
      amountMinor: 137885,
      currency: 'SAR',
      methodId: 'card',
      orderReference: order.order.reference,
    })
    expect(response.body.data.payment.flow).toMatchObject({
      connected: true,
      publicKey: 'pk_test_public',
      environment: 'sandbox',
      component: 'card',
      cardSchemes: ['visa', 'mastercard', 'mada'],
      session: {
        id: 'ps_test_1',
        payment_session_token: 'pst_ps_test_1',
      },
    })
    expect(JSON.stringify(response.body)).not.toContain('sk_test_secret')

    expect(providerState.lastAuthorization).toBe('Bearer sk_test_secret')
    expect(providerState.lastSessionPayload).toMatchObject({
      amount: 137885,
      currency: 'SAR',
      reference: order.order.reference,
      enabled_payment_methods: ['card'],
      capture: true,
      processing_channel_id: 'pc_test',
      '3ds': { enabled: true },
      success_url: expect.stringContaining(
        `/payment/${response.body.data.payment.id}/result`,
      ),
      failure_url: expect.stringContaining(
        `/payment/${response.body.data.payment.id}/result`,
      ),
      metadata: {
        local_payment_id: response.body.data.payment.id,
      },
    })
    expect(providerState.lastSessionPayload.items).toEqual([
      {
        reference: 'RIWAQ-ESP-01',
        name: 'Riwāq Home Espresso Machine',
        quantity: 1,
        unit_price: 129900,
        total_amount: 119900,
        discount_amount: 10000,
        tax_amount: 17985,
      },
    ])
    expect(
      providerState.lastSessionPayload.items.reduce(
        (sum, item) => sum + item.total_amount + item.tax_amount,
        0,
      ),
    ).toBe(providerState.lastSessionPayload.amount)
    expect(providerState.lastSessionPayload.metadata.local_payment_token).toBeTruthy()
  })

  it('creates a Checkout.com Apple Pay Payment Session', async () => {
    const order = await createOrder()
    const response = await createPayment(order.order.id, 'apple_pay')

    expect(response.status).toBe(201)
    expect(response.body.data.payment).toMatchObject({
      methodId: 'apple_pay',
      methodName: 'Apple Pay',
      status: 'REQUIRES_ACTION',
      flow: {
        connected: true,
        component: 'applepay',
      },
    })
    expect(providerState.lastSessionPayload.enabled_payment_methods).toEqual([
      'applepay',
    ])
    expect(providerState.lastSessionPayload['3ds']).toBeUndefined()
  })

  it('returns the payment with its server-priced order', async () => {
    const order = await createOrder()
    const paymentResponse = await createPayment(order.order.id)
    const payment = paymentResponse.body.data.payment

    const response = await request(app).get(`/api/v1/payments/${payment.id}`)

    expect(response.status).toBe(200)
    expect(response.body.data.payment.order.id).toBe(order.order.id)
    expect(response.body.data.payment.totals.totalMinor).toBe(137885)
    expect(response.body.data.payment.order.totals.totalMinor).toBe(137885)
  })

  it('verifies a captured provider payment and marks the order paid', async () => {
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment

    const verified = await request(app)
      .post(`/api/v1/payments/${payment.id}/verify`)
      .send({ providerPaymentId: 'pay_captured_1' })

    expect(verified.status).toBe(200)
    expect(verified.body.data.payment).toMatchObject({
      status: 'CAPTURED',
      providerStatus: 'Captured',
      verification: {
        source: 'provider',
      },
    })
    expect(verified.body.data.verification).toMatchObject({
      verified: true,
      source: 'provider',
      reason: null,
    })
    expect(verified.body.data.payment.order.status).toBe('paid')

    const stored = await Payment.findOne({ publicId: payment.id }).lean()
    expect(stored.providerPaymentId).toBe('pay_captured_1')
    expect(stored.verifiedAt).toBeTruthy()

    const orderAfter = await request(app).get(
      `/api/v1/orders/${order.order.id}`,
    )
    expect(orderAfter.body.data.order.status).toBe('paid')
  })

  it('does not fulfil an authorized-only payment', async () => {
    providerState.paymentStatus = 'Authorized'
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment

    const verified = await request(app)
      .post(`/api/v1/payments/${payment.id}/verify`)
      .send({ providerPaymentId: 'pay_authorized_1' })

    expect(verified.status).toBe(200)
    expect(verified.body.data.payment.status).toBe('AUTHORIZED')
    expect(verified.body.data.payment.order.status).toBe('open')

    const orderAfter = await request(app).get(
      `/api/v1/orders/${order.order.id}`,
    )
    expect(orderAfter.body.data.order.status).toBe('open')
  })

  it('fails a captured provider payment when approved is false', async () => {
    providerState.paymentStatus = 'Captured'
    providerState.paymentApproved = false
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment

    const verified = await request(app)
      .post(`/api/v1/payments/${payment.id}/verify`)
      .send({ providerPaymentId: 'pay_not_approved_1' })

    expect(verified.status).toBe(200)
    expect(verified.body.data.payment.status).toBe('FAILED')
    expect(verified.body.data.payment.order.status).toBe('open')
  })

  it('blocks a new payment when provider verification is unavailable', async () => {
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment
    providerState.failPayment = true

    const verified = await request(app)
      .post(`/api/v1/payments/${payment.id}/verify`)
      .send({ providerPaymentId: 'pay_uncertain_1' })

    expect(verified.status).toBe(502)
    expect(verified.body.error.code).toBe('PROVIDER_ERROR')

    const stored = await Payment.findOne({ publicId: payment.id }).lean()
    expect(stored.status).toBe('UNKNOWN')
    expect(stored.providerPaymentId).toBe('pay_uncertain_1')
    expect(stored.failureCode).toBe('VERIFICATION_PENDING')

    const second = await createPayment(order.order.id)

    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('ORDER_PAYMENT_IN_PROGRESS')
    expect(second.body.error.details).toEqual({
      paymentId: payment.id,
      status: 'UNKNOWN',
    })
  })

  it('blocks a second payment while an authorization is unsettled', async () => {
    providerState.paymentStatus = 'Authorized'
    const order = await createOrder()
    const first = (await createPayment(order.order.id)).body.data.payment

    const verified = await request(app)
      .post(`/api/v1/payments/${first.id}/verify`)
      .send({ providerPaymentId: 'pay_authorized_in_progress' })

    expect(verified.status).toBe(200)
    expect(verified.body.data.payment.status).toBe('AUTHORIZED')

    const second = await createPayment(order.order.id)

    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('ORDER_PAYMENT_IN_PROGRESS')
    expect(second.body.error.details).toEqual({
      paymentId: first.id,
      status: 'AUTHORIZED',
    })
    expect(providerState.sessionSequence).toBe(1)
  })

  it('reports a pending verification before a provider payment exists', async () => {
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment

    const verified = await request(app).post(
      `/api/v1/payments/${payment.id}/verify`,
    )

    expect(verified.status).toBe(200)
    expect(verified.body.data.verification).toEqual({
      verified: false,
      source: 'none',
      verifiedAt: null,
      reason: 'provider_payment_pending',
    })
  })

  it('rejects a provider payment that does not match the attempt', async () => {
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment
    providerState.paymentOverride = { amount: 1 }

    const verified = await request(app)
      .post(`/api/v1/payments/${payment.id}/verify`)
      .send({ providerPaymentId: 'pay_mismatch_1' })

    expect(verified.status).toBe(409)
    expect(verified.body.error.code).toBe('PROVIDER_PAYMENT_MISMATCH')
  })

  it('processes a signed captured webhook and marks the order paid', async () => {
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment
    const metadata = {
      ...providerState.lastSessionPayload.metadata,
      cko_payment_session_id: payment.flow.session.id,
    }
    const payload = {
      id: `evt_${randomUUID()}`,
      type: 'payment_captured',
      data: {
        id: 'pay_webhook_1',
        amount: 137885,
        currency: 'SAR',
        reference: order.order.reference,
        status: 'Captured',
        approved: true,
        metadata,
      },
    }
    const rawBody = JSON.stringify(payload)
    const signature = signWebhook(rawBody)

    const response = await request(app)
      .post('/api/v1/webhooks/checkout')
      .set('Content-Type', 'application/json')
      .set('Cko-Signature', signature)
      .send(rawBody)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ received: true })

    const event = await waitForWebhookEvent(payload.id, 'processed')
    expect(event.providerPaymentId).toBe('pay_webhook_1')
    expect(event.localPaymentId).toBe(payment.id)

    await waitForPayment(payment.id, 'CAPTURED')
    const orderAfter = await request(app).get(
      `/api/v1/orders/${order.order.id}`,
    )
    expect(orderAfter.body.data.order.status).toBe('paid')
  })

  it('accepts duplicate webhooks without double-processing', async () => {
    const order = await createOrder()
    const payment = (await createPayment(order.order.id)).body.data.payment
    const payload = {
      id: `evt_${randomUUID()}`,
      type: 'payment_captured',
      data: {
        id: 'pay_webhook_duplicate',
        amount: 137885,
        currency: 'SAR',
        reference: order.order.reference,
        status: 'Captured',
        approved: true,
        metadata: {
          ...providerState.lastSessionPayload.metadata,
          cko_payment_session_id: payment.flow.session.id,
        },
      },
    }
    const rawBody = JSON.stringify(payload)
    const signature = signWebhook(rawBody)

    for (let index = 0; index < 2; index += 1) {
      const response = await request(app)
        .post('/api/v1/webhooks/checkout')
        .set('Content-Type', 'application/json')
        .set('Cko-Signature', signature)
        .send(rawBody)

      expect(response.status).toBe(200)
    }

    await waitForPayment(payment.id, 'CAPTURED')
    expect(
      await WebhookEvent.countDocuments({ eventId: payload.id }),
    ).toBe(1)
  })

  it('rejects a webhook with an invalid signature', async () => {
    const payload = {
      id: `evt_${randomUUID()}`,
      type: 'payment_captured',
      data: { id: 'pay_invalid_signature' },
    }

    const response = await request(app)
      .post('/api/v1/webhooks/checkout')
      .set('Content-Type', 'application/json')
      .set('Cko-Signature', '00'.repeat(32))
      .send(JSON.stringify(payload))

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE')
  })

  it('maps a provider failure to a safe 502 and fails the local attempt', async () => {
    providerState.failSession = true
    const order = await createOrder()
    const response = await createPayment(order.order.id)

    expect(response.status).toBe(502)
    expect(response.body.error.code).toBe('PROVIDER_ERROR')
    expect(response.body.error.message).not.toContain('provider unavailable')
    expect(response.body.error.details).toEqual({
      providerRequestId: 'req_test_123',
      providerStatus: 500,
    })

    const stored = await Payment.findOne({
      orderReference: order.order.reference,
    }).lean()
    expect(stored.status).toBe('FAILED')
    expect(stored.failureCode).toBe('CHECKOUT_PROVIDER_ERROR')
  })

  it('rejects methods that are not configured for selection', async () => {
    const order = await createOrder()

    for (const methodId of ['mada', 'visa', 'stc_pay', 'tabby']) {
      const response = await createPayment(order.order.id, methodId)

      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('PAYMENT_METHOD_UNAVAILABLE')
    }
  })

  it('reuses an idempotent payment-session response', async () => {
    const order = await createOrder()
    const idempotencyKey = key('payment-idempotent')
    const payload = {
      orderId: order.order.id,
      methodId: 'card',
      customer,
    }

    const first = await request(app)
      .post('/api/v1/payments/session')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
    const second = await request(app)
      .post('/api/v1/payments/session')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.data.payment.id).toBe(first.body.data.payment.id)
    expect(providerState.sessionSequence).toBe(1)
  })

  it('rejects a payment when the stored order total was tampered with', async () => {
    const order = await createOrder()

    await Order.updateOne(
      { publicId: order.order.id },
      { $set: { 'totals.totalMinor': 1 } },
    )

    const response = await createPayment(order.order.id)

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('ORDER_AMOUNT_CHANGED')
  })

  it('validates session input and reports missing resources', async () => {
    const invalid = await request(app)
      .post('/api/v1/payments/session')
      .send({ orderId: 'ord_missing', methodId: 'card' })

    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')

    const missing = await request(app)
      .post('/api/v1/payments/session')
      .send({
        orderId: 'ord_missing',
        methodId: 'card',
        customer,
      })

    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('NOT_FOUND')

    const unknownPayment = await request(app).get(
      '/api/v1/payments/pmt_missing',
    )
    expect(unknownPayment.status).toBe(404)
  })

  it('rejects a reused idempotency key when the request differs', async () => {
    const order = await createOrder()
    const idempotencyKey = key('payment-conflict')
    const payload = {
      orderId: order.order.id,
      methodId: 'card',
      customer,
    }

    await request(app)
      .post('/api/v1/payments/session')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)

    const response = await request(app)
      .post('/api/v1/payments/session')
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...payload, methodId: 'apple_pay' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('removes the old mock payment completion endpoint', async () => {
    const response = await request(app)
      .post('/api/v1/payments/pmt_missing/mock/complete')
      .send({ outcome: 'approved' })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('returns a JSON 404 for an unknown route', async () => {
    const response = await request(app).get('/api/v1/not-a-route')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
    expect(response.body.error.requestId).toBeTruthy()
  })
})
