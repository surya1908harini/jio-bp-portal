import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Wallet, DollarSign, Calculator, ChevronRight } from 'lucide-react'
import ModuleHeader from '../components/ModuleHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import FyTabs from '../components/FyTabs'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { invoiceDb, budgetDb, jmsDb } from '../lib/db'
import { formatINR, formatDate, CURRENT_FY, calculateExpectedPaymentDate } from '../lib/utils'
import { useSearchParams } from 'react-router-dom'

const TABS = [
  { key: 'net_pending', label: 'Pending Payment After A3 Released' },
  { key: 'gst_pending', label: 'Pending GST Amount' },
  { key: 'tds_pending', label: 'Pending With TDS' },
  { key: 'gst_deduction_pending', label: 'Pending With GST Deduction' },
  { key: 'gst_tds_pending', label: 'Pending With GST TDS' },
  { key: 'retention_pending', label: 'Pending With Retentions' },
  { key: 'tcs_pending', label: 'Pending With TCS / Credit Note' },
  { key: 'received',    label: 'Payment Released' }
]

function PaymentBadge({ status }) {
  const map = {
    'Pending': 'badge-pending',
    'GST Payment Only Received': 'badge-qsd',
    'Net Amount Received': 'badge-a3',
    'Full Payment Received': 'badge-invoiced',
    'Invoice Cancelled by some issues': 'badge-error'
  }
  const cls = map[status] || 'badge-pending'
  return <span className={`badge ${cls}`}>{status || 'Pending'}</span>
}

