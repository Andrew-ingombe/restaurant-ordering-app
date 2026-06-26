import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FilePenLine,
  History,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed,
  WalletCards,
  UserRound,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import {
  OrderCardsSkeleton,
  OrdersToolbarSkeleton,
} from "../components/page-skeletons"
import { WaiterShell } from "../components/waiter-shell"
import { getMyOrders, updateWaiterOrderStatus } from "../lib/api"
import type { AuthUser, DraftOrder, WaiterOrderHistoryStatus } from "../lib/api"
import { getSocket } from "../lib/socket"

type WaiterOrdersPageProps = {
  user: AuthUser
  onLogout: () => void
}

type OrderView = "active" | "history"

const activeOrderStatuses = [
  "draft",
  "awaiting_payment",
  "submitted",
  "accepted",
  "preparing",
  "ready",
  "served",
]

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

const statusConfig: Record<
  string,
  {
    className: string
    iconClassName: string
    icon: typeof Clock3
  }
> = {
  draft: {
    className: "bg-neutral-100 text-neutral-700",
    iconClassName: "bg-neutral-950 text-white",
    icon: FilePenLine,
  },
  awaiting_payment: {
    className: "bg-amber-50 text-amber-700",
    iconClassName: "bg-amber-400 text-white",
    icon: WalletCards,
  },
  submitted: {
    className: "bg-blue-50 text-blue-700",
    iconClassName: "bg-blue-500 text-white",
    icon: ReceiptText,
  },
  accepted: {
    className: "bg-violet-50 text-violet-700",
    iconClassName: "bg-violet-500 text-white",
    icon: CheckCircle2,
  },
  preparing: {
    className: "bg-amber-50 text-amber-700",
    iconClassName: "bg-amber-400 text-white",
    icon: ChefHat,
  },
  ready: {
    className: "bg-emerald-50 text-emerald-700",
    iconClassName: "bg-emerald-500 text-white",
    icon: PackageCheck,
  },
  served: {
    className: "bg-cyan-50 text-cyan-700",
    iconClassName: "bg-cyan-500 text-white",
    icon: UtensilsCrossed,
  },
  completed: {
    className: "bg-neutral-950 text-white",
    iconClassName: "bg-neutral-950 text-white",
    icon: CheckCircle2,
  },
  cancelled: {
    className: "bg-red-50 text-red-700",
    iconClassName: "bg-red-500 text-white",
    icon: ReceiptText,
  },
}

const getStatusConfig = (status: string) =>
  statusConfig[status] || {
    className: "bg-neutral-100 text-neutral-700",
    iconClassName: "bg-neutral-400 text-white",
    icon: Clock3,
  }

