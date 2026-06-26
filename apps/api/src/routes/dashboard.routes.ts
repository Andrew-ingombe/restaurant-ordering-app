import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import {
  requireOwner,
  requireRestaurantContext,
} from "../middleware/role.middleware"
import { Order } from "../models/order.model"
import { Payment } from "../models/payment.model"

export const dashboardRouter = Router()

dashboardRouter.use(authenticate, requireOwner, requireRestaurantContext)

const DELAYED_KITCHEN_MINUTES = 30

const orderStatuses = [
  "draft",
  "awaiting_waiter",
  "awaiting_payment",
  "submitted",
  "accepted",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
] as const

const activeOrderStatuses = [
  "awaiting_waiter",
  "awaiting_payment",
  "submitted",
  "accepted",
  "preparing",
  "ready",
  "served",
] as const

const delayedKitchenStatuses = ["submitted", "accepted", "preparing"] as const

const paymentMethods = [
  "cash",
  "card_pos",
  "manual_mobile_money",
  "lenco",
  "unrecorded",
] as const

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()

const orderHistoryQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional().default(""),
    status: z
      .enum([...orderStatuses, "all"])
      .optional()
      .default("all"),
    dateFrom: dateSchema,
    dateTo: dateSchema,
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .refine(
    (query) =>
      !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
    {
      message: "Start date cannot be after end date",
      path: ["dateTo"],
    }
  )

const getDateInTimezone = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.restaurantTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

dashboardRouter.get(
  "/summary",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!
    const restaurantObjectId = new Types.ObjectId(restaurantId)
    const dateResult = dateSchema.safeParse(request.query.date)

    if (!dateResult.success) {
      response.status(400).json({
        message: "Date must use YYYY-MM-DD format",
      })
      return
    }

    const selectedDate = dateResult.data || getDateInTimezone()
    const delayedKitchenCutoff = new Date(
      Date.now() - DELAYED_KITCHEN_MINUTES * 60 * 1000
    )

    const createdDateExpression = {
      $dateToString: {
        format: "%Y-%m-%d",
        date: "$createdAt",
        timezone: env.restaurantTimezone,
      },
    } as const

    const paidDateExpression = {
      $dateToString: {
        format: "%Y-%m-%d",
        date: {
          $ifNull: ["$paidAt", "$createdAt"],
        },
        timezone: env.restaurantTimezone,
      },
    } as const

    const paymentCreatedDateExpression = {
      $dateToString: {
        format: "%Y-%m-%d",
        date: "$createdAt",
        timezone: env.restaurantTimezone,
      },
    } as const

    const operationalMatch = {
      restaurant: restaurantObjectId,
      status: {
        $ne: "draft",
      },
      $expr: {
        $eq: [createdDateExpression, selectedDate],
      },
    } as const

    const attentionMatch = {
      restaurant: restaurantObjectId,
      status: {
        $in: [...activeOrderStatuses],
      },
    } as const

    const paidMatch = {
      restaurant: restaurantObjectId,
      paymentStatus: "paid",
      $expr: {
        $eq: [paidDateExpression, selectedDate],
      },
    } as const

    const paymentAttentionMatch = {
      restaurant: restaurantObjectId,
      status: {
        $in: ["pending", "failed"],
      },
      $expr: {
        $eq: [paymentCreatedDateExpression, selectedDate],
      },
    } as const

    const [
      salesSummary,
      operationalSummary,
      attentionSummary,
      paymentAttentionSummary,
      paymentBreakdown,
      statusBreakdown,
      bestSellingItems,
      recentOrders,
    ] = await Promise.all([
      Order.aggregate([
        {
          $match: paidMatch,
        },
        {
          $group: {
            _id: null,
            totalSales: {
              $sum: "$total",
            },
            paidOrders: {
              $sum: 1,
            },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: operationalMatch,
        },
        {
          $group: {
            _id: null,
            completedOrders: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "completed"],
                  },
                  1,
                  0,
                ],
              },
            },
            activeOrders: {
              $sum: {
                $cond: [
                  {
                    $in: ["$status", [...activeOrderStatuses]],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: attentionMatch,
        },
        {
          $group: {
            _id: null,
            servedUnpaidCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ["$status", "served"],
                      },
                      {
                        $ne: ["$paymentStatus", "paid"],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            servedUnpaidValue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ["$status", "served"],
                      },
                      {
                        $ne: ["$paymentStatus", "paid"],
                      },
                    ],
                  },
                  "$total",
                  0,
                ],
              },
            },
            unclaimedQrRequests: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ["$source", "customer_qr"],
                      },
                      {
                        $eq: ["$status", "awaiting_waiter"],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            delayedKitchenOrders: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $in: ["$status", [...delayedKitchenStatuses]],
                      },
                      {
                        $lte: ["$updatedAt", delayedKitchenCutoff],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: paymentAttentionMatch,
        },
        {
          $lookup: {
            from: Order.collection.name,
            localField: "order",
            foreignField: "_id",
            as: "order",
          },
        },
        {
          $unwind: "$order",
        },
        {
          $match: {
            "order.restaurant": restaurantObjectId,
            "order.paymentStatus": {
              $ne: "paid",
            },
          },
        },
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Order.aggregate([
        {
          $match: paidMatch,
        },
        {
          $group: {
            _id: {
              $cond: [
                {
                  $in: [
                    "$paymentMethod",
                    ["cash", "card_pos", "manual_mobile_money", "lenco"],
                  ],
                },
                "$paymentMethod",
                "unrecorded",
              ],
            },
            count: {
              $sum: 1,
            },
            total: {
              $sum: "$total",
            },
          },
        },
        {
          $sort: {
            total: -1,
          },
        },
      ]),

      Order.aggregate([
        {
          $match: operationalMatch,
        },
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ]),

      Order.aggregate([
        {
          $match: paidMatch,
        },
        {
          $unwind: "$items",
        },
        {
          $group: {
            _id: "$items.menuItem",
            name: {
              $first: "$items.name",
            },
            quantity: {
              $sum: "$items.quantity",
            },
            sales: {
              $sum: "$items.lineTotal",
            },
          },
        },
        {
          $sort: {
            quantity: -1,
            sales: -1,
          },
        },
        {
          $limit: 4,
        },
      ]),

      Order.find(operationalMatch)
        .populate("waiter", "name")
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean(),
    ])

    const sales = salesSummary[0] || {
      totalSales: 0,
      paidOrders: 0,
    }

    const operations = operationalSummary[0] || {
      completedOrders: 0,
      activeOrders: 0,
    }

    const attention = attentionSummary[0] || {
      servedUnpaidCount: 0,
      servedUnpaidValue: 0,
      unclaimedQrRequests: 0,
      delayedKitchenOrders: 0,
    }

    const paymentAttentionMap = new Map(
      paymentAttentionSummary.map((item) => [
        String(item._id),
        Number(item.count),
      ])
    )

    const paymentBreakdownMap = new Map(
      paymentBreakdown.map((item) => [
        String(item._id),
        {
          count: Number(item.count),
          total: Number(item.total),
        },
      ])
    )

    const statusBreakdownMap = new Map(
      statusBreakdown.map((item) => [String(item._id), Number(item.count)])
    )

    statusBreakdownMap.set(
      "awaiting_payment",
      (statusBreakdownMap.get("awaiting_payment") || 0) +
        Number(attention.servedUnpaidCount || 0)
    )

    response.json({
      date: selectedDate,
      timezone: env.restaurantTimezone,

      summary: {
        totalSales: sales.totalSales,
        paidOrders: sales.paidOrders,
        completedOrders: operations.completedOrders,
        activeOrders: operations.activeOrders,
        averageOrderValue:
          sales.paidOrders > 0
            ? Math.round(sales.totalSales / sales.paidOrders)
            : 0,
      },

      attention: {
        servedUnpaid: {
          count: attention.servedUnpaidCount,
          total: attention.servedUnpaidValue,
        },
        unclaimedQrRequests: {
          count: attention.unclaimedQrRequests,
        },
        delayedKitchenOrders: {
          count: attention.delayedKitchenOrders,
          thresholdMinutes: DELAYED_KITCHEN_MINUTES,
        },
        pendingPayments: {
          count: paymentAttentionMap.get("pending") || 0,
        },
        failedPayments: {
          count: paymentAttentionMap.get("failed") || 0,
        },
      },

      paymentBreakdown: paymentMethods.map((method) => {
        const paymentData = paymentBreakdownMap.get(method)

        return {
          method,
          count: paymentData?.count || 0,
          total: paymentData?.total || 0,
        }
      }),

      statusBreakdown: Array.from(statusBreakdownMap.entries())
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          status,
          count,
        })),

      bestSellingItems: bestSellingItems.map((item) => ({
        menuItem: item._id,
        name: item.name,
        quantity: item.quantity,
        sales: item.sales,
      })),

      recentOrders,
    })
  })
)

