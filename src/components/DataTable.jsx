import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, CheckSquare, Square, X } from 'lucide-react'

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found',
  onRowClick = null,
  enableSelection = true,
  onBulkDelete = null,
  isAdmin = true,
  wrapText = false,
  hideSearch = false,
  initialSearch = '',
  selectedIds: externalSelectedIds,
  setSelectedIds: externalSetSelectedIds
}) {
  const [search, setSearch]           = useState(initialSearch)
  const [isSearchOpen, setIsSearchOpen] = useState(!!initialSearch)
  const [sortKey, setSortKey]         = useState(null)
  const [sortDir, setSortDir]         = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize]       = useState(15)
  const [internalSelectedIds, setInternalSelectedIds] = useState([])
  
  const selectedIds = externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds
  const setSelectedIds = externalSetSelectedIds !== undefined ? externalSetSelectedIds : setInternalSelectedIds

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
  const containerRef = useRef(null)
  const [tableWidth, setTableWidth] = useState(0)

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

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
    <div className="space-y-3" ref={containerRef}>
      {/* Bulk Selection Action Bar */}
      {isAdmin && enableSelection && selectedIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 animate-slide-in shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-rose-700">
              {selectedIds.length} {selectedIds.length === 1 ? 'record' : 'records'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1e1e2d] hover:bg-rose-100 text-xs font-semibold text-gray-700 dark:text-white border border-rose-200 transition-colors"
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

      {!hideSearch && document.getElementById('topbar-actions') && createPortal(
        <div className="flex items-center gap-2" style={{ order: -1 }}>
          {isSearchOpen ? (
            <div className="relative w-48 animate-fade-in flex items-center">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white" />
              <input
                autoFocus
                type="text"
                placeholder="Search records…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-[#1e1e2d] border border-orange-200 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder-gray-400 text-gray-900 dark:text-white shadow-sm"
              />
              <button 
                onClick={() => { setIsSearchOpen(false); setSearch(''); }} 
                className="absolute right-2 text-gray-400 dark:text-white hover:text-gray-600 dark:text-white dark:text-white"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsSearchOpen(true)} 
              title="Search" 
              className="btn-ghost !p-1.5 !rounded-full"
            >
              <Search size={14} className={search ? "text-orange-500" : ""} />
            </button>
          )}
        </div>,
        document.getElementById('topbar-actions')
      )}

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
        <table ref={tableRef} className={`data-table ${wrapText ? 'wrap-table w-full' : ''}`}>
          <thead>
            <tr>
              {/* Checkbox Column */}
              {isAdmin && enableSelection && (
                <th className="w-10 text-center px-2 sm:sticky sm:left-0 bg-white dark:bg-[#1e1e2d] z-30 sm:shadow-[4px_0_12px_rgba(0,0,0,0.03)] sm:border-r border-gray-200 dark:border-gray-800">
                  <input
                    type="checkbox"
                    checked={allPaginatedSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1e1e2d] text-orange-500 focus:ring-orange-500 cursor-pointer"
                    title="Select All Rows"
                  />
                </th>
              )}
              {columns.map((col, idx) => {
                const isActions = col.key === '_actions' || col.key === 'actions'
                const isFirstData = idx === 0
                return (
                  <th
                    key={col.key || col.header}
                    onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                    className={`${col.className || ''} ${col.sortable !== false && col.key ? 'cursor-pointer select-none hover:text-orange-500' : ''} ${
                      isActions ? 'sm:sticky sm:right-0 bg-white dark:bg-[#1e1e2d]/95 backdrop-blur-md sm:shadow-[-6px_0_16px_rgba(0,0,0,0.05)] z-20 sm:border-l border-gray-200 dark:border-gray-800 text-right px-4' : ''
                    } ${
                      isFirstData ? `sm:sticky ${isAdmin && enableSelection ? 'sm:left-10' : 'sm:left-0'} bg-white dark:bg-[#1e1e2d] z-20 sm:shadow-[4px_0_12px_rgba(0,0,0,0.03)] sm:border-r border-gray-200 dark:border-gray-800` : ''
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
                <td colSpan={columns.length + (isAdmin && enableSelection ? 1 : 0)} className="text-center py-12 text-gray-500 dark:text-white dark:text-white">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading records…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (isAdmin && enableSelection ? 1 : 0)} className="text-center py-12 text-gray-500 dark:text-white dark:text-white">{emptyMessage}</td>
              </tr>
            ) : (
              paginatedData.map((row, i) => {
                const rowId = String(row.id || row.s_no)
                const isSelected = selectedIds.includes(rowId)
                return (
                  <tr
                    key={row.id || i}
                    className={`group animate-fade-in ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:bg-[#151521]' : ''} ${
                      isSelected ? 'bg-orange-50/50 border-orange-500/40' : ''
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {isAdmin && enableSelection && (
                      <td className="w-10 text-center px-2 sm:sticky sm:left-0 bg-white dark:bg-[#1e1e2d] z-20 sm:border-r border-gray-200 dark:border-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-[#151521]" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => toggleSelectRow(row, e)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1e1e2d] text-orange-500 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col, idx) => {
                      const isActions = col.key === '_actions' || col.key === 'actions'
                      const isFirstData = idx === 0
                      return (
                        <td
                          key={col.key || col.header}
                          className={`${col.className || ''} ${
                            isActions
                              ? 'sm:sticky sm:right-0 bg-white dark:bg-[#1e1e2d] group-hover:bg-gray-50 dark:group-hover:bg-[#151521] transition-colors sm:shadow-[-6px_0_16px_rgba(0,0,0,0.05)] z-10 sm:border-l border-gray-100 dark:border-gray-800/50 px-4 whitespace-nowrap'
                              : ''
                          } ${
                            isFirstData ? `sm:sticky ${isAdmin && enableSelection ? 'sm:left-10' : 'sm:left-0'} bg-white dark:bg-[#1e1e2d] group-hover:bg-gray-50 dark:group-hover:bg-[#151521] z-10 sm:border-r border-gray-100 dark:border-gray-800/50 sm:shadow-[4px_0_12px_rgba(0,0,0,0.02)]` : ''
                          }`}
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
      <div className="flex items-center justify-between gap-3 pt-2 text-xs text-gray-500 dark:text-white dark:text-white flex-wrap">
        <div className="flex items-center gap-4">
          {sorted.length > 0 ? (
            <span>
              Showing <strong className="text-gray-900 dark:text-white">{startRecord}</strong> to <strong className="text-gray-900 dark:text-white">{endRecord}</strong> of <strong className="text-gray-900 dark:text-white">{sorted.length}</strong> records {search ? '(filtered)' : ''}
            </span>
          ) : (
            <span>0 records found</span>
          )}
          
          {/* View Limit Selector */}
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1 text-gray-700 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm cursor-pointer"
            >
              <option value={15}>15 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={0}>All rows</option>
            </select>
          </div>
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 font-medium text-gray-700 dark:text-white">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
