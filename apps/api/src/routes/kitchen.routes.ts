import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"
import { Order } from "../models/order.model"
import { getSocketServer } from "../lib/socket"

export const kitchenRouter = Router()

kitchenRouter.use(authenticate, requireRole("kitchen"))

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
  asyncHandler(async (_request, response) => {
    const orders = await Order.find({
      status: { $in: activeStatuses },
      paymentStatus: "paid",
    })
      .populate("waiter", "name")
      .sort({ createdAt: 1 })

    response.json({ orders })
  })
)

kitchenRouter.patch(
  "/orders/:id/status",
  asyncHandler(async (request, response) => {
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

    const currentOrder = await Order.findById(request.params.id)

    if (!currentOrder) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (currentOrder.paymentStatus !== "paid") {
      response.status(409).json({
        message: "Only paid orders can be processed",
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

    const waiterId = currentOrder.waiter.toString()

    const order = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
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
    ).populate("waiter", "name")

    if (!order) {
      response.status(409).json({
        message: "Order status changed. Refresh and try again.",
      })
      return
    }

    getSocketServer()
      .to(`user:${waiterId}`)
      .emit("order:updated", order.toObject())

    getSocketServer().to("role:kitchen").emit("order:updated", order.toObject())

    response.json({
      message: `Order marked as ${result.data.status}`,
      order,
    })
  })
)
