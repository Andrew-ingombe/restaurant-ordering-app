import bcrypt from "bcryptjs"
import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { disconnectUserSockets } from "../lib/socket"
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
  sharedHub: z.boolean().optional().default(false),
})

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z
      .string()
      .email()
      .transform((value) => value.toLowerCase())
      .optional(),
    phone: z.string().trim().max(30).optional(),
    role: z.enum(["waiter", "kitchen"]).optional(),
    sharedHub: z.boolean().optional(),
  })
  .refine((details) => Object.keys(details).length > 0, {
    message: "At least one staff detail is required",
  })

const statusSchema = z.object({
  active: z.boolean(),
})

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).max(128),
})

const serializeStaffUser = (user: {
  id: string
  name: string
  email: string
  phone?: string | null
  role: string
  active: boolean
  sharedHub?: boolean | null
  mustChangePassword?: boolean | null
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  role: user.role,
  active: user.active,
  sharedHub: Boolean(user.sharedHub),
  mustChangePassword: Boolean(user.mustChangePassword),
})

userRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    const users = await User.find({
      restaurant: authenticatedRequest.user!.restaurantId,
      role: { $in: ["waiter", "kitchen"] },
    })
      .select(
        "name email phone role active sharedHub mustChangePassword createdAt"
      )
      .sort({ createdAt: -1 })

    response.json({
      users: users.map(serializeStaffUser),
    })
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

    if (result.data.role !== "waiter" && result.data.sharedHub) {
      response.status(400).json({
        message: "Only waiter accounts can be shared ordering hubs",
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
      sharedHub: result.data.role === "waiter" ? result.data.sharedHub : false,
      active: true,
    })

    response.status(201).json({
      user: serializeStaffUser(user),
    })
  })
)

userRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const staffId = request.params.id as string
    const restaurantId = authenticatedRequest.user!.restaurantId!

    if (!Types.ObjectId.isValid(staffId)) {
      response.status(400).json({
        message: "Invalid staff member ID",
      })
      return
    }

    const result = updateUserSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid staff details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const staffMember = await User.findOne({
      _id: staffId,
      restaurant: restaurantId,
      role: { $in: ["waiter", "kitchen"] },
    }).select("role sharedHub")

    if (!staffMember) {
      response.status(404).json({
        message: "Staff member not found",
      })
      return
    }

    if (result.data.email) {
      const duplicateEmail = await User.exists({
        _id: { $ne: staffId },
        email: result.data.email,
      })

      if (duplicateEmail) {
        response.status(409).json({
          message: "A user with this email already exists",
        })
        return
      }
    }

    const nextRole = result.data.role || staffMember.role

    if (result.data.sharedHub && nextRole !== "waiter") {
      response.status(400).json({
        message: "Only waiter accounts can be shared ordering hubs",
      })
      return
    }

    const updateDetails = {
      ...result.data,
      ...(nextRole === "kitchen" ? { sharedHub: false } : {}),
    }

    const user = await User.findOneAndUpdate(
      {
        _id: staffId,
        restaurant: restaurantId,
        role: { $in: ["waiter", "kitchen"] },
      },
      {
        $set: updateDetails,
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("name email phone role active sharedHub mustChangePassword")

    if (!user) {
      response.status(404).json({
        message: "Staff member not found",
      })
      return
    }

    if (result.data.role !== undefined || result.data.sharedHub !== undefined) {
      disconnectUserSockets(user.id)
    }

    response.json({
      user: serializeStaffUser(user),
    })
  })
)

userRouter.patch(
  "/:id/password",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const staffId = request.params.id as string

    if (!Types.ObjectId.isValid(staffId)) {
      response.status(400).json({
        message: "Invalid staff member ID",
      })
      return
    }

    const result = resetPasswordSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Temporary password must be at least 8 characters",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const passwordHash = await bcrypt.hash(result.data.temporaryPassword, 12)

    const user = await User.findOneAndUpdate(
      {
        _id: staffId,
        restaurant: authenticatedRequest.user!.restaurantId,
        role: { $in: ["waiter", "kitchen"] },
      },
      {
        $set: {
          passwordHash,
          mustChangePassword: true,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("name email phone role active sharedHub mustChangePassword")

    if (!user) {
      response.status(404).json({
        message: "Staff member not found",
      })
      return
    }

    disconnectUserSockets(user.id)

    response.json({
      message: "Temporary password created",
      user: serializeStaffUser(user),
    })
  })
)

userRouter.patch(
  "/:id/status",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const staffId = request.params.id as string

    if (!Types.ObjectId.isValid(staffId)) {
      response.status(400).json({
        message: "Invalid staff member ID",
      })
      return
    }

    const result = statusSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Active status is required",
      })
      return
    }

    const user = await User.findOneAndUpdate(
      {
        _id: staffId,
        restaurant: authenticatedRequest.user!.restaurantId,
        role: { $in: ["waiter", "kitchen"] },
      },
      {
        $set: {
          active: result.data.active,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("name email phone role active sharedHub mustChangePassword")

    if (!user) {
      response.status(404).json({
        message: "Staff member not found",
      })
      return
    }

    if (!user.active) {
      disconnectUserSockets(user.id)
    }

    response.json({
      user: serializeStaffUser(user),
    })
  })
)
