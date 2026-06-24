import { randomUUID } from "crypto"
import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import {
  createKitchenOrderPayload,
  hasKitchenItems,
  normalizePreparationArea,
} from "../lib/kitchen-order"
import { getSocketServer } from "../lib/socket"
import { asyncHandler } from "../middleware/async-handler"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import {
  requireRestaurantContext,
  requireRole,
} from "../middleware/role.middleware"
import { MenuCategory } from "../models/menu-category.model"
import { MenuItem } from "../models/menu-item.model"
import { Order } from "../models/order.model"
import { Payment } from "../models/payment.model"
import { User } from "../models/user.model"

export const orderRouter = Router()

orderRouter.use(authenticate, requireRole("waiter"), requireRestaurantContext)

type WaiterActor = {
  userId: string
  restaurantId: string
  sharedHub: boolean
}

const objectIdSchema = z.string().refine(Types.ObjectId.isValid, {
  message: "Invalid waiter",
})

const orderItemSchema = z.object({
  menuItem: z.string().refine(Types.ObjectId.isValid, {
    message: "Invalid menu item",
  }),
  quantity: z.number().int().min(1).max(100),
  notes: z.string().trim().max(500).optional().default(""),
})

const draftOrderSchema = z
  .object({
    waiterId: objectIdSchema.optional(),
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

const updateDraftOrderSchema = z.object({
  waiterId: objectIdSchema.optional(),
  orderType: z.enum(["dine_in", "takeaway"]).optional(),
  tableName: z.string().trim().max(50).optional(),
  customer: z
    .object({
      name: z.string().trim().max(100).optional().default(""),
      phone: z.string().trim().max(30).optional().default(""),
      email: z.string().trim().email().or(z.literal("")).optional().default(""),
    })
    .optional(),
  items: z.array(orderItemSchema).min(1).optional(),
})

const claimCustomerRequestSchema = z.object({
  waiterId: objectIdSchema.optional(),
})

const waiterStatusSchema = z.object({
  status: z.enum(["served", "completed"]),
})

const recordPaymentSchema = z.object({
  paymentMethod: z.enum(["cash", "card_pos", "manual_mobile_money"]),
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

const generateManualPaymentReference = () => {
  return `manual-${Date.now()}-${randomUUID()}`
}

const getIdString = (value: unknown): string | undefined => {
  if (!value) return undefined

  if (typeof value === "string") {
    return value
  }

  if (value instanceof Types.ObjectId) {
    return value.toString()
  }

  if (typeof value === "object" && "_id" in value) {
    return getIdString((value as { _id?: unknown })._id)
  }

  return undefined
}

const getWaiterActor = async (
  request: AuthenticatedRequest
): Promise<WaiterActor | null> => {
  const userId = request.user?.id
  const restaurantId = request.user?.restaurantId

  if (!userId || !restaurantId) {
    return null
  }

  const user = await User.findOne({
    _id: userId,
    restaurant: restaurantId,
    role: "waiter",
    active: true,
  })
    .select("sharedHub")
    .lean()

  if (!user) {
    return null
  }

  return {
    userId,
    restaurantId,
    sharedHub: Boolean(user.sharedHub),
  }
}

const getOrderAccessFilter = (actor: WaiterActor) => {
  if (actor.sharedHub) {
    return {
      createdBy: actor.userId,
    }
  }

  return {
    waiter: actor.userId,
  }
}

const resolveAssignedWaiterId = async ({
  actor,
  requestedWaiterId,
}: {
  actor: WaiterActor
  requestedWaiterId?: string
}) => {
  if (!actor.sharedHub) {
    if (requestedWaiterId && requestedWaiterId !== actor.userId) {
      return {
        ok: false as const,
        status: 403,
        message: "You cannot assign this order to another waiter",
      }
    }

    return {
      ok: true as const,
      waiterId: actor.userId,
    }
  }

  if (!requestedWaiterId) {
    return {
      ok: false as const,
      status: 400,
      message: "Served by waiter is required for shared hub orders",
    }
  }

  const waiter = await User.exists({
    _id: requestedWaiterId,
    restaurant: actor.restaurantId,
    role: "waiter",
    active: true,
    sharedHub: { $ne: true },
  })

  if (!waiter) {
    return {
      ok: false as const,
      status: 400,
      message: "Choose an active waiter for this order",
    }
  }

  return {
    ok: true as const,
    waiterId: requestedWaiterId,
  }
}

const emitToUsers = (
  userIds: Array<string | undefined>,
  event: string,
  payload: unknown
) => {
  const socketServer = getSocketServer()
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))

  uniqueUserIds.forEach((userId) => {
    socketServer.to(`user:${userId}`).emit(event, payload)
  })
}

const emitOrderUpdated = ({
  restaurantId,
  order,
  userIds,
}: {
  restaurantId: string
  order: InstanceType<typeof Order>
  userIds?: Array<string | undefined>
}) => {
  const orderPayload = order.toObject()
  const kitchenPayload = createKitchenOrderPayload(order)
  const socketServer = getSocketServer()

  emitToUsers(
    [
      getIdString(order.waiter),
      getIdString(order.createdBy),
      ...(userIds || []),
    ],
    "order:updated",
    orderPayload
  )

  if (kitchenPayload.items.length > 0) {
    socketServer
      .to(`restaurant:${restaurantId}:role:kitchen`)
      .emit("order:updated", kitchenPayload)
  }

  socketServer
    .to(`restaurant:${restaurantId}:role:owner`)
    .emit("order:updated", orderPayload)
}

const emitOrderSubmitted = ({
  restaurantId,
  order,
  userIds,
}: {
  restaurantId: string
  order: InstanceType<typeof Order>
  userIds?: Array<string | undefined>
}) => {
  const orderPayload = order.toObject()
  const kitchenPayload = createKitchenOrderPayload(order)
  const socketServer = getSocketServer()

  emitToUsers(
    [
      getIdString(order.waiter),
      getIdString(order.createdBy),
      ...(userIds || []),
    ],
    "order:updated",
    orderPayload
  )

  if (kitchenPayload.items.length > 0) {
    socketServer
      .to(`restaurant:${restaurantId}:role:kitchen`)
      .emit("order:submitted", kitchenPayload)

    socketServer
      .to(`restaurant:${restaurantId}:role:kitchen`)
      .emit("order:updated", kitchenPayload)
  }

  socketServer
    .to(`restaurant:${restaurantId}:role:owner`)
    .emit("order:updated", orderPayload)
}

const buildOrderItems = async (
  requestedItems: z.infer<typeof orderItemSchema>[],
  restaurantId: string
) => {
  const requestedIds = requestedItems.map((item) => item.menuItem)

  const menuItems = await MenuItem.find({
    restaurant: restaurantId,
    _id: { $in: requestedIds },
    available: true,
  })

  if (menuItems.length !== new Set(requestedIds).size) {
    throw new Error("One or more menu items are unavailable")
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
      preparationArea:
        preparationAreaByCategoryId.get(menuItem.category.toString()) ||
        "kitchen",
    }
  })
}

