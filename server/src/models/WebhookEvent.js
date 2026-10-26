import mongoose from 'mongoose'

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    providerPaymentId: { type: String, default: null, index: true },
    providerSessionId: { type: String, default: null, index: true },
    localPaymentId: { type: String, default: null, index: true },
    payloadHash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'ignored', 'failed'],
      default: 'received',
      required: true,
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true, versionKey: false },
)

webhookEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const WebhookEvent =
  mongoose.models.WebhookEvent ??
  mongoose.model('WebhookEvent', webhookEventSchema)
