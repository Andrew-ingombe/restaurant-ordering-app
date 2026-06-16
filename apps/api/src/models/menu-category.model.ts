import { model, Schema } from "mongoose"

const menuCategorySchema = new Schema(
  {
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
    active: {
      type: Boolean,
      default: true,
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

menuCategorySchema.index({ restaurant: 1, active: 1, sortOrder: 1 })

export const MenuCategory = model("MenuCategory", menuCategorySchema)
