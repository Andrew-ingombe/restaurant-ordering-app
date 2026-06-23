import { Skeleton } from "@workspace/ui/components/skeleton"

type ListPageSkeletonProps = {
  rows?: number
}

type MenuGridSkeletonProps = {
  items?: number
}

export function AppLoadingSkeleton() {
  return (
    <main className="min-h-svh bg-[#f5f5f6]">
      <header className="border-b border-neutral-200 bg-white px-4 py-4 md:px-7">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-2xl" />

            <div className="space-y-2">
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="h-6 w-48 rounded-full" />
            </div>
          </div>

          <Skeleton className="size-11 rounded-xl md:w-36" />
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] space-y-5 p-4 md:p-6">
        <Skeleton className="h-20 w-full rounded-[20px]" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-[24px]" />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 rounded-[24px]" />
          <Skeleton className="h-96 rounded-[24px]" />
        </div>
      </div>
    </main>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[24px] bg-white p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <Skeleton className="mt-7 h-4 w-24 rounded-full" />
            <Skeleton className="mt-3 h-8 w-32 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <div className="rounded-[24px] bg-white p-5">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="mt-2 h-4 w-56 rounded-full" />

          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-5">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="mt-2 h-4 w-48 rounded-full" />

          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-xl" />

                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ListPageSkeleton({ rows = 6 }: ListPageSkeletonProps) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-[20px]" />

      <div className="rounded-[24px] bg-white p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-4 w-56 rounded-full" />
          </div>

          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-2xl border border-neutral-100 p-4"
            >
              <Skeleton className="size-11 shrink-0 rounded-xl" />

              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </div>

              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MenuGridSkeleton({ items = 4 }: MenuGridSkeletonProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="shrink-0 rounded-[20px] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
            <Skeleton className="h-10 w-24 shrink-0 rounded-xl bg-neutral-200" />
            <Skeleton className="h-10 w-28 shrink-0 rounded-xl bg-neutral-200" />
            <Skeleton className="h-10 w-32 shrink-0 rounded-xl bg-neutral-200" />
          </div>

          <Skeleton className="hidden h-10 w-20 shrink-0 rounded-xl bg-neutral-200 sm:block" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: items }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-black/5"
            >
              <Skeleton className="h-44 w-full rounded-none bg-neutral-200" />

              <div className="p-4">
                <Skeleton className="h-5 w-20 rounded-full bg-neutral-200" />

                <Skeleton className="mt-3 h-6 w-3/4 rounded-full bg-neutral-200" />

                <div className="mt-2 min-h-10 space-y-2">
                  <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
                  <Skeleton className="h-4 w-2/3 rounded-full bg-neutral-200" />
                </div>

                <Skeleton className="mt-5 h-14 w-full rounded-2xl bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function OrderDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="shrink-0 rounded-[20px] bg-white p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-xl bg-neutral-200" />
          <Skeleton className="h-10 w-24 rounded-xl bg-neutral-200" />
          <Skeleton className="hidden h-10 w-28 rounded-xl bg-neutral-200 sm:block" />

          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="hidden h-10 w-24 rounded-xl bg-neutral-200 sm:block" />
            <Skeleton className="h-6 w-24 rounded-full bg-neutral-200" />
          </div>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[24px] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-36 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
            </div>

            <Skeleton className="size-11 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl border border-neutral-100 p-4"
              >
                <Skeleton className="size-10 shrink-0 rounded-full bg-neutral-200" />

                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-full bg-neutral-200" />
                  <Skeleton className="h-3 w-1/3 rounded-full bg-neutral-200" />
                </div>

                <Skeleton className="h-5 w-20 rounded-full bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] bg-white p-5">
            <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
            <Skeleton className="mt-3 h-6 w-36 rounded-full bg-neutral-200" />

            <div className="mt-5 space-y-3">
              <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
              <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            </div>
          </div>

          <div className="rounded-[24px] bg-neutral-900 p-5">
            <Skeleton className="h-4 w-20 rounded-full bg-neutral-700" />
            <Skeleton className="mt-3 h-6 w-28 rounded-full bg-neutral-700" />
            <Skeleton className="mt-6 h-12 w-full rounded-xl bg-neutral-700" />
          </div>
        </div>
      </div>
    </div>
  )
}

