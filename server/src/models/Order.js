import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    reference: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const discountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    label: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const taxSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    rate: { type: Number, required: true, min: 0, max: 1 },
    amountMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const shippingSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    detail: { type: String, default: '' },
    amountMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const totalsSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotalMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, required: true, min: 0 },
    taxableBaseMinor: { type: Number, required: true, min: 0 },
    taxMinor: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0, max: 1 },
    shippingMinor: { type: Number, required: true, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `ord_${randomUUID()}`,
    },
    reference: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['open', 'paid', 'failed', 'cancelled'],
      default: 'open',
      required: true,
    },
    currency: { type: String, required: true, uppercase: true },
    locale: { type: String, required: true },
    country: { type: String, required: true, uppercase: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item.',
      },
    },
    discount: { type: discountSchema, default: undefined },
    tax: { type: taxSchema, required: true },
    shipping: { type: shippingSchema, required: true },
    totals: { type: totalsSchema, required: true },
    latestPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

orderSchema.index({ createdAt: -1 })

export const Order =
  mongoose.models.Order ?? mongoose.model('Order', orderSchema)
