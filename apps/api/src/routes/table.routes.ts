import { Router } from "express"
import jwt from "jsonwebtoken"
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
  requireRole,
} from "../middleware/role.middleware"
import { RestaurantTable } from "../models/restaurant-table.model"

export const tableRouter = Router()

const createTableSchema = z.object({
  name: z.string().trim().min(1).max(50),
})

const updateTableSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  active: z.boolean().optional(),
})

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const createTableToken = (tableId: string, restaurantId: string) =>
  jwt.sign(
    {
      tableId,
      restaurantId,
      purpose: "customer-menu",
    },
    env.tableTokenSecret
  )

const serializeTable = (
  table: {
    _id: Types.ObjectId
    name: string
    active: boolean
  },
  restaurantId: string
) => {
  const token = createTableToken(table._id.toString(), restaurantId)

  return {
    id: table._id,
    name: table.name,
    active: table.active,
    menuUrl: `${env.frontendUrl}/menu/table/${token}`,
  }
}

tableRouter.get(
  "/available",
  authenticate,
  requireRole("waiter"),
  requireRestaurantContext,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

    const tables = await RestaurantTable.find({
      restaurant: restaurantId,
      active: true,
    })
      .select("name")
      .sort({
        name: 1,
      })
      .lean()

    response.json({
      tables: tables.map((table) => ({
        id: table._id.toString(),
        name: table.name,
      })),
    })
  })
)

tableRouter.use(authenticate, requireOwner, requireRestaurantContext)

tableRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

    const tables = await RestaurantTable.find({
      restaurant: restaurantId,
    }).sort({
      name: 1,
    })

    response.json({
      tables: tables.map((table) => serializeTable(table, restaurantId)),
    })
  })
)

tableRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

    const result = createTableSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid table details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const existingTable = await RestaurantTable.findOne({
      restaurant: restaurantId,
      name: {
        $regex: `^${escapeRegex(result.data.name)}$`,
        $options: "i",
      },
    })

    if (existingTable) {
      response.status(409).json({
        message: "A table with this name already exists",
      })
      return
    }

    const table = await RestaurantTable.create({
      ...result.data,
      restaurant: restaurantId,
    })

    response.status(201).json({
      table: serializeTable(table, restaurantId),
    })
  })
)

tableRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId!

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid table ID",
      })
      return
    }

    const result = updateTableSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid table details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (result.data.name) {
      const duplicate = await RestaurantTable.exists({
        _id: {
          $ne: request.params.id,
        },
        restaurant: restaurantId,
        name: {
          $regex: `^${escapeRegex(result.data.name)}$`,
          $options: "i",
        },
      })

      if (duplicate) {
        response.status(409).json({
          message: "A table with this name already exists",
        })
        return
      }
    }

    const table = await RestaurantTable.findOneAndUpdate(
      {
        _id: request.params.id,
        restaurant: restaurantId,
      },
      {
        $set: result.data,
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    )

    if (!table) {
      response.status(404).json({
        message: "Table not found",
      })
      return
    }

    response.json({
      table: serializeTable(table, restaurantId),
    })
  })
)
