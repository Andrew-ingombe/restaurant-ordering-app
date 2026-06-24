import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Clock3,
  CreditCard,
  QrCode,
  ReceiptText,
  Smartphone,
  TrendingUp,
  WalletCards,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { OwnerShell } from "../components/owner-shell"
import { getDashboardSummary } from "../lib/api"
import type { AuthUser, DashboardSummary, DraftOrder } from "../lib/api"
import { getSocket } from "../lib/socket"
import { DashboardPageSkeleton } from "../components/page-skeletons"

type OwnerDashboardPageProps = {
  user: AuthUser
  onLogout: () => void
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(amount / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

const formatPaymentMethod = (method?: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    card_pos: "Card POS",
    manual_mobile_money: "Mobile money",
    lenco: "Lenco",
    unrecorded: "Unrecorded",
  }

  return method ? labels[method] || formatStatus(method) : ""
}

const statusStyles: Record<string, string> = {
  awaiting_waiter: "bg-orange-50 text-orange-700",
  awaiting_payment: "bg-amber-50 text-amber-700",
  submitted: "bg-blue-50 text-blue-700",
  accepted: "bg-violet-50 text-violet-700",
  preparing: "bg-amber-50 text-amber-700",
  ready: "bg-emerald-50 text-emerald-700",
  served: "bg-cyan-50 text-cyan-700",
  completed: "bg-neutral-900 text-white",
  cancelled: "bg-red-50 text-red-700",
}

const paymentStatusStyles: Record<string, string> = {
  unpaid: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-purple-50 text-purple-700",
}

const paymentMethodConfig = {
  cash: {
    label: "Cash",
    icon: Banknote,
  },
  card_pos: {
    label: "Card POS",
    icon: CreditCard,
  },
  manual_mobile_money: {
    label: "Mobile money",
    icon: Smartphone,
  },
  lenco: {
    label: "Lenco",
    icon: WalletCards,
  },
  unrecorded: {
    label: "Unrecorded",
    icon: CircleAlert,
  },
}

const liveFlowConfig = [
  {
    status: "awaiting_waiter",
    label: "QR requests",
    helper: "Waiting for waiter",
    icon: QrCode,
    className: "bg-orange-50 text-orange-700",
  },
  {
    status: "awaiting_payment",
    label: "Awaiting payment",
    helper: "Ready to collect",
    icon: WalletCards,
    className: "bg-amber-50 text-amber-700",
  },
  {
    status: "submitted",
    label: "Sent to kitchen",
    helper: "New kitchen orders",
    icon: ReceiptText,
    className: "bg-blue-50 text-blue-700",
  },
  {
    status: "accepted",
    label: "Accepted",
    helper: "Kitchen accepted",
    icon: CheckCircle2,
    className: "bg-violet-50 text-violet-700",
  },
  {
    status: "preparing",
    label: "Preparing",
    helper: "Being prepared",
    icon: ChefHat,
    className: "bg-amber-50 text-amber-700",
  },
  {
    status: "ready",
    label: "Ready",
    helper: "Ready to serve",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700",
  },
  {
    status: "served",
    label: "Served",
    helper: "Awaiting closeout",
    icon: UtensilsCrossed,
    className: "bg-cyan-50 text-cyan-700",
  },
]

const parseDate = (value: string) => {
  if (!value) return undefined

  const [year, month, day] = value.split("-").map(Number)

  return new Date(year, month - 1, day)
}

const serializeDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const formatSelectedDate = (value: string) => {
  const date = parseDate(value)

  if (!date) return "Select date"

  return new Intl.DateTimeFormat("en-ZM", {
    dateStyle: "medium",
  }).format(date)
}

export function OwnerDashboardPage({
  user,
  onLogout,
}: OwnerDashboardPageProps) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)

  const orderStatesRef = useRef(
    new Map<
      string,
      {
        status: string
        paymentStatus: string
      }
    >()
  )

  const loadDashboard = async (date?: string, showSkeleton = true) => {
    if (showSkeleton) {
      setLoading(true)
    }

    setError("")

    try {
      const result = await getDashboardSummary(date)

      setDashboard(result)

      for (const order of result.recentOrders) {
        orderStatesRef.current.set(order._id, {
          status: order.status,
          paymentStatus: order.paymentStatus,
        })
      }

      if (!selectedDate) {
        setSelectedDate(result.date)
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not load dashboard"

      setError(message)
      toast.error(message)
    } finally {
      if (showSkeleton) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const refreshDashboard = () => {
      void loadDashboard(selectedDate || undefined, false)
    }

    const handleOrderUpdated = (updatedOrder: DraftOrder) => {
      const previousState = orderStatesRef.current.get(updatedOrder._id)

      orderStatesRef.current.set(updatedOrder._id, {
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
      })

      const statusChanged =
        !previousState || previousState.status !== updatedOrder.status

      const paymentChanged =
        !previousState ||
        previousState.paymentStatus !== updatedOrder.paymentStatus

      if (statusChanged && updatedOrder.status === "submitted") {
        toast.info(`New order: ${updatedOrder.orderNumber}`, {
          id: `owner-order-${updatedOrder._id}-submitted`,
          description: `${
            updatedOrder.tableName || "Takeaway"
          } has been sent to the kitchen.`,
        })
      }

      if (statusChanged && updatedOrder.status === "ready") {
        toast.success(`${updatedOrder.orderNumber} is ready`, {
          id: `owner-order-${updatedOrder._id}-ready`,
          description: `${
            updatedOrder.tableName || "Takeaway"
          } is ready for collection.`,
        })
      }

      if (
        statusChanged &&
        updatedOrder.status === "served" &&
        updatedOrder.paymentStatus !== "paid"
      ) {
        toast.warning(`${updatedOrder.orderNumber} awaits payment`, {
          id: `owner-order-${updatedOrder._id}-served-unpaid`,
          description: `${formatPrice(updatedOrder.total)} is still outstanding.`,
        })
      }

      if (paymentChanged && updatedOrder.paymentStatus === "paid") {
        toast.success(`Payment received`, {
          id: `owner-payment-${updatedOrder._id}-paid`,
          description: `${updatedOrder.orderNumber}: ${formatPrice(
            updatedOrder.total
          )}.`,
        })
      }

      refreshDashboard()
    }

    const handleCustomerRequest = (requestedOrder: DraftOrder) => {
      const alreadyKnown = orderStatesRef.current.has(requestedOrder._id)

      orderStatesRef.current.set(requestedOrder._id, {
        status: requestedOrder.status,
        paymentStatus: requestedOrder.paymentStatus,
      })

      if (!alreadyKnown) {
        toast.info("New customer QR request", {
          id: `owner-qr-request-${requestedOrder._id}`,
          description: `${requestedOrder.orderNumber} from ${
            requestedOrder.tableName || "a restaurant table"
          }.`,
        })
      }

      refreshDashboard()
    }

    socket.on("order:updated", handleOrderUpdated)
    socket.on("order:customer-requested", handleCustomerRequest)

    return () => {
      socket.off("order:updated", handleOrderUpdated)
      socket.off("order:customer-requested", handleCustomerRequest)
    }
  }, [selectedDate])

  const attentionItems = dashboard
    ? [
        {
          label: "Served and unpaid",
          helper:
            dashboard.attention.servedUnpaid.count > 0
              ? `${formatPrice(
                  dashboard.attention.servedUnpaid.total
                )} still to collect`
              : "No outstanding served orders",
          value: dashboard.attention.servedUnpaid.count,
          icon: WalletCards,
          needsAttention: dashboard.attention.servedUnpaid.count > 0,
        },
        {
          label: "Unclaimed QR requests",
          helper:
            dashboard.attention.unclaimedQrRequests.count > 0
              ? "Waiting for a waiter"
              : "No customer requests waiting",
          value: dashboard.attention.unclaimedQrRequests.count,
          icon: QrCode,
          needsAttention: dashboard.attention.unclaimedQrRequests.count > 0,
        },
        {
          label: "Delayed kitchen orders",
          helper: `Over ${dashboard.attention.delayedKitchenOrders.thresholdMinutes} minutes in the current stage`,
          value: dashboard.attention.delayedKitchenOrders.count,
          icon: ChefHat,
          needsAttention: dashboard.attention.delayedKitchenOrders.count > 0,
        },
        {
          label: "Payment issues",
          helper: `${dashboard.attention.pendingPayments.count} pending, ${dashboard.attention.failedPayments.count} failed`,
          value:
            dashboard.attention.pendingPayments.count +
            dashboard.attention.failedPayments.count,
          icon: AlertTriangle,
          needsAttention:
            dashboard.attention.pendingPayments.count > 0 ||
            dashboard.attention.failedPayments.count > 0,
        },
      ]
    : []

  const totalAttentionItems = attentionItems.reduce(
    (total, item) => total + item.value,
    0
  )

  const summaryCards = dashboard
    ? [
        {
          label: "Total sales",
          helper: "Paid orders only",
          value: formatPrice(dashboard.summary.totalSales),
          icon: TrendingUp,
          featured: true,
        },
        {
          label: "Average order",
          helper: "Paid orders only",
          value: formatPrice(dashboard.summary.averageOrderValue),
          icon: ReceiptText,
        },
        {
          label: "Active orders",
          helper: "Currently in progress",
          value: dashboard.summary.activeOrders,
          icon: Clock3,
        },
        {
          label: "Needs attention",
          helper: "Current operational issues",
          value: totalAttentionItems,
          icon: AlertTriangle,
        },
      ]
    : []

  const completedStatusBreakdown =
    dashboard?.statusBreakdown.filter((item) =>
      ["completed", "cancelled"].includes(item.status)
    ) || []

  const liveFlowItems = dashboard
    ? liveFlowConfig.map((item) => ({
        ...item,
        count:
          dashboard.statusBreakdown.find(
            (statusItem) => statusItem.status === item.status
          )?.count || 0,
      }))
    : []

  const totalPaymentSales = dashboard?.summary.totalSales || 0

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="dashboard"
      contentClassName="min-w-0 space-y-6"
      headerContent={
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Restaurant overview
          </p>

          <h1 className="mt-1 truncate text-2xl font-black tracking-tight md:text-3xl">
            Good day, {user.name.split(" ")[0]}
          </h1>
        </div>
      }
      headerActions={
        <>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-11 max-w-full cursor-pointer justify-start rounded-xl bg-neutral-100 px-3 font-normal hover:bg-neutral-100 sm:px-4"
              >
                <CalendarDays className="size-4 shrink-0 text-neutral-400" />

                <span
                  className={`truncate ${
                    selectedDate ? "text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {formatSelectedDate(selectedDate)}
                </span>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl border-neutral-200 p-0"
              align="start"
            >
              <Calendar
                mode="single"
                selected={parseDate(selectedDate)}
                onSelect={(date) => {
                  if (!date) return

                  setSelectedDate(serializeDate(date))
                  setCalendarOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>

          <Button
            className="h-11 cursor-pointer rounded-xl bg-[#ef1428] px-4 text-white hover:bg-[#d91023] sm:px-5"
            disabled={loading}
            onClick={() => void loadDashboard(selectedDate || undefined)}
          >
            {loading ? "Loading..." : "View report"}
          </Button>
        </>
      }
    >
      {error && (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <DashboardPageSkeleton />
      ) : dashboard ? (
        <>
          <section className="xl:sticky xl:top-0 xl:z-20 xl:-mx-6 xl:bg-[#f5f5f6]/95 xl:px-6 xl:pb-3 xl:backdrop-blur">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon

                return (
                  <div
                    key={card.label}
                    className={`min-w-0 overflow-hidden rounded-[22px] p-5 ${
                      card.featured
                        ? "bg-[#ef1428] text-white"
                        : "bg-white text-neutral-950"
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm ${
                            card.featured ? "text-white/75" : "text-neutral-500"
                          }`}
                        >
                          {card.label}
                        </p>

                        <p
                          className={`mt-1 truncate text-xs ${
                            card.featured ? "text-white/55" : "text-neutral-400"
                          }`}
                        >
                          {card.helper}
                        </p>
                      </div>

                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                          card.featured ? "bg-white/15" : "bg-neutral-100"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                    </div>

                    <p className="mt-5 text-2xl font-black tracking-tight break-words">
                      {card.value}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="min-w-0 rounded-[24px] bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                    Live operations
                  </p>

                  <h2 className="mt-1 text-lg font-black">Live order flow</h2>

                  <p className="text-sm break-words text-neutral-400">
                    Current movement across QR requests, kitchen, serving, and
                    payment for {dashboard.date}
                  </p>
                </div>

                <Badge variant="secondary" className="shrink-0 rounded-full">
                  {dashboard.summary.activeOrders} active
                </Badge>
              </div>

              <div className="mt-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {liveFlowItems.map((item) => {
                  const Icon = item.icon
                  const isActive = item.count > 0

                  return (
                    <div
                      key={item.status}
                      className={`min-w-0 overflow-hidden rounded-2xl border p-4 ${
                        isActive
                          ? "border-neutral-200 bg-white"
                          : "border-neutral-100 bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                            isActive
                              ? item.className
                              : "bg-white text-neutral-400"
                          }`}
                        >
                          <Icon className="size-4" />
                        </div>

                        <p
                          className={`text-3xl font-black ${
                            isActive ? "text-neutral-950" : "text-neutral-300"
                          }`}
                        >
                          {item.count}
                        </p>
                      </div>

                      <p className="mt-4 font-bold">{item.label}</p>

                      <p className="mt-1 text-xs leading-5 text-neutral-400">
                        {item.helper}
                      </p>
                    </div>
                  )
                })}
              </div>

              {dashboard.summary.activeOrders === 0 && (
                <div className="mt-5 rounded-2xl bg-neutral-50 p-5 text-center text-sm text-neutral-400">
                  No active orders for this date.
                </div>
              )}

              {completedStatusBreakdown.length > 0 && (
                <div className="mt-5 border-t border-neutral-100 pt-5">
                  <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400 uppercase">
                    Closed today
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {completedStatusBreakdown.map((item) => (
                      <Badge
                        key={item.status}
                        className={`border-0 capitalize ${
                          statusStyles[item.status] ||
                          "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {formatStatus(item.status)}: {item.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-[24px] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                    Action queue
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    Requires attention
                  </h2>

                  <p className="text-sm text-neutral-400">
                    Issues that may need action from you or your staff
                  </p>
                </div>

                <Badge
                  className={`shrink-0 rounded-full border-0 ${
                    totalAttentionItems > 0
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {totalAttentionItems > 0
                    ? `${totalAttentionItems} to review`
                    : "All clear"}
                </Badge>
              </div>

              <div className="mt-5 grid min-w-0 gap-3">
                {attentionItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <div
                      key={item.label}
                      className={`min-w-0 overflow-hidden rounded-2xl border p-4 ${
                        item.needsAttention
                          ? "border-red-100 bg-red-50/60"
                          : "border-neutral-100 bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                              item.needsAttention
                                ? "bg-red-100 text-red-700"
                                : "bg-white text-neutral-500"
                            }`}
                          >
                            <Icon className="size-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-bold">{item.label}</p>
                            <p className="mt-1 text-xs leading-5 text-neutral-500">
                              {item.helper}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 text-2xl font-black ${
                            item.needsAttention
                              ? "text-red-700"
                              : "text-neutral-950"
                          }`}
                        >
                          {item.value}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="grid min-w-0 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="min-w-0 overflow-hidden rounded-[24px] bg-white p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                  Payments
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Sales by payment method
                </h2>

                <p className="text-sm text-neutral-400">
                  Breakdown of the paid sales total above
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {dashboard.paymentBreakdown.map((payment) => {
                  const config = paymentMethodConfig[payment.method]
                  const Icon = config.icon
                  const percentage =
                    totalPaymentSales > 0
                      ? Math.round((payment.total / totalPaymentSales) * 100)
                      : 0

                  return (
                    <div
                      key={payment.method}
                      className="rounded-2xl border border-neutral-100 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                          <Icon className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                {config.label}
                              </p>

                              <p className="text-xs text-neutral-400">
                                {payment.count}{" "}
                                {payment.count === 1 ? "payment" : "payments"}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="font-black">
                                {formatPrice(payment.total)}
                              </p>

                              <p className="text-xs text-neutral-400">
                                {percentage}%
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-[#ef1428]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-[24px] bg-white p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                  Menu performance
                </p>

                <h2 className="mt-1 text-lg font-black">Best-selling items</h2>

                <p className="text-sm text-neutral-400">
                  Top four paid items, ranked by quantity
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {dashboard.bestSellingItems.map((item, index) => (
                  <div
                    key={item.menuItem}
                    className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-dashed border-neutral-200 p-3 sm:grid-cols-[44px_minmax(0,1fr)_auto]"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-bold text-white">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.name}</p>

                      <p className="text-sm text-neutral-400">
                        {item.quantity} sold
                      </p>
                    </div>

                    <p className="col-start-2 font-bold break-words text-[#ef1428] sm:col-start-auto sm:text-right">
                      {formatPrice(item.sales)}
                    </p>
                  </div>
                ))}

                {dashboard.bestSellingItems.length === 0 && (
                  <div className="rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-400">
                    No paid sales data.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-[24px] bg-white">
            <div className="flex min-w-0 items-start justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-lg font-black">Recent orders</h2>

                <p className="text-sm break-words text-neutral-400">
                  Five most recent operational orders for {dashboard.date}
                </p>
              </div>

              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                <ReceiptText className="size-4" />
              </div>
            </div>

            <div className="max-w-full overflow-x-auto px-3 pb-3">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead>Order</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Waiter</TableHead>
                    <TableHead>Order status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {dashboard.recentOrders.map((order) => (
                    <TableRow key={order._id} className="border-neutral-100">
                      <TableCell className="font-bold">
                        {order.orderNumber}
                      </TableCell>

                      <TableCell>{order.tableName || "Takeaway"}</TableCell>

                      <TableCell>{order.waiter?.name || "Unknown"}</TableCell>

                      <TableCell>
                        <Badge
                          className={`border-0 capitalize ${
                            statusStyles[order.status] ||
                            "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {formatStatus(order.status)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            className={`w-fit border-0 capitalize ${
                              paymentStatusStyles[order.paymentStatus] ||
                              "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            <CreditCard className="size-3" />
                            {formatStatus(order.paymentStatus)}
                          </Badge>

                          {order.paymentStatus === "paid" && (
                            <span className="text-xs text-neutral-400">
                              {formatPaymentMethod(order.paymentMethod)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-bold">
                        {formatPrice(order.total)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {dashboard.recentOrders.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-28 text-center text-neutral-400"
                      >
                        No operational orders for this date.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : null}
    </OwnerShell>
  )
}
