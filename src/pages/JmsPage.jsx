import { useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, Upload, Pencil, Trash2, TrendingUp, Globe, Filter, Calendar, FileText, Clock, CheckCircle, Receipt } from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { jmsDb, budgetDb, invoiceDb } from '../lib/db'
import { formatINR, formatDate, exportToExcel, FINANCIAL_YEARS, JMS_STATUSES, CURRENT_FY, getFinancialYear, calculateExpectedPaymentDate } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import FyTabs from '../components/FyTabs'
import SlotTabs from '../components/SlotTabs'
import RecordDetailModal from '../components/RecordDetailModal'
import PdfCell from '../components/PdfCell'
import { loadMasters } from '../lib/masters'

const EMPTY_FORM = {
  jms_no: '', period_of_work: '', work_order_number: '', arc_number: '',
  net_amount: '', jms_create_date: '', site: '', ro_code: '', work_description: '',
  status: 'Pending A1',
  a1_name: '', a1_release_date: '', a2_name: '', a2_release_date: '',
  qsd_name: '', qsd_release_date: '', a3_name: '',
  inv_number: '', inv_date: '', inv_posting_date: '', payment_date: '',
}

const JMS_IMPORT_COLUMNS = [
  'jms_no','period_of_work','work_order_number','arc_number','net_amount',
  'jms_create_date','site','ro_code','work_description','status',
  'a1_name','a1_release_date','a2_name','a2_release_date',
  'qsd_name','qsd_release_date','a3_name',
  'inv_number','inv_date','inv_posting_date','payment_date',
]

const IMPORT_MAP = {
  'JMS No': 'jms_no', 'Jms No': 'jms_no', 'jms_no': 'jms_no',
  'Period of Work': 'period_of_work', 'period_of_work': 'period_of_work',
  'Work Order Number': 'work_order_number', 'Work order number': 'work_order_number', 'work_order_number': 'work_order_number',
  'ARC Number': 'arc_number', 'ARC No': 'arc_number', 'arc_number': 'arc_number',
  'Net Amount': 'net_amount', 'net_amount': 'net_amount',
  'JMS Create Date': 'jms_create_date', 'jms_create_date': 'jms_create_date', 'JMS Date': 'jms_create_date', 'JMS DATE': 'jms_create_date', 'Jms Date': 'jms_create_date', 'Jms date': 'jms_create_date',
  'Site': 'site', 'site': 'site',
  'RO CODE': 'ro_code', 'RO Code': 'ro_code', 'ro_code': 'ro_code',
  'Work Description': 'work_description', 'work_description': 'work_description',
  'Status': 'status', 'status': 'status',
  'A1 Name': 'a1_name', 'a1_name': 'a1_name',
  'A1 Release date': 'a1_release_date', 'A1 Release Date': 'a1_release_date', 'a1_release_date': 'a1_release_date',
  'A2 Name': 'a2_name', 'a2_name': 'a2_name',
  'A2 Release date': 'a2_release_date', 'A2 Release Date': 'a2_release_date', 'a2_release_date': 'a2_release_date',
  'QSD Name': 'qsd_name', 'qsd_name': 'qsd_name',
  'QSD Release date': 'qsd_release_date', 'QSD Release Date': 'qsd_release_date', 'qsd_release_date': 'qsd_release_date',
  'A3 Name': 'a3_name', 'a3_name': 'a3_name',
  'Inv number': 'inv_number', 'Inv Number': 'inv_number', 'inv_number': 'inv_number',
  'Inv date': 'inv_date', 'Inv Date': 'inv_date', 'inv_date': 'inv_date',
  'Inv Posting Date': 'inv_posting_date', 'inv_posting_date': 'inv_posting_date',
  'Payment Date': 'payment_date', 'payment_date': 'payment_date',
}

