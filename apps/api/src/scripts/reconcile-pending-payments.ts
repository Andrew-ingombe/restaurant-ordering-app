import "dotenv/config"
import axios from "axios"

import { connectDatabase } from "../config/database"
import { decryptSecret } from "../lib/crypto"
import { Order } from "../models/order.model"
import { Payment } from "../models/payment.model"
import { Restaurant } from "../models/restaurant.model"

const emitLog = (message: string) => {
  console.log(`[reconcile] ${message}`)
}

const fetchRestaurantPaymentSettings = async (restaurantId: string) => {
  const restaurant = await Restaurant.findById(restaurantId).select(
    "+paymentSettings.publicKey +paymentSettings.encryptedSecretKey"
  )

  if (!restaurant) {
    throw new Error(`Restaurant not found: ${restaurantId}`)
  }

  const settings = restaurant.paymentSettings

  if (!settings?.enabled || !settings.encryptedSecretKey || !settings.baseUrl) {
    throw new Error(
      `Restaurant payment settings are incomplete for ${restaurant.name}`
    )
  }

  return {
    restaurant,
    secretKey: decryptSecret(settings.encryptedSecretKey),
    baseUrl: settings.baseUrl,
  }
}

const reconcilePayment = async (paymentId: string) => {
  const payment = await Payment.findById(paymentId)

  if (!payment) {
    emitLog(`Payment not found: ${paymentId}`)
    return
  }

  if (!payment.restaurant) {
    emitLog(`Skipping payment ${payment.reference}: no restaurant linked`)
    return
  }

  if (!payment.order) {
    emitLog(`Skipping payment ${payment.reference}: no order linked`)
    return
  }

  if (payment.status !== "pending") {
    emitLog(
      `Skipping payment ${payment.reference}: status is already ${payment.status}`
    )
    return
  }

  const order = await Order.findById(payment.order)

  if (!order) {
    emitLog(`Skipping payment ${payment.reference}: order not found`)
    return
  }

  const { restaurant, secretKey, baseUrl } =
    await fetchRestaurantPaymentSettings(payment.restaurant.toString())

  emitLog(
    `Reconciling ${payment.reference} for restaurant ${restaurant.name}...`
  )

  let lencoPayment: any = null

  try {
    const response = await axios.get(
      `${baseUrl}/collections/status/${encodeURIComponent(payment.reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
        },
        timeout: 15000,
      }
    )

    lencoPayment = response.data?.data || null
  } catch (error) {
    if (axios.isAxiosError(error)) {
      emitLog(
        `Lenco request failed for ${payment.reference}: ${error.response?.status || error.message}`
      )
      return
    }

    throw error
  }

  payment.lastReconciledAt = new Date()
  payment.reconciliationCount = (payment.reconciliationCount || 0) + 1

  if (!lencoPayment) {
    await payment.save()
    emitLog(`No Lenco payment found for ${payment.reference}`)
    return
  }

  const normalizedStatus = String(lencoPayment.status || "").toLowerCase()
  const normalizedCurrency = String(lencoPayment.currency || "").toUpperCase()
  const paidAmountInMinorUnits = Math.round(Number(lencoPayment.amount) * 100)

  payment.providerResponse = lencoPayment

  if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
    payment.status = normalizedStatus === "cancelled" ? "cancelled" : "failed"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "failed"
    }

    await Promise.all([payment.save(), order.save()])

    emitLog(
      `Marked ${payment.reference} as ${payment.status}; order ${order.orderNumber} payment is failed`
    )
    return
  }

  if (normalizedStatus !== "successful") {
    payment.status = "pending"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "pending"
    }

    await Promise.all([payment.save(), order.save()])

    emitLog(`Payment ${payment.reference} still pending`)
    return
  }

  if (normalizedCurrency !== payment.currency) {
    payment.status = "failed"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "failed"
    }

    await Promise.all([payment.save(), order.save()])

    emitLog(
      `Currency mismatch for ${payment.reference}: expected ${payment.currency}, got ${normalizedCurrency}`
    )
    return
  }

  if (paidAmountInMinorUnits !== payment.amount) {
    payment.status = "failed"

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "failed"
    }

    await Promise.all([payment.save(), order.save()])

    emitLog(
      `Amount mismatch for ${payment.reference}: expected ${payment.amount}, got ${paidAmountInMinorUnits}`
    )
    return
  }

  const alreadyPaid = order.paymentStatus === "paid"

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

  emitLog(
    alreadyPaid
      ? `Payment ${payment.reference} was already reconciled`
      : `Payment ${payment.reference} marked successful; order ${order.orderNumber} submitted`
  )
}

const reconcilePendingPayments = async () => {
  await connectDatabase()

  const limit = Number(process.env.RECONCILE_LIMIT || "50")
  const onlyReference = process.env.RECONCILE_REFERENCE?.trim()

  if (onlyReference) {
    const payment = await Payment.findOne({
      reference: onlyReference,
    }).sort({ createdAt: -1 })

    if (!payment) {
      emitLog(`No payment found for reference ${onlyReference}`)
      process.exit(0)
    }

    await reconcilePayment(payment.id)
    process.exit(0)
  }

  const minimumAgeMinutes = Number(process.env.RECONCILE_MIN_AGE_MINUTES || "5")
  const olderThan = new Date(Date.now() - minimumAgeMinutes * 60 * 1000)

  const pendingPayments = await Payment.find({
    status: "pending",
    createdAt: { $lte: olderThan },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("_id reference status restaurant order")

  emitLog(
    `Found ${pendingPayments.length} pending payment(s) older than ${minimumAgeMinutes} minute(s)`
  )

  for (const payment of pendingPayments) {
    await reconcilePayment(payment.id)
  }

  process.exit(0)
}

reconcilePendingPayments().catch((error) => {
  console.error("[reconcile] Failed:", error)
  process.exit(1)
})
