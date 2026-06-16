import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  QrCode,
  Save,
  X,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { OwnerShell } from "../components/owner-shell"
import { createTable, getTables, updateTable } from "../lib/api"
import type { AuthUser, RestaurantTable } from "../lib/api"

type OwnerTablesPageProps = {
  user: AuthUser
  onLogout: () => void
}

export function OwnerTablesPage({ user, onLogout }: OwnerTablesPageProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editingName, setEditingName] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [copiedId, setCopiedId] = useState("")
  const [error, setError] = useState("")

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

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const table = await createTable(name)
      setTables((current) => [...current, table])
      setName("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create table"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const saveName = async (table: RestaurantTable) => {
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
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not rename table"
      )
    } finally {
      setUpdatingId("")
    }
  }

  const toggleTable = async (table: RestaurantTable) => {
    setUpdatingId(table.id)
    setError("")

    try {
      const updated = await updateTable(table.id, {
        active: !table.active,
      })

      setTables((current) =>
        current.map((item) => (item.id === table.id ? updated : item))
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update table"
      )
    } finally {
      setUpdatingId("")
    }
  }

  const copyMenuLink = async (table: RestaurantTable) => {
    try {
      await navigator.clipboard.writeText(table.menuUrl)
      setCopiedId(table.id)

      window.setTimeout(() => {
        setCopiedId("")
      }, 2000)
    } catch {
      setError("Could not copy the menu link")
    }
  }

  const downloadQrCode = (table: RestaurantTable) => {
    const svg = document.getElementById(`qr-${table.id}`)

    if (!svg) return

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
  }

  const activeTables = tables.filter((table) => table.active).length

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="tables"
      contentClassName="space-y-5"
      headerContent={
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
            Customer ordering
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            Tables and QR codes
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Create secure menu links for every restaurant table.
          </p>
        </div>
      }
      sidebarPanel={
        <div className="rounded-2xl bg-[#fff0f1] p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#ef1428] text-white">
            <QrCode className="size-4" />
          </div>

          <p className="mt-3 font-bold">Customer ordering</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Print each table&apos;s QR code so customers can browse the menu and
            submit selections.
          </p>
        </div>
      }
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] bg-[#ef1428] p-5 text-white">
          <p className="text-sm text-white/75">Total tables</p>
          <p className="mt-5 text-3xl font-black">{tables.length}</p>
        </div>

        <div className="rounded-[22px] bg-white p-5">
          <p className="text-sm text-neutral-500">Active tables</p>
          <p className="mt-5 text-3xl font-black">{activeTables}</p>
        </div>

        <div className="rounded-[22px] bg-white p-5">
          <p className="text-sm text-neutral-500">Inactive tables</p>
          <p className="mt-5 text-3xl font-black">
            {tables.length - activeTables}
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-[24px] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
              <Plus className="size-5" />
            </div>

            <h2 className="mt-4 text-xl font-black">Add restaurant table</h2>
            <p className="mt-1 text-sm text-neutral-400">
              A secure customer-menu QR code is generated automatically.
            </p>
          </div>

          <form
            className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleCreate}
          >
            <div className="flex-1 space-y-2">
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

            <Button
              className="h-12 rounded-xl bg-[#ef1428] px-6 text-white hover:bg-[#d91023]"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create table"}
            </Button>
          </form>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[24px] bg-white p-12 text-center text-sm text-neutral-400">
          Loading tables...
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {tables.map((table) => (
            <article
              key={table.id}
              className="overflow-hidden rounded-[24px] bg-white"
            >
              <div
                className={`h-2 ${
                  table.active ? "bg-[#ef1428]" : "bg-neutral-300"
                }`}
              />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400 uppercase">
                      Dine-in table
                    </p>
                    <h2 className="mt-1 text-xl font-black">{table.name}</h2>
                  </div>

                  <Badge
                    className={`rounded-full border-0 ${
                      table.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {table.active && <Check className="size-3" />}
                    {table.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="mt-5 flex justify-center rounded-[20px] border border-dashed border-neutral-200 bg-[#fafafa] p-5">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <QRCodeSVG
                      id={`qr-${table.id}`}
                      value={table.menuUrl}
                      size={190}
                      level="H"
                      fgColor="#171717"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-neutral-100 px-3 py-2">
                  <p className="truncate text-xs text-neutral-500">
                    {table.menuUrl}
                  </p>
                </div>

                {editingId === table.id ? (
                  <div className="mt-4 flex gap-2">
                    <Input
                      className="h-11 rounded-xl border-0 bg-neutral-100 shadow-none"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      autoFocus
                    />

                    <Button
                      className="size-11 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                      size="icon"
                      disabled={updatingId === table.id || !editingName.trim()}
                      onClick={() => void saveName(table)}
                    >
                      <Save className="size-4" />
                    </Button>

                    <Button
                      className="size-11 rounded-xl"
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
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      className="rounded-xl"
                      variant="outline"
                      onClick={() => {
                        setEditingId(table.id)
                        setEditingName(table.name)
                      }}
                    >
                      <Pencil className="size-4" />
                      Rename
                    </Button>

                    <Button
                      className="rounded-xl"
                      variant="outline"
                      onClick={() => void copyMenuLink(table)}
                    >
                      {copiedId === table.id ? (
                        <>
                          <Check className="size-4 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" />
                          Copy link
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    className="rounded-xl"
                    variant="outline"
                    onClick={() => downloadQrCode(table)}
                  >
                    <Download className="size-4" />
                    Download QR
                  </Button>

                  <Button
                    className={`rounded-xl ${
                      !table.active
                        ? "bg-neutral-950 text-white hover:bg-neutral-800"
                        : ""
                    }`}
                    variant={table.active ? "outline" : "default"}
                    disabled={updatingId === table.id}
                    onClick={() => void toggleTable(table)}
                  >
                    {updatingId === table.id
                      ? "Updating..."
                      : table.active
                        ? "Deactivate"
                        : "Activate"}
                  </Button>
                </div>
              </div>
            </article>
          ))}

          {tables.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-12 text-center md:col-span-2 2xl:col-span-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                <QrCode className="size-5 text-neutral-500" />
              </div>

              <p className="mt-4 font-bold">No restaurant tables</p>
              <p className="mt-1 text-sm text-neutral-400">
                Create your first table to generate its QR code.
              </p>
            </div>
          )}
        </section>
      )}
    </OwnerShell>
  )
}
