import 'dotenv/config'
import { createApp } from './app.js'
import {
  connectDatabase,
  disconnectDatabase,
} from './config/database.js'
import { assertProviderConfiguration, env } from './config/env.js'
import { reprocessPendingCheckoutWebhooks } from './services/checkoutWebhookService.js'

async function start() {
  assertProviderConfiguration()
  await connectDatabase()

  await reprocessPendingCheckoutWebhooks()

  const sweep = setInterval(() => {
    void reprocessPendingCheckoutWebhooks().catch((error) => {
      console.error('Webhook retry sweep failed.', error)
    })
  }, 60 * 1000)
  sweep.unref()

  const app = createApp()
  const server = app.listen(env.PORT, () => {
    console.info(
      `Saudi payments API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
    )
  })

  let shuttingDown = false

  async function shutdown(signal) {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`Received ${signal}. Shutting down.`)

    clearInterval(sweep)

    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })

    setTimeout(() => {
      console.error('Forced shutdown after timeout.')
      process.exit(1)
    }, 10000).unref()
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

start().catch((error) => {
  console.error('The API failed to start.', error)
  process.exitCode = 1
})
