import { Router } from "express"
import jwt from "jsonwebtoken"
import { Types } from "mongoose"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requireOwner } from "../middleware/role.middleware"
import { RestaurantTable } from "../models/restaurant-table.model"

export const tableRouter = Router()

tableRouter.use(authenticate, requireOwner)

const createTableSchema = z.object({
  name: z.string().trim().min(1).max(50),
})

const updateTableSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  active: z.boolean().optional(),
})

const createTableToken = (tableId: string) =>
  jwt.sign(
    {
      tableId,
      purpose: "customer-menu",
    },
    env.jwtSecret
  )

const serializeTable = (table: {
  _id: Types.ObjectId
  name: string
  active: boolean
}) => {
  const token = createTableToken(table._id.toString())

  return {
    id: table._id,
    name: table.name,
    active: table.active,
    menuUrl: `${env.frontendUrl}/menu/table/${token}`,
  }
}

tableRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const tables = await RestaurantTable.find().sort({
      name: 1,
    })

    response.json({
      tables: tables.map(serializeTable),
    })
  })
)

tableRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const result = createTableSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid table details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const existingTable = await RestaurantTable.findOne({
      name: {
        $regex: `^${result.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    })

    if (existingTable) {
      response.status(409).json({
        message: "A table with this name already exists",
      })
      return
    }

    const table = await RestaurantTable.create(result.data)

    response.status(201).json({
      table: serializeTable(table),
    })
  })
)

tableRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
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
        _id: { $ne: request.params.id },
        name: {
          $regex: `^${result.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
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

    const table = await RestaurantTable.findByIdAndUpdate(
      request.params.id,
      result.data,
      {
        new: true,
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
      table: serializeTable(table),
    })
  })
)
