import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const methodSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    availability: { type: String, required: true },
    description: { type: String, default: '' },
    requirement: { type: String, default: '' },
    detail: { type: String, default: '' },
    docsUrl: { type: String, default: '' },
    providerLabel: { type: String, default: '' },
    providerMethod: { type: String, default: null },
    flowComponent: { type: String, default: null },
  },
  { _id: false },
)

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { _id: false },
)

const paymentSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `pmt_${randomUUID()}`,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderReference: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },
    methodId: { type: String, required: true },
    methodName: { type: String, required: true },
    method: { type: methodSnapshotSchema, required: true },
    customer: { type: customerSchema, required: true },
    provider: {
      type: String,
      enum: ['checkout'],
      required: true,
    },
    mode: {
      type: String,
      enum: ['sandbox', 'live'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'PENDING',
        'REQUIRES_ACTION',
        'AUTHORIZED',
        'CAPTURED',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
        'EXPIRED',
        'REFUNDED',
        'UNKNOWN',
      ],
      default: 'CREATED',
      required: true,
      index: true,
    },
    providerSessionId: { type: String, unique: true, sparse: true },
    providerSessionPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    providerPaymentId: { type: String, unique: true, sparse: true },
    providerStatus: { type: String, default: null },
    verificationToken: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    verificationSource: {
      type: String,
      enum: ['none', 'provider', 'webhook'],
      default: 'none',
      required: true,
    },
    verifiedAt: { type: Date, default: null },
    lastProviderSyncAt: { type: Date, default: null },
    failureCode: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
)

paymentSchema.index({ createdAt: -1 })

export const Payment =
  mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema)
