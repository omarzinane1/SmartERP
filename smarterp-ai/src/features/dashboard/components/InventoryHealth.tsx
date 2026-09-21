import { Boxes } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber } from '../../../lib/format'
import type { DashboardData } from '../types/dashboard.types'

export function InventoryHealth({
  data,
  currency,
}: {
  data: DashboardData['inventory']
  currency: string
}) {
  const total = data.segments.reduce((sum, segment) => sum + segment.count, 0)
  return (
    <section
      aria-labelledby="inventory-health-title"
      className="dashboard-card flex min-w-0 flex-col p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 id="inventory-health-title" className="dashboard-title">
            Santé du stock
          </h2>
          <p className="dashboard-caption">
            Valeur globale : {formatCurrency(data.value, currency)}
          </p>
        </div>
        <Boxes className="size-4 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-6 text-[9px] text-slate-500">
        Répartition par statut · {total} références
      </p>
      <div
        className="mt-2 flex h-3 overflow-hidden rounded"
        role="img"
        aria-label={data.segments
          .map((segment) => `${segment.label} : ${segment.count}`)
          .join(', ')}
      >
        {data.segments.map((segment) => (
          <div
            key={segment.label}
            title={`${segment.label} : ${segment.count}`}
            style={{
              backgroundColor: segment.color,
              width: `${total > 0 ? (segment.count / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-[10px]">
        {data.segments.map((segment, index) => (
          <li
            key={segment.label}
            className={index === data.segments.length - 1 ? 'col-span-2' : ''}
          >
            <span
              className="mr-1.5 inline-block size-1.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-slate-500">{segment.label} : </span>
            <strong className="font-semibold text-slate-600">
              {segment.count}
            </strong>
            {index === data.segments.length - 1 && (
              <span className="ml-1 text-[9px] text-slate-400">
                ({formatCurrency(data.dormantValue, currency)})
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <div className="flex flex-wrap justify-between gap-2 border-t border-[#edf0f6] pt-3 text-[9px]">
          <span className="text-slate-500">
            Rotation :{' '}
            <strong className="font-semibold text-slate-600">
              {formatNumber(data.turnover, 1)}× / an
            </strong>
          </span>
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={() =>
              toast.info(
                'Le suivi détaillé des stocks sera disponible avec le module Inventaire.',
              )
            }
          >
            Détails du stock
          </button>
        </div>
      </div>
    </section>
  )
}
