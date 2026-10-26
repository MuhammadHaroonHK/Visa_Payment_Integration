import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import {
  idempotencyKeyMiddleware,
  withIdempotency,
} from '../services/idempotency.js'
import {
  createOrder,
  getOrderByPublicId,
} from '../services/orderService.js'

const itemSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    quantity: z.number().int().min(1).max(10),
  })
  .strict()

const createOrderSchema = z
  .object({
    items: z.array(itemSchema).min(1).max(20),
    promotionCode: z
      .union([z.string().trim().max(32), z.null()])
      .optional()
      .transform((value) => value || undefined),
    locale: z.enum(['en-SA', 'ar-SA']).default('en-SA'),
    currency: z.literal('SAR').default('SAR'),
  })
  .strict()

const orderParamsSchema = z
  .object({
    orderId: z.string().trim().min(1).max(120),
  })
  .strict()

export const ordersRouter = Router()

ordersRouter.post(
  '/',
  idempotencyKeyMiddleware,
  validate({ body: createOrderSchema }),
  async (request, response) => {
    const body = request.validated.body
    const data = await withIdempotency({
      key: request.idempotencyKey,
      scope: 'create_order',
      payload: body,
      handler: () => createOrder(body),
    })

    response.status(201).json({ data })
  },
)

ordersRouter.get(
  '/:orderId',
  validate({ params: orderParamsSchema }),
  async (request, response) => {
    const data = await getOrderByPublicId(request.validated.params.orderId)
    response.json({ data })
  },
)
