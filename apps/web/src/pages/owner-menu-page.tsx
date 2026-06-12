import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  createMenuCategory,
  getManagedMenu,
  updateMenuCategory,
} from "../lib/api"
import type { MenuCategory } from "../lib/api"

export function OwnerMenuPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
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
        })

        setCategories((current) =>
          current.map((category) =>
            category._id === editingId ? updated : category
          )
        )
      } else {
        const created = await createMenuCategory({
          name,
          description,
        })

        setCategories((current) => [...current, created])
      }

      resetForm()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save category"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (category: MenuCategory) => {
    setEditingId(category._id)
    setName(category.name)
    setDescription(category.description)
  }

  const toggleCategory = async (category: MenuCategory) => {
    try {
      setError("")

      const updated = await updateMenuCategory(category._id, {
        active: !category.active,
      })

      setCategories((current) =>
        current.map((item) => (item._id === category._id ? updated : item))
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update category"
      )
    }
  }

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">Menu Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage categories and menu items.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => navigate("/owner/menu/items")}>
              Manage items
            </Button>

            <Button variant="outline" onClick={() => navigate("/owner")}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit category" : "Add category"}
            </CardTitle>
            <CardDescription>
              Group menu items into sections such as meals and drinks.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Textarea
                  id="category-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update category"
                    : "Create category"}
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

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Inactive categories are hidden from the public menu.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading categories...
              </p>
            )}

            {!loading && categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No categories have been created.
              </p>
            )}

            {categories.map((category) => (
              <div
                key={category._id}
                className="flex items-center justify-between gap-4 rounded-lg border p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{category.name}</p>
                    <Badge variant={category.active ? "default" : "secondary"}>
                      {category.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {category.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(category)}
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant={category.active ? "outline" : "default"}
                    onClick={() => toggleCategory(category)}
                  >
                    {category.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
