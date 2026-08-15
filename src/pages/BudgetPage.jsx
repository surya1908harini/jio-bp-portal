import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Plus, Download, Upload, Pencil, Trash2, PieChart, TrendingUp, Clock, AlertTriangle,
  CheckCircle2, RefreshCw, LayoutGrid, List, Search, Eye, FileText, PieChart as PieChartIcon, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { budgetDb, jmsDb } from '../lib/db'
import { formatINR, exportToExcel, CURRENT_FY, parseValidity, formatValidityRange, getBudgetRecordFy } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import PdfCell from '../components/PdfCell'
import FyTabs from '../components/FyTabs'
import SlotTabs from '../components/SlotTabs'
import SummaryModal from '../components/SummaryModal'
import ModuleHeader from '../components/ModuleHeader'

const EMPTY_FORM = {
  operation: '', description: '', arc_number: '', work_order_number: '',
  validity_of_contract: '', fo_total_budget: '', payment_timeframe_days: '30', status: 'Active',
  financial_year: CURRENT_FY,
}

const IMPORT_MAP = {
  'SNo': null,
  'OPERATION': 'operation', 'Operation': 'operation', 'operation': 'operation',
  'Description': 'description', 'description': 'description',
  'ARC Number': 'arc_number', 'ARC No': 'arc_number', 'arc_number': 'arc_number',
  'Work order number': 'work_order_number', 'Work Order Number': 'work_order_number', 'Work Order No': 'work_order_number', 'work_order_number': 'work_order_number',
  'Validity of Contract': 'validity_of_contract', 'Validity': 'validity_of_contract', 'validity_of_contract': 'validity_of_contract',
  'FO Total Budget': 'fo_total_budget', 'FO Total Budget Amount': 'fo_total_budget', 'fo_total_budget': 'fo_total_budget',
}

const BUDGET_IMPORT_COLUMNS = [
  'operation','description','arc_number','work_order_number',
  'validity_of_contract','fo_total_budget',
]

const ITEMS_PER_PAGE = 12

