import { model, Schema } from "mongoose"

const paymentSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    waiter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["manual", "lenco"],
      default: "lenco",
    },
    method: {
      type: String,
      enum: ["", "cash", "card_pos", "manual_mobile_money", "lenco"],
      default: "",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "ZMW",
    },
    status: {
      type: String,
      enum: ["pending", "successful", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    providerTransactionId: {
      type: String,
      default: "",
    },
    providerResponse: {
      type: Schema.Types.Mixed,
    },
    verifiedAt: {
      type: Date,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: false,
      index: true,
    },
    lastWebhookEvent: {
      type: String,
      default: "",
    },
    lastWebhookPayload: {
      type: Schema.Types.Mixed,
    },
    lastWebhookReceivedAt: {
      type: Date,
    },
    lastReconciledAt: {
      type: Date,
    },
    reconciliationCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

paymentSchema.index({ restaurant: 1, createdAt: -1 })
paymentSchema.index({ restaurant: 1, status: 1 })
paymentSchema.index({ restaurant: 1, method: 1 })
paymentSchema.index({ restaurant: 1, reference: 1 })
paymentSchema.index({ restaurant: 1, lastReconciledAt: 1 })

export const Payment = model("Payment", paymentSchema)
