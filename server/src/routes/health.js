import mongoose from 'mongoose'
import { env, isCheckoutConfigured } from '../config/env.js'

export function healthHandler(_request, response) {
  const databaseConnected = mongoose.connection.readyState === 1

  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    service: 'saudi-payments-api',
    database: databaseConnected ? 'connected' : 'disconnected',
    environment: env.NODE_ENV,
    provider: 'checkout',
    providerConfigured: isCheckoutConfigured(),
    timestamp: new Date().toISOString(),
  })
}
