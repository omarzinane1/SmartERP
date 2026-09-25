// Export simple partagé : montants numériques, cellules protégées des formules.
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value)
    return `"${(/^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
  }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