type OrderCardsSkeletonProps = {
  items?: number
}

export function OrderCardsSkeleton({ items = 6 }: OrderCardsSkeletonProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="rounded-[20px] border border-neutral-100 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-11 rounded-full bg-neutral-200" />
            <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-5 space-y-2">
            <Skeleton className="h-3 w-20 rounded-full bg-neutral-200" />
            <Skeleton className="h-5 w-3/4 rounded-full bg-neutral-200" />
            <Skeleton className="h-3 w-1/2 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-4 rounded-2xl bg-neutral-100 p-3">
            <Skeleton className="h-3 w-16 rounded-full bg-neutral-200" />
            <Skeleton className="mt-2 h-4 w-3/4 rounded-full bg-neutral-200" />
            <Skeleton className="mt-2 h-3 w-1/2 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-4 space-y-2">
            {Array.from({ length: 2 }).map((_, itemIndex) => (
              <div
                key={itemIndex}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 px-3 py-2"
              >
                <Skeleton className="h-4 w-2/3 rounded-full bg-neutral-200" />
                <Skeleton className="h-4 w-16 rounded-full bg-neutral-200" />
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-end justify-between gap-3 border-t border-neutral-100 pt-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-12 rounded-full bg-neutral-200" />
              <Skeleton className="h-5 w-24 rounded-full bg-neutral-200" />
            </div>

            <div className="space-y-2">
              <Skeleton className="ml-auto h-3 w-14 rounded-full bg-neutral-200" />
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function OrdersToolbarSkeleton() {
  return (
    <section className="shrink-0 rounded-[20px] bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-52 rounded-xl bg-neutral-200" />

        <Skeleton className="h-10 w-32 rounded-xl bg-neutral-200" />

        <Skeleton className="order-last h-10 w-full rounded-xl bg-neutral-200 sm:order-none sm:ml-auto sm:w-64 lg:w-72" />

        <div className="ml-auto flex h-10 items-center gap-2 px-2 sm:ml-0">
          <Skeleton className="size-2 rounded-full bg-neutral-300" />
          <Skeleton className="hidden h-3 w-10 rounded-full bg-neutral-200 lg:block" />
        </div>
      </div>
    </section>
  )
}

export function RequestsToolbarSkeleton() {
  return (
    <section className="shrink-0 rounded-[20px] bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-28 rounded-xl bg-neutral-200" />
        <Skeleton className="h-10 w-32 rounded-xl bg-neutral-200" />
        <Skeleton className="h-10 w-36 rounded-xl bg-neutral-200" />

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 px-2">
            <Skeleton className="size-2 rounded-full bg-neutral-300" />
            <Skeleton className="hidden h-3 w-10 rounded-full bg-neutral-200 sm:block" />
          </div>

          <Skeleton className="h-10 w-24 rounded-xl bg-neutral-200" />
        </div>
      </div>
    </section>
  )
}

type RequestCardsSkeletonProps = {
  items?: number
}

export function RequestCardsSkeleton({ items = 6 }: RequestCardsSkeletonProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="rounded-[20px] border border-neutral-100 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20 rounded-full bg-neutral-200" />
              <Skeleton className="h-5 w-3/4 rounded-full bg-neutral-200" />
            </div>

            <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-100 p-3">
            <Skeleton className="size-10 shrink-0 rounded-full bg-neutral-200" />

            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
              <Skeleton className="h-3 w-1/2 rounded-full bg-neutral-200" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {Array.from({ length: 2 }).map((_, itemIndex) => (
              <div
                key={itemIndex}
                className="rounded-xl border border-neutral-100 p-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full bg-neutral-200" />

                  <Skeleton className="h-4 flex-1 rounded-full bg-neutral-200" />

                  <Skeleton className="h-4 w-16 rounded-full bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-end justify-between border-t border-neutral-100 pt-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-14 rounded-full bg-neutral-200" />
              <Skeleton className="h-5 w-24 rounded-full bg-neutral-200" />
            </div>

            <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
          </div>

          <Skeleton className="mt-4 h-11 w-full rounded-xl bg-neutral-200" />
        </div>
      ))}
    </div>
  )
}

export function EditOrderSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="shrink-0 rounded-[18px] bg-white p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-10 shrink-0 rounded-xl bg-neutral-200 sm:w-24" />

          <Skeleton className="hidden h-10 w-20 shrink-0 rounded-xl bg-neutral-200 sm:block" />

          <Skeleton className="h-10 min-w-0 flex-1 rounded-xl bg-neutral-200 sm:max-w-56 sm:flex-none" />

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Skeleton className="hidden h-4 w-16 rounded-full bg-neutral-200 md:block" />
            <Skeleton className="h-6 w-24 rounded-full bg-neutral-200" />
          </div>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-5 overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-h-0 min-w-0 overflow-hidden">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-black/5"
              >
                <Skeleton className="h-44 w-full rounded-none bg-neutral-200" />

                <div className="p-4">
                  <Skeleton className="h-5 w-20 rounded-full bg-neutral-200" />

                  <Skeleton className="mt-3 h-6 w-3/4 rounded-full bg-neutral-200" />

                  <div className="mt-2 min-h-10 space-y-2">
                    <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
                    <Skeleton className="h-4 w-2/3 rounded-full bg-neutral-200" />
                  </div>

                  <Skeleton className="mt-5 h-14 w-full rounded-2xl bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="hidden min-h-0 xl:block">
          <div className="space-y-5 rounded-[24px] bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-full bg-neutral-200" />
                <Skeleton className="h-6 w-32 rounded-full bg-neutral-200" />
              </div>

              <Skeleton className="size-11 rounded-full bg-neutral-200" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-2xl bg-neutral-200" />
              <Skeleton className="h-24 rounded-2xl bg-neutral-200" />
            </div>

            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />

            <div className="space-y-3 border-t border-neutral-100 pt-5">
              <Skeleton className="h-4 w-32 rounded-full bg-neutral-200" />
              <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
              <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            </div>

            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export function KitchenInsightsSkeleton() {
  return (
    <section className="mb-5 rounded-[24px] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl bg-neutral-200" />
          <Skeleton className="h-9 w-32 rounded-xl bg-neutral-200" />
          <Skeleton className="h-9 w-28 rounded-xl bg-neutral-200" />
        </div>

        <Skeleton className="h-9 w-28 rounded-xl bg-neutral-200" />
      </div>
    </section>
  )
}

export function KitchenColumnsSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden pb-4">
      {Array.from({ length: 4 }).map((_, columnIndex) => (
        <section
          key={columnIndex}
          className="w-[340px] min-w-[340px] rounded-[24px] bg-[#ececee] p-3 xl:w-[calc((100%_-_48px)/4)] xl:min-w-0"
        >
          <div className="rounded-2xl px-2 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full bg-neutral-300" />

                <div className="space-y-2">
                  <Skeleton className="h-4 w-20 rounded-full bg-neutral-300" />
                  <Skeleton className="h-3 w-24 rounded-full bg-neutral-300" />
                </div>
              </div>

              <Skeleton className="h-6 w-8 rounded-full bg-neutral-300" />
            </div>
          </div>

          <div className="mt-2 space-y-3">
            {Array.from({ length: columnIndex === 0 ? 2 : 1 }).map(
              (_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="overflow-hidden rounded-[22px] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20 rounded-full bg-neutral-200" />
                      <Skeleton className="h-5 w-32 rounded-full bg-neutral-200" />
                    </div>

                    <Skeleton className="h-6 w-16 rounded-full bg-neutral-200" />
                  </div>

                  <div className="mt-4 rounded-2xl bg-neutral-100 p-3">
                    <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
                    <Skeleton className="mt-2 h-3 w-1/2 rounded-full bg-neutral-200" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-10 w-full rounded-xl bg-neutral-200" />
                    <Skeleton className="h-10 w-full rounded-xl bg-neutral-200" />
                  </div>

                  <Skeleton className="mt-4 h-11 w-full rounded-xl bg-neutral-200" />
                </div>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

export function CustomerMenuSkeleton() {
  return (
    <main className="min-h-svh bg-white pb-28">
      <header className="border-b border-black/5 bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-2xl bg-neutral-200" />

              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded-full bg-neutral-200" />
                <Skeleton className="h-5 w-40 rounded-full bg-neutral-200" />
                <Skeleton className="h-3 w-20 rounded-full bg-neutral-200" />
              </div>
            </div>

            <Skeleton className="size-11 shrink-0 rounded-xl bg-neutral-200" />
          </div>

          <div className="mt-5 flex gap-6 overflow-hidden">
            <Skeleton className="h-8 w-24 shrink-0 rounded-lg bg-neutral-200" />
            <Skeleton className="h-8 w-28 shrink-0 rounded-lg bg-neutral-200" />
            <Skeleton className="h-8 w-24 shrink-0 rounded-lg bg-neutral-200" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="min-w-0">
              <Skeleton className="aspect-square w-full rounded-[26px] bg-neutral-200" />

              <div className="mt-3 space-y-2 px-1">
                <Skeleton className="h-4 w-16 rounded-full bg-neutral-200" />
                <Skeleton className="h-5 w-3/4 rounded-full bg-neutral-200" />
                <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
                <Skeleton className="h-4 w-20 rounded-full bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export function OwnerOrdersTableSkeleton() {
  return (
    <>
      <div className="hidden px-3 pb-3 md:block">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.8fr_1fr_0.7fr_44px] gap-4 border-b border-neutral-100 px-4 py-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-4 rounded-full bg-neutral-200" />
          ))}
        </div>

        <div>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.8fr_1fr_0.7fr_44px] items-center gap-4 border-b border-neutral-100 px-4 py-4"
            >
              <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />

              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
                <Skeleton className="h-3 w-1/2 rounded-full bg-neutral-200" />
              </div>

              <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />

              <div className="space-y-2">
                <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
                <Skeleton className="h-3 w-16 rounded-full bg-neutral-200" />
              </div>

              <Skeleton className="ml-auto h-4 w-16 rounded-full bg-neutral-200" />
              <Skeleton className="size-9 rounded-xl bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4 pt-1 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-dashed border-neutral-200 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32 rounded-full bg-neutral-200" />
                <Skeleton className="h-3 w-24 rounded-full bg-neutral-200" />
              </div>

              <Skeleton className="h-5 w-20 rounded-full bg-neutral-200" />
            </div>

            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
            </div>

            <Skeleton className="mt-4 h-4 w-2/3 rounded-full bg-neutral-200" />
          </div>
        ))}
      </div>
    </>
  )
}

export function OwnerOrderDetailSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
      <div className="space-y-5">
        <section className="rounded-[24px] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
              <Skeleton className="h-8 w-56 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-40 rounded-full bg-neutral-200" />
            </div>

            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-20 rounded-2xl bg-neutral-200"
              />
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
            </div>

            <Skeleton className="size-11 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl border border-neutral-100 p-4"
              >
                <Skeleton className="size-10 shrink-0 rounded-full bg-neutral-200" />

                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-full bg-neutral-200" />
                  <Skeleton className="h-3 w-1/3 rounded-full bg-neutral-200" />
                </div>

                <Skeleton className="h-5 w-20 rounded-full bg-neutral-200" />
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-5">
            <Skeleton className="h-5 w-24 rounded-full bg-neutral-200" />
            <Skeleton className="h-7 w-28 rounded-full bg-neutral-200" />
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-[24px] bg-white p-5">
          <Skeleton className="h-4 w-20 rounded-full bg-neutral-200" />
          <Skeleton className="mt-3 h-6 w-36 rounded-full bg-neutral-200" />

          <div className="mt-5 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5">
          <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
          <Skeleton className="mt-3 h-6 w-32 rounded-full bg-neutral-200" />

          <div className="mt-5 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
          </div>
        </section>
      </aside>
    </div>
  )
}

