import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
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
import { MenuItemsPageSkeleton } from "../components/page-skeletons"
import {
  createMenuItem,
  getManagedMenu,
  updateMenuItem,
  uploadMenuItemImage,
} from "../lib/api"
import type { AuthUser, MenuCategory, MenuItem } from "../lib/api"

type OwnerMenuItemsPageProps = {
  user: AuthUser
  onLogout: () => void
}

const formatPrice = (price: number, currency = "ZMW") =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency,
  }).format(price / 100)

const MENU_ITEM_DESCRIPTION_MAX_LENGTH = 240

export function OwnerMenuItemsPage({
  user,
  onLogout,
}: OwnerMenuItemsPageProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
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
  const [currency, setCurrency] = useState("ZMW")

  useEffect(() => {
    void getManagedMenu()
      .then((menu) => {
        setCategories(menu.categories)
        setItems(menu.items)
        setCurrency(menu.currency || "ZMW")
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

  const openCreateDialog = () => {
    setError("")
    resetForm()
    setItemDialogOpen(true)
  }

  const closeItemDialog = () => {
    if (submitting || uploadingImage) return

    setItemDialogOpen(false)
    resetForm()
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

      setItemDialogOpen(false)
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
    setError("")
    setEditingId(item._id)
    setCategory(item.category._id)
    setName(item.name)
    setDescription(item.description)
    setPrice((item.price / 100).toFixed(2))
    setImageUrl(item.imageUrl)
    setItemDialogOpen(true)
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
      toast.success("Menu item image uploaded")
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
  const unavailableItems = items.length - availableItems
  const canUploadImage = Boolean(category && name.trim()) && !uploadingImage

  const editingItem = editingId
    ? items.find((item) => item._id === editingId)
    : null

  const normalizedPrice = Number(price)
  const normalizedPriceInMinorUnits = Number.isFinite(normalizedPrice)
    ? Math.round(normalizedPrice * 100)
    : -1

  const itemFormChanged = editingItem
    ? category !== editingItem.category._id ||
      name.trim() !== editingItem.name ||
      description.trim() !== (editingItem.description || "") ||
      normalizedPriceInMinorUnits !== editingItem.price ||
      imageUrl !== (editingItem.imageUrl || "")
    : Boolean(category) ||
      Boolean(name.trim()) ||
      Boolean(description.trim()) ||
      Boolean(price) ||
      Boolean(imageUrl)

  const canSubmitItem =
    Boolean(category) &&
    Boolean(name.trim()) &&
    Number.isFinite(normalizedPrice) &&
    normalizedPrice >= 0 &&
    !submitting &&
    !uploadingImage &&
    (!editingId || itemFormChanged)

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="menu"
      contentClassName="space-y-5"
      headerContent={
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              className="size-12 shrink-0 cursor-pointer rounded-2xl"
              variant="outline"
              onClick={() => navigate("/owner/menu")}
            >
              <ArrowLeft className="size-5" />
            </Button>

            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#047857] uppercase">
                Menu setup
              </p>

              <h1 className="truncate text-3xl font-black tracking-tight md:text-4xl">
                Menu items
              </h1>

              <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-400 md:text-base">
                Manage dishes, pricing, images, and availability.
              </p>
            </div>
          </div>

          <Button
            className="hidden h-11 cursor-pointer rounded-xl bg-[#047857] px-5 text-white hover:bg-[#065F46] lg:inline-flex"
            onClick={openCreateDialog}
          >
            <Plus className="size-4" />
            Add menu item
          </Button>
        </div>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#ECFDF5] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#047857] text-white">
            <Tags className="size-4" />
          </div>

          <p className="mt-3 font-bold">Menu categories</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Create and organize categories for your dishes.
          </p>

          <Button
            className="mt-4 w-full cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
            onClick={() => navigate("/owner/menu")}
          >
            Manage categories
          </Button>
        </div>
      }
    >
      <Dialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeItemDialog()
          }
        }}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto rounded-[28px] border-0 p-0 sm:max-w-2xl">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-950 text-white">
                {editingId ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-5" />
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                {editingId ? "Edit menu item" : "Add menu item"}
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                Add the dish information customers and staff will see.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={category}
                    disabled={submitting}
                    onValueChange={setCategory}
                  >
                    <SelectTrigger className="min-h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none">
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
                  <Label htmlFor="item-price">Price ({currency})</Label>
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
                    disabled={submitting}
                  />
                </div>
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
                  disabled={submitting}
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
                  maxLength={MENU_ITEM_DESCRIPTION_MAX_LENGTH}
                  disabled={submitting}
                />
                <p className="text-right text-xs text-neutral-400">
                  {description.length}/{MENU_ITEM_DESCRIPTION_MAX_LENGTH}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Menu item image</Label>

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
                      className="cursor-pointer rounded-xl"
                      type="button"
                      variant="outline"
                      disabled={!canUploadImage || submitting}
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
                        className="cursor-pointer rounded-xl"
                        type="button"
                        variant="outline"
                        disabled={submitting || uploadingImage}
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
                  {!category || !name.trim() ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Choose a category and enter the item name before uploading
                      an image.
                    </p>
                  ) : null}
                </div>
              </div>

              {imageUrl && (
                <div className="overflow-hidden rounded-2xl bg-neutral-100">
                  <img
                    src={imageUrl}
                    alt="Menu item preview"
                    className="h-44 w-full object-cover"
                  />
                </div>
              )}

              {error && itemDialogOpen && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button
                  className="h-12 cursor-pointer rounded-xl"
                  type="button"
                  variant="outline"
                  disabled={submitting || uploadingImage}
                  onClick={closeItemDialog}
                >
                  Cancel
                </Button>

                <Button
                  className="h-12 cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                  disabled={!canSubmitItem}
                >
                  {submitting
                    ? "Saving..."
                    : editingId
                      ? "Update item"
                      : "Create item"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

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
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-[#047857]">
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
                className="h-12 cursor-pointer rounded-xl"
                variant="outline"
                disabled={Boolean(updatingId)}
                onClick={() => setDisableTarget(null)}
              >
                Keep available
              </Button>

              <Button
                className="h-12 cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
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
          <section className="rounded-[24px] bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black">Menu item management</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Review dishes, update prices, and control what appears on
                  menus.
                </p>
              </div>

              <Badge
                variant="secondary"
                className="w-fit rounded-full px-3 py-1"
              >
                {items.length} items
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#ECFDF5] p-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-[#047857] uppercase">
                  Items
                </p>
                <p className="mt-2 text-2xl font-black">{items.length}</p>
              </div>

              <div className="rounded-2xl bg-neutral-100 p-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                  Available
                </p>
                <p className="mt-2 text-2xl font-black">{availableItems}</p>
              </div>

              <div className="rounded-2xl bg-neutral-100 p-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                  Hidden
                </p>
                <p className="mt-2 text-2xl font-black">{unavailableItems}</p>
              </div>
            </div>
          </section>

          {error && !itemDialogOpen && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          <section className="min-w-0 rounded-[24px] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Your dishes</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Manage pricing, descriptions, images, and availability.
                </p>
              </div>

              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {items.length} items
              </Badge>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item._id}
                  className="flex h-full flex-col overflow-hidden rounded-[20px] border border-neutral-100 bg-white transition hover:border-neutral-200"
                >
                  <div className="relative h-36 bg-neutral-100">
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

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge variant="secondary" className="rounded-full">
                          {item.category.name}
                        </Badge>

                        <h3 className="mt-3 truncate text-lg font-black">
                          {item.name}
                        </h3>
                      </div>

                      <p className="shrink-0 font-black text-[#047857]">
                        {formatPrice(item.price, currency)}
                      </p>
                    </div>

                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-neutral-400">
                      {item.description || "No description added."}
                    </p>

                    <div className="mt-auto flex gap-2 border-t border-neutral-100 pt-4">
                      <Button
                        className="h-10 flex-1 cursor-pointer rounded-xl"
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(item)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>

                      <Button
                        className={`h-10 flex-1 cursor-pointer rounded-xl ${
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
                <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center md:col-span-2 xl:col-span-3">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                    <UtensilsCrossed className="size-5 text-neutral-500" />
                  </div>
                  <p className="mt-4 font-bold">No menu items yet</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Add your first dish to start building the menu.
                  </p>

                  <Button
                    className="mt-5 cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                    onClick={openCreateDialog}
                  >
                    <Plus className="size-4" />
                    Add menu item
                  </Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      <Button
        className="fixed right-5 bottom-5 z-40 h-14 cursor-pointer rounded-full bg-[#047857] px-5 text-white ring-1 ring-emerald-700/10 hover:bg-[#065F46] lg:hidden"
        onClick={openCreateDialog}
      >
        <Plus className="size-5" />
        Add item
      </Button>
    </OwnerShell>
  )
}
