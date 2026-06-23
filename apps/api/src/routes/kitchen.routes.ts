import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import {
  createKitchenOrderPayload,
  hasKitchenItems,
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
import { Order } from "../models/order.model"

export const kitchenRouter = Router()

kitchenRouter.use(
  authenticate,
  requireRole("kitchen"),
  requireRestaurantContext
)

const activeStatuses = ["submitted", "accepted", "preparing", "ready"] as const

const statusSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready"]),
})

const allowedTransitions: Record<string, string> = {
  submitted: "accepted",
  accepted: "preparing",
  preparing: "ready",
}

kitchenRouter.get(
  "/orders",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

    const orders = await Order.find({
      restaurant: restaurantId,
      status: { $in: activeStatuses },
      paymentStatus: { $ne: "failed" },
    })
      .populate("waiter", "name")
      .sort({ createdAt: 1 })

    const kitchenOrders = orders
      .map(createKitchenOrderPayload)
      .filter((order) => order.items.length > 0)

    response.json({ orders: kitchenOrders })
  })
)

kitchenRouter.patch(
  "/orders/:id/status",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const result = statusSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid kitchen status",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const currentOrder = await Order.findOne({
      _id: request.params.id,
      restaurant: restaurantId,
    })

    if (!currentOrder) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (!hasKitchenItems(Array.from(currentOrder.items))) {
      response.status(409).json({
        message: "This order has no kitchen items",
      })
      return
    }

    const expectedStatus = allowedTransitions[currentOrder.status]

    if (expectedStatus !== result.data.status) {
      response.status(409).json({
        message: `Order cannot move from ${currentOrder.status} to ${result.data.status}`,
        currentStatus: currentOrder.status,
        expectedStatus: expectedStatus || null,
      })
      return
    }

    if (!currentOrder.waiter) {
      response.status(409).json({
        message: "This order has no waiter assigned",
      })
      return
    }

    const waiterId = currentOrder.waiter.toString()

    const order = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        restaurant: restaurantId,
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
    ).populate("waiter", "name")

    if (!order) {
      response.status(409).json({
        message: "Order status changed. Refresh and try again.",
      })
      return
    }

    const orderPayload = order.toObject()
    const kitchenPayload = createKitchenOrderPayload(order)

    getSocketServer().to(`user:${waiterId}`).emit("order:updated", orderPayload)

    getSocketServer()
      .to(`restaurant:${restaurantId}:role:kitchen`)
      .emit("order:updated", kitchenPayload)

    getSocketServer()
      .to(`restaurant:${restaurantId}:role:owner`)
      .emit("order:updated", orderPayload)

    response.json({
      message: `Order marked as ${result.data.status}`,
      order: kitchenPayload,
    })
  })
)
