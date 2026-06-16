import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requirePlatformAdmin } from "../middleware/role.middleware"
import { Restaurant } from "../models/restaurant.model"
import { User } from "../models/user.model"

export const platformRouter = Router()

platformRouter.use(authenticate, requirePlatformAdmin)

const onboardingSchema = z.object({
  restaurant: z.object({
    name: z.string().trim().min(2).max(120),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("ZMW"),
    timezone: z.string().trim().min(1).max(100).default("Africa/Lusaka"),
    phone: z.string().trim().max(30).optional().default(""),
    email: z.string().trim().email().or(z.literal("")).optional().default(""),
    address: z.string().trim().max(500).optional().default(""),
    receiptFooter: z.string().trim().max(500).optional().default(""),
  }),
  owner: z.object({
    name: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(30).optional().default(""),
    password: z.string().min(8).max(128),
  }),
  subscription: z
    .object({
      plan: z.enum(["pilot", "starter", "growth"]).default("pilot"),
      trialDays: z.coerce.number().int().min(0).max(365).optional(),
    })
    .optional()
    .default({
      plan: "pilot",
    }),
})

const createBaseSlug = (name: string) => {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return slug || "restaurant"
}

const generateUniqueSlug = async (name: string) => {
  const baseSlug = createBaseSlug(name)
  let slug = baseSlug
  let suffix = 2

  while (await Restaurant.exists({ slug })) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}

platformRouter.post(
  "/restaurants",
  asyncHandler(async (request, response) => {
    const result = onboardingSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid restaurant onboarding details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const existingOwner = await User.exists({
      email: result.data.owner.email,
    })

    if (existingOwner) {
      response.status(409).json({
        message: "A user with this email already exists",
      })
      return
    }

    const slug = await generateUniqueSlug(result.data.restaurant.name)
    const trialDays = result.data.subscription.trialDays ?? env.defaultTrialDays

    const trialStartsAt = new Date()
    const trialEndsAt = new Date(trialStartsAt)

    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + trialDays)

    const passwordHash = await bcrypt.hash(result.data.owner.password, 12)

    let restaurantId: string | null = null

    try {
      const restaurant = await Restaurant.create({
        name: result.data.restaurant.name,
        slug,
        active: true,
        settings: {
          currency: result.data.restaurant.currency,
          timezone: result.data.restaurant.timezone,
          phone: result.data.restaurant.phone,
          email: result.data.restaurant.email,
          address: result.data.restaurant.address,
          receiptFooter: result.data.restaurant.receiptFooter,
        },
        subscription: {
          plan: result.data.subscription.plan,
          status: trialDays > 0 ? "trialing" : "active",
          trialEndsAt: trialDays > 0 ? trialEndsAt : undefined,
          currentPeriodStartsAt: trialDays === 0 ? trialStartsAt : undefined,
        },
        paymentSettings: {
          provider: "lenco",
          environment: "sandbox",
          publicKey: "",
          encryptedSecretKey: "",
          enabled: false,
        },
      })

      restaurantId = restaurant.id

      const owner = await User.create({
        restaurant: restaurant._id,
        name: result.data.owner.name,
        email: result.data.owner.email,
        phone: result.data.owner.phone,
        passwordHash,
        role: "owner",
        active: true,
      })

      response.status(201).json({
        message: "Restaurant onboarded successfully",
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          active: restaurant.active,
          settings: restaurant.settings,
          subscription: restaurant.subscription,
          paymentConfigured: false,
        },
        owner: {
          id: owner.id,
          restaurantId: restaurant.id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          role: owner.role,
          active: owner.active,
        },
      })
    } catch (error) {
      if (restaurantId) {
        await Restaurant.findByIdAndDelete(restaurantId)
      }

      throw error
    }
  })
)
