import axios from "axios"
import { randomUUID } from "crypto"
import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"
import { Order } from "../models/order.model"
import { Payment } from "../models/payment.model"
import { getSocketServer } from "../lib/socket"

export const paymentRouter = Router()

paymentRouter.use(authenticate, requireRole("waiter"))

const initializeSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email(),
  }),
})

const verifySchema = z.object({
  orderId: z.string().refine(Types.ObjectId.isValid, {
    message: "Invalid order ID",
  }),
  reference: z.string().trim().min(1),
})

const generatePaymentReference = () => {
  return `order-${Date.now()}-${randomUUID()}`
}

paymentRouter.post(
  "/orders/:orderId/initialize",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    if (!Types.ObjectId.isValid(request.params.orderId as string)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const result = initializeSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Valid customer details are required",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const order = await Order.findOne({
      _id: request.params.orderId,
      waiter: authenticatedRequest.user?.id,
    })

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (!["draft", "awaiting_payment"].includes(order.status)) {
      response.status(400).json({
        message: "This order cannot accept payment",
      })
      return
    }

    if (order.paymentStatus === "paid") {
      response.status(409).json({
        message: "This order has already been paid",
      })
      return
    }

    if (order.total <= 0 || order.items.length === 0) {
      response.status(400).json({
        message: "The order does not contain payable items",
      })
      return
    }

    await Payment.updateMany(
      {
        order: order._id,
        status: "pending",
      },
      {
        status: "cancelled",
      }
    )

    const reference = generatePaymentReference()

    await Payment.create({
      order: order._id,
      waiter: authenticatedRequest.user?.id,
      reference,
      amount: order.total,
      currency: order.currency,
      status: "pending",
    })

    order.customer = {
      name: result.data.customer.name,
      phone: result.data.customer.phone,
      email: result.data.customer.email.toLowerCase(),
    }

    order.paymentStatus = "pending"
    order.status = "awaiting_payment"

    await order.save()

    const nameParts = result.data.customer.name.trim().split(/\s+/)

    response.status(201).json({
      checkout: {
        reference,
        amount: order.total / 100,
        currency: order.currency,
        email: result.data.customer.email.toLowerCase(),
        customer: {
          firstName: nameParts[0] || "Guest",
          lastName: nameParts.slice(1).join(" ") || "Customer",
          phone: result.data.customer.phone,
        },
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    })
  })
)

paymentRouter.post(
  "/verify",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = verifySchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid verification details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const payment = await Payment.findOne({
      reference: result.data.reference,
      order: result.data.orderId,
      waiter: authenticatedRequest.user?.id,
    })

    if (!payment) {
      response.status(404).json({
        message: "Payment attempt not found",
      })
      return
    }

    const order = await Order.findOne({
      _id: result.data.orderId,
      waiter: authenticatedRequest.user?.id,
    })

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    if (payment.status === "successful" && order.paymentStatus === "paid") {
      response.json({
        message: "Payment already verified",
        order,
      })
      return
    }

    const lencoResponse = await axios.get(
      `${env.lencoBaseUrl}/collections/status/${encodeURIComponent(
        payment.reference
      )}`,
      {
        headers: {
          Authorization: `Bearer ${env.lencoSecretKey}`,
          Accept: "application/json",
        },
        timeout: 15000,
      }
    )

    const lencoPayment = lencoResponse.data?.data

    if (!lencoPayment) {
      response.status(404).json({
        message: "Payment was not found at Lenco",
      })
      return
    }

    const status = String(lencoPayment.status).toLowerCase()
    const currency = String(lencoPayment.currency).toUpperCase()
    const paidAmountInMinorUnits = Math.round(Number(lencoPayment.amount) * 100)

    payment.providerResponse = lencoPayment

    if (status !== "successful") {
      payment.status = status === "failed" ? "failed" : "pending"

      order.paymentStatus = status === "failed" ? "failed" : "pending"

      await Promise.all([payment.save(), order.save()])

      response.status(400).json({
        message: `Payment status is ${status}`,
        paymentStatus: order.paymentStatus,
      })
      return
    }

    if (currency !== payment.currency) {
      payment.status = "failed"
      await payment.save()

      response.status(400).json({
        message: "Payment currency does not match the order",
      })
      return
    }

    if (paidAmountInMinorUnits !== payment.amount) {
      payment.status = "failed"
      await payment.save()

      response.status(400).json({
        message: "Paid amount does not match the order total",
        expectedAmount: payment.amount / 100,
        paidAmount: Number(lencoPayment.amount),
      })
      return
    }

    payment.status = "successful"
    payment.providerTransactionId = String(
      lencoPayment.id || lencoPayment.transactionId || ""
    )
    payment.verifiedAt = new Date()

    order.paymentStatus = "paid"
    order.status = "submitted"

    await Promise.all([payment.save(), order.save()])

    await order.populate("waiter", "name")

    const orderPayload = order.toObject()

    getSocketServer().to("role:kitchen").emit("order:submitted", orderPayload)
    getSocketServer().to("role:owner").emit("order:updated", orderPayload)

    response.json({
      message: "Payment verified successfully",
      order,
    })
  })
)
