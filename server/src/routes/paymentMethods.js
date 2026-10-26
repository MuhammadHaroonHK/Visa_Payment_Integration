import { Router } from 'express'
import { listPaymentMethods, paymentMethodsMeta } from '../domain/paymentMethods.js'

export const paymentMethodsRouter = Router()

paymentMethodsRouter.get('/', (_request, response) => {
  response.json({
    data: {
      methods: listPaymentMethods(),
      meta: paymentMethodsMeta(),
    },
  })
})
