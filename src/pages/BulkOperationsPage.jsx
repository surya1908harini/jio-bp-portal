import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Calendar, Filter, Zap, ArrowRight, Loader2, Table2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ModuleHeader from '../components/ModuleHeader'
import DataTable from '../components/DataTable'
import SpreadsheetGrid from '../components/SpreadsheetGrid'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

const MODULES = [
  { id: 'JMS', label: 'JMS Records' },
  { id: 'INVOICE', label: 'Invoices' },
  { id: 'BUDGET', label: 'Budgets' }
]

const ACTIONS = {
  JMS: [
    { id: 'CREATE_MULTI', label: 'Create Multiple JMS', isCreate: true },
    { id: 'UPDATE_POSTING_DATE', label: 'Update Posting Date', requiresDate: true, dateLabel: 'Posting Date' },
    { id: 'TO_A2', label: 'Move to A2', prevStage: 'A1', requiresDate: true, dateLabel: 'A1 Release Date' },
    { id: 'TO_QSD', label: 'Move to QSD', prevStage: 'A2', requiresDate: true, dateLabel: 'A2 Release Date' },
    { id: 'TO_A3', label: 'Move to A3', prevStage: 'QSD', requiresDate: true, dateLabel: 'QSD Release Date' },
    { id: 'TO_INVOICED', label: 'Move to Invoiced', prevStage: 'A3', requiresDate: true, dateLabel: 'A3 Release Date' }
  ],
  INVOICE: [
    { id: 'CREATE_MULTI', label: 'Create Multiple Invoices', isCreate: true }
  ],
  BUDGET: [
    { id: 'CREATE_MULTI', label: 'Create Multiple Budgets', isCreate: true },
    { id: 'CLOSE', label: 'Mark as Closed', requiresDate: false },
    { id: 'ACTIVE', label: 'Mark as Active', requiresDate: false },
    { id: 'UPDATE_TIMEFRAME', label: 'Update Timeframe (Days)', requiresDate: false, requiresNumber: true, numberLabel: 'Payment Timeframe (Days)' }
  ]
}

const SPREADSHEET_COLS = {
  JMS: [
    { key: 'jms_no', label: 'JMS No' }, { key: 'period_of_work', label: 'Period' }, { key: 'work_order_number', label: 'WO Number' },
    { key: 'arc_number', label: 'ARC Number' }, { key: 'net_amount', label: 'Net Amount', type: 'number' },
    { key: 'jms_create_date', label: 'Create Date', type: 'date' }, { key: 'site', label: 'Site' }, { key: 'ro_code', label: 'RO Code' },
    { key: 'work_description', label: 'Description' }, { key: 'status', label: 'Status' }, { key: 'inv_number', label: 'Invoice No' }
  ],
  INVOICE: [
    { key: 'inv_date', label: 'Inv Date', type: 'date' }, { key: 'jms_no', label: 'JMS No' }, { key: 'work_order_number', label: 'WO Number' },
    { key: 'gst_no', label: 'GST No' }, { key: 'inv_number', label: 'Invoice No' }, { key: 'sac_code', label: 'SAC' },
    { key: 'work_description', label: 'Description' }, { key: 'site', label: 'Site' }, { key: 'ro_code', label: 'RO Code' },
    { key: 'total', label: 'Total', type: 'number' }, { key: 'igst', label: 'IGST', type: 'number' },
    { key: 'cgst', label: 'CGST', type: 'number' }, { key: 'sgst', label: 'SGST', type: 'number' }
  ],
  BUDGET: [
    { key: 'work_order_number', label: 'WO Number' }, { key: 'work_order_date', label: 'WO Date', type: 'date' },
    { key: 'arc_number', label: 'ARC Number' }, { key: 'state', label: 'State' }, { key: 'site_name', label: 'Site Name' },
    { key: 'sol_id', label: 'SOL ID' }, { key: 'project', label: 'Project' }, { key: 'sub_project', label: 'Sub Project' },
    { key: 'fo_total_budget', label: 'Total Budget', type: 'number' }
  ]
}

