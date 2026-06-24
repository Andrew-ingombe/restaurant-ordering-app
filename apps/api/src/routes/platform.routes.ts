import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"

import { env } from "../config/env"
import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requirePlatformAdmin } from "../middleware/role.middleware"
import { Restaurant } from "../models/restaurant.model"
import { User } from "../models/user.model"
import { Types } from "mongoose"
import { encryptSecret } from "../lib/crypto"
import { disconnectUserSockets } from "../lib/socket"

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

const paymentSettingsSchema = z
  .object({
    environment: z.enum(["sandbox", "production"]).optional(),
    baseUrl: z.string().trim().url().optional(),
    checkoutScriptUrl: z.string().trim().url().optional(),
    publicKey: z.string().trim().min(1).optional(),
    secretKey: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one payment setting is required",
  })

const subscriptionSettingsSchema = z
  .object({
    plan: z.enum(["pilot", "starter", "growth"]).optional(),
    status: z
      .enum(["trialing", "active", "past_due", "suspended", "cancelled"])
      .optional(),
    trialEndsAt: z.string().datetime().or(z.literal("")).optional(),
    currentPeriodStartsAt: z.string().datetime().or(z.literal("")).optional(),
    currentPeriodEndsAt: z.string().datetime().or(z.literal("")).optional(),
    gracePeriodEndsAt: z.string().datetime().or(z.literal("")).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one subscription setting is required",
  })

const parseOptionalDate = (value?: string) => {
  if (value === "") return null
  if (!value) return undefined

  return new Date(value)
}

const defaultPaymentUrls = {
  sandbox: {
    baseUrl: "https://sandbox.lenco.co/access/v2",
    checkoutScriptUrl: "https://pay.sandbox.lenco.co/js/v1/inline.js",
  },
  production: {
    baseUrl: "https://api.lenco.co/access/v2",
    checkoutScriptUrl: "https://pay.lenco.co/js/v1/inline.js",
  },
}

const resetOwnerPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).max(128),
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

platformRouter.get(
  "/restaurants/:id/payment-settings",
  asyncHandler(async (request, response) => {
    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid restaurant ID",
      })
      return
    }

    const restaurant = await Restaurant.findById(request.params.id)
      .select("+paymentSettings.publicKey +paymentSettings.encryptedSecretKey")
      .lean()

    if (!restaurant) {
      response.status(404).json({
        message: "Restaurant not found",
      })
      return
    }

    response.json({
      paymentSettings: {
        provider: restaurant.paymentSettings?.provider || "lenco",
        environment: restaurant.paymentSettings?.environment || "sandbox",
        baseUrl:
          restaurant.paymentSettings?.baseUrl ||
          defaultPaymentUrls.sandbox.baseUrl,
        checkoutScriptUrl:
          restaurant.paymentSettings?.checkoutScriptUrl ||
          defaultPaymentUrls.sandbox.checkoutScriptUrl,
        publicKeyConfigured: Boolean(restaurant.paymentSettings?.publicKey),
        secretKeyConfigured: Boolean(
          restaurant.paymentSettings?.encryptedSecretKey
        ),
        enabled: Boolean(restaurant.paymentSettings?.enabled),
      },
    })
  })
)

platformRouter.patch(
  "/restaurants/:id/payment-settings",
  asyncHandler(async (request, response) => {
    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({ message: "Invalid restaurant ID" })
      return
    }

    const result = paymentSettingsSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid payment settings",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const restaurant = await Restaurant.findById(request.params.id).select(
      "+paymentSettings.publicKey +paymentSettings.encryptedSecretKey"
    )

    if (!restaurant) {
      response.status(404).json({ message: "Restaurant not found" })
      return
    }

    const environment =
      result.data.environment ||
      restaurant.paymentSettings?.environment ||
      "sandbox"

    const urls = defaultPaymentUrls[environment]

    const publicKey =
      result.data.publicKey || restaurant.paymentSettings?.publicKey || ""

    const encryptedSecretKey = result.data.secretKey
      ? encryptSecret(result.data.secretKey)
      : restaurant.paymentSettings?.encryptedSecretKey || ""

    const enabled =
      result.data.enabled ?? Boolean(restaurant.paymentSettings?.enabled)

    if (enabled && (!publicKey || !encryptedSecretKey)) {
      response.status(400).json({
        message:
          "Public key and secret key are required before enabling payments",
      })
      return
    }

    restaurant.set({
      "paymentSettings.provider": "lenco",
      "paymentSettings.environment": environment,
      "paymentSettings.baseUrl":
        result.data.baseUrl ||
        restaurant.paymentSettings?.baseUrl ||
        urls.baseUrl,
      "paymentSettings.checkoutScriptUrl":
        result.data.checkoutScriptUrl ||
        restaurant.paymentSettings?.checkoutScriptUrl ||
        urls.checkoutScriptUrl,
      "paymentSettings.publicKey": publicKey,
      "paymentSettings.encryptedSecretKey": encryptedSecretKey,
      "paymentSettings.enabled": enabled,
    })

    await restaurant.save()

    response.json({
      message: "Payment settings updated",
      paymentSettings: {
        provider: restaurant.paymentSettings?.provider || "lenco",
        environment: restaurant.paymentSettings?.environment || "sandbox",
        baseUrl: restaurant.paymentSettings?.baseUrl || urls.baseUrl,
        checkoutScriptUrl:
          restaurant.paymentSettings?.checkoutScriptUrl ||
          urls.checkoutScriptUrl,
        publicKeyConfigured: Boolean(restaurant.paymentSettings?.publicKey),
        secretKeyConfigured: Boolean(
          restaurant.paymentSettings?.encryptedSecretKey
        ),
        enabled: Boolean(restaurant.paymentSettings?.enabled),
      },
    })
  })
)