orderRouter.get(
  "/active-waiters",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!actor.sharedHub) {
      response.status(403).json({
        message: "Shared hub access required",
      })
      return
    }

    const waiters = await User.find({
      restaurant: actor.restaurantId,
      role: "waiter",
      active: true,
      sharedHub: { $ne: true },
    })
      .select("name email phone role active sharedHub")
      .sort({ name: 1 })

    response.json({ waiters })
  })
)

orderRouter.post(
  "/drafts",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    const result = draftOrderSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid order details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const assignedWaiter = await resolveAssignedWaiterId({
      actor,
      requestedWaiterId: result.data.waiterId,
    })

    if (!assignedWaiter.ok) {
      response.status(assignedWaiter.status).json({
        message: assignedWaiter.message,
      })
      return
    }

    let items

    try {
      items = await buildOrderItems(result.data.items, actor.restaurantId)
    } catch (error) {
      response.status(400).json({
        message:
          error instanceof Error ? error.message : "Could not create order",
      })
      return
    }

    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0)

    const order = await Order.create({
      restaurant: actor.restaurantId,
      orderNumber: generateOrderNumber(),
      waiter: assignedWaiter.waiterId,
      createdBy: actor.userId,
      entryMode: actor.sharedHub ? "shared_hub" : "personal",
      orderType: result.data.orderType,
      tableName: result.data.tableName,
      customer: result.data.customer,
      items,
      subtotal,
      total: subtotal,
      status: "draft",
      paymentStatus: "unpaid",
      paymentMethod: "",
    })

    response.status(201).json({ order })
  })
)

