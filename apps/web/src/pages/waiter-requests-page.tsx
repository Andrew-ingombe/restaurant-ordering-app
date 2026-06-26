import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  BellRing,
  CheckCircle2,
  Clock3,
  MonitorSmartphone,
  Phone,
  RefreshCw,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
  Search,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { WaiterShell } from "../components/waiter-shell"
import {
  claimCustomerOrderRequest,
  getActiveWaiters,
  getCustomerOrderRequests,
} from "../lib/api"
import type { AuthUser, DraftOrder, StaffUser } from "../lib/api"
import { getSocket } from "../lib/socket"

import {
  RequestCardsSkeleton,
  RequestsToolbarSkeleton,
} from "../components/page-skeletons"

type WaiterRequestsPageProps = {
  user: AuthUser
  onLogout: () => void
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

const getStaffId = (staff: StaffUser) => staff.id || staff._id || ""

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

  if (minutes >= 15) return "bg-red-50 text-red-700"
  if (minutes >= 5) return "bg-amber-50 text-amber-700"

  return "bg-emerald-50 text-emerald-700"
}

export function WaiterRequestsPage({
  user,
  onLogout,
}: WaiterRequestsPageProps) {
  const navigate = useNavigate()
  const knownRequestIdsRef = useRef(new Set<string>())

  const [requests, setRequests] = useState<DraftOrder[]>([])
  const [activeWaiters, setActiveWaiters] = useState<StaffUser[]>([])
  const [selectedWaiterId, setSelectedWaiterId] = useState("")
  const [claimingId, setClaimingId] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [, setClock] = useState(Date.now())
  const [searchQuery, setSearchQuery] = useState("")

  const loadRequests = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      setError("")

      const [customerRequests, waiters] = await Promise.all([
        getCustomerOrderRequests(),
        user.sharedHub ? getActiveWaiters() : Promise.resolve([]),
      ])

      const sortedCustomerRequests = [...customerRequests].sort(
        (firstRequest, secondRequest) =>
          new Date(secondRequest.createdAt).getTime() -
          new Date(firstRequest.createdAt).getTime()
      )

      setRequests(sortedCustomerRequests)
      setActiveWaiters(waiters)
      knownRequestIdsRef.current = new Set(
        sortedCustomerRequests.map((request) => request._id)
      )

      if (user.sharedHub && waiters.length === 1) {
        setSelectedWaiterId(getStaffId(waiters[0]))
      }

      if (showRefreshing) {
        toast.success("Customer requests refreshed")
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not load customer requests"

      setError(message)

      if (showRefreshing) {
        toast.error(message)
      }
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
      const isNew = !knownRequestIdsRef.current.has(order._id)

      knownRequestIdsRef.current.add(order._id)

      setRequests((current) => {
        const exists = current.some((request) => request._id === order._id)

        return exists ? current : [order, ...current]
      })

      if (isNew) {
        toast.info("New customer request", {
          description: `${order.orderNumber} from ${
            order.tableName || "a restaurant table"
          }.`,
        })
      }
    }

    const removeRequest = (order: DraftOrder) => {
      knownRequestIdsRef.current.delete(order._id)

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
    if (claimingId) return

    if (user.sharedHub && !selectedWaiterId) {
      const message = "Select the waiter serving this customer request"
      setError(message)
      toast.error(message)
      return
    }

    setClaimingId(orderId)
    setError("")

    try {
      const order = await claimCustomerOrderRequest(
        orderId,
        user.sharedHub ? selectedWaiterId : undefined
      )

      knownRequestIdsRef.current.delete(orderId)

      setRequests((current) =>
        current.filter((request) => request._id !== orderId)
      )

      const selectedWaiter = activeWaiters.find(
        (waiter) => getStaffId(waiter) === selectedWaiterId
      )

      toast.success("Customer request claimed", {
        description: user.sharedHub
          ? `${order.orderNumber} assigned to ${
              selectedWaiter?.name || "the selected waiter"
            }.`
          : `${order.orderNumber} is ready for your review.`,
      })

      if (user.sharedHub && activeWaiters.length !== 1) {
        setSelectedWaiterId("")
      }

      navigate(`/waiter/orders/${order._id}`)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not claim request"

      setError(message)
      toast.error(message)

      await loadRequests()
    } finally {
      setClaimingId("")
    }
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const visibleRequests = requests.filter((order) => {
    if (!normalizedSearchQuery) return true

    return (
      order.orderNumber.toLowerCase().includes(normalizedSearchQuery) ||
      order.tableName.toLowerCase().includes(normalizedSearchQuery) ||
      order.customer.name?.toLowerCase().includes(normalizedSearchQuery) ||
      order.customer.phone?.toLowerCase().includes(normalizedSearchQuery) ||
      order.items.some((item) =>
        item.name.toLowerCase().includes(normalizedSearchQuery)
      )
    )
  })

  const totalItems = visibleRequests.reduce(
    (total, order) =>
      total +
      order.items.reduce((orderTotal, item) => orderTotal + item.quantity, 0),
    0
  )

  const totalValue = visibleRequests.reduce(
    (total, order) => total + order.total,
    0
  )

  return (
    <WaiterShell
      user={user}
      onLogout={onLogout}
      active="requests"
      title="Customer requests"
      eyebrow="QR ordering"
      description={
        user.sharedHub
          ? "Assign customer selections to the waiter serving the table."
          : "Review and claim customer menu selections."
      }
      icon={<BellRing className="size-6" />}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-col gap-4"
    >
      {loading ? (
        <RequestsToolbarSkeleton />
      ) : (
        <section className="shrink-0 rounded-[20px] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="flex h-10 items-center rounded-xl border-0 bg-[#047857] px-4 text-sm font-semibold text-white">
              <BellRing className="size-4" />
              {requests.length} waiting
            </Badge>

            <Badge className="flex h-10 items-center rounded-xl border-0 bg-neutral-100 px-4 text-sm font-semibold text-neutral-700">
              <ShoppingBag className="size-4" />
              {totalItems} menu items
            </Badge>

            <Badge className="flex h-10 items-center rounded-xl border-0 bg-[#ECFDF5] px-4 text-sm font-semibold text-[#047857]">
              {formatPrice(totalValue)} request value
            </Badge>

            {user.sharedHub && (
              <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 sm:max-w-sm">
                <MonitorSmartphone className="size-4 shrink-0 text-[#047857]" />

                <div className="min-w-0 flex-1">
                  <Label className="sr-only">Served by waiter</Label>

                  <Select
                    value={selectedWaiterId}
                    onValueChange={(value) => {
                      setSelectedWaiterId(value)
                      setError("")
                    }}
                    disabled={activeWaiters.length === 0}
                  >
                    <SelectTrigger className="h-9 w-full rounded-lg border-0 bg-white px-3 text-sm shadow-none">
                      <SelectValue
                        placeholder={
                          activeWaiters.length === 0
                            ? "No active waiters"
                            : "Served by waiter"
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
                </div>
              </div>
            )}

            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

              <input
                className="h-10 w-full cursor-text rounded-xl border-0 bg-neutral-100 pr-4 pl-11 text-sm outline-none placeholder:text-neutral-400"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search requests"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-2 px-2 text-xs font-semibold text-emerald-700">
                <span
                  className={`size-2 rounded-full bg-emerald-500 ${
                    refreshing ? "animate-pulse" : ""
                  }`}
                />

                <span className="hidden sm:inline">
                  {refreshing ? "Updating" : "Live"}
                </span>
              </div>

              <Button
                className="h-10 cursor-pointer rounded-xl"
                variant="outline"
                disabled={refreshing}
                onClick={() => void loadRequests(true)}
              >
                <RefreshCw
                  className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                />

                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="min-h-0 flex-1 overflow-y-auto pr-1">
        {error && (
          <p className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <RequestCardsSkeleton />
        ) : visibleRequests.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRequests.map((order) => {
              const orderItemCount = order.items.reduce(
                (total, item) => total + item.quantity,
                0
              )

              return (
                <article
                  key={order._id}
                  className="flex h-full flex-col rounded-[20px] border border-neutral-100 bg-white p-4 transition hover:border-neutral-200 hover:bg-neutral-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.16em] text-[#047857] uppercase">
                        {order.tableName}
                      </p>

                      <h2 className="mt-1 truncate text-lg font-black">
                        {order.orderNumber}
                      </h2>
                    </div>

                    <Badge
                      className={`shrink-0 rounded-full border-0 ${getAgeStyle(
                        order.createdAt
                      )}`}
                    >
                      <Clock3 className="size-3" />
                      {getRequestAge(order.createdAt)}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-100 p-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                      <UserRound className="size-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {order.customer.name || "Guest customer"}
                      </p>

                      {order.customer.phone ? (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-neutral-500">
                          <Phone className="size-3 shrink-0" />
                          {order.customer.phone}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-neutral-400">
                          No phone number provided
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex-1 space-y-2">
                    {order.items.slice(0, 3).map((item, index) => (
                      <div
                        key={`${item.menuItem}-${index}`}
                        className="rounded-xl border border-neutral-100 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-black text-white">
                            {item.quantity}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 font-bold break-words">
                                {item.name}
                              </p>

                              <p className="shrink-0 font-semibold text-[#047857]">
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

                    {order.items.length > 3 && (
                      <p className="px-2 text-xs text-neutral-400">
                        +{order.items.length - 3} more menu{" "}
                        {order.items.length - 3 === 1 ? "item" : "items"}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                    <div>
                      <p className="text-xs text-neutral-400">
                        {orderItemCount}{" "}
                        {orderItemCount === 1 ? "item" : "items"}
                      </p>

                      <p className="mt-1 text-lg font-black text-[#047857]">
                        {formatPrice(order.total)}
                      </p>
                    </div>

                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-full"
                    >
                      Waiting
                    </Badge>
                  </div>

                  <Button
                    className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                    disabled={
                      Boolean(claimingId) ||
                      (user.sharedHub &&
                        (!selectedWaiterId || activeWaiters.length === 0))
                    }
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
                </article>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-full items-center justify-center rounded-[24px] bg-white p-8 text-center">
            <div>
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-7" />
              </div>

              <h2 className="mt-5 text-xl font-black">
                {searchQuery ? "No matching requests" : "All caught up"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">
                {searchQuery
                  ? "Try searching by order number, table, customer, phone, or item name."
                  : "No customer QR requests are waiting. New requests will appear here automatically."}
              </p>

              {searchQuery ? (
                <Button
                  className="mt-6 h-12 cursor-pointer rounded-xl"
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              ) : (
                <Button
                  className="mt-6 h-12 cursor-pointer rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                  onClick={() => navigate("/waiter")}
                >
                  <UtensilsCrossed className="size-4" />
                  Create a waiter order
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </WaiterShell>
  )
}