function getJmsDbStatus(status) {
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

export default function BulkOperationsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  
  const [activeModule, setActiveModule] = useState('JMS')
  const [activeAction, setActiveAction] = useState(ACTIONS.JMS[0].id)
  
  const [dateValue, setDateValue] = useState(new Date().toISOString().split('T')[0])
  const [numValue, setNumValue] = useState('30')
  const [selectedIds, setSelectedIds] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: jmsRecords = [], isLoading: loadingJms } = useQuery({ queryKey: ['jms', 'all'], queryFn: () => jmsDb.listAll(), enabled: activeModule === 'JMS' })
  const { data: invoiceRecords = [], isLoading: loadingInv } = useQuery({ queryKey: ['invoices', 'overall'], queryFn: () => invoiceDb.listAll(), enabled: activeModule === 'INVOICE' })
  const { data: budgetRecords = [], isLoading: loadingBud } = useQuery({ queryKey: ['budgets', 'all'], queryFn: () => budgetDb.listAll(), enabled: activeModule === 'BUDGET' })

  const currentActions = ACTIONS[activeModule] || []
  const selectedActionConfig = currentActions.find(a => a.id === activeAction) || currentActions[0]

  useEffect(() => {
    setSelectedIds([])
  }, [activeModule, activeAction])

  const filteredRecords = useMemo(() => {
    if (selectedActionConfig.isCreate) return []
    if (activeModule === 'JMS') {
      return jmsRecords.filter(r => {
        const s = getJmsDbStatus(r.status)
        if (activeAction === 'UPDATE_POSTING_DATE') return true
        if (activeAction === 'TO_A2') return s === 'A1'
        if (activeAction === 'TO_QSD') return s === 'A2'
        if (activeAction === 'TO_A3') return s === 'QSD'
        if (activeAction === 'TO_INVOICED') return s === 'A3'
        return false
      }).map((r, i) => ({ ...r, s_no: i + 1 }))
    }
    if (activeModule === 'INVOICE') {
      return invoiceRecords.filter(r => {
        const s = r.payment_status || 'Pending'
        if (activeAction === 'GST_PAID') return s === 'Pending'
        if (activeAction === 'NET_PAID') return s === 'Pending' || s === 'GST Payment Only Received'
        if (activeAction === 'FULL_PAID') return s === 'Net Amount Received'
        return false
      }).map((r, i) => ({ ...r, s_no: i + 1 }))
    }
    if (activeModule === 'BUDGET') {
      return budgetRecords.filter(r => {
        const s = r.status || 'Active'
        if (activeAction === 'CLOSE') return s === 'Active'
        if (activeAction === 'ACTIVE') return s === 'Closed'
        if (activeAction === 'UPDATE_TIMEFRAME') return s === 'Active'
        return false
      }).map((r, i) => ({ ...r, s_no: i + 1 }))
    }
    return []
  }, [activeModule, activeAction, jmsRecords, invoiceRecords, budgetRecords, selectedActionConfig])

  const getColumns = () => {
    if (activeModule === 'JMS') {
      return [
        { key: 'jms_no', header: 'JMS No', render: r => r.jms_no },
        { key: 'work_order_number', header: 'WO Number', render: r => r.work_order_number },
        { key: 'net_amount', header: 'Net Amount', render: r => formatINR(r.net_amount) },
        { key: 'status', header: 'Current Stage', render: r => <span className="badge badge-pending">{r.status || 'Pending A1'}</span> }
      ]
    }
    if (activeModule === 'INVOICE') {
      return [
        { key: 'inv_number', header: 'Invoice No', render: r => r.inv_number },
        { key: 'work_order_number', header: 'WO Number', render: r => r.work_order_number },
        { key: 'invoice_value', header: 'Invoice Value', render: r => formatINR(r.invoice_value) },
        { key: 'payment_status', header: 'Payment Status', render: r => <span className="badge badge-qsd">{r.payment_status || 'Pending'}</span> }
      ]
    }
    if (activeModule === 'BUDGET') {
      return [
        { key: 'work_order_number', header: 'WO Number', render: r => r.work_order_number },
        { key: 'arc_number', header: 'ARC Number', render: r => r.arc_number },
        { key: 'fo_total_budget', header: 'Total Budget', render: r => formatINR(r.fo_total_budget) },
        { key: 'status', header: 'Status', render: r => <span className="badge badge-a3">{r.status || 'Active'}</span> }
      ]
    }
    return []
  }

  const handleApplyBulk = async () => {
    if (selectedIds.length === 0) return toast.error('Please select at least one record!')
    if (selectedActionConfig.requiresDate && !dateValue) return toast.error(`Please select a ${selectedActionConfig.dateLabel}!`)
    if (selectedActionConfig.requiresNumber && !numValue) return toast.error(`Please enter ${selectedActionConfig.numberLabel}!`)

    // JMS Strict Date Validations
    if (activeModule === 'JMS') {
      for (const id of selectedIds) {
        const record = filteredRecords.find(r => r.id === id)
        if (!record) continue
        if (activeAction === 'TO_A2' && !record.a1_release_date && !dateValue) {
          return toast.error(`Record ${record.jms_no} requires A1 Release Date before moving to A2.`)
        }
        if (activeAction === 'TO_A3' && (!record.a1_release_date || !record.a2_release_date)) {
          return toast.error(`Record ${record.jms_no} is missing prior dates. Cannot move to A3.`)
        }
        if (activeAction === 'TO_INVOICED' && (!record.a1_release_date || !record.a2_release_date || !record.qsd_release_date)) {
          return toast.error(`Record ${record.jms_no} is missing prior dates. Cannot move to Invoiced.`)
        }
      }
    }

    setIsProcessing(true)
    try {
      const updates = []
      for (const id of selectedIds) {
        let payload = {}
        const record = filteredRecords.find(r => r.id === id)
        if (!record) continue

        if (activeModule === 'JMS') {
          if (activeAction === 'UPDATE_POSTING_DATE') { payload = { ...record, inv_posting_date: dateValue } }
          else if (activeAction === 'TO_A2') { payload = { ...record, status: 'A2', a1_release_date: dateValue } }
          else if (activeAction === 'TO_QSD') { payload = { ...record, status: 'QSD', a2_release_date: dateValue } }
          else if (activeAction === 'TO_A3') { payload = { ...record, status: 'A3', qsd_release_date: dateValue } }
          else if (activeAction === 'TO_INVOICED') { payload = { ...record, status: 'Invoiced', a3_name: 'Released', a3_release_date: dateValue } }
          updates.push(jmsDb.update(id, payload))
        } 
        else if (activeModule === 'INVOICE') {
          // No bulk actions other than CREATE_MULTI for INVOICE right now
        }
        else if (activeModule === 'BUDGET') {
          if (activeAction === 'CLOSE') { payload = { ...record, status: 'Closed' } }
          else if (activeAction === 'ACTIVE') { payload = { ...record, status: 'Active' } }
          else if (activeAction === 'UPDATE_TIMEFRAME') { payload = { ...record, payment_timeframe_days: Number(numValue) } }
          updates.push(budgetDb.update(id, payload))
        }
      }

      await Promise.all(updates)
      if (activeModule === 'JMS') qc.invalidateQueries(['jms'])
      if (activeModule === 'INVOICE') qc.invalidateQueries(['invoices'])
      if (activeModule === 'BUDGET') qc.invalidateQueries(['budgets'])
      toast.success(`Successfully updated ${updates.length} records! ✓`)
      setSelectedIds([])
    } catch (error) {
      toast.error('Bulk update failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSpreadsheetSave = async (rows) => {
    setIsProcessing(true)
    try {
      if (activeModule === 'JMS') {
        await jmsDb.bulkInsert(rows, user?.id)
        qc.invalidateQueries(['jms'])
      } else if (activeModule === 'INVOICE') {
        await invoiceDb.bulkInsert(rows, user?.id)
        qc.invalidateQueries(['invoices'])
      } else if (activeModule === 'BUDGET') {
        await budgetDb.bulkInsert(rows, user?.id)
        qc.invalidateQueries(['budgets'])
      }
      toast.success(`Successfully created ${rows.length} records!`)
      setSelectedIds([]) // Force a small state change to reset if needed
    } catch (err) {
      toast.error(err.message || 'Failed to save rows')
    } finally {
      setIsProcessing(false)
    }
  }

  const isLoading = loadingJms || loadingInv || loadingBud

  return (
    <div className="space-y-6 animate-page-enter">
      <ModuleHeader title="OPERATION WARD" subtitle="" />

      {/* Centered Operation Type Selector in Header area */}
      <div className="flex justify-center mb-6">
        <div className="bg-white dark:bg-[#1e1e2d] shadow-md border border-gray-200 dark:border-gray-800 rounded-xl p-4 inline-flex flex-wrap justify-center items-center gap-4 max-w-4xl">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-white uppercase tracking-wider flex items-center gap-1">
              <Filter size={12}/> Target Module
            </label>
            <select
              value={activeModule}
              onChange={(e) => { setActiveModule(e.target.value); setActiveAction(ACTIONS[e.target.value][0].id); }}
              className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-jio-blue-500 shadow-sm"
            >
              {MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-700 mx-2 self-center hidden sm:block"></div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-white uppercase tracking-wider flex items-center gap-1">
              <Zap size={12}/> Bulk Action
            </label>
            <select
              value={activeAction}
              onChange={(e) => setActiveAction(e.target.value)}
              className="bg-white dark:bg-[#151521] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            >
              {currentActions.map(act => <option key={act.id} value={act.id}>{act.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedActionConfig.isCreate ? (
        <SpreadsheetGrid 
          columns={SPREADSHEET_COLS[activeModule]} 
          onSave={handleSpreadsheetSave} 
          title={`Bulk Create ${MODULES.find(m => m.id === activeModule).label}`} 
        />
      ) : (
        <>
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap items-end gap-6 justify-center">
              {selectedActionConfig.requiresDate && (
                <div>
                  <label className="text-xs font-semibold text-emerald-400 mb-2 block uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> {selectedActionConfig.dateLabel}</label>
                  <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)} className="input-field w-64 !text-sm !py-2.5 !text-emerald-300 !border-emerald-900/50" />
                </div>
              )}
              {selectedActionConfig.requiresNumber && (
                <div>
                  <label className="text-xs font-semibold text-blue-400 mb-2 block uppercase tracking-wider flex items-center gap-1"><CheckSquare size={12}/> {selectedActionConfig.numberLabel}</label>
                  <input type="number" value={numValue} onChange={e => setNumValue(e.target.value)} className="input-field w-64 !text-sm !py-2.5 !text-blue-300 !border-blue-900/50" />
                </div>
              )}
              <div className="">
                <button onClick={handleApplyBulk} disabled={isProcessing || selectedIds.length === 0}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${selectedIds.length === 0 ? 'bg-white dark:bg-[#1e1e2d] text-gray-500 dark:text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-800' : 'bg-gradient-to-r from-neon-orange to-amber-600 text-white hover:brightness-110'}`}>
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                  {isProcessing ? 'Processing...' : `Apply to ${selectedIds.length} Records`}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold tracking-wide text-gray-700 dark:text-white flex items-center gap-2"><CheckSquare size={16} className="text-neon-orange"/> Eligible Records ({filteredRecords.length})</h3>
              {selectedIds.length > 0 && <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">{selectedIds.length} Selected</span>}
            </div>
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400"><Loader2 size={32} className="animate-spin mb-4 text-neon-orange" /><p>Fetching...</p></div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400 font-medium"><p>No records found for this action.</p></div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                <DataTable columns={getColumns()} data={filteredRecords} onRowClick={() => {}} enableSelection={true} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
