import { Router } from 'express'
import { ordersRouter } from './orders.js'
import { paymentMethodsRouter } from './paymentMethods.js'
import { paymentsRouter } from './payments.js'

export const apiRouter = Router()

apiRouter.use('/payment-methods', paymentMethodsRouter)
apiRouter.use('/orders', ordersRouter)
apiRouter.use('/payments', paymentsRouter)
