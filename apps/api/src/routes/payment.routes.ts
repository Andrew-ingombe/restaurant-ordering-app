import axios from "axios"
import { randomUUID } from "crypto"
import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { asyncHandler } from "../middleware/async-handler"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import {
  requireRestaurantContext,
  requireRole,
} from "../middleware/role.middleware"
import { decryptSecret } from "../lib/crypto"
import { getSocketServer } from "../lib/socket"
import { Order } from "../models/order.model"
import { Payment } from "../models/payment.model"
import { Restaurant } from "../models/restaurant.model"

export const paymentRouter = Router()

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

const webhookSchema = z
  .object({
    event: z.string().trim().optional(),
    type: z.string().trim().optional(),
    reference: z.string().trim().optional(),
    data: z
      .object({
        reference: z.string().trim().optional(),
        status: z.string().trim().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

const generatePaymentReference = () => {
  return `order-${Date.now()}-${randomUUID()}`
}

const getRestaurantPaymentSettings = async (restaurantId: string) => {
  const restaurant = await Restaurant.findById(restaurantId).select(
    "+paymentSettings.publicKey +paymentSettings.encryptedSecretKey"
  )

  if (!restaurant) {
    throw new Error("Restaurant not found")
  }

  const settings = restaurant.paymentSettings

  if (
    !settings?.enabled ||
    !settings.publicKey ||
    !settings.encryptedSecretKey ||
    !settings.baseUrl ||
    !settings.checkoutScriptUrl
  ) {
    throw new Error("Restaurant payment settings are not configured")
  }

  return {
    publicKey: settings.publicKey,
    secretKey: decryptSecret(settings.encryptedSecretKey),
    baseUrl: settings.baseUrl,
    checkoutScriptUrl: settings.checkoutScriptUrl,
  }
}

const fetchLencoCollectionStatus = async (
  paymentSettings: {
    secretKey: string
    baseUrl: string
  },
  reference: string
) => {
  try {
    const lencoResponse = await axios.get(
      `${paymentSettings.baseUrl}/collections/status/${encodeURIComponent(
        reference
      )}`,
      {
        headers: {
          Authorization: `Bearer ${paymentSettings.secretKey}`,
          Accept: "application/json",
        },
        timeout: 15000,
      }
    )

    return lencoResponse.data?.data || null
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status

      if (status === 404) {
        return null
      }
    }

    throw error
  }
}

const emitPaidOrderUpdates = async (
  restaurantId: string,
  orderId: string,
  waiterId?: string
) => {
  const order = await Order.findById(orderId).populate("waiter", "name")

  if (!order) return

  const orderPayload = order.toObject()
  const socketServer = getSocketServer()

  if (waiterId) {
    socketServer.to(`user:${waiterId}`).emit("order:updated", orderPayload)
  }

  socketServer
    .to(`restaurant:${restaurantId}:role:kitchen`)
    .emit("order:submitted", orderPayload)

  socketServer
    .to(`restaurant:${restaurantId}:role:kitchen`)
    .emit("order:updated", orderPayload)

  socketServer
    .to(`restaurant:${restaurantId}:role:owner`)
    .emit("order:updated", orderPayload)
}

const reconcilePaymentWithProvider = async ({
  restaurantId,
  paymentSettings,
  payment,
  order,
  webhookEvent,
  webhookPayload,
}: {
  restaurantId: string
  paymentSettings: {
    secretKey: string
    baseUrl: string
  }
  payment: InstanceType<typeof Payment>
  order: InstanceType<typeof Order>
  webhookEvent?: string
  webhookPayload?: unknown
}) => {
  const lencoPayment = await fetchLencoCollectionStatus(
    paymentSettings,
    payment.reference
  )

  payment.lastReconciledAt = new Date()
  payment.reconciliationCount = (payment.reconciliationCount || 0) + 1

  if (webhookEvent) {
    payment.lastWebhookEvent = webhookEvent
    payment.lastWebhookPayload = webhookPayload
    payment.lastWebhookReceivedAt = new Date()
  }

  if (!lencoPayment) {
    await payment.save()

    return {
      ok: false,
      shouldRetry: true,
      message: "Payment was not yet available for reconciliation",
    }
  }

  const normalizedStatus = String(lencoPayment.status || "").toLowerCase()
  const normalizedCurrency = String(lencoPayment.currency || "").toUpperCase()
  const paidAmountInMinorUnits = Math.round(Number(lencoPayment.amount) * 100)

  payment.providerResponse = lencoPayment

  if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
    payment.status = normalizedStatus === "cancelled" ? "cancelled" : "failed"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus =
        normalizedStatus === "cancelled" ? "failed" : "failed"
    }

    await Promise.all([payment.save(), order.save()])

    return {
      ok: false,
      shouldRetry: false,
      message: `Payment status is ${normalizedStatus}`,
      payment,
      order,
    }
  }

  if (normalizedStatus !== "successful") {
    payment.status = "pending"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "pending"
    }

    await Promise.all([payment.save(), order.save()])

    return {
      ok: false,
      shouldRetry: true,
      message: `Payment status is ${normalizedStatus || "pending"}`,
      payment,
      order,
    }
  }

  if (normalizedCurrency !== payment.currency) {
    payment.status = "failed"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "failed"
    }

    await Promise.all([payment.save(), order.save()])

    return {
      ok: false,
      shouldRetry: false,
      message: "Payment currency does not match the order",
      payment,
      order,
    }
  }

  if (paidAmountInMinorUnits !== payment.amount) {
    payment.status = "failed"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "failed"
    }

    await Promise.all([payment.save(), order.save()])

    return {
      ok: false,
      shouldRetry: false,
      message: "Paid amount does not match the order total",
      payment,
      order,
    }
  }

  const wasAlreadyPaid =
    payment.status === "successful" && order.paymentStatus === "paid"

  payment.status = "successful"
  payment.providerTransactionId = String(
    lencoPayment.id || lencoPayment.transactionId || ""
  )
  payment.verifiedAt = new Date()

  order.paymentStatus = "paid"

  if (["draft", "awaiting_payment"].includes(order.status)) {
    order.status = "submitted"
  }

  await Promise.all([payment.save(), order.save()])

  if (!wasAlreadyPaid) {
    const waiterId = order.waiter?.toString()
    await emitPaidOrderUpdates(restaurantId, order.id, waiterId)
  }

  return {
    ok: true,
    shouldRetry: false,
    message: wasAlreadyPaid
      ? "Payment already reconciled"
      : "Payment verified successfully",
    payment,
    order,
  }
}

