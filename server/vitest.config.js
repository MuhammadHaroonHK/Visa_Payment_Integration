import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5173',
      CHECKOUT_ENVIRONMENT: 'sandbox',
      CHECKOUT_API_PREFIX: 'test',
      CHECKOUT_PUBLIC_KEY: 'pk_test_public',
      CHECKOUT_SECRET_KEY: 'sk_test_secret',
      CHECKOUT_WEBHOOK_SIGNATURE_KEY: 'whsec_test',
      CHECKOUT_APPLE_PAY_ENABLED: 'true',
      CHECKOUT_APPLE_PAY_DOMAIN: 'sahla.example',
      CHECKOUT_CARD_SCHEMES: 'visa,mastercard,mada',
      CHECKOUT_PROCESSING_CHANNEL_ID: 'pc_test',
    },
    testTimeout: 30000,
    hookTimeout: 120000,
  },
})
