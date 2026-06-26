import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Building2, RefreshCw, Save, Settings2 } from "lucide-react"
import { toast } from "sonner"

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
import { Textarea } from "@workspace/ui/components/textarea"

import { getRestaurantSettings, updateRestaurantSettings } from "../lib/api"
import type { AuthUser, OwnerRestaurantSettings } from "../lib/api"
import { OwnerShell } from "../components/owner-shell"
import { RestaurantSettingsSkeleton } from "../components/page-skeletons"

type OwnerSettingsPageProps = {
  user: AuthUser
  onLogout: () => void
}

const subscriptionStatusStyles: Record<
  OwnerRestaurantSettings["subscription"]["status"],
  string
> = {
  trialing: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
  past_due: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-600",
}

const currencyOptions = [
  { code: "ZMW", label: "ZMW - Zambian Kwacha" },
  { code: "ZAR", label: "ZAR - South African Rand" },
  { code: "NGN", label: "NGN - Nigerian Naira" },
  { code: "KES", label: "KES - Kenyan Shilling" },
  { code: "GHS", label: "GHS - Ghanaian Cedi" },
  { code: "EGP", label: "EGP - Egyptian Pound" },
  { code: "MAD", label: "MAD - Moroccan Dirham" },
  { code: "TZS", label: "TZS - Tanzanian Shilling" },
  { code: "UGX", label: "UGX - Ugandan Shilling" },
  { code: "RWF", label: "RWF - Rwandan Franc" },
  { code: "BWP", label: "BWP - Botswana Pula" },
  { code: "NAD", label: "NAD - Namibian Dollar" },
  { code: "MWK", label: "MWK - Malawian Kwacha" },
  { code: "MZN", label: "MZN - Mozambican Metical" },
  { code: "AOA", label: "AOA - Angolan Kwanza" },
  { code: "DZD", label: "DZD - Algerian Dinar" },
  { code: "TND", label: "TND - Tunisian Dinar" },
  { code: "XOF", label: "XOF - West African CFA Franc" },
  { code: "XAF", label: "XAF - Central African CFA Franc" },
  { code: "MUR", label: "MUR - Mauritian Rupee" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "EUR", label: "EUR - Euro" },
]

const formatStatus = (status: string) => status.replaceAll("_", " ")

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not set"

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function OwnerSettingsPage({ user, onLogout }: OwnerSettingsPageProps) {
  const [restaurant, setRestaurant] = useState<OwnerRestaurantSettings | null>(
    null
  )
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("")
  const [timezone, setTimezone] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [receiptFooter, setReceiptFooter] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    let active = true

    void getRestaurantSettings()
      .then((result) => {
        if (!active) return

        setRestaurant(result)
        setName(result.name)
        setCurrency(result.settings.currency)
        setTimezone(result.settings.timezone)
        setPhone(result.settings.phone)
        setEmail(result.settings.email)
        setAddress(result.settings.address)
        setReceiptFooter(result.settings.receiptFooter)
      })
      .catch((requestError) => {
        if (!active) return

        const message =
          requestError instanceof Error
            ? requestError.message
            : "Could not load restaurant settings"

        setError(message)
        toast.error(message, {
          id: "restaurant-settings-load-error",
        })
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const updated = await updateRestaurantSettings({
        name,
        currency,
        timezone,
        phone,
        email,
        address,
        receiptFooter,
      })

      const successMessage = "Restaurant settings updated successfully."

      setRestaurant(updated)
      setSuccess(successMessage)
      toast.success(successMessage)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update restaurant settings"

      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="settings"
      contentClassName="min-w-0 space-y-5 overflow-x-hidden"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#047857] uppercase">
            Restaurant settings
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Settings and contact details
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage the restaurant identity used across orders and receipts.
          </p>
        </div>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#ECFDF5] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#047857] text-white">
            <Settings2 className="size-4" />
          </div>

          <p className="mt-3 font-bold">Restaurant profile</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Keep your contact details and receipt information current.
          </p>
        </div>
      }
    >
      {loading ? (
        <div className="min-w-0 overflow-hidden">
          <RestaurantSettingsSkeleton />
        </div>
      ) : (
        <>
          {error && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[24px] bg-white p-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                <Building2 className="size-5" />
              </div>

              <h2 className="mt-5 text-xl font-black">
                Restaurant information
              </h2>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                These details shape how your restaurant appears inside the app.
              </p>

              {restaurant && (
                <div className="mt-6 space-y-3 rounded-2xl bg-neutral-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-500">Restaurant</span>
                    <span className="text-right font-semibold text-neutral-900">
                      {restaurant.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-500">Slug</span>
                    <span className="text-right font-mono text-sm text-neutral-700">
                      {restaurant.slug}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-500">
                      Restaurant status
                    </span>
                    <Badge
                      className={`rounded-full border-0 ${
                        restaurant.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {restaurant.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-500">
                      Subscription
                    </span>
                    <Badge
                      className={`rounded-full border-0 capitalize ${
                        subscriptionStatusStyles[restaurant.subscription.status]
                      }`}
                    >
                      {formatStatus(restaurant.subscription.status)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-500">Plan</span>
                    <span className="text-right font-semibold text-neutral-900 capitalize">
                      {restaurant.subscription.plan}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-500">Trial ends</span>
                    <span className="text-right text-sm font-semibold text-neutral-700">
                      {formatDateTime(restaurant.subscription.trialEndsAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <form
              className="rounded-[24px] bg-white p-5"
              onSubmit={handleSubmit}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Update settings</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Edit the operational details for this restaurant.
                  </p>
                </div>

                <Button
                  className="h-10 rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save changes
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="restaurant-name">Restaurant name</Label>
                  <Input
                    id="restaurant-name"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>

                  <Select value={currency || "ZMW"} onValueChange={setCurrency}>
                    <SelectTrigger
                      id="currency"
                      className="min-h-12 w-full cursor-pointer rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    >
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>

                    <SelectContent className="max-h-80 rounded-xl">
                      {currencyOptions.map((option) => (
                        <SelectItem
                          key={option.code}
                          value={option.code}
                          className="cursor-pointer"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="text-xs leading-5 text-neutral-400">
                    This currency is used for menu prices, customer menus, and
                    order totals.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    className="min-h-24 rounded-xl border-0 bg-neutral-100 px-4 py-3 shadow-none"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="receipt-footer">Receipt footer</Label>
                  <Textarea
                    id="receipt-footer"
                    className="min-h-24 rounded-xl border-0 bg-neutral-100 px-4 py-3 shadow-none"
                    value={receiptFooter}
                    onChange={(event) => setReceiptFooter(event.target.value)}
                  />
                </div>
              </div>
            </form>
          </section>
        </>
      )}
    </OwnerShell>
  )
}
