import { Router } from "express"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requireOwner } from "../middleware/role.middleware"
import { Order } from "../models/order.model"

export const dashboardRouter = Router()

dashboardRouter.use(authenticate, requireOwner)

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()

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
