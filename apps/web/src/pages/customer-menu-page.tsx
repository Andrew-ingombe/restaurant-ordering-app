import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  ImageIcon,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { getCustomerTableMenu, submitCustomerOrder } from "../lib/api"
import type {
  CustomerOrderResponse,
  CustomerTableMenu,
  PublicMenuItem,
} from "../lib/api"

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

export function CustomerMenuPage() {
  const { token } = useParams()

  const [menu, setMenu] = useState<CustomerTableMenu | null>(null)
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [categoryId, setCategoryId] = useState("all")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [result, setResult] = useState<CustomerOrderResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setError("Invalid table menu link")
      setLoading(false)
      return
    }

    void getCustomerTableMenu(token)
      .then(setMenu)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load menu"
        )
      })
      .finally(() => setLoading(false))
  }, [token])

  const visibleItems = useMemo(() => {
    if (!menu) return []
    if (categoryId === "all") return menu.items

    return menu.items.filter((item) => item.category._id === categoryId)
  }, [menu, categoryId])

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

  const submitOrder = async () => {
    if (!token || cartItems.length === 0) return

    setSubmitting(true)
    setError("")

    try {
      const response = await submitCustomerOrder({
        token,
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
        },
        items: cartItems.map((cartItem) => ({
          menuItem: cartItem.item._id,
          quantity: cartItem.quantity,
          notes: cartItem.notes,
        })),
      })

      setResult(response)
      setCart({})
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not submit order"
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#252323] p-4">
        <div className="text-center text-white">
          <RefreshCw className="mx-auto size-7 animate-spin text-[#ef1428]" />
          <p className="mt-4 text-sm text-white/60">
            Loading restaurant menu...
          </p>
        </div>
      </main>
    )
  }

  if (error && !menu) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#252323] p-4">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <UtensilsCrossed className="size-7" />
          </div>

          <h1 className="mt-5 text-xl font-black">Menu unavailable</h1>

          <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>

          <p className="mt-4 text-sm text-neutral-400">
            Please ask a waiter for assistance.
          </p>
        </div>
      </main>
    )
  }

  if (!menu) return null

  if (result) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#252323] p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white">
          <div className="h-2 bg-[#ef1428]" />

          <div className="p-7 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
              Request received
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight">
              Selection sent
            </h1>

            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Your order request has been sent to a waiter for{" "}
              <strong className="text-neutral-950">
                {result.order.tableName}
              </strong>
              .
            </p>

            <div className="mt-6 rounded-[20px] bg-neutral-100 p-5">
              <p className="text-xs tracking-[0.16em] text-neutral-400 uppercase">
                Order number
              </p>

              <p className="mt-2 text-2xl font-black">
                {result.order.orderNumber}
              </p>

              <p className="mt-3 text-xl font-black text-[#ef1428]">
                {formatPrice(result.order.total)}
              </p>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-left">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-600" />

              <p className="text-sm leading-6 text-amber-900">
                Please wait for a waiter to review your selection and arrange
                payment.
              </p>
            </div>

            <Button
              className="mt-6 h-12 w-full rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
              onClick={() => setResult(null)}
            >
              <Plus className="size-4" />
              Start another order
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      className={`min-h-svh ${
        cartItems.length > 0 ? "pb-[520px] md:pb-[460px]" : ""
      }`}
    >
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-[1500px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#ef1428] text-white">
                <UtensilsCrossed className="size-6" />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  Restaurant menu
                </p>

                <h1 className="text-2xl font-black tracking-tight">
                  Browse our menu
                </h1>

                <p className="text-sm text-neutral-400">
                  Ordering for {menu.table.name}
                </p>
              </div>
            </div>

            <div className="relative flex size-12 items-center justify-center rounded-2xl bg-neutral-950 text-white">
              <ShoppingBag className="size-5" />

              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#ef1428] text-[10px] font-black text-white">
                  {totalItems}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4 md:p-6">
          <section className="rounded-[24px] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#ef1428] uppercase">
                  Meal categories
                </p>

                <h2 className="mt-1 text-xl font-black">
                  What would you like?
                </h2>
              </div>

              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {menu.items.length} items
              </Badge>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              <Button
                className={`shrink-0 rounded-full px-5 ${
                  categoryId === "all"
                    ? "bg-neutral-950 text-white hover:bg-neutral-800"
                    : ""
                }`}
                variant={categoryId === "all" ? "default" : "outline"}
                onClick={() => setCategoryId("all")}
              >
                All dishes
              </Button>

              {menu.categories.map((category) => (
                <Button
                  key={category._id}
                  className={`shrink-0 rounded-full px-5 ${
                    categoryId === category._id
                      ? "bg-[#ef1428] text-white hover:bg-[#d91023]"
                      : ""
                  }`}
                  variant={categoryId === category._id ? "default" : "outline"}
                  onClick={() => setCategoryId(category._id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <div className="relative h-48 bg-neutral-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="size-10 text-neutral-300" />
                      </div>
                    )}

                    <Badge className="absolute top-3 right-3 rounded-full border-0 bg-white font-black text-[#ef1428] shadow-sm">
                      {formatPrice(item.price)}
                    </Badge>

                    {quantity > 0 && (
                      <div className="absolute top-3 left-3 flex size-10 items-center justify-center rounded-full bg-[#ef1428] font-black text-white shadow-sm">
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
                      {item.description || "A delicious restaurant menu item."}
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
              <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-12 text-center sm:col-span-2 xl:col-span-3">
                <ChefHat className="mx-auto size-8 text-neutral-300" />

                <p className="mt-4 font-bold">No dishes available</p>

                <p className="mt-1 text-sm text-neutral-400">
                  This category currently has no available menu items.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto border-t border-black/5 bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.18)]">
          <div className="mx-auto max-w-5xl p-4 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                  <ShoppingBag className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                    Your selection
                  </p>
                  <h2 className="text-lg font-black">
                    {totalItems} {totalItems === 1 ? "item" : "items"}
                  </h2>
                </div>
              </div>

              <p className="text-2xl font-black text-[#ef1428]">
                {formatPrice(total)}
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {cartItems.map((cartItem) => (
                <div
                  key={cartItem.item._id}
                  className="rounded-2xl border border-neutral-100 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-black text-white">
                      {cartItem.quantity}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3">
                        <p className="font-bold">{cartItem.item.name}</p>

                        <p className="shrink-0 font-bold text-[#ef1428]">
                          {formatPrice(cartItem.item.price * cartItem.quantity)}
                        </p>
                      </div>

                      <Textarea
                        className="mt-3 min-h-14 resize-none rounded-xl border-0 bg-neutral-100 shadow-none"
                        value={cartItem.notes}
                        placeholder="Special instructions"
                        onChange={(event) =>
                          updateNotes(cartItem.item._id, event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Your name (optional)</Label>

                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

                  <Input
                    id="customer-name"
                    className="h-12 rounded-xl border-0 bg-neutral-100 pl-11 shadow-none"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone number (optional)</Label>

                <div className="relative">
                  <Phone className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

                  <Input
                    id="customer-phone"
                    className="h-12 rounded-xl border-0 bg-neutral-100 pl-11 shadow-none"
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Enter your phone"
                  />
                </div>
              </div>

              <Button
                className="h-12 rounded-xl bg-[#ef1428] px-7 text-white hover:bg-[#d91023]"
                disabled={submitting}
                onClick={submitOrder}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <ReceiptText className="size-4" />
                    Send to waiter
                  </>
                )}
              </Button>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
