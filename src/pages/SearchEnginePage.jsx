import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Filter, Calendar, FileText, Receipt, DollarSign, Download, Clock, CheckCircle2,
  TrendingUp, Globe, Building, ArrowRight, RefreshCw, Calculator, Layers
} from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import DataTable from '../components/DataTable'
import RecordDetailModal from '../components/RecordDetailModal'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, exportToExcel, FINANCIAL_YEARS } from '../lib/utils'

const MONTHS = [
  { value: 'all', label: 'All Months' },
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

const YEARS = ['All Years', '2023', '2024', '2025', '2026', '2027']

export default function SearchEnginePage() {
  const [activeTab, setActiveTab] = useState('jms') // 'jms' or 'invoice'

  // JMS Search Filters
  const [jmsQuery, setJmsQuery]           = useState('')
  const [jmsWorkOrder, setJmsWorkOrder]   = useState('all')
  const [jmsStartDate, setJmsStartDate]   = useState('')
  const [jmsEndDate, setJmsEndDate]       = useState('')

  // Invoice Search Filters
  const [invQuery, setInvQuery]           = useState('')
  const [invMonth, setInvMonth]           = useState('all')
  const [invYear, setInvYear]             = useState('All Years')
  const [invWorkOrder, setInvWorkOrder]   = useState('all')

  const [selectedRecord, setSelectedRecord] = useState(null)

  // Fetch Database Data
  const { data: jmsList = [], isLoading: jmsLoading }         = useQuery({ queryKey: ['jms', 'all'],     queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [], isLoading: invoiceLoading } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }                             = useQuery({ queryKey: ['budget', 'all'],   queryFn: () => budgetDb.listAll() })

  // Extract unique Work Orders for filter dropdowns
  const workOrderOptions = useMemo(() => {
    const set = new Set()
    jmsList.forEach(j => j.work_order_number && set.add(j.work_order_number.trim()))
    invoiceList.forEach(i => i.work_order_number && set.add(i.work_order_number.trim()))
    budgetList.forEach(b => b.work_order_number && set.add(b.work_order_number.trim()))
    return Array.from(set).sort()
  }, [jmsList, invoiceList, budgetList])

  // ── JMS Filtered Results & Aggregations ────────────────────────
  const filteredJms = useMemo(() => {
    return jmsList.filter(j => {
      // 1. JMS Numbers / Keyword Search (supports comma-separated list like "JMS-101, JMS-102")
      if (jmsQuery.trim()) {
        const terms = jmsQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
        const jmsNo = String(j.jms_no || '').toLowerCase()
        const desc  = String(j.work_description || '').toLowerCase()
        const site  = String(j.site || '').toLowerCase()
        const matches = terms.some(t => jmsNo.includes(t) || desc.includes(t) || site.includes(t))
        if (!matches) return false
      }

      // 2. Work Order Filter
      if (jmsWorkOrder !== 'all') {
        const wo = String(j.work_order_number || '').trim().toLowerCase()
        if (wo !== jmsWorkOrder.toLowerCase()) return false
      }

      // 3. Date Range Filter (by jms_create_date or inv_date)
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
  }, [jmsList, jmsQuery, jmsWorkOrder, jmsStartDate, jmsEndDate])

  const totalJmsNetValue = useMemo(() => {
    return filteredJms.reduce((sum, j) => sum + (Number(j.net_amount) || 0), 0)
  }, [filteredJms])

  const jmsReleasedCount = useMemo(() => {
    return filteredJms.filter(j => j.status === 'Released by A3' || j.status === 'Invoiced').length
  }, [filteredJms])

  // ── Invoice Filtered Results & Aggregations ───────────────────
  const filteredInvoices = useMemo(() => {
    return invoiceList.filter(inv => {
      // 1. Invoice Number / Keyword Search
      if (invQuery.trim()) {
        const q = invQuery.toLowerCase().trim()
        const invNo = String(inv.inv_number || '').toLowerCase()
        const jmsNo = String(inv.jms_no || '').toLowerCase()
        const desc  = String(inv.work_description || '').toLowerCase()
        const site  = String(inv.site || '').toLowerCase()
        if (!invNo.includes(q) && !jmsNo.includes(q) && !desc.includes(q) && !site.includes(q)) return false
      }

      // 2. Work Order Filter
      if (invWorkOrder !== 'all') {
        const wo = String(inv.work_order_number || '').trim().toLowerCase()
        if (wo !== invWorkOrder.toLowerCase()) return false
      }

      // 3. Month & Year Filter
      const dateStr = inv.inv_date || inv.full_amount_received_date || inv.created_at
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          const m = d.getMonth() + 1 // 1 to 12
          const y = d.getFullYear().toString()

          if (invMonth !== 'all' && m.toString() !== invMonth) return false
          if (invYear !== 'All Years' && y !== invYear) return false
        }
      }

      return true
    })
  }, [invoiceList, invQuery, invWorkOrder, invMonth, invYear])

  const totalInvGrandTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + (Number(i.grand_total) || 0), 0)
  }, [filteredInvoices])

  const totalInvReceived = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + (Number(i.received_bill_amount) || 0), 0)
  }, [filteredInvoices])

  // Reset Filters
  const resetJmsFilters = () => {
    setJmsQuery('')
    setJmsWorkOrder('all')
    setJmsStartDate('')
    setJmsEndDate('')
  }

  const resetInvFilters = () => {
    setInvQuery('')
    setInvWorkOrder('all')
    setInvMonth('all')
    setInvYear('All Years')
  }

  // Export search results
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
        title="Search Engine & Analytical Query Suite"
        subtitle="Search specific JMS numbers to aggregate total value, filter work orders by date range, and query monthly/yearly invoice totals."
      />

      {/* Main Search Mode Tabs: JMS Query Engine vs Invoice Query Engine */}
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
          JMS Search & Total Value Engine
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
          Invoice Monthly / Yearly Search Engine
        </button>
      </div>

      {/* ═══ TAB 1: JMS SEARCH ENGINE ══════════════════════════════════ */}
      {activeTab === 'jms' && (
        <div className="space-y-6">
          {/* Query Filter Controls Panel */}
          <div className="glass-card p-5 space-y-4 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={16} className="text-purple-400" /> JMS Multi-Parameter Search Controls
              </h2>
              <button onClick={resetJmsFilters} className="btn-ghost text-xs">
                <RefreshCw size={13} /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. JMS Numbers Input (Comma Separated) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  JMS Numbers / Keywords:
                </label>
                <input
                  type="text"
                  placeholder="e.g. JMS-101, JMS-102..."
                  value={jmsQuery}
                  onChange={e => setJmsQuery(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* 2. Work Order Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Filter by Work Order:
                </label>
                <select
                  value={jmsWorkOrder}
                  onChange={e => setJmsWorkOrder(e.target.value)}
                  className="select-field"
                >
                  <option value="all">All Work Orders ({workOrderOptions.length})</option>
                  {workOrderOptions.map(wo => (
                    <option key={wo} value={wo}>{wo}</option>
                  ))}
                </select>
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
                  className="input-field"
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
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Aggregation Summary Cards Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-purple-800/50 bg-purple-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider mb-1">Matching JMS Records</p>
              <p className="text-xl font-extrabold text-white">{filteredJms.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Selected Query Results</p>
            </div>

            <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-1">Total JMS Net Value</p>
              <p className="text-xl font-extrabold text-emerald-400 font-mono">{formatINR(totalJmsNetValue)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Aggregated Value for Period</p>
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
                <FileText size={14} className="text-purple-400" /> JMS Search Query Results ({filteredJms.length} rows)
              </h3>
              <button onClick={handleExportJms} className="btn-ghost text-xs">
                <Download size={13} /> Export Results to Excel
              </button>
            </div>

            <DataTable
              columns={jmsColumns}
              data={filteredJms}
              loading={jmsLoading}
              emptyMessage="No JMS records match your search query and date range criteria"
              onRowClick={(row) => setSelectedRecord({ record: row, type: 'jms' })}
            />
          </div>
        </div>
      )}

      {/* ═══ TAB 2: INVOICE MONTHLY / YEARLY SEARCH ENGINE ═══════════════ */}
      {activeTab === 'invoice' && (
        <div className="space-y-6">
          {/* Query Filter Controls Panel */}
          <div className="glass-card p-5 space-y-4 border-l-4 border-l-cyan-500">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={16} className="text-cyan-400" /> Invoice Monthly & Yearly Query Controls
              </h2>
              <button onClick={resetInvFilters} className="btn-ghost text-xs">
                <RefreshCw size={13} /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Month Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Month:
                </label>
                <select
                  value={invMonth}
                  onChange={e => setInvMonth(e.target.value)}
                  className="select-field"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* 2. Year Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Year:
                </label>
                <select
                  value={invYear}
                  onChange={e => setInvYear(e.target.value)}
                  className="select-field"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* 3. Work Order Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Filter by Work Order:
                </label>
                <select
                  value={invWorkOrder}
                  onChange={e => setInvWorkOrder(e.target.value)}
                  className="select-field"
                >
                  <option value="all">All Work Orders ({workOrderOptions.length})</option>
                  {workOrderOptions.map(wo => (
                    <option key={wo} value={wo}>{wo}</option>
                  ))}
                </select>
              </div>

              {/* 4. Invoice Number / Keyword Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Invoice Number / Keyword:
                </label>
                <input
                  type="text"
                  placeholder="Search invoice number..."
                  value={invQuery}
                  onChange={e => setInvQuery(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Aggregation Summary Cards Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-cyan-800/50 bg-cyan-950/30 p-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider mb-1">Number of Invoices</p>
              <p className="text-xl font-extrabold text-white">{filteredInvoices.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Issued in {invMonth === 'all' ? 'All Months' : MONTHS.find(m=>m.value===invMonth)?.label} {invYear}
              </p>
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
                <Receipt size={14} className="text-cyan-400" /> Monthly / Yearly Invoice Results ({filteredInvoices.length} invoices)
              </h3>
              <button onClick={handleExportInvoices} className="btn-ghost text-xs">
                <Download size={13} /> Export Results to Excel
              </button>
            </div>

            <DataTable
              columns={invColumns}
              data={filteredInvoices}
              loading={invoiceLoading}
              emptyMessage="No invoices match your selected month, year, and search criteria"
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
          isAdmin={true}
        />
      )}
    </div>
  )
}
