import { useEffect, useState } from "react"
import type { FormEvent } from "react"

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
import { Label } from "@workspace/ui/components/label"
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

import { createStaff, getStaff, updateStaffStatus } from "../lib/api"
import type { AuthUser, StaffRole, StaffUser } from "../lib/api"
import { useNavigate } from "react-router-dom"

type OwnerPageProps = {
  user: AuthUser
  onLogout: () => void
}

const getStaffId = (staff: StaffUser) => staff.id || staff._id || ""

export function OwnerPage({ user, onLogout }: OwnerPageProps) {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<StaffRole>("waiter")

  const navigate = useNavigate()

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
    }
  }

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">Restaurant Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.name}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => navigate("/owner/menu")}>Manage menu</Button>

            <Button variant="outline" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add staff member</CardTitle>
            <CardDescription>
              Create an account for a waiter or kitchen user.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-password">Temporary password</Label>
                <Input
                  id="staff-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as StaffRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="kitchen">Kitchen staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" disabled={submitting}>
                {submitting ? "Creating..." : "Create staff account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff accounts</CardTitle>
            <CardDescription>
              Manage access for restaurant staff.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading staff...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {staff.map((staffMember) => (
                      <TableRow key={getStaffId(staffMember)}>
                        <TableCell>
                          <p className="font-medium">{staffMember.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {staffMember.email}
                          </p>
                        </TableCell>

                        <TableCell className="capitalize">
                          {staffMember.role}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              staffMember.active ? "default" : "secondary"
                            }
                          >
                            {staffMember.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          {staffMember.role !== "owner" && (
                            <Button
                              size="sm"
                              variant={
                                staffMember.active ? "outline" : "default"
                              }
                              onClick={() => handleStatusChange(staffMember)}
                            >
                              {staffMember.active ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {staff.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No staff accounts found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
