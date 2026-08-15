import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, Upload, Pencil, Trash2, TrendingUp, Globe, Filter, Calendar, Calculator, Receipt, DollarSign, CheckCircle2, FileCheck } from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { invoiceDb, budgetDb, jmsDb } from '../lib/db'
import { formatINR, formatDate, exportToExcel, FINANCIAL_YEARS, PAYMENT_STATUSES, CURRENT_FY, getFinancialYear, applyGstDateAutoSync, applyInvoiceDateAndStatusRules, calculateExpectedPaymentDate } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import FyTabs from '../components/FyTabs'
import SlotTabs from '../components/SlotTabs'
import MonthTabs, { MONTHS } from '../components/MonthTabs'
import RecordDetailModal from '../components/RecordDetailModal'
import PdfCell from '../components/PdfCell'
import { loadMasters } from '../lib/masters'

const EMPTY_FORM = {
  inv_date: '', jms_no: '', work_order_number: '', gst_no: '', inv_number: '',
  sac_code: '', work_description: '', site: '', type_of_ro: '', ro_code: '',
  total: '', igst: '', cgst: '', sgst: '', grand_total: '', hb_rb: '', tds: '',
  gst_amount_deduction: '', gst_tds_2pct_iocl: '', sd_retention: '',
  tcs_credit_note: '', received_bill_amount: '', full_amount_received_date: '',
  gst_amount_received_date: '', payment_status: 'Pending',
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
  'Full Amount Received Date': 'full_amount_received_date', 'Full Amount Received DATE': 'full_amount_received_date', 'Full Received Date': 'full_amount_received_date', 'Amount Received DATE': 'full_amount_received_date', 'amount_received_date': 'full_amount_received_date', 'full_amount_received_date': 'full_amount_received_date',
  'GST Amount Received Date': 'gst_amount_received_date', 'GST Amount Received DATE': 'gst_amount_received_date', 'GST Received Date': 'gst_amount_received_date', 'gst_amount_received_date': 'gst_amount_received_date',
  'Payment Status': 'payment_status', 'payment_status': 'payment_status',
}

const INV_IMPORT_COLUMNS = [
  'inv_date','jms_no','work_order_number','gst_no','inv_number','sac_code',
  'work_description','site','type_of_ro','ro_code','total','igst','cgst','sgst',
  'grand_total','hb_rb','tds','gst_amount_deduction','gst_tds_2pct_iocl',
  'sd_retention','tcs_credit_note','received_bill_amount','full_amount_received_date','gst_amount_received_date','payment_status',
]

function PaymentBadge({ status }) {
  const map = {
    'Pending': 'badge-pending',
    'GST Payment Only Received': 'badge-qsd',
    'Net Amount Received': 'badge-a2',
    'Full Payment Received': 'badge-invoiced',
  }
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status || 'Pending'}</span>
}

