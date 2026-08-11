import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, CheckSquare, Square } from 'lucide-react'

export default function DataTable({
  columns,
  data,
  loading,
  emptyMessage = 'No records found',
  onRowClick = null,
  enableSelection = true,
  onBulkDelete = null,
  isAdmin = true
}) {
  const [search, setSearch]           = useState('')
  const [sortKey, setSortKey]         = useState(null)
  const [sortDir, setSortDir]         = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize]       = useState(15)
  const [selectedIds, setSelectedIds] = useState([])

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

  // Reset to page 1 whenever filter/sort changes
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [search, sortKey, sortDir, pageSize])

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1

  const paginatedData = useMemo(() => {
    if (pageSize === 0) return sorted // 'All' mode
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, currentPage, pageSize])

  // Top Scrollbar Sync Logic
  const topScrollRef = useRef(null)
  const bottomScrollRef = useRef(null)
  const tableRef = useRef(null)
  const [tableWidth, setTableWidth] = useState(0)

  useEffect(() => {
    if (tableRef.current) {
      const observer = new ResizeObserver(entries => {
        setTableWidth(entries[0].target.offsetWidth)
      })
      observer.observe(tableRef.current)
      return () => observer.disconnect()
    }
  }, [paginatedData, columns])

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
    }
  }

  const handleBottomScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft
    }
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Selection Logic
  const allPaginatedSelected = useMemo(() => {
    if (paginatedData.length === 0) return false
    return paginatedData.every(r => selectedIds.includes(String(r.id || r.s_no)))
  }, [paginatedData, selectedIds])

  const toggleSelectAll = () => {
    if (allPaginatedSelected) {
      const currentPageIds = new Set(paginatedData.map(r => String(r.id || r.s_no)))
      setSelectedIds(prev => prev.filter(id => !currentPageIds.has(id)))
    } else {
      const currentPageIds = paginatedData.map(r => String(r.id || r.s_no))
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])))
    }
  }

  const toggleSelectRow = (row, e) => {
    e.stopPropagation()
    const id = String(row.id || row.s_no)
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedIds.length === 0) return
    const selectedRows = data.filter(r => selectedIds.includes(String(r.id || r.s_no)))
    onBulkDelete(selectedRows)
    setSelectedIds([])
  }

  const startRecord = pageSize > 0 ? (currentPage - 1) * pageSize + 1 : 1
  const endRecord   = pageSize > 0 ? Math.min(currentPage * pageSize, sorted.length) : sorted.length

  return (
    <div className="space-y-3">
      {/* Bulk Selection Action Bar */}
      {isAdmin && enableSelection && selectedIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-between gap-3 animate-slide-in shadow-xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-rose-200">
              {selectedIds.length} {selectedIds.length === 1 ? 'record' : 'records'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={handleBulkDelete}
              className="btn-danger py-1.5 px-4 text-xs font-bold"
            >
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Top Controls: Search Bar & Page Size Selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-xs w-full sm:w-auto">
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

        {/* View Limit Selector */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value={15}>15 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={0}>All rows</option>
          </select>
        </div>
      </div>

      {/* Dummy Top Scrollbar */}
      <div 
        ref={topScrollRef} 
        onScroll={handleTopScroll}
        className="w-full overflow-x-auto pb-1 custom-scrollbar-top"
      >
        <div style={{ width: tableWidth || '100%', height: '1px' }} />
      </div>

      {/* Table */}
      <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="table-container overflow-x-auto relative">
        <table ref={tableRef} className="data-table">
          <thead>
            <tr>
              {/* Checkbox Column */}
              {isAdmin && enableSelection && (
                <th className="w-10 text-center px-2">
                  <input
                    type="checkbox"
                    checked={allPaginatedSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    title="Select All Rows"
                  />
                </th>
              )}
              {columns.map(col => {
                const isActions = col.key === '_actions' || col.key === 'actions'
                return (
                  <th
                    key={col.key || col.header}
                    onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                    className={`${col.sortable !== false && col.key ? 'cursor-pointer select-none hover:text-white' : ''} ${
                      isActions ? 'sticky right-0 bg-slate-900/95 backdrop-blur-md shadow-[-6px_0_16px_rgba(0,0,0,0.6)] z-20 border-l border-slate-800 text-right px-4' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.key && sortKey === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (isAdmin && enableSelection ? 1 : 0)} className="text-center py-12 text-slate-500">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading records…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (isAdmin && enableSelection ? 1 : 0)} className="text-center py-12 text-slate-500">{emptyMessage}</td>
              </tr>
            ) : (
              paginatedData.map((row, i) => {
                const rowId = String(row.id || row.s_no)
                const isSelected = selectedIds.includes(rowId)
                return (
                  <tr
                    key={row.id || i}
                    className={`group animate-fade-in ${onRowClick ? 'cursor-pointer hover:bg-slate-800/60' : ''} ${
                      isSelected ? 'bg-purple-950/40 border-purple-500/40' : ''
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {isAdmin && enableSelection && (
                      <td className="w-10 text-center px-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => toggleSelectRow(row, e)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map(col => {
                      const isActions = col.key === '_actions' || col.key === 'actions'
                      return (
                        <td
                          key={col.key || col.header}
                          className={
                            isActions
                              ? 'sticky right-0 bg-slate-900 group-hover:bg-slate-800/90 transition-colors shadow-[-6px_0_16px_rgba(0,0,0,0.6)] z-10 border-l border-slate-700/60 px-4'
                              : ''
                          }
                        >
                          {col.render ? col.render(row) : (col.accessor ? col.accessor(row) : row[col.key]) ?? '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400 flex-wrap">
        <div>
          {sorted.length > 0 ? (
            <span>
              Showing <strong className="text-slate-200">{startRecord}</strong> to <strong className="text-slate-200">{endRecord}</strong> of <strong className="text-slate-200">{sorted.length}</strong> records {search ? '(filtered)' : ''}
            </span>
          ) : (
            <span>0 records found</span>
          )}
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 font-medium text-slate-300">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
