import { useEffect, useMemo, useState } from "react"
import {
  BellRing,
  CheckCircle2,
  ClipboardList,
  ImageIcon,
  LogOut,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Store,
  UserRound,
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

import { createDraftOrder, getPublicMenu } from "../lib/api"
import type { AuthUser, MenuCategory, PublicMenuItem } from "../lib/api"
import { useNavigate } from "react-router-dom"

type CartItem = {
  item: PublicMenuItem
  quantity: number
  notes: string
}

type WaiterPageProps = {
  user: AuthUser
  onLogout: () => void
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function WaiterPage({ user, onLogout }: WaiterPageProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<PublicMenuItem[]>([])
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in")
  const [tableName, setTableName] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const navigate = useNavigate()

  useEffect(() => {
    void getPublicMenu()
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

  const visibleItems = useMemo(() => {
    if (selectedCategory === "all") return items

    return items.filter((item) => item.category._id === selectedCategory)
  }, [items, selectedCategory])

  const cartItems = Object.values(cart)

  const totalItems = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.quantity,
    0
  )

  const total = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.item.price * cartItem.quantity,
    0
  )

  const changeQuantity = (item: PublicMenuItem, amount: number) => {
    setSuccess("")

    setCart((current) => {
      const currentItem = current[item._id]
      const quantity = (currentItem?.quantity || 0) + amount

      if (quantity <= 0) {
        const next = { ...current }
        delete next[item._id]
        return next
      }

      return {
        ...current,
        [item._id]: {
          item,
          quantity,
          notes: currentItem?.notes || "",
        },
      }
    })
  }

  const updateNotes = (id: string, notes: string) => {
    setCart((current) => {
      const currentItem = current[id]

      if (!currentItem) return current

      return {
        ...current,
        [id]: {
          ...currentItem,
          notes,
        },
      }
    })
  }

  const submitOrder = async () => {
    setError("")
    setSuccess("")

    if (cartItems.length === 0) {
      setError("Add at least one menu item")
      return
    }

    if (orderType === "dine_in" && !tableName.trim()) {
      setError("Enter the table name or number")
      return
    }

    setSubmitting(true)

    try {
      const order = await createDraftOrder({
        orderType,
        tableName: orderType === "dine_in" ? tableName : "",
        customer: {
          name: customerName,
          phone: customerPhone,
        },
        items: cartItems.map((cartItem) => ({
          menuItem: cartItem.item._id,
          quantity: cartItem.quantity,
          notes: cartItem.notes,
        })),
      })

      setSuccess(`Draft ${order.orderNumber} created`)
      setCart({})
      setTableName("")
      setCustomerName("")
      setCustomerPhone("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create order"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh">
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-[1800px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#ef1428] text-white">
                <UtensilsCrossed className="size-6" />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  Waiter workspace
                </p>
                <h1 className="text-2xl font-black tracking-tight">
                  Create new order
                </h1>
                <p className="text-sm text-neutral-400">
                  Signed in as {user.name}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => {
                  window.location.href = "/waiter/requests"
                }}
              >
                <BellRing className="size-4" />
                Customer requests
              </Button>

              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => {
                  window.location.href = "/waiter/orders"
                }}
              >
                <ClipboardList className="size-4" />
                My orders
              </Button>

              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                Change password
              </Button>

              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="min-w-0 space-y-5">
            <div className="rounded-[24px] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#ef1428] uppercase">
                    Restaurant menu
                  </p>
                  <h2 className="mt-1 text-xl font-black">Select menu items</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Browse available items by category.
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {items.length} items available
                </Badge>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                <Button
                  className={`shrink-0 rounded-full px-5 ${
                    selectedCategory === "all"
                      ? "bg-neutral-950 text-white hover:bg-neutral-800"
                      : ""
                  }`}
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  onClick={() => setSelectedCategory("all")}
                >
                  All items
                </Button>

                {categories.map((category) => (
                  <Button
                    key={category._id}
                    className={`shrink-0 rounded-full px-5 ${
                      selectedCategory === category._id
                        ? "bg-[#ef1428] text-white hover:bg-[#d91023]"
                        : ""
                    }`}
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
                    className={`overflow-hidden rounded-[24px] bg-white transition ${
                      quantity > 0
                        ? "ring-2 ring-[#ef1428]"
                        : "hover:-translate-y-0.5 hover:shadow-lg"
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
                          <ImageIcon className="size-9 text-neutral-300" />
                        </div>
                      )}

                      <Badge className="absolute top-3 right-3 rounded-full border-0 bg-white font-bold text-[#ef1428] shadow-sm">
                        {formatPrice(item.price)}
                      </Badge>

                      {quantity > 0 && (
                        <div className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-[#ef1428] font-black text-white shadow-sm">
                          {quantity}
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <Badge variant="secondary" className="rounded-full">
                        {item.category.name}
                      </Badge>

                      <h3 className="mt-3 text-lg font-black">{item.name}</h3>

                      <p className="mt-2 min-h-10 text-sm leading-5 text-neutral-400">
                        {item.description || "No description available."}
                      </p>

                      <div className="mt-5 flex items-center justify-between rounded-2xl bg-neutral-100 p-2">
                        <Button
                          className="size-10 rounded-full"
                          size="icon"
                          variant="outline"
                          disabled={quantity === 0}
                          onClick={() => changeQuantity(item, -1)}
                        >
                          <Minus className="size-4" />
                        </Button>

                        <div className="text-center">
                          <p className="text-lg font-black">{quantity}</p>
                          <p className="text-[10px] tracking-wide text-neutral-400 uppercase">
                            Selected
                          </p>
                        </div>

                        <Button
                          className="size-10 rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
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

              {visibleItems.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-12 text-center sm:col-span-2 2xl:col-span-3">
                  <Store className="mx-auto size-8 text-neutral-300" />
                  <p className="mt-4 font-bold">No menu items available</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    This category currently has no available items.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-5 rounded-[24px] bg-white p-5 xl:sticky xl:top-6 xl:max-h-[calc(100svh-88px)] xl:overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#ef1428] uppercase">
                    Current order
                  </p>
                  <h2 className="mt-1 text-xl font-black">Order summary</h2>
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
                  <SelectTrigger className="h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none">
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
                  <Label htmlFor="table">Table name or number</Label>
                  <Input
                    id="table"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                    placeholder="e.g. Table 4"
                  />
                </div>
              )}

              <div className="space-y-3">
                {cartItems.map((cartItem) => (
                  <div
                    key={cartItem.item._id}
                    className="rounded-2xl border border-neutral-100 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-black text-white">
                        {cartItem.quantity}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-3">
                          <p className="font-bold">{cartItem.item.name}</p>
                          <p className="shrink-0 font-bold text-[#ef1428]">
                            {formatPrice(
                              cartItem.item.price * cartItem.quantity
                            )}
                          </p>
                        </div>

                        <Textarea
                          value={cartItem.notes}
                          onChange={(event) =>
                            updateNotes(cartItem.item._id, event.target.value)
                          }
                          placeholder="Kitchen notes"
                          className="mt-3 min-h-16 resize-none rounded-xl border-0 bg-neutral-100 shadow-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {cartItems.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
                    <ReceiptText className="mx-auto size-7 text-neutral-300" />
                    <p className="mt-3 font-medium text-neutral-500">
                      No items selected
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Choose items from the menu to begin.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-100 pt-5">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-neutral-400" />
                  <h3 className="font-bold">Customer details</h3>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Customer name</Label>
                    <Input
                      id="customer-name"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">Customer phone</Label>
                    <Input
                      id="customer-phone"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {success && (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  {success}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-neutral-100 pt-5">
                <span className="font-bold">Order total</span>
                <span className="text-2xl font-black text-[#ef1428]">
                  {formatPrice(total)}
                </span>
              </div>

              <Button
                className="h-13 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={submitting || cartItems.length === 0}
                onClick={submitOrder}
              >
                {submitting ? (
                  "Saving..."
                ) : (
                  <>
                    <ReceiptText className="size-4" />
                    Save draft order
                  </>
                )}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
