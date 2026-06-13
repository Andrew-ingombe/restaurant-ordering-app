import { model, Schema } from "mongoose"

const restaurantTableSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

export const RestaurantTable = model("RestaurantTable", restaurantTableSchema)