paymentRouter.post(
  "/webhook/lenco",
  asyncHandler(async (request, response) => {
    const result = webhookSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid webhook payload",
      })
      return
    }

    const reference = result.data.data?.reference || result.data.reference || ""

    if (!reference) {
      response.status(202).json({
        message: "Webhook received without a reference",
      })
      return
    }

    const payment = await Payment.findOne({
      reference,
      provider: "lenco",
    })

    if (!payment) {
      response.status(202).json({
        message: "Webhook received for an unknown payment reference",
      })
      return
    }

    const restaurantId = payment.restaurant?.toString()

    if (!restaurantId) {
      response.status(202).json({
        message: "Webhook received for a payment without restaurant context",
      })
      return
    }

    const order = await Order.findById(payment.order)

    if (!order) {
      response.status(202).json({
        message: "Webhook received for a payment without an order",
      })
      return
    }

    let paymentSettings

    try {
      paymentSettings = await getRestaurantPaymentSettings(restaurantId)
    } catch (error) {
      response.status(202).json({
        message:
          error instanceof Error
            ? error.message
            : "Restaurant payment settings are not configured",
      })
      return
    }

    const reconciliation = await reconcilePaymentWithProvider({
      restaurantId,
      paymentSettings,
      payment,
      order,
      webhookEvent: result.data.event || result.data.type || "webhook",
      webhookPayload: result.data,
    })

    response.status(reconciliation.shouldRetry ? 202 : 200).json({
      message: reconciliation.message,
    })
  })
)

paymentRouter.use(authenticate, requireRole("waiter"), requireRestaurantContext)

paymentRouter.post(
  "/orders/:orderId/initialize",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

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

    let paymentSettings

    try {
      paymentSettings = await getRestaurantPaymentSettings(restaurantId)
    } catch (error) {
      response.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Restaurant payment settings are not configured",
      })
      return
    }

    const order = await Order.findOne({
      _id: request.params.orderId,
      restaurant: restaurantId,
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
        restaurant: restaurantId,
        order: order._id,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    )

    const reference = generatePaymentReference()

    await Payment.create({
      restaurant: restaurantId,
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
        publicKey: paymentSettings.publicKey,
        checkoutScriptUrl: paymentSettings.checkoutScriptUrl,
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
    const restaurantId = authenticatedRequest.user!.restaurantId!
    const result = verifySchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid verification details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    let paymentSettings

    try {
      paymentSettings = await getRestaurantPaymentSettings(restaurantId)
    } catch (error) {
      response.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Restaurant payment settings are not configured",
      })
      return
    }

    const payment = await Payment.findOne({
      restaurant: restaurantId,
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
      restaurant: restaurantId,
      waiter: authenticatedRequest.user?.id,
    })

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    const reconciliation = await reconcilePaymentWithProvider({
      restaurantId,
      paymentSettings,
      payment,
      order,
    })

    if (!reconciliation.ok) {
      response.status(reconciliation.shouldRetry ? 202 : 400).json({
        message: reconciliation.message,
        paymentStatus:
          reconciliation.order?.paymentStatus || order.paymentStatus,
      })
      return
    }

    response.json({
      message: reconciliation.message,
      order: reconciliation.order || order,
    })
  })
)