export default function BudgetPage() {
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const { fy: paramFy } = useParams()
  const [searchParams] = useSearchParams()
  const activeFy = searchParams.get('fy') || paramFy || CURRENT_FY
  const initialSearch = searchParams.get('search') || ''

  const [formOpen, setFormOpen]       = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editRow, setEditRow]       = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [selectedRow, setSelectedRow] = useState(null)
  const [activeSlot, setActiveSlot]  = useState('all')
  const [viewMode, setViewMode]      = useState('grid')
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [isSearchOpen, setIsSearchOpen] = useState(!!initialSearch)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const gridContainerRef = useRef(null)

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    setTimeout(() => {
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  useEffect(() => {
    const s = searchParams.get('search')
    if (s) setSearchQuery(s)
  }, [searchParams])

  const VALIDITY_SLOTS = [
    { key: 'all',           label: 'All Work Orders' },
    { key: 'wo_active',     label: 'Active Work Orders' },
    { key: 'wo_closed',     label: 'Closed Work Orders' },
    { key: 'active',        label: 'Contract Active (> 90 Days)' },
    { key: 'expiring_soon', label: 'Expiring Soon (≤ 90 Days)' },
    { key: 'critical',      label: 'Critical (≤ 30 Days)' },
    { key: 'expired',       label: 'Expired' },
  ]

  const { data: allBudgetRaw = [], isLoading } = useQuery({
    queryKey: ['budget', 'all'],
    queryFn: () => budgetDb.listAll(),
  })

  const allRecords = allBudgetRaw

  const fyRecords = useMemo(() => {
    if (activeFy === 'overall') return allRecords
    return allRecords.filter(r => getBudgetRecordFy(r) === activeFy)
  }, [allRecords, activeFy])

  const filteredRecords = useMemo(() => {
    return fyRecords.filter(r => {
      const isClosed = r.status === 'Closed'
      if (activeSlot === 'wo_active' && isClosed) return false
      if (activeSlot === 'wo_closed' && !isClosed) return false

      // Closed work orders do not belong in expired/expiring warning slots
      if (isClosed && ['expiring_soon', 'critical', 'expired'].includes(activeSlot)) return false

      const { daysRemaining } = parseValidity(r.validity_of_contract)
      if (activeSlot === 'active' && !isClosed && !(daysRemaining === null || daysRemaining > 90)) return false
      if (activeSlot === 'expiring_soon' && !(daysRemaining !== null && daysRemaining <= 90 && daysRemaining > 0)) return false
      if (activeSlot === 'critical' && !(daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0)) return false
      if (activeSlot === 'expired' && !(daysRemaining !== null && daysRemaining <= 0)) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const wo = String(r.work_order_number || '').toLowerCase()
        const op = String(r.operation || '').toLowerCase()
        const arc = String(r.arc_number || '').toLowerCase()
        const desc = String(r.description || '').toLowerCase()
        if (!wo.includes(q) && !op.includes(q) && !arc.includes(q) && !desc.includes(q)) return false
      }

      return true
    })
  }, [fyRecords, activeSlot, searchQuery])

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const fyA = getBudgetRecordFy(a)
      const fyB = getBudgetRecordFy(b)
      if (fyA !== fyB) {
        if (fyA === CURRENT_FY) return -1
        if (fyB === CURRENT_FY) return 1
        return fyB.localeCompare(fyA)
      }
      const resA = parseValidity(a.validity_of_contract)
      const resB = parseValidity(b.validity_of_contract)
      const tA = resA.endDate ? resA.endDate.getTime() : 0
      const tB = resB.endDate ? resB.endDate.getTime() : 0
      if (tA !== tB) return tB - tA
      return String(b.work_order_number || '').localeCompare(String(a.work_order_number || ''), undefined, { numeric: true })
    })
  }, [filteredRecords])

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeSlot, searchQuery, activeFy])

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / ITEMS_PER_PAGE))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedRecords.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedRecords, currentPage])

  const totalBudget    = fyRecords.reduce((s, r) => s + (r.fo_total_budget    || 0), 0)
  const totalConsumed  = fyRecords.reduce((s, r) => s + (r.total_consumed     || 0), 0)
  const totalBalance   = totalBudget - totalConsumed

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const { fy, ...cleanPayload } = payload
      const derivedFy = getBudgetRecordFy(cleanPayload)
      const fyVal = derivedFy || (activeFy === 'overall' ? CURRENT_FY : activeFy)
      const dataToSave = { ...cleanPayload, financial_year: fyVal }
      return editRow
        ? budgetDb.update(editRow.id, dataToSave)
        : budgetDb.create(dataToSave, user?.id)
    },
    onSuccess: () => { qc.invalidateQueries(['budget']); toast.success(editRow ? 'Budget updated ✓' : 'Budget created ✓'); handleClose() },
    onError:   (e) => toast.error(e?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: budgetDb.delete,
    onSuccess: () => { qc.invalidateQueries(['budget']); toast.success('Budget entry deleted') },
    onError:   (e) => toast.error(e?.message || 'Delete failed'),
  })

  const pdfMutation = useMutation({
    mutationFn: ({ id, pdf_url }) => budgetDb.update(id, { pdf_url }),
    onSuccess: () => qc.invalidateQueries(['budget']),
  })

  const syncMutation = useMutation({
    mutationFn: () => budgetDb.syncMissingFromJms(user?.id),
    onSuccess: (count) => {
      qc.invalidateQueries(['budget'])
      if (count > 0) {
        toast.success(`Synced ${count} new work orders from JMS into Budget!`)
      } else {
        toast.success('All JMS work orders are up to date in Budget ✓')
      }
    },
    onError: (e) => toast.error(e?.message || 'Sync failed'),
  })

  const importRecords = async (rows) => {
    const mapped = rows.map(raw => {
      const rec = {}
      for (const [k, v] of Object.entries(raw)) {
        const dbKey = IMPORT_MAP[k] ?? IMPORT_MAP[k.trim()]
        if (dbKey && v !== '' && v !== null && v !== undefined) rec[dbKey] = v
      }
      if (rec.validity_of_contract) {
        rec.financial_year = getBudgetRecordFy(rec)
      }
      return rec
    }).filter(r => r.work_order_number)

    if (!mapped.length) throw new Error('No valid rows found. Ensure "Work order number" column exists.')
    const count = await budgetDb.bulkInsert(mapped, user?.id, activeFy)
    qc.invalidateQueries(['budget'])
    return count
  }

  const openEdit = (row) => { setEditRow(row); setForm({ ...EMPTY_FORM, ...row, payment_timeframe_days: String(row.payment_timeframe_days || '30'), status: row.status || 'Active' }); setFormOpen(true) }
  const openAdd  = ()    => { setEditRow(null); setForm(EMPTY_FORM); setFormOpen(true) }
  const handleClose  = () => { setFormOpen(false); setEditRow(null); setForm(EMPTY_FORM) }
  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const handleDelete = (id) => { if (window.confirm('Delete this budget entry?')) deleteMutation.mutate(id) }
  const handleBulkDelete = async (selectedRows) => {
    if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected Budget Work Orders?`)) {
      for (const r of selectedRows) {
        await budgetDb.delete(r.id)
      }
      qc.invalidateQueries(['budget'])
      toast.success(`Deleted ${selectedRows.length} Budget Work Orders successfully ✓`)
    }
  }
  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedRecords.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedRecords.map(r => r.id))
    }
  }

  const handleBatchStatus = async (status) => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Mark ${selectedIds.length} work orders as ${status}?`)) return
    
    try {
      for (const id of selectedIds) {
        const record = allRecords.find(r => r.id === id)
        if (record) {
          await budgetDb.update(id, { ...record, status })
        }
      }
      qc.invalidateQueries(['budget'])
      setSelectedIds([])
      toast.success(`Marked ${selectedIds.length} records as ${status}`)
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} work orders?`)) return
    
    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id)
    }
    setSelectedIds([])
    toast.success(`Deleted ${selectedIds.length} records`)
  }

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const handleExport = () => {
    const exportRows = sortedRecords.map(r => {
      const total = r.fo_total_budget || 0
      const consumed = r.total_consumed || 0
      const remaining = total - consumed
      return {
        'Work Order Number': r.work_order_number || '—',
        'ARC Number': r.arc_number || '—',
        'Operation': r.operation || '—',
        'Description': r.description || '—',
        'Validity Range': formatValidityRange(r.validity_of_contract) || r.validity_of_contract || '—',
        'FO Total Budget (₹)': total,
        'Total Consumed (₹)': consumed,
        'Remaining Balance (₹)': remaining,
        'Payment Timeframe (Days)': r.payment_timeframe_days || 30,
        'WO Status': r.status === 'Closed' ? 'Closed' : 'Active',
      }
    })
    exportToExcel(exportRows, `Budget_${activeFy}.xlsx`, 'Budget Work Orders')
    toast.success('Excel downloaded ✓')
  }

  const columns = [
    { key: 'operation',           header: 'Operation' },
    // { key: 'description',         header: 'Description' },
    { key: 'arc_number',          header: 'ARC Number' },
    { key: 'work_order_number',   header: 'Work Order No',     render: r => <span className="font-semibold text-gray-900 dark:text-white">{r.work_order_number}</span> },
    {
      key: 'status', header: 'WO Status',
      render: r => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          r.status === 'Closed'
            ? 'bg-gray-50 dark:bg-[#151521] text-gray-500 dark:text-white dark:text-white border border-gray-200 dark:border-gray-800'
            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
        }`}>
          {r.status === 'Closed' ? 'WO Closed' : 'Active'}
        </span>
      )
    },
    {
      key: 'payment_timeframe_days', header: 'Payment Timeframe',
      render: r => <span className="text-amber-400 font-semibold">{r.payment_timeframe_days || 30} Days</span>
    },
    {
      key: 'validity_of_contract', header: 'Validity (Days Remaining)',
      render: r => {
        if (!r) return '—'
        const valStr = r.validity_of_contract || ''
        let daysRemaining = null
        let status = 'unknown'
        let formattedValidity = valStr

        try {
          const res = parseValidity(valStr)
          daysRemaining = res.daysRemaining
          status = res.status
          formattedValidity = formatValidityRange(valStr)
        } catch (e) {
          formattedValidity = valStr
        }

        const isClosed = r.status === 'Closed'

        const badgeColor =
          isClosed
            ? 'bg-gray-50 dark:bg-[#151521] text-gray-500 dark:text-white dark:text-white border-gray-200 dark:border-gray-800'
            : status === 'active'
            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/50'
            : status === 'expiring_soon'
            ? 'bg-amber-950/80 text-amber-400 border-amber-700/50'
            : status === 'critical'
            ? 'bg-rose-950/80 text-rose-400 border-rose-700/50'
            : 'bg-gray-50 dark:bg-[#151521] text-gray-500 dark:text-white dark:text-white border-gray-200 dark:border-gray-800'

        const badgeText =
          isClosed
            ? 'WO Closed'
            : daysRemaining === null || daysRemaining === undefined
            ? 'No Expiry'
            : daysRemaining <= 0
            ? 'Expired'
            : `${daysRemaining} days remaining`

        return (
          <div className="space-y-1 min-w-[170px]">
            <div className="text-gray-900 dark:text-white text-xs font-mono font-medium">{formattedValidity || '—'}</div>
            {daysRemaining !== null && daysRemaining !== undefined && (
              <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>
                <Clock size={11} />
                <span>{badgeText}</span>
              </div>
            )}
          </div>
        )
      }
    },
    { key: 'fo_total_budget',     header: 'FO Total Budget',   render: r => <span className="text-blue-400 font-semibold">{formatINR(r.fo_total_budget)}</span> },
    { key: 'total_consumed',      header: 'Budget Consumed',   render: r => <span className="text-red-500 font-semibold">{formatINR(r.total_consumed)}</span> },
    {
      key: 'balance_available', header: 'Remaining Budget',
      render: r => {
        const total = r.fo_total_budget || 0
        const consumed = r.total_consumed || 0
        const remaining = total - consumed
        const isPositive = remaining >= 0
        return (
          <span className={`font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-jio-red-400'}`}>
            {formatINR(remaining)}
          </span>
        )
      }
    },
    {
      key: 'pdf', header: 'PDF Doc', sortable: false,
      render: r => (
        <PdfCell pdfUrl={r.pdf_url} folder="budget" isAdmin={isAdmin}
          onSave={url => pdfMutation.mutateAsync({ id: r.id, pdf_url: url })}
          onDelete={() => pdfMutation.mutateAsync({ id: r.id, pdf_url: null })} />
      )
    },
    ...(isAdmin ? [{
      key: '_actions', header: 'Actions', sortable: false,
      render: r => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-jio-blue-800/50 text-jio-blue-400 hover:text-gray-900 dark:text-white transition-colors"><Pencil size={14} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-jio-red-900/50 text-jio-red-400 hover:text-gray-900 dark:text-white transition-colors"><Trash2 size={14} /></button>
        </div>
      )
    }] : []),
  ]

  const totalFoBudget = fyRecords.reduce((s, b) => s + (b.fo_total_budget || 0), 0)
  const totalConsumedBudget = fyRecords.reduce((s, b) => s + (b.total_consumed || 0), 0)
  const totalRemainingBudget = totalFoBudget - totalConsumedBudget

  return (
    <div className="space-y-0">
      {document.getElementById('topbar-center') && createPortal(
        <div className="flex items-center gap-2">
          <SlotTabs slots={VALIDITY_SLOTS} activeSlot={activeSlot} onChange={setActiveSlot} />
        </div>,
        document.getElementById('topbar-center')
      )}
      {document.getElementById('topbar-actions') && createPortal(
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isSearchOpen ? (
            <div className="relative w-full sm:w-48 animate-fade-in flex items-center">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white" />
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder-gray-400 text-gray-900 dark:text-white shadow-sm"
              />
              <button 
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} 
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
              <Search size={14} className={searchQuery ? "text-orange-500" : ""} />
            </button>
          )}
          {viewMode === 'grid' && isAdmin && (
            <button 
              onClick={handleSelectAll} 
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white rounded-full hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 transition-all shrink-0"
            >
              {selectedIds.length === paginatedRecords.length && paginatedRecords.length > 0 ? 'Deselect' : 'Select All'}
            </button>
          )}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-800 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'grid' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 dark:text-white dark:text-white hover:text-orange-500'
              }`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 dark:text-white dark:text-white hover:text-orange-500'
              }`}
            >
              <List size={13} />
            </button>
          </div>
          <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} title="Sync" className="btn-ghost !p-1.5 !rounded-full"><RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} /></button>
          <button onClick={handleExport} title="Export" className="btn-ghost !p-1.5 !rounded-full"><Download size={13} /></button>
          {isAdmin && (
            <>
              <button onClick={() => setImportOpen(true)} title="Import" className="btn-ghost !p-1.5 !rounded-full"><Upload size={13} /></button>
              <button onClick={openAdd} title="Add" className="btn-primary !p-1.5 !rounded-full"><Plus size={13} /></button>
            </>
          )}
          <FyTabs basePath="/budget" />
        </div>,
        document.getElementById('topbar-actions')
      )}

      {/* ── Content View Rendering (Grid Cards vs List Table) ── */}
      {viewMode === 'grid' ? (
        <div className="space-y-6" ref={gridContainerRef}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 group">
            {sortedRecords.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-white dark:text-white shadow-sm">
                No budget work orders found for the selected filter criteria.
              </div>
            ) : (
              paginatedRecords.map(b => {
                const total = b.fo_total_budget || 0
                const consumed = b.total_consumed || 0
                const bal = total - consumed
                return (
                  <div key={b.id} className="min-h-[300px] bg-white dark:bg-[#1e1e2d] p-4 rounded-2xl relative group/card hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-gray-200 dark:border-gray-800 hover:border-orange-500/50 shadow-sm hover:shadow-lg overflow-hidden" onClick={() => setSelectedRow(b)}>
                    {isAdmin && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-white dark:bg-[#1e1e2d]/90 backdrop-blur-md p-1 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm z-10">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(b) }} className="p-1 hover:text-orange-500 text-gray-500 dark:text-white dark:text-white"><Pencil size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(b.id) }} className="p-1 hover:text-rose-500 text-gray-500 dark:text-white dark:text-white"><Trash2 size={14} /></button>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3 mt-1">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          {isAdmin && (
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(b.id)}
                              onChange={() => toggleSelection(b.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-orange-500 focus:ring-orange-500 cursor-pointer"
                            />
                          )}
                        </div>
                        <h3 className="font-extrabold text-gray-900 dark:text-white text-sm truncate" title={b.work_order_number}>{b.work_order_number || '—'}</h3>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-white truncate mt-0.5">ARC: <span className="text-gray-600 dark:text-white dark:text-white">{b.arc_number || '—'}</span></p>
                        <p className="text-[10px] font-semibold text-blue-600 mt-0.5">{b.financial_year || activeFy} • {b.status === 'Closed' ? 'Closed' : 'Active'}</p>
                      </div>

                    </div>
                    
                    {/* Inner Black Card (Matching the Template) */}
                    <div className="flex flex-col gap-2 mb-4 bg-white dark:bg-[#1e1e2d] p-3 rounded-xl border border-gray-800 shadow-inner">
                      <div className="flex flex-col justify-center overflow-hidden border-b border-gray-700/50 pb-2 mb-1">
                        <p className="text-[10px] font-medium text-gray-400 dark:text-white mb-0.5 uppercase tracking-wider shrink-0">Validity</p>
                        <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-snug whitespace-normal break-normal">{formatValidityRange(b.validity_of_contract) || b.validity_of_contract || '—'}</p>
                      </div>
                      <div className="flex flex-col justify-center overflow-hidden pt-1">
                        <p className="text-[10px] font-medium text-gray-400 dark:text-white mb-0.5 uppercase tracking-wider shrink-0">Operation</p>
                        <p className="text-[11px] font-black text-amber-400 leading-snug whitespace-normal break-normal">{b.operation || '—'}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mt-auto border-t border-gray-100 dark:border-gray-800/50 pt-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-white dark:text-white uppercase tracking-widest">Total</span>
                        <span className="text-sm font-black text-blue-600">{formatINR(total)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-gradient-to-r from-orange-500 to-orange-500Dark rounded-full relative" style={{ width: `${Math.min(100, total > 0 ? (consumed/total)*100 : 0)}%` }}>
                          <div className="absolute inset-0 bg-white dark:bg-[#1e1e2d]/20 w-full animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', transform: 'skewX(-20deg)' }}></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-end pt-1">
                        <div>
                          <span className="text-[9px] font-bold text-gray-400 dark:text-white uppercase tracking-wider block mb-0.5">Consumed</span>
                          <span className="text-xs font-bold text-red-500">{formatINR(consumed)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-gray-400 dark:text-white uppercase tracking-wider block mb-0.5">Remaining</span>
                          <span className={`text-xs font-black ${bal < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatINR(bal)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Footer Actions */}
                    <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800/50 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                      <PdfCell
                        pdfUrl={b.pdf_url}
                        folder="budget"
                        isAdmin={isAdmin}
                        onSave={url => pdfMutation.mutateAsync({ id: b.id, pdf_url: url })}
                        onDelete={() => pdfMutation.mutateAsync({ id: b.id, pdf_url: null })}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination Controls Bar (Exactly 10 items per page) */}
          {sortedRecords.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e2d] p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-gray-500 dark:text-white dark:text-white font-medium">
                Showing <strong className="text-gray-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
                <strong className="text-gray-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, sortedRecords.length)}</strong> of{' '}
                <strong className="text-gray-900 dark:text-white">{sortedRecords.length}</strong> work orders
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1)
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-gray-400 dark:text-white">...</span>}
                        <button
                          onClick={() => handlePageChange(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                            currentPage === p
                              ? 'bg-orange-500 border-orange-500 text-white shadow-md'
                              : 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:border-orange-500 hover:text-orange-500'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:bg-gray-50 dark:bg-[#151521] hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List Table View Mode */
        <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
          <DataTable
            columns={columns}
            data={sortedRecords}
            loading={isLoading}
            isAdmin={isAdmin}
            enableSelection={true}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            emptyMessage="No budget entries found for selected criteria"
            onRowClick={(row) => setSelectedRow(row)}
            hideSearch={true}
          />
        </div>
      )}

      {/* Modal */}
      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit Budget Entry' : 'Add Budget Work Order'} size="max-w-xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          {[
            { name: 'operation',            label: 'Operation' },
            { name: 'arc_number',           label: 'ARC Number' },
            { name: 'work_order_number',    label: 'Work Order Number', required: true },
            { name: 'validity_of_contract', label: 'Validity of Contract' },
            { name: 'fo_total_budget',      label: 'FO Total Budget',   type: 'number' },
            { name: 'payment_timeframe_days', label: 'Expected Payment Timeframe (Days)', type: 'number' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">{f.label}{f.required && ' *'}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''} onChange={handleChange}
                required={f.required} className="input-field" step={f.type === 'number' ? '1' : undefined}
                placeholder={f.name === 'payment_timeframe_days' ? 'e.g. 15 or 30' : ''} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">Work Order Status</label>
            <select name="status" value={form.status || 'Active'} onChange={handleChange} className="input-field">
              <option value="Active">Active Work Order</option>
              <option value="Closed">WO Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">Financial Year</label>
            <select name="financial_year" value={form.financial_year || CURRENT_FY} onChange={handleChange} className="input-field">
              <option value="2023-24">FY 2023-24</option>
              <option value="2024-25">FY 2024-25</option>
              <option value="2025-26">FY 2025-26</option>
              <option value="2026-27">FY 2026-27</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">Description</label>
            <textarea name="description" value={form.description || ''} onChange={handleChange} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800 mt-2">
            <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving…' : editRow ? 'Update Entry' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)}
        onImport={importRecords} columnMap={BUDGET_IMPORT_COLUMNS} title="Import Budget Records" />

      {/* Summary Modal - opens when a card/row is clicked */}
      <SummaryModal row={selectedRow} onClose={() => setSelectedRow(null)} />

      {/* Batch Action Toolbar */}
      {selectedIds.length > 0 && isAdmin && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1e1e2d] backdrop-blur-md border border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.2)] p-3 rounded-2xl flex items-center gap-4 z-50 animate-fade-in">
          <span className="text-sm font-bold text-gray-500 dark:text-white dark:text-white">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBatchStatus('Active')} className="btn-primary !py-1.5 !px-3 !text-xs">Mark Active</button>
            <button onClick={() => handleBatchStatus('Closed')} className="btn-ghost !py-1.5 !px-3 !text-xs border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:bg-[#151521]">Mark Closed</button>
            <button onClick={handleBatchDelete} className="btn-danger !py-1.5 !px-3 !text-xs">Delete</button>
            <button onClick={() => setSelectedIds([])} className="btn-ghost !py-1.5 !px-2 !text-xs ml-2 border-transparent hover:bg-gray-50 dark:bg-[#151521]"><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
