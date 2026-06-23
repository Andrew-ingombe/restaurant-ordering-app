import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  Check,
  CircleOff,
  ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  Upload,
  UtensilsCrossed,
  AlertTriangle,
} from "lucide-react"

import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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

import { OwnerShell } from "../components/owner-shell"
import {
  createMenuItem,
  getManagedMenu,
  updateMenuItem,
  uploadMenuItemImage,
} from "../lib/api"
import type { AuthUser, MenuCategory, MenuItem } from "../lib/api"

import { MenuItemsPageSkeleton } from "../components/page-skeletons"

type OwnerMenuItemsPageProps = {
  user: AuthUser
  onLogout: () => void
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function OwnerMenuItemsPage({
  user,
  onLogout,
}: OwnerMenuItemsPageProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [category, setCategory] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [disableTarget, setDisableTarget] = useState<MenuItem | null>(null)

  useEffect(() => {
    void getManagedMenu()
      .then((menu) => {
        setCategories(menu.categories)
        setItems(menu.items)
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load menu"
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setCategory("")
    setName("")
    setDescription("")
    setPrice("")
    setImageUrl("")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const numericPrice = Number(price)

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      const message = "Enter a valid price"
      setError(message)
      toast.error(message)
      return
    }

    setSubmitting(true)
    setError("")

    const details = {
      category,
      name,
      description,
      price: Math.round(numericPrice * 100),
      imageUrl,
    }

    try {
      if (editingId) {
        const updated = await updateMenuItem(editingId, details)

        setItems((current) =>
          current.map((item) => (item._id === editingId ? updated : item))
        )

        toast.success("Menu item updated")
      } else {
        const created = await createMenuItem(details)
        setItems((current) => [...current, created])
        toast.success("Menu item created")
      }

      resetForm()
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not save menu item"

      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (item: MenuItem) => {
    setEditingId(item._id)
    setCategory(item.category._id)
    setName(item.name)
    setDescription(item.description)
    setPrice((item.price / 100).toFixed(2))
    setImageUrl(item.imageUrl)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const toggleAvailability = async (item: MenuItem) => {
    if (updatingId) return

    setUpdatingId(item._id)
    setError("")

    try {
      const updated = await updateMenuItem(item._id, {
        available: !item.available,
      })

      setItems((current) =>
        current.map((currentItem) =>
          currentItem._id === item._id ? updated : currentItem
        )
      )

      toast.success(
        updated.available
          ? `${updated.name} is now available`
          : `${updated.name} has been hidden from menus`
      )

      setDisableTarget(null)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update item"

      setError(message)
      toast.error(message)
    } finally {
      setUpdatingId("")
    }
  }

  const requestAvailabilityChange = (item: MenuItem) => {
    if (item.available) {
      setDisableTarget(item)
      return
    }

    void toggleAvailability(item)
  }

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]

    if (!allowedTypes.includes(file.type)) {
      const message = "Please upload a JPG, PNG, or WebP image"
      setError(message)
      toast.error(message)
      event.target.value = ""
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      const message = "Image must be 5MB or smaller"
      setError(message)
      toast.error(message)
      event.target.value = ""
      return
    }

    setUploadingImage(true)
    setError("")

    try {
      const uploaded = await uploadMenuItemImage(file)
      setImageUrl(uploaded.secureUrl)
      toast.success("Dish image uploaded")
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not upload image"

      setError(message)
      toast.error(message)
    } finally {
      setUploadingImage(false)
    }
  }

  const availableItems = items.filter((item) => item.available).length

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="menu"
      contentClassName="space-y-5"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Menu setup
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Menu items
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Create dishes, set prices, and control availability.
          </p>
        </div>
      }
      headerActions={
        <Button
          className="h-11 rounded-xl"
          variant="outline"
          onClick={() => navigate("/owner/menu")}
        >
          <Tags className="size-4" />
          Manage categories
        </Button>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#fff0f1] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#ef1428] text-white">
            <Tags className="size-4" />
          </div>

          <p className="mt-3 font-bold">Menu categories</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Create and organize categories for your dishes.
          </p>

          <Button
            className="mt-4 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
            onClick={() => navigate("/owner/menu")}
          >
            Manage categories
          </Button>
        </div>
      }
    >
      <Dialog
        open={Boolean(disableTarget)}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setDisableTarget(null)
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
                Disable menu item?
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                <strong className="text-neutral-900">
                  {disableTarget?.name}
                </strong>{" "}
                will disappear from the waiter and customer menus. Existing
                orders and sales history will remain unchanged.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 rounded-xl"
                variant="outline"
                disabled={Boolean(updatingId)}
                onClick={() => setDisableTarget(null)}
              >
                Keep available
              </Button>

              <Button
                className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={Boolean(updatingId)}
                onClick={() => {
                  if (disableTarget) {
                    void toggleAvailability(disableTarget)
                  }
                }}
              >
                {updatingId === disableTarget?._id
                  ? "Disabling..."
                  : "Disable item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <MenuItemsPageSkeleton />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] bg-[#ef1428] p-5 text-white">
              <p className="text-sm text-white/75">Menu items</p>
              <p className="mt-5 text-3xl font-black">{items.length}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <p className="text-sm text-neutral-500">Available</p>
              <p className="mt-5 text-3xl font-black">{availableItems}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <p className="text-sm text-neutral-500">Categories</p>
              <p className="mt-5 text-3xl font-black">{categories.length}</p>
            </div>
          </section>

          {error && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
            <section className="self-start rounded-[24px] bg-white p-5 xl:sticky xl:top-7">
              <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                {editingId ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-5" />
                )}
              </div>

              <h2 className="mt-5 text-xl font-black">
                {editingId ? "Edit menu item" : "Add menu item"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                Add the dish information customers and staff will see.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>

                    <SelectContent>
                      {categories.map((item) => (
                        <SelectItem key={item._id} value={item._id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-name">Item name</Label>
                  <Input
                    id="item-name"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Grilled Chicken"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-description">Description</Label>
                  <Textarea
                    id="item-description"
                    className="min-h-24 resize-none rounded-xl border-0 bg-neutral-100 px-4 py-3 shadow-none"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the dish"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-price">Price (ZMW)</Label>
                  <Input
                    id="item-price"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dish image</Label>

                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => void handleImageSelected(event)}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="rounded-xl"
                        type="button"
                        variant="outline"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadingImage ? (
                          <>
                            <RefreshCw className="size-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="size-4" />
                            Upload image
                          </>
                        )}
                      </Button>

                      {imageUrl && (
                        <Button
                          className="rounded-xl"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setImageUrl("")
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          Remove image
                        </Button>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-neutral-500">
                      JPG, PNG, or WebP. Maximum size 5MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-image-url">Image URL</Label>
                  <Input
                    id="item-image-url"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    type="url"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="Cloudinary image URL"
                  />
                </div>

                {imageUrl && (
                  <div className="overflow-hidden rounded-2xl bg-neutral-100">
                    <img
                      src={imageUrl}
                      alt="Menu item preview"
                      className="h-40 w-full object-cover"
                    />
                  </div>
                )}

                <Button
                  className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  disabled={submitting || uploadingImage || !category}
                >
                  {submitting
                    ? "Saving..."
                    : editingId
                      ? "Update item"
                      : "Create item"}
                </Button>

                {editingId && (
                  <Button
                    className="h-12 w-full rounded-xl"
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancel editing
                  </Button>
                )}
              </form>
            </section>

            <section className="min-w-0 rounded-[24px] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Your dishes</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Manage pricing, descriptions, and availability.
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {items.length} items
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <article
                    key={item._id}
                    className={`overflow-hidden rounded-[20px] border transition ${
                      editingId === item._id
                        ? "border-[#ef1428] bg-[#fff8f8]"
                        : "border-neutral-100 hover:border-neutral-200"
                    }`}
                  >
                    <div className="relative h-44 bg-neutral-100">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="size-8 text-neutral-300" />
                        </div>
                      )}

                      <Badge
                        className={`absolute top-3 right-3 rounded-full border-0 ${
                          item.available
                            ? "bg-white text-emerald-700"
                            : "bg-neutral-950 text-white"
                        }`}
                      >
                        {item.available ? (
                          <Check className="size-3" />
                        ) : (
                          <CircleOff className="size-3" />
                        )}
                        {item.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="secondary" className="rounded-full">
                            {item.category.name}
                          </Badge>

                          <h3 className="mt-3 text-lg font-black">
                            {item.name}
                          </h3>
                        </div>

                        <p className="shrink-0 font-black text-[#ef1428]">
                          {formatPrice(item.price)}
                        </p>
                      </div>

                      <p className="mt-2 min-h-10 text-sm leading-5 text-neutral-400">
                        {item.description || "No description added."}
                      </p>

                      <div className="mt-5 flex gap-2 border-t border-neutral-100 pt-4">
                        <Button
                          className="flex-1 rounded-xl"
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(item)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>

                        <Button
                          className={`flex-1 rounded-xl ${
                            !item.available
                              ? "bg-neutral-950 text-white hover:bg-neutral-800"
                              : ""
                          }`}
                          size="sm"
                          variant={item.available ? "outline" : "default"}
                          disabled={updatingId === item._id}
                          onClick={() => requestAvailabilityChange(item)}
                        >
                          {updatingId === item._id
                            ? "Updating..."
                            : item.available
                              ? "Disable"
                              : "Enable"}
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}

                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center md:col-span-2">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                      <UtensilsCrossed className="size-5 text-neutral-500" />
                    </div>
                    <p className="mt-4 font-bold">No menu items yet</p>
                    <p className="mt-1 text-sm text-neutral-400">
                      Add your first dish using the form.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </OwnerShell>
  )
}