export default function PaymentPage() {
  const [searchParams] = useSearchParams()
  const activeFy = searchParams.get('fy') || CURRENT_FY
  const [activeTab, setActiveTab] = useState('net_pending')
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['invoices', activeFy],
    queryFn: () => activeFy === 'overall' ? invoiceDb.listAll() : invoiceDb.list(activeFy)
  })

  const { data: budgetList = [] } = useQuery({
    queryKey: ['budgets', 'all'],
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
    return allRecords.map(r => {
      const woKey = String(r.work_order_number || '').trim().toLowerCase()
      const jmsKey = String(r.jms_no || '').trim().toLowerCase()
      const invKey = String(r.inv_number || '').trim().toLowerCase()
      
      const timeframeDays = budgetTimeframeMap[woKey] || 30
      const postingDate = r.inv_posting_date || jmsPostingDateMap[jmsKey] || jmsPostingDateMap[invKey] || ''
      
      return {
        ...r,
        payment_timeframe_days: timeframeDays,
        inv_posting_date: postingDate,
        expected_payment_date: postingDate ? calculateExpectedPaymentDate(postingDate, timeframeDays) : ''
      }
    })
  }, [allRecords, budgetTimeframeMap, jmsPostingDateMap])

  // Active records (not cancelled)
  const activeRecords = useMemo(() => {
    return records.filter(r => {
      const statusStr = String(r.payment_status || r.status || '').toLowerCase()
      const descStr = String(r.work_description || '').toLowerCase()
      return !statusStr.includes('cancel') && !descStr.includes('[cancelled:')
    })
  }, [records])

  const gstPendingRecords = useMemo(() => activeRecords.filter(r => r.payment_status === 'Net Amount Received'), [activeRecords])
  const netPendingRecords = useMemo(() => activeRecords.filter(r => r.payment_status === 'Pending' || r.payment_status === 'GST Payment Only Received'), [activeRecords])

  const tdsPendingRecords = useMemo(() => activeRecords.filter(r => (r.tds > 0) && !r.is_tds_received), [activeRecords])
  const gstDeductionPendingRecords = useMemo(() => activeRecords.filter(r => (r.gst_amount_deduction > 0) && !r.is_gst_deduction_received), [activeRecords])
  const gstTdsPendingRecords = useMemo(() => activeRecords.filter(r => (r.gst_tds_2pct_iocl > 0) && !r.is_gst_tds_received), [activeRecords])
  const retentionPendingRecords = useMemo(() => activeRecords.filter(r => (r.sd_retention > 0) && !r.is_retention_received), [activeRecords])
  const tcsPendingRecords = useMemo(() => activeRecords.filter(r => (r.tcs_credit_note > 0) && !r.is_tcs_received), [activeRecords])

  const receivedRecords = useMemo(() => {
    return activeRecords.filter(r => 
      r.payment_status === 'Full Payment Received' && 
      (!r.tds || r.is_tds_received) && 
      (!r.gst_amount_deduction || r.is_gst_deduction_received) && 
      (!r.gst_tds_2pct_iocl || r.is_gst_tds_received) && 
      (!r.sd_retention || r.is_retention_received) && 
      (!r.tcs_credit_note || r.is_tcs_received)
    )
  }, [activeRecords])

  // Modals state
  const [gstModalOpen, setGstModalOpen] = useState(false)
  const [netModalOpen, setNetModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  
  // Forms state
  const [gstForm, setGstForm] = useState({ received_gst_amount: '', gst_amount_received_date: '' })
  const [netForm, setNetForm] = useState({ 
    payment_type: 'NET AMOUNT RECEIVED', 
    received_bill_amount: '', 
    full_amount_received_date: '', 
    received_gst_amount: '', 
    gst_amount_received_date: '',
    tds: '',
    gst_amount_deduction: '',
    gst_tds_2pct_iocl: '',
    sd_retention: '',
    tcs_credit_note: ''
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }) => invoiceDb.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries(['invoices'])
      toast.success('Payment status updated')
      setGstModalOpen(false)
      setNetModalOpen(false)
    },
    onError: (e) => toast.error('Error: ' + e.message)
  })

  // Handlers for GST Payment
  const handleOpenGstModal = (record) => {
    setSelectedRecord(record)
    setGstForm({
      received_gst_amount: record.received_gst_amount || record.grand_total - record.total || '',
      gst_amount_received_date: record.gst_amount_received_date || ''
    })
    setGstModalOpen(true)
  }

  const handleSaveGst = (e) => {
    e.preventDefault()
    if (!gstForm.gst_amount_received_date) return toast.error('GST Payment Date is required')
    
    let newStatus = 'GST Payment Only Received'
    if (selectedRecord.payment_status === 'Net Amount Received') {
      newStatus = 'Full Payment Received'
    }

    saveMutation.mutate({
      id: selectedRecord.id,
      payload: {
        ...selectedRecord,
        received_gst_amount: gstForm.received_gst_amount,
        gst_amount_received_date: gstForm.gst_amount_received_date,
        payment_status: newStatus
      }
    })
  }

  // Handlers for Net Payment
  const handleOpenNetModal = (record) => {
    setSelectedRecord(record)
    setNetForm({
      received_bill_amount: record.received_bill_amount || record.total || '',
      full_amount_received_date: record.full_amount_received_date || '',
      received_gst_amount: record.received_gst_amount || (record.grand_total - record.total) || '',
      gst_amount_received_date: record.gst_amount_received_date || '',
      tds: record.tds || '',
      gst_amount_deduction: record.gst_amount_deduction || '',
      gst_tds_2pct_iocl: record.gst_tds_2pct_iocl || '',
      sd_retention: record.sd_retention || '',
      tcs_credit_note: record.tcs_credit_note || ''
    })
    setNetModalOpen(true)
  }

  const handleSaveNet = (e) => {
    e.preventDefault()

    const net = Number(netForm.received_bill_amount || 0)
    const gst = Number(netForm.received_gst_amount || 0)
    
    let newStatus = selectedRecord.payment_status || 'Pending'

    if (net > 0 && gst > 0) newStatus = 'Full Payment Received'
    else if (net > 0 && gst === 0) newStatus = 'Net Amount Received'
    else if (net === 0 && gst > 0) newStatus = 'GST Payment Only Received'
    else if (net === 0 && gst === 0) newStatus = 'Pending'

    const updatePayload = {
      ...selectedRecord,
      received_bill_amount: net > 0 ? net : null,
      full_amount_received_date: net > 0 ? (netForm.full_amount_received_date || new Date().toISOString().split('T')[0]) : null,
      received_gst_amount: gst > 0 ? gst : null,
      gst_amount_received_date: gst > 0 ? (netForm.gst_amount_received_date || new Date().toISOString().split('T')[0]) : null,
      tds: netForm.tds ? Number(netForm.tds) : null,
      gst_amount_deduction: netForm.gst_amount_deduction ? Number(netForm.gst_amount_deduction) : null,
      gst_tds_2pct_iocl: netForm.gst_tds_2pct_iocl ? Number(netForm.gst_tds_2pct_iocl) : null,
      sd_retention: netForm.sd_retention ? Number(netForm.sd_retention) : null,
      tcs_credit_note: netForm.tcs_credit_note ? Number(netForm.tcs_credit_note) : null,
      payment_status: newStatus
    }

    saveMutation.mutate({ id: selectedRecord.id, payload: updatePayload })
  }

  // Handle Marking Deductions as Received
  const handleMarkDeductionReceived = (id, field) => {
    saveMutation.mutate({
      id,
      payload: { [field]: true }
    })
  }

  // Handle Undo Payment
  const handleUndoPayment = (record) => {
    if (!window.confirm('Are you sure you want to undo this payment? This will reset all payment and deduction details to Pending.')) return
    
    saveMutation.mutate({
      id: record.id,
      payload: {
        payment_status: 'Pending',
        received_bill_amount: null,
        full_amount_received_date: null,
        received_gst_amount: null,
        gst_amount_received_date: null,
        tds: null,
        is_tds_received: false,
        gst_amount_deduction: null,
        is_gst_deduction_received: false,
        gst_tds_2pct_iocl: null,
        is_gst_tds_received: false,
        sd_retention: null,
        is_retention_received: false,
        tcs_credit_note: null,
        is_tcs_received: false
      }
    })
  }



  // Table Columns
  const COLUMNS_GST = [
    { key: 'inv_number',             header: 'INV Number',       render: r => <span className="font-mono text-neon-orange font-semibold">{r.inv_number}</span> },
    { key: 'inv_date',               header: 'INV Date',         render: r => formatDate(r.inv_date) },
    { key: 'site',                   header: 'Site',             render: r => r.site },
    { key: 'work_description',       header: 'Work Description', render: r => r.work_description },
    { key: 'total',                  header: 'Net Amount',       render: r => formatINR(r.total) },
    { key: 'inv_posting_date',       header: 'Posting Date',     render: r => formatDate(r.inv_posting_date) },
    { key: 'total_gst',              header: 'Total GST Amount', render: r => formatINR((r.igst || 0) + (r.cgst || 0) + (r.sgst || 0)) },
    { key: 'payment_status',         header: 'Status',           render: r => <PaymentBadge status={r.payment_status} /> },
    ...(isAdmin ? [{ key: 'action',                 header: 'Action',           render: r => (
      <button onClick={() => handleOpenGstModal(r)} className="btn-primary !py-1 !px-3 !text-xs whitespace-nowrap">
        Receive GST <ChevronRight size={14} className="inline ml-1" />
      </button>
    )}] : [])
  ]

  const COLUMNS_NET = [
    { key: 'inv_number',             header: 'INV Number',            render: r => <span className="font-mono text-neon-orange font-semibold">{r.inv_number}</span> },
    { key: 'inv_date',               header: 'INV Date',              render: r => formatDate(r.inv_date) },
    { key: 'site',                   header: 'Site',                  render: r => r.site },
    { key: 'work_description',       header: 'Work Description',      render: r => r.work_description },
    { key: 'total',                  header: 'Net Amount',            render: r => formatINR(r.total) },
    { key: 'inv_posting_date',       header: 'Posting Date',          render: r => formatDate(r.inv_posting_date) },
    { key: 'expected_payment_date',  header: 'Expected Payment Date', render: r => formatDate(r.expected_payment_date) || '-' },
    { key: 'payment_status',         header: 'Status',                render: r => <PaymentBadge status={r.payment_status} /> },
    ...(isAdmin ? [{ key: 'action',                 header: 'Action',                render: r => (
      <button onClick={() => handleOpenNetModal(r)} className="btn-primary !py-1 !px-3 !text-xs whitespace-nowrap">
        Receive Payment <ChevronRight size={14} className="inline ml-1" />
      </button>
    )}] : [])
  ]

  const generateDeductionColumns = (headerText, fieldKey, receiveKey) => [
    { key: 'inv_number',             header: 'INV Number',            render: r => <span className="font-mono text-neon-orange font-semibold">{r.inv_number}</span> },
    { key: 'inv_date',               header: 'INV Date',              render: r => formatDate(r.inv_date) },
    { key: 'site',                   header: 'Site',                  render: r => r.site },
    { key: 'total',                  header: 'Net Amount',            render: r => formatINR(r.total) },
    { key: fieldKey,                 header: headerText,              render: r => <span className="font-bold text-amber-400">{formatINR(r[fieldKey])}</span> },
    { key: 'inv_posting_date',       header: 'Posting Date',          render: r => formatDate(r.inv_posting_date) },
    { key: 'payment_status',         header: 'Status',                render: r => <PaymentBadge status={r.payment_status} /> },
    ...(isAdmin ? [{ key: 'action',                 header: 'Action',                render: r => (
      <div className="flex gap-2">
        <button onClick={() => handleMarkDeductionReceived(r.id, receiveKey)} className="btn-emerald !py-1 !px-3 !text-xs whitespace-nowrap font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40">
          Mark Received <CheckCircle2 size={14} className="inline ml-1" />
        </button>
        <button onClick={() => handleOpenNetModal(r)} className="btn-ghost !py-1 !px-3 !text-xs whitespace-nowrap">
          Edit
        </button>
      </div>
    )}] : [])
  ]

  const COLUMNS_TDS = generateDeductionColumns('TDS Amount', 'tds', 'is_tds_received')
  const COLUMNS_GST_DEDUCTION = generateDeductionColumns('GST Deduction', 'gst_amount_deduction', 'is_gst_deduction_received')
  const COLUMNS_GST_TDS = generateDeductionColumns('GST TDS 2% IOCL', 'gst_tds_2pct_iocl', 'is_gst_tds_received')
  const COLUMNS_RETENTION = generateDeductionColumns('SD / Retention', 'sd_retention', 'is_retention_received')
  const COLUMNS_TCS = generateDeductionColumns('TCS / Credit Note', 'tcs_credit_note', 'is_tcs_received')


  const COLUMNS_RECEIVED = [
    { key: 'inv_number',             header: 'INV Number',         render: r => <span className="font-mono text-emerald-400 font-semibold">{r.inv_number}</span> },
    { key: 'inv_date',               header: 'INV Date',           render: r => formatDate(r.inv_date) },
    { key: 'inv_posting_date',       header: 'Posting Date',       render: r => formatDate(r.inv_posting_date) },
    { key: 'full_amount_received_date', header: 'Payment Date',    render: r => formatDate(r.full_amount_received_date) || '-' },
    { key: 'total',                  header: 'Net Amount',         render: r => formatINR(r.total) },
    { key: 'received_gst_amount',    header: 'GST Received',       render: r => formatINR(r.received_gst_amount) },
    { key: 'received_bill_amount',   header: 'Net Received',       render: r => formatINR(r.received_bill_amount) },
    { key: 'grand_total',            header: 'Grand Total',        render: r => formatINR(r.grand_total) },
    { key: 'payment_status',         header: 'Status',             render: r => <PaymentBadge status={r.payment_status} /> },
    ...(isAdmin ? [{ key: 'action',                 header: 'Action',             render: r => (
      <div className="flex gap-2">
        <button onClick={() => handleOpenNetModal(r)} className="btn-primary !py-1 !px-3 !text-xs whitespace-nowrap">
          Edit
        </button>
        <button onClick={() => handleUndoPayment(r)} className="btn-error !py-1 !px-3 !text-xs whitespace-nowrap">
          Undo
        </button>
      </div>
    )}] : [])
  ]

  // Select active data & columns
  let currentData = []
  let currentColumns = []
  
  switch(activeTab) {
    case 'gst_pending': currentData = gstPendingRecords; currentColumns = COLUMNS_GST; break;
    case 'net_pending': currentData = netPendingRecords; currentColumns = COLUMNS_NET; break;
    case 'tds_pending': currentData = tdsPendingRecords; currentColumns = COLUMNS_TDS; break;
    case 'gst_deduction_pending': currentData = gstDeductionPendingRecords; currentColumns = COLUMNS_GST_DEDUCTION; break;
    case 'gst_tds_pending': currentData = gstTdsPendingRecords; currentColumns = COLUMNS_GST_TDS; break;
    case 'retention_pending': currentData = retentionPendingRecords; currentColumns = COLUMNS_RETENTION; break;
    case 'tcs_pending': currentData = tcsPendingRecords; currentColumns = COLUMNS_TCS; break;
    case 'received': currentData = receivedRecords; currentColumns = COLUMNS_RECEIVED; break;
  }

  return (
    <div className="animate-fade-in pb-20">


      {document.getElementById('topbar-center') && createPortal(
        <div className="flex gap-1.5 items-center justify-center flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-1.5 py-1 rounded-xl text-[10px] font-semibold transition-all whitespace-normal text-center w-[100px] leading-[1.15] h-8 flex items-center justify-center ${
                activeTab === tab.key 
                  ? 'bg-gray-900 text-white shadow-sm border border-gray-900' 
                  : 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-white dark:text-white hover:text-gray-900 dark:text-white border hover:bg-gray-50 dark:bg-[#151521] shadow-sm'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>,
        document.getElementById('topbar-center')
      )}

      {document.getElementById('topbar-actions') && createPortal(
        <FyTabs basePath="/payments" />,
        document.getElementById('topbar-actions')
      )}

      <div className="card p-0 overflow-hidden mt-0">
        <DataTable 
          columns={currentColumns} 
          data={currentData} 
          isLoading={isLoading} 
          wrapText={true}
        />
      </div>

      {/* Modal for GST Payment */}
      <Modal open={gstModalOpen} onClose={() => setGstModalOpen(false)} title="Update GST Payment">
        {selectedRecord && (
          <form onSubmit={handleSaveGst} className="space-y-4">
            <div className="bg-white dark:bg-[#1e1e2d] p-3 rounded border border-white/5 mb-4">
              <p className="text-sm text-gray-500 dark:text-white dark:text-white">Number: <span className="text-neon-orange font-bold ml-1">{selectedRecord.inv_number}</span></p>
              <p className="text-sm text-gray-500 dark:text-white dark:text-white">GST: <span className="text-gray-900 dark:text-white font-bold ml-1">{formatINR((selectedRecord.igst || 0) + (selectedRecord.cgst || 0) + (selectedRecord.sgst || 0))}</span></p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Received GST Amount</label>
                <input 
                  type="number" step="0.01" 
                  value={gstForm.received_gst_amount} 
                  onChange={e => setGstForm({ ...gstForm, received_gst_amount: e.target.value })} 
                  className="input-field" 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">GST Payment Date</label>
                <input 
                  type="date" 
                  value={gstForm.gst_amount_received_date} 
                  onChange={e => setGstForm({ ...gstForm, gst_amount_received_date: e.target.value })} 
                  className="input-field" 
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setGstModalOpen(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Saving...' : 'Confirm GST Received'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal for Net/Full Payment */}
      <Modal open={netModalOpen} onClose={() => setNetModalOpen(false)} title="Update Payment Received">
        {selectedRecord && (
          <form onSubmit={handleSaveNet} className="space-y-4">
            <div className="bg-white dark:bg-[#1e1e2d] p-3 rounded border border-gray-200 dark:border-gray-800 mb-4">
                <p className="text-sm text-gray-500 dark:text-white dark:text-white">Invoice Number: <span className="text-neon-orange font-bold ml-1">{selectedRecord.inv_number}</span></p>
                <p className="text-sm text-gray-500 dark:text-white dark:text-white">Total Amount: <span className="text-gray-900 dark:text-white font-bold ml-1">{formatINR(selectedRecord.total)}</span></p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Received Payment (Net Amount)</label>
                  <input type="number" step="0.01" value={netForm.received_bill_amount} onChange={e => setNetForm({ ...netForm, received_bill_amount: e.target.value })} className="input-field" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Payment Date</label>
                  <input type="date" value={netForm.full_amount_received_date} onChange={e => setNetForm({ ...netForm, full_amount_received_date: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Received GST Amount</label>
                  <input type="number" step="0.01" value={netForm.received_gst_amount} onChange={e => setNetForm({ ...netForm, received_gst_amount: e.target.value })} className="input-field" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">GST Payment Date</label>
                  <input type="date" value={netForm.gst_amount_received_date} onChange={e => setNetForm({ ...netForm, gst_amount_received_date: e.target.value })} className="input-field" />
                </div>
              </div>

              {/* Deduction Fields (Available for all payment types) */}
              <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-white dark:text-white uppercase tracking-wider mb-3">Deductions / Adjustments</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">TDS</label>
                    <input type="number" step="0.01" value={netForm.tds} onChange={e => setNetForm({ ...netForm, tds: e.target.value })} className="input-field" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">GST Amt Deduction</label>
                    <input type="number" step="0.01" value={netForm.gst_amount_deduction} onChange={e => setNetForm({ ...netForm, gst_amount_deduction: e.target.value })} className="input-field" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">GST TDS 2% IOCL</label>
                    <input type="number" step="0.01" value={netForm.gst_tds_2pct_iocl} onChange={e => setNetForm({ ...netForm, gst_tds_2pct_iocl: e.target.value })} className="input-field" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">SD / Retention</label>
                    <input type="number" step="0.01" value={netForm.sd_retention} onChange={e => setNetForm({ ...netForm, sd_retention: e.target.value })} className="input-field" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-white dark:text-white mb-1">TCS / Credit Note</label>
                    <input type="number" step="0.01" value={netForm.tcs_credit_note} onChange={e => setNetForm({ ...netForm, tcs_credit_note: e.target.value })} className="input-field" placeholder="0.00" />
                  </div>
                </div>
              </div>

            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setNetModalOpen(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  )
}
