import { Router } from "express"
import jwt from "jsonwebtoken"
import { Types } from "mongoose"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import { MenuCategory } from "../models/menu-category.model"
import { MenuItem } from "../models/menu-item.model"
import { RestaurantTable } from "../models/restaurant-table.model"

export const customerMenuRouter = Router()

const tokenSchema = z.string().trim().min(1)

type TableTokenPayload = {
  tableId: string
  restaurantId?: string
  purpose: "customer-menu"
}

customerMenuRouter.get(
  "/table/:token",
  asyncHandler(async (request, response) => {
    const tokenResult = tokenSchema.safeParse(request.params.token)

    if (!tokenResult.success) {
      response.status(400).json({
        message: "Invalid table menu link",
      })
      return
    }

    let payload: TableTokenPayload

    try {
      payload = jwt.verify(
        tokenResult.data,
        env.tableTokenSecret
      ) as TableTokenPayload
    } catch {
      response.status(401).json({
        message: "This table menu link is invalid",
      })
      return
    }

    if (
      payload.purpose !== "customer-menu" ||
      !Types.ObjectId.isValid(payload.tableId)
    ) {
      response.status(401).json({
        message: "This table menu link is invalid",
      })
      return
    }

    const table = await RestaurantTable.findOne({
      _id: payload.tableId,
      ...(payload.restaurantId ? { restaurant: payload.restaurantId } : {}),
      active: true,
    }).lean()

    if (!table?.restaurant) {
      response.status(404).json({
        message: "This table is unavailable",
      })
      return
    }

    const restaurantId = table.restaurant

    const categories = await MenuCategory.find({
      restaurant: restaurantId,
      active: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    const categoryIds = categories.map((category) => category._id)

    const items = await MenuItem.find({
      restaurant: restaurantId,
      available: true,
      category: { $in: categoryIds },
    })
      .populate("category", "name")
      .sort({ sortOrder: 1, name: 1 })
      .lean()

    response.json({
      table: {
        id: table._id,
        name: table.name,
      },
      categories,
      items,
    })
  })
)
