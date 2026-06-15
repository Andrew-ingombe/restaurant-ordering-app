import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requireOwner } from "../middleware/role.middleware"
import { Order } from "../models/order.model"

export const dashboardRouter = Router()

dashboardRouter.use(authenticate, requireOwner)

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
    const dateResult = dateSchema.safeParse(request.query.date)

    if (!dateResult.success) {
      response.status(400).json({
        message: "Date must use YYYY-MM-DD format",
      })
      return
    }

    const selectedDate = dateResult.data || getDateInTimezone()

    const matchDate = {
      $expr: {
        $eq: [
          {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: env.restaurantTimezone,
            },
          },
          selectedDate,
        ],
      },
    } as const

    const paidMatch = {
      ...matchDate,
      paymentStatus: "paid" as const,
    }

    const [salesSummary, statusBreakdown, bestSellingItems, recentOrders] =
      await Promise.all([
        Order.aggregate([
          { $match: paidMatch },
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$total" },
              paidOrders: { $sum: 1 },
              completedOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
                },
              },
              activeOrders: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        [
                          "submitted",
                          "accepted",
                          "preparing",
                          "ready",
                          "served",
                        ],
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
        Order.aggregate([
          { $match: paidMatch },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        Order.aggregate([
          { $match: paidMatch },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.menuItem",
              name: { $first: "$items.name" },
              quantity: { $sum: "$items.quantity" },
              sales: { $sum: "$items.lineTotal" },
            },
          },
          { $sort: { quantity: -1, sales: -1 } },
          { $limit: 5 },
        ]),
        Order.find(paidMatch)
          .populate("waiter", "name")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ])

    const summary = salesSummary[0] || {
      totalSales: 0,
      paidOrders: 0,
      completedOrders: 0,
      activeOrders: 0,
    }

    response.json({
      date: selectedDate,
      timezone: env.restaurantTimezone,
      summary: {
        ...summary,
        averageOrderValue:
          summary.paidOrders > 0
            ? Math.round(summary.totalSales / summary.paidOrders)
            : 0,
      },
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item._id,
        count: item.count,
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
      ...(search
        ? {
            orderNumber: {
              $regex: escapeRegex(search),
              $options: "i" as const,
            },
          }
        : {}),
      ...(status !== "all" ? { status } : {}),
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
        .sort({ createdAt: -1 })
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
    const orderId = request.params.id as string

    if (!Types.ObjectId.isValid(orderId)) {
      response.status(400).json({
        message: "Invalid order ID",
      })
      return
    }

    const order = await Order.findById(orderId)
      .populate("waiter", "name email")
      .populate("restaurantTable", "name")
      .lean()

    if (!order) {
      response.status(404).json({
        message: "Order not found",
      })
      return
    }

    response.json({ order })
  })
)
