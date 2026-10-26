import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { noStore } from './middleware/noStore.js'
import { requestContext } from './middleware/requestContext.js'
import { healthHandler } from './routes/health.js'
import { apiRouter } from './routes/index.js'
import { webhooksRouter } from './routes/webhooks.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(requestContext)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: [
        'Accept',
        'Content-Type',
        'Idempotency-Key',
        'X-Request-Id',
      ],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
      optionsSuccessStatus: 204,
    }),
  )
  app.use(
    express.json({
      limit: '32kb',
      verify: (request, _response, buffer) => {
        request.rawBody = Buffer.from(buffer)
      },
    }),
  )

  app.get('/health', healthHandler)

  app.use(
    '/api',
    noStore,
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (request) =>
        env.IS_TEST ||
        request.path === '/v1/webhooks/checkout',
      handler: (request, response) => {
        response.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Wait a moment and try again.',
            requestId: request.id,
          },
        })
      },
    }),
  )

  app.use('/api/v1/webhooks', webhooksRouter)
  app.use('/api/v1', apiRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
