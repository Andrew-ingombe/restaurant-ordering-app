import { Router } from "express"
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
import { Restaurant } from "../models/restaurant.model"

export const settingsRouter = Router()

settingsRouter.use(authenticate, requireOwner, requireRestaurantContext)

const restaurantSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  address: z.string().trim().max(500).optional(),
  receiptFooter: z.string().trim().max(500).optional(),
})

const serializeRestaurantSettings = (restaurant: {
  id: string
  name: string
  slug: string
  active: boolean
  settings?: {
    currency?: string
    timezone?: string
    phone?: string
    email?: string
    address?: string
    receiptFooter?: string
  }
  subscription?: {
    plan?: string
    status?: string
    trialEndsAt?: Date | string | null
    currentPeriodStartsAt?: Date | string | null
    currentPeriodEndsAt?: Date | string | null
    gracePeriodEndsAt?: Date | string | null
  }
}) => ({
  id: restaurant.id,
  name: restaurant.name,
  slug: restaurant.slug,
  active: restaurant.active,
  settings: {
    currency: restaurant.settings?.currency || "ZMW",
    timezone: restaurant.settings?.timezone || "Africa/Lusaka",
    phone: restaurant.settings?.phone || "",
    email: restaurant.settings?.email || "",
    address: restaurant.settings?.address || "",
    receiptFooter: restaurant.settings?.receiptFooter || "",
  },
  subscription: {
    plan: restaurant.subscription?.plan || "pilot",
    status: restaurant.subscription?.status || "trialing",
    trialEndsAt: restaurant.subscription?.trialEndsAt || null,
    currentPeriodStartsAt:
      restaurant.subscription?.currentPeriodStartsAt || null,
    currentPeriodEndsAt: restaurant.subscription?.currentPeriodEndsAt || null,
    gracePeriodEndsAt: restaurant.subscription?.gracePeriodEndsAt || null,
  },
})

settingsRouter.get(
  "/restaurant",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest

    const restaurant = await Restaurant.findById(
      authenticatedRequest.user!.restaurantId!
    ).lean()

    if (!restaurant) {
      response.status(404).json({
        message: "Restaurant not found",
      })
      return
    }

    response.json({
      restaurant: serializeRestaurantSettings({
        id: restaurant._id.toString(),
        name: restaurant.name,
        slug: restaurant.slug,
        active: restaurant.active,
        settings: restaurant.settings || undefined,
        subscription: restaurant.subscription || undefined,
      }),
    })
  })
)

settingsRouter.patch(
  "/restaurant",
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = restaurantSettingsSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid restaurant settings",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const update: Record<string, string> = {}

    if (result.data.name !== undefined) {
      update.name = result.data.name
    }

    if (result.data.currency !== undefined) {
      update["settings.currency"] = result.data.currency
    }

    if (result.data.timezone !== undefined) {
      update["settings.timezone"] = result.data.timezone
    }

    if (result.data.phone !== undefined) {
      update["settings.phone"] = result.data.phone
    }

    if (result.data.email !== undefined) {
      update["settings.email"] = result.data.email
    }

    if (result.data.address !== undefined) {
      update["settings.address"] = result.data.address
    }

    if (result.data.receiptFooter !== undefined) {
      update["settings.receiptFooter"] = result.data.receiptFooter
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      authenticatedRequest.user!.restaurantId!,
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

    response.json({
      message: "Restaurant settings updated",
      restaurant: serializeRestaurantSettings({
        id: restaurant._id.toString(),
        name: restaurant.name,
        slug: restaurant.slug,
        active: restaurant.active,
        settings: restaurant.settings || undefined,
        subscription: restaurant.subscription || undefined,
      }),
    })
  })
)
