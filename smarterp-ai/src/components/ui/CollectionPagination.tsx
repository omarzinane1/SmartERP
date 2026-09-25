import { ChevronLeft, ChevronRight } from 'lucide-react'

export function CollectionPagination({ page, pageSize, count, onPage, onPageSize }: { page: number; pageSize: number; count: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  return <footer className="business-pagination">
    <span>{count} résultat(s)</span>
    <label>Par page <select aria-label="Résultats par page" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}><option>25</option><option>50</option><option>100</option></select></label>
    <span>Page {page} / {pages}</span>
    <button aria-label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button>
    <button aria-label="Page suivante" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button>
  </footer>
}
