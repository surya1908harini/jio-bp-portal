import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
import MonthTabs, { MONTHS } from '../components/MonthTabs'
import ModuleHeader from '../components/ModuleHeader'

const EMPTY_FORM = {
  trade_name: '',
  supplier_gstin: '',
  inv_number: '',
  inv_date: '',
  taxable_value: '',
  igst: '',
  cgst: '',
  sgst: '',
  invoice_value: '',
  hb_rb: '',
  remarks: 'BILL RECEIVED',
}

const IMPORT_MAP = {
  'S.NO': null, 'SNo': null, 'S.No': null, 's_no': null,
  'Trade/Legal name': 'trade_name', 'Trade Name': 'trade_name', 'trade_name': 'trade_name', 'Trade / Legal Name': 'trade_name',
  'GSTIN of supplier': 'supplier_gstin', 'GSTIN': 'supplier_gstin', 'supplier_gstin': 'supplier_gstin',
  'Invoice number': 'inv_number', 'Invoice Number': 'inv_number', 'inv_number': 'inv_number',
  'Invoice Date': 'inv_date', 'inv_date': 'inv_date',
  'Taxable Value': 'taxable_value', 'taxable_value': 'taxable_value',
  'Integrated Tax(₹)': 'igst', 'Integrated Tax': 'igst', 'IGST': 'igst', 'igst': 'igst',
  'Central Tax(₹)': 'cgst', 'Central Tax': 'cgst', 'CGST': 'cgst', 'cgst': 'cgst',
  'State/UT Tax(₹)': 'sgst', 'State/UT Tax': 'sgst', 'SGST': 'sgst', 'sgst': 'sgst',
  'Invoice Value': 'invoice_value', 'invoice_value': 'invoice_value', 'Grand Total': 'invoice_value',
  'HB/RB': 'hb_rb', 'HB / RB': 'hb_rb', 'hb_rb': 'hb_rb', 'hb/rb': 'hb_rb', 'HB': 'hb_rb', 'RB': 'hb_rb',
  'REMARKS (BILL RECEIVIED OR BILL NOT RECEIVIED)': 'remarks', 'REMARKS': 'remarks', 'Remarks': 'remarks', 'remarks': 'remarks',
}

const PB_IMPORT_COLUMNS = [
  'trade_name', 'supplier_gstin', 'inv_number', 'inv_date',
  'taxable_value', 'igst', 'cgst', 'sgst', 'invoice_value', 'hb_rb', 'remarks'
]

function RemarkBadge({ remarks, onClick }) {
  const isReceived = String(remarks || '').toUpperCase().includes('RECEIVED') && !String(remarks || '').toUpperCase().includes('NOT')
  return (
    <span
      onClick={onClick}
      className={`whitespace-nowrap inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide cursor-pointer transition-all hover:scale-105 select-none ${
        isReceived
          ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-700/60 shadow-sm shadow-emerald-500/10 hover:bg-emerald-900'
          : 'bg-amber-950/90 text-amber-400 border border-amber-700/60 shadow-sm shadow-amber-500/10 hover:bg-amber-900'
      }`}
      title="Click to toggle Bill Received status"
    >
      {isReceived ? 'BILL RECEIVED ✎' : 'BILL NOT RECEIVED ✎'}
    </span>
  )
}