platformRouter.get(
  "/restaurants",
  asyncHandler(async (_request, response) => {
    const restaurants = await Restaurant.find()
      .select("+paymentSettings.publicKey +paymentSettings.encryptedSecretKey")
      .sort({ createdAt: -1 })
      .lean()

    response.json({
      restaurants: restaurants.map((restaurant) => ({
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        active: restaurant.active,
        settings: restaurant.settings,
        subscription: restaurant.subscription,
        paymentSettings: {
          provider: restaurant.paymentSettings?.provider || "lenco",
          environment: restaurant.paymentSettings?.environment || "sandbox",
          baseUrl: restaurant.paymentSettings?.baseUrl || "",
          checkoutScriptUrl:
            restaurant.paymentSettings?.checkoutScriptUrl || "",
          enabled: Boolean(restaurant.paymentSettings?.enabled),
          publicKeyConfigured: Boolean(restaurant.paymentSettings?.publicKey),
          secretKeyConfigured: Boolean(
            restaurant.paymentSettings?.encryptedSecretKey
          ),
        },
        createdAt: restaurant.createdAt,
      })),
    })
  })
)

platformRouter.patch(
  "/restaurants/:id/owner-password",
  asyncHandler(async (request, response) => {
    const restaurantId = request.params.id as string

    if (!Types.ObjectId.isValid(restaurantId)) {
      response.status(400).json({
        message: "Invalid restaurant ID",
      })
      return
    }

    const result = resetOwnerPasswordSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Temporary password must be at least 8 characters",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const restaurantExists = await Restaurant.exists({
      _id: restaurantId,
    })

    if (!restaurantExists) {
      response.status(404).json({
        message: "Restaurant not found",
      })
      return
    }

    const passwordHash = await bcrypt.hash(result.data.temporaryPassword, 12)

    const owner = await User.findOneAndUpdate(
      {
        restaurant: restaurantId,
        role: "owner",
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
    ).select("name email phone role active mustChangePassword")

    if (!owner) {
      response.status(404).json({
        message: "Restaurant owner not found",
      })
      return
    }

    disconnectUserSockets(owner.id)

    response.json({
      message: "Owner temporary password created",
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        role: owner.role,
        active: owner.active,
        mustChangePassword: Boolean(owner.mustChangePassword),
      },
    })
  })
)

platformRouter.patch(
  "/restaurants/:id/subscription",
  asyncHandler(async (request, response) => {
    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid restaurant ID",
      })
      return
    }

    const result = subscriptionSettingsSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid subscription settings",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const update: Record<string, unknown> = {}

    if (result.data.plan !== undefined) {
      update["subscription.plan"] = result.data.plan
    }

    if (result.data.status !== undefined) {
      update["subscription.status"] = result.data.status
    }

    const trialEndsAt = parseOptionalDate(result.data.trialEndsAt)
    const currentPeriodStartsAt = parseOptionalDate(
      result.data.currentPeriodStartsAt
    )
    const currentPeriodEndsAt = parseOptionalDate(
      result.data.currentPeriodEndsAt
    )
    const gracePeriodEndsAt = parseOptionalDate(result.data.gracePeriodEndsAt)

    if (trialEndsAt !== undefined) {
      update["subscription.trialEndsAt"] = trialEndsAt
    }

    if (currentPeriodStartsAt !== undefined) {
      update["subscription.currentPeriodStartsAt"] = currentPeriodStartsAt
    }

    if (currentPeriodEndsAt !== undefined) {
      update["subscription.currentPeriodEndsAt"] = currentPeriodEndsAt
    }

    if (gracePeriodEndsAt !== undefined) {
      update["subscription.gracePeriodEndsAt"] = gracePeriodEndsAt
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      request.params.id,
      {
        $set: update,
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).lean()

    if (!restaurant) {
      response.status(404).json({
        message: "Restaurant not found",
      })
      return
    }

    if (
      result.data.status &&
      ["suspended", "cancelled"].includes(result.data.status)
    ) {
      const restaurantUsers = await User.find({
        restaurant: restaurant._id,
      })
        .select("_id")
        .lean()

      restaurantUsers.forEach((user) => {
        disconnectUserSockets(user._id.toString())
      })
    }

    response.json({
      message: "Subscription updated",
      subscription: restaurant.subscription,
    })
  })
)
