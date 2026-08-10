import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Download, Upload, Pencil, Trash2, ShoppingBag, DollarSign, CheckCircle2,
  AlertTriangle, Filter, Search, FileText, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { purchaseBillDb } from '../lib/db'
import { formatINR, formatDate, exportToExcel, CURRENT_FY, getFinancialYear } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import FyTabs from '../components/FyTabs'
import SlotTabs from '../components/SlotTabs'
import ModuleHeader from '../components/ModuleHeader'

const EMPTY_FORM = {
  trade_name: '',
  supplier_gstin: '',
  inv_number: '',
  inv_date: '',
  taxable_value: '',
  cgst: '',
  sgst: '',
  invoice_value: '',
  remarks: 'BILL RECEIVED',
}

const IMPORT_MAP = {
  'S.NO': null, 'SNo': null, 'S.No': null, 's_no': null,
  'Trade/Legal name': 'trade_name', 'Trade Name': 'trade_name', 'trade_name': 'trade_name', 'Trade / Legal Name': 'trade_name',
  'GSTIN of supplier': 'supplier_gstin', 'GSTIN': 'supplier_gstin', 'supplier_gstin': 'supplier_gstin',
  'Invoice number': 'inv_number', 'Invoice Number': 'inv_number', 'inv_number': 'inv_number',
  'Invoice Date': 'inv_date', 'inv_date': 'inv_date',
  'Taxable Value': 'taxable_value', 'taxable_value': 'taxable_value',
  'Central Tax(₹)': 'cgst', 'Central Tax': 'cgst', 'CGST': 'cgst', 'cgst': 'cgst',
  'State/UT Tax(₹)': 'sgst', 'State/UT Tax': 'sgst', 'SGST': 'sgst', 'sgst': 'sgst',
  'Invoice Value': 'invoice_value', 'invoice_value': 'invoice_value', 'Grand Total': 'invoice_value',
  'REMARKS (BILL RECEIVIED OR BILL NOT RECEIVIED)': 'remarks', 'REMARKS': 'remarks', 'Remarks': 'remarks', 'remarks': 'remarks',
}

const PB_IMPORT_COLUMNS = [
  'trade_name', 'supplier_gstin', 'inv_number', 'inv_date',
  'taxable_value', 'cgst', 'sgst', 'invoice_value', 'remarks'
]

