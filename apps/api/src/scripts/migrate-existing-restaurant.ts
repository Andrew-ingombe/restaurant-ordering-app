import "dotenv/config"
import mongoose from "mongoose"

import { connectDatabase } from "../config/database"
import { MenuCategory } from "../models/menu-category.model"
import { MenuItem } from "../models/menu-item.model"
import { Order } from "../models/order.model"
import { Payment } from "../models/payment.model"
import { Restaurant } from "../models/restaurant.model"
import { RestaurantTable } from "../models/restaurant-table.model"
import { User } from "../models/user.model"

const unscopedFilter = {
  $or: [{ restaurant: { $exists: false } }, { restaurant: null }],
}

const migrateExistingRestaurant = async () => {
  const slug = process.env.MIGRATION_RESTAURANT_SLUG
  const dryRun = process.env.MIGRATION_DRY_RUN === "true"

  if (!slug) {
    throw new Error("MIGRATION_RESTAURANT_SLUG is required")
  }

  await connectDatabase()

  const restaurant = await Restaurant.findOne({ slug })

  if (!restaurant) {
    throw new Error(`Restaurant not found for slug: ${slug}`)
  }

  const counts = {
    users: await User.countDocuments({
      role: { $ne: "platform_admin" },
      ...unscopedFilter,
    }),
    categories: await MenuCategory.countDocuments(unscopedFilter),
    menuItems: await MenuItem.countDocuments(unscopedFilter),
    tables: await RestaurantTable.countDocuments(unscopedFilter),
    orders: await Order.countDocuments(unscopedFilter),
    payments: await Payment.countDocuments(unscopedFilter),
  }

  console.log(`Target restaurant: ${restaurant.name} (${restaurant.slug})`)
  console.log("Unscoped records:", counts)

  if (dryRun) {
    console.log("Dry run complete. No records were changed.")
    return
  }

  const restaurantAssignment = {
    $set: {
      restaurant: restaurant._id,
    },
  }

  const results = {
    users: await User.updateMany(
      {
        role: { $ne: "platform_admin" },
        ...unscopedFilter,
      },
      restaurantAssignment
    ),
    categories: await MenuCategory.updateMany(
      unscopedFilter,
      restaurantAssignment
    ),
    menuItems: await MenuItem.updateMany(unscopedFilter, restaurantAssignment),
    tables: await RestaurantTable.updateMany(
      unscopedFilter,
      restaurantAssignment
    ),
    orders: await Order.updateMany(unscopedFilter, restaurantAssignment),
    payments: await Payment.updateMany(unscopedFilter, restaurantAssignment),
  }

  const tableIndexes = await RestaurantTable.collection.indexes()
  const oldNameIndex = tableIndexes.find(
    (index) => index.name === "name_1" && index.unique
  )

  if (oldNameIndex) {
    await RestaurantTable.collection.dropIndex("name_1")
  }

  await RestaurantTable.collection.createIndex(
    {
      restaurant: 1,
      name: 1,
    },
    {
      unique: true,
      name: "restaurant_1_name_1",
      partialFilterExpression: {
        restaurant: { $type: "objectId" },
      },
    }
  )

  const remaining = {
    users: await User.countDocuments({
      role: { $ne: "platform_admin" },
      ...unscopedFilter,
    }),
    categories: await MenuCategory.countDocuments(unscopedFilter),
    menuItems: await MenuItem.countDocuments(unscopedFilter),
    tables: await RestaurantTable.countDocuments(unscopedFilter),
    orders: await Order.countDocuments(unscopedFilter),
    payments: await Payment.countDocuments(unscopedFilter),
  }

  console.log("Modified records:", {
    users: results.users.modifiedCount,
    categories: results.categories.modifiedCount,
    menuItems: results.menuItems.modifiedCount,
    tables: results.tables.modifiedCount,
    orders: results.orders.modifiedCount,
    payments: results.payments.modifiedCount,
  })

  console.log("Remaining unscoped records:", remaining)

  if (Object.values(remaining).some((count) => count > 0)) {
    throw new Error("Some records remain unscoped")
  }

  console.log("Existing restaurant data migrated successfully")
}

migrateExistingRestaurant()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