const STATUS_TO_DB = {
  'Pending A1': 'A1',
  'Pending A2': 'A2',
  'Pending QSD': 'QSD',
  'Pending A3': 'A3',
  'Released by A3': 'Invoiced',
  'Cancelled / Deleted': 'Cancelled',
  'Cancelled': 'Cancelled',
  'Pending': 'Pending',
  'A1': 'A1',
  'A2': 'A2',
  'QSD': 'QSD',
  'A3': 'A3',
  'Invoiced': 'Invoiced',
}

function getDbStatus(status) {
  if (!status) return 'A1'
  const str = String(status).trim().toLowerCase()
  if (str.includes('cancel')) return 'Cancelled'
  if (str.includes('invoiced') || str.includes('released')) return 'Invoiced'
  if (str.includes('a2')) return 'A2'
  if (str.includes('qsd')) return 'QSD'
  if (str.includes('a3')) return 'A3'
  if (str.includes('a1') || str.includes('pending')) return 'A1'
  return 'A1'
}

const STATUS_DISPLAY = {
  'Pending': 'Pending A1',
  'A1': 'Pending A1',
  'Pending A1': 'Pending A1',
  'A2': 'Pending A2',
  'Pending A2': 'Pending A2',
  'QSD': 'Pending QSD',
  'Pending QSD': 'Pending QSD',
  'A3': 'Pending A3',
  'Pending A3': 'Pending A3',
  'Invoiced': 'Released by A3',
  'Released by A3': 'Released by A3',
  'Cancelled': 'Cancelled / Deleted',
  'Cancelled / Deleted': 'Cancelled / Deleted',
}

const STATUS_CSS = {
  'Pending A1': 'badge-pending', 'Pending': 'badge-pending', 'A1': 'badge-pending',
  'Pending A2': 'badge-a2', 'A2': 'badge-a2',
  'Pending QSD': 'badge-qsd', 'QSD': 'badge-qsd',
  'Pending A3': 'badge-a3', 'A3': 'badge-a3',
  'Released by A3': 'badge-invoiced', 'Invoiced': 'badge-invoiced',
  'Cancelled': 'badge-cancelled', 'Cancelled / Deleted': 'badge-cancelled',
}

function StatusBadge({ status }) {
  const displayLabel = STATUS_DISPLAY[status] || status || 'Pending A1'
  return <span className={`badge ${STATUS_CSS[status] || STATUS_CSS[displayLabel] || 'badge-pending'}`}>{displayLabel}</span>
}

function StatCard({ label, value, color = 'slate' }) {
  const cls = {
    blue:   'border-jio-blue-700/40 bg-jio-blue-900/30',
    amber:  'border-amber-700/40 bg-amber-900/20',
    green:  'border-emerald-700/40 bg-emerald-900/20',
    purple: 'border-purple-700/40 bg-purple-900/20',
    cyan:   'border-cyan-700/40 bg-cyan-900/20',
    red:    'border-jio-red-700/40 bg-jio-red-900/20',
    slate:  'border-slate-700/40 bg-slate-800/40',
  }
  return (
    <div className={`rounded-xl border p-3 ${cls[color]}`}>
      <p className="text-[11px] font-medium text-slate-400 mb-1 leading-tight">{label}</p>
      <p className="text-base font-bold text-white leading-tight">{value}</p>
    </div>
  )
}