function StatCard({ label, value, sub, color = 'blue' }) {
  const cls = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  }
  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 backdrop-blur-sm transition-all hover:scale-[1.02] ${cls[color]}`}>
      <p className="text-[10px] font-semibold text-gray-500 dark:text-white dark:text-white uppercase tracking-wider mb-1 whitespace-nowrap">{label}</p>
      <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 dark:text-white dark:text-white mt-0.5 whitespace-nowrap">{sub}</p>}
    </div>
  )
}

function getRecordFy(r) {
  const date = r.inv_date || r.amount_received_date || r.gst_amount_received_date;
  if (date) {
    const fy = getFinancialYear(date)
    if (fy) return fy
  }
  return r.financial_year || '2024-25'
}

export default function InvoicePage() {
  const { user, isAdmin } = useAuth()
  const { fy: paramFy } = useParams()
  const [searchParams] = useSearchParams()
  const activeFy = searchParams.get('fy') || paramFy || CURRENT_FY
  const qc = useQueryClient()

  const [formOpen, setFormOpen]     = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editRow, setEditRow]       = useState(null)
  const [taxMode, setTaxMode]       = useState('CGST_SGST') // 'CGST_SGST' or 'IGST'
  const [form, setForm]             = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [activeSlot, setActiveSlot] = useState(searchParams.get('slot') || 'all')
  const [selectedRowModal, setSelectedRowModal] = useState(null)

  useEffect(() => {
    const s = searchParams.get('search')
    if (s) setSearchQuery(s)
    const slot = searchParams.get('slot')
    if (slot) setActiveSlot(slot)
    const month = searchParams.get('month')
    if (month) setActiveMonth(month)
  }, [searchParams])

  const PAYMENT_SLOTS = [
    { key: 'all',           label: 'All Invoices' },
    { key: 'pending',       label: 'Pending' },
    { key: 'gst_only',      label: 'GST Only Received' },
    { key: 'net_received',  label: 'Net Amount Received' },
    { key: 'full_paid',     label: 'Full Payment Received' },
    { key: 'cancelled',     label: 'Cancelled / Deleted' },
  ]

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['invoices', 'all'],
    queryFn: () => invoiceDb.listAll(),
  })

  const { data: budgetList = [] } = useQuery({
    queryKey: ['budget', 'all'],
    queryFn: () => budgetDb.listAll(),
  })

  const { data: jmsList = [] } = useQuery({
    queryKey: ['jms', 'all'],
    queryFn: () => jmsDb.listAll(),
  })

  const budgetTimeframeMap = useMemo(() => {
    const map = {}
    budgetList.forEach(b => {
      if (b.work_order_number) {
        map[b.work_order_number.trim().toLowerCase()] = b.payment_timeframe_days || 30
      }
    })
    return map
  }, [budgetList])

  const jmsPostingDateMap = useMemo(() => {
    const map = {}
    jmsList.forEach(j => {
      if (j.jms_no && (j.inv_posting_date || j.inv_date)) {
        map[String(j.jms_no).trim().toLowerCase()] = j.inv_posting_date || j.inv_date
      }
    })
    return map
  }, [jmsList])

  const records = useMemo(() => {
    const rawList = activeFy === 'overall' ? allRecords : allRecords.filter(r => getRecordFy(r) === activeFy)
    return rawList.map(r => {
      const synced = applyInvoiceDateAndStatusRules(r)
      const woKey = String(r.work_order_number || '').trim().toLowerCase()
      const jmsKey = String(r.jms_no || '').trim().toLowerCase()
      const invKey = String(r.inv_number || '').trim().toLowerCase()
      const timeframeDays = budgetTimeframeMap[woKey] || 30
      synced.payment_timeframe_days = timeframeDays

      // Link Invoice Posting Date from invoice or linked JMS record
      const postingDate = synced.inv_posting_date || jmsPostingDateMap[jmsKey] || jmsPostingDateMap[invKey] || ''
      synced.inv_posting_date = postingDate
      synced.expected_payment_date = postingDate ? calculateExpectedPaymentDate(postingDate, timeframeDays) : ''
      return synced
    })
  }, [allRecords, activeFy, budgetTimeframeMap, jmsPostingDateMap])

  const [activeMonth, setActiveMonth] = useState(searchParams.get('month') || 'all')

  const monthRecords = useMemo(() => {
    if (activeMonth === 'all') return records
    return records.filter(r => {
      const d = r.inv_date ? new Date(r.inv_date) : null
      return d && !isNaN(d.getTime()) && (d.getMonth() + 1) === Number(activeMonth)
    })
  }, [records, activeMonth])

  const sortedRecords = useMemo(() => {
    let result = monthRecords.filter(r => {
      const st = String(r.payment_status || r.status || '').toLowerCase()
      if (activeSlot === 'cancelled') return st.includes('cancel')
      if (activeSlot !== 'cancelled' && activeSlot !== 'all' && st.includes('cancel')) return false
      
      if (activeSlot === 'pending' && r.payment_status !== 'Pending') return false
      if (activeSlot === 'gst_only' && r.payment_status !== 'GST Payment Only Received') return false
      if (activeSlot === 'net_received' && r.payment_status !== 'Net Amount Received') return false
      if (activeSlot === 'full_paid' && r.payment_status !== 'Full Payment Received') return false

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const invNo = String(r.inv_number || '').toLowerCase()
        const wo = String(r.work_order_number || '').toLowerCase()
        const jms = String(r.jms_no || '').toLowerCase()
        const desc = String(r.work_description || '').toLowerCase()
        const site = String(r.site || '').toLowerCase()
        return invNo.includes(q) || wo.includes(q) || jms.includes(q) || desc.includes(q) || site.includes(q)
      }
      return true
    })

    return [...result].sort((a, b) => {
      const da = new Date(a.inv_date || 0)
      const db = new Date(b.inv_date || 0)
      return db - da
    })
  }, [monthRecords, activeSlot, searchQuery])

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

  // Master Data & unique suggestions for Invoice form
  const masters = loadMasters()
  const uniqueSites = useMemo(() => Array.from(new Set(allRecords.map(i => i.site?.trim()).concat(jmsList.map(j => j.site?.trim())).concat((masters.sites || []).map(s => s.name?.trim())).filter(Boolean))).sort(), [allRecords, jmsList, masters.sites])
  const uniqueJmsNos = useMemo(() => Array.from(new Set(jmsList.map(j => String(j.jms_no || '').trim()).filter(Boolean))).sort(), [jmsList])
  const uniqueWorkOrders = useMemo(() => Array.from(new Set(allRecords.map(i => i.work_order_number?.trim()).concat(jmsList.map(j => j.work_order_number?.trim())).concat((masters.work_orders || []).map(w => w.work_order_number?.trim())).filter(Boolean))).sort(), [allRecords, jmsList, masters.work_orders])

  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      let next = { ...prev, [name]: value }
      if (name === 'work_order_number' && value.trim()) {
        const matchMaster = (masters.work_orders || []).find(w => w.work_order_number.trim().toLowerCase() === value.trim().toLowerCase())
        if (matchMaster) {
          next.arc_number = matchMaster.arc_number || ''
          next.work_description = next.work_description || matchMaster.description || ''
          if (matchMaster.arc_number) {
            toast.success(`Auto-filled ARC #${matchMaster.arc_number} from Master ✓`, { id: `wo-inv-autofill-${matchMaster.work_order_number}` })
          }
        }
      }
      if (name === 'jms_no' && value.trim()) {
        const match = jmsList.find(j => String(j.jms_no || '').trim().toLowerCase() === value.trim().toLowerCase())
        if (match) {
          next.work_order_number = next.work_order_number || match.work_order_number || ''
          next.arc_number        = next.arc_number || match.arc_number || ''
          next.site              = next.site || match.site || ''
          next.ro_code           = next.ro_code || match.ro_code || ''
          next.work_description  = next.work_description || match.work_description || ''
          if (!next.total && match.net_amount) {
            next.total = String(match.net_amount)
            next = updateCalculations(next, taxMode)
          }
          toast.success(`Auto-filled from JMS #${match.jms_no} ✓`, { id: `autofill-${match.jms_no}` })
        }
      }
      if (name === 'total') {
        next = updateCalculations(next, taxMode)
      }
      if (['inv_date', 'full_amount_received_date', 'amount_received_date', 'gst_amount_received_date'].includes(name)) {
        next = applyGstDateAutoSync(next)
      }
      return next
    })
  }

  const handleTaxModeChange = (mode) => {
    setTaxMode(mode)
    setForm(prev => updateCalculations({ ...prev }, mode))
  }

  // Per-FY stats (excluding cancelled invoices)
  const fyStats = FINANCIAL_YEARS.map(f => {
    const rows = allRecords.filter(r => getRecordFy(r) === f)
    const activeRows = rows.filter(r => !String(r.payment_status || r.status || '').toLowerCase().includes('cancel'))
    return {
      fy: f,
      count:       rows.length,
      grandTotal:  activeRows.reduce((s, r) => s + (r.grand_total || 0), 0),
      received:    activeRows.reduce((s, r) => s + (r.received_bill_amount || 0), 0),
      fullPaid:    activeRows.filter(r => r.payment_status === 'Full Payment Received').length,
      pending:     activeRows.filter(r => r.payment_status === 'Pending').length,
    }
  })

  // Current records stats (excluding cancelled and IOCL records from income/profit sums)
  // Dynamically updated by selected Month!
  const activeInvoiceRecords = monthRecords.filter(r => {
    const desc = String(r.work_description || '')
    const st = String(r.payment_status || r.status || '').toLowerCase()
    const isCancelled = desc.includes('[Cancelled:') || st.includes('cancel')
    const isIocl = String(r.type_of_ro || '').trim().toUpperCase() === 'IOCL'
    return !isCancelled && !isIocl
  })
  const totalGT        = activeInvoiceRecords.reduce((s, r) => s + (r.grand_total || 0), 0)
  const totalTDS       = activeInvoiceRecords.reduce((s, r) => s + (r.tds || 0), 0)
  const totalRec       = activeInvoiceRecords.reduce((s, r) => s + (r.received_bill_amount || 0), 0)
  const totalSD        = activeInvoiceRecords.reduce((s, r) => s + (r.sd_retention || 0), 0)
  const fullPaidCnt    = activeInvoiceRecords.filter(r => r.payment_status === 'Full Payment Received').length
  const pendingCnt     = activeInvoiceRecords.filter(r => r.payment_status === 'Pending').length
  const gstOnlyCnt     = activeInvoiceRecords.filter(r => r.payment_status === 'GST Payment Only Received').length
  const netAmtCnt      = activeInvoiceRecords.filter(r => r.payment_status === 'Net Amount Received').length
  
  const pendingRecords = activeInvoiceRecords.filter(r => r.payment_status === 'Pending' || r.payment_status === 'Net Amount Received' || r.payment_status === 'GST Payment Only Received')
  const pendingAmount  = pendingRecords.reduce((s, r) => s + (r.grand_total || 0), 0)
  const pendingCount   = pendingRecords.length

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const syncedPayload = applyGstDateAutoSync({ ...payload })
      return editRow
        ? invoiceDb.update(editRow.id, syncedPayload)
        : invoiceDb.create({ ...syncedPayload, financial_year: getRecordFy(syncedPayload) }, user?.id)
    },
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
      return applyGstDateAutoSync(rec)
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
    setForm(applyGstDateAutoSync({ ...EMPTY_FORM, ...row }))
    setFormOpen(true)
  }

  const openAdd = () => {
    setEditRow(null)
    setTaxMode('CGST_SGST')
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const handleClose = () => { setFormOpen(false); setEditRow(null); setForm(EMPTY_FORM) }
  
  const handleDelete = async (id, row) => {
    const label = row?.inv_number ? `Invoice #${row.inv_number}` : `Record #${id}`
    const linkedJmsNo = row?.jms_no?.trim()

    // Find the linked JMS record (by jms_no) from the already-loaded list
    const linkedJms = linkedJmsNo
      ? allRecords.find(r => String(r.jms_no || '').trim() === linkedJmsNo) ||
        jmsList.find(r => String(r.jms_no || '').trim() === linkedJmsNo)
      : null

    const jmsLabel = linkedJmsNo ? ` (and linked JMS ${linkedJmsNo})` : ''

    const markCancel = window.confirm(
      `Do you want to mark ${label}${jmsLabel} as "Cancelled by some issues"?\n\n` +
      `• Click OK to mark as Cancelled (Keeps details in table with 0 impact on financials & budget).\n` +
      `• Click Cancel to permanently delete the row${jmsLabel}.`
    )

    const cancelLinkedJms = async (jmsRecord, reason) => {
      if (!jmsRecord) return
      const desc = String(jmsRecord.work_description || '')
      if (desc.includes('[Cancelled:')) return // already cancelled
      try {
        await jmsDb.update(jmsRecord.id, {
          ...jmsRecord,
          status: 'Cancelled',
          work_description: `[Cancelled: ${reason}] ${desc}`.trim(),
        })
        qc.invalidateQueries(['jms'])
      } catch (e) {
        console.warn('Could not cascade-cancel JMS:', e)
      }
    }

    if (markCancel) {
      try {
        const logs = JSON.parse(localStorage.getItem('deleted_records_log') || '[]')
        logs.unshift({
          id: `del-inv-${Date.now()}-${id}`,
          type: 'invoice',
          title: `Invoice Cancelled: ${label}`,
          sub: `${label} was marked as Cancelled by Admin on ${new Date().toLocaleDateString()}${linkedJmsNo ? ` — Linked JMS ${linkedJmsNo} also cancelled.` : ''}`,
          timestamp: new Date().toISOString()
        })
        localStorage.setItem('deleted_records_log', JSON.stringify(logs.slice(0, 50)))
      } catch (e) {}

      // 1. Cancel the invoice
      saveMutation.mutate({ ...row, id, payment_status: 'Invoice Cancelled by some issues' })

      // 2. Cascade: cancel the linked JMS too
      if (linkedJms) {
        await cancelLinkedJms(linkedJms, 'Invoice Cancelled by some issues')
        toast.success(`Invoice & linked JMS ${linkedJmsNo} both marked as Cancelled`)
      }
    } else {
      if (window.confirm(`Permanently delete ${label}${jmsLabel}? This cannot be undone.`)) {
        try {
          const logs = JSON.parse(localStorage.getItem('deleted_records_log') || '[]')
          logs.unshift({
            id: `del-inv-${Date.now()}-${id}`,
            type: 'invoice',
            title: `Invoice Record Deleted: ${label}`,
            sub: `${label} was deleted by Admin on ${new Date().toLocaleDateString()}${linkedJmsNo ? ` — Linked JMS ${linkedJmsNo} also cancelled.` : ''}`,
            timestamp: new Date().toISOString()
          })
          localStorage.setItem('deleted_records_log', JSON.stringify(logs.slice(0, 50)))
        } catch (e) {}

        // 1. Delete the invoice
        deleteMutation.mutate(id)

        // 2. Cascade: cancel (not delete) the linked JMS — keeps audit trail
        if (linkedJms) {
          await cancelLinkedJms(linkedJms, 'Linked Invoice Deleted')
          toast.success(`Invoice deleted & linked JMS ${linkedJmsNo} marked as Cancelled`)
        }
      }
    }
  }

  const handleBulkDelete = async (selectedRows) => {
    if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected Invoices?`)) {
      for (const r of selectedRows) {
        await invoiceDb.delete(r.id)
      }
      qc.invalidateQueries(['invoices'])
      toast.success(`Deleted ${selectedRows.length} Invoices successfully ✓`)
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const handleExport = () => {
    const exportRows = sortedRecords.map(r => ({
      'Invoice Number': r.inv_number || '—',
      'Invoice Date': formatDate(r.inv_date) || '—',
      'JMS Number': r.jms_no || '—',
      'Work Order Number': r.work_order_number || '—',
      'GST Number': r.gst_no || '—',
      'SAC Code': r.sac_code || '—',
      'Site Location': r.site || '—',
      'Type of RO': r.type_of_ro || '—',
      'RO Code': r.ro_code || '—',
      'Work Description': r.work_description || '—',
      'Total (Before Tax ₹)': r.total || 0,
      'IGST (₹)': r.igst || 0,
      'CGST (₹)': r.cgst || 0,
      'SGST (₹)': r.sgst || 0,
      'Grand Total (₹)': r.grand_total || 0,
      'TDS (₹)': r.tds || 0,
      'GST TDS 2% IOCL (₹)': r.gst_tds_2pct_iocl || 0,
      'SD / Retention (₹)': r.sd_retention || 0,
      'Received Bill Amount (₹)': r.received_bill_amount || 0,
      'Full Received Date': formatDate(r.full_amount_received_date || r.amount_received_date) || '—',
      'GST Received Date': formatDate(r.gst_amount_received_date) || '—',
      'Invoice Posting Date': formatDate(r.inv_posting_date) || '—',
      'Expected Payment Date': formatDate(r.expected_payment_date) || '—',
      'Payment Status': r.payment_status || 'Pending',
    }))
    exportToExcel(exportRows, `Invoices_${activeFy}.xlsx`, 'Invoice Records')
    toast.success('Excel downloaded ✓')
  }

  const FORM_FIELDS = [
    { name: 'inv_date', label: 'Invoice Date', type: 'date' },
    { name: 'jms_no', label: 'JMS Number', list: 'inv-jms-list' },
    { name: 'work_order_number', label: 'Work Order Number', list: 'inv-wo-list' },
    { name: 'gst_no', label: 'GST Number' },
    { name: 'inv_number', label: 'Invoice Number' },
    { name: 'sac_code', label: 'SAC Code' },
    { name: 'site', label: 'Site', list: 'inv-site-list' },
    { name: 'type_of_ro', label: 'Type of RO' },
    { name: 'ro_code', label: 'RO Code' },
    { name: 'total', label: 'Total (Before Tax)', type: 'number' },
    { name: 'gst_tds_2pct_iocl', label: 'GST TDS 2% IOCL', type: 'number' },
    { name: 'sd_retention', label: 'SD / Retention', type: 'number' },
    { name: 'tcs_credit_note', label: 'TCS / Credit Note', type: 'number' },
    { name: 'received_bill_amount', label: 'Received Bill Amount', type: 'number' },
    { name: 'full_amount_received_date', label: 'Full Amount Received Date', type: 'date' },
    { name: 'gst_amount_received_date', label: 'GST Amount Received Date', type: 'date' },
  ]

  const columns = [
    { key: 'inv_number',               header: 'Invoice Number',     render: r => <span className="font-semibold text-gray-900 dark:text-white">{r.inv_number}</span> },
    { key: 'inv_date',                 header: 'Inv Date',           render: r => formatDate(r.inv_date) },
    { key: 'site',                     header: 'Site' },
    { key: 'work_description',         header: 'Description',        className: 'min-w-[150px] max-w-[180px] whitespace-normal leading-relaxed', render: r => <div className="text-[11px]">{r.work_description}</div> },
    { key: 'total',                    header: 'Net Amount',         className: 'w-[90px]', render: r => <span className="text-blue-400 font-medium whitespace-nowrap">{formatINR(r.total)}</span> },
    { key: 'igst',                     header: 'IGST',               render: r => formatINR(r.igst) },
    { key: 'cgst',                     header: 'CGST',               render: r => formatINR(r.cgst) },
    { key: 'sgst',                     header: 'SGST',               render: r => formatINR(r.sgst) },
    { key: 'grand_total',              header: 'Grand Total',        render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.grand_total)}</span> },
    { key: 'jms_no',                   header: 'JMS No',             render: r => <span className="font-semibold text-orange-400 font-mono text-xs">{r.jms_no}</span> },
    {
      key: 'expected_payment_date',    header: 'Expected Payment Date',
      render: r => (
        <span className="text-amber-300 font-semibold font-mono text-xs">
          {formatDate(r.expected_payment_date) || '—'}
        </span>
      )
    },
    { key: 'full_amount_received_date',header: 'Full Received Date', render: r => <span className="font-mono text-emerald-300">{formatDate(r.full_amount_received_date || r.amount_received_date) || '—'}</span> },
    { key: 'gst_amount_received_date', header: 'GST Received Date',  render: r => <span className="font-mono text-emerald-300">{formatDate(r.gst_amount_received_date) || '—'}</span> },
    { key: 'payment_status',           header: 'Payment Status',     render: r => <PaymentBadge status={r.payment_status} /> },
    {
      key: 'pdf', header: 'Documents', sortable: false,
      render: r => (
        <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-16">Invoice:</span>
            <PdfCell pdfUrl={r.pdf_url} folder="invoices" isAdmin={isAdmin}
              downloadName={`Invoice_${r.invoice_number || ''}`}
              onSave={url => pdfMutation.mutateAsync({ id: r.id, pdf_url: url })}
              onDelete={() => pdfMutation.mutateAsync({ id: r.id, pdf_url: null })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-16">E-Invoice:</span>
            <PdfCell pdfUrl={r.pdf_url_2} folder="invoices" isAdmin={isAdmin}
              downloadName={`E-Invoice_${r.invoice_number || ''}`}
              onSave={url => pdfMutation.mutateAsync({ id: r.id, pdf_url_2: url })}
              onDelete={() => pdfMutation.mutateAsync({ id: r.id, pdf_url_2: null })} />
          </div>
        </div>
      )
    },
    ...(isAdmin ? [{
      key: '_actions', header: 'Actions', sortable: false,
      render: r => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-jio-blue-800/50 text-jio-blue-400 hover:text-white transition-colors" title="Edit Invoice"><Pencil size={14} /></button>
          <button onClick={() => handleDelete(r.id, r)} className="p-1.5 rounded-lg hover:bg-jio-red-900/50 text-jio-red-400 hover:text-white transition-colors" title="Delete Invoice"><Trash2 size={14} /></button>
        </div>
      )
    }] : []),
  ]

  return (
    <div className="space-y-0">
      {document.getElementById('topbar-center') && createPortal(
        <div className="flex items-center gap-2">
          <MonthTabs activeMonth={activeMonth} onChange={setActiveMonth} />
          <SlotTabs slots={PAYMENT_SLOTS} activeSlot={activeSlot} onChange={setActiveSlot} />
        </div>,
        document.getElementById('topbar-center')
      )}
      {document.getElementById('topbar-actions') && createPortal(
        <div className="flex items-center gap-2">
          <button onClick={handleExport} title="Export" className="btn-ghost !px-2 !py-1 !text-xs"><Download size={13} /></button>
          {isAdmin && (
            <>
              <button onClick={() => setImportOpen(true)} title="Import" className="btn-ghost !px-2 !py-1 !text-xs"><Upload size={13} /></button>
              <button onClick={openAdd} title="Add Invoice" className="btn-primary !px-2 !py-1 !text-xs"><Plus size={13} /></button>
            </>
          )}
          <FyTabs basePath="/invoices" activeFy={activeFy} stats={fyStats} />
        </div>,
        document.getElementById('topbar-actions')
      )}

      <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 p-4">
        <DataTable columns={columns} data={sortedRecords} loading={isLoading}
          enableSelection={isAdmin} onBulkDelete={handleBulkDelete}
          initialSearch={searchQuery}
          emptyMessage={activeFy === 'overall' ? 'No invoices found' : `No invoices for FY ${activeFy}`}
          onRowClick={(row) => setSelectedRowModal(row)} />
      </div>

      {/* On-screen Row Click Record Detail Modal */}
      <RecordDetailModal
        record={selectedRowModal}
        type="invoice"
        onClose={() => setSelectedRowModal(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
        isAdmin={isAdmin}
      />

      <datalist id="inv-site-list">{uniqueSites.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="inv-jms-list">{uniqueJmsNos.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="inv-wo-list">{uniqueWorkOrders.map(s => <option key={s} value={s} />)}</datalist>

      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit Invoice' : 'Add Invoice'}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Tax Calculation Selection Box */}
          <div className="col-span-2 md:col-span-3  p-3 rounded-xl border border-gray-200 dark:border-gray-800/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-white flex items-center gap-1.5">
              <Calculator size={14} className="text-jio-blue-400" /> Tax Calculation Mode (Auto-Calculates GST & Grand Total from Total Value):
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTaxModeChange('CGST_SGST')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  taxMode === 'CGST_SGST'
                    ? 'bg-jio-blue-600 text-white shadow-md'
                    : 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-500 dark:text-white dark:text-white hover: hover:text-gray-900 dark:text-white'
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
                    : 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-500 dark:text-white dark:text-white hover: hover:text-gray-900 dark:text-white'
                }`}
              >
                IGST (18%)
              </button>
            </div>
          </div>

          {FORM_FIELDS.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">{f.label}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''} list={f.list}
                onChange={handleFieldChange} className="input-field" step={f.type === 'number' ? '0.01' : undefined} />
            </div>
          ))}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">Work Description</label>
            <textarea name="work_description" value={form.work_description || ''} onChange={handleFieldChange} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">Payment Status</label>
            <select name="payment_status" value={form.payment_status} onChange={handleFieldChange} className="select-field w-auto">
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-3 flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800 mt-2">
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
