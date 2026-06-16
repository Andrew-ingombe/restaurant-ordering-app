import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  Building2,
  CheckCircle2,
  CreditCard,
  KeyRound,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  getPlatformRestaurants,
  updateRestaurantPaymentSettings,
  updateRestaurantSubscription,
} from "../lib/api"
import type { AuthUser, PlatformRestaurant } from "../lib/api"

type PlatformPageProps = {
  user: AuthUser
  onLogout: () => void
}

type PaymentEnvironment = "sandbox" | "production"
type SubscriptionPlan = "pilot" | "starter" | "growth"
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"

const emptyPaymentForm = {
  environment: "sandbox" as PaymentEnvironment,
  publicKey: "",
  secretKey: "",
  enabled: true,
}

const emptySubscriptionForm = {
  plan: "pilot" as SubscriptionPlan,
  status: "trialing" as SubscriptionStatus,
  trialEndsAt: "",
  currentPeriodStartsAt: "",
  currentPeriodEndsAt: "",
  gracePeriodEndsAt: "",
}

const subscriptionStyles: Record<string, string> = {
  trialing: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
  past_due: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-600",
}

const formatStatus = (status: string) => status.replaceAll("_", " ")

const formatDate = (value?: string) => {
  if (!value) return "Not set"

  return new Intl.DateTimeFormat("en-ZM", {
    dateStyle: "medium",
  }).format(new Date(value))
}