orderRouter.get(
  "/mine",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    const result = z
      .object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(50).optional().default(9),
        historyStatus: z
          .enum(["all", "completed", "cancelled"])
          .optional()
          .default("all"),
      })
      .safeParse(request.query)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid waiter order filters",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const { page, limit, historyStatus } = result.data
    const skip = (page - 1) * limit

    type ClosedOrderStatus = "completed" | "cancelled"

    const closedStatuses: ClosedOrderStatus[] = ["completed", "cancelled"]
    const selectedHistoryStatuses: ClosedOrderStatus[] =
      historyStatus === "all" ? closedStatuses : [historyStatus]

    const baseAccessFilter = {
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
    }

    const [orders, historyOrders, totalHistoryOrders] = await Promise.all([
      Order.find({
        ...baseAccessFilter,
        status: {
          $nin: closedStatuses,
        },
      })
        .populate("waiter", "name")
        .populate("createdBy", "name")
        .sort({
          createdAt: -1,
        })
        .limit(100),

      Order.find({
        ...baseAccessFilter,
        status: {
          $in: selectedHistoryStatuses,
        },
      })
        .populate("waiter", "name")
        .populate("createdBy", "name")
        .sort({
          updatedAt: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit),

      Order.countDocuments({
        ...baseAccessFilter,
        status: {
          $in: selectedHistoryStatuses,
        },
      }),
    ])

    const totalPages = Math.ceil(totalHistoryOrders / limit)

    response.json({
      orders,
      historyOrders,
      historyPagination: {
        page,
        limit,
        totalOrders: totalHistoryOrders,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      historyStatus,
    })
  })
)

orderRouter.get(
  "/customer-requests",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    const orders = await Order.find({
      restaurant: actor.restaurantId,
      source: "customer_qr",
      status: "awaiting_waiter",
      $or: [{ waiter: { $exists: false } }, { waiter: null }],
    })
      .sort({ createdAt: 1 })
      .limit(100)

    response.json({ orders })
  })
)

orderRouter.get(
  "/customer-requests/count",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    const count = await Order.countDocuments({
      restaurant: actor.restaurantId,
      source: "customer_qr",
      status: "awaiting_waiter",
      $or: [{ waiter: { $exists: false } }, { waiter: null }],
    })

    response.json({ count })
  })
)

orderRouter.patch(
  "/customer-requests/:id/claim",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const result = claimCustomerRequestSchema.safeParse(request.body || {})

    if (!result.success) {
      response.status(400).json({
        message: "Invalid waiter details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const assignedWaiter = await resolveAssignedWaiterId({
      actor,
      requestedWaiterId: result.data.waiterId,
    })

    if (!assignedWaiter.ok) {
      response.status(assignedWaiter.status).json({
        message: assignedWaiter.message,
      })
      return
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: request.params.id,
        restaurant: actor.restaurantId,
        source: "customer_qr",
        status: "awaiting_waiter",
        $or: [{ waiter: { $exists: false } }, { waiter: null }],
      },
      {
        $set: {
          waiter: assignedWaiter.waiterId,
          createdBy: actor.userId,
          entryMode: "customer_qr",
          status: "draft",
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    )

    if (!order) {
      response.status(409).json({
        message: "This request has already been claimed",
      })
      return
    }

    emitOrderUpdated({
      restaurantId: actor.restaurantId,
      order,
      userIds: [actor.userId, assignedWaiter.waiterId],
    })

    getSocketServer()
      .to(`restaurant:${actor.restaurantId}:role:waiter`)
      .emit("order:customer-claimed", order.toObject())

    response.json({
      message: "Customer request claimed",
      order,
    })
  })
)

orderRouter.patch(
  "/:id/submit",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const currentOrder = await Order.findOne({
      _id: request.params.id,
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
    })

    if (!currentOrder) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (currentOrder.status !== "draft") {
      response.status(409).json({
        message: `Only draft orders can be sent to the kitchen`,
      })
      return
    }

    if (currentOrder.items.length === 0) {
      response.status(400).json({
        message: "Order must contain at least one item",
      })
      return
    }

    currentOrder.status = hasKitchenItems(Array.from(currentOrder.items))
      ? "submitted"
      : "ready"

    await currentOrder.save()

    const order = await currentOrder
      .populate("waiter", "name")
      .then((document) => document.populate("createdBy", "name"))

    emitOrderSubmitted({
      restaurantId: actor.restaurantId,
      order,
      userIds: [actor.userId],
    })

    response.json({
      message:
        order.status === "ready"
          ? "Order is ready for service"
          : "Order sent to kitchen",
      order,
    })
  })
)

