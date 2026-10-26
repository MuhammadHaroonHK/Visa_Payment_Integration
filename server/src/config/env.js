import { z } from 'zod'

const optionalString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
)

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: optionalString,
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  CHECKOUT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  CHECKOUT_API_PREFIX: optionalString,
  CHECKOUT_PUBLIC_KEY: optionalString,
  CHECKOUT_SECRET_KEY: optionalString,
  CHECKOUT_WEBHOOK_SIGNATURE_KEY: optionalString,
  CHECKOUT_WEBHOOK_AUTH_KEY: optionalString,
  CHECKOUT_PROCESSING_CHANNEL_ID: optionalString,
  CHECKOUT_APPLE_PAY_ENABLED: z.enum(['true', 'false']).default('false'),
  CHECKOUT_APPLE_PAY_DOMAIN: optionalString,
  CHECKOUT_CARD_SCHEMES: z.string().default('visa,mastercard,mada'),
  CHECKOUT_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(10000),
})

const parsed = envSchema.parse(process.env)

if (parsed.NODE_ENV === 'production' && !parsed.MONGODB_URI) {
  throw new Error('MONGODB_URI is required when NODE_ENV=production.')
}

export const env = Object.freeze({
  ...parsed,
  CHECKOUT_APPLE_PAY_ENABLED: parsed.CHECKOUT_APPLE_PAY_ENABLED === 'true',
  IS_PRODUCTION: parsed.NODE_ENV === 'production',
  IS_TEST: parsed.NODE_ENV === 'test',
})

export function isCheckoutConfigured() {
  return Boolean(
    env.CHECKOUT_API_PREFIX &&
      env.CHECKOUT_PUBLIC_KEY &&
      env.CHECKOUT_SECRET_KEY,
  )
}

const SUPPORTED_CARD_SCHEMES = new Set([
  'american_express',
  'cartes_bancaires',
  'china_union_pay',
  'diners_club_international',
  'discover',
  'jcb',
  'mada',
  'mastercard',
  'visa',
])

const DEFAULT_CARD_SCHEMES = ['visa', 'mastercard', 'mada']

export function checkoutCardSchemes() {
  const schemes = env.CHECKOUT_CARD_SCHEMES.split(',')
    .map((scheme) => scheme.trim().toLowerCase())
    .map((scheme) => (scheme === 'amex' ? 'american_express' : scheme))
    .filter((scheme) => SUPPORTED_CARD_SCHEMES.has(scheme))

  return schemes.length
    ? [...new Set(schemes)]
    : [...DEFAULT_CARD_SCHEMES]
}

export function assertProviderConfiguration() {
  const providerValues = [
    env.CHECKOUT_API_PREFIX,
    env.CHECKOUT_PUBLIC_KEY,
    env.CHECKOUT_SECRET_KEY,
  ]
  const hasAnyProviderValue = providerValues.some(Boolean)
  const hasCompleteProviderConfiguration = providerValues.every(Boolean)

  if (hasAnyProviderValue && !hasCompleteProviderConfiguration) {
    throw new Error(
      'CHECKOUT_API_PREFIX, CHECKOUT_PUBLIC_KEY and CHECKOUT_SECRET_KEY must be configured together.',
    )
  }

  if (env.IS_PRODUCTION && !hasCompleteProviderConfiguration) {
    throw new Error(
      'Checkout.com provider configuration is required when NODE_ENV=production.',
    )
  }

  if (env.IS_PRODUCTION && !env.CHECKOUT_WEBHOOK_SIGNATURE_KEY) {
    throw new Error(
      'CHECKOUT_WEBHOOK_SIGNATURE_KEY is required when NODE_ENV=production.',
    )
  }
}
