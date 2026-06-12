import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { asyncHandler } from "../middleware/async-handler"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"
import { MenuItem } from "../models/menu-item.model"
import { Order } from "../models/order.model"

export const orderRouter = Router()

orderRouter.use(authenticate, requireRole("waiter"))

const orderItemSchema = z.object({
  menuItem: z.string().refine(Types.ObjectId.isValid, {
    message: "Invalid menu item",
  }),
  quantity: z.number().int().min(1).max(100),
  notes: z.string().trim().max(500).optional().default(""),
})

const draftOrderSchema = z
  .object({
    orderType: z.enum(["dine_in", "takeaway"]).default("dine_in"),
    tableName: z.string().trim().max(50).optional().default(""),
    customer: z
      .object({
        name: z.string().trim().max(100).optional().default(""),
        phone: z.string().trim().max(30).optional().default(""),
      })
      .optional()
      .default({ name: "", phone: "" }),
    items: z.array(orderItemSchema).min(1),
  })
  .refine(
    (order) => order.orderType !== "dine_in" || order.tableName.length > 0,
    {
      message: "Table name or number is required for dine-in orders",
      path: ["tableName"],
    }
  )

const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.floor(100 + Math.random() * 900)

  return `ORD-${timestamp}-${random}`
}

const buildOrderItems = async (
  requestedItems: z.infer<typeof orderItemSchema>[]
) => {
  const requestedIds = requestedItems.map((item) => item.menuItem)

  const menuItems = await MenuItem.find({
    _id: { $in: requestedIds },
    available: true,
  })

  if (menuItems.length !== new Set(requestedIds).size) {
    throw new Error("One or more menu items are unavailable")
  }

  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]))

  return requestedItems.map((requestedItem) => {
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
    }
  })
}

orderRouter.post(
  "/drafts",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = draftOrderSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid order details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    let items

    try {
      items = await buildOrderItems(result.data.items)
    } catch (error) {
      response.status(400).json({
        message:
          error instanceof Error ? error.message : "Could not create order",
      })
      return
    }

    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0)

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      waiter: authenticatedRequest.user?.id,
      orderType: result.data.orderType,
      tableName: result.data.tableName,
      customer: result.data.customer,
      items,
      subtotal,
      total: subtotal,
      status: "draft",
      paymentStatus: "unpaid",
    })

    response.status(201).json({ order })
  })
)

orderRouter.get(
  "/mine",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    const orders = await Order.find({
      waiter: authenticatedRequest.user?.id,
    })
      .sort({ createdAt: -1 })
      .limit(100)

    response.json({ orders })
  })
)

orderRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({ message: "Invalid order ID" })
      return
    }

    const order = await Order.findOne({
      _id: request.params.id,
      waiter: authenticatedRequest.user?.id,
    })

    if (!order) {
      response.status(404).json({ message: "Order not found" })
      return
    }

    response.json({ order })
  })
)

orderRouter.patch(
  "/drafts/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = draftOrderSchema.partial().safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid order details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({ message: "Invalid order ID" })
      return
    }

    const order = await Order.findOne({
      _id: request.params.id,
      waiter: authenticatedRequest.user?.id,
      status: "draft",
    })

    if (!order) {
      response.status(404).json({
        message: "Editable draft order not found",
      })
      return
    }

    if (result.data.items) {
      try {
        const items = await buildOrderItems(result.data.items)
        const subtotal = items.reduce(
          (total, item) => total + item.lineTotal,
          0
        )

        order.set({
          items,
          subtotal,
          total: subtotal,
        })
      } catch (error) {
        response.status(400).json({
          message:
            error instanceof Error ? error.message : "Could not update order",
        })
        return
      }
    }

    if (result.data.orderType !== undefined) {
      order.orderType = result.data.orderType
    }

    if (result.data.tableName !== undefined) {
      order.tableName = result.data.tableName
    }

    if (result.data.customer !== undefined) {
      order.customer = result.data.customer
    }

    if (order.orderType === "dine_in" && !order.tableName) {
      response.status(400).json({
        message: "Table name or number is required",
      })
      return
    }

    await order.save()

    response.json({ order })
  })
)
