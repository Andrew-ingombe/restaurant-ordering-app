import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  Check,
  ChefHat,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react"

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

import { OwnerShell } from "../components/owner-shell"
import { createStaff, getStaff, updateStaffStatus } from "../lib/api"
import type { AuthUser, StaffRole, StaffUser } from "../lib/api"

type OwnerPageProps = {
  user: AuthUser
  onLogout: () => void
}

const getStaffId = (staff: StaffUser) => staff.id || staff._id || ""

export function OwnerPage({ user, onLogout }: OwnerPageProps) {
  const navigate = useNavigate()

  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<StaffRole>("waiter")

  const loadStaff = async () => {
    try {
      setError("")
      setStaff(await getStaff())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load staff"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaff()
  }, [])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const newStaff = await createStaff({
        name,
        email,
        phone: phone || undefined,
        password,
        role,
      })

      setStaff((current) => [newStaff, ...current])
      setName("")
      setEmail("")
      setPhone("")
      setPassword("")
      setRole("waiter")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create staff member"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (staffMember: StaffUser) => {
    const id = getStaffId(staffMember)

    if (!id) return

    setUpdatingId(id)

    try {
      setError("")

      const updatedStaff = await updateStaffStatus(id, !staffMember.active)

      setStaff((current) =>
        current.map((item) => (getStaffId(item) === id ? updatedStaff : item))
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update staff member"
      )
    } finally {
      setUpdatingId("")
    }
  }

  const activeStaff = staff.filter((member) => member.active).length

  const waiters = staff.filter((member) => member.role === "waiter").length

  const kitchenStaff = staff.filter(
    (member) => member.role === "kitchen"
  ).length

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="staff"
      contentClassName="space-y-5"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Team management
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Restaurant staff
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Create accounts and control staff access.
          </p>
        </div>
      }
      headerActions={
        <Button
          className="h-11 rounded-xl bg-[#ef1428] px-5 text-white hover:bg-[#d91023]"
          onClick={() => navigate("/owner/menu")}
        >
          <UtensilsCrossed className="size-4" />
          Manage menu
        </Button>
      }
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] bg-[#ef1428] p-5 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/75">Active staff</p>
            <div className="flex size-9 items-center justify-center rounded-full bg-white/15">
              <ShieldCheck className="size-4" />
            </div>
          </div>

          <p className="mt-5 text-3xl font-black">{activeStaff}</p>
        </div>

        <div className="rounded-[22px] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Waiters</p>
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100">
              <UserRound className="size-4" />
            </div>
          </div>

          <p className="mt-5 text-3xl font-black">{waiters}</p>
        </div>

        <div className="rounded-[22px] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Kitchen staff</p>
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100">
              <ChefHat className="size-4" />
            </div>
          </div>

          <p className="mt-5 text-3xl font-black">{kitchenStaff}</p>
        </div>
      </section>

      {error && (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <section className="self-start rounded-[24px] bg-white p-5 xl:sticky xl:top-7">
          <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
            <Plus className="size-5" />
          </div>

          <h2 className="mt-5 text-xl font-black">Add staff member</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-400">
            Create login details for a waiter or kitchen team member.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Staff member's name"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-email">Email address</Label>
              <Input
                id="staff-email"
                className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@restaurant.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-phone">Phone number</Label>
              <Input
                id="staff-phone"
                className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-password">Temporary password</Label>
              <Input
                id="staff-password"
                className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label>Staff role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as StaffRole)}
              >
                <SelectTrigger className="h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 shadow-none">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="waiter">Waiter</SelectItem>
                  <SelectItem value="kitchen">Kitchen staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create staff account"}
            </Button>
          </form>
        </section>

        <section className="min-w-0 rounded-[24px] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Staff accounts</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Manage access for the restaurant team.
              </p>
            </div>

            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {staff.length} accounts
            </Badge>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl bg-neutral-50 p-10 text-center text-sm text-neutral-400">
              Loading staff...
            </div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {staff.map((staffMember) => {
                const id = getStaffId(staffMember)
                const isOwner = staffMember.role === "owner"
                const RoleIcon =
                  staffMember.role === "kitchen"
                    ? ChefHat
                    : staffMember.role === "owner"
                      ? ShieldCheck
                      : UserRound

                return (
                  <article
                    key={id}
                    className="rounded-[20px] border border-neutral-100 p-4 transition hover:border-neutral-200 hover:bg-neutral-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                        <RoleIcon className="size-4" />
                      </div>

                      <Badge
                        className={`rounded-full border-0 ${
                          staffMember.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {staffMember.active && <Check className="size-3" />}
                        {staffMember.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-lg font-black">{staffMember.name}</h3>
                      <p className="mt-1 text-xs font-semibold tracking-wider text-[#ef1428] uppercase">
                        {staffMember.role === "kitchen"
                          ? "Kitchen staff"
                          : staffMember.role}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-neutral-500">
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{staffMember.email}</span>
                      </div>

                      {staffMember.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="size-3.5 shrink-0" />
                          <span>{staffMember.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t border-neutral-100 pt-4">
                      {isOwner ? (
                        <div className="rounded-xl bg-neutral-100 px-3 py-2 text-center text-xs font-medium text-neutral-500">
                          Owner access cannot be deactivated
                        </div>
                      ) : (
                        <Button
                          className={`w-full rounded-xl ${
                            !staffMember.active
                              ? "bg-neutral-950 text-white hover:bg-neutral-800"
                              : ""
                          }`}
                          size="sm"
                          variant={staffMember.active ? "outline" : "default"}
                          disabled={updatingId === id}
                          onClick={() => void handleStatusChange(staffMember)}
                        >
                          {updatingId === id
                            ? "Updating..."
                            : staffMember.active
                              ? "Deactivate account"
                              : "Activate account"}
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}

              {staff.length === 0 && (
                <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center md:col-span-2">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                    <Users className="size-5 text-neutral-500" />
                  </div>
                  <p className="mt-4 font-bold">No staff accounts</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Add your first staff member using the form.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </OwnerShell>
  )
}
