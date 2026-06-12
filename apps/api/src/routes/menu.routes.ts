import { Router } from "express"
import { Types } from "mongoose"
import { z } from "zod"

import { asyncHandler } from "../middleware/async-handler"
import { authenticate } from "../middleware/auth.middleware"
import { requireOwner } from "../middleware/role.middleware"
import { MenuCategory } from "../models/menu-category.model"
import { MenuItem } from "../models/menu-item.model"

export const menuRouter = Router()

const categorySchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional().default(""),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
})

const itemSchema = z.object({
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

menuRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const [categories, items] = await Promise.all([
      MenuCategory.find({ active: true }).sort({
        sortOrder: 1,
        name: 1,
      }),
      MenuItem.find({ available: true })
        .populate("category", "name")
        .sort({ sortOrder: 1, name: 1 }),
    ])

    response.json({ categories, items })
  })
)

menuRouter.get(
  "/manage",
  authenticate,
  requireOwner,
  asyncHandler(async (_request, response) => {
    const [categories, items] = await Promise.all([
      MenuCategory.find().sort({ sortOrder: 1, name: 1 }),
      MenuItem.find()
        .populate("category", "name")
        .sort({ sortOrder: 1, name: 1 }),
    ])

    response.json({ categories, items })
  })
)

menuRouter.post(
  "/categories",
  authenticate,
  requireOwner,
  asyncHandler(async (request, response) => {
    const result = categorySchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid category details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const category = await MenuCategory.create(result.data)
    response.status(201).json({ category })
  })
)

menuRouter.patch(
  "/categories/:id",
  authenticate,
  requireOwner,
  asyncHandler(async (request, response) => {
    const result = categorySchema.partial().safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid category details",
      })
      return
    }

    const category = await MenuCategory.findByIdAndUpdate(
      request.params.id,
      result.data,
      {
        new: true,
        runValidators: true,
      }
    )

    if (!category) {
      response.status(404).json({ message: "Category not found" })
      return
    }

    response.json({ category })
  })
)

menuRouter.post(
  "/items",
  authenticate,
  requireOwner,
  asyncHandler(async (request, response) => {
    const result = itemSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid menu item details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    const categoryExists = await MenuCategory.exists({
      _id: result.data.category,
    })

    if (!categoryExists) {
      response.status(404).json({ message: "Category not found" })
      return
    }

    const item = await MenuItem.create(result.data)
    await item.populate("category", "name")

    response.status(201).json({ item })
  })
)

menuRouter.patch(
  "/items/:id",
  authenticate,
  requireOwner,
  asyncHandler(async (request, response) => {
    const result = itemSchema.partial().safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid menu item details",
      })
      return
    }

    if (result.data.category) {
      const categoryExists = await MenuCategory.exists({
        _id: result.data.category,
      })

      if (!categoryExists) {
        response.status(404).json({
          message: "Category not found",
        })
        return
      }
    }

    const item = await MenuItem.findByIdAndUpdate(
      request.params.id,
      result.data,
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name")

    if (!item) {
      response.status(404).json({ message: "Menu item not found" })
      return
    }

    response.json({ item })
  })
)
