import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BellRing,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { claimCustomerOrderRequest, getCustomerOrderRequests } from "../lib/api"
import type { DraftOrder } from "../lib/api"
import { getSocket } from "../lib/socket"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

const getRequestAge = (createdAt: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )

  if (minutes < 1) return "Just now"
  if (minutes === 1) return "1 min ago"
  if (minutes < 60) return `${minutes} mins ago`

  const hours = Math.floor(minutes / 60)

  return `${hours}h ${minutes % 60}m ago`
}

const getAgeStyle = (createdAt: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )

  if (minutes >= 15) {
    return "bg-red-50 text-red-700"
  }

  if (minutes >= 5) {
    return "bg-amber-50 text-amber-700"
  }

  return "bg-emerald-50 text-emerald-700"
}

export function WaiterRequestsPage() {
  const navigate = useNavigate()

  const [requests, setRequests] = useState<DraftOrder[]>([])
  const [claimingId, setClaimingId] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [, setClock] = useState(Date.now())

  const loadRequests = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      setError("")
      setRequests(await getCustomerOrderRequests())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load customer requests"
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadRequests()

    const timer = window.setInterval(() => {
      setClock(Date.now())
    }, 60000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const addRequest = (order: DraftOrder) => {
      setRequests((current) => {
        const exists = current.some((request) => request._id === order._id)

        return exists ? current : [...current, order]
      })
    }

    const removeRequest = (order: DraftOrder) => {
      setRequests((current) =>
        current.filter((request) => request._id !== order._id)
      )
    }

    socket.on("order:customer-requested", addRequest)
    socket.on("order:customer-claimed", removeRequest)

    return () => {
      socket.off("order:customer-requested", addRequest)
      socket.off("order:customer-claimed", removeRequest)
    }
  }, [])

  const claimRequest = async (orderId: string) => {
    setClaimingId(orderId)
    setError("")

    try {
      const order = await claimCustomerOrderRequest(orderId)
      navigate(`/waiter/orders/${order._id}`)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not claim request"
      )

      await loadRequests()
    } finally {
      setClaimingId("")
    }
  }

  const totalItems = requests.reduce(
    (total, order) =>
      total +
      order.items.reduce((orderTotal, item) => orderTotal + item.quantity, 0),
    0
  )

  const totalValue = requests.reduce((total, order) => total + order.total, 0)

  return (
    <main className="min-h-svh">
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-[1600px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex size-12 items-center justify-center rounded-2xl bg-[#ef1428] text-white">
                <BellRing className="size-6" />

                {requests.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-neutral-950 text-[10px] font-black text-white">
                    {requests.length}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  QR ordering
                </p>
                <h1 className="text-2xl font-black tracking-tight">
                  Customer requests
                </h1>
                <p className="text-sm text-neutral-400">
                  Review and claim customer menu selections.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="hidden items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 sm:flex">
                <span className="size-2 rounded-full bg-emerald-500" />
                Live updates
              </div>

              <Button
                className="h-11 rounded-xl"
                variant="outline"
                disabled={refreshing}
                onClick={() => void loadRequests(true)}
              >
                <RefreshCw
                  className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                className="h-11 rounded-xl"
                variant="outline"
                onClick={() => navigate("/waiter/orders")}
              >
                <ClipboardList className="size-4" />
                My orders
              </Button>

              <Button
                className="h-11 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                onClick={() => navigate("/waiter")}
              >
                <Plus className="size-4" />
                New order
              </Button>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4 md:p-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] bg-[#ef1428] p-5 text-white">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/75">Waiting requests</p>
                <BellRing className="size-4" />
              </div>

              <p className="mt-5 text-3xl font-black">{requests.length}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">Menu items</p>
                <ShoppingBag className="size-4 text-neutral-400" />
              </div>

              <p className="mt-5 text-3xl font-black">{totalItems}</p>
            </div>

            <div className="rounded-[22px] bg-white p-5">
              <p className="text-sm text-neutral-500">Request value</p>
              <p className="mt-5 text-2xl font-black text-[#ef1428]">
                {formatPrice(totalValue)}
              </p>
            </div>
          </section>

          {error && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex min-h-96 items-center justify-center rounded-[24px] bg-white">
              <div className="text-center">
                <RefreshCw className="mx-auto size-6 animate-spin text-[#ef1428]" />
                <p className="mt-3 text-sm text-neutral-400">
                  Loading customer requests...
                </p>
              </div>
            </div>
          ) : requests.length > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {requests.map((order) => {
                const orderItemCount = order.items.reduce(
                  (total, item) => total + item.quantity,
                  0
                )

                return (
                  <article
                    key={order._id}
                    className="overflow-hidden rounded-[24px] bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="h-2 bg-[#ef1428]" />

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                            {order.tableName}
                          </p>
                          <h2 className="mt-1 text-lg font-black">
                            {order.orderNumber}
                          </h2>
                        </div>

                        <Badge
                          className={`rounded-full border-0 ${getAgeStyle(
                            order.createdAt
                          )}`}
                        >
                          <Clock3 className="size-3" />
                          {getRequestAge(order.createdAt)}
                        </Badge>
                      </div>

                      <div className="mt-4 rounded-2xl bg-neutral-100 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-neutral-950 text-white">
                            <UserRound className="size-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-bold">
                              {order.customer.name || "Guest customer"}
                            </p>

                            {order.customer.phone ? (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                                <Phone className="size-3" />
                                {order.customer.phone}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-neutral-400">
                                No phone number provided
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {order.items.map((item, index) => (
                          <div
                            key={`${item.menuItem}-${index}`}
                            className="rounded-xl border border-neutral-100 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-black text-white">
                                {item.quantity}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between gap-3">
                                  <p className="font-bold">{item.name}</p>
                                  <p className="shrink-0 font-semibold text-[#ef1428]">
                                    {formatPrice(item.lineTotal)}
                                  </p>
                                </div>

                                {item.notes && (
                                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                                    <span className="font-bold">Note:</span>{" "}
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
                        <div>
                          <p className="text-xs text-neutral-400">
                            {orderItemCount}{" "}
                            {orderItemCount === 1 ? "item" : "items"}
                          </p>
                          <p className="mt-1 text-xl font-black">
                            {formatPrice(order.total)}
                          </p>
                        </div>

                        <Badge variant="secondary" className="rounded-full">
                          Waiting
                        </Badge>
                      </div>

                      <Button
                        className="mt-4 h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                        disabled={claimingId === order._id}
                        onClick={() => void claimRequest(order._id)}
                      >
                        {claimingId === order._id ? (
                          <>
                            <RefreshCw className="size-4 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-4" />
                            Claim and review
                          </>
                        )}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </section>
          ) : (
            <section className="rounded-[24px] bg-white p-14 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-7" />
              </div>

              <h2 className="mt-5 text-xl font-black">All caught up</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">
                No customer QR requests are waiting. New requests will appear
                here automatically.
              </p>

              <Button
                className="mt-6 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                onClick={() => navigate("/waiter")}
              >
                <UtensilsCrossed className="size-4" />
                Create a waiter order
              </Button>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
