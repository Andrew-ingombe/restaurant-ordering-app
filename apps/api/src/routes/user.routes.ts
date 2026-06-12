import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"

import { authenticate } from "../middleware/auth.middleware"
import { requireOwner } from "../middleware/role.middleware"
import { User } from "../models/user.model"

export const userRouter = Router()

userRouter.use(authenticate, requireOwner)

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().optional(),
  password: z.string().min(8),
  role: z.enum(["waiter", "kitchen"]),
})

userRouter.get("/", async (_request, response) => {
  const users = await User.find()
    .select("name email phone role active createdAt")
    .sort({ createdAt: -1 })

  response.json({ users })
})

userRouter.post("/", async (request, response) => {
  const result = createUserSchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({
      message: "Invalid staff details",
      errors: result.error.flatten().fieldErrors,
    })
    return
  }

  const existingUser = await User.findOne({
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

userRouter.patch("/:id/status", async (request, response) => {
  const result = z.object({ active: z.boolean() }).safeParse(request.body)

  if (!result.success) {
    response.status(400).json({
      message: "Active status is required",
    })
    return
  }

  const user = await User.findOneAndUpdate(
    {
      _id: request.params.id,
      role: { $in: ["waiter", "kitchen"] },
    },
    {
      active: result.data.active,
    },
    {
      new: true,
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
