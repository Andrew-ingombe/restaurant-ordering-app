import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  QrCode,
  Save,
  X,
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

import { OwnerShell } from "../components/owner-shell"
import { createTable, getTables, updateTable } from "../lib/api"
import type { AuthUser, RestaurantTable } from "../lib/api"

import { TablesGridSkeleton } from "../components/page-skeletons"

type OwnerTablesPageProps = {
  user: AuthUser
  onLogout: () => void
}

export function OwnerTablesPage({ user, onLogout }: OwnerTablesPageProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editingName, setEditingName] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [copiedId, setCopiedId] = useState("")
  const [error, setError] = useState("")
  const [disableTarget, setDisableTarget] = useState<RestaurantTable | null>(
    null
  )

  useEffect(() => {
    void getTables()
      .then(setTables)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load tables"
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const resetCreateForm = () => {
    setName("")
  }

  const openCreateDialog = () => {
    setError("")
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  const closeCreateDialog = () => {
    if (submitting) return

    setCreateDialogOpen(false)
    resetCreateForm()
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const table = await createTable(name)

      setTables((current) => [...current, table])
      setCreateDialogOpen(false)
      resetCreateForm()
      toast.success(`${table.name} created`)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not create table"

      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const saveName = async (table: RestaurantTable) => {
    if (updatingId) return

    setUpdatingId(table.id)
    setError("")

    try {
      const updated = await updateTable(table.id, {
        name: editingName,
      })

      setTables((current) =>
        current.map((item) => (item.id === table.id ? updated : item))
      )

      setEditingId("")
      setEditingName("")
      toast.success(`Table renamed to ${updated.name}`)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not rename table"

      setError(message)
      toast.error(message)
    } finally {
      setUpdatingId("")
    }
  }

  const toggleTable = async (table: RestaurantTable) => {
    if (updatingId) return

    setUpdatingId(table.id)
    setError("")

    try {
      const updated = await updateTable(table.id, {
        active: !table.active,
      })

      setTables((current) =>
        current.map((item) => (item.id === table.id ? updated : item))
      )

      toast.success(
        updated.active
          ? `${updated.name} QR ordering is active`
          : `${updated.name} QR ordering has been disabled`
      )

      setDisableTarget(null)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update table"

      setError(message)
      toast.error(message)
    } finally {
      setUpdatingId("")
    }
  }

  const requestTableStatusChange = (table: RestaurantTable) => {
    if (table.active) {
      setDisableTarget(table)
      return
    }

    void toggleTable(table)
  }

  const copyMenuLink = async (table: RestaurantTable) => {
    try {
      await navigator.clipboard.writeText(table.menuUrl)
      setCopiedId(table.id)
      toast.success(`${table.name} menu link copied`)

      window.setTimeout(() => {
        setCopiedId("")
      }, 2000)
    } catch {
      const message = "Could not copy the menu link"
      setError(message)
      toast.error(message)
    }
  }

  const downloadQrCode = (table: RestaurantTable) => {
    const svg = document.getElementById(`qr-${table.id}`)

    if (!svg) {
      toast.error("Could not find the QR code")
      return
    }

    const content = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([content], {
      type: "image/svg+xml;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = `${table.name.replaceAll(" ", "-")}-qr.svg`
    link.click()

    URL.revokeObjectURL(url)
    toast.success(`${table.name} QR code downloaded`)
  }

  const activeTables = tables.filter((table) => table.active).length
  const inactiveTables = tables.length - activeTables

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="tables"
      contentClassName="min-w-0 space-y-5"
      headerContent={
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Customer ordering
          </p>

          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Tables and QR codes
          </h1>

          <p className="mt-1 text-sm text-neutral-400">
            Manage secure customer menu links for each table.
          </p>
        </div>
      }
      headerActions={
        <Button
          className="h-11 rounded-xl bg-[#ef1428] px-4 text-white hover:bg-[#d91023] sm:px-5"
          onClick={openCreateDialog}
        >
          <Plus className="size-4" />
          Add table
        </Button>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#fff0f1] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#ef1428] text-white">
            <QrCode className="size-4" />
          </div>

          <p className="mt-3 font-bold">QR ordering</p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Print or share a table QR code so customers can browse the menu and
            submit selections.
          </p>
        </div>
      }
    >
      <Dialog open={createDialogOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="max-h-[92svh] w-[calc(100%-2rem)] overflow-y-auto rounded-[28px] border-0 bg-white p-0 shadow-2xl sm:max-w-lg">
          <div className="p-5 md:p-6">
            <DialogHeader>
              <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                <Plus className="size-5" />
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight">
                Add restaurant table
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-400">
                A secure customer-menu QR code will be generated automatically.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-5" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="table-name">Table name or number</Label>

                <Input
                  id="table-name"
                  className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Table 6"
                  required
                />
              </div>

              {error && createDialogOpen && (
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
                  onClick={closeCreateDialog}
                >
                  Cancel
                </Button>

                <Button
                  className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create table"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(disableTarget)}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setDisableTarget(null)
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
                Disable table QR ordering?
              </DialogTitle>

              <DialogDescription className="text-sm leading-6 text-neutral-500">
                Customers scanning the QR code for{" "}
                <strong className="text-neutral-900">
                  {disableTarget?.name}
                </strong>{" "}
                will no longer be able to open the menu or submit an order
                request. Existing orders will remain unchanged.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 rounded-xl"
                variant="outline"
                disabled={Boolean(updatingId)}
                onClick={() => setDisableTarget(null)}
              >
                Keep active
              </Button>

              <Button
                className="h-12 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={Boolean(updatingId)}
                onClick={() => {
                  if (disableTarget) {
                    void toggleTable(disableTarget)
                  }
                }}
              >
                {updatingId === disableTarget?.id
                  ? "Disabling..."
                  : "Disable QR ordering"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="min-w-0 rounded-[24px] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-black">Table management</h2>

            <p className="mt-1 text-sm text-neutral-400">
              Rename tables, copy menu links, download QR codes, and control
              customer access.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {loading ? (
            <>
              <div className="h-7 w-16 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-7 w-20 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-7 w-20 animate-pulse rounded-full bg-neutral-200" />
            </>
          ) : (
            <>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {tables.length} total
              </Badge>

              <Badge className="rounded-full border-0 bg-emerald-50 px-3 py-1 text-emerald-700">
                {activeTables} active
              </Badge>

              <Badge className="rounded-full border-0 bg-neutral-100 px-3 py-1 text-neutral-600">
                {inactiveTables} inactive
              </Badge>
            </>
          )}
        </div>

        {error && !createDialogOpen && (
          <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <TablesGridSkeleton />
        ) : (
          <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {tables.map((table) => (
              <article
                key={table.id}
                className="min-w-0 overflow-hidden rounded-[22px] border border-neutral-100 bg-white p-4 transition hover:border-neutral-200 hover:bg-neutral-50"
              >
                <div className="grid min-w-0 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <div className="justify-self-center rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm sm:justify-self-start">
                    <QRCodeSVG
                      id={`qr-${table.id}`}
                      value={table.menuUrl}
                      size={112}
                      level="H"
                      fgColor="#171717"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                          Dine-in table
                        </p>

                        {editingId === table.id ? (
                          <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_40px_40px] gap-2">
                            <Input
                              className="h-10 min-w-0 rounded-xl border-0 bg-neutral-100 shadow-none"
                              value={editingName}
                              onChange={(event) =>
                                setEditingName(event.target.value)
                              }
                              autoFocus
                            />

                            <Button
                              className="size-10 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                              size="icon"
                              disabled={
                                updatingId === table.id || !editingName.trim()
                              }
                              onClick={() => void saveName(table)}
                            >
                              <Save className="size-4" />
                            </Button>

                            <Button
                              className="size-10 rounded-xl"
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                setEditingId("")
                                setEditingName("")
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <h3 className="mt-1 text-lg font-black break-words">
                            {table.name}
                          </h3>
                        )}
                      </div>

                      <Badge
                        className={`shrink-0 rounded-full border-0 ${
                          table.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {table.active && <Check className="size-3" />}
                        {table.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="mt-3 min-w-0 rounded-xl bg-neutral-100 px-3 py-2">
                      <p className="text-xs leading-5 break-all text-neutral-500">
                        {table.menuUrl}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Button
                    className="min-w-0 rounded-xl"
                    size="sm"
                    variant="outline"
                    disabled={editingId === table.id}
                    onClick={() => {
                      setEditingId(table.id)
                      setEditingName(table.name)
                    }}
                  >
                    <Pencil className="size-3.5 shrink-0" />
                    <span className="truncate">Rename</span>
                  </Button>

                  <Button
                    className="min-w-0 rounded-xl"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyMenuLink(table)}
                  >
                    {copiedId === table.id ? (
                      <>
                        <Check className="size-3.5 shrink-0 text-emerald-600" />
                        <span className="truncate">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5 shrink-0" />
                        <span className="truncate">Copy link</span>
                      </>
                    )}
                  </Button>

                  <Button
                    className="min-w-0 rounded-xl"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadQrCode(table)}
                  >
                    <Download className="size-3.5 shrink-0" />
                    <span className="truncate">Download</span>
                  </Button>

                  <Button
                    className={`min-w-0 rounded-xl ${
                      !table.active
                        ? "bg-neutral-950 text-white hover:bg-neutral-800"
                        : ""
                    }`}
                    size="sm"
                    variant={table.active ? "outline" : "default"}
                    disabled={updatingId === table.id}
                    onClick={() => requestTableStatusChange(table)}
                  >
                    <span className="truncate">
                      {updatingId === table.id
                        ? "Updating..."
                        : table.active
                          ? "Disable"
                          : "Enable"}
                    </span>
                  </Button>
                </div>
              </article>
            ))}

            {tables.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-8 text-center sm:p-12 lg:col-span-2 2xl:col-span-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                  <QrCode className="size-5 text-neutral-500" />
                </div>

                <p className="mt-4 font-bold">No restaurant tables</p>

                <p className="mt-1 text-sm text-neutral-400">
                  Create your first table to generate its QR code.
                </p>

                <Button
                  className="mt-5 rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  onClick={openCreateDialog}
                >
                  <Plus className="size-4" />
                  Add table
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </OwnerShell>
  )
}
