import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  Check,
  ChevronRight,
  CircleOff,
  ListPlus,
  Pencil,
  Plus,
  Tags,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { OwnerShell } from "../components/owner-shell"
import {
  createMenuCategory,
  getManagedMenu,
  updateMenuCategory,
} from "../lib/api"
import type { AuthUser, MenuCategory } from "../lib/api"

type OwnerMenuPageProps = {
  user: AuthUser
  onLogout: () => void
}

export function OwnerMenuPage({ user, onLogout }: OwnerMenuPageProps) {
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
    window.scrollTo({ top: 0, behavior: "smooth" })
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

  const activeCount = categories.filter((category) => category.active).length

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="menu"
      contentClassName="grid gap-5 xl:grid-cols-[380px_1fr]"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Menu setup
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Menu categories
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Organize your dishes into clear sections.
          </p>
        </div>
      }
      headerActions={
        <Button
          className="h-11 rounded-xl bg-[#ef1428] px-5 text-white hover:bg-[#d91023]"
          onClick={() => navigate("/owner/menu/items")}
        >
          <UtensilsCrossed className="size-4" />
          Manage items
        </Button>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#fff0f1] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#ef1428] text-white">
            <ListPlus className="size-4" />
          </div>

          <p className="mt-3 font-bold">Build your menu</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Organize dishes into categories before adding menu items.
          </p>

          <Button
            className="mt-4 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
            onClick={() => navigate("/owner/menu/items")}
          >
            Manage items
          </Button>
        </div>
      }
    >
      <section className="self-start rounded-[24px] bg-white p-5 xl:sticky xl:top-7">
        <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
          {editingId ? (
            <Pencil className="size-4" />
          ) : (
            <Plus className="size-5" />
          )}
        </div>

        <h2 className="mt-5 text-xl font-black">
          {editingId ? "Edit category" : "Add category"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-neutral-400">
          Group related menu items into sections such as main meals, drinks, and
          desserts.
        </p>

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
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              className="min-h-28 resize-none rounded-xl border-0 bg-neutral-100 px-4 py-3 shadow-none"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Briefly describe this category"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
            disabled={submitting}
          >
            {submitting
              ? "Saving..."
              : editingId
                ? "Update category"
                : "Create category"}
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
            <h2 className="text-xl font-black">Categories</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Inactive categories are hidden from customers.
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {categories.length} total
            </Badge>
            <Badge className="rounded-full bg-[#ef1428] px-3 py-1 text-white">
              {activeCount} active
            </Badge>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl bg-neutral-50 p-10 text-center text-sm text-neutral-400">
            Loading categories...
          </div>
        )}

        {!loading && categories.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
              <Tags className="size-5 text-neutral-500" />
            </div>
            <p className="mt-4 font-bold">No categories yet</p>
            <p className="mt-1 text-sm text-neutral-400">
              Create your first category using the form.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {categories.map((category, index) => (
            <article
              key={category._id}
              className={`group rounded-[20px] border p-4 transition ${
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

              <div className="mt-5">
                <h3 className="text-lg font-black">{category.name}</h3>
                <p className="mt-2 min-h-10 text-sm leading-5 text-neutral-400">
                  {category.description || "No category description added."}
                </p>
              </div>

              <div className="mt-5 flex gap-2 border-t border-neutral-100 pt-4">
                <Button
                  className="flex-1 rounded-xl"
                  size="sm"
                  variant="outline"
                  onClick={() => startEditing(category)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>

                <Button
                  className={`flex-1 rounded-xl ${
                    category.active
                      ? ""
                      : "bg-neutral-950 text-white hover:bg-neutral-800"
                  }`}
                  size="sm"
                  variant={category.active ? "outline" : "default"}
                  onClick={() => void toggleCategory(category)}
                >
                  {category.active ? "Deactivate" : "Activate"}
                </Button>
              </div>

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100"
                onClick={() => navigate("/owner/menu/items")}
              >
                View menu items
                <ChevronRight className="size-3.5" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </OwnerShell>
  )
}
