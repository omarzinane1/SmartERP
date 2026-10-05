import { toast } from 'sonner'
import { apiClient } from './axios'

export async function downloadAPIFile(path: string, filename: string, data?: unknown) {
  try {
    const response = data === undefined ? await apiClient.get(path, { responseType: 'blob' }) : await apiClient.post(path, data, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data), anchor = document.createElement('a')
    anchor.href = url; anchor.download = filename; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    toast.error('Téléchargement refusé ou indisponible. Vérifiez vos droits et réessayez.')
  }
}

export const downloadEntityExport = (entity: string, ids: number[], format: 'csv' | 'xlsx' = 'csv') => downloadAPIFile(`/exports/${entity}/`, `${entity}.${format}`, { ids, format })
