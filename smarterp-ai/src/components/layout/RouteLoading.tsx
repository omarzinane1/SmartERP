import { Spinner } from '../ui/Spinner'

export function RouteLoading() {
  return (
    <main className="grid min-h-svh place-items-center bg-white text-slate-600">
      <div role="status" className="flex items-center gap-3 text-sm">
        <Spinner className="size-5" />
        Chargement…
      </div>
    </main>
  )
}