function RemarkBadge({ remarks }) {
  const isReceived = String(remarks || '').toUpperCase().includes('RECEIVED') && !String(remarks || '').toUpperCase().includes('NOT')
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide ${
      isReceived
        ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-700/60 shadow-sm shadow-emerald-500/10'
        : 'bg-amber-950/90 text-amber-400 border border-amber-700/60 shadow-sm shadow-amber-500/10'
    }`}>
      {isReceived ? 'BILL RECEIVED' : 'BILL NOT RECEIVED'}
    </span>
  )
}

function StatCard({ label, value, sub, color = 'purple' }) {
  const cls = {
    purple: 'border-purple-800/40 bg-purple-950/30 text-purple-300',
    blue: 'border-blue-800/40 bg-blue-950/30 text-blue-300',
    emerald: 'border-emerald-800/40 bg-emerald-950/30 text-emerald-300',
    amber: 'border-amber-800/40 bg-amber-950/30 text-amber-300',
  }
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-md transition-all hover:scale-[1.02] ${cls[color]}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-extrabold text-white tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function getRecordFy(r) {
  if (r.inv_date) {
    const fy = getFinancialYear(r.inv_date)
    if (fy) return fy
  }
  return r.financial_year || CURRENT_FY
}

export default function PurchaseBillPage() {
  const { user, isAdmin } = useAuth()
  const { fy: paramFy } = useParams()
  const [searchParams] = useSearchParams()
  const activeFy = searchParams.get('fy') || paramFy || CURRENT_FY
  const qc = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [activeSlot, setActiveSlot] = useState('all')

  useEffect(() => {
    const s = searchParams.get('search')
    if (s) setSearchQuery(s)
  }, [searchParams])

  const REMARK_SLOTS = [
    { key: 'all', label: 'All Purchase Bills' },
    { key: 'received', label: 'Bill Received' },
    { key: 'not_received', label: 'Bill Not Received' },
  ]

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['purchase_bills', 'all'],
    queryFn: () => purchaseBillDb.listAll(),
  })

  const fyRecords = useMemo(() => {
    if (activeFy === 'overall') return allRecords
    return allRecords.filter(r => getRecordFy(r) === activeFy)
  }, [allRecords, activeFy])

  const filteredRecords = useMemo(() => {
    return fyRecords.filter(r => {
      const isReceived = String(r.remarks || '').toUpperCase().includes('RECEIVED') && !String(r.remarks || '').toUpperCase().includes('NOT')
      if (activeSlot === 'received' && !isReceived) return false
      if (activeSlot === 'not_received' && isReceived) return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const trade = String(r.trade_name || '').toLowerCase()
        const gstin = String(r.supplier_gstin || '').toLowerCase()
        const invNo = String(r.inv_number || '').toLowerCase()
        const rem = String(r.remarks || '').toLowerCase()
        if (!trade.includes(q) && !gstin.includes(q) && !invNo.includes(q) && !rem.includes(q)) return false
      }
      return true
    })
  }, [fyRecords, activeSlot, searchQuery])

  // Attach S.NO sequentially to rows
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords].sort((a, b) => new Date(b.inv_date || 0) - new Date(a.inv_date || 0))
    return sorted.map((r, idx) => ({ ...r, s_no: idx + 1 }))
  }, [filteredRecords])

  // Summary Metrics
  const totalTaxable = useMemo(() => fyRecords.reduce((s, r) => s + (Number(r.taxable_value) || 0), 0), [fyRecords])
  const totalCgst = useMemo(() => fyRecords.reduce((s, r) => s + (Number(r.cgst) || 0), 0), [fyRecords])
  const totalSgst = useMemo(() => fyRecords.reduce((s, r) => s + (Number(r.sgst) || 0), 0), [fyRecords])
  const totalInvoiceValue = useMemo(() => fyRecords.reduce((s, r) => s + (Number(r.invoice_value) || 0), 0), [fyRecords])
  const receivedCount = useMemo(() => fyRecords.filter(r => String(r.remarks || '').toUpperCase().includes('RECEIVED') && !String(r.remarks || '').toUpperCase().includes('NOT')).length, [fyRecords])
  const notReceivedCount = useMemo(() => fyRecords.length - receivedCount, [fyRecords, receivedCount])

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const derivedFy = getRecordFy(payload)
      const dataToSave = { ...payload, financial_year: derivedFy }
      return editRow
        ? purchaseBillDb.update(editRow.id, dataToSave)
        : purchaseBillDb.create(dataToSave, user?.id)
    },
    onSuccess: () => {
      qc.invalidateQueries(['purchase_bills'])
      toast.success(editRow ? 'Purchase Bill updated ✓' : 'Purchase Bill created ✓')
      handleClose()
    },
    onError: (e) => toast.error(e?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: purchaseBillDb.delete,
    onSuccess: () => {
      qc.invalidateQueries(['purchase_bills'])
      toast.success('Purchase Bill deleted ✓')
    },
    onError: (e) => toast.error(e?.message || 'Delete failed'),
  })

  const handleClose = () => {
    setFormOpen(false)
    setEditRow(null)
    setForm(EMPTY_FORM)
  }

  const openAdd = () => {
    setEditRow(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (row) => {
    setEditRow(row)
    setForm({ ...EMPTY_FORM, ...row })
    setFormOpen(true)
  }

  const handleDelete = (id, row) => {
    const label = row?.inv_number ? `Invoice #${row.inv_number}` : `Record #${id}`
    if (window.confirm(`Are you sure you want to delete ${label}?`)) {
      deleteMutation.mutate(id)
    }
  }

  // Auto-calculate CGST (9%), SGST (9%), and Invoice Value when Taxable Value changes
  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'taxable_value') {
        const val = parseFloat(value) || 0
        if (val > 0) {
          const halfTax = Math.round(val * 0.09 * 100) / 100
          next.cgst = halfTax
          next.sgst = halfTax
          next.invoice_value = Math.round((val + halfTax * 2) * 100) / 100
        }
      }
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  const handleExport = () => {
    const exportData = sortedRecords.map(r => ({
      'S.NO': r.s_no,
      'Trade/Legal name': r.trade_name,
      'GSTIN of supplier': r.supplier_gstin,
      'Invoice number': r.inv_number,
      'Invoice Date': formatDate(r.inv_date),
      'Taxable Value': r.taxable_value,
      'Central Tax(₹)': r.cgst,
      'State/UT Tax(₹)': r.sgst,
      'Invoice Value': r.invoice_value,
      'REMARKS': r.remarks,
    }))
    exportToExcel(exportData, `Purchase_Bills_${activeFy}.xlsx`, 'Purchase Bills')
    toast.success('Excel downloaded ✓')
  }

  const importRecords = async (rows) => {
    const mapped = rows.map(raw => {
      const rec = {}
      for (const [k, v] of Object.entries(raw)) {
        const dbKey = IMPORT_MAP[k] ?? IMPORT_MAP[k?.trim()]
        if (dbKey && v !== '' && v !== null && v !== undefined) rec[dbKey] = v
      }
      rec.financial_year = getRecordFy(rec)
      return rec
    })
    const count = await purchaseBillDb.bulkInsert(mapped, user?.id)
    qc.invalidateQueries(['purchase_bills'])
    toast.success(`Imported ${count} purchase bills successfully ✓`)
  }

  const columns = [
    { key: 's_no', header: 'S.NO', render: r => <span className="font-mono text-slate-400">{r.s_no}</span> },
    { key: 'trade_name', header: 'Trade / Legal Name', render: r => <span className="font-bold text-white">{r.trade_name || '—'}</span> },
    { key: 'supplier_gstin', header: 'GSTIN of Supplier', render: r => <span className="font-mono text-purple-300 text-xs font-semibold">{r.supplier_gstin || '—'}</span> },
    { key: 'inv_number', header: 'Invoice Number', render: r => <span className="font-bold text-cyan-300 font-mono">{r.inv_number || '—'}</span> },
    { key: 'inv_date', header: 'Invoice Date', render: r => <span className="font-mono text-xs text-slate-300">{formatDate(r.inv_date) || '—'}</span> },
    { key: 'taxable_value', header: 'Taxable Value', render: r => <span className="text-blue-400 font-semibold">{formatINR(r.taxable_value)}</span> },
    { key: 'cgst', header: 'Central Tax (₹)', render: r => <span className="text-slate-300 font-mono">{formatINR(r.cgst)}</span> },
    { key: 'sgst', header: 'State/UT Tax (₹)', render: r => <span className="text-slate-300 font-mono">{formatINR(r.sgst)}</span> },
    { key: 'invoice_value', header: 'Invoice Value', render: r => <span className="text-emerald-400 font-bold">{formatINR(r.invoice_value)}</span> },
    { key: 'remarks', header: 'REMARKS', render: r => <RemarkBadge remarks={r.remarks} /> },
  ]

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Module Header */}
      <ModuleHeader
        title="Purchase Bills"
        subtitle="Manage supplier purchase invoices, taxable values, CGST/SGST tax breakdown, and bill receipt status."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExport} className="btn-ghost"><Download size={14} /> Export</button>
            {isAdmin && (
              <>
                <button onClick={() => setImportOpen(true)} className="btn-ghost"><Upload size={14} /> Import</button>
                <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Purchase Bill</button>
              </>
            )}
          </div>
        }
        stats={[
          { icon: ShoppingBag, label: 'Total Purchase Bills', value: fyRecords.length, sub: `FY ${activeFy}`, color: 'purple' },
          { icon: DollarSign, label: 'Taxable Value', value: formatINR(totalTaxable), sub: 'Before Tax', color: 'blue' },
          { icon: FileText, label: 'CGST + SGST Tax', value: formatINR(totalCgst + totalSgst), sub: 'Total Taxes', color: 'amber' },
          { icon: CheckCircle2, label: 'Total Invoice Value', value: formatINR(totalInvoiceValue), sub: `Received: ${receivedCount} | Pending: ${notReceivedCount}`, color: 'emerald' },
        ]}
      />

      {/* FY Selection Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <FyTabs basePath="/purchase-bills" />
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Trade Name, GSTIN, Inv No..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 py-2 text-xs"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <SlotTabs slots={REMARK_SLOTS} activeSlot={activeSlot} onChange={setActiveSlot} />

      {/* Main Table */}
      <div className="glass-card p-5 reveal-on-scroll">
        <DataTable
          data={sortedRecords}
          columns={columns}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Add / Edit Purchase Bill Modal */}
      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit Purchase Bill' : 'Add New Purchase Bill'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Trade / Legal Name *</label>
              <input
                type="text"
                name="trade_name"
                value={form.trade_name}
                onChange={handleFieldChange}
                required
                placeholder="Supplier Trade or Legal Name"
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">GSTIN of Supplier *</label>
              <input
                type="text"
                name="supplier_gstin"
                value={form.supplier_gstin}
                onChange={handleFieldChange}
                required
                placeholder="e.g. 33AAAAA0000A1Z5"
                className="input-field font-mono uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Invoice Number *</label>
              <input
                type="text"
                name="inv_number"
                value={form.inv_number}
                onChange={handleFieldChange}
                required
                placeholder="Purchase Invoice Number"
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Invoice Date *</label>
              <input
                type="date"
                name="inv_date"
                value={form.inv_date}
                onChange={handleFieldChange}
                required
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Taxable Value (₹) *</label>
              <input
                type="number"
                step="0.01"
                name="taxable_value"
                value={form.taxable_value}
                onChange={handleFieldChange}
                required
                placeholder="0.00"
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Central Tax (CGST ₹)</label>
              <input
                type="number"
                step="0.01"
                name="cgst"
                value={form.cgst}
                onChange={handleFieldChange}
                placeholder="0.00"
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">State/UT Tax (SGST ₹)</label>
              <input
                type="number"
                step="0.01"
                name="sgst"
                value={form.sgst}
                onChange={handleFieldChange}
                placeholder="0.00"
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Invoice Value (Grand Total ₹) *</label>
              <input
                type="number"
                step="0.01"
                name="invoice_value"
                value={form.invoice_value}
                onChange={handleFieldChange}
                required
                placeholder="0.00"
                className="input-field font-mono text-emerald-400 font-bold"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 mb-1 block">REMARKS (Bill Status) *</label>
              <select
                name="remarks"
                value={form.remarks}
                onChange={handleFieldChange}
                className="select-field font-semibold"
              >
                <option value="BILL RECEIVED">BILL RECEIVED</option>
                <option value="BILL NOT RECEIVED">BILL NOT RECEIVED</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving...' : (editRow ? 'Update Bill' : 'Create Bill')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importRecords}
        columnMap={PB_IMPORT_COLUMNS}
        title="Import Purchase Bills"
      />
    </div>
  )
}
