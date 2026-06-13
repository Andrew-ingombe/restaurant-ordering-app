import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { QRCodeSVG } from "qrcode.react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { createTable, getTables, updateTable } from "../lib/api"
import type { RestaurantTable } from "../lib/api"

export function OwnerTablesPage() {
  const navigate = useNavigate()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editingName, setEditingName] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
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
    }
  }

  const toggleTable = async (table: RestaurantTable) => {
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

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">Restaurant Tables</h1>
            <p className="text-sm text-muted-foreground">
              Create table QR codes for customer ordering.
            </p>
          </div>

          <Button variant="outline" onClick={() => navigate("/owner")}>
            Back to dashboard
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Add table</CardTitle>
          </CardHeader>

          <CardContent>
            <form
              className="flex max-w-md items-end gap-3"
              onSubmit={handleCreate}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="table-name">Table name or number</Label>
                <Input
                  id="table-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Table 1"
                  required
                />
              </div>

              <Button disabled={submitting}>
                {submitting ? "Creating..." : "Create table"}
              </Button>
            </form>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tables...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <Card key={table.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{table.name}</CardTitle>
                    <Badge variant={table.active ? "default" : "secondary"}>
                      {table.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex justify-center rounded-lg bg-white p-4">
                    <QRCodeSVG
                      id={`qr-${table.id}`}
                      value={table.menuUrl}
                      size={190}
                      level="H"
                    />
                  </div>

                  {editingId === table.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                      />

                      <Button onClick={() => void saveName(table)}>Save</Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setEditingId(table.id)
                        setEditingName(table.name)
                      }}
                    >
                      Rename
                    </Button>
                  )}

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard.writeText(table.menuUrl)
                    }
                  >
                    Copy menu link
                  </Button>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => downloadQrCode(table)}
                  >
                    Download QR code
                  </Button>

                  <Button
                    className="w-full"
                    variant={table.active ? "outline" : "default"}
                    onClick={() => void toggleTable(table)}
                  >
                    {table.active ? "Deactivate" : "Activate"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
