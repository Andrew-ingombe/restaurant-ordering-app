import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  Eye,
  FilePenLine,
  PackageCheck,
  Plus,
  ReceiptText,
  ShoppingBag,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { getMyOrders } from "../lib/api"
import type { DraftOrder } from "../lib/api"
import { getSocket } from "../lib/socket"

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
    accent: string
    icon: typeof Clock3
  }
> = {
  draft: {
    className: "bg-neutral-100 text-neutral-700",
    accent: "bg-neutral-950",
    icon: FilePenLine,
  },
  awaiting_payment: {
    className: "bg-amber-50 text-amber-700",
    accent: "bg-amber-400",
    icon: WalletCards,
  },
  submitted: {
    className: "bg-blue-50 text-blue-700",
    accent: "bg-blue-500",
    icon: ReceiptText,
  },
  accepted: {
    className: "bg-violet-50 text-violet-700",
    accent: "bg-violet-500",
    icon: CheckCircle2,
  },
  preparing: {
    className: "bg-amber-50 text-amber-700",
    accent: "bg-amber-400",
    icon: ChefHat,
  },
  ready: {
    className: "bg-emerald-50 text-emerald-700",
    accent: "bg-emerald-500",
    icon: PackageCheck,
  },
  served: {
    className: "bg-cyan-50 text-cyan-700",
    accent: "bg-cyan-500",
    icon: UtensilsCrossed,
  },
  completed: {
    className: "bg-neutral-950 text-white",
    accent: "bg-neutral-950",
    icon: CheckCircle2,
  },
  cancelled: {
    className: "bg-red-50 text-red-700",
    accent: "bg-red-500",
    icon: ReceiptText,
  },
}

const getStatusConfig = (status: string) =>
  statusConfig[status] || {
    className: "bg-neutral-100 text-neutral-700",
    accent: "bg-neutral-400",
    icon: Clock3,
  }

export function WaiterOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<DraftOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void getMyOrders()
      .then(setOrders)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load orders"
        )
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const updateOrder = (updatedOrder: DraftOrder) => {
      setOrders((current) =>
        current.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      )
    }

    socket.on("order:updated", updateOrder)

    return () => {
      socket.off("order:updated", updateOrder)
    }
  }, [])

  const summary = useMemo(() => {
    const activeStatuses = [
      "submitted",
      "accepted",
      "preparing",
      "ready",
      "served",
    ]

    return {
      total: orders.length,
      drafts: orders.filter((order) =>
        ["draft", "awaiting_payment"].includes(order.status)
      ).length,
      active: orders.filter((order) => activeStatuses.includes(order.status))
        .length,
      completed: orders.filter((order) => order.status === "completed").length,
    }
  }, [orders])

  return (
    <main className="min-h-svh">
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-[1600px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#ef1428] text-white">
                <ReceiptText className="size-6" />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  Waiter workspace
                </p>
                <h1 className="text-2xl font-black tracking-tight">
                  My orders
                </h1>
                <p className="text-sm text-neutral-400">
                  Track drafts and active restaurant orders.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => navigate("/waiter/requests")}
              >
                Customer requests
              </Button>

              <Button
                className="h-11 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                onClick={() => navigate("/waiter")}
              >
                <Plus className="size-4" />
                Create new order
              </Button>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4 md:p-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-[22px] bg-[#ef1428] p-5 text-white">
              <p className="text-sm text-white/75">All orders</p>
              <p className="mt-5 text-3xl font-black">{summary.total}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">Drafts</p>
                <FilePenLine className="size-4 text-neutral-400" />
              </div>

              <p className="mt-5 text-3xl font-black">{summary.drafts}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">Active</p>
                <Clock3 className="size-4 text-amber-500" />
              </div>

              <p className="mt-5 text-3xl font-black">{summary.active}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">Completed</p>
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>

              <p className="mt-5 text-3xl font-black">{summary.completed}</p>
            </div>
          </section>

          {error && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex min-h-96 items-center justify-center rounded-[24px] bg-white">
              <p className="text-sm text-neutral-400">Loading orders...</p>
            </div>
          ) : orders.length > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => {
                const itemCount = order.items.reduce(
                  (total, item) => total + item.quantity,
                  0
                )

                const currentStatus = getStatusConfig(order.status)
                const StatusIcon = currentStatus.icon

                return (
                  <article
                    key={order._id}
                    className="overflow-hidden rounded-[24px] bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className={`h-2 ${currentStatus.accent}`} />

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                            {order.tableName || "Takeaway"}
                          </p>

                          <h2 className="mt-1 text-lg font-black">
                            {order.orderNumber}
                          </h2>

                          <p className="mt-1 text-xs text-neutral-400">
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <Badge
                          className={`rounded-full border-0 capitalize ${currentStatus.className}`}
                        >
                          <StatusIcon className="size-3" />
                          {formatStatus(order.status)}
                        </Badge>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-neutral-100 p-3">
                          <p className="text-xs text-neutral-400">Items</p>
                          <p className="mt-1 text-xl font-black">{itemCount}</p>
                        </div>

                        <div className="rounded-2xl bg-[#fff0f1] p-3">
                          <p className="text-xs text-[#ef1428]/70">Total</p>
                          <p className="mt-1 text-lg font-black text-[#ef1428]">
                            {formatPrice(order.total)}
                          </p>
                        </div>
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

                      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
                        <div>
                          <p className="text-xs text-neutral-400">Payment</p>

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
                            {order.paymentStatus}
                          </Badge>
                        </div>

                        <p className="text-xs text-neutral-400 capitalize">
                          {formatStatus(order.orderType)}
                        </p>
                      </div>

                      <Button
                        className="mt-4 h-11 w-full rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                        onClick={() => navigate(`/waiter/orders/${order._id}`)}
                      >
                        <Eye className="size-4" />
                        View order
                      </Button>
                    </div>
                  </article>
                )
              })}
            </section>
          ) : (
            <section className="rounded-[24px] bg-white p-14 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-100">
                <ShoppingBag className="size-7 text-neutral-400" />
              </div>

              <h2 className="mt-5 text-xl font-black">No orders yet</h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">
                Your draft and active orders will appear here once you begin
                serving customers.
              </p>

              <Button
                className="mt-6 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                onClick={() => navigate("/waiter")}
              >
                <Plus className="size-4" />
                Create your first order
              </Button>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
