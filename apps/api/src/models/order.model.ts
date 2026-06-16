import { model, Schema } from "mongoose"

const orderItemSchema = new Schema(
  {
    menuItem: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
)

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    waiter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["dine_in", "takeaway"],
      default: "dine_in",
    },
    source: {
      type: String,
      enum: ["waiter", "customer_qr"],
      default: "waiter",
      index: true,
    },
    restaurantTable: {
      type: Schema.Types.ObjectId,
      ref: "RestaurantTable",
      index: true,
    },
    tableName: {
      type: String,
      trim: true,
      default: "",
    },
    customer: {
      name: {
        type: String,
        trim: true,
        default: "",
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
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
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
      enum: [
        "draft",
        "awaiting_waiter",
        "awaiting_payment",
        "submitted",
        "accepted",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

orderSchema.index({ restaurant: 1, createdAt: -1 })
orderSchema.index({ restaurant: 1, status: 1, createdAt: -1 })

export const Order = model("Order", orderSchema)
