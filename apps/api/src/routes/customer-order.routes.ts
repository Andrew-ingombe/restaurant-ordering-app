import { Router } from "express"
import jwt from "jsonwebtoken"
import { Types } from "mongoose"
import { z } from "zod"

import { env } from "../config/env"
import { normalizePreparationArea } from "../lib/kitchen-order"
import { getSocketServer } from "../lib/socket"
import { asyncHandler } from "../middleware/async-handler"
import { MenuCategory } from "../models/menu-category.model"
import { MenuItem } from "../models/menu-item.model"
import { Order } from "../models/order.model"
import { RestaurantTable } from "../models/restaurant-table.model"

export const customerOrderRouter = Router()

type TableTokenPayload = {
  tableId: string
  restaurantId?: string
  purpose: "customer-menu"
}

const customerOrderSchema = z.object({
  token: z.string().trim().min(1),
  customer: z.object({
    name: z.string().trim().max(100).optional().default(""),
    phone: z.string().trim().max(30).optional().default(""),
  }),
  items: z
    .array(
      z.object({
        menuItem: z.string().refine(Types.ObjectId.isValid, {
          message: "Invalid menu item",
        }),
        quantity: z.number().int().min(1).max(100),
        notes: z.string().trim().max(500).optional().default(""),
      })
    )
    .min(1),
})

const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.floor(100 + Math.random() * 900)

  return `ORD-${timestamp}-${random}`
}

customerOrderRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const result = customerOrderSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid order request",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    let payload: TableTokenPayload

    try {
      payload = jwt.verify(
        result.data.token,
        env.tableTokenSecret
      ) as TableTokenPayload
    } catch {
      response.status(401).json({
        message: "Invalid table menu link",
      })
      return
    }

    if (
      payload.purpose !== "customer-menu" ||
      !Types.ObjectId.isValid(payload.tableId)
    ) {
      response.status(401).json({
        message: "Invalid table menu link",
      })
      return
    }

    const table = await RestaurantTable.findOne({
      _id: payload.tableId,
      ...(payload.restaurantId ? { restaurant: payload.restaurantId } : {}),
      active: true,
    })

    if (!table?.restaurant) {
      response.status(404).json({
        message: "This table is unavailable",
      })
      return
    }

    const restaurantId = table.restaurant
    const requestedIds = result.data.items.map((item) => item.menuItem)

    const menuItems = await MenuItem.find({
      restaurant: restaurantId,
      _id: { $in: requestedIds },
      available: true,
    })

    if (menuItems.length !== new Set(requestedIds).size) {
      response.status(400).json({
        message: "One or more menu items are unavailable",
      })
      return
    }

    const categoryIds = Array.from(
      new Set(menuItems.map((item) => item.category.toString()))
    )

    const categories = await MenuCategory.find({
      restaurant: restaurantId,
      _id: { $in: categoryIds },
    })
      .select("preparationArea")
      .lean()

    const preparationAreaByCategoryId = new Map(
      categories.map((category) => [
        category._id.toString(),
        normalizePreparationArea(category.preparationArea),
      ])
    )

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]))

    const items = result.data.items.map((requestedItem) => {
      const menuItem = menuItemMap.get(requestedItem.menuItem)

      if (!menuItem) {
        throw new Error("Menu item not found")
      }

      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: requestedItem.quantity,
        notes: requestedItem.notes,
        lineTotal: menuItem.price * requestedItem.quantity,
        preparationArea:
          preparationAreaByCategoryId.get(menuItem.category.toString()) ||
          "kitchen",
      }
    })

    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0)

    const order = await Order.create({
      restaurant: restaurantId,
      orderNumber: generateOrderNumber(),
      source: "customer_qr",
      restaurantTable: table._id,
      orderType: "dine_in",
      tableName: table.name,
      customer: {
        name: result.data.customer.name,
        phone: result.data.customer.phone,
        email: "",
      },
      items,
      subtotal,
      total: subtotal,
      currency: "ZMW",
      status: "awaiting_waiter",
      paymentStatus: "unpaid",
    })

    const orderPayload = order.toObject()

    getSocketServer()
      .to(`restaurant:${restaurantId}:role:waiter`)
      .emit("order:customer-requested", orderPayload)

    getSocketServer()
      .to(`restaurant:${restaurantId}:role:owner`)
      .emit("order:updated", orderPayload)

    response.status(201).json({
      message: "Your selection was sent to a waiter",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        tableName: order.tableName,
        total: order.total,
        status: order.status,
      },
    })
  })
)
