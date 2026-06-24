import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  ReceiptText,
  Search,
  X,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { OwnerShell } from "../components/owner-shell"
import { getOwnerOrders } from "../lib/api"
import type { AuthUser, OwnerOrderHistory, OwnerOrderStatus } from "../lib/api"

import { OwnerOrdersTableSkeleton } from "../components/page-skeletons"

type OwnerOrdersPageProps = {
  user: AuthUser
  onLogout: () => void
}

type DateFilterProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

const statusOptions: Array<{
  label: string
  value: OwnerOrderStatus | "all"
}> = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Awaiting waiter", value: "awaiting_waiter" },
  { label: "Awaiting payment", value: "awaiting_payment" },
  { label: "Submitted", value: "submitted" },
  { label: "Accepted", value: "accepted" },
  { label: "Preparing", value: "preparing" },
  { label: "Ready", value: "ready" },
  { label: "Served", value: "served" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
]

const statusStyles: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  awaiting_waiter: "bg-orange-50 text-orange-700",
  awaiting_payment: "bg-yellow-50 text-yellow-700",
  submitted: "bg-blue-50 text-blue-700",
  accepted: "bg-violet-50 text-violet-700",
  preparing: "bg-amber-50 text-amber-700",
  ready: "bg-emerald-50 text-emerald-700",
  served: "bg-cyan-50 text-cyan-700",
  completed: "bg-neutral-950 text-white",
  cancelled: "bg-red-50 text-red-700",
}

const paymentStyles: Record<string, string> = {
  unpaid: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-violet-50 text-violet-700",
}

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  card_pos: "Card POS",
  manual_mobile_money: "Manual mobile money",
  lenco: "Lenco",
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(amount / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

const formatPaymentMethod = (method?: string) =>
  method ? paymentMethodLabels[method] || formatStatus(method) : "Not recorded"

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-ZM", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))

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

  if (!date) return ""

  return new Intl.DateTimeFormat("en-ZM", {
    dateStyle: "medium",
  }).format(date)
}

