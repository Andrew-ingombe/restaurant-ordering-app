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
      required: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["dine_in", "takeaway"],
      default: "dine_in",
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
  },
  {
    timestamps: true,
  }
)

export const Order = model("Order", orderSchema)
