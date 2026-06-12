import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
    }
  }

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <h1 className="text-xl font-semibold">Menu Items</h1>

          <Button variant="outline" onClick={() => navigate("/owner/menu")}>
            Manage categories
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit item" : "Add menu item"}</CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
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
                <Label htmlFor="item-name">Name</Label>
                <Input
                  id="item-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-description">Description</Label>
                <Textarea
                  id="item-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-price">Price (ZMW)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-image">Image URL (optional)</Label>
                <Input
                  id="item-image"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" disabled={submitting || !category}>
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update item"
                    : "Create item"}
              </Button>

              {editingId && (
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancel editing
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item._id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div className="flex items-center gap-4">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <Badge variant="outline">{item.category.name}</Badge>
                      <Badge variant={item.available ? "default" : "secondary"}>
                        {item.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>

                    <p className="mt-1 font-medium">
                      {formatPrice(item.price)}
                    </p>

                    {item.description && (
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(item)}
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant={item.available ? "outline" : "default"}
                    onClick={() => toggleAvailability(item)}
                  >
                    {item.available ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {items.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No menu items have been created.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