orderRouter.patch(
  "/:id/status",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

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
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
    })

    if (!currentOrder) {
      response.status(404).json({
        message: "Order not found",
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

    if (
      result.data.status === "completed" &&
      currentOrder.paymentStatus !== "paid"
    ) {
      response.status(409).json({
        message: "Record payment before completing this order",
      })
      return
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        restaurant: actor.restaurantId,
        ...getOrderAccessFilter(actor),
        status: currentOrder.status,
      },
      {
        $set: {
          status: result.data.status,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    )
      .populate("waiter", "name")
      .populate("createdBy", "name")

    if (!order) {
      response.status(409).json({
        message: "Order status changed. Refresh and try again.",
      })
      return
    }

    emitOrderUpdated({
      restaurantId: actor.restaurantId,
      order,
      userIds: [actor.userId],
    })

    response.json({
      message: `Order marked as ${result.data.status}`,
      order,
    })
  })
)

orderRouter.patch(
  "/:id/payment",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)
    const result = recordPaymentSchema.safeParse(request.body)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!result.success) {
      response.status(400).json({
        message: "Invalid payment method",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findOne({
      _id: request.params.id,
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
    })

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (order.status !== "served") {
      response.status(409).json({
        message: "Payment can only be recorded after the order is served",
      })
      return
    }

    if (order.paymentStatus === "paid") {
      response.status(409).json({
        message: "This order is already paid",
      })
      return
    }

    const assignedWaiterId = getIdString(order.waiter)

    if (!assignedWaiterId) {
      response.status(409).json({
        message: "This order has no assigned waiter",
      })
      return
    }

    await Payment.updateMany(
      {
        restaurant: actor.restaurantId,
        order: order._id,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    )

    const payment = await Payment.create({
      restaurant: actor.restaurantId,
      order: order._id,
      waiter: assignedWaiterId,
      recordedBy: actor.userId,
      reference: generateManualPaymentReference(),
      provider: "manual",
      method: result.data.paymentMethod,
      amount: order.total,
      currency: order.currency,
      status: "successful",
      providerResponse: {
        recordedBy: actor.userId,
        method: result.data.paymentMethod,
        note: "Manual payment recorded by waiter",
      },
      verifiedAt: new Date(),
    })

    order.paymentStatus = "paid"
    order.paymentMethod = result.data.paymentMethod
    order.paymentRecordedBy = new Types.ObjectId(actor.userId)
    order.paidAt = new Date()

    await order.save()
    await order.populate("waiter", "name")
    await order.populate("createdBy", "name")

    emitOrderUpdated({
      restaurantId: actor.restaurantId,
      order,
      userIds: [actor.userId],
    })

    response.json({
      message: "Payment recorded",
      order,
      payment,
    })
  })
)

orderRouter.patch(
  "/:id/cancel",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findOne({
      _id: request.params.id,
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
    })

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (order.paymentStatus === "paid") {
      response.status(409).json({
        message: "Paid orders cannot be cancelled without a refund process",
      })
      return
    }

    if (!["draft", "awaiting_payment"].includes(order.status)) {
      response.status(409).json({
        message: `Order cannot be cancelled from ${order.status}`,
      })
      return
    }

    order.status = "cancelled"

    await order.save()

    await Payment.updateMany(
      {
        restaurant: actor.restaurantId,
        order: order._id,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    )

    await order.populate("waiter", "name")
    await order.populate("createdBy", "name")

    emitOrderUpdated({
      restaurantId: actor.restaurantId,
      order,
      userIds: [actor.userId],
    })

    response.json({
      message: "Order cancelled",
      order,
    })
  })
)

orderRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findOne({
      _id: request.params.id,
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
    })
      .populate("waiter", "name")
      .populate("createdBy", "name")

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    response.json({ order })
  })
)

orderRouter.patch(
  "/drafts/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const actor = await getWaiterActor(authenticatedRequest)
    const result = updateDraftOrderSchema.safeParse(request.body)

    if (!actor) {
      response.status(401).json({
        message: "Waiter account is unavailable",
      })
      return
    }

    if (!result.success) {
      response.status(400).json({
        message: "Invalid order details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findOne({
      _id: request.params.id,
      restaurant: actor.restaurantId,
      ...getOrderAccessFilter(actor),
      status: "draft",
    })

    if (!order) {
      response.status(404).json({
        message: "Editable draft order not found",
      })
      return
    }

    if (result.data.waiterId !== undefined) {
      const assignedWaiter = await resolveAssignedWaiterId({
        actor,
        requestedWaiterId: result.data.waiterId,
      })

      if (!assignedWaiter.ok) {
        response.status(assignedWaiter.status).json({
          message: assignedWaiter.message,
        })
        return
      }

      order.waiter = new Types.ObjectId(assignedWaiter.waiterId)
    }

    if (result.data.items) {
      try {
        const items = await buildOrderItems(
          result.data.items,
          actor.restaurantId
        )
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
    await order.populate("waiter", "name")
    await order.populate("createdBy", "name")

    response.json({ order })
  })
)
