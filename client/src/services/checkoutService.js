import { httpGateway } from './http/httpGateway.js'

/**
 * Single injection point for the UI. The browser talks only to this
 * application's API; Checkout.com secrets never leave the server.
 */
export const checkoutService = {
  getCheckoutData() {
    return httpGateway.getCheckoutData()
  },

  createPaymentSession(payload) {
    return httpGateway.createPaymentSession(payload)
  },

  getPaymentAttempt(attemptId) {
    return httpGateway.getPaymentAttempt(attemptId)
  },

  verifyPayment(attemptId, providerPaymentId) {
    return httpGateway.verifyPayment(attemptId, providerPaymentId)
  },
}