export default function JmsPage() {
  const { fy: paramFy } = useParams()
  const [searchParams] = useSearchParams()
  const activeFy = searchParams.get('fy') || paramFy || CURRENT_FY
  const initialSlot = searchParams.get('slot') || 'all'

  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()

  // Slot filtering for JMS statuses
  const JMS_SLOTS = [
    { key: 'all', label: 'All' },
    { key: 'pending_a1', label: 'Pending A1' },
    { key: 'pending_a2', label: 'Pending A2' },
    { key: 'pending_qsd', label: 'Pending QSD' },
    { key: 'pending_a3', label: 'Pending A3' },
    { key: 'released_a3', label: 'Released by A3' },
    { key: 'cancelled', label: 'Cancelled / Deleted' },
  ]
  const [activeSlot, setActiveSlot] = useState(initialSlot)

  const [formOpen,   setFormOpen]   = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editRow,    setEditRow]    = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [selectedRowModal, setSelectedRowModal] = useState(null)

  // Fetch all records to support flexible splitting
  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['jms', 'all'],
    queryFn:  () => jmsDb.listAll(),
  })

  const { data: budgetList = [] } = useQuery({
    queryKey: ['budget', 'all'],
    queryFn: () => budgetDb.listAll(),
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

  // Helper to determine record FY always based on jms_create_date first, falling back to other dates if empty
  const getRecordFy = (r) => {
    const date = r.jms_create_date || r.inv_date || r.a1_release_date || r.a2_release_date || r.qsd_release_date || r.inv_posting_date || r.payment_date;
    if (date) {
      return getFinancialYear(date)
    }
    return r.financial_year || '2024-25'
  }

  // Active records for table
  const fyRecords = activeFy === 'overall' ? allRecords : allRecords.filter(r => getRecordFy(r) === activeFy)

  const { data: invoiceList = [] } = useQuery({
    queryKey: ['invoices', 'all'],
    queryFn: () => invoiceDb.listAll(),
  })

  const invPostingDateMap = useMemo(() => {
    const map = {}
    invoiceList.forEach(inv => {
      if (inv.jms_no && inv.inv_posting_date) {
        map[String(inv.jms_no).trim().toLowerCase()] = inv.inv_posting_date
      }
      if (inv.inv_number && inv.inv_posting_date) {
        map[String(inv.inv_number).trim().toLowerCase()] = inv.inv_posting_date
      }
    })
    return map
  }, [invoiceList])

  const invPaymentDateMap = useMemo(() => {
    const map = {}
    invoiceList.forEach(inv => {
      const pDate = inv.payment_date || inv.full_amount_received_date || inv.amount_received_date
      if (pDate) {
        if (inv.jms_no) map[String(inv.jms_no).trim().toLowerCase()] = pDate
        if (inv.inv_number) map[String(inv.inv_number).trim().toLowerCase()] = pDate
      }
    })
    return map
  }, [invoiceList])

  // Apply slot filter based on status
  const records = useMemo(() => {
    return fyRecords.map(r => {
      const woKey = String(r.work_order_number || '').trim().toLowerCase()
      const jmsKey = String(r.jms_no || '').trim().toLowerCase()
      const invKey = String(r.inv_number || '').trim().toLowerCase()

      const timeframeDays = budgetTimeframeMap[woKey] || 30
      const postingDate = r.inv_posting_date || invPostingDateMap[jmsKey] || invPostingDateMap[invKey] || ''
      const payDate = r.payment_date || r.full_amount_received_date || invPaymentDateMap[jmsKey] || invPaymentDateMap[invKey] || ''

      const desc = String(r.work_description || '')
      const st = String(r.status || '').toLowerCase()
      const isCancelled = desc.includes('[Cancelled:') || st.includes('cancel')

      return {
        ...r,
        status: isCancelled ? 'Cancelled / Deleted' : r.status,
        inv_posting_date: postingDate,
        payment_date: payDate,
        payment_timeframe_days: timeframeDays,
        expected_payment_date: postingDate ? calculateExpectedPaymentDate(postingDate, timeframeDays) : '',
      }
    }).filter(r => {
      const st = String(r.status || '').toLowerCase()
      const isCancelled = st.includes('cancel')

      if (activeSlot === 'cancelled') return isCancelled
      if (activeSlot !== 'cancelled' && activeSlot !== 'all' && isCancelled) return false
      if (activeSlot === 'pending_a1') return ['Pending A1', 'Pending', 'A1'].includes(r.status)
      if (activeSlot === 'pending_a2') return ['Pending A2', 'A2'].includes(r.status)
      if (activeSlot === 'pending_qsd') return ['Pending QSD', 'QSD'].includes(r.status)
      if (activeSlot === 'pending_a3') return ['Pending A3', 'A3'].includes(r.status)
      if (activeSlot === 'released_a3') return ['Released by A3', 'Invoiced'].includes(r.status)
      return true
    })
  }, [fyRecords, activeSlot, budgetTimeframeMap, invPostingDateMap, invPaymentDateMap])

  // Sort records: Current FY on top, then newest on top by JMS Date (or fallback date), then JMS No
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const fyA = getRecordFy(a)
      const fyB = getRecordFy(b)
      if (fyA !== fyB) {
        if (fyA === CURRENT_FY) return -1
        if (fyB === CURRENT_FY) return 1
        return fyB.localeCompare(fyA)
      }
      const dateA = a.jms_create_date || a.inv_date || a.a1_release_date || a.created_at || ''
      const dateB = b.jms_create_date || b.inv_date || b.a1_release_date || b.created_at || ''
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA)
      }
      return String(b.jms_no || '').localeCompare(String(a.jms_no || ''), undefined, { numeric: true })
    })
  }, [records])

  // Per-FY stats for Overall View (excluding cancelled items from sum)
  const fyStats = FINANCIAL_YEARS.map(f => {
    const rows = allRecords.filter(r => getRecordFy(r) === f)
    const activeRows = rows.filter(r => !String(r.status || '').toLowerCase().includes('cancel'))
    return {
      fy: f,
      total:    rows.length,
      amount:   activeRows.reduce((s, r) => s + (r.net_amount || 0), 0),
      pending:  activeRows.filter(r => !['Released by A3','Invoiced'].includes(r.status)).length,
      a3:       activeRows.filter(r => r.status === 'Pending A3' || r.status === 'A3').length,
      invoiced: activeRows.filter(r => r.status === 'Released by A3' || r.status === 'Invoiced').length,
    }
  })

  // Current records stats (excluding cancelled records from total amount sum)
  const activeRecords = records.filter(r => !String(r.status || '').toLowerCase().includes('cancel'))
  const totalNetAmount = activeRecords.reduce((s, r) => s + (r.net_amount || 0), 0)
  const byStatus = JMS_STATUSES.reduce((acc, s) => ({ ...acc, [s]: records.filter(r => (STATUS_DISPLAY[r.status] || r.status) === s).length }), {})

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      // Convert UI status to database-compatible value before sending to Supabase
      const dbStatus = getDbStatus(payload.status)
      const cleanPayload = { ...payload, status: dbStatus }

      return editRow
        ? jmsDb.update(editRow.id, cleanPayload)
        : jmsDb.create({ ...cleanPayload, financial_year: getRecordFy(cleanPayload) }, user?.id)
    },
    onSuccess: () => {
      qc.invalidateQueries(['jms'])
      toast.success(editRow ? 'JMS updated ✓' : 'JMS created ✓')
      handleClose()
    },
    onError: (e) => toast.error(e?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: jmsDb.delete,
    onSuccess: () => { qc.invalidateQueries(['jms']); toast.success('JMS deleted') },
    onError:   (e) => toast.error(e?.message || 'Delete failed'),
  })

  const importRecords = async (rows) => {
    const mapped = rows.map(raw => {
      const rec = {}
      for (const [k, v] of Object.entries(raw)) {
        const dbKey = IMPORT_MAP[k] ?? IMPORT_MAP[k.trim()]
        if (dbKey && v !== '' && v !== null && v !== undefined) rec[dbKey] = v
      }
      // Ensure status is valid for database constraint
      rec.status = getDbStatus(rec.status)
      rec.financial_year = getRecordFy(rec)
      return rec
    }).filter(r => r.jms_no)

    if (!mapped.length) throw new Error('No valid rows found. Check column headers match the expected format.')
    const count = await jmsDb.bulkInsert(mapped, user?.id)
    qc.invalidateQueries(['jms'])
    return count
  }

  const openEdit = (row) => {
    setEditRow(row)
    const uiStatus = STATUS_DISPLAY[row.status] || row.status || 'Pending A1'
    setForm({ ...EMPTY_FORM, ...row, status: uiStatus })
    setFormOpen(true)
  }
  const openAdd  = ()    => { setEditRow(null); setForm(EMPTY_FORM); setFormOpen(true) }
  const handleClose  = () => { setFormOpen(false); setEditRow(null); setForm(EMPTY_FORM) }
  const masters = loadMasters()

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      let updated = { ...prev, [name]: value }
      if (name === 'work_order_number' && value.trim()) {
        const matchMaster = (masters.work_orders || []).find(w => w.work_order_number.trim().toLowerCase() === value.trim().toLowerCase())
        if (matchMaster) {
          updated.arc_number = matchMaster.arc_number || '' // If ARC number exists, fill it; otherwise leave blank!
          updated.work_description = updated.work_description || matchMaster.description || ''
          if (matchMaster.arc_number) {
            toast.success(`Auto-filled ARC #${matchMaster.arc_number} from Master ✓`, { id: `wo-autofill-${matchMaster.work_order_number}` })
          }
        }
      }
      return updated
    })
  }
  
  const handleDelete = (id, row) => {
    const label = row?.jms_no ? `JMS #${row.jms_no}` : `Record #${id}`
    const markCancel = window.confirm(
      `Do you want to mark ${label} as "Cancelled / Deleted"?\n\n` +
      `• Click OK to mark as "Cancelled / Deleted" (Keeps details in table with 0 impact on financials & budget).\n` +
      `• Click Cancel to permanently delete the row.`
    )
    if (markCancel) {
      try {
        const logs = JSON.parse(localStorage.getItem('deleted_records_log') || '[]')
        logs.unshift({
          id: `del-jms-${Date.now()}-${id}`,
          type: 'jms',
          title: `JMS Cancelled: ${label}`,
          sub: `${label} was marked as Cancelled by Admin on ${new Date().toLocaleDateString()}`,
          timestamp: new Date().toISOString()
        })
        localStorage.setItem('deleted_records_log', JSON.stringify(logs.slice(0, 50)))
      } catch (e) {}
      saveMutation.mutate({ ...row, id, status: 'Cancelled' })
    } else {
      if (window.confirm(`Permanently delete ${label}? This cannot be undone.`)) {
        try {
          const logs = JSON.parse(localStorage.getItem('deleted_records_log') || '[]')
          logs.unshift({
            id: `del-jms-${Date.now()}-${id}`,
            type: 'jms',
            title: `JMS Record Deleted: ${label}`,
            sub: `${label} was deleted by Admin on ${new Date().toLocaleDateString()}`,
            timestamp: new Date().toISOString()
          })
          localStorage.setItem('deleted_records_log', JSON.stringify(logs.slice(0, 50)))
        } catch (e) {}
        deleteMutation.mutate(id)
      }
    }
  }
  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const handleExport = () => {
    const exportRows = sortedRecords.map(r => ({
      'JMS Number': r.jms_no || '—',
      'JMS Date': formatDate(r.jms_create_date || r.inv_date) || '—',
      'Invoice Number': r.inv_number || '—',
      'Invoice Posting Date': formatDate(r.inv_posting_date) || '—',
      'Payment Date': formatDate(r.payment_date) || '—',
      'Work Order Number': r.work_order_number || '—',
      'Net Amount (₹)': r.net_amount || 0,
      'Site Location': r.site || '—',
      'Work Description': r.work_description || '—',
      'JMS Status': r.status || '—',
      'Expected Payment Date': formatDate(r.expected_payment_date) || '—',
    }))
    exportToExcel(exportRows, `JMS_${activeFy}.xlsx`, 'JMS Records')
    toast.success('Excel downloaded ✓')
  }

  // Autocomplete suggestions combining DB records & Master Data
  const uniqueSites = useMemo(() => Array.from(new Set(allRecords.map(j => j.site?.trim()).concat((masters.sites || []).map(s => s.name?.trim())).filter(Boolean))).sort(), [allRecords, masters.sites])
  const uniqueA1Names = useMemo(() => Array.from(new Set(allRecords.map(j => j.a1_name?.trim()).concat((masters.officers_a1 || []).map(o => o.name?.trim())).filter(Boolean))).sort(), [allRecords, masters.officers_a1])
  const uniqueA2Names = useMemo(() => Array.from(new Set(allRecords.map(j => j.a2_name?.trim()).concat((masters.officers_a2 || []).map(o => o.name?.trim())).filter(Boolean))).sort(), [allRecords, masters.officers_a2])
  const uniqueQsdNames = useMemo(() => Array.from(new Set(allRecords.map(j => j.qsd_name?.trim()).concat((masters.officers_qsd || []).map(o => o.name?.trim())).filter(Boolean))).sort(), [allRecords, masters.officers_qsd])
  const uniqueA3Names = useMemo(() => Array.from(new Set(allRecords.map(j => j.a3_name?.trim()).concat((masters.officers_a3 || []).map(o => o.name?.trim())).filter(Boolean))).sort(), [allRecords, masters.officers_a3])
  const uniqueWorkOrders = useMemo(() => Array.from(new Set(allRecords.map(j => j.work_order_number?.trim()).concat((masters.work_orders || []).map(w => w.work_order_number?.trim())).filter(Boolean))).sort(), [allRecords, masters.work_orders])

  const columns = [
    { key: 'jms_no',           header: 'JMS No',               render: r => <span className="font-semibold text-white">{r.jms_no}</span> },
    { key: 'jms_create_date',  header: 'JMS Date',              render: r => formatDate(r.jms_create_date || r.inv_date || r.a1_release_date) },
    { key: 'inv_number',       header: 'Invoice Number',        render: r => <span className="font-semibold text-purple-300">{r.inv_number || '—'}</span> },
    { key: 'inv_posting_date', header: 'Invoice Posting Date', render: r => <span className="font-mono text-cyan-300">{formatDate(r.inv_posting_date) || '—'}</span> },
    { key: 'payment_date',     header: 'Payment Date',          render: r => <span className="font-mono text-emerald-300 font-semibold">{formatDate(r.payment_date) || '—'}</span> },
    { key: 'period_of_work',   header: 'Period' },
    { key: 'work_order_number',header: 'Work Order',           render: r => <span className="font-semibold text-slate-200">{r.work_order_number}</span> },
    { key: 'net_amount',       header: 'Net Amount',            render: r => <span className="text-emerald-400 font-semibold">{formatINR(r.net_amount)}</span> },
    { key: 'site',             header: 'Site' },
    { key: 'work_description', header: 'Description' },
    { key: 'status',           header: 'Status',                render: r => <StatusBadge status={r.status} /> },
    {
      key: 'expected_payment_date', header: 'Expected Payment Date',
      render: r => (
        <span className="text-amber-300 font-semibold font-mono text-xs">
          {formatDate(r.expected_payment_date) || '—'}
        </span>
      )
    },
    {
      key: 'pdf', header: 'PDF', sortable: false,
      render: r => (
        <div onClick={e => e.stopPropagation()}>
          <PdfCell pdfUrl={r.pdf_url} folder="jms" isAdmin={isAdmin}
            onSave={url => pdfMutation.mutateAsync({ id: r.id, pdf_url: url })}
            onDelete={() => pdfMutation.mutateAsync({ id: r.id, pdf_url: null })} />
        </div>
      )
    },
    ...(isAdmin ? [{
      key: '_actions', header: 'Actions', sortable: false,
      render: r => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-jio-blue-800/50 text-jio-blue-400 hover:text-white transition-colors" title="Edit JMS"><Pencil size={14} /></button>
          <button onClick={() => handleDelete(r.id, r)} className="p-1.5 rounded-lg hover:bg-jio-red-900/50 text-jio-red-400 hover:text-white transition-colors" title="Delete JMS"><Trash2 size={14} /></button>
        </div>
      )
    }] : []),
  ]

  const totalNet = sortedRecords.reduce((s, r) => s + (r.net_amount || 0), 0)
  const totalReleased = sortedRecords.filter(r => r.status === 'Released by A3' || r.status === 'Invoiced').length
  const totalPending = sortedRecords.filter(r => !['Released by A3', 'Invoiced'].includes(r.status)).length

  return (
    <div className="space-y-5">
      <datalist id="site-list">{uniqueSites.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="a1-list">{uniqueA1Names.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="a2-list">{uniqueA2Names.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="qsd-list">{uniqueQsdNames.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="a3-list">{uniqueA3Names.map(s => <option key={s} value={s} />)}</datalist>
      {/* Header Banner & Executive Stat Cards */}
      <ModuleHeader
        title="JMS Details Management"
        subtitle={`Joint Measurement Sheet · ${activeFy === 'overall' ? 'All Financial Years' : `FY ${activeFy}`} · ${sortedRecords.length} records`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExport} className="btn-ghost"><Download size={14} /> Export</button>
            {isAdmin && (
              <>
                <button onClick={() => setImportOpen(true)} className="btn-ghost"><Upload size={14} /> Import</button>
                <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add JMS</button>
              </>
            )}
          </div>
        }
      />

      {/* FY Tabs Control Box */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <FyTabs basePath="/jms" />
        <SlotTabs slots={JMS_SLOTS} active={activeSlot} setActive={setActiveSlot} />
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-medium px-2.5 flex items-center gap-1">
            <Filter size={12} className="text-jio-blue-400" /> Split FY By:
          </span>
          <div className="px-3 py-1.5 rounded-lg font-semibold text-slate-300 flex items-center gap-1">
            <Calendar size={12} /> JMS Date
          </div>
        </div>
      </div>

      {activeFy === 'overall' ? (
        /* ═══ OVERALL — ALL FINANCIAL YEARS ═══════════════════ */
        <div className="glass-card p-5 reveal-on-scroll">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe size={15} className="text-jio-blue-400" /> All Financial Years — Overall View
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-400 pb-2 pr-4">Financial Year</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Total JMS</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Pending</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">A3 Released</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Invoiced</th>
                  <th className="text-right text-xs font-semibold text-slate-400 pb-2 pl-3">Total Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {fyStats.map(s => (
                  <tr key={s.fy} className={`border-b border-slate-800/60`}>
                    <td className="py-2.5 pr-4">
                      <span className={`font-semibold text-white`}>
                        FY {s.fy}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-medium">{s.total}</td>
                    <td className="py-2.5 px-3 text-right"><span className="text-amber-400">{s.pending}</span></td>
                    <td className="py-2.5 px-3 text-right"><span className="text-emerald-400">{s.a3}</span></td>
                    <td className="py-2.5 px-3 text-right"><span className="text-cyan-400">{s.invoiced}</span></td>
                    <td className="py-2.5 pl-3 text-right font-semibold text-emerald-400">{formatINR(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600">
                  <td className="py-2.5 pr-4 text-xs font-bold text-slate-300">TOTAL</td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">{fyStats.reduce((s,r)=>s+r.total,0)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-amber-400">{fyStats.reduce((s,r)=>s+r.pending,0)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{fyStats.reduce((s,r)=>s+r.a3,0)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-cyan-400">{fyStats.reduce((s,r)=>s+r.invoiced,0)}</td>
                  <td className="py-2.5 pl-3 text-right font-bold text-emerald-400">{formatINR(fyStats.reduce((s,r)=>s+r.amount,0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ═══ CURRENT FY OVERALL ══════════════════════════════ */
        <div className="glass-card p-5 reveal-on-scroll">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-jio-blue-400" /> FY {activeFy} Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total JMS"     value={sortedRecords.length}      color="blue"   />
            <StatCard label="Pending A1"     value={(byStatus['Pending A1'] || 0) + (byStatus['Pending'] || 0) + (byStatus['A1'] || 0)} color="amber" />
            <StatCard label="Pending A2"     value={(byStatus['Pending A2'] || 0) + (byStatus['A2'] || 0)} color="purple" />
            <StatCard label="Pending QSD"    value={(byStatus['Pending QSD'] || 0) + (byStatus['QSD'] || 0)} color="cyan" />
            <StatCard label="Pending A3"     value={(byStatus['Pending A3'] || 0) + (byStatus['A3'] || 0)} color="blue" />
            <StatCard label="Released by A3" value={(byStatus['Released by A3'] || 0) + (byStatus['Invoiced'] || 0)} color="green" />
            <StatCard label="Total Net Amt"  value={formatINR(totalNetAmount)} color="green"  />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card p-4">
        <DataTable columns={columns} data={sortedRecords} loading={isLoading}
          enableSelection={true}
          onBulkDelete={handleBulkDelete}
          emptyMessage={activeFy === 'overall' ? 'No JMS records found' : `No JMS records for FY ${activeFy}`}
          onRowClick={(row) => setSelectedRowModal(row)} />
      </div>

      {/* On-screen Row Click Record Detail Modal */}
      <RecordDetailModal
        record={selectedRowModal}
        type="jms"
        onClose={() => setSelectedRowModal(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
        isAdmin={isAdmin}
      />

      {/* Add / Edit Modal */}
      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit JMS Record' : 'Add JMS Record'}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { name: 'jms_no',           label: 'JMS Number',          required: true },
            { name: 'period_of_work',   label: 'Period of Work' },
            { name: 'work_order_number',label: 'Work Order Number',   list: 'wo-list' },
            { name: 'arc_number',       label: 'ARC Number' },
            { name: 'net_amount',       label: 'Net Amount',           type: 'number' },
            { name: 'jms_create_date',  label: 'JMS Create Date',      type: 'date' },
            { name: 'site',             label: 'Site',                 list: 'site-list' },
            { name: 'ro_code',          label: 'RO Code' },
            { name: 'a1_name',          label: 'A1 Name',              list: 'a1-list' },
            { name: 'a1_release_date',  label: 'A1 Release Date',      type: 'date' },
            { name: 'a2_name',          label: 'A2 Name',              list: 'a2-list' },
            { name: 'a2_release_date',  label: 'A2 Release Date',      type: 'date' },
            { name: 'qsd_name',         label: 'QSD Name',             list: 'qsd-list' },
            { name: 'qsd_release_date', label: 'QSD Release Date',     type: 'date' },
            { name: 'a3_name',          label: 'A3 Name',              list: 'a3-list' },
            { name: 'inv_number',       label: 'Invoice Number' },
            { name: 'inv_date',         label: 'Invoice Date',         type: 'date' },
            { name: 'inv_posting_date', label: 'Invoice Posting Date', type: 'date' },
            { name: 'payment_date',     label: 'Payment Date',         type: 'date' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}{f.required && ' *'}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''} onChange={handleChange}
                list={f.list} required={f.required} className="input-field" step={f.type === 'number' ? '0.01' : undefined} />
            </div>
          ))}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-400 mb-1">Work Description</label>
            <textarea name="work_description" value={form.work_description || ''} onChange={handleChange} rows={2} className="input-field resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="select-field">
              {JMS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-3 flex justify-end gap-3 pt-2 border-t border-slate-700 mt-2">
            <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving…' : editRow ? 'Update JMS' : 'Create JMS'}
            </button>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)}
        onImport={importRecords} columnMap={JMS_IMPORT_COLUMNS} title="Import JMS Records" />
    </div>
  )
}
