import { apiClient } from './apiClient.js'
import { storefrontCart } from '../../data/storefrontCart.js'

const ORDER_STORAGE_KEY = 'sahla.api.order.v1'
const ORDER_KEY_STORAGE_KEY = 'sahla.api.orderKey.v1'

let checkoutDataRequest = null

function createIdempotencyKey(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`
}

function readSessionValue(key) {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionValue(key, value) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // The order is still returned for this page view. A reload will create a
    // new server order when storage is blocked.
  }
}

function removeSessionValue(key) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Ignore storage failures.
  }
}

function getOrCreateOrderKey() {
  const existing = readSessionValue(ORDER_KEY_STORAGE_KEY)
  if (existing) return existing

  const key = createIdempotencyKey('order')
  writeSessionValue(ORDER_KEY_STORAGE_KEY, key)
  return key
}

function clearStoredOrder() {
  removeSessionValue(ORDER_STORAGE_KEY)
  removeSessionValue(ORDER_KEY_STORAGE_KEY)
}

async function createServerOrder() {
  const { data } = await apiClient.post('/orders', storefrontCart, {
    headers: {
      'Idempotency-Key': getOrCreateOrderKey(),
    },
  })

  writeSessionValue(ORDER_STORAGE_KEY, data.data.order.id)
  return data.data
}

async function getServerOrder(orderId) {
  const { data } = await apiClient.get(`/orders/${orderId}`)
  return data.data
}

async function getOrCreateOrder() {
  const storedOrderId = readSessionValue(ORDER_STORAGE_KEY)

  if (storedOrderId) {
    try {
      const stored = await getServerOrder(storedOrderId)

      // A completed order cannot be paid again. Starting from the same browser
      // session should create a fresh order when the customer returns to the
      // storefront after a successful payment.
      if (stored.order.status === 'open') {
        return stored
      }

      clearStoredOrder()
    } catch (error) {
      if (error?.status !== 404) throw error
      clearStoredOrder()
    }
  }

  return createServerOrder()
}

async function loadCheckoutData() {
  const [methodsResponse, order] = await Promise.all([
    apiClient.get('/payment-methods'),
    getOrCreateOrder(),
  ])

  return {
    order: order.order,
    totals: order.totals,
    methods: methodsResponse.data.data.methods,
    meta: methodsResponse.data.data.meta,
  }
}

export const httpGateway = {
  async getCheckoutData() {
    // React StrictMode and retries can call this twice. Sharing the request
    // avoids creating parallel server orders for the same page view.
    if (!checkoutDataRequest) {
      checkoutDataRequest = loadCheckoutData().finally(() => {
        checkoutDataRequest = null
      })
    }

    return checkoutDataRequest
  },

  async createPaymentSession(payload) {
    const { data } = await apiClient.post(
      '/payments/session',
      {
        orderId: payload.orderId,
        methodId: payload.methodId,
        customer: payload.customer,
      },
      {
        headers: {
          'Idempotency-Key': createIdempotencyKey('payment'),
        },
      },
    )

    return {
      session: data.data.payment,
    }
  },

  async getPaymentAttempt(paymentId) {
    const { data } = await apiClient.get(`/payments/${paymentId}`)
    return data.data.payment
  },

  async verifyPayment(paymentId, providerPaymentId) {
    const body = providerPaymentId ? { providerPaymentId } : {}
    const { data } = await apiClient.post(
      `/payments/${paymentId}/verify`,
      body,
    )
    return data.data
  },
}