function DateFilter({ label, value, onChange }: DateFilterProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-12 w-full justify-start rounded-xl bg-neutral-100 px-4 font-normal hover:bg-neutral-100"
        >
          <CalendarDays className="size-4 text-neutral-400" />
          <span className={value ? "text-neutral-900" : "text-neutral-400"}>
            {value ? formatSelectedDate(value) : label}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto rounded-2xl border-neutral-200 p-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={parseDate(value)}
          onSelect={(date) => {
            onChange(date ? serializeDate(date) : "")
            setOpen(false)
          }}
        />

        {value && (
          <div className="border-t border-neutral-100 p-3">
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              <X className="size-4" />
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function OwnerOrdersPage({ user, onLogout }: OwnerOrdersPageProps) {
  const navigate = useNavigate()

  const [history, setHistory] = useState<OwnerOrderHistory | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<OwnerOrderStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    const loadOrders = async () => {
      setLoading(true)
      setError("")

      try {
        const result = await getOwnerOrders({
          search,
          status,
          dateFrom,
          dateTo,
          page,
          limit: 20,
        })

        if (active) {
          setHistory(result)
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load order history"
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      active = false
    }
  }, [search, status, dateFrom, dateTo, page])

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const clearFilters = () => {
    setSearchInput("")
    setSearch("")
    setStatus("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  const hasFilters =
    Boolean(search) || status !== "all" || Boolean(dateFrom) || Boolean(dateTo)

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="orders"
      contentClassName="space-y-5"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Restaurant records
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Order history
          </h1>
        </div>
      }
    >
      <section className="rounded-[24px] bg-white p-4 md:p-5">
        <form
          className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_1fr_1fr_auto]"
          onSubmit={handleSearch}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              className="h-12 rounded-xl border-0 bg-neutral-100 pl-11 shadow-none"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search order number"
            />
          </div>

          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1)
              setStatus(value as OwnerOrderStatus | "all")
            }}
          >
            <SelectTrigger className="min-h-12 w-full cursor-pointer rounded-xl border-0 bg-neutral-100 px-4 shadow-none">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>

            <SelectContent className="rounded-xl">
              {statusOptions.map((option) => (
                <SelectItem
                  className="cursor-pointer"
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateFilter
            label="Start date"
            value={dateFrom}
            onChange={(value) => {
              setPage(1)
              setDateFrom(value)
            }}
          />

          <DateFilter
            label="End date"
            value={dateTo}
            onChange={(value) => {
              setPage(1)
              setDateTo(value)
            }}
          />

          <Button className="h-12 rounded-xl bg-[#ef1428] px-6 text-white hover:bg-[#d91023]">
            <Search className="size-4" />
            Search
          </Button>
        </form>

        {hasFilters && (
          <Button
            className="mt-3 rounded-xl"
            variant="ghost"
            onClick={clearFilters}
          >
            <X className="size-4" />
            Clear filters
          </Button>
        )}
      </section>

      {error && (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-[24px] bg-white">
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-black">Restaurant orders</h2>
            <p className="text-sm text-neutral-400">
              Search and review every recorded order.
            </p>
          </div>

          {loading ? (
            <span className="h-6 w-20 animate-pulse rounded-full bg-neutral-200" />
          ) : (
            <Badge className="rounded-full border-0 bg-neutral-100 text-neutral-700">
              {history?.pagination.totalOrders ?? 0} orders
            </Badge>
          )}
        </div>

        {loading ? (
          <OwnerOrdersTableSkeleton />
        ) : history && history.orders.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto px-3 pb-3 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Waiter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {history.orders.map((order) => (
                    <TableRow
                      key={order._id}
                      className="cursor-pointer border-neutral-100"
                      onClick={() => navigate(`/owner/orders/${order._id}`)}
                    >
                      <TableCell className="font-bold">
                        {order.orderNumber}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-neutral-500">
                        {formatDateTime(order.createdAt)}
                      </TableCell>

                      <TableCell>
                        <p className="font-medium">
                          {order.tableName || "Takeaway"}
                        </p>
                        <p className="text-xs text-neutral-400 capitalize">
                          {formatStatus(order.source || "waiter")}
                        </p>
                      </TableCell>

                      <TableCell>
                        {order.waiter?.name || "Unassigned"}
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

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            className={`w-fit border-0 capitalize ${
                              paymentStyles[order.paymentStatus] ||
                              paymentStyles.unpaid
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

                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-xl"
                          aria-label={`View ${order.orderNumber}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/owner/orders/${order._id}`)
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 p-4 pt-1 md:hidden">
              {history.orders.map((order) => (
                <button
                  key={order._id}
                  type="button"
                  className="w-full rounded-2xl border border-dashed border-neutral-200 p-4 text-left"
                  onClick={() => navigate(`/owner/orders/${order._id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{order.orderNumber}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>

                    <p className="font-black text-[#ef1428]">
                      {formatPrice(order.total)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge
                      className={`border-0 capitalize ${
                        statusStyles[order.status] ||
                        "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {formatStatus(order.status)}
                    </Badge>

                    <Badge
                      className={`border-0 capitalize ${
                        paymentStyles[order.paymentStatus] ||
                        paymentStyles.unpaid
                      }`}
                    >
                      <CreditCard className="size-3" />
                      {formatStatus(order.paymentStatus)}
                    </Badge>
                  </div>

                  {order.paymentStatus === "paid" && (
                    <p className="mt-3 text-xs font-medium text-neutral-400">
                      Paid via {formatPaymentMethod(order.paymentMethod)}
                    </p>
                  )}

                  <div className="mt-4 flex justify-between text-sm">
                    <span className="text-neutral-400">
                      {order.tableName || "Takeaway"}
                    </span>
                    <span className="font-medium">
                      {order.waiter?.name || "Unassigned"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100">
              <ReceiptText className="size-5 text-neutral-400" />
            </div>
            <p className="mt-4 font-bold">No orders found</p>
            <p className="mt-1 text-sm text-neutral-400">
              Try changing your search or filters.
            </p>
          </div>
        )}

        {history && history.orders.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
            <p className="text-sm text-neutral-400">
              Page {history.pagination.page} of{" "}
              {Math.max(history.pagination.totalPages, 1)}
            </p>

            <div className="flex gap-2">
              <Button
                className="rounded-xl"
                variant="outline"
                disabled={!history.pagination.hasPreviousPage || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>

              <Button
                className="rounded-xl"
                variant="outline"
                disabled={!history.pagination.hasNextPage || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </OwnerShell>
  )
}
