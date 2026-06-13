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
import { getSocketServer } from "../lib/socket"

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
        email: z
          .string()
          .trim()
          .email()
          .or(z.literal(""))
          .optional()
          .default(""),
      })
      .optional()
      .default({
        name: "",
        phone: "",
        email: "",
      }),
    items: z.array(orderItemSchema).min(1),
  })
  .refine(
    (order) => order.orderType !== "dine_in" || order.tableName.length > 0,
    {
      message: "Table name or number is required for dine-in orders",
      path: ["tableName"],
    }
  )

const waiterStatusSchema = z.object({
  status: z.enum(["served", "completed"]),
})

const waiterTransitions: Record<string, string> = {
  ready: "served",
  served: "completed",
}

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
  "/customer-requests",
  asyncHandler(async (_request, response) => {
    const orders = await Order.find({
      source: "customer_qr",
      status: "awaiting_waiter",
      waiter: { $exists: false },
    })
      .sort({ createdAt: 1 })
      .limit(100)

    response.json({ orders })
  })
)

orderRouter.patch(
  "/customer-requests/:id/claim",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: request.params.id,
        source: "customer_qr",
        status: "awaiting_waiter",
        waiter: { $exists: false },
      },
      {
        $set: {
          waiter: authenticatedRequest.user?.id,
          status: "draft",
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!order) {
      response.status(409).json({
        message: "This request has already been claimed",
      })
      return
    }

    const payload = order.toObject()

    getSocketServer().to("role:waiter").emit("order:customer-claimed", payload)

    getSocketServer()
      .to(`user:${authenticatedRequest.user?.id}`)
      .emit("order:updated", payload)

    response.json({
      message: "Customer request claimed",
      order,
    })
  })
)

orderRouter.patch(
  "/:id/status",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const result = waiterStatusSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid waiter order status",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const currentOrder = await Order.findOne({
      _id: request.params.id,
      waiter: authenticatedRequest.user?.id,
    })

    if (!currentOrder) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (currentOrder.paymentStatus !== "paid") {
      response.status(409).json({
        message: "Only paid orders can be completed",
      })
      return
    }

    const expectedStatus = waiterTransitions[currentOrder.status]

    if (expectedStatus !== result.data.status) {
      response.status(409).json({
        message: `Order cannot move from ${currentOrder.status} to ${result.data.status}`,
        currentStatus: currentOrder.status,
        expectedStatus: expectedStatus || null,
      })
      return
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        waiter: authenticatedRequest.user?.id,
        status: currentOrder.status,
        paymentStatus: "paid",
      },
      {
        $set: {
          status: result.data.status,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!order) {
      response.status(409).json({
        message: "Order status changed. Refresh and try again.",
      })
      return
    }

    const orderPayload = order.toObject()

    getSocketServer()
      .to(`user:${authenticatedRequest.user?.id}`)
      .emit("order:updated", orderPayload)

    getSocketServer().to("role:kitchen").emit("order:updated", orderPayload)

    getSocketServer().to("role:owner").emit("order:updated", orderPayload)

    response.json({
      message: `Order marked as ${result.data.status}`,
      order,
    })
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