function OrderCard({
  order,
  onOpen,
  onMarkServed,
  markingServed,
  showWaiterName,
}: {
  order: DraftOrder
  onOpen: () => void
  onMarkServed: () => void
  markingServed: boolean
  showWaiterName: boolean
}) {
  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const currentStatus = getStatusConfig(order.status)
  const StatusIcon = currentStatus.icon
  const assignedWaiterName = order.waiter?.name
  const showAssignedWaiter = showWaiterName && Boolean(assignedWaiterName)

  return (
    <article className="flex h-full flex-col rounded-[20px] border border-neutral-100 bg-white p-4 transition hover:border-neutral-200 hover:bg-neutral-50">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${currentStatus.iconClassName}`}
        >
          <StatusIcon className="size-4" />
        </div>

        <Badge
          className={`rounded-full border-0 capitalize ${currentStatus.className}`}
        >
          {formatStatus(order.status)}
        </Badge>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#047857] uppercase">
          {order.tableName || "Takeaway"}
        </p>

        <h3 className="mt-1 text-lg font-black">{order.orderNumber}</h3>

        <p className="mt-1 text-xs text-neutral-400">
          {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      {showAssignedWaiter && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#ECFDF5] p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#047857] text-white">
            <UserRound className="size-4" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#047857] uppercase">
              Owned by
            </p>

            <p className="truncate font-black">{assignedWaiterName}</p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-neutral-100 p-3">
        <p className="text-xs font-semibold text-neutral-400">Customer</p>

        <p className="mt-1 truncate font-bold">
          {order.customer.name || "Walk-in customer"}
        </p>

        <p className="mt-1 truncate text-xs text-neutral-500">
          {order.customer.phone || "No phone number"}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {order.items.slice(0, 3).map((item, index) => (
          <div
            key={`${item.menuItem}-${index}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 px-3 py-2 text-sm"
          >
            <span className="truncate">
              <strong>{item.quantity}×</strong> {item.name}
            </span>

            <span className="shrink-0 text-neutral-400">
              {formatPrice(item.lineTotal)}
            </span>
          </div>
        ))}

        {order.items.length > 3 && (
          <p className="px-2 text-xs text-neutral-400">
            +{order.items.length - 3} more menu{" "}
            {order.items.length - 3 === 1 ? "item" : "items"}
          </p>
        )}
      </div>

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <div>
            <p className="text-xs text-neutral-400">Total</p>

            <p className="mt-1 text-lg font-black text-[#047857]">
              {formatPrice(order.total)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-neutral-400">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>

            <Badge
              className={`mt-1 rounded-full border-0 capitalize ${
                order.paymentStatus === "paid"
                  ? "bg-emerald-50 text-emerald-700"
                  : order.paymentStatus === "failed"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              <WalletCards className="size-3" />
              {formatStatus(order.paymentStatus)}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {order.status === "ready" && (
            <Button
              className="h-11 w-full cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
              disabled={markingServed}
              onClick={onMarkServed}
            >
              <UtensilsCrossed className="size-4" />
              {markingServed ? "Marking served..." : "Mark served"}
            </Button>
          )}

          <Button
            className="h-11 w-full cursor-pointer rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
            onClick={onOpen}
          >
            <Eye className="size-4" />
            Open order
          </Button>
        </div>
      </div>
    </article>
  )
}

export function WaiterOrdersPage({ user, onLogout }: WaiterOrdersPageProps) {
  const navigate = useNavigate()
  const orderStatusesRef = useRef(new Map<string, string>())

  const [orders, setOrders] = useState<DraftOrder[]>([])
  const [historyOrders, setHistoryOrders] = useState<DraftOrder[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStatus, setHistoryStatus] =
    useState<WaiterOrderHistoryStatus>("all")
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 9,
    totalOrders: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  })

  const [view, setView] = useState<OrderView>("active")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [serveTarget, setServeTarget] = useState<DraftOrder | null>(null)
  const [servingId, setServingId] = useState("")

  const loadOrders = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      try {
        const result = await getMyOrders(historyPage, historyStatus)

        setOrders(result.orders)
        setHistoryOrders(result.historyOrders)
        setHistoryPagination(result.historyPagination)

        orderStatusesRef.current = new Map(
          [...result.orders, ...result.historyOrders].map((order) => [
            order._id,
            order.status,
          ])
        )
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Could not load orders"

        setError(message)

        toast.error(message, {
          id: "waiter-orders-load-error",
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [historyPage, historyStatus]
  )

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const handleOrderUpdated = (updatedOrder: DraftOrder) => {
      const previousStatus = orderStatusesRef.current.get(updatedOrder._id)

      orderStatusesRef.current.set(updatedOrder._id, updatedOrder.status)

      if (user.sharedHub) {
        void loadOrders(true)
        return
      }

      if (!previousStatus) {
        if (activeOrderStatuses.includes(updatedOrder.status)) {
          toast.info(`New order: ${updatedOrder.orderNumber}`, {
            id: `waiter-order-new-${updatedOrder._id}`,
            description: updatedOrder.tableName || "Takeaway order",
          })
        }
      } else if (previousStatus !== updatedOrder.status) {
        if (updatedOrder.status === "ready") {
          toast.success(`${updatedOrder.orderNumber} is ready`, {
            id: `waiter-order-ready-${updatedOrder._id}`,
            description: `${
              updatedOrder.tableName || "Takeaway order"
            } is ready for collection.`,
          })
        } else {
          toast.info(`${updatedOrder.orderNumber} updated`, {
            id: `waiter-order-${updatedOrder._id}-${updatedOrder.status}`,
            description: `Order moved from ${formatStatus(
              previousStatus
            )} to ${formatStatus(updatedOrder.status)}.`,
          })
        }
      }

      void loadOrders(true)
    }

    socket.on("order:updated", handleOrderUpdated)

    return () => {
      socket.off("order:updated", handleOrderUpdated)
    }
  }, [loadOrders, user.sharedHub])

  useEffect(() => {
    if (!user.sharedHub) return

    const timer = window.setInterval(() => {
      void loadOrders(true)
    }, 20000)

    return () => {
      window.clearInterval(timer)
    }
  }, [loadOrders, user.sharedHub])

  const summary = useMemo(() => {
    return {
      total: orders.length,
      drafts: orders.filter((order) =>
        ["draft", "awaiting_payment"].includes(order.status)
      ).length,
      active: orders.filter((order) =>
        ["submitted", "accepted", "preparing", "ready", "served"].includes(
          order.status
        )
      ).length,
      ready: orders.filter((order) => order.status === "ready").length,
      awaitingPayment: orders.filter(
        (order) => order.status === "served" && order.paymentStatus !== "paid"
      ).length,
    }
  }, [orders])

  const hubStatusSummary = useMemo(() => {
    return {
      sentToKitchen: orders.filter((order) => order.status === "submitted")
        .length,
      preparing: orders.filter((order) =>
        ["accepted", "preparing"].includes(order.status)
      ).length,
      ready: orders.filter((order) => order.status === "ready").length,
      servedUnpaid: orders.filter(
        (order) => order.status === "served" && order.paymentStatus !== "paid"
      ).length,
    }
  }, [orders])

  const displayedOrders = view === "active" ? orders : historyOrders

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return displayedOrders

    return displayedOrders.filter((order) => {
      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.tableName.toLowerCase().includes(query) ||
        order.customer.name.toLowerCase().includes(query) ||
        order.items.some((item) => item.name.toLowerCase().includes(query))
      )
    })
  }, [displayedOrders, search])

  const changeView = (nextView: OrderView) => {
    setView(nextView)
    setSearch("")
  }

  const changeHistoryStatus = (status: WaiterOrderHistoryStatus) => {
    setHistoryStatus(status)
    setHistoryPage(1)
    setSearch("")
  }

  const markOrderServed = async () => {
    if (!serveTarget || servingId) return

    setServingId(serveTarget._id)
    setError("")

    try {
      const updatedOrder = await updateWaiterOrderStatus(
        serveTarget._id,
        "served"
      )

      setOrders((current) =>
        current.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      )

      setHistoryOrders((current) =>
        current.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      )

      toast.success("Order marked as served", {
        description: `${updatedOrder.orderNumber} is now awaiting payment or completion.`,
      })

      setServeTarget(null)
      void loadOrders(true)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not mark order as served"

      setError(message)
      toast.error(message)
    } finally {
      setServingId("")
    }
  }

  return (
    <WaiterShell
      user={user}
      onLogout={onLogout}
      active="orders"
      title="My orders"
      description="Track drafts, preparation, payment, and service."
      icon={<ReceiptText className="size-6" />}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-col gap-4"
    >
      <Dialog
        open={Boolean(serveTarget)}
        onOpenChange={(open) => {
          if (!open && !servingId) {
            setServeTarget(null)
          }
        }}
      >
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                <UtensilsCrossed className="size-5" />
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                Mark order as served?
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                This will move{" "}
                <strong className="text-neutral-900">
                  {serveTarget?.orderNumber}
                </strong>{" "}
                to served. Payment can still be collected afterwards.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 cursor-pointer rounded-xl"
                variant="outline"
                disabled={Boolean(servingId)}
                onClick={() => setServeTarget(null)}
              >
                Cancel
              </Button>

              <Button
                className="h-12 cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                disabled={Boolean(servingId)}
                onClick={() => void markOrderServed()}
              >
                {servingId ? "Marking served..." : "Mark served"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {error && (
        <p className="shrink-0 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <OrdersToolbarSkeleton />
      ) : (
        <section className="shrink-0 rounded-[20px] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex max-w-full items-center gap-1 rounded-xl bg-neutral-100 p-1"
              role="tablist"
              aria-label="Order views"
            >
              <Button
                type="button"
                role="tab"
                aria-selected={view === "active"}
                className={`h-9 cursor-pointer rounded-lg px-3 ${
                  view === "active"
                    ? "bg-[#047857] text-white shadow-sm hover:bg-[#065F46] hover:text-white"
                    : "bg-transparent text-neutral-500 hover:bg-white hover:text-neutral-950"
                }`}
                variant="ghost"
                onClick={() => changeView("active")}
              >
                <Clock3 className="size-4" />
                Active
                <span
                  className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    view === "active"
                      ? "bg-white/20 text-white"
                      : "bg-white text-neutral-700"
                  }`}
                >
                  {orders.length}
                </span>
              </Button>

              <Button
                type="button"
                role="tab"
                aria-selected={view === "history"}
                className={`h-9 cursor-pointer rounded-lg px-3 ${
                  view === "history"
                    ? "bg-neutral-950 text-white shadow-sm hover:bg-neutral-800 hover:text-white"
                    : "bg-transparent text-neutral-500 hover:bg-white hover:text-neutral-950"
                }`}
                variant="ghost"
                onClick={() => changeView("history")}
              >
                <History className="size-4" />
                History
                <span
                  className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    view === "history"
                      ? "bg-white/20 text-white"
                      : "bg-white text-neutral-700"
                  }`}
                >
                  {historyPagination.totalOrders}
                </span>
              </Button>
            </div>

            {view === "active" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 cursor-pointer rounded-xl"
                  >
                    <SlidersHorizontal className="size-4" />
                    Queue details
                    {summary.awaitingPayment > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700">
                        {summary.awaitingPayment}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-72 rounded-2xl border-neutral-200 p-3"
                  align="start"
                >
                  <div className="px-1 pb-3">
                    <p className="font-black">Queue details</p>

                    <p className="text-xs text-neutral-400">
                      Current active order breakdown
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-neutral-100 px-3 py-2.5">
                      <span className="text-sm text-neutral-600">Drafts</span>
                      <span className="font-black">{summary.drafts}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2.5">
                      <span className="text-sm text-blue-700">In progress</span>
                      <span className="font-black text-blue-700">
                        {summary.active}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
                      <span className="text-sm text-emerald-700">Ready</span>
                      <span className="font-black text-emerald-700">
                        {summary.ready}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                        summary.awaitingPayment > 0
                          ? "bg-red-50"
                          : "bg-neutral-100"
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          summary.awaitingPayment > 0
                            ? "text-red-700"
                            : "text-neutral-600"
                        }`}
                      >
                        Awaiting payment
                      </span>

                      <span
                        className={`font-black ${
                          summary.awaitingPayment > 0
                            ? "text-red-700"
                            : "text-neutral-950"
                        }`}
                      >
                        {summary.awaitingPayment}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Select
                value={historyStatus}
                onValueChange={(value) =>
                  changeHistoryStatus(value as WaiterOrderHistoryStatus)
                }
              >
                <SelectTrigger className="h-10 w-36 cursor-pointer rounded-xl border-neutral-200 bg-white shadow-none">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All history</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="relative order-last w-full min-w-0 sm:order-none sm:ml-auto sm:w-64 lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />

              <Input
                className="h-10 rounded-xl border-0 bg-neutral-100 pl-9 shadow-none"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  view === "active"
                    ? "Search active orders..."
                    : "Search this history page..."
                }
              />
            </div>

            <div
              className="ml-auto flex shrink-0 items-center gap-2 px-2 text-xs font-semibold text-emerald-700 sm:ml-0"
              title={refreshing ? "Updating orders" : "Receiving live updates"}
            >
              <span
                className={`size-2 rounded-full bg-emerald-500 ${
                  refreshing ? "animate-pulse" : ""
                }`}
              />

              <span className="hidden lg:inline">
                {refreshing ? "Updating" : "Live"}
              </span>
            </div>

            {user.sharedHub && view === "active" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 h-9 w-fit cursor-pointer rounded-full border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    <ChefHat className="size-3.5" />
                    Kitchen status
                    {hubStatusSummary.ready > 0 && (
                      <span className="ml-1 flex min-w-5 items-center justify-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                        {hubStatusSummary.ready}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-72 rounded-2xl border-neutral-200 p-3"
                  align="start"
                >
                  <div className="px-1 pb-3">
                    <p className="font-black">Hub kitchen status</p>
                    <p className="text-xs text-neutral-400">
                      Quiet overview of active orders
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2.5">
                      <span className="text-sm font-semibold text-blue-700">
                        Sent to kitchen
                      </span>
                      <span className="font-black text-blue-700">
                        {hubStatusSummary.sentToKitchen}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                      <span className="text-sm font-semibold text-amber-700">
                        Preparing
                      </span>
                      <span className="font-black text-amber-700">
                        {hubStatusSummary.preparing}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
                      <span className="text-sm font-semibold text-emerald-700">
                        Ready
                      </span>
                      <span className="font-black text-emerald-700">
                        {hubStatusSummary.ready}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                        hubStatusSummary.servedUnpaid > 0
                          ? "bg-red-50"
                          : "bg-neutral-100"
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold ${
                          hubStatusSummary.servedUnpaid > 0
                            ? "text-red-700"
                            : "text-neutral-600"
                        }`}
                      >
                        Served unpaid
                      </span>
                      <span
                        className={`font-black ${
                          hubStatusSummary.servedUnpaid > 0
                            ? "text-red-700"
                            : "text-neutral-700"
                        }`}
                      >
                        {hubStatusSummary.servedUnpaid}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </section>
      )}

      <section className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <OrderCardsSkeleton />
        ) : filteredOrders.length > 0 ? (
          <>
            <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  showWaiterName={Boolean(user.sharedHub)}
                  markingServed={servingId === order._id}
                  onMarkServed={() => setServeTarget(order)}
                  onOpen={() => navigate(`/waiter/orders/${order._id}`)}
                />
              ))}
            </div>

            {view === "history" && historyPagination.totalOrders > 0 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-[20px] bg-white p-4 sm:flex-row">
                <p className="text-sm text-neutral-400">
                  Page {historyPagination.page} of{" "}
                  {Math.max(historyPagination.totalPages, 1)}
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 cursor-pointer rounded-xl"
                    disabled={
                      loading ||
                      refreshing ||
                      !historyPagination.hasPreviousPage
                    }
                    onClick={() =>
                      setHistoryPage((currentPage) =>
                        Math.max(1, currentPage - 1)
                      )
                    }
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 cursor-pointer rounded-xl"
                    disabled={
                      loading || refreshing || !historyPagination.hasNextPage
                    }
                    onClick={() =>
                      setHistoryPage((currentPage) => currentPage + 1)
                    }
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-full items-center justify-center rounded-[24px] border border-dashed border-neutral-200 bg-white p-8 text-center">
            <div>
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-100">
                {view === "active" ? (
                  <ShoppingBag className="size-7 text-neutral-400" />
                ) : (
                  <History className="size-7 text-neutral-400" />
                )}
              </div>

              <h2 className="mt-5 text-xl font-black">
                {search
                  ? "No matching orders"
                  : view === "active"
                    ? "No active orders"
                    : "No order history"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">
                {search
                  ? "Try searching by a different order number, table, customer, or item."
                  : view === "active"
                    ? "Drafts and active orders will appear here when you begin serving customers."
                    : "Completed and cancelled orders will appear here."}
              </p>

              {view === "active" && orders.length === 0 && !search && (
                <Button
                  className="mt-6 cursor-pointer rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                  onClick={() => navigate("/waiter")}
                >
                  <Plus className="size-4" />
                  Create an order
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </WaiterShell>
  )
}
