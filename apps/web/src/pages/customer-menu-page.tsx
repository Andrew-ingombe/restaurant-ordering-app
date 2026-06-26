import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  ImageIcon,
  Minus,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { CustomerMenuSkeleton } from "../components/page-skeletons"

import { getCustomerTableMenu, submitCustomerOrder } from "../lib/api"
import type {
  CustomerOrderResponse,
  CustomerTableMenu,
  PublicMenuItem,
} from "../lib/api"

type CartItem = {
  item: PublicMenuItem
  quantity: number
}

const formatPrice = (price: number, currency = "ZMW") =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency,
  }).format(price / 100)

const getCompactPrice = (price: number, currency = "ZMW") =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency,
    maximumFractionDigits: price % 100 === 0 ? 0 : 2,
  }).format(price / 100)

const getRestaurantName = (menu: CustomerTableMenu) => {
  return menu.restaurant.name
}

export function CustomerMenuPage() {
  const { token } = useParams()

  const [menu, setMenu] = useState<CustomerTableMenu | null>(null)
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [categoryId, setCategoryId] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null)
  const [detailQuantity, setDetailQuantity] = useState(1)
  const [cartOpen, setCartOpen] = useState(false)
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

    const normalizedQuery = searchQuery.trim().toLowerCase()

    return menu.items.filter((item) => {
      const matchesCategory =
        categoryId === "all" || item.category._id === categoryId

      const matchesSearch =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description?.toLowerCase().includes(normalizedQuery) ||
        item.category.name.toLowerCase().includes(normalizedQuery)

      return matchesCategory && matchesSearch
    })
  }, [menu, categoryId, searchQuery])

  const cartItems = Object.values(cart)

  const totalItems = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.quantity,
    0
  )

  const total = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.item.price * cartItem.quantity,
    0
  )

  const getCartQuantity = (itemId: string) => {
    return cart[itemId]?.quantity || 0
  }

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
        },
      }
    })
  }

  const openItemDetails = (item: PublicMenuItem) => {
    setSelectedItem(item)
    setDetailQuantity(Math.max(getCartQuantity(item._id), 1))
  }

  const closeItemDetails = () => {
    setSelectedItem(null)
    setDetailQuantity(1)
  }

  const addSelectedItemToCart = () => {
    if (!selectedItem) return

    setCart((current) => ({
      ...current,
      [selectedItem._id]: {
        item: selectedItem,
        quantity: detailQuantity,
      },
    }))

    closeItemDetails()
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchOpen(false)
  }

  const clearCart = () => {
    setCart({})
    setCartOpen(false)
  }

  const submitOrder = async () => {
    if (!token || cartItems.length === 0) return

    setSubmitting(true)
    setError("")

    try {
      const response = await submitCustomerOrder({
        token,
        customer: {
          name: "",
          phone: "",
        },
        items: cartItems.map((cartItem) => ({
          menuItem: cartItem.item._id,
          quantity: cartItem.quantity,
          notes: "",
        })),
      })

      setResult(response)
      setCart({})
      setCartOpen(false)
      setSelectedItem(null)
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
    return <CustomerMenuSkeleton />
  }

  if (error && !menu) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f5f5f6] p-4">
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

  const restaurantName = getRestaurantName(menu)
  const currency = menu.restaurant.currency || "ZMW"

  if (result) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f5f5f6] p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-neutral-100 px-6 py-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#047857] text-white">
              <UtensilsCrossed className="size-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate font-black">{restaurantName}</p>
              <p className="text-sm text-neutral-400">
                {result.order.tableName}
              </p>
            </div>
          </div>

          <div className="px-6 py-7">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-7" />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emerald-600 uppercase">
                  Request received
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  Sent to your waiter
                </h1>

                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Your selections are now waiting for a waiter to review.
                </p>
              </div>
            </div>

            <div className="mt-7 overflow-hidden rounded-[22px] border border-neutral-100">
              <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400 uppercase">
                  Order number
                </p>

                <p className="mt-1 text-xl font-black">
                  {result.order.orderNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 divide-x divide-neutral-100">
                <div className="p-5">
                  <p className="text-xs text-neutral-400">Table</p>

                  <p className="mt-1 font-black">{result.order.tableName}</p>
                </div>

                <div className="p-5">
                  <p className="text-xs text-neutral-400">Order total</p>

                  <p className="mt-1 font-black text-[#047857]">
                    {formatPrice(
                      result.order.total,
                      result.order.currency || currency
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-[20px] bg-neutral-100 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
                <Clock3 className="size-4 text-neutral-600" />
              </div>

              <div>
                <p className="text-sm font-bold">What happens next?</p>

                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  A waiter will confirm your selections and arrange payment when
                  your meal is complete.
                </p>
              </div>
            </div>

            <Button
              className="mt-6 h-13 w-full cursor-pointer rounded-2xl bg-neutral-950 text-white hover:bg-neutral-800"
              onClick={() => setResult(null)}
            >
              <UtensilsCrossed className="size-4" />
              Back to menu
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-white pb-28">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#047857] text-white">
                <UtensilsCrossed className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.16em] text-[#047857] uppercase">
                  Digital menu
                </p>

                <h1 className="truncate text-lg font-black tracking-tight">
                  {restaurantName}
                </h1>

                <p className="text-xs text-neutral-400">{menu.table.name}</p>
              </div>
            </div>

            <Button
              className={`size-11 shrink-0 cursor-pointer rounded-xl ${
                searchOpen
                  ? "bg-neutral-950 text-white hover:bg-neutral-800"
                  : ""
              }`}
              size="icon"
              variant={searchOpen ? "default" : "outline"}
              onClick={() => {
                if (searchOpen) {
                  clearSearch()
                } else {
                  setSearchOpen(true)
                }
              }}
            >
              {searchOpen ? (
                <X className="size-5" />
              ) : (
                <Search className="size-5" />
              )}
            </Button>
          </div>

          {searchOpen && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

              <Input
                autoFocus
                className="h-12 rounded-2xl border-0 bg-neutral-100 pr-12 pl-11 shadow-none"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search dishes, drinks or categories"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="absolute top-1/2 right-4 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-neutral-200"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-6 overflow-x-auto pb-1">
            <button
              type="button"
              className={`shrink-0 cursor-pointer border-b-2 pb-3 text-sm font-black tracking-tight uppercase transition ${
                categoryId === "all"
                  ? "border-neutral-950 text-neutral-950"
                  : "border-transparent text-neutral-400"
              }`}
              onClick={() => setCategoryId("all")}
            >
              All dishes
            </button>

            {menu.categories.map((category) => (
              <button
                key={category._id}
                type="button"
                className={`shrink-0 cursor-pointer border-b-2 pb-3 text-sm font-black tracking-tight uppercase transition ${
                  categoryId === category._id
                    ? "border-neutral-950 text-neutral-950"
                    : "border-transparent text-neutral-400"
                }`}
                onClick={() => setCategoryId(category._id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5">
        {error && (
          <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {searchQuery && (
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">
              {visibleItems.length}{" "}
              {visibleItems.length === 1 ? "result" : "results"} for{" "}
              <strong className="text-neutral-950">“{searchQuery}”</strong>
            </p>

            <button
              type="button"
              className="shrink-0 cursor-pointer text-sm font-bold text-[#047857]"
              onClick={() => setSearchQuery("")}
            >
              Clear
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-x-4 gap-y-7">
          {visibleItems.map((item) => {
            const quantity = getCartQuantity(item._id)

            return (
              <article key={item._id} className="min-w-0">
                <button
                  type="button"
                  className="group block w-full cursor-pointer text-left"
                  onClick={() => openItemDetails(item)}
                >
                  <div className="relative aspect-square overflow-hidden rounded-[26px] bg-neutral-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="size-10 text-neutral-300" />
                      </div>
                    )}

                    {quantity > 0 ? (
                      <div
                        className="absolute right-3 bottom-3 flex h-12 min-w-[132px] items-center justify-between rounded-full bg-white px-1.5 shadow-lg"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex size-10 cursor-pointer items-center justify-center rounded-full text-neutral-950 hover:bg-neutral-100"
                          onClick={() => changeQuantity(item, -1)}
                        >
                          <Minus className="size-5" />
                        </button>

                        <span className="min-w-8 text-center text-base font-black">
                          {quantity}
                        </span>

                        <button
                          type="button"
                          className="flex size-10 cursor-pointer items-center justify-center rounded-full text-neutral-950 hover:bg-neutral-100"
                          onClick={() => changeQuantity(item, 1)}
                        >
                          <Plus className="size-5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        className="absolute right-3 bottom-3 flex size-12 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-950 shadow-lg transition group-hover:scale-105"
                        onClick={(event) => {
                          event.stopPropagation()
                          changeQuantity(item, 1)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            event.stopPropagation()
                            changeQuantity(item, 1)
                          }
                        }}
                      >
                        <Plus className="size-5" />
                      </span>
                    )}
                  </div>

                  <div className="mt-3 px-1">
                    <p className="text-base font-black">
                      {getCompactPrice(item.price, currency)}
                    </p>

                    <h2 className="mt-1 truncate text-base font-semibold">
                      {item.name}
                    </h2>

                    <p className="mt-1 line-clamp-1 text-sm text-neutral-400">
                      {item.description || "Freshly prepared"}
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#047857]">
                      {item.category.name}
                    </p>
                  </div>
                </button>
              </article>
            )
          })}
        </section>

        {visibleItems.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-12 text-center">
            <ChefHat className="mx-auto size-8 text-neutral-300" />

            <p className="mt-4 font-bold">
              {searchQuery ? "No matching dishes" : "No dishes available"}
            </p>

            <p className="mt-1 text-sm text-neutral-400">
              {searchQuery
                ? "Try another dish, drink or category name."
                : "This category currently has no available menu items."}
            </p>

            {searchQuery && (
              <Button
                className="mt-5 rounded-xl"
                variant="outline"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>

      {totalItems > 0 && !cartOpen && !selectedItem && (
        <button
          type="button"
          className="fixed right-5 bottom-6 z-40 flex cursor-pointer items-center gap-3 rounded-[28px] bg-[#047857] px-6 py-4 text-white shadow-2xl shadow-[#047857]/25"
          onClick={() => setCartOpen(true)}
        >
          <span className="text-lg font-black">
            {formatPrice(total, currency)}
          </span>

          <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
            <ShoppingBag className="size-5" />
          </span>

          <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-black text-white">
            {totalItems}
          </span>
        </button>
      )}

      <Sheet
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) {
            closeItemDetails()
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[94svh] w-full border-0 bg-transparent p-0 shadow-none [&>button]:hidden"
        >
          {selectedItem && (
            <div className="mx-auto flex max-h-[94svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:mb-4 sm:rounded-[32px]">
              <SheetHeader className="shrink-0 border-b border-neutral-100 px-5 py-4 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <SheetTitle className="text-lg font-black">
                      Dish details
                    </SheetTitle>

                    <SheetDescription className="mt-1">
                      Review the dish and select a quantity.
                    </SheetDescription>
                  </div>

                  <Button
                    className="size-10 shrink-0 cursor-pointer rounded-full"
                    size="icon"
                    variant="ghost"
                    onClick={closeItemDetails}
                  >
                    <X className="size-5" />
                  </Button>
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="h-[34svh] min-h-[250px] bg-neutral-100 sm:h-80">
                  {selectedItem.imageUrl ? (
                    <img
                      src={selectedItem.imageUrl}
                      alt={selectedItem.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="size-12 text-neutral-300" />
                    </div>
                  )}
                </div>

                <section className="px-6 py-6">
                  <Badge className="rounded-full border-0 bg-[#ECFDF5] px-4 py-1.5 text-[#047857]">
                    {selectedItem.category.name}
                  </Badge>

                  <h2 className="mt-5 text-3xl leading-tight font-black tracking-tight text-neutral-950 sm:text-4xl">
                    {selectedItem.name}
                  </h2>

                  <p className="mt-3 text-2xl font-black text-[#047857] sm:text-3xl">
                    {formatPrice(selectedItem.price, currency)}
                  </p>

                  <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-500 sm:text-lg sm:leading-8">
                    {selectedItem.description ||
                      "Freshly prepared by the restaurant."}
                  </p>
                </section>
              </div>

              <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-4">
                <div className="grid grid-cols-[124px_1fr] gap-3 sm:grid-cols-[140px_1fr]">
                  <div className="flex h-14 items-center justify-between rounded-2xl bg-neutral-100 px-1.5">
                    <button
                      type="button"
                      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-neutral-950 hover:bg-white disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
                      disabled={detailQuantity <= 1}
                      onClick={() =>
                        setDetailQuantity((current) => Math.max(1, current - 1))
                      }
                    >
                      <Minus className="size-5" />
                    </button>

                    <span className="min-w-8 text-center text-lg font-black">
                      {detailQuantity}
                    </span>

                    <button
                      type="button"
                      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-neutral-950 hover:bg-white"
                      onClick={() =>
                        setDetailQuantity((current) => current + 1)
                      }
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>

                  <Button
                    className="h-14 cursor-pointer rounded-2xl bg-[#047857] text-base font-black text-white hover:bg-[#065F46]"
                    onClick={addSelectedItemToCart}
                  >
                    Add{" "}
                    {formatPrice(selectedItem.price * detailQuantity, currency)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92svh] w-full border-0 bg-transparent p-0 shadow-none [&>button]:hidden"
        >
          <div className="mx-auto flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:mb-4 sm:rounded-[32px]">
            <SheetHeader className="shrink-0 border-b border-neutral-100 px-5 py-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#047857] uppercase">
                    Current order
                  </p>

                  <SheetTitle className="mt-1 text-2xl font-black">
                    Order summary
                  </SheetTitle>

                  <SheetDescription className="mt-1">
                    {restaurantName} · {menu.table.name}
                  </SheetDescription>
                </div>

                <Button
                  className="size-10 shrink-0 cursor-pointer rounded-full"
                  size="icon"
                  variant="ghost"
                  onClick={() => setCartOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="rounded-[22px] bg-neutral-100 p-4">
                  <p className="text-sm text-neutral-400">Items</p>
                  <p className="mt-2 text-2xl font-black">{totalItems}</p>
                </div>

                <div className="rounded-[22px] bg-[#ECFDF5] p-4">
                  <p className="text-sm text-[#047857]/70">Total</p>
                  <p className="mt-2 text-2xl font-black text-[#047857]">
                    {formatPrice(total, currency)}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {cartItems.map((cartItem) => (
                <div
                  key={cartItem.item._id}
                  className="flex items-center gap-3 rounded-[22px] border border-neutral-100 p-3"
                >
                  <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                    {cartItem.item.imageUrl ? (
                      <img
                        src={cartItem.item.imageUrl}
                        alt={cartItem.item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="size-6 text-neutral-300" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-bold">
                      {cartItem.item.name}
                    </p>

                    <p className="mt-1 text-sm text-neutral-400">
                      {cartItem.item.category.name}
                    </p>

                    <p className="mt-1 font-black text-[#047857]">
                      {formatPrice(
                        cartItem.item.price * cartItem.quantity,
                        currency
                      )}
                    </p>
                  </div>

                  <div className="flex h-12 min-w-[126px] shrink-0 items-center justify-between rounded-2xl bg-neutral-100 px-1.5">
                    <button
                      type="button"
                      className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-white"
                      onClick={() => changeQuantity(cartItem.item, -1)}
                    >
                      <Minus className="size-5" />
                    </button>

                    <span className="min-w-7 text-center font-black">
                      {cartItem.quantity}
                    </span>

                    <button
                      type="button"
                      className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-white"
                      onClick={() => changeQuantity(cartItem.item, 1)}
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                </div>
              ))}

              {error && (
                <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-12 rounded-xl"
                  variant="outline"
                  onClick={() => setCartOpen(false)}
                >
                  Open menu
                </Button>

                <Button
                  className="h-12 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                  variant="outline"
                  onClick={clearCart}
                >
                  <Trash2 className="size-4" />
                  Clear cart
                </Button>
              </div>
            </div>

            <div className="shrink-0 border-t border-neutral-100 bg-white px-5 py-4">
              <Button
                className="h-14 w-full rounded-[22px] bg-[#047857] text-base font-black text-white hover:bg-[#065F46]"
                disabled={submitting || cartItems.length === 0}
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
                    Send to waiter · {formatPrice(total, currency)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  )
}