function StatCard({ label, value, sub, color = 'orange' }) {
  const cls = {
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-md transition-all hover:scale-[1.02] ${cls[color]}`}>
      <p className="text-[10px] font-semibold text-gray-500 dark:text-white dark:text-white uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 dark:text-white dark:text-white mt-0.5">{sub}</p>}
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
  const [activeMonth, setActiveMonth] = useState(searchParams.get('month') || 'all')

  useEffect(() => {
    const s = searchParams.get('search')
    if (s) setSearchQuery(s)
    const m = searchParams.get('month')
    if (m) setActiveMonth(m)
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
    let records = activeFy === 'overall' ? allRecords : allRecords.filter(r => getRecordFy(r) === activeFy)
    
    // Auto-patch missing SGST/IGST from legacy imports
    return records.map(r => {
      let cgst = Number(r.cgst) || 0
      let sgst = Number(r.sgst) || 0
      let igst = Number(r.igst) || 0
      const taxable = Number(r.taxable_value) || 0
      const invoice = Number(r.invoice_value) || 0
      
      const gstin = (r.supplier_gstin || '').trim()
      const isInterState = gstin.length > 0 && !gstin.startsWith('33')
      
      // Patch local purchases (Tamil Nadu) where SGST got dropped but CGST exists
      if (!isInterState && cgst > 0 && sgst === 0) {
        sgst = cgst
      }
      
      // Patch inter-state purchases where IGST got dropped but there is a tax difference
      if (isInterState && igst === 0) {
        const diff = invoice - taxable
        if (diff > 0) {
          igst = Math.round(diff * 100) / 100
        }
      }
      
      return { ...r, cgst, sgst, igst }
    })
  }, [allRecords, activeFy])

  const filteredRecords = useMemo(() => {
    return fyRecords.filter(r => {
      const isReceived = String(r.remarks || '').toUpperCase().includes('RECEIVED') && !String(r.remarks || '').toUpperCase().includes('NOT')
      if (activeSlot === 'received' && !isReceived) return false
      if (activeSlot === 'not_received' && isReceived) return false

      if (activeMonth !== 'all') {
        const d = r.inv_date ? new Date(r.inv_date) : null
        if (!d || isNaN(d.getTime()) || (d.getMonth() + 1) !== Number(activeMonth)) return false
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const trade = String(r.trade_name || '').toLowerCase()
        const gstin = String(r.supplier_gstin || '').toLowerCase()
        const invNo = String(r.inv_number || '').toLowerCase()
        const hbrb = String(r.hb_rb || '').toLowerCase()
        const rem = String(r.remarks || '').toLowerCase()
        if (!trade.includes(q) && !gstin.includes(q) && !invNo.includes(q) && !hbrb.includes(q) && !rem.includes(q)) return false
      }
      return true
    })
  }, [fyRecords, activeSlot, activeMonth, searchQuery])

  const monthRecords = useMemo(() => {
    if (activeMonth === 'all') return fyRecords
    return fyRecords.filter(r => {
      const d = r.inv_date ? new Date(r.inv_date) : null
      return d && !isNaN(d.getTime()) && (d.getMonth() + 1) === Number(activeMonth)
    })
  }, [fyRecords, activeMonth])

  // Attach S.NO sequentially to rows
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords].sort((a, b) => new Date(b.inv_date || 0) - new Date(a.inv_date || 0))
    return sorted.map((r, idx) => ({ ...r, s_no: idx + 1 }))
  }, [filteredRecords])

  // Summary Metrics (Dynamically updated by selected Month)
  const totalTaxable = useMemo(() => monthRecords.reduce((s, r) => s + (Number(r.taxable_value) || 0), 0), [monthRecords])
  const totalIgst = useMemo(() => monthRecords.reduce((s, r) => s + (Number(r.igst) || 0), 0), [monthRecords])
  const totalCgst = useMemo(() => monthRecords.reduce((s, r) => s + (Number(r.cgst) || 0), 0), [monthRecords])
  const totalSgst = useMemo(() => monthRecords.reduce((s, r) => s + (Number(r.sgst) || 0), 0), [monthRecords])
  const totalInvoiceValue = useMemo(() => monthRecords.reduce((s, r) => s + (Number(r.hb_rb) || Number(r.invoice_value) || 0), 0), [monthRecords])
  const receivedCount = useMemo(() => monthRecords.filter(r => String(r.remarks || '').toUpperCase().includes('RECEIVED') && !String(r.remarks || '').toUpperCase().includes('NOT')).length, [monthRecords])
  const notReceivedCount = useMemo(() => monthRecords.length - receivedCount, [monthRecords, receivedCount])

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

  const handleBulkDelete = async (selectedRows) => {
    if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected Purchase Bills?`)) {
      for (const r of selectedRows) {
        await purchaseBillDb.delete(r.id)
      }
      qc.invalidateQueries(['purchase_bills'])
      toast.success(`Deleted ${selectedRows.length} Purchase Bills successfully ✓`)
    }
  }

  const handleToggleRemarks = (row, e) => {
    e.stopPropagation()
    const isCurrentlyReceived = String(row.remarks || '').toUpperCase().includes('RECEIVED') && !String(row.remarks || '').toUpperCase().includes('NOT')
    const newRemarks = isCurrentlyReceived ? 'BILL NOT RECEIVED' : 'BILL RECEIVED'
    purchaseBillDb.update(row.id, { ...row, remarks: newRemarks }).then(() => {
      qc.invalidateQueries(['purchase_bills'])
      toast.success(`Bill status updated to '${newRemarks}' ✓`)
    })
  }

  // Auto-calculate Taxes and Invoice Value based on Taxable Value and GSTIN state code
  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      
      // Auto-calculate if taxable_value or supplier_gstin changes
      if (name === 'taxable_value' || name === 'supplier_gstin') {
        const val = parseFloat(next.taxable_value) || 0
        const gstin = (next.supplier_gstin || '').trim()
        
        if (val > 0) {
          // If GSTIN is explicitly from another state (not starting with 33) -> IGST 18%
          // Otherwise (if 33, or empty default) -> CGST 9% + SGST 9%
          const isInterState = gstin.length > 0 && !gstin.startsWith('33')
          
          if (isInterState) {
            const fullTax = Math.round(val * 0.18 * 100) / 100
            next.igst = fullTax
            next.cgst = ''
            next.sgst = ''
            next.invoice_value = Math.round((val + fullTax) * 100) / 100
          } else {
            const halfTax = Math.round(val * 0.09 * 100) / 100
            next.cgst = halfTax
            next.sgst = halfTax
            next.igst = ''
            next.invoice_value = Math.round((val + halfTax * 2) * 100) / 100
          }
        } else {
            // Reset if taxable is 0
            next.igst = ''
            next.cgst = ''
            next.sgst = ''
            next.invoice_value = ''
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
      'Trade/Legal name': r.trade_name || '—',
      'GSTIN of supplier': r.supplier_gstin || '—',
      'Invoice number': r.inv_number || '—',
      'Invoice Date': formatDate(r.inv_date) || '—',
      'Taxable Value': r.taxable_value || 0,
      'Integrated Tax(₹)': r.igst || 0,
      'Central Tax(₹)': r.cgst || 0,
      'State/UT Tax(₹)': r.sgst || 0,
      'Invoice Value': r.invoice_value || 0,
      'HB/RB': r.hb_rb || '—',
      'REMARKS': r.remarks || 'BILL RECEIVED',
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
    { key: 's_no', header: 'S.NO', render: r => <span className="font-mono text-gray-500 dark:text-white dark:text-white">{r.s_no}</span> },
    { key: 'trade_name', header: 'Trade / Legal Name', render: r => <span className="font-bold text-gray-900 dark:text-white">{r.trade_name || '—'}</span> },
    { key: 'supplier_gstin', header: 'GSTIN of Supplier', render: r => <span className="font-mono text-gray-500 dark:text-white dark:text-white text-xs font-semibold">{r.supplier_gstin || '—'}</span> },
    { key: 'inv_number', header: 'Invoice Number', render: r => <span className="font-bold text-gray-900 dark:text-white font-mono">{r.inv_number || '—'}</span> },
    { key: 'inv_date', header: 'Invoice Date', render: r => <span className="font-mono text-xs text-gray-700 dark:text-white">{formatDate(r.inv_date) || '—'}</span> },
    { key: 'taxable_value', header: 'Taxable Value', render: r => <span className="text-blue-400 font-semibold">{formatINR(r.taxable_value)}</span> },
    { key: 'igst', header: 'Integrated Tax (₹)', render: r => <span className="text-gray-700 dark:text-white font-mono">{formatINR(r.igst)}</span> },
    { key: 'cgst', header: 'Central Tax (₹)', render: r => <span className="text-gray-700 dark:text-white font-mono">{formatINR(r.cgst)}</span> },
    { key: 'sgst', header: 'State/UT Tax (₹)', render: r => <span className="text-gray-700 dark:text-white font-mono">{formatINR(r.sgst)}</span> },
    { key: 'invoice_value', header: 'Invoice Value', render: r => <span className="text-emerald-400 font-bold">{formatINR(r.invoice_value)}</span> },
    { key: 'hb_rb', header: 'HB/RB', render: r => <span className="font-mono text-orange-300 font-semibold">{r.hb_rb || '—'}</span> },
    { key: 'remarks', header: 'REMARKS', render: r => <RemarkBadge remarks={r.remarks} onClick={e => handleToggleRemarks(r, e)} /> },
  ]

  return (
    <div className="animate-page-enter">
      {document.getElementById('topbar-center') && createPortal(
        <div className="flex items-center gap-2">
          <MonthTabs activeMonth={activeMonth} onChange={setActiveMonth} />
          <SlotTabs slots={REMARK_SLOTS} activeSlot={activeSlot} onChange={setActiveSlot} />
        </div>,
        document.getElementById('topbar-center')
      )}
      {document.getElementById('topbar-actions') && createPortal(
        <div className="flex items-center gap-2">
          <button onClick={handleExport} title="Export" className="btn-ghost !px-2 !py-1 !text-xs"><Download size={13} /></button>
          {isAdmin && (
            <>
              <button onClick={() => setImportOpen(true)} title="Import" className="btn-ghost !px-2 !py-1 !text-xs"><Upload size={13} /></button>
              <button onClick={openAdd} title="Add Purchase Bill" className="btn-primary !px-2 !py-1 !text-xs"><Plus size={13} /></button>
            </>
          )}
          <FyTabs basePath="/purchase-bills" />
        </div>,
        document.getElementById('topbar-actions')
      )}

      {/* Main Table */}
      <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 p-5 reveal-on-scroll">
        <DataTable
          data={sortedRecords}
          columns={columns}
          isLoading={isLoading}
          isAdmin={isAdmin}
          enableSelection={isAdmin}
          onBulkDelete={handleBulkDelete}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Add / Edit Purchase Bill Modal */}
      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit Purchase Bill' : 'Add New Purchase Bill'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Trade / Legal Name *</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">GSTIN of Supplier *</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Invoice Number *</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Invoice Date *</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Taxable Value (₹) *</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Integrated Tax (IGST ₹)</label>
              <input
                type="number"
                step="0.01"
                name="igst"
                value={form.igst}
                onChange={handleFieldChange}
                placeholder="0.00"
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Central Tax (CGST ₹)</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">State/UT Tax (SGST ₹)</label>
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
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">Invoice Value (Grand Total ₹) *</label>
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
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">HB / RB</label>
              <input
                type="text"
                name="hb_rb"
                value={form.hb_rb}
                onChange={handleFieldChange}
                placeholder="e.g. HB or RB details"
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-white mb-1 block">REMARKS (Bill Status) *</label>
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
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
