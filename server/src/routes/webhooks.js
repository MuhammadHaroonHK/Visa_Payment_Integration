import { Router } from 'express'
import { verifyCheckoutWebhook } from '../providers/checkout/webhooks.js'
import {
  receiveCheckoutWebhook,
  scheduleCheckoutWebhookProcessing,
} from '../services/checkoutWebhookService.js'

export const webhooksRouter = Router()

webhooksRouter.post('/checkout', async (request, response) => {
  verifyCheckoutWebhook({
    rawBody: request.rawBody,
    signature: request.get('Cko-Signature'),
    authorization: request.get('Authorization'),
  })

  const { event, duplicate } = await receiveCheckoutWebhook(request.body)

  if (!duplicate || event?.status === 'failed') {
    scheduleCheckoutWebhookProcessing(event.eventId)
  }

  response.status(200).json({ received: true })
})
