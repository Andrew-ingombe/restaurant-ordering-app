import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  Minus,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Store,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { EditOrderSkeleton } from "../components/page-skeletons"

import { WaiterShell } from "../components/waiter-shell"
import {
  getAvailableTables,
  getMyOrder,
  getPublicMenu,
  updateDraftOrder,
} from "../lib/api"
import type {
  AuthUser,
  AvailableRestaurantTable,
  MenuCategory,
  PublicMenuItem,
} from "../lib/api"

type WaiterEditOrderPageProps = {
  user: AuthUser
  onLogout: () => void
}

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

export function WaiterEditOrderPage({
  user,
  onLogout,
}: WaiterEditOrderPageProps) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<PublicMenuItem[]>([])
  const [availableTables, setAvailableTables] = useState<
    AvailableRestaurantTable[]
  >([])
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in")
  const [tableName, setTableName] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [orderNumber, setOrderNumber] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingTables, setLoadingTables] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) {
      const message = "Invalid order"

      setError(message)
      setLoading(false)
      setLoadingTables(false)
      toast.error(message)
      return
    }

    void Promise.all([getMyOrder(id), getPublicMenu(), getAvailableTables()])
      .then(([order, menu, tables]) => {
        if (order.status !== "draft") {
          throw new Error("Only unpaid draft orders can be edited")
        }

        setCategories(menu.categories)
        setItems(menu.items)
        setAvailableTables(tables)
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
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Could not load draft order"

        setError(message)
        toast.error(message, {
          id: `draft-${id}-load-error`,
        })
      })
      .finally(() => {
        setLoading(false)
        setLoadingTables(false)
      })
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

  const currentTableIsAvailable = availableTables.some(
    (table) => table.name === tableName
  )

  const changeQuantity = (item: PublicMenuItem, amount: number) => {
    setError("")

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
    if (!id || submitting) return

    if (cartItems.length === 0) {
      const message = "The order must contain at least one item"
      setError(message)
      toast.error(message)
      return
    }

    if (orderType === "dine_in" && !tableName.trim()) {
      const message = "Select a table"
      setError(message)
      toast.error(message)
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

      setSummaryOpen(false)

      toast.success("Draft changes saved", {
        id: `draft-${id}-updated`,
        description: orderNumber,
      })

      navigate(`/waiter/orders/${id}`, {
        replace: true,
      })
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update draft order"

      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderOrderSummary = (
    idPrefix: "desktop" | "mobile",
    desktop = false
  ) => (
    <div
      className={`space-y-5 rounded-[24px] bg-white p-5 ${
        desktop ? "max-h-full overflow-y-auto" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#ef1428] uppercase">
            Draft summary
          </p>

          <h2 className="mt-1 text-xl font-black">Edit order</h2>
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

        <div className="min-w-0 rounded-2xl bg-[#fff0f1] p-4">
          <p className="text-xs text-[#ef1428]/70">Total</p>

          <p className="mt-1 text-xl font-black break-words text-[#ef1428]">
            {formatPrice(total)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-order-type`}>Order type</Label>

        <Select
          value={orderType}
          onValueChange={(value) => {
            const nextOrderType = value as "dine_in" | "takeaway"

            setOrderType(nextOrderType)
            setError("")

            if (nextOrderType === "takeaway") {
              setTableName("")
            }
          }}
        >
          <SelectTrigger
            id={`${idPrefix}-order-type`}
            className="h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
          >
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
          <Label htmlFor={`${idPrefix}-table`}>Table name or number</Label>

          <Select
            value={tableName}
            onValueChange={(value) => {
              setTableName(value)
              setError("")
            }}
            disabled={loadingTables}
          >
            <SelectTrigger
              id={`${idPrefix}-table`}
              className="h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
            >
              <SelectValue
                placeholder={
                  loadingTables
                    ? "Loading tables..."
                    : availableTables.length === 0
                      ? "No active tables available"
                      : "Select a table"
                }
              />
            </SelectTrigger>

            <SelectContent>
              {tableName && !currentTableIsAvailable && (
                <SelectItem value={tableName}>{tableName}</SelectItem>
              )}

              {availableTables.map((table) => (
                <SelectItem key={table.id} value={table.name}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!loadingTables && availableTables.length === 0 && (
            <p className="text-xs leading-5 text-amber-700">
              Ask the restaurant owner to create or activate a table.
            </p>
          )}
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
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-bold break-words">
                    {cartItem.item.name}
                  </p>

                  <p className="shrink-0 font-bold text-[#ef1428]">
                    {formatPrice(cartItem.item.price * cartItem.quantity)}
                  </p>
                </div>

                <Textarea
                  className="mt-3 min-h-16 resize-none rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={cartItem.notes}
                  placeholder="Kitchen notes"
                  onChange={(event) =>
                    updateNotes(cartItem.item._id, event.target.value)
                  }
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
              Choose items from the menu to continue.
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
            <Label htmlFor={`${idPrefix}-customer-name`}>Customer name</Label>

            <Input
              id={`${idPrefix}-customer-name`}
              className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-customer-phone`}>Customer phone</Label>

            <Input
              id={`${idPrefix}-customer-phone`}
              className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-customer-email`}>Customer email</Label>

            <Input
              id={`${idPrefix}-customer-email`}
              className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
        <span className="font-bold">Order total</span>

        <span className="text-right text-2xl font-black break-words text-[#ef1428]">
          {formatPrice(total)}
        </span>
      </div>

      <Button
        className="h-13 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
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
        disabled={submitting}
        onClick={() => navigate(`/waiter/orders/${id}`)}
      >
        Cancel editing
      </Button>
    </div>
  )

  if (loading) {
    return (
      <WaiterShell
        user={user}
        onLogout={onLogout}
        active="orders"
        title="Edit draft order"
        description="Loading order details..."
        icon={<ReceiptText className="size-6" />}
        contentScrollable={false}
        contentClassName="flex min-h-0 flex-col pb-24 md:pb-24 xl:pb-6"
      >
        <EditOrderSkeleton />
      </WaiterShell>
    )
  }

  if (error && !orderNumber) {
    return (
      <WaiterShell
        user={user}
        onLogout={onLogout}
        active="orders"
        title="Edit draft order"
        description="Could not load this draft."
        icon={<ReceiptText className="size-6" />}
      >
        <div className="mx-auto w-full max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm">
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
      </WaiterShell>
    )
  }

  return (
    <WaiterShell
      user={user}
      onLogout={onLogout}
      active="orders"
      title="Edit draft order"
      description={orderNumber}
      icon={<ReceiptText className="size-6" />}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-col gap-4 pb-24 md:pb-24 xl:pb-6"
    >
      <section className="shrink-0 rounded-[18px] bg-white p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            className="size-10 shrink-0 rounded-xl p-0 sm:w-auto sm:px-3"
            variant="outline"
            onClick={() => navigate(`/waiter/orders/${id}`)}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Order</span>
          </Button>

          <Badge className="hidden h-10 shrink-0 rounded-xl border-0 bg-neutral-950 px-4 text-white sm:flex">
            Draft
          </Badge>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="min-h-10 min-w-0 flex-1 cursor-pointer rounded-xl border-0 bg-neutral-100 px-3 shadow-none sm:max-w-56 sm:flex-none">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">All items ({items.length})</SelectItem>

              {categories.map((category) => {
                const categoryItems = items.filter(
                  (item) => item.category._id === category._id
                ).length

                return (
                  <SelectItem
                    className="cursor-pointer"
                    key={category._id}
                    value={category._id}
                  >
                    {category.name} ({categoryItems})
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden text-sm font-semibold text-neutral-500 md:inline">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>

            <span className="text-base font-black whitespace-nowrap text-[#ef1428] sm:text-lg">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain pr-1 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0">
          <div className="grid gap-4 p-2.5 sm:grid-cols-2 2xl:grid-cols-3">
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

                    <p className="mt-2 min-h-10 text-sm leading-6 text-neutral-400">
                      {item.description || "No description available."}
                    </p>

                    <div className="mt-5 flex min-h-14 items-center justify-between rounded-2xl bg-neutral-100 p-2">
                      <Button
                        className="h-11 min-w-16 cursor-pointer rounded-full"
                        size="icon"
                        variant="outline"
                        disabled={quantity === 0}
                        onClick={() => changeQuantity(item, -1)}
                      >
                        <Minus className="size-5" />
                      </Button>

                      <div className="px-3 text-center">
                        <p className="text-xl font-black">{quantity}</p>

                        <p className="text-[10px] tracking-wide text-neutral-400 uppercase">
                          Selected
                        </p>
                      </div>

                      <Button
                        className="h-11 min-w-16 cursor-pointer rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
                        size="icon"
                        onClick={() => changeQuantity(item, 1)}
                      >
                        <Plus className="size-5" />
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

        <aside className="hidden min-h-0 min-w-0 xl:block">
          {renderOrderSummary("desktop", true)}
        </aside>
      </div>

      {cartItems.length > 0 && (
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetTrigger asChild>
            <div className="fixed right-4 bottom-4 left-4 z-40 xl:hidden">
              <Button className="h-16 w-full justify-between rounded-2xl bg-neutral-950 px-5 text-white shadow-2xl hover:bg-neutral-800">
                <span className="flex items-center gap-3">
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-white/10">
                    <ShoppingBag className="size-5" />

                    <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#ef1428] text-[10px] font-black">
                      {totalItems}
                    </span>
                  </span>

                  <span className="text-left">
                    <span className="block text-xs text-white/50">
                      Review changes
                    </span>

                    <span className="block font-black">
                      {totalItems} {totalItems === 1 ? "item" : "items"}
                    </span>
                  </span>
                </span>

                <span className="text-lg font-black">{formatPrice(total)}</span>
              </Button>
            </div>
          </SheetTrigger>

          <SheetContent
            side="bottom"
            className="max-h-[92svh] overflow-y-auto rounded-t-[28px] border-0 bg-white p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Edit order summary</SheetTitle>

              <SheetDescription>
                Review the draft order and save your changes.
              </SheetDescription>
            </SheetHeader>

            <div className="mx-auto w-full max-w-2xl">
              {renderOrderSummary("mobile")}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </WaiterShell>
  )
}
