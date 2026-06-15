import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  Check,
  CircleOff,
  ImageIcon,
  LayoutDashboard,
  Pencil,
  Plus,
  QrCode,
  Tags,
  Users,
  UtensilsCrossed,
} from "lucide-react"

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

import { createMenuItem, getManagedMenu, updateMenuItem } from "../lib/api"
import type { MenuCategory, MenuItem } from "../lib/api"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function OwnerMenuItemsPage() {
  const navigate = useNavigate()

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [category, setCategory] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")

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
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setCategory("")
    setName("")
    setDescription("")
    setPrice("")
    setImageUrl("")
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const numericPrice = Number(price)

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError("Enter a valid price")
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
      } else {
        const created = await createMenuItem(details)
        setItems((current) => [...current, created])
      }

      resetForm()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save menu item"
      )
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
    setUpdatingId(item._id)

    try {
      setError("")

      const updated = await updateMenuItem(item._id, {
        available: !item.available,
      })

      setItems((current) =>
        current.map((currentItem) =>
          currentItem._id === item._id ? updated : currentItem
        )
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update item"
      )
    } finally {
      setUpdatingId("")
    }
  }

  const navigation = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      action: () => navigate("/owner"),
    },
    {
      label: "Menu",
      icon: UtensilsCrossed,
      active: true,
      action: () => navigate("/owner/menu"),
    },
    {
      label: "Staff",
      icon: Users,
      action: () => navigate("/owner/staff"),
    },
    {
      label: "Tables & QR",
      icon: QrCode,
      action: () => navigate("/owner/tables"),
    },
  ]

  const availableItems = items.filter((item) => item.available).length

  return (
    <main className="min-h-svh">
      <div className="mx-auto flex min-h-[calc(100svh-24px)] max-w-[1600px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-black/5 bg-white p-5 lg:flex">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#ef1428] text-white">
              <UtensilsCrossed className="size-5" />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight">FOODLY</p>
              <p className="text-xs text-neutral-400">Restaurant admin</p>
            </div>
          </div>

          <nav className="mt-10 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    item.active
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto rounded-2xl bg-[#fff0f1] p-4">
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
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
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

              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => navigate("/owner/menu")}
              >
                <Tags className="size-4" />
                Manage categories
              </Button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigation.map((item) => {
                const Icon = item.icon

                return (
                  <Button
                    key={item.label}
                    className="shrink-0 rounded-xl"
                    variant={item.active ? "default" : "outline"}
                    onClick={item.action}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </header>

          <div className="space-y-5 p-4 md:p-7">
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
                    <Label htmlFor="item-image">Image URL (optional)</Label>
                    <Input
                      id="item-image"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                      type="url"
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                      placeholder="https://..."
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
                    disabled={submitting || !category}
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
                            onClick={() => void toggleAvailability(item)}
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
          </div>
        </div>
      </div>
    </main>
  )
}
