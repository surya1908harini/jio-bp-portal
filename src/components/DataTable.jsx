import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'

export default function DataTable({ columns, data, loading, emptyMessage = 'No records found', onRowClick = null }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const val = col.accessor ? col.accessor(row) : row[col.key]
        return String(val ?? '').toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          id="table-search"
          type="text"
          placeholder="Search records…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key || col.header}
                  onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                  className={col.sortable !== false && col.key ? 'cursor-pointer select-none hover:text-white' : ''}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.key && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-slate-500">
                <div className="w-6 h-6 border-2 border-jio-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading…
              </td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-slate-500">{emptyMessage}</td></tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={row.id || i} className={`animate-fade-in ${onRowClick ? 'cursor-pointer hover:bg-slate-800/60' : ''}`} onClick={() => onRowClick?.(row)}>
                  {columns.map(col => (
                    <td key={col.key || col.header}>
                      {col.render ? col.render(row) : (col.accessor ? col.accessor(row) : row[col.key]) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-400">
        <span>{sorted.length} record{sorted.length !== 1 ? 's' : ''} {search ? '(filtered)' : ''}</span>
      </div>
    </div>
  )
}
