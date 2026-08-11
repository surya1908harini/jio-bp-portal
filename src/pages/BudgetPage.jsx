import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Plus, Download, Upload, Pencil, Trash2, PieChart, TrendingUp, Clock, AlertTriangle,
  CheckCircle2, RefreshCw, LayoutGrid, List, Search, Eye, FileText, PieChart as PieChartIcon, ChevronLeft, ChevronRight
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

const ITEMS_PER_PAGE = 9

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
  const [viewMode, setViewMode]      = useState('grid') // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [currentPage, setCurrentPage] = useState(1)
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
    { key: 'description',         header: 'Description' },
    { key: 'arc_number',          header: 'ARC Number' },
    { key: 'work_order_number',   header: 'Work Order No',     render: r => <span className="font-semibold text-white">{r.work_order_number}</span> },
    {
      key: 'status', header: 'WO Status',
      render: r => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          r.status === 'Closed'
            ? 'bg-slate-800 text-slate-300 border border-slate-700'
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
            ? 'bg-slate-800 text-slate-400 border-slate-700'
            : status === 'active'
            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/50'
            : status === 'expiring_soon'
            ? 'bg-amber-950/80 text-amber-400 border-amber-700/50'
            : status === 'critical'
            ? 'bg-rose-950/80 text-rose-400 border-rose-700/50'
            : 'bg-slate-800 text-slate-400 border-slate-700'

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
            <div className="text-white text-xs font-mono font-medium">{formattedValidity || '—'}</div>
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
    { key: 'total_consumed',      header: 'Budget Consumed',   render: r => <span className="text-jio-red-400 font-semibold">{formatINR(r.total_consumed)}</span> },
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
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-jio-blue-800/50 text-jio-blue-400 hover:text-white transition-colors"><Pencil size={14} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-jio-red-900/50 text-jio-red-400 hover:text-white transition-colors"><Trash2 size={14} /></button>
        </div>
      )
    }] : []),
  ]

  const totalFoBudget = fyRecords.reduce((s, b) => s + (b.fo_total_budget || 0), 0)
  const totalConsumedBudget = fyRecords.reduce((s, b) => s + (b.total_consumed || 0), 0)
  const totalRemainingBudget = totalFoBudget - totalConsumedBudget

  return (
    <div className="space-y-5">
      {/* Header Banner & Executive Stat Cards */}
      <ModuleHeader
        title="Contract Budget Status"
        subtitle={`Browse, manage and track every work order in your budget library.`}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} title="Sync JMS Work Orders" className="btn-ghost !px-2 !py-1 !text-xs">
              <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleExport} title="Export" className="btn-ghost !px-2 !py-1 !text-xs"><Download size={13} /></button>
            {isAdmin && (
              <>
                <button onClick={() => setImportOpen(true)} title="Import" className="btn-ghost !px-2 !py-1 !text-xs"><Upload size={13} /></button>
                <button onClick={openAdd} title="Add Budget Work Order" className="btn-primary !px-2 !py-1 !text-xs"><Plus size={13} /></button>
              </>
            )}
          </div>
        }
        stats={[
          { icon: FileText, label: 'Work Orders', value: fyRecords.length, sub: activeFy === 'overall' ? 'All FY' : `FY ${activeFy}`, color: 'purple' },
          { icon: TrendingUp, label: 'FO Total Budget', value: formatINR(totalFoBudget), sub: 'Total Allocation', color: 'blue' },
          { icon: PieChartIcon, label: 'Budget Consumed', value: formatINR(totalConsumedBudget), sub: 'Total Spent', color: 'red' },
          { icon: CheckCircle2, label: 'Remaining Budget', value: formatINR(totalRemainingBudget), sub: 'Available Balance', color: totalRemainingBudget >= 0 ? 'green' : 'red' },
        ]}
      />

      {/* Filter & View Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <FyTabs basePath="/budget" />
          <SlotTabs slots={VALIDITY_SLOTS} activeSlot={activeSlot} onChange={setActiveSlot} />
        </div>

        {/* Search & Mode Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search work orders, operations, ARC..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field pl-9 py-2 text-xs"
            />
          </div>

        {/* Grid / List View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'grid'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={14} /> Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List size={14} /> List
          </button>
        </div>
      </div>
    </div>

      {/* ── Content View Rendering (Grid Cards vs List Table) ── */}
      {viewMode === 'grid' ? (
        <div className="space-y-6" ref={gridContainerRef}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedRecords.length === 0 ? (
              <div className="col-span-full text-center py-12 glass-card text-slate-400">
                No budget work orders found for the selected filter criteria.
              </div>
            ) : (
              paginatedRecords.map(b => {
                const total = b.fo_total_budget || 0
                const consumed = b.total_consumed || 0
                const remaining = total - consumed
                const isPositive = remaining >= 0
                const { daysRemaining, status } = parseValidity(b.validity_of_contract)
                const isClosed = b.status === 'Closed'

                const badgeColor =
                  status === 'active'
                    ? 'bg-emerald-950/90 text-emerald-400 border-emerald-700/60'
                    : status === 'expiring_soon'
                    ? 'bg-amber-950/90 text-amber-400 border-amber-700/60'
                    : status === 'critical'
                    ? 'bg-rose-950/90 text-rose-400 border-rose-700/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700'

                const bannerGradient = isClosed
                  ? 'bg-gradient-to-r from-slate-700 via-slate-600 to-slate-500'
                  : 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500'

                return (
                  <div
                    key={b.id}
                    className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-xl overflow-hidden group hover-elevate interactive-card flex flex-col justify-between"
                    onClick={() => setSelectedRow(b)}
                  >
                    {/* Top Cover Banner */}
                    <div className={`${bannerGradient} p-4 text-white relative`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                          isClosed ? 'bg-black/30 text-slate-200' : 'bg-white/20 text-white'
                        }`}>
                          {isClosed ? 'CLOSED WORK ORDER' : 'ACTIVE WORK ORDER'}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md">
                          {b.financial_year || activeFy}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white tracking-tight leading-snug">
                        WO #{b.work_order_number || '—'}
                      </h3>
                      <p className="text-xs text-purple-100 opacity-90 truncate mt-0.5">
                        {b.operation || 'No operation details'}
                      </p>
                    </div>

                    {/* Body Content */}
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-medium">ARC Number:</span>
                        <span className="text-white font-mono font-semibold">{b.arc_number || '—'}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
                        <span className="text-slate-400 font-medium">Validity Period:</span>
                        <div className="text-right">
                          <div className="text-white font-mono text-xs font-semibold">
                            {formatValidityRange(b.validity_of_contract) || b.validity_of_contract || '—'}
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border mt-0.5 inline-block ${badgeColor}`}>
                            {daysRemaining !== null && daysRemaining !== undefined ? `${daysRemaining} days remaining` : 'No Expiry'}
                          </span>
                        </div>
                      </div>

                      {/* Financial Metrics Box */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 text-center">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">FO Budget</p>
                          <p className="text-xs font-bold text-blue-400 mt-0.5">{formatINR(total)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">Consumed</p>
                          <p className="text-xs font-bold text-rose-400 mt-0.5">{formatINR(consumed)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">Remaining</p>
                          <p className={`text-xs font-bold mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatINR(remaining)}
                          </p>
                        </div>
                      </div>

                      {b.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 italic bg-slate-950/30 p-2 rounded-xl">
                          "{b.description}"
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                      <PdfCell
                        pdfUrl={b.pdf_url}
                        folder="budget"
                        isAdmin={isAdmin}
                        onSave={url => pdfMutation.mutateAsync({ id: b.id, pdf_url: url })}
                        onDelete={() => pdfMutation.mutateAsync({ id: b.id, pdf_url: null })}
                      />
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-800 text-indigo-400 hover:text-white transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-rose-950 text-rose-400 hover:text-white transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination Controls Bar (Exactly 10 items per page) */}
          {sortedRecords.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-400 font-medium">
                Showing <strong className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
                <strong className="text-white">{Math.min(currentPage * ITEMS_PER_PAGE, sortedRecords.length)}</strong> of{' '}
                <strong className="text-white">{sortedRecords.length}</strong> work orders
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 hover:bg-slate-700 transition-colors"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List Table View Mode */
        <div className="glass-card p-4">
          <DataTable
            columns={columns}
            data={sortedRecords}
            loading={isLoading}
            isAdmin={isAdmin}
            enableSelection={true}
            onBulkDelete={handleBulkDelete}
            emptyMessage="No budget entries found for selected criteria"
            onRowClick={(row) => setSelectedRow(row)}
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
              <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}{f.required && ' *'}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''} onChange={handleChange}
                required={f.required} className="input-field" step={f.type === 'number' ? '1' : undefined}
                placeholder={f.name === 'payment_timeframe_days' ? 'e.g. 15 or 30' : ''} />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Work Order Status</label>
            <select name="status" value={form.status || 'Active'} onChange={handleChange} className="input-field">
              <option value="Active">Active Work Order</option>
              <option value="Closed">WO Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Financial Year</label>
            <select name="financial_year" value={form.financial_year || CURRENT_FY} onChange={handleChange} className="input-field">
              <option value="2023-24">FY 2023-24</option>
              <option value="2024-25">FY 2024-25</option>
              <option value="2025-26">FY 2025-26</option>
              <option value="2026-27">FY 2026-27</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea name="description" value={form.description || ''} onChange={handleChange} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-slate-700 mt-2">
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
    </div>
  )
}
