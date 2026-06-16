import { model, Schema } from "mongoose"

const menuItemSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: "MenuCategory",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    available: {
      type: Boolean,
      default: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
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

menuItemSchema.index({ restaurant: 1, category: 1, available: 1 })

export const MenuItem = model("MenuItem", menuItemSchema)
