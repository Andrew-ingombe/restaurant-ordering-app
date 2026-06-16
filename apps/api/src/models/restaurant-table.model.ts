import { model, Schema } from "mongoose"

const restaurantTableSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
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

restaurantTableSchema.index(
  { restaurant: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: {
      restaurant: { $type: "objectId" },
    },
  }
)

export const RestaurantTable = model("RestaurantTable", restaurantTableSchema)
