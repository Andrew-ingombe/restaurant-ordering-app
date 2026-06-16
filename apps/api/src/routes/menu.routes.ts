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
  requireRole,
} from "../middleware/role.middleware"
import { MenuCategory } from "../models/menu-category.model"
import { MenuItem } from "../models/menu-item.model"

export const menuRouter = Router()

menuRouter.use(authenticate, requireRestaurantContext)

const createCategorySchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional().default(""),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
})

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

const createItemSchema = z.object({
  category: z.string().refine(Types.ObjectId.isValid, {
    message: "Invalid category",
  }),
  name: z.string().trim().min(2),
  description: z.string().trim().optional().default(""),
  price: z.number().int().nonnegative(),
  available: z.boolean().optional().default(true),
  imageUrl: z.string().trim().optional().default(""),
  sortOrder: z.number().int().optional().default(0),
})

const updateItemSchema = z.object({
  category: z
    .string()
    .refine(Types.ObjectId.isValid, {
      message: "Invalid category",
    })
    .optional(),
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  price: z.number().int().nonnegative().optional(),
  available: z.boolean().optional(),
  imageUrl: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
})

menuRouter.get(
  "/",
  requireRole("owner", "waiter"),
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId

    const [categories, items] = await Promise.all([
      MenuCategory.find({
        restaurant: restaurantId,
        active: true,
      }).sort({
        sortOrder: 1,
        name: 1,
      }),
      MenuItem.find({
        restaurant: restaurantId,
        available: true,
      })
        .populate("category", "name")
        .sort({ sortOrder: 1, name: 1 }),
    ])

    response.json({ categories, items })
  })
)

menuRouter.get(
  "/manage",
  requireOwner,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId

    const [categories, items] = await Promise.all([
      MenuCategory.find({
        restaurant: restaurantId,
      }).sort({
        sortOrder: 1,
        name: 1,
      }),
      MenuItem.find({
        restaurant: restaurantId,
      })
        .populate("category", "name")
        .sort({ sortOrder: 1, name: 1 }),
    ])

    response.json({ categories, items })
  })
)

menuRouter.post(
  "/categories",
  requireOwner,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = createCategorySchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid category details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const category = await MenuCategory.create({
      ...result.data,
      restaurant: authenticatedRequest.user!.restaurantId,
    })

    response.status(201).json({ category })
  })
)

menuRouter.patch(
  "/categories/:id",
  requireOwner,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = updateCategorySchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid category details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid category ID",
      })
      return
    }

    const category = await MenuCategory.findOneAndUpdate(
      {
        _id: request.params.id,
        restaurant: authenticatedRequest.user!.restaurantId,
      },
      {
        $set: result.data,
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!category) {
      response.status(404).json({
        message: "Category not found",
      })
      return
    }

    response.json({ category })
  })
)

menuRouter.post(
  "/items",
  requireOwner,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId
    const result = createItemSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid menu item details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const categoryExists = await MenuCategory.exists({
      _id: result.data.category,
      restaurant: restaurantId,
    })

    if (!categoryExists) {
      response.status(404).json({
        message: "Category not found",
      })
      return
    }

    const item = await MenuItem.create({
      ...result.data,
      restaurant: restaurantId,
    })

    await item.populate("category", "name")

    response.status(201).json({ item })
  })
)

menuRouter.patch(
  "/items/:id",
  requireOwner,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const restaurantId = authenticatedRequest.user!.restaurantId
    const result = updateItemSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid menu item details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (!Types.ObjectId.isValid(request.params.id as string)) {
      response.status(400).json({
        message: "Invalid menu item ID",
      })
      return
    }

    if (result.data.category) {
      const categoryExists = await MenuCategory.exists({
        _id: result.data.category,
        restaurant: restaurantId,
      })

      if (!categoryExists) {
        response.status(404).json({
          message: "Category not found",
        })
        return
      }
    }

    const item = await MenuItem.findOneAndUpdate(
      {
        _id: request.params.id,
        restaurant: restaurantId,
      },
      {
        $set: result.data,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name")

    if (!item) {
      response.status(404).json({
        message: "Menu item not found",
      })
      return
    }

    response.json({ item })
  })
)
