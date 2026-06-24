import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  ImageIcon,
  Minus,
  MonitorSmartphone,
  Plus,
  ReceiptText,
  ShoppingBag,
  Store,
  UserRound,
  UtensilsCrossed,
  AlertTriangle,
  Trash2,
} from "lucide-react"

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { MenuGridSkeleton } from "../components/page-skeletons"

import { WaiterShell } from "../components/waiter-shell"
import {
  createDraftOrder,
  getActiveWaiters,
  getAvailableTables,
  getPublicMenu,
} from "../lib/api"
import type {
  AuthUser,
  AvailableRestaurantTable,
  MenuCategory,
  PublicMenuItem,
  StaffUser,
} from "../lib/api"

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

const getStaffId = (staff: StaffUser) => staff.id || staff._id || ""

export function WaiterPage({ user, onLogout }: WaiterPageProps) {
  const navigate = useNavigate()

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<PublicMenuItem[]>([])
  const [availableTables, setAvailableTables] = useState<
    AvailableRestaurantTable[]
  >([])
  const [activeWaiters, setActiveWaiters] = useState<StaffUser[]>([])
  const [selectedWaiterId, setSelectedWaiterId] = useState("")
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in")
  const [tableName, setTableName] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [tableError, setTableError] = useState("")
  const [clearOrderDialogOpen, setClearOrderDialogOpen] = useState(false)

  useEffect(() => {
    const loadOrderingData = async () => {
      try {
        setError("")

        const [menu, tables, waiters] = await Promise.all([
          getPublicMenu(),
          getAvailableTables(),
          user.sharedHub ? getActiveWaiters() : Promise.resolve([]),
        ])

        setCategories(menu.categories)
        setItems(menu.items)
        setAvailableTables(tables)
        setActiveWaiters(waiters)

        if (user.sharedHub && waiters.length === 1) {
          setSelectedWaiterId(getStaffId(waiters[0]))
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Could not load ordering information"

        setError(message)
        toast.error(message, {
          id: "waiter-ordering-load-error",
        })
      } finally {
        setLoadingData(false)
      }
    }

    void loadOrderingData()
  }, [user.sharedHub])

  const visibleItems = useMemo(() => {
    if (selectedCategory === "all") return items

    return items.filter((item) => item.category._id === selectedCategory)
  }, [items, selectedCategory])

  const selectedWaiter = activeWaiters.find(
    (waiter) => getStaffId(waiter) === selectedWaiterId
  )

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

  const clearCurrentOrder = () => {
    setCart({})
    setTableName("")
    setCustomerName("")
    setCustomerPhone("")
    setError("")
    setSuccess("")
    setTableError("")
    setSummaryOpen(false)
    setClearOrderDialogOpen(false)

    if (user.sharedHub && activeWaiters.length !== 1) {
      setSelectedWaiterId("")
    }

    toast.success("Draft cleared")
  }

  const submitOrder = async () => {
    if (submitting) return

    setError("")
    setSuccess("")

    if (user.sharedHub && !selectedWaiterId) {
      const message = "Select the waiter serving this order"
      setError(message)
      toast.error(message)
      return
    }

    if (cartItems.length === 0) {
      const message = "Add at least one menu item"
      setError(message)
      toast.error(message)
      return
    }

    if (orderType === "dine_in" && !tableName.trim()) {
      const message = "Select a table before saving this order"
      setTableError(message)
      toast.error(message)
      return
    }

    setSubmitting(true)

    try {
      const order = await createDraftOrder({
        ...(user.sharedHub ? { waiterId: selectedWaiterId } : {}),
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

      const successMessage = `Draft ${order.orderNumber} created`

      setSuccess(successMessage)
      setCart({})
      setTableName("")
      setCustomerName("")
      setCustomerPhone("")
      setSummaryOpen(false)

      if (user.sharedHub && activeWaiters.length !== 1) {
        setSelectedWaiterId("")
      }

      toast.success("Draft order created", {
        id: `draft-${order._id}`,
        description: user.sharedHub
          ? `${order.orderNumber} assigned to ${
              selectedWaiter?.name || "the selected waiter"
            }.`
          : `${order.orderNumber} is ready for review.`,
      })

      navigate("/waiter/orders")
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not create order"

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
        desktop
          ? "xl:sticky xl:top-28 xl:max-h-[calc(100svh-140px)] xl:overflow-y-auto"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4 pr-10 sm:pr-0">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#ef1428] uppercase">
            Current order
          </p>

          <h2 className="mt-1 text-xl font-black">Order summary</h2>
        </div>

        <div className="hidden size-11 items-center justify-center rounded-full bg-neutral-950 text-white sm:flex">
          <ShoppingBag className="size-5" />
        </div>
      </div>

      {user.sharedHub && (
        <div className="rounded-2xl bg-[#fff0f1] p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ef1428] text-white">
              <MonitorSmartphone className="size-4" />
            </div>

            <div>
              <p className="font-black">Shared ordering hub</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Select the waiter who is serving this table. The hub records the
                order, but the waiter keeps the order ownership.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-served-by`}>Served by waiter</Label>

            <Select
              value={selectedWaiterId}
              onValueChange={(value) => {
                setSelectedWaiterId(value)
                setError("")
              }}
              disabled={loadingData || activeWaiters.length === 0}
            >
              <SelectTrigger
                id={`${idPrefix}-served-by`}
                className="min-h-12 w-full rounded-xl border-0 bg-white px-4 shadow-none"
              >
                <SelectValue
                  placeholder={
                    loadingData
                      ? "Loading waiters..."
                      : activeWaiters.length === 0
                        ? "No active waiters available"
                        : "Select waiter"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {activeWaiters.map((waiter) => (
                  <SelectItem
                    key={getStaffId(waiter)}
                    value={getStaffId(waiter)}
                  >
                    {waiter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!loadingData && activeWaiters.length === 0 && (
              <p className="text-xs leading-5 text-red-700">
                Add or activate at least one normal waiter account before using
                this shared hub.
              </p>
            )}
          </div>
        </div>
      )}

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
            setTableError("")

            if (nextOrderType === "takeaway") {
              setTableName("")
            }
          }}
        >
          <SelectTrigger
            id={`${idPrefix}-order-type`}
            className="min-h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
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
              setTableError("")
            }}
            disabled={loadingData || availableTables.length === 0}
          >
            <SelectTrigger
              id={`${idPrefix}-table`}
              className="min-h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
            >
              <SelectValue
                placeholder={
                  loadingData
                    ? "Loading tables..."
                    : availableTables.length === 0
                      ? "No active tables available"
                      : "Select a table"
                }
              />
            </SelectTrigger>

            <SelectContent>
              {availableTables.map((table) => (
                <SelectItem key={table.id} value={table.name}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tableError && (
            <p className="text-xs leading-5 text-red-700">{tableError}</p>
          )}

          {!loadingData && availableTables.length === 0 && (
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
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {success && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="size-4" />
          {success}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">
        <span className="font-bold">Order total</span>

        <span className="text-right text-2xl font-black break-words text-[#ef1428]">
          {formatPrice(total)}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr]">
        <Button
          className="h-13 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
          type="button"
          variant="outline"
          disabled={submitting || cartItems.length === 0}
          onClick={() => setClearOrderDialogOpen(true)}
        >
          <Trash2 className="size-4" />
          Clear order
        </Button>

        <Button
          className="h-13 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
          disabled={
            submitting ||
            cartItems.length === 0 ||
            (user.sharedHub &&
              (!selectedWaiterId || activeWaiters.length === 0))
          }
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
    </div>
  )

  if (loadingData && items.length === 0) {
    return (
      <WaiterShell
        user={user}
        onLogout={onLogout}
        active="new-order"
        title="Create new order"
        description="Select items, save a draft, then manage it from the orders queue."
        icon={<UtensilsCrossed className="size-6" />}
        contentClassName="space-y-5"
      >
        <MenuGridSkeleton />
      </WaiterShell>
    )
  }

  return (
    <WaiterShell
      user={user}
      onLogout={onLogout}
      active="new-order"
      title="Create new order"
      description={
        user.sharedHub
          ? "Assign each order to the waiter serving the table."
          : "Select items, save a draft, then manage it from the orders queue."
      }
      icon={<UtensilsCrossed className="size-6" />}
      contentScrollable={false}
      contentClassName="grid min-h-0 gap-5 md:p-6 xl:grid-cols-[minmax(0,1fr)_400px]"
    >
      <Dialog
        open={clearOrderDialogOpen}
        onOpenChange={(open) => {
          if (!submitting) {
            setClearOrderDialogOpen(open)
          }
        }}
      >
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-[#ef1428]">
                <AlertTriangle className="size-5" />
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                Clear this order?
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                This only clears the current unsaved selection on this screen.
                No saved order will be cancelled.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 rounded-xl"
                type="button"
                variant="outline"
                onClick={() => setClearOrderDialogOpen(false)}
              >
                Keep order
              </Button>

              <Button
                className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                type="button"
                onClick={clearCurrentOrder}
              >
                Clear order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="shrink-0 rounded-[20px] bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              <Button
                className={`h-10 shrink-0 rounded-xl px-4 ${
                  selectedCategory === "all"
                    ? "bg-neutral-950 text-white hover:bg-neutral-800"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
                variant="ghost"
                onClick={() => setSelectedCategory("all")}
              >
                All items
              </Button>

              {categories.map((category) => (
                <Button
                  key={category._id}
                  className={`h-10 shrink-0 rounded-xl px-4 ${
                    selectedCategory === category._id
                      ? "bg-[#ef1428] text-white hover:bg-[#d91023]"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                  variant="ghost"
                  onClick={() => setSelectedCategory(category._id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>

            <Badge
              variant="secondary"
              className="hidden h-10 shrink-0 items-center rounded-xl px-4 sm:flex"
            >
              {visibleItems.length}{" "}
              {visibleItems.length === 1 ? "item" : "items"}
            </Badge>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-20 xl:pb-0">
          <div className="grid gap-4 pb-1 sm:grid-cols-2 2xl:grid-cols-3">
            {visibleItems.map((item) => {
              const quantity = cart[item._id]?.quantity || 0

              return (
                <article
                  key={item._id}
                  className={`overflow-hidden rounded-[24px] bg-white transition ${
                    quantity > 0
                      ? "outline-2 outline-offset-2 outline-[#ef1428]"
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
        </div>
      </section>

      <aside className="hidden min-w-0 xl:block">
        {renderOrderSummary("desktop", true)}
      </aside>

      {cartItems.length > 0 && (
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetTrigger asChild>
            <div className="fixed right-4 bottom-4 left-4 z-40 xl:hidden">
              <Button className="h-16 w-full justify-between rounded-2xl bg-neutral-950 px-5 text-white hover:bg-neutral-800">
                <span className="flex items-center gap-3">
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-white/10">
                    <ShoppingBag className="size-5" />

                    <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#ef1428] text-[10px] font-black">
                      {totalItems}
                    </span>
                  </span>

                  <span className="text-left">
                    <span className="block text-xs text-white/50">
                      {user.sharedHub && selectedWaiter
                        ? selectedWaiter.name
                        : "View order"}
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
              <SheetTitle>Order summary</SheetTitle>

              <SheetDescription>
                Review the selected items and save the draft order.
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
