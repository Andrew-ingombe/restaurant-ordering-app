import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { changePassword } from "../lib/api"
import type { AuthUser } from "../lib/api"

export function ChangePasswordPage({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }

    if (newPassword === currentPassword) {
      setError("New password must be different")
      return
    }

    setSubmitting(true)

    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
      })

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess(result.message)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not change password"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh bg-[#f5f5f6]">
      <header className="border-b border-black/5 bg-white px-4 py-4 md:px-7">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Button
            className="size-11 rounded-xl"
            size="icon"
            variant="outline"
            onClick={() => navigate(`/${user.role}`)}
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
              Account security
            </p>
            <h1 className="text-2xl font-black">Change password</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-5 p-4 md:p-7 lg:grid-cols-[1fr_420px]">
        <section className="rounded-[24px] bg-neutral-950 p-7 text-white">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
            <ShieldCheck className="size-5" />
          </div>

          <h2 className="mt-6 text-3xl font-black">Keep your account secure</h2>

          <p className="mt-3 max-w-md leading-7 text-white/60">
            Choose a password that is unique to this restaurant account and
            difficult for others to guess.
          </p>

          <div className="mt-8 space-y-3 text-sm text-white/70">
            <p>Use at least 8 characters.</p>
            <p>Avoid reusing passwords from other accounts.</p>
            <p>Do not share your staff password.</p>
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-[#fff0f1] text-[#ef1428]">
            <KeyRound className="size-5" />
          </div>

          <h2 className="mt-5 text-xl font-black">Update your password</h2>

          <p className="mt-1 text-sm text-neutral-400">
            Signed in as {user.email}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {[
              {
                id: "current-password",
                label: "Current password",
                value: currentPassword,
                setter: setCurrentPassword,
              },
              {
                id: "new-password",
                label: "New password",
                value: newPassword,
                setter: setNewPassword,
              },
              {
                id: "confirm-password",
                label: "Confirm new password",
                value: confirmPassword,
                setter: setConfirmPassword,
              },
            ].map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>{field.label}</Label>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

                  <Input
                    id={field.id}
                    className="h-12 rounded-xl border-0 bg-neutral-100 pl-11 shadow-none"
                    type="password"
                    autoComplete={
                      field.id === "current-password"
                        ? "current-password"
                        : "new-password"
                    }
                    value={field.value}
                    onChange={(event) => field.setter(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>
            ))}

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {success && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" />
                {success}
              </p>
            )}

            <Button
              className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Change password"
              )}
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}
