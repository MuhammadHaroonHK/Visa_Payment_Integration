import mongoose from 'mongoose'

const idempotencySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, maxlength: 200 },
    scope: { type: String, required: true, maxlength: 80 },
    requestHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
      required: true,
    },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
)

idempotencySchema.index({ key: 1, scope: 1 }, { unique: true })
idempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Idempotency =
  mongoose.models.Idempotency ??
  mongoose.model('Idempotency', idempotencySchema)
