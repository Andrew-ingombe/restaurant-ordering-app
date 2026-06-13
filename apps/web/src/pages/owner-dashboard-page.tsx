import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h1 className="text-xl font-semibold">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/owner/tables")}>
              Manage tables
            </Button>

            <Button variant="outline" onClick={() => navigate("/owner/staff")}>
              Manage staff
            </Button>

            <Button variant="outline" onClick={() => navigate("/owner/menu")}>
              Manage menu
            </Button>

            <Button variant="outline" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex items-end gap-3">
          <div>
            <label
              htmlFor="dashboard-date"
              className="mb-2 block text-sm font-medium"
            >
              Report date
            </label>
            <Input
              id="dashboard-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          <Button onClick={() => void loadDashboard(selectedDate || undefined)}>
            View report
          </Button>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading && !dashboard ? (
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        ) : dashboard ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total sales</CardDescription>
                  <CardTitle>
                    {formatPrice(dashboard.summary.totalSales)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Paid orders</CardDescription>
                  <CardTitle>{dashboard.summary.paidOrders}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Completed</CardDescription>
                  <CardTitle>{dashboard.summary.completedOrders}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active orders</CardDescription>
                  <CardTitle>{dashboard.summary.activeOrders}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Average order value</CardDescription>
                  <CardTitle>
                    {formatPrice(dashboard.summary.averageOrderValue)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Order status</CardTitle>
                </CardHeader>

                <CardContent className="flex flex-wrap gap-3">
                  {dashboard.statusBreakdown.map((item) => (
                    <div
                      key={item.status}
                      className="rounded-lg border px-4 py-3"
                    >
                      <p className="text-sm text-muted-foreground capitalize">
                        {formatStatus(item.status)}
                      </p>
                      <p className="text-2xl font-semibold">{item.count}</p>
                    </div>
                  ))}

                  {dashboard.statusBreakdown.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No paid orders for this date.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Best-selling items</CardTitle>
                </CardHeader>

                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {dashboard.bestSellingItems.map((item) => (
                        <TableRow key={item.menuItem}>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatPrice(item.sales)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {dashboard.bestSellingItems.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground"
                          >
                            No sales data.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Recent orders</CardTitle>
                <CardDescription>
                  Latest paid orders for {dashboard.date}
                </CardDescription>
              </CardHeader>

              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Waiter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {dashboard.recentOrders.map((order) => (
                      <TableRow key={order._id}>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>{order.tableName || "Takeaway"}</TableCell>
                        <TableCell>{order.waiter?.name || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge className="capitalize">
                            {formatStatus(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(order.total)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {dashboard.recentOrders.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No paid orders for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  )
}