const toDateTimeInput = (value?: string) => {
  if (!value) return ""

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  const pad = (number: number) => String(number).padStart(2, "0")

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toIsoOrEmpty = (value: string) => {
  return value ? new Date(value).toISOString() : ""
}

const isPaymentConfigured = (restaurant: PlatformRestaurant) =>
  restaurant.paymentSettings.enabled &&
  restaurant.paymentSettings.publicKeyConfigured &&
  restaurant.paymentSettings.secretKeyConfigured

export function PlatformPage({ user, onLogout }: PlatformPageProps) {
  const navigate = useNavigate()

  const [restaurants, setRestaurants] = useState<PlatformRestaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<PlatformRestaurant | null>(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [subscriptionForm, setSubscriptionForm] = useState(
    emptySubscriptionForm
  )
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingPayment, setSavingPayment] = useState(false)
  const [savingSubscription, setSavingSubscription] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const configuredCount = restaurants.filter(isPaymentConfigured).length
  const activeCount = restaurants.filter(
    (restaurant) => restaurant.subscription.status === "active"
  ).length
  const trialingCount = restaurants.filter(
    (restaurant) => restaurant.subscription.status === "trialing"
  ).length

  const loadRestaurants = async () => {
    setLoading(true)
    setError("")

    try {
      const result = await getPlatformRestaurants()
      setRestaurants(result)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load restaurants"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRestaurants()
  }, [])

  const openPaymentDialog = (restaurant: PlatformRestaurant) => {
    setSelectedRestaurant(restaurant)
    setPaymentForm({
      environment: restaurant.paymentSettings.environment || "sandbox",
      publicKey: "",
      secretKey: "",
      enabled: restaurant.paymentSettings.enabled,
    })
    setPaymentDialogOpen(true)
    setError("")
    setMessage("")
  }

  const openSubscriptionDialog = (restaurant: PlatformRestaurant) => {
    setSelectedRestaurant(restaurant)
    setSubscriptionForm({
      plan: restaurant.subscription.plan,
      status: restaurant.subscription.status,
      trialEndsAt: toDateTimeInput(restaurant.subscription.trialEndsAt),
      currentPeriodStartsAt: toDateTimeInput(
        restaurant.subscription.currentPeriodStartsAt
      ),
      currentPeriodEndsAt: toDateTimeInput(
        restaurant.subscription.currentPeriodEndsAt
      ),
      gracePeriodEndsAt: toDateTimeInput(
        restaurant.subscription.gracePeriodEndsAt
      ),
    })
    setSubscriptionDialogOpen(true)
    setError("")
    setMessage("")
  }

  const handleSavePaymentSettings = async (event: FormEvent) => {
    event.preventDefault()

    if (!selectedRestaurant) return

    setSavingPayment(true)
    setError("")
    setMessage("")

    try {
      const publicKey = paymentForm.publicKey.trim()
      const secretKey = paymentForm.secretKey.trim()

      await updateRestaurantPaymentSettings(selectedRestaurant.id, {
        environment: paymentForm.environment,
        enabled: paymentForm.enabled,
        ...(publicKey ? { publicKey } : {}),
        ...(secretKey ? { secretKey } : {}),
      })

      setPaymentForm((current) => ({
        ...current,
        publicKey: "",
        secretKey: "",
      }))

      setPaymentDialogOpen(false)
      setMessage(`Updated payment settings for ${selectedRestaurant.name}`)
      await loadRestaurants()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update payment settings"
      )
    } finally {
      setSavingPayment(false)
    }
  }

  const handleSaveSubscription = async (event: FormEvent) => {
    event.preventDefault()

    if (!selectedRestaurant) return

    setSavingSubscription(true)
    setError("")
    setMessage("")

    try {
      await updateRestaurantSubscription(selectedRestaurant.id, {
        plan: subscriptionForm.plan,
        status: subscriptionForm.status,
        trialEndsAt: toIsoOrEmpty(subscriptionForm.trialEndsAt),
        currentPeriodStartsAt: toIsoOrEmpty(
          subscriptionForm.currentPeriodStartsAt
        ),
        currentPeriodEndsAt: toIsoOrEmpty(subscriptionForm.currentPeriodEndsAt),
        gracePeriodEndsAt: toIsoOrEmpty(subscriptionForm.gracePeriodEndsAt),
      })

      setSubscriptionDialogOpen(false)
      setMessage(`Updated subscription for ${selectedRestaurant.name}`)
      await loadRestaurants()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update subscription"
      )
    } finally {
      setSavingSubscription(false)
    }
  }

  return (
    <main className="min-h-svh bg-[#f5f5f6]">
      <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#ef1428] text-white">
              <ShieldCheck className="size-5" />
            </div>

            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                Platform admin
              </p>
              <h1 className="text-2xl font-black tracking-tight">
                Restaurant management
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              className="rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              onClick={() => navigate("/platform/restaurants/new")}
            >
              <Plus className="size-4" />
              New restaurant
            </Button>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-neutral-400">{user.email}</p>
            </div>

            <Button className="rounded-xl" variant="outline" onClick={onLogout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-7">
        {error && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-[#ef1428] p-5 text-white">
            <Building2 className="size-6" />
            <p className="mt-5 text-sm text-white/70">Restaurants</p>
            <p className="mt-1 text-3xl font-black">{restaurants.length}</p>
          </div>

          <div className="rounded-[24px] bg-white p-5">
            <WalletCards className="size-6 text-[#ef1428]" />
            <p className="mt-5 text-sm text-neutral-400">Active</p>
            <p className="mt-1 text-3xl font-black">{activeCount}</p>
          </div>

          <div className="rounded-[24px] bg-white p-5">
            <ShieldCheck className="size-6 text-[#ef1428]" />
            <p className="mt-5 text-sm text-neutral-400">Trialing</p>
            <p className="mt-1 text-3xl font-black">{trialingCount}</p>
          </div>

          <div className="rounded-[24px] bg-white p-5">
            <CreditCard className="size-6 text-[#ef1428]" />
            <p className="mt-5 text-sm text-neutral-400">Payments ready</p>
            <p className="mt-1 text-3xl font-black">{configuredCount}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <h2 className="text-xl font-black">Restaurants</h2>
              <p className="text-sm text-neutral-400">
                Manage pilot restaurants, subscriptions, and Lenco setup.
              </p>
            </div>

            <Button
              className="rounded-xl"
              variant="outline"
              disabled={loading}
              onClick={() => void loadRestaurants()}
            >
              <RefreshCw
                className={`size-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          <div className="max-h-[620px] overflow-auto px-3 pb-3">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Trial ends</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {restaurants.map((restaurant) => (
                  <TableRow key={restaurant.id} className="border-neutral-100">
                    <TableCell>
                      <p className="font-black">{restaurant.name}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {restaurant.slug}
                      </p>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={`border-0 capitalize ${
                            subscriptionStyles[
                              restaurant.subscription.status
                            ] || "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {formatStatus(restaurant.subscription.status)}
                        </Badge>

                        <Badge className="border-0 bg-neutral-950 text-white capitalize">
                          {restaurant.subscription.plan}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell className="text-neutral-500">
                      {formatDate(restaurant.subscription.trialEndsAt)}
                    </TableCell>

                    <TableCell>
                      {isPaymentConfigured(restaurant) ? (
                        <Badge className="border-0 bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="size-3.5" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge className="border-0 bg-red-50 text-red-700">
                          <XCircle className="size-3.5" />
                          Missing
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <p className="text-sm">
                        {restaurant.settings.email || "No email"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {restaurant.settings.phone || "No phone"}
                      </p>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          className="rounded-xl"
                          variant="outline"
                          onClick={() => openSubscriptionDialog(restaurant)}
                        >
                          <Settings2 className="size-4" />
                          Subscription
                        </Button>

                        <Button
                          className="rounded-xl"
                          variant="outline"
                          onClick={() => openPaymentDialog(restaurant)}
                        >
                          <CreditCard className="size-4" />
                          Payments
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && restaurants.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-40 text-center text-neutral-400"
                    >
                      No restaurants yet.
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-40 text-center text-neutral-400"
                    >
                      Loading restaurants...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Dialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
      >
        <DialogContent className="rounded-[24px] border-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              Subscription settings
            </DialogTitle>
            <DialogDescription>
              Update plan, status, and billing dates for{" "}
              {selectedRestaurant?.name}.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSaveSubscription}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={subscriptionForm.plan}
                  onValueChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      plan: value as SubscriptionPlan,
                    }))
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilot">Pilot</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={subscriptionForm.status}
                  onValueChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      status: value as SubscriptionStatus,
                    }))
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Trial ends at</Label>
              <Input
                className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                type="datetime-local"
                value={subscriptionForm.trialEndsAt}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    trialEndsAt: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Current period starts</Label>
                <Input
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  type="datetime-local"
                  value={subscriptionForm.currentPeriodStartsAt}
                  onChange={(event) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      currentPeriodStartsAt: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Current period ends</Label>
                <Input
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  type="datetime-local"
                  value={subscriptionForm.currentPeriodEndsAt}
                  onChange={(event) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      currentPeriodEndsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Grace period ends at</Label>
              <Input
                className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                type="datetime-local"
                value={subscriptionForm.gracePeriodEndsAt}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    gracePeriodEndsAt: event.target.value,
                  }))
                }
              />
            </div>

            <Button
              className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              disabled={savingSubscription}
            >
              {savingSubscription ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Settings2 className="size-4" />
                  Save subscription
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="rounded-[24px] border-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              Lenco credentials
            </DialogTitle>
            <DialogDescription>
              Update payment settings for {selectedRestaurant?.name}. Secrets
              are encrypted and never shown again.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSavePaymentSettings}>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={paymentForm.environment}
                onValueChange={(value) =>
                  setPaymentForm((current) => ({
                    ...current,
                    environment: value as PaymentEnvironment,
                  }))
                }
              >
                <SelectTrigger className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-neutral-100 p-4">
              <div>
                <p className="font-bold">Enable payments</p>
                <p className="text-sm text-neutral-400">
                  Orders can only be paid when credentials are configured.
                </p>
              </div>

              <Switch
                checked={paymentForm.enabled}
                onCheckedChange={(checked) =>
                  setPaymentForm((current) => ({
                    ...current,
                    enabled: checked,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Public key</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  className="h-12 rounded-xl border-0 bg-neutral-100 pl-11 shadow-none"
                  value={paymentForm.publicKey}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      publicKey: event.target.value,
                    }))
                  }
                  placeholder={
                    selectedRestaurant?.paymentSettings.publicKeyConfigured
                      ? "Configured. Leave blank to keep existing key."
                      : "Enter Lenco public key"
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Secret key</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  className="h-12 rounded-xl border-0 bg-neutral-100 pl-11 shadow-none"
                  type="password"
                  value={paymentForm.secretKey}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      secretKey: event.target.value,
                    }))
                  }
                  placeholder={
                    selectedRestaurant?.paymentSettings.secretKeyConfigured
                      ? "Configured. Leave blank to keep existing key."
                      : "Enter Lenco secret key"
                  }
                />
              </div>
            </div>

            <Button
              className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              disabled={savingPayment}
            >
              {savingPayment ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CreditCard className="size-4" />
                  Save payment settings
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