export function StaffCardsSkeleton() {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[20px] border border-neutral-100 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-11 rounded-full bg-neutral-200" />
            <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-5 space-y-2">
            <Skeleton className="h-6 w-3/4 rounded-full bg-neutral-200" />
            <Skeleton className="h-3 w-20 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-4/5 rounded-full bg-neutral-200" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-1/2 rounded-full bg-neutral-200" />
            </div>
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            <Skeleton className="h-9 w-full rounded-xl bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MenuCategoriesSkeleton() {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[20px] border border-neutral-100 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-11 shrink-0 rounded-full bg-neutral-200" />

            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full bg-neutral-200" />
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Skeleton className="h-6 w-2/3 rounded-full bg-neutral-200" />
            <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
            <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4">
            <Skeleton className="h-9 rounded-xl bg-neutral-200" />
            <Skeleton className="h-9 rounded-xl bg-neutral-200" />
          </div>

          <Skeleton className="mt-3 h-8 w-full rounded-xl bg-neutral-200" />
        </div>
      ))}
    </div>
  )
}

export function MenuItemsPageSkeleton() {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[124px] rounded-[22px] bg-neutral-200"
          />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <section className="self-start rounded-[24px] bg-white p-5">
          <Skeleton className="size-11 rounded-full bg-neutral-200" />

          <div className="mt-5 space-y-2">
            <Skeleton className="h-6 w-40 rounded-full bg-neutral-200" />
            <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
            <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
                <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
              </div>
            ))}

            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
              <Skeleton className="h-28 w-full rounded-2xl bg-neutral-200" />
            </div>

            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
          </div>
        </section>

        <section className="min-w-0 rounded-[24px] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-36 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-64 max-w-full rounded-full bg-neutral-200" />
            </div>

            <Skeleton className="h-7 w-20 rounded-full bg-neutral-200" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[20px] border border-neutral-100"
              >
                <Skeleton className="h-44 w-full rounded-none bg-neutral-200" />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-24 rounded-full bg-neutral-200" />
                      <Skeleton className="h-6 w-3/4 rounded-full bg-neutral-200" />
                    </div>

                    <Skeleton className="h-5 w-20 rounded-full bg-neutral-200" />
                  </div>

                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
                    <Skeleton className="h-4 w-2/3 rounded-full bg-neutral-200" />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4">
                    <Skeleton className="h-9 rounded-xl bg-neutral-200" />
                    <Skeleton className="h-9 rounded-xl bg-neutral-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function TablesGridSkeleton() {
  return (
    <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="min-w-0 overflow-hidden rounded-[22px] border border-neutral-100 bg-white p-4"
        >
          <div className="grid min-w-0 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
            <Skeleton className="size-[138px] justify-self-center rounded-2xl bg-neutral-200 sm:justify-self-start" />

            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-3 w-24 rounded-full bg-neutral-200" />
                  <Skeleton className="h-6 w-32 rounded-full bg-neutral-200" />
                </div>

                <Skeleton className="h-6 w-16 rounded-full bg-neutral-200" />
              </div>

              <Skeleton className="mt-4 h-14 w-full rounded-xl bg-neutral-200" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, buttonIndex) => (
              <Skeleton
                key={buttonIndex}
                className="h-9 rounded-xl bg-neutral-200"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RestaurantSettingsSkeleton() {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-[24px] bg-white p-5">
        <Skeleton className="size-11 rounded-full bg-neutral-200" />

        <div className="mt-5 space-y-2">
          <Skeleton className="h-6 w-52 rounded-full bg-neutral-200" />
          <Skeleton className="h-4 w-full rounded-full bg-neutral-200" />
          <Skeleton className="h-4 w-3/4 rounded-full bg-neutral-200" />
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-neutral-50 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <Skeleton className="h-4 w-20 rounded-full bg-neutral-200" />
              <Skeleton className="h-4 w-32 rounded-full bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40 rounded-full bg-neutral-200" />
            <Skeleton className="h-4 w-64 max-w-full rounded-full bg-neutral-200" />
          </div>

          <Skeleton className="h-10 w-32 rounded-xl bg-neutral-200" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-28 rounded-full bg-neutral-200" />
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
          </div>

          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
              <Skeleton className="h-12 w-full rounded-xl bg-neutral-200" />
            </div>
          ))}

          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-2 md:col-span-2">
              <Skeleton className="h-4 w-24 rounded-full bg-neutral-200" />
              <Skeleton className="h-24 w-full rounded-xl bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
