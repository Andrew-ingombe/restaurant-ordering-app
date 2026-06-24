import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleOff,
  ListPlus,
  Pencil,
  Plus,
  Tags,
  UtensilsCrossed,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { MenuCategoriesSkeleton } from "../components/page-skeletons"

import { OwnerShell } from "../components/owner-shell"
import {
  createMenuCategory,
  getManagedMenu,
  updateMenuCategory,
} from "../lib/api"
import type { AuthUser, MenuCategory, MenuPreparationArea } from "../lib/api"

const CATEGORY_DESCRIPTION_MAX_LENGTH = 180

type OwnerMenuPageProps = {
  user: AuthUser
  onLogout: () => void
}

const preparationAreaLabels: Record<MenuPreparationArea, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  none: "No prep",
}

const preparationAreaDescriptions: Record<MenuPreparationArea, string> = {
  kitchen: "Items in this category appear on the kitchen screen.",
  bar: "Items in this category are hidden from the kitchen screen.",
  none: "Items in this category do not need preparation tracking.",
}

const preparationAreaStyles: Record<MenuPreparationArea, string> = {
  kitchen: "bg-emerald-50 text-emerald-700",
  bar: "bg-blue-50 text-blue-700",
  none: "bg-neutral-100 text-neutral-600",
}