dashboardRouter.get(
  "/orders",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!
    const result = orderHistoryQuerySchema.safeParse(request.query)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid order history filters",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const { search, status, dateFrom, dateTo, page, limit } = result.data

    const dateExpression = {
      $dateToString: {
        format: "%Y-%m-%d",
        date: "$createdAt",
        timezone: env.restaurantTimezone,
      },
    } as const

    const dateConditions: Record<string, unknown>[] = []

    if (dateFrom) {
      dateConditions.push({
        $gte: [dateExpression, dateFrom],
      })
    }

    if (dateTo) {
      dateConditions.push({
        $lte: [dateExpression, dateTo],
      })
    }

    const filter = {
      restaurant: restaurantId,

      ...(search
        ? {
            orderNumber: {
              $regex: escapeRegex(search),
              $options: "i" as const,
            },
          }
        : {}),

      ...(status !== "all"
        ? {
            status,
          }
        : {}),

      ...(dateConditions.length > 0
        ? {
            $expr: {
              $and: dateConditions,
            },
          }
        : {}),
    }

    const skip = (page - 1) * limit

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate("waiter", "name email")
        .populate("restaurantTable", "name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter),
    ])

    const totalPages = Math.ceil(totalOrders / limit)

    response.json({
      orders,

      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },

      filters: {
        search,
        status,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },

      timezone: env.restaurantTimezone,
    })
  })
)

dashboardRouter.get(
  "/orders/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!
    const orderId = request.params.id as string

    if (!Types.ObjectId.isValid(orderId)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findOne({
      _id: orderId,
      restaurant: restaurantId,
    })
      .populate("waiter", "name email")
      .populate("restaurantTable", "name")
      .lean()

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    response.json({
      order,
    })
  })
)
