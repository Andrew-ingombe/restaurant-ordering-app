import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"

type ApiHealth = {
  status: string
  service: string
}

export function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checkApi = async () => {
    setError(null)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/health`)

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data: ApiHealth = await response.json()
      setHealth(data)
    } catch (requestError) {
      setHealth(null)
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reach the API"
      )
    }
  }

  useEffect(() => {
    void checkApi()
  }, [])

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-6">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Restaurant Ordering</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Frontend and API deployment status
        </p>

        <div className="mt-6 rounded-lg border p-4">
          {health ? (
            <>
              <p className="font-medium text-green-600">API connected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {health.service}
              </p>
            </>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Checking API...</p>
          )}
        </div>

        <Button className="mt-4 w-full" onClick={checkApi}>
          Check API again
        </Button>
      </section>
    </main>
  )
}
