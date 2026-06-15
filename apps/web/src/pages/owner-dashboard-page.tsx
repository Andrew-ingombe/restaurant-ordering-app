import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  LogOut,
  QrCode,
  ReceiptText,
  TrendingUp,
  Users,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { getDashboardSummary } from "../lib/api"
import type { AuthUser, DashboardSummary } from "../lib/api"
import { getSocket } from "../lib/socket"

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

const statusStyles: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700",
  accepted: "bg-violet-50 text-violet-700",
  preparing: "bg-amber-50 text-amber-700",
  ready: "bg-emerald-50 text-emerald-700",
  served: "bg-cyan-50 text-cyan-700",
  completed: "bg-neutral-900 text-white",
  cancelled: "bg-red-50 text-red-700",
}

export function OwnerDashboardPage({
  user,
  onLogout,
}: OwnerDashboardPageProps) {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDashboard = async (date?: string) => {
    setLoading(true)
    setError("")

    try {
      const result = await getDashboardSummary(date)

      setDashboard(result)

      if (!selectedDate) {
        setSelectedDate(result.date)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load dashboard"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const refreshDashboard = () => {
      void loadDashboard(selectedDate || undefined)
    }

    socket.on("order:updated", refreshDashboard)

    return () => {
      socket.off("order:updated", refreshDashboard)
    }
  }, [selectedDate])

  const navigation = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      active: true,
      action: () => navigate("/owner"),
    },
    {
      label: "Menu",
      icon: UtensilsCrossed,
      action: () => navigate("/owner/menu"),
    },
    {
      label: "Staff",
      icon: Users,
      action: () => navigate("/owner/staff"),
    },
    {
      label: "Tables & QR",
      icon: QrCode,
      action: () => navigate("/owner/tables"),
    },
  ]

  const summaryCards = dashboard
    ? [
        {
          label: "Total sales",
          value: formatPrice(dashboard.summary.totalSales),
          icon: TrendingUp,
          featured: true,
        },
        {
          label: "Paid orders",
          value: dashboard.summary.paidOrders,
          icon: WalletCards,
        },
        {
          label: "Completed",
          value: dashboard.summary.completedOrders,
          icon: CheckCircle2,
        },
        {
          label: "Active orders",
          value: dashboard.summary.activeOrders,
          icon: Clock3,
        },
        {
          label: "Average order",
          value: formatPrice(dashboard.summary.averageOrderValue),
          icon: ReceiptText,
        },
      ]
    : []

  return (
    <main className="min-h-svh">
      <div className="mx-auto flex min-h-[calc(100svh-24px)] max-w-[1600px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-black/5 bg-white p-5 lg:flex">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#ef1428] text-white">
              <UtensilsCrossed className="size-5" />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight">FOODLY</p>
              <p className="text-xs text-neutral-400">Restaurant admin</p>
            </div>
          </div>

          <nav className="mt-10 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    item.active
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto rounded-2xl bg-neutral-100 p-4">
            <p className="font-semibold">{user.name}</p>
            <p className="mt-1 text-xs text-neutral-500 capitalize">
              {user.role} account
            </p>

            <div>
              <Button
                className="mt-4 w-full rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                Change password
              </Button>

              <Button
                className="mt-4 w-full rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  Restaurant overview
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  Good day, {user.name.split(" ")[0]}
                </h1>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="dashboard-date"
                    type="date"
                    className="h-11 rounded-xl border-0 bg-neutral-100 pl-10 shadow-none"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                </div>

                <Button
                  className="h-11 rounded-xl bg-[#ef1428] px-5 text-white hover:bg-[#d91023]"
                  disabled={loading}
                  onClick={() => void loadDashboard(selectedDate || undefined)}
                >
                  {loading ? "Loading..." : "View report"}
                </Button>

                <Button
                  className="size-11 rounded-xl lg:hidden"
                  size="icon"
                  variant="outline"
                  onClick={onLogout}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigation.map((item) => {
                const Icon = item.icon

                return (
                  <Button
                    key={item.label}
                    className="shrink-0 rounded-xl"
                    variant={item.active ? "default" : "outline"}
                    onClick={item.action}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </header>

          <div className="space-y-6 p-4 md:p-7">
            {error && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            {loading && !dashboard ? (
              <div className="flex min-h-96 items-center justify-center">
                <p className="text-sm text-neutral-500">Loading dashboard...</p>
              </div>
            ) : dashboard ? (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {summaryCards.map((card) => {
                    const Icon = card.icon

                    return (
                      <div
                        key={card.label}
                        className={`rounded-[22px] p-5 ${
                          card.featured
                            ? "bg-[#ef1428] text-white"
                            : "bg-white text-neutral-950"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-sm ${
                              card.featured
                                ? "text-white/75"
                                : "text-neutral-500"
                            }`}
                          >
                            {card.label}
                          </p>

                          <div
                            className={`flex size-9 items-center justify-center rounded-full ${
                              card.featured ? "bg-white/15" : "bg-neutral-100"
                            }`}
                          >
                            <Icon className="size-4" />
                          </div>
                        </div>

                        <p className="mt-5 text-2xl font-black tracking-tight">
                          {card.value}
                        </p>
                      </div>
                    )
                  })}
                </section>

                <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-[24px] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black">Order status</h2>
                        <p className="text-sm text-neutral-400">
                          Activity for {dashboard.date}
                        </p>
                      </div>

                      <Badge variant="secondary" className="rounded-full">
                        {dashboard.summary.paidOrders} orders
                      </Badge>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      {dashboard.statusBreakdown.map((item) => (
                        <div
                          key={item.status}
                          className="rounded-2xl border border-dashed border-neutral-200 p-4"
                        >
                          <p className="text-xs text-neutral-500 capitalize">
                            {formatStatus(item.status)}
                          </p>
                          <p className="mt-2 text-3xl font-black">
                            {item.count}
                          </p>
                        </div>
                      ))}
                    </div>

                    {dashboard.statusBreakdown.length === 0 && (
                      <div className="mt-6 rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-400">
                        No paid orders for this date.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] bg-white p-5">
                    <div>
                      <h2 className="text-lg font-black">Best-selling items</h2>
                      <p className="text-sm text-neutral-400">
                        Most popular dishes by quantity
                      </p>
                    </div>

                    <div className="mt-5 space-y-3">
                      {dashboard.bestSellingItems.map((item, index) => (
                        <div
                          key={item.menuItem}
                          className="flex items-center gap-4 rounded-2xl border border-dashed border-neutral-200 p-3"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-bold text-white">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">
                              {item.name}
                            </p>
                            <p className="text-sm text-neutral-400">
                              {item.quantity} sold
                            </p>
                          </div>

                          <p className="font-bold text-[#ef1428]">
                            {formatPrice(item.sales)}
                          </p>
                        </div>
                      ))}

                      {dashboard.bestSellingItems.length === 0 && (
                        <div className="rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-400">
                          No sales data.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[24px] bg-white">
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <div>
                      <h2 className="text-lg font-black">Recent orders</h2>
                      <p className="text-sm text-neutral-400">
                        Latest paid orders for {dashboard.date}
                      </p>
                    </div>

                    <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                      <ReceiptText className="size-4" />
                    </div>
                  </div>

                  <div className="overflow-x-auto px-3 pb-3">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead>Order</TableHead>
                          <TableHead>Table</TableHead>
                          <TableHead>Waiter</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {dashboard.recentOrders.map((order) => (
                          <TableRow
                            key={order._id}
                            className="border-neutral-100"
                          >
                            <TableCell className="font-bold">
                              {order.orderNumber}
                            </TableCell>
                            <TableCell>
                              {order.tableName || "Takeaway"}
                            </TableCell>
                            <TableCell>
                              {order.waiter?.name || "Unknown"}
                            </TableCell>
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
                            <TableCell className="text-right font-bold">
                              {formatPrice(order.total)}
                            </TableCell>
                          </TableRow>
                        ))}

                        {dashboard.recentOrders.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="h-28 text-center text-neutral-400"
                            >
                              No paid orders for this date.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
