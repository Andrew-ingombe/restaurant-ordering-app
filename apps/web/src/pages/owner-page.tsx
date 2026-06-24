import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  Check,
  ChefHat,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
  UtensilsCrossed,
  KeyRound,
  MonitorSmartphone,
  Eye,
  EyeOff,
} from "lucide-react"
import { toast } from "sonner"

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

import { OwnerShell } from "../components/owner-shell"
import { StaffCardsSkeleton } from "../components/page-skeletons"
import {
  createStaff,
  getStaff,
  updateStaff,
  updateStaffStatus,
  resetStaffPassword,
} from "../lib/api"
import type { AuthUser, StaffRole, StaffUser } from "../lib/api"

type OwnerPageProps = {
  user: AuthUser
  onLogout: () => void
}

const getStaffId = (staff: StaffUser) => staff.id || staff._id || ""

export function OwnerPage({ user, onLogout }: OwnerPageProps) {
  const navigate = useNavigate()

  const [staff, setStaff] = useState<StaffUser[]>([])
  const [staffDialogOpen, setStaffDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null)
  const [statusTarget, setStatusTarget] = useState<StaffUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<StaffRole>("waiter")
  const [sharedHub, setSharedHub] = useState(false)

  const [passwordTarget, setPasswordTarget] = useState<StaffUser | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState("")
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("")
  const [resettingPassword, setResettingPassword] = useState(false)

  const [showStaffPassword, setShowStaffPassword] = useState(false)
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false)
  const [showConfirmTemporaryPassword, setShowConfirmTemporaryPassword] =
    useState(false)

  const loadStaff = async () => {
    try {
      setError("")
      setStaff(await getStaff())
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not load staff"

      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaff()
  }, [])

  const resetForm = () => {
    setEditingStaff(null)
    setName("")
    setEmail("")
    setPhone("")
    setPassword("")
    setRole("waiter")
    setSharedHub(false)
  }

  const openCreateDialog = () => {
    setError("")
    resetForm()
    setStaffDialogOpen(true)
    setShowStaffPassword(false)
  }

  const openEditDialog = (staffMember: StaffUser) => {
    if (staffMember.role !== "waiter" && staffMember.role !== "kitchen") {
      return
    }

    setError("")
    setEditingStaff(staffMember)
    setName(staffMember.name)
    setEmail(staffMember.email)
    setPhone(staffMember.phone || "")
    setPassword("")
    setRole(staffMember.role)
    setSharedHub(Boolean(staffMember.sharedHub))
    setStaffDialogOpen(true)
  }

  const closeStaffDialog = () => {
    if (submitting) return

    setStaffDialogOpen(false)
    resetForm()
  }

  const openPasswordResetDialog = (staffMember: StaffUser) => {
    setError("")
    setTemporaryPassword("")
    setConfirmTemporaryPassword("")
    setPasswordTarget(staffMember)
    setShowTemporaryPassword(false)
    setShowConfirmTemporaryPassword(false)
  }

  const closePasswordResetDialog = () => {
    if (resettingPassword) return

    setPasswordTarget(null)
    setTemporaryPassword("")
    setConfirmTemporaryPassword("")
    setShowTemporaryPassword(false)
    setShowConfirmTemporaryPassword(false)
  }

  const handlePasswordReset = async (event: FormEvent) => {
    event.preventDefault()

    if (!passwordTarget || resettingPassword) return

    if (temporaryPassword !== confirmTemporaryPassword) {
      const message = "Temporary passwords do not match"
      setError(message)
      toast.error(message)
      return
    }

    const id = getStaffId(passwordTarget)

    if (!id) {
      const message = "Staff member ID is unavailable"
      setError(message)
      toast.error(message)
      return
    }

    setResettingPassword(true)
    setError("")

    try {
      const updatedStaff = await resetStaffPassword(id, temporaryPassword)

      setStaff((current) =>
        current.map((staffMember) =>
          getStaffId(staffMember) === id ? updatedStaff : staffMember
        )
      )

      toast.success("Temporary password created", {
        description: `${updatedStaff.name} must change it after signing in.`,
      })

      closePasswordResetDialog()
      setPasswordTarget(null)
      setTemporaryPassword("")
      setConfirmTemporaryPassword("")
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not reset staff password"

      setError(message)
      toast.error(message)
    } finally {
      setResettingPassword(false)
    }
  }

  const handleStaffDialogChange = (open: boolean) => {
    if (open) {
      setStaffDialogOpen(true)
      return
    }

    closeStaffDialog()
  }

  const handleRoleChange = (value: string) => {
    const nextRole = value as StaffRole

    setRole(nextRole)

    if (nextRole !== "waiter") {
      setSharedHub(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const normalizedSharedHub = role === "waiter" ? sharedHub : false

      if (editingStaff) {
        const id = getStaffId(editingStaff)

        if (!id) {
          throw new Error("Staff member ID is unavailable")
        }

        const updated = await updateStaff(id, {
          name,
          email,
          phone: phone || undefined,
          role,
          sharedHub: normalizedSharedHub,
        })

        setStaff((current) =>
          current.map((item) => (getStaffId(item) === id ? updated : item))
        )

        toast.success("Staff details updated")
      } else {
        const newStaff = await createStaff({
          name,
          email,
          phone: phone || undefined,
          password,
          role,
          sharedHub: normalizedSharedHub,
        })

        setStaff((current) => [newStaff, ...current])
        toast.success("Staff account created")
      }

      setStaffDialogOpen(false)
      resetForm()
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : editingStaff
            ? "Could not update staff member"
            : "Could not create staff member"

      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const applyStatusChange = async (staffMember: StaffUser) => {
    const id = getStaffId(staffMember)

    if (!id || updatingId) return

    setUpdatingId(id)
    setError("")

    try {
      const updatedStaff = await updateStaffStatus(id, !staffMember.active)

      setStaff((current) =>
        current.map((item) => (getStaffId(item) === id ? updatedStaff : item))
      )

      toast.success(
        updatedStaff.active
          ? `${updatedStaff.name} can now sign in`
          : `${updatedStaff.name} has been deactivated`
      )

      setStatusTarget(null)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update staff member"

      setError(message)
      toast.error(message)
    } finally {
      setUpdatingId("")
    }
  }

  const requestStatusChange = (staffMember: StaffUser) => {
    if (staffMember.active) {
      setStatusTarget(staffMember)
      return
    }

    void applyStatusChange(staffMember)
  }

  const activeStaff = staff.filter((member) => member.active).length
  const waiters = staff.filter((member) => member.role === "waiter").length
  const kitchenStaff = staff.filter(
    (member) => member.role === "kitchen"
  ).length
  const sharedHubAccounts = staff.filter(
    (member) => member.role === "waiter" && member.sharedHub
  ).length

  const statusTargetId = statusTarget ? getStaffId(statusTarget) : ""

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
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-11 rounded-xl bg-[#ef1428] px-5 text-white hover:bg-[#d91023]"
            onClick={openCreateDialog}
          >
            <Plus className="size-4" />
            Add staff
          </Button>

          <Button
            className="h-11 rounded-xl"
            variant="outline"
            onClick={() => navigate("/owner/menu")}
          >
            <UtensilsCrossed className="size-4" />
            Manage menu
          </Button>
        </div>
      }
    >
      <Dialog open={staffDialogOpen} onOpenChange={handleStaffDialogChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto rounded-[28px] border-0 p-0 sm:max-w-xl">
          <div className="bg-white p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                {editingStaff ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-5" />
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                {editingStaff ? "Edit staff member" : "Add staff member"}
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-400">
                {editingStaff
                  ? "Update this staff member's contact details, role, and hub access."
                  : "Create login details for a waiter, kitchen member, or shared ordering hub."}
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
                  disabled={submitting}
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
                  disabled={submitting}
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
                  disabled={submitting}
                />
              </div>

              {!editingStaff && (
                <div className="space-y-2">
                  <Label htmlFor="staff-password">Temporary password</Label>

                  <div className="relative">
                    <Input
                      id="staff-password"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 pr-12 shadow-none"
                      type={showStaffPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      disabled={submitting}
                    />

                    <button
                      type="button"
                      className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-950"
                      onClick={() =>
                        setShowStaffPassword((current) => !current)
                      }
                      aria-label={
                        showStaffPassword ? "Hide password" : "Show password"
                      }
                      disabled={submitting}
                    >
                      {showStaffPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Staff role</Label>
                <Select
                  value={role}
                  disabled={submitting}
                  onValueChange={handleRoleChange}
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

              <div
                className={`rounded-2xl border p-4 ${
                  role === "waiter"
                    ? "border-neutral-200 bg-neutral-50"
                    : "border-neutral-100 bg-neutral-50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                      <MonitorSmartphone className="size-4" />
                    </div>

                    <div>
                      <Label
                        htmlFor="shared-hub"
                        className="text-base font-black"
                      >
                        Shared ordering hub
                      </Label>

                      <p className="mt-1 text-sm leading-6 text-neutral-500">
                        Use this for a stationed waiter device. The hub stays
                        logged in, but each order is assigned to the actual
                        waiter serving the table.
                      </p>
                    </div>
                  </div>

                  <Switch
                    id="shared-hub"
                    checked={sharedHub}
                    disabled={submitting || role !== "waiter"}
                    onCheckedChange={setSharedHub}
                  />
                </div>

                {role !== "waiter" && (
                  <p className="mt-3 text-xs text-neutral-400">
                    Shared hubs are only available for waiter accounts.
                  </p>
                )}
              </div>

              {error && staffDialogOpen && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-xl"
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={closeStaffDialog}
                >
                  Cancel
                </Button>

                <Button
                  className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : editingStaff
                      ? "Save changes"
                      : "Create staff account"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setStatusTarget(null)
          }
        }}
      >
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-[#ef1428]">
                <AlertTriangle className="size-5" />
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                Deactivate staff account?
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                {statusTarget?.name} will immediately lose access to the
                restaurant workspace. Their previous orders and activity will
                remain available.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 rounded-xl"
                variant="outline"
                disabled={Boolean(updatingId)}
                onClick={() => setStatusTarget(null)}
              >
                Keep active
              </Button>

              <Button
                className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={Boolean(updatingId)}
                onClick={() => {
                  if (statusTarget) {
                    void applyStatusChange(statusTarget)
                  }
                }}
              >
                {updatingId === statusTargetId
                  ? "Deactivating..."
                  : "Deactivate account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closePasswordResetDialog()
          }
        }}
      >
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#fff0f1] text-[#ef1428]">
                <KeyRound className="size-5" />
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                Reset staff password
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                Create a temporary password for{" "}
                <strong className="text-neutral-900">
                  {passwordTarget?.name}
                </strong>
                . They will be required to replace it after signing in.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-4" onSubmit={handlePasswordReset}>
              <div className="space-y-2">
                <Label htmlFor="temporary-password">Temporary password</Label>

                <div className="relative">
                  <Input
                    id="temporary-password"
                    className="h-12 rounded-xl border-0 bg-neutral-100 pr-12 pl-4 shadow-none"
                    type={showTemporaryPassword ? "text" : "password"}
                    value={temporaryPassword}
                    onChange={(event) =>
                      setTemporaryPassword(event.target.value)
                    }
                    minLength={8}
                    required
                    disabled={resettingPassword}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-950"
                    onClick={() =>
                      setShowTemporaryPassword((current) => !current)
                    }
                    aria-label={
                      showTemporaryPassword ? "Hide password" : "Show password"
                    }
                    disabled={resettingPassword}
                  >
                    {showTemporaryPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-temporary-password">
                  Confirm temporary password
                </Label>

                <div className="relative">
                  <Input
                    id="confirm-temporary-password"
                    className="h-12 rounded-xl border-0 bg-neutral-100 pr-12 pl-4 shadow-none"
                    type={showConfirmTemporaryPassword ? "text" : "password"}
                    value={confirmTemporaryPassword}
                    onChange={(event) =>
                      setConfirmTemporaryPassword(event.target.value)
                    }
                    minLength={8}
                    required
                    disabled={resettingPassword}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-950"
                    onClick={() =>
                      setShowConfirmTemporaryPassword((current) => !current)
                    }
                    aria-label={
                      showConfirmTemporaryPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    disabled={resettingPassword}
                  >
                    {showConfirmTemporaryPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && passwordTarget && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-xl"
                  type="button"
                  variant="outline"
                  disabled={resettingPassword}
                  onClick={closePasswordResetDialog}
                >
                  Cancel
                </Button>

                <Button
                  className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  disabled={resettingPassword}
                >
                  {resettingPassword
                    ? "Resetting..."
                    : "Create temporary password"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <section className="min-w-0 rounded-[24px] bg-white p-5">
        <div>
          <h2 className="text-xl font-black">Staff accounts</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Manage access for the restaurant team.
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          <div className="rounded-2xl bg-[#fff0f1] px-4 py-3">
            <p className="text-xs font-semibold text-[#ef1428]">Active staff</p>
            <p className="mt-1 text-2xl font-black">
              {loading ? (
                <span className="block h-7 w-10 animate-pulse rounded-lg bg-neutral-200" />
              ) : (
                activeStaff
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-100 px-4 py-3">
            <p className="text-xs font-semibold text-neutral-500">Waiters</p>
            <p className="mt-1 text-2xl font-black">
              {loading ? (
                <span className="block h-7 w-10 animate-pulse rounded-lg bg-neutral-200" />
              ) : (
                waiters
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-100 px-4 py-3">
            <p className="text-xs font-semibold text-neutral-500">
              Kitchen staff
            </p>
            <p className="mt-1 text-2xl font-black">
              {loading ? (
                <span className="block h-7 w-10 animate-pulse rounded-lg bg-neutral-200" />
              ) : (
                kitchenStaff
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-100 px-4 py-3">
            <p className="text-xs font-semibold text-neutral-500">Hub logins</p>
            <p className="mt-1 text-2xl font-black">
              {loading ? (
                <span className="block h-7 w-10 animate-pulse rounded-lg bg-neutral-200" />
              ) : (
                sharedHubAccounts
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-white">
            <p className="text-xs font-semibold text-white/60">
              Total accounts
            </p>
            <p className="mt-1 text-2xl font-black">
              {loading ? (
                <span className="block h-7 w-10 animate-pulse rounded-lg bg-white/20" />
              ) : (
                staff.length
              )}
            </p>
          </div>
        </div>

        {error && !staffDialogOpen && !passwordTarget && (
          <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <StaffCardsSkeleton />
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {staff.map((staffMember) => {
              const id = getStaffId(staffMember)
              const RoleIcon =
                staffMember.role === "kitchen"
                  ? ChefHat
                  : staffMember.role === "owner"
                    ? ShieldCheck
                    : staffMember.sharedHub
                      ? MonitorSmartphone
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

                    <div className="flex flex-wrap justify-end gap-2">
                      {staffMember.sharedHub && (
                        <Badge className="rounded-full border-0 bg-blue-50 text-blue-700">
                          Hub
                        </Badge>
                      )}

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
                  </div>

                  <div className="mt-5">
                    <h3 className="text-lg font-black">{staffMember.name}</h3>
                    <p className="mt-1 text-xs font-semibold tracking-wider text-[#ef1428] uppercase">
                      {staffMember.sharedHub
                        ? "Shared ordering hub"
                        : staffMember.role === "kitchen"
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

                  <div className="mt-5 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4">
                    <Button
                      className="h-10 rounded-xl"
                      size="sm"
                      variant="outline"
                      disabled={updatingId === id || resettingPassword}
                      onClick={() => openEditDialog(staffMember)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>

                    <Button
                      className={`h-10 rounded-xl ${
                        !staffMember.active
                          ? "bg-neutral-950 text-white hover:bg-neutral-800"
                          : ""
                      }`}
                      size="sm"
                      variant={staffMember.active ? "outline" : "default"}
                      disabled={updatingId === id || resettingPassword}
                      onClick={() => requestStatusChange(staffMember)}
                    >
                      {updatingId === id
                        ? "Updating..."
                        : staffMember.active
                          ? "Deactivate"
                          : "Activate"}
                    </Button>

                    <Button
                      className="col-span-2 h-10 rounded-xl"
                      size="sm"
                      variant="outline"
                      disabled={updatingId === id || resettingPassword}
                      onClick={() => openPasswordResetDialog(staffMember)}
                    >
                      <KeyRound className="size-3.5" />
                      Reset password
                    </Button>
                  </div>
                </article>
              )
            })}

            {staff.length === 0 && (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-12 text-center md:col-span-2 xl:col-span-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                  <Users className="size-5 text-neutral-500" />
                </div>

                <p className="mt-4 font-bold">No staff accounts</p>

                <p className="mt-1 text-sm text-neutral-400">
                  Add your first staff member using the button above.
                </p>

                <Button
                  className="mt-5 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  onClick={openCreateDialog}
                >
                  <Plus className="size-4" />
                  Add staff
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </OwnerShell>
  )
}