export function OwnerMenuPage({ user, onLogout }: OwnerMenuPageProps) {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [preparationArea, setPreparationArea] =
    useState<MenuPreparationArea>("kitchen")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [deactivationTarget, setDeactivationTarget] =
    useState<MenuCategory | null>(null)
  const [error, setError] = useState("")

  const loadMenu = async () => {
    try {
      setError("")
      const menu = await getManagedMenu()
      setCategories(menu.categories)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load menu"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMenu()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setName("")
    setDescription("")
    setPreparationArea("kitchen")
  }

  const closeCategoryDialog = () => {
    if (submitting) return

    setCategoryDialogOpen(false)
    resetForm()
  }

  const openCreateDialog = () => {
    setError("")
    resetForm()
    setCategoryDialogOpen(true)
  }

  const startEditing = (category: MenuCategory) => {
    setError("")
    setEditingId(category._id)
    setName(category.name)
    setDescription(category.description)
    setPreparationArea(category.preparationArea || "kitchen")
    setCategoryDialogOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      if (editingId) {
        const updated = await updateMenuCategory(editingId, {
          name,
          description,
          preparationArea,
        })

        setCategories((current) =>
          current.map((category) =>
            category._id === editingId ? updated : category
          )
        )

        toast.success("Category updated")
      } else {
        const created = await createMenuCategory({
          name,
          description,
          preparationArea,
        })

        setCategories((current) => [...current, created])
        toast.success("Category created")
      }

      setCategoryDialogOpen(false)
      resetForm()
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not save category"

      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCategory = async (category: MenuCategory) => {
    if (updatingId) return

    setUpdatingId(category._id)
    setError("")

    try {
      const updated = await updateMenuCategory(category._id, {
        active: !category.active,
      })

      setCategories((current) =>
        current.map((item) => (item._id === category._id ? updated : item))
      )

      toast.success(
        updated.active
          ? `${updated.name} is now visible to customers`
          : `${updated.name} has been hidden from customers`
      )

      setDeactivationTarget(null)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update category"

      setError(message)
      toast.error(message)
    } finally {
      setUpdatingId("")
    }
  }

  const requestCategoryStatusChange = (category: MenuCategory) => {
    if (category.active) {
      setDeactivationTarget(category)
      return
    }

    void toggleCategory(category)
  }

  const activeCount = categories.filter((category) => category.active).length

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="menu"
      contentClassName="grid gap-5"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Menu setup
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Menu categories
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Organize your dishes and decide what appears in the kitchen.
          </p>
        </div>
      }
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-11 rounded-xl bg-[#ef1428] px-5 text-white hover:bg-[#d91023]"
            onClick={openCreateDialog}
          >
            <Plus className="size-4" />
            Add category
          </Button>

          <Button
            className="h-11 rounded-xl"
            variant="outline"
            onClick={() => navigate("/owner/menu/items")}
          >
            <UtensilsCrossed className="size-4" />
            Manage items
          </Button>
        </div>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#fff0f1] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#ef1428] text-white">
            <ListPlus className="size-4" />
          </div>

          <p className="mt-3 font-bold">Build your menu</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Use Kitchen for food categories. Use Bar or No prep for drinks and
            items that should stay off the kitchen board.
          </p>

          <Button
            className="mt-4 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
            onClick={openCreateDialog}
          >
            Add category
          </Button>
        </div>
      }
    >
      <Dialog open={categoryDialogOpen} onOpenChange={closeCategoryDialog}>
        <DialogContent className="max-h-[90svh] overflow-y-auto rounded-[28px] border-0 p-0 sm:max-w-xl">
          <div className="bg-white p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                {editingId ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-5" />
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                {editingId ? "Edit category" : "Add category"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-neutral-400">
                Group related menu items and choose whether they should be sent
                to the kitchen.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="category-name">Category name</Label>
                <Input
                  id="category-name"
                  className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Main Meals"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-preparation-area">
                  Preparation area
                </Label>
                <Select
                  value={preparationArea}
                  onValueChange={(value) =>
                    setPreparationArea(value as MenuPreparationArea)
                  }
                >
                  <SelectTrigger
                    id="category-preparation-area"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                  >
                    <SelectValue placeholder="Choose preparation area" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="none">No prep</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs leading-5 text-neutral-400">
                  {preparationAreaDescriptions[preparationArea]}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Textarea
                  id="category-description"
                  className="min-h-28 resize-none rounded-xl border-0 bg-neutral-100 px-4 py-3 shadow-none"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Briefly describe this category"
                  maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
                />

                <p className="text-right text-xs text-neutral-400">
                  {description.length}/{CATEGORY_DESCRIPTION_MAX_LENGTH}
                </p>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-xl"
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={closeCategoryDialog}
                >
                  Cancel
                </Button>

                <Button
                  className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : editingId
                      ? "Update category"
                      : "Create category"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deactivationTarget)}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setDeactivationTarget(null)
          }
        }}
      >
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-[#ef1428]">
                <AlertTriangle className="size-5" />
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                Deactivate category?
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                <strong className="text-neutral-900">
                  {deactivationTarget?.name}
                </strong>{" "}
                and its menu items will be hidden from the customer menu.
                Existing orders and sales history will remain unchanged.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 rounded-xl"
                variant="outline"
                disabled={Boolean(updatingId)}
                onClick={() => setDeactivationTarget(null)}
              >
                Keep active
              </Button>

              <Button
                className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={Boolean(updatingId)}
                onClick={() => {
                  if (deactivationTarget) {
                    void toggleCategory(deactivationTarget)
                  }
                }}
              >
                {updatingId === deactivationTarget?._id
                  ? "Deactivating..."
                  : "Deactivate category"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="min-w-0 rounded-[24px] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Categories</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Inactive categories are hidden from customers.
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="secondary" className="h-8 rounded-full px-3 py-1">
              {categories.length} total
            </Badge>
            <Badge className="h-8 rounded-full bg-[#ef1428] px-3 py-1 text-white">
              {activeCount} active
            </Badge>
          </div>
        </div>

        {error && !categoryDialogOpen && (
          <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && <MenuCategoriesSkeleton />}

        {!loading && categories.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
              <Tags className="size-5 text-neutral-500" />
            </div>
            <p className="mt-4 font-bold">No categories yet</p>
            <p className="mt-1 text-sm text-neutral-400">
              Create your first category using the button above.
            </p>
            <Button
              className="mt-5 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              onClick={openCreateDialog}
            >
              <Plus className="size-4" />
              Add category
            </Button>
          </div>
        )}

        {!loading && (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category, index) => {
              const categoryPreparationArea =
                category.preparationArea || "kitchen"

              return (
                <article
                  key={category._id}
                  className={`group flex h-full flex-col rounded-[20px] border p-4 transition ${
                    editingId === category._id
                      ? "border-[#ef1428] bg-[#fff8f8]"
                      : "border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full font-black ${
                        category.active
                          ? "bg-neutral-950 text-white"
                          : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge
                        className={`rounded-full border-0 ${
                          preparationAreaStyles[categoryPreparationArea]
                        }`}
                      >
                        {preparationAreaLabels[categoryPreparationArea]}
                      </Badge>

                      <Badge
                        className={`rounded-full border-0 ${
                          category.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {category.active ? (
                          <Check className="size-3" />
                        ) : (
                          <CircleOff className="size-3" />
                        )}
                        {category.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-5 flex-1">
                    <h3 className="text-lg font-black">{category.name}</h3>
                    <p className="mt-2 min-h-10 text-sm leading-6 text-neutral-400">
                      {category.description || "No category description added."}
                    </p>
                  </div>

                  <div className="mt-auto space-y-3 border-t border-neutral-100 pt-4">
                    <div className="flex gap-2">
                      <Button
                        className="h-10 flex-1 rounded-xl"
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(category)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>

                      <Button
                        className={`h-10 flex-1 rounded-xl ${
                          category.active
                            ? ""
                            : "bg-neutral-950 text-white hover:bg-neutral-800"
                        }`}
                        size="sm"
                        variant={category.active ? "outline" : "default"}
                        disabled={updatingId === category._id}
                        onClick={() => requestCategoryStatusChange(category)}
                      >
                        {updatingId === category._id
                          ? "Updating..."
                          : category.active
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                    </div>

                    <button
                      type="button"
                      className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100"
                      onClick={() => navigate("/owner/menu/items")}
                    >
                      View menu items
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </OwnerShell>
  )
}
