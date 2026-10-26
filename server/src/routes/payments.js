import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import {
  idempotencyKeyMiddleware,
  withIdempotency,
} from '../services/idempotency.js'
import {
  createPayment,
  getPayment,
  verifyPayment,
} from '../services/paymentService.js'

const customerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254),
  })
  .strict()

const createPaymentSchema = z
  .object({
    orderId: z.string().trim().min(1).max(120),
    methodId: z.string().trim().min(1).max(64),
    customer: customerSchema,
  })
  .strict()

const paymentParamsSchema = z
  .object({
    paymentId: z.string().trim().min(1).max(120),
  })
  .strict()

const verifyPaymentSchema = z
  .object({
    providerPaymentId: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .default({})

export const paymentsRouter = Router()

paymentsRouter.post(
  '/session',
  idempotencyKeyMiddleware,
  validate({ body: createPaymentSchema }),
  async (request, response) => {
    const body = request.validated.body
    const data = await withIdempotency({
      key: request.idempotencyKey,
      scope: 'create_payment',
      payload: body,
      handler: () => createPayment(body),
    })

    response.status(201).json({ data })
  },
)

paymentsRouter.get(
  '/:paymentId',
  validate({ params: paymentParamsSchema }),
  async (request, response) => {
    const data = await getPayment(request.validated.params.paymentId)
    response.json({ data })
  },
)

paymentsRouter.post(
  '/:paymentId/verify',
  validate({
    params: paymentParamsSchema,
    body: verifyPaymentSchema,
  }),
  async (request, response) => {
    const data = await verifyPayment(
      request.validated.params.paymentId,
      request.validated.body.providerPaymentId ?? null,
    )
    response.json({ data })
  },
)
