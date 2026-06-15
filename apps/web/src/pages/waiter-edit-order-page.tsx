import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  UserRound,
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

import { getMyOrder, getPublicMenu, updateDraftOrder } from "../lib/api"
import type { MenuCategory, PublicMenuItem } from "../lib/api"

type CartItem = {
  item: PublicMenuItem
  quantity: number
  notes: string
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function WaiterEditOrderPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<PublicMenuItem[]>([])
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in")
  const [tableName, setTableName] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [orderNumber, setOrderNumber] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) {
      setError("Invalid order")
      setLoading(false)
      return
    }

    void Promise.all([getMyOrder(id), getPublicMenu()])
      .then(([order, menu]) => {
        if (order.status !== "draft") {
          throw new Error("Only unpaid draft orders can be edited")
        }

        setCategories(menu.categories)
        setItems(menu.items)
        setOrderNumber(order.orderNumber)
        setOrderType(order.orderType)
        setTableName(order.tableName || "")
        setCustomerName(order.customer.name || "")
        setCustomerPhone(order.customer.phone || "")
        setCustomerEmail(order.customer.email || "")

        const menuMap = new Map(menu.items.map((item) => [item._id, item]))

        const initialCart: Record<string, CartItem> = {}

        for (const orderItem of order.items) {
          const menuItem = menuMap.get(orderItem.menuItem)

          if (menuItem) {
            initialCart[menuItem._id] = {
              item: menuItem,
              quantity: orderItem.quantity,
              notes: orderItem.notes,
            }
          }
        }

        setCart(initialCart)
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load draft order"
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  const visibleItems = useMemo(() => {
    if (selectedCategory === "all") return items

    return items.filter((item) => item.category._id === selectedCategory)
  }, [items, selectedCategory])

  const cartItems = Object.values(cart)

  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0)

  const total = cartItems.reduce(
    (sum, item) => sum + item.item.price * item.quantity,
    0
  )

  const changeQuantity = (item: PublicMenuItem, amount: number) => {
    setCart((current) => {
      const existing = current[item._id]
      const quantity = (existing?.quantity || 0) + amount

      if (quantity <= 0) {
        const updated = { ...current }
        delete updated[item._id]
        return updated
      }

      return {
        ...current,
        [item._id]: {
          item,
          quantity,
          notes: existing?.notes || "",
        },
      }
    })
  }

  const updateNotes = (itemId: string, notes: string) => {
    setCart((current) => {
      const existing = current[itemId]

      if (!existing) return current

      return {
        ...current,
        [itemId]: {
          ...existing,
          notes,
        },
      }
    })
  }

  const saveChanges = async () => {
    if (!id) return

    if (cartItems.length === 0) {
      setError("The order must contain at least one item")
      return
    }

    if (orderType === "dine_in" && !tableName.trim()) {
      setError("Enter the table name or number")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      await updateDraftOrder(id, {
        orderType,
        tableName: orderType === "dine_in" ? tableName.trim() : "",
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
        },
        items: cartItems.map((cartItem) => ({
          menuItem: cartItem.item._id,
          quantity: cartItem.quantity,
          notes: cartItem.notes,
        })),
      })

      navigate(`/waiter/orders/${id}`, { replace: true })
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update draft order"
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#252323] text-white">
        <div className="text-center">
          <RefreshCw className="mx-auto size-6 animate-spin text-[#ef1428]" />
          <p className="mt-3 text-sm text-white/60">Loading draft order...</p>
        </div>
      </main>
    )
  }

  if (error && !orderNumber) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#252323] p-4">
        <div className="w-full max-w-md rounded-[24px] bg-white p-8 text-center">
          <p className="text-red-700">{error}</p>

          <Button
            className="mt-5 rounded-xl"
            variant="outline"
            onClick={() => navigate("/waiter/orders")}
          >
            <ArrowLeft className="size-4" />
            Back to orders
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh">
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-[1800px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 md:px-7">
          <div className="flex items-center gap-4">
            <Button
              className="size-11 rounded-xl"
              size="icon"
              variant="outline"
              onClick={() => navigate(`/waiter/orders/${id}`)}
            >
              <ArrowLeft className="size-4" />
            </Button>

            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                Edit unpaid draft
              </p>
              <h1 className="text-2xl font-black">{orderNumber}</h1>
            </div>
          </div>
        </header>

        <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="min-w-0 space-y-5">
            <div className="rounded-[24px] bg-white p-5">
              <h2 className="text-xl font-black">Menu items</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Adjust quantities or add more items.
              </p>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                <Button
                  className="shrink-0 rounded-full"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  onClick={() => setSelectedCategory("all")}
                >
                  All items
                </Button>

                {categories.map((category) => (
                  <Button
                    key={category._id}
                    className="shrink-0 rounded-full"
                    variant={
                      selectedCategory === category._id ? "default" : "outline"
                    }
                    onClick={() => setSelectedCategory(category._id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {visibleItems.map((item) => {
                const quantity = cart[item._id]?.quantity || 0

                return (
                  <article
                    key={item._id}
                    className={`overflow-hidden rounded-[24px] bg-white ${
                      quantity > 0 ? "ring-2 ring-[#ef1428]" : ""
                    }`}
                  >
                    <div className="relative h-40 bg-neutral-100">
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

                      <Badge className="absolute top-3 right-3 rounded-full border-0 bg-white font-bold text-[#ef1428]">
                        {formatPrice(item.price)}
                      </Badge>
                    </div>

                    <div className="p-4">
                      <h3 className="font-black">{item.name}</h3>
                      <p className="mt-2 min-h-10 text-sm text-neutral-400">
                        {item.description}
                      </p>

                      <div className="mt-4 flex items-center justify-between rounded-2xl bg-neutral-100 p-2">
                        <Button
                          className="size-10 rounded-full"
                          size="icon"
                          variant="outline"
                          disabled={quantity === 0}
                          onClick={() => changeQuantity(item, -1)}
                        >
                          <Minus className="size-4" />
                        </Button>

                        <span className="text-lg font-black">{quantity}</span>

                        <Button
                          className="size-10 rounded-full bg-neutral-950 text-white"
                          size="icon"
                          onClick={() => changeQuantity(item, 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <aside>
            <div className="space-y-5 rounded-[24px] bg-white p-5 xl:sticky xl:top-6 xl:max-h-[calc(100svh-88px)] xl:overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#ef1428] uppercase">
                    Draft summary
                  </p>
                  <h2 className="text-xl font-black">Edit order</h2>
                </div>

                <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                  <ShoppingBag className="size-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-neutral-100 p-4">
                  <p className="text-xs text-neutral-400">Items</p>
                  <p className="mt-1 text-2xl font-black">{totalItems}</p>
                </div>

                <div className="rounded-2xl bg-[#fff0f1] p-4">
                  <p className="text-xs text-[#ef1428]/70">Total</p>
                  <p className="mt-1 text-xl font-black text-[#ef1428]">
                    {formatPrice(total)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Order type</Label>
                <Select
                  value={orderType}
                  onValueChange={(value) =>
                    setOrderType(value as "dine_in" | "takeaway")
                  }
                >
                  <SelectTrigger className="h-12 w-full rounded-xl border-0 bg-neutral-100">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="dine_in">Dine in</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {orderType === "dine_in" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-table">Table</Label>
                  <Input
                    id="edit-table"
                    className="h-12 rounded-xl border-0 bg-neutral-100"
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                  />
                </div>
              )}

              <div className="space-y-3">
                {cartItems.map((cartItem) => (
                  <div
                    key={cartItem.item._id}
                    className="rounded-2xl border border-neutral-100 p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-bold">
                        {cartItem.quantity} × {cartItem.item.name}
                      </span>
                      <span className="font-bold text-[#ef1428]">
                        {formatPrice(cartItem.item.price * cartItem.quantity)}
                      </span>
                    </div>

                    <Textarea
                      className="mt-3 min-h-16 resize-none rounded-xl border-0 bg-neutral-100"
                      value={cartItem.notes}
                      placeholder="Kitchen notes"
                      onChange={(event) =>
                        updateNotes(cartItem.item._id, event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-100 pt-5">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-neutral-400" />
                  <h3 className="font-bold">Customer details</h3>
                </div>

                <div className="mt-4 space-y-4">
                  <Input
                    className="h-12 rounded-xl border-0 bg-neutral-100"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Customer name"
                  />

                  <Input
                    className="h-12 rounded-xl border-0 bg-neutral-100"
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Customer phone"
                  />

                  <Input
                    className="h-12 rounded-xl border-0 bg-neutral-100"
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="Customer email"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <Button
                className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={submitting || cartItems.length === 0}
                onClick={saveChanges}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Save draft changes
                  </>
                )}
              </Button>

              <Button
                className="h-12 w-full rounded-xl"
                variant="outline"
                onClick={() => navigate(`/waiter/orders/${id}`)}
              >
                Cancel editing
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
