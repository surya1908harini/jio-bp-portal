import { useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, Upload, Pencil, Trash2, TrendingUp, Globe, Filter, Calendar, Calculator, Receipt, DollarSign, CheckCircle2, FileCheck } from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { invoiceDb } from '../lib/db'
import { formatINR, formatDate, exportToExcel, FINANCIAL_YEARS, PAYMENT_STATUSES, CURRENT_FY, getFinancialYear } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import FyTabs from '../components/FyTabs'
import SlotTabs from '../components/SlotTabs'
import PdfCell from '../components/PdfCell'

const EMPTY_FORM = {
  inv_date: '', jms_no: '', work_order_number: '', gst_no: '', inv_number: '',
  sac_code: '', work_description: '', site: '', type_of_ro: '', ro_code: '',
  total: '', igst: '', cgst: '', sgst: '', grand_total: '', hb_rb: '', tds: '',
  gst_amount_deduction: '', gst_tds_2pct_iocl: '', sd_retention: '',
  tcs_credit_note: '', received_bill_amount: '', amount_received_date: '',
  payment_status: 'Pending',
}

const IMPORT_MAP = {
  'SNo': null, 'Inv date': 'inv_date', 'Inv Date': 'inv_date', 'inv_date': 'inv_date',
  'Jms No': 'jms_no', 'JMS No': 'jms_no', 'jms_no': 'jms_no',
  'Work order number': 'work_order_number', 'Work Order Number': 'work_order_number', 'work_order_number': 'work_order_number',
  'GST NO': 'gst_no', 'GST No': 'gst_no', 'gst_no': 'gst_no',
  'Inv number': 'inv_number', 'Inv Number': 'inv_number', 'inv_number': 'inv_number',
  'SAC CODE': 'sac_code', 'SAC Code': 'sac_code', 'sac_code': 'sac_code',
  'Work Description': 'work_description', 'work_description': 'work_description',
  'Site': 'site', 'site': 'site',
  'TYPE OF RO': 'type_of_ro', 'Type of RO': 'type_of_ro', 'type_of_ro': 'type_of_ro',
  'RO CODE': 'ro_code', 'RO Code': 'ro_code', 'ro_code': 'ro_code',
  'TOTAL': 'total', 'Total': 'total', 'total': 'total',
  'IGST': 'igst', 'igst': 'igst', 'CGST': 'cgst', 'cgst': 'cgst',
  'SGST': 'sgst', 'sgst': 'sgst',
  'GRAND TOTAL': 'grand_total', 'Grand Total': 'grand_total', 'grand_total': 'grand_total',
  'HB/RB': 'hb_rb', 'hb_rb': 'hb_rb',
  'TDS': 'tds', 'tds': 'tds',
  'GST Amount & Deduction Amount': 'gst_amount_deduction', 'GST Deduction': 'gst_amount_deduction', 'gst_amount_deduction': 'gst_amount_deduction',
  'GST TDS 2% IOCL': 'gst_tds_2pct_iocl', 'gst_tds_2pct_iocl': 'gst_tds_2pct_iocl',
  'SD / Retention': 'sd_retention', 'SD/Retention': 'sd_retention', 'sd_retention': 'sd_retention',
  'TCS / credit note': 'tcs_credit_note', 'TCS/Credit': 'tcs_credit_note', 'tcs_credit_note': 'tcs_credit_note',
  'Received Bill amount': 'received_bill_amount', 'received_bill_amount': 'received_bill_amount',
  'Amount Received DATE': 'amount_received_date', 'amount_received_date': 'amount_received_date',
  'Payment Status': 'payment_status', 'payment_status': 'payment_status',
}

const INV_IMPORT_COLUMNS = [
  'inv_date','jms_no','work_order_number','gst_no','inv_number','sac_code',
  'work_description','site','type_of_ro','ro_code','total','igst','cgst','sgst',
  'grand_total','hb_rb','tds','gst_amount_deduction','gst_tds_2pct_iocl',
  'sd_retention','tcs_credit_note','received_bill_amount','amount_received_date','payment_status',
]

function PaymentBadge({ status }) {
  const map = {
    'Pending': 'badge-pending',
    'GST Payment Only Received': 'badge-gst-only',
    'Net Amount Received': 'badge-net',
    'Full Payment Received': 'badge-full',
  }
  return <span className={`badge ${map[status] || 'badge-pending'} text-[11px]`}>{status || 'Pending'}</span>
}

