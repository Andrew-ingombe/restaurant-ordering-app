import bcrypt from "bcryptjs"
import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { asyncHandler } from "../middleware/async-handler"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import {
  requireOwner,
  requireRestaurantContext,
} from "../middleware/role.middleware"
import { User } from "../models/user.model"

export const userRouter = Router()

userRouter.use(authenticate, requireOwner, requireRestaurantContext)

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional().default(""),
  password: z.string().min(8).max(128),
  role: z.enum(["waiter", "kitchen"]),
})

userRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    const users = await User.find({
      restaurant: authenticatedRequest.user!.restaurantId,
      role: { $in: ["waiter", "kitchen"] },
    })
      .select("name email phone role active createdAt")
      .sort({ createdAt: -1 })

    response.json({ users })
  })
)

userRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = createUserSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid staff details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const existingUser = await User.exists({
      email: result.data.email,
    })

    if (existingUser) {
      response.status(409).json({
        message: "A user with this email already exists",
      })
      return
    }

    const passwordHash = await bcrypt.hash(result.data.password, 12)

    const user = await User.create({
      restaurant: authenticatedRequest.user!.restaurantId,
      name: result.data.name,
      email: result.data.email,
      phone: result.data.phone,
      passwordHash,
      role: result.data.role,
      active: true,
    })

    response.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active,
      },
    })
  })
)

userRouter.patch(
  "/:id/status",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid staff member ID",
      })
      return
    }

    const result = z
      .object({
        active: z.boolean(),
      })
      .safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Active status is required",
      })
      return
    }

    const user = await User.findOneAndUpdate(
      {
        _id: request.params.id,
        restaurant: authenticatedRequest.user!.restaurantId,
        role: { $in: ["waiter", "kitchen"] },
      },
      {
        $set: {
          active: result.data.active,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("name email phone role active")

    if (!user) {
      response.status(404).json({
        message: "Staff member not found",
      })
      return
    }

    response.json({ user })
  })
)
