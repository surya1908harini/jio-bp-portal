import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Search, Filter, Calendar, FileText, Receipt, DollarSign, Download, Clock, CheckCircle2,
  TrendingUp, Globe, Building, ArrowRight, RefreshCw, Calculator, Layers
} from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import DataTable from '../components/DataTable'
import RecordDetailModal from '../components/RecordDetailModal'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, exportToExcel, FINANCIAL_YEARS } from '../lib/utils'

const MONTHS = [
  { value: '1',  label: 'January' },
  { value: '2',  label: 'February' },
  { value: '3',  label: 'March' },
  { value: '4',  label: 'April' },
  { value: '5',  label: 'May' },
  { value: '6',  label: 'June' },
  { value: '7',  label: 'July' },
  { value: '8',  label: 'August' },
  { value: '9',  label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const YEARS = ['2023', '2024', '2025', '2026', '2027']

export default function SearchEnginePage() {
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('jms') // 'jms' or 'invoice'
  const [showFilters, setShowFilters] = useState(false)

  // Fetch Database Data
  const { data: jmsList = [], isLoading: jmsLoading }         = useQuery({ queryKey: ['jms', 'all'],     queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [], isLoading: invoiceLoading } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }                             = useQuery({ queryKey: ['budget', 'all'],   queryFn: () => budgetDb.listAll() })

  // JMS Search Filters (Multi-Select)
  const [selectedJmsNos, setSelectedJmsNos]         = useState([])
  const [selectedJmsWorkOrders, setSelectedJmsWorkOrders] = useState([])
  const [jmsStartDate, setJmsStartDate]             = useState('')
  const [jmsEndDate, setJmsEndDate]                 = useState('')
  const [jmsKeyword, setJmsKeyword]                 = useState('')

  // Invoice Search Filters (Multi-Select)
  const [selectedInvNos, setSelectedInvNos]         = useState([])
  const [selectedInvWorkOrders, setSelectedInvWorkOrders] = useState([])
  const [selectedInvMonths, setSelectedInvMonths]   = useState([])
  const [selectedInvYears, setSelectedInvYears]     = useState([])
  const [invKeyword, setInvKeyword]                 = useState('')

  const [selectedRecord, setSelectedRecord] = useState(null)

  // Pre-fill Work Order from URL if navigated from Budget Page
  useEffect(() => {
    const queryWo = searchParams.get('search')
    if (queryWo) {
      setSelectedJmsWorkOrders([queryWo])
      setSelectedInvWorkOrders([queryWo])
      setShowFilters(true) // Open filters automatically if query is present
      // Optionally remove the query from URL after applying so it doesn't get stuck on refresh
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  // Options for Dropdowns
  const allJmsNoOptions = useMemo(() => {
    const set = new Set()
    jmsList.forEach(j => j.jms_no && set.add(j.jms_no.trim()))
    return Array.from(set).sort().map(val => ({ value: val, label: `JMS #${val}` }))
  }, [jmsList])

  const allInvNoOptions = useMemo(() => {
    const set = new Set()
    invoiceList.forEach(i => i.inv_number && set.add(i.inv_number.trim()))
    return Array.from(set).sort().map(val => ({ value: val, label: `INV #${val}` }))
  }, [invoiceList])

  const workOrderOptions = useMemo(() => {
    const set = new Set()
    jmsList.forEach(j => j.work_order_number && set.add(j.work_order_number.trim()))
    invoiceList.forEach(i => i.work_order_number && set.add(i.work_order_number.trim()))
    budgetList.forEach(b => b.work_order_number && set.add(b.work_order_number.trim()))
    return Array.from(set).sort().map(val => ({ value: val, label: `WO: ${val}` }))
  }, [jmsList, invoiceList, budgetList])

  // ── JMS Filtered Results & Aggregations ────────────────────────
  const filteredJms = useMemo(() => {
    return jmsList.filter(j => {
      // 1. Multi-Select JMS Numbers
      if (selectedJmsNos.length > 0) {
        const jmsNo = String(j.jms_no || '').trim()
        if (!selectedJmsNos.includes(jmsNo)) return false
      }

      // 2. Multi-Select Work Orders
      if (selectedJmsWorkOrders.length > 0) {
        const wo = String(j.work_order_number || '').trim()
        if (!selectedJmsWorkOrders.includes(wo)) return false
      }

      // 3. Keyword Search
      if (jmsKeyword.trim()) {
        const q = jmsKeyword.toLowerCase().trim()
        const jmsNo = String(j.jms_no || '').toLowerCase()
        const desc  = String(j.work_description || '').toLowerCase()
        const site  = String(j.site || '').toLowerCase()
        if (!jmsNo.includes(q) && !desc.includes(q) && !site.includes(q)) return false
      }

      // 4. Date Range Filter
      const dateStr = j.jms_create_date || j.inv_date || j.a1_release_date || j.created_at
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          if (jmsStartDate) {
            const start = new Date(jmsStartDate)
            if (d < start) return false
          }
          if (jmsEndDate) {
            const end = new Date(jmsEndDate)
            end.setHours(23, 59, 59, 999)
            if (d > end) return false
          }
        }
      }

      return true
    })
  }, [jmsList, selectedJmsNos, selectedJmsWorkOrders, jmsKeyword, jmsStartDate, jmsEndDate])

  const totalJmsNetValue = useMemo(() => {
    return filteredJms.reduce((sum, j) => sum + (Number(j.net_amount) || 0), 0)
  }, [filteredJms])

  const jmsReleasedCount = useMemo(() => {
    return filteredJms.filter(j => j.status === 'Released by A3' || j.status === 'Invoiced').length
  }, [filteredJms])

  // ── Invoice Filtered Results & Aggregations ───────────────────
  const filteredInvoices = useMemo(() => {
    return invoiceList.filter(inv => {
      // 1. Multi-Select Invoice Numbers
      if (selectedInvNos.length > 0) {
        const invNo = String(inv.inv_number || '').trim()
        if (!selectedInvNos.includes(invNo)) return false
      }

      // 2. Multi-Select Work Orders
      if (selectedInvWorkOrders.length > 0) {
        const wo = String(inv.work_order_number || '').trim()
        if (!selectedInvWorkOrders.includes(wo)) return false
      }

      // 3. Multi-Select Months & Years
      const dateStr = inv.inv_date || inv.full_amount_received_date || inv.created_at
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          const m = (d.getMonth() + 1).toString()
          const y = d.getFullYear().toString()

          if (selectedInvMonths.length > 0 && !selectedInvMonths.includes(m)) return false
          if (selectedInvYears.length > 0 && !selectedInvYears.includes(y)) return false
        }
      }

      // 4. Keyword Search
      if (invKeyword.trim()) {
        const q = invKeyword.toLowerCase().trim()
        const invNo = String(inv.inv_number || '').toLowerCase()
        const jmsNo = String(inv.jms_no || '').toLowerCase()
        const desc  = String(inv.work_description || '').toLowerCase()
        const site  = String(inv.site || '').toLowerCase()
        if (!invNo.includes(q) && !jmsNo.includes(q) && !desc.includes(q) && !site.includes(q)) return false
      }

      return true
    })
  }, [invoiceList, selectedInvNos, selectedInvWorkOrders, selectedInvMonths, selectedInvYears, invKeyword])

  const totalInvGrandTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + (Number(i.grand_total) || 0), 0)
  }, [filteredInvoices])

  const totalInvReceived = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + (Number(i.received_bill_amount) || 0), 0)
  }, [filteredInvoices])

  const resetJmsFilters = () => {
    setSelectedJmsNos([])
    setSelectedJmsWorkOrders([])
    setJmsStartDate('')
    setJmsEndDate('')
    setJmsKeyword('')
  }

  const resetInvFilters = () => {
    setSelectedInvNos([])
    setSelectedInvWorkOrders([])
    setSelectedInvMonths([])
    setSelectedInvYears([])
    setInvKeyword('')
  }

  const handleExportJms = () => {
    exportToExcel(filteredJms, `JMS_Search_Results.xlsx`, 'JMS Results')
  }

  const handleExportInvoices = () => {
    exportToExcel(filteredInvoices, `Invoice_Search_Results.xlsx`, 'Invoice Results')
  }

  const jmsColumns = [
    { key: 'jms_no',           header: 'JMS No',        render: r => <span className="font-semibold text-white">{r.jms_no}</span> },
    { key: 'jms_create_date',  header: 'JMS Date',       render: r => formatDate(r.jms_create_date || r.inv_date) },
    { key: 'period_of_work',   header: 'Period' },
    { key: 'work_order_number',header: 'Work Order',    render: r => <span className="font-semibold text-slate-200">{r.work_order_number}</span> },
    { key: 'net_amount',       header: 'Net Amount',     render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.net_amount)}</span> },
    { key: 'site',             header: 'Site' },
    { key: 'work_description', header: 'Description' },
    { key: 'status',           header: 'Status',         render: r => <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">{r.status || 'Pending'}</span> },
  ]

  const invColumns = [
    { key: 'inv_number',               header: 'Invoice Number',     render: r => <span className="font-semibold text-white">{r.inv_number}</span> },
    { key: 'inv_date',                 header: 'Inv Date',           render: r => formatDate(r.inv_date) },
    { key: 'jms_no',                   header: 'JMS No',             render: r => <span className="font-semibold text-purple-300">{r.jms_no}</span> },
    { key: 'site',                     header: 'Site' },
    { key: 'work_description',         header: 'Description' },
    { key: 'total',                    header: 'Net Amount',         render: r => <span className="text-blue-400 font-medium">{formatINR(r.total)}</span> },
    { key: 'grand_total',              header: 'Grand Total',        render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.grand_total)}</span> },
    { key: 'received_bill_amount',     header: 'Received Amount',    render: r => <span className="text-amber-400 font-semibold">{formatINR(r.received_bill_amount)}</span> },
    { key: 'payment_status',           header: 'Payment Status',     render: r => <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">{r.payment_status || 'Pending'}</span> },
  ]

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <ModuleHeader
        title="SEARCH"
        subtitle="Multi-select query engine for JMS numbers, Work Orders, date ranges, and monthly/yearly invoice aggregations."
      />

      {/* Main Search Mode Tabs & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md w-fit">
          <button
            onClick={() => setActiveTab('jms')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'jms'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText size={15} />
            JMS Search & Multi-Select Engine
          </button>

          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'invoice'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt size={15} />
            Invoice Search & Multi-Select Engine
          </button>
        </div>

        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all ${
            showFilters 
              ? 'bg-slate-700 text-white border-slate-600 shadow-inner' 
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Filter size={15} /> {showFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
        </button>
      </div>

      {/* ═══ TAB 1: JMS SEARCH ENGINE ══════════════════════════════════ */}
      {activeTab === 'jms' && (
        <div className="space-y-6">
          {/* Query Filter Controls Panel */}
          {showFilters && (
            <div className="glass-card p-5 space-y-4 border-l-4 border-l-purple-500 relative z-30 animate-slide-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={16} className="text-purple-400" /> JMS Multi-Select Query Controls
              </h2>
              <button onClick={resetJmsFilters} className="btn-ghost text-xs">
                <RefreshCw size={13} /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Multi-Select JMS Numbers */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Multi-Select JMS Numbers:
                </label>
                <MultiSelectDropdown
                  options={allJmsNoOptions}
                  selected={selectedJmsNos}
                  onChange={setSelectedJmsNos}
                  placeholder="All JMS Numbers"
                />
              </div>

              {/* 2. Multi-Select Work Orders */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Multi-Select Work Orders:
                </label>
                <MultiSelectDropdown
                  options={workOrderOptions}
                  selected={selectedJmsWorkOrders}
                  onChange={setSelectedJmsWorkOrders}
                  placeholder="All Work Orders"
                />
              </div>

              {/* 3. Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Period From (Start Date):
                </label>
                <input
                  type="date"
                  value={jmsStartDate}
                  onChange={e => setJmsStartDate(e.target.value)}
                  className="input-field py-1.5"
                />
              </div>

              {/* 4. End Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Period To (End Date):
                </label>
                <input
                  type="date"
                  value={jmsEndDate}
                  onChange={e => setJmsEndDate(e.target.value)}
                  className="input-field py-1.5"
                />
              </div>
            </div>
          </div>
          )}

          {/* Aggregation Summary Cards Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-purple-800/50 bg-purple-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider mb-1">Matching JMS Records</p>
              <p className="text-xl font-extrabold text-white">{filteredJms.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Selected Multi-Query Results</p>
            </div>

            <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-1">Total JMS Net Value</p>
              <p className="text-xl font-extrabold text-emerald-400 font-mono">{formatINR(totalJmsNetValue)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Aggregated Net Amount</p>
            </div>

            <div className="rounded-2xl border border-blue-800/50 bg-blue-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-1">Released by A3</p>
              <p className="text-xl font-extrabold text-white">{jmsReleasedCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Ready for Invoicing</p>
            </div>

            <div className="rounded-2xl border border-amber-800/50 bg-amber-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">Pending Approvals</p>
              <p className="text-xl font-extrabold text-amber-400">{filteredJms.length - jmsReleasedCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">In Approval Pipeline</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} className="text-purple-400" /> JMS Multi-Select Query Results ({filteredJms.length} rows)
              </h3>
              <button onClick={handleExportJms} className="btn-ghost text-xs">
                <Download size={13} /> Export Results to Excel
              </button>
            </div>

            <DataTable
              columns={jmsColumns}
              data={filteredJms}
              loading={jmsLoading}
              emptyMessage="No JMS records match your selected criteria"
              onRowClick={(row) => setSelectedRecord({ record: row, type: 'jms' })}
            />
          </div>
        </div>
      )}

      {/* ═══ TAB 2: INVOICE MONTHLY / YEARLY SEARCH ENGINE ═══════════════ */}
      {activeTab === 'invoice' && (
        <div className="space-y-6">
          {/* Query Filter Controls Panel */}
          {showFilters && (
            <div className="glass-card p-5 space-y-4 border-l-4 border-l-cyan-500 relative z-30 animate-slide-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={16} className="text-cyan-400" /> Invoice Multi-Select Query Controls
              </h2>
              <button onClick={resetInvFilters} className="btn-ghost text-xs">
                <RefreshCw size={13} /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Multi-Select Invoices */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Multi-Select Invoices:
                </label>
                <MultiSelectDropdown
                  options={allInvNoOptions}
                  selected={selectedInvNos}
                  onChange={setSelectedInvNos}
                  placeholder="All Invoices"
                />
              </div>

              {/* 2. Multi-Select Work Orders */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Multi-Select Work Orders:
                </label>
                <MultiSelectDropdown
                  options={workOrderOptions}
                  selected={selectedInvWorkOrders}
                  onChange={setSelectedInvWorkOrders}
                  placeholder="All Work Orders"
                />
              </div>

              {/* 3. Multi-Select Months */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Multi-Select Months:
                </label>
                <MultiSelectDropdown
                  options={MONTHS}
                  selected={selectedInvMonths}
                  onChange={setSelectedInvMonths}
                  placeholder="All Months"
                />
              </div>

              {/* 4. Multi-Select Years */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Multi-Select Years:
                </label>
                <MultiSelectDropdown
                  options={YEARS.map(y => ({ value: y, label: y }))}
                  selected={selectedInvYears}
                  onChange={setSelectedInvYears}
                  placeholder="All Years"
                />
              </div>
            </div>
          </div>
          )}

          {/* Aggregation Summary Cards Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-cyan-800/50 bg-cyan-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider mb-1">Number of Invoices</p>
              <p className="text-xl font-extrabold text-white">{filteredInvoices.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Matching Invoices Count</p>
            </div>

            <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-1">Total Grand Total Value</p>
              <p className="text-xl font-extrabold text-emerald-400 font-mono">{formatINR(totalInvGrandTotal)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Inclusive of GST</p>
            </div>

            <div className="rounded-2xl border border-amber-800/50 bg-amber-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">Received Bill Amount</p>
              <p className="text-xl font-extrabold text-amber-400 font-mono">{formatINR(totalInvReceived)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Total Collections</p>
            </div>

            <div className="rounded-2xl border border-purple-800/50 bg-purple-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider mb-1">Fully Paid Invoices</p>
              <p className="text-xl font-extrabold text-white">
                {filteredInvoices.filter(i => i.payment_status === 'Full Payment Received').length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Full Amount Settled</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Receipt size={14} className="text-cyan-400" /> Multi-Select Invoice Query Results ({filteredInvoices.length} invoices)
              </h3>
              <button onClick={handleExportInvoices} className="btn-ghost text-xs">
                <Download size={13} /> Export Results to Excel
              </button>
            </div>

            <DataTable
              columns={invColumns}
              data={filteredInvoices}
              loading={invoiceLoading}
              emptyMessage="No invoices match your selected criteria"
              onRowClick={(row) => setSelectedRecord({ record: row, type: 'invoice' })}
            />
          </div>
        </div>
      )}

      {/* On-screen Row Click Record Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord.record}
          type={selectedRecord.type}
          onClose={() => setSelectedRecord(null)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