function StatCard({ label, value, color = 'slate' }) {
  const cls = {
    blue: 'border-jio-blue-700/40 bg-jio-blue-900/30', green: 'border-emerald-700/40 bg-emerald-900/20',
    amber: 'border-amber-700/40 bg-amber-900/20', purple: 'border-purple-700/40 bg-purple-900/20',
    cyan: 'border-cyan-700/40 bg-cyan-900/20', red: 'border-jio-red-700/40 bg-jio-red-900/20',
    slate: 'border-slate-700/40 bg-slate-800/40',
  }
  return (
    <div className={`rounded-xl border p-3 ${cls[color]}`}>
      <p className="text-[11px] font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-base font-bold text-white">{value}</p>
    </div>
  )
}

export default function InvoicePage() {
  const { fy } = useParams()
  const activeFy = fy || CURRENT_FY
  const [searchParams] = useSearchParams()
  const initialSlot = searchParams.get('slot') || 'all'

  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()

  // Slot filtering for invoice payment statuses
  const INVOICE_SLOTS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending Payment' },
    { key: 'gst', label: 'Pending GST' },
    { key: 'full', label: 'Full Payment Received' },
    { key: 'sd', label: 'Pending SD Amount' },
  ]
  const [activeSlot, setActiveSlot] = useState(initialSlot)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [taxMode, setTaxMode] = useState('CGST_SGST') // 'CGST_SGST' or 'IGST'

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['invoices', 'all'],
    queryFn: () => invoiceDb.listAll(),
  })

  // Helper to determine record FY based on invoice date
  const getRecordFy = (r) => {
    if (r.inv_date) {
      return getFinancialYear(r.inv_date)
    }
    return r.financial_year || '2024-25'
  }

  // Active records for table
  const fyRecords = activeFy === 'overall' ? allRecords : allRecords.filter(r => getRecordFy(r) === activeFy)

  // Apply slot (payment status) filter
  const records = fyRecords.filter(r => {
    if (activeSlot === 'all') return true
    if (activeSlot === 'pending') return r.payment_status === 'Pending'
    if (activeSlot === 'gst') return r.payment_status === 'GST Payment Only Received'
    if (activeSlot === 'full') return r.payment_status === 'Full Payment Received'
    if (activeSlot === 'sd') return (r.sd_retention && r.sd_retention > 0) && r.payment_status !== 'Full Payment Received'
    return true
  })

  // Sort records: Newest on top by Invoice Date, then Invoice Number
  // Sort records: Current FY on top, then newest date first
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const fyA = getRecordFy(a)
      const fyB = getRecordFy(b)
      if (fyA !== fyB) {
        if (fyA === CURRENT_FY) return -1
        if (fyB === CURRENT_FY) return 1
        return fyB.localeCompare(fyA)
      }
      const dateA = a.inv_date || a.amount_received_date || a.created_at || ''
      const dateB = b.inv_date || b.amount_received_date || b.created_at || ''
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA) // newest date first
      }
      return String(b.inv_number || '').localeCompare(String(a.inv_number || ''), undefined, { numeric: true })
    })
  }, [records])

  // Auto-calculate GST and Grand Total from Total
  const updateCalculations = (newForm, currentTaxMode) => {
    const totalVal = parseFloat(newForm.total) || 0
    if (totalVal > 0) {
      if (currentTaxMode === 'IGST') {
        const igstVal = Math.round(totalVal * 0.18 * 100) / 100
        newForm.igst = igstVal
        newForm.cgst = 0
        newForm.sgst = 0
        newForm.grand_total = Math.round((totalVal + igstVal) * 100) / 100
      } else {
        const halfGst = Math.round(totalVal * 0.09 * 100) / 100
        newForm.cgst = halfGst
        newForm.sgst = halfGst
        newForm.igst = 0
        newForm.grand_total = Math.round((totalVal + halfGst * 2) * 100) / 100
      }
    }
    return newForm
  }

  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'total') {
        return updateCalculations(next, taxMode)
      }
      return next
    })
  }

  const handleTaxModeChange = (mode) => {
    setTaxMode(mode)
    setForm(prev => updateCalculations({ ...prev }, mode))
  }

  // Per-FY stats
  const fyStats = FINANCIAL_YEARS.map(f => {
    const rows = allRecords.filter(r => getRecordFy(r) === f)
    return {
      fy: f,
      total:       rows.length,
      grandTotal:  rows.reduce((s, r) => s + (r.grand_total || 0), 0),
      tds:         rows.reduce((s, r) => s + (r.tds || 0), 0),
      received:    rows.reduce((s, r) => s + (r.received_bill_amount || 0), 0),
      fullPaid:    rows.filter(r => r.payment_status === 'Full Payment Received').length,
      pending:     rows.filter(r => r.payment_status === 'Pending').length,
    }
  })

  // Current records stats
  const totalGT      = records.reduce((s, r) => s + (r.grand_total || 0), 0)
  const totalTDS     = records.reduce((s, r) => s + (r.tds || 0), 0)
  const totalRec     = records.reduce((s, r) => s + (r.received_bill_amount || 0), 0)
  const totalSD      = records.reduce((s, r) => s + (r.sd_retention || 0), 0)
  const fullPaidCnt  = records.filter(r => r.payment_status === 'Full Payment Received').length
  const pendingCnt   = records.filter(r => r.payment_status === 'Pending').length
  const gstOnlyCnt   = records.filter(r => r.payment_status === 'GST Payment Only Received').length
  const netAmtCnt    = records.filter(r => r.payment_status === 'Net Amount Received').length

  const saveMutation = useMutation({
    mutationFn: (payload) => editRow
      ? invoiceDb.update(editRow.id, payload)
      : invoiceDb.create({ ...payload, financial_year: getRecordFy(payload) }, user?.id),
    onSuccess: () => { qc.invalidateQueries(['invoices']); toast.success(editRow ? 'Invoice updated ✓' : 'Invoice created ✓'); handleClose() },
    onError:   (e) => toast.error(e?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: invoiceDb.delete,
    onSuccess: () => { qc.invalidateQueries(['invoices']); toast.success('Invoice deleted') },
    onError:   (e) => toast.error(e?.message || 'Delete failed'),
  })

  const pdfMutation = useMutation({
    mutationFn: ({ id, pdf_url }) => invoiceDb.update(id, { pdf_url }),
    onSuccess: () => qc.invalidateQueries(['invoices']),
  })

  const importRecords = async (rows) => {
    const mapped = rows.map(raw => {
      const rec = {}
      for (const [k, v] of Object.entries(raw)) {
        const dbKey = IMPORT_MAP[k] ?? IMPORT_MAP[k.trim()]
        if (dbKey && v !== '' && v !== null && v !== undefined) rec[dbKey] = v
      }
      rec.financial_year = getRecordFy(rec)
      return rec
    }).filter(r => r.inv_number || r.jms_no)
    if (!mapped.length) throw new Error('No valid rows found. Check column headers match expected format.')
    const count = await invoiceDb.bulkInsert(mapped, user?.id)
    qc.invalidateQueries(['invoices'])
    return count
  }

  const openEdit = (row) => {
    setEditRow(row)
    const initialMode = (row.igst && Number(row.igst) > 0) ? 'IGST' : 'CGST_SGST'
    setTaxMode(initialMode)
    setForm({ ...EMPTY_FORM, ...row })
    setFormOpen(true)
  }

  const openAdd = () => {
    setEditRow(null)
    setTaxMode('CGST_SGST')
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const handleClose = () => { setFormOpen(false); setEditRow(null); setForm(EMPTY_FORM) }
  const handleDelete = (id) => { if (window.confirm('Delete this invoice?')) deleteMutation.mutate(id) }
  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const handleExport = () => { exportToExcel(sortedRecords, `Invoices_${activeFy}.xlsx`, 'Invoices'); toast.success('Excel downloaded') }

  const FORM_FIELDS = [
    { name: 'inv_date', label: 'Invoice Date', type: 'date' },
    { name: 'jms_no', label: 'JMS Number' }, { name: 'work_order_number', label: 'Work Order Number' },
    { name: 'gst_no', label: 'GST Number' }, { name: 'inv_number', label: 'Invoice Number' },
    { name: 'sac_code', label: 'SAC Code' }, { name: 'site', label: 'Site' },
    { name: 'type_of_ro', label: 'Type of RO' }, { name: 'ro_code', label: 'RO Code' },
    { name: 'hb_rb', label: 'HB/RB' },
    { name: 'total', label: 'Total Value (Before Tax)', type: 'number' },
    { name: 'igst', label: 'IGST (18%)', type: 'number' },
    { name: 'cgst', label: 'CGST (9%)', type: 'number' },
    { name: 'sgst', label: 'SGST (9%)', type: 'number' },
    { name: 'grand_total', label: 'Grand Total', type: 'number' },
    { name: 'tds', label: 'TDS', type: 'number' },
    { name: 'gst_amount_deduction', label: 'GST Amt & Deduction', type: 'number' },
    { name: 'gst_tds_2pct_iocl', label: 'GST TDS 2% IOCL', type: 'number' },
    { name: 'sd_retention', label: 'SD / Retention', type: 'number' },
    { name: 'tcs_credit_note', label: 'TCS / Credit Note', type: 'number' },
    { name: 'received_bill_amount', label: 'Received Bill Amount', type: 'number' },
    { name: 'amount_received_date', label: 'Amount Received Date', type: 'date' },
  ]

  const columns = [
    { key: 'inv_date',            header: 'Inv Date',      render: r => formatDate(r.inv_date) },
    { key: 'jms_no',              header: 'JMS No',        render: r => <span className="font-semibold text-white">{r.jms_no}</span> },
    { key: 'work_order_number',   header: 'Work Order' },
    { key: 'gst_no',              header: 'GST No' },
    { key: 'inv_number',          header: 'Inv Number' },
    { key: 'sac_code',            header: 'SAC Code' },
    { key: 'work_description',    header: 'Description' },
    { key: 'site',                header: 'Site' },
    { key: 'type_of_ro',          header: 'Type of RO' },
    { key: 'ro_code',             header: 'RO Code' },
    { key: 'total',               header: 'Total',         render: r => <span className="text-blue-400">{formatINR(r.total)}</span> },
    { key: 'igst',                header: 'IGST',          render: r => formatINR(r.igst) },
    { key: 'cgst',                header: 'CGST',          render: r => formatINR(r.cgst) },
    { key: 'sgst',                header: 'SGST',          render: r => formatINR(r.sgst) },
    { key: 'grand_total',         header: 'Grand Total',   render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.grand_total)}</span> },
    { key: 'hb_rb',               header: 'HB/RB' },
    { key: 'tds',                 header: 'TDS',           render: r => formatINR(r.tds) },
    { key: 'gst_amount_deduction',header: 'GST Deduction', render: r => formatINR(r.gst_amount_deduction) },
    { key: 'gst_tds_2pct_iocl',  header: 'GST TDS 2%',   render: r => formatINR(r.gst_tds_2pct_iocl) },
    { key: 'sd_retention',        header: 'SD/Retention',  render: r => formatINR(r.sd_retention) },
    { key: 'tcs_credit_note',     header: 'TCS/Credit',    render: r => formatINR(r.tcs_credit_note) },
    { key: 'received_bill_amount',header: 'Received Amt',  render: r => <span className="text-amber-400">{formatINR(r.received_bill_amount)}</span> },
    { key: 'amount_received_date',header: 'Received Date', render: r => formatDate(r.amount_received_date) },
    { key: 'payment_status',      header: 'Payment Status',render: r => <PaymentBadge status={r.payment_status} /> },
    {
      key: 'pdf', header: 'PDF', sortable: false,
      render: r => (
        <PdfCell pdfUrl={r.pdf_url} folder="invoices" isAdmin={isAdmin}
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

  const totalGrand = records.reduce((s, r) => s + (r.grand_total || 0), 0)
  const totalReceived = records.reduce((s, r) => s + (r.received_bill_amount || 0), 0)
  const totalPaidCount = records.filter(r => r.payment_status === 'Full Payment Received').length

  return (
    <div className="space-y-5">
      {/* Header Banner & Executive Stat Cards */}
      <ModuleHeader
        title="Invoice & Billing Details"
        subtitle={`Billing & payment records · ${activeFy === 'overall' ? 'All Financial Years' : `FY ${activeFy}`} · ${records.length} invoices`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExport} className="btn-ghost"><Download size={14} /> Export</button>
            {isAdmin && (
              <>
                <button onClick={() => setImportOpen(true)} className="btn-ghost"><Upload size={14} /> Import</button>
                <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Invoice</button>
              </>
            )}
          </div>
        }
        stats={[
          { icon: Receipt, label: 'Total Invoices', value: records.length, sub: activeFy === 'overall' ? 'All FY' : `FY ${activeFy}`, color: 'purple' },
          { icon: DollarSign, label: 'Grand Total Value', value: formatINR(totalGrand), sub: 'Total Billed', color: 'cyan' },
          { icon: CheckCircle2, label: 'Received Amount', value: formatINR(totalReceived), sub: `${totalPaidCount} Fully Paid`, color: 'green' },
          { icon: FileCheck, label: 'Pending Received', value: formatINR(totalGrand - totalReceived), sub: 'Balance Due', color: 'amber' },
        ]}
      />

      {/* FY Tabs Control Box */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <FyTabs basePath="/invoices" />
        <SlotTabs slots={INVOICE_SLOTS} active={activeSlot} setActive={setActiveSlot} />
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-medium px-2.5 flex items-center gap-1">
            <Filter size={12} className="text-jio-blue-400" /> Split FY By:
          </span>
          <div className="px-3 py-1.5 rounded-lg font-semibold text-slate-300 flex items-center gap-1">
            <Calendar size={12} /> Invoice Date
          </div>
        </div>
      </div>

      {activeFy === 'overall' ? (
        /* ═══ ALL FY OVERALL ══════════════════════════════════ */
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe size={15} className="text-jio-blue-400" /> All Financial Years — Overall View
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-400 pb-2 pr-4">FY</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Invoices</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Grand Total</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">TDS</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Received</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Full Paid</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 pl-3">Pending</th>
                </tr>
              </thead>
              <tbody>
                {fyStats.map(s => (
                  <tr key={s.fy} className={`border-b border-slate-800/60`}>
                    <td className="py-2.5 pr-4 font-semibold">
                      <span className="text-white">FY {s.fy}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-medium">{s.total}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">{formatINR(s.grandTotal)}</td>
                    <td className="py-2.5 px-3 text-right text-amber-400">{formatINR(s.tds)}</td>
                    <td className="py-2.5 px-3 text-right text-cyan-400">{formatINR(s.received)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">{s.fullPaid}</td>
                    <td className="py-2.5 pl-3 text-right text-jio-red-400">{s.pending}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600">
                  <td className="py-2.5 pr-4 text-xs font-bold text-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">{fyStats.reduce((s,r)=>s+r.total,0)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{formatINR(fyStats.reduce((s,r)=>s+r.grandTotal,0))}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-amber-400">{formatINR(fyStats.reduce((s,r)=>s+r.tds,0))}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-cyan-400">{formatINR(fyStats.reduce((s,r)=>s+r.received,0))}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{fyStats.reduce((s,r)=>s+r.fullPaid,0)}</td>
                  <td className="py-2.5 pl-3 text-right font-bold text-jio-red-400">{fyStats.reduce((s,r)=>s+r.pending,0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ═══ CURRENT FY SUMMARY ══════════════════════════════ */
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-jio-blue-400" /> FY {activeFy} Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard label="Total Invoices"  value={records.length}          color="blue"   />
            <StatCard label="Grand Total"     value={formatINR(totalGT)}      color="green"  />
            <StatCard label="TDS"             value={formatINR(totalTDS)}     color="amber"  />
            <StatCard label="SD/Retention"    value={formatINR(totalSD)}      color="purple" />
            <StatCard label="Amt Received"    value={formatINR(totalRec)}     color="cyan"   />
            <StatCard label="Full Paid"        value={fullPaidCnt}             color="green"  />
            <StatCard label="Net Received"     value={netAmtCnt}               color="blue"   />
            <StatCard label="GST Only"         value={gstOnlyCnt}              color="amber"  />
          </div>
        </div>
      )}

      <div className="glass-card p-4">
        <DataTable columns={columns} data={sortedRecords} loading={isLoading}
          emptyMessage={activeFy === 'overall' ? 'No invoices found' : `No invoices for FY ${activeFy}`} />
      </div>

      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit Invoice' : 'Add Invoice'}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Tax Calculation Selection Box */}
          <div className="col-span-2 md:col-span-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calculator size={14} className="text-jio-blue-400" /> Tax Calculation Mode (Auto-Calculates GST & Grand Total from Total Value):
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTaxModeChange('CGST_SGST')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  taxMode === 'CGST_SGST'
                    ? 'bg-jio-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                CGST + SGST (9% + 9%)
              </button>
              <button
                type="button"
                onClick={() => handleTaxModeChange('IGST')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  taxMode === 'IGST'
                    ? 'bg-jio-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                IGST (18%)
              </button>
            </div>
          </div>

          {FORM_FIELDS.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''}
                onChange={handleFieldChange} className="input-field" step={f.type === 'number' ? '0.01' : undefined} />
            </div>
          ))}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-400 mb-1">Work Description</label>
            <textarea name="work_description" value={form.work_description || ''} onChange={handleFieldChange} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-400 mb-1">Payment Status</label>
            <select name="payment_status" value={form.payment_status} onChange={handleFieldChange} className="select-field w-auto">
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-3 flex justify-end gap-3 pt-2 border-t border-slate-700 mt-2">
            <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving…' : editRow ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)}
        onImport={importRecords} columnMap={INV_IMPORT_COLUMNS} title="Import Invoice Records" />
    </div>
  )
}
