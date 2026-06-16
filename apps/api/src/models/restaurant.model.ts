import { model, Schema } from "mongoose"

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"

const restaurantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    settings: {
      currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: "ZMW",
      },
      timezone: {
        type: String,
        trim: true,
        default: "Africa/Lusaka",
      },
      phone: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
      address: {
        type: String,
        trim: true,
        default: "",
      },
      receiptFooter: {
        type: String,
        trim: true,
        default: "",
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ["pilot", "starter", "growth"],
        default: "pilot",
      },
      status: {
        type: String,
        enum: ["trialing", "active", "past_due", "suspended", "cancelled"],
        default: "trialing",
        index: true,
      },
      trialEndsAt: Date,
      currentPeriodStartsAt: Date,
      currentPeriodEndsAt: Date,
      gracePeriodEndsAt: Date,
    },
    paymentSettings: {
      provider: {
        type: String,
        enum: ["lenco"],
        default: "lenco",
      },
      environment: {
        type: String,
        enum: ["sandbox", "production"],
        default: "sandbox",
      },
      publicKey: {
        type: String,
        default: "",
        select: false,
      },
      encryptedSecretKey: {
        type: String,
        default: "",
        select: false,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
)

export const Restaurant = model("Restaurant", restaurantSchema)
