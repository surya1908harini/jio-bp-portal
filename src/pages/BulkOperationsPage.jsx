import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Calendar, Filter, Zap, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ModuleHeader from '../components/ModuleHeader'
import DataTable from '../components/DataTable'
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
    { id: 'TO_A2', label: 'Move to A2', prevStage: 'A1', requiresDate: true, dateLabel: 'A1 Release Date' },
    { id: 'TO_QSD', label: 'Move to QSD', prevStage: 'A2', requiresDate: true, dateLabel: 'A2 Release Date' },
    { id: 'TO_A3', label: 'Move to A3', prevStage: 'QSD', requiresDate: true, dateLabel: 'QSD Release Date' },
    { id: 'TO_INVOICED', label: 'Move to Invoiced', prevStage: 'A3', requiresDate: true, dateLabel: 'A3 Release Date' }
  ],
  INVOICE: [
    { id: 'GST_PAID', label: 'Mark as GST Paid', requiresDate: true, dateLabel: 'GST Received Date' },
    { id: 'NET_PAID', label: 'Mark as Net Amount Received', requiresDate: true, dateLabel: 'Net Amount Received Date' },
    { id: 'FULL_PAID', label: 'Mark as Full Paid', requiresDate: true, dateLabel: 'Full Payment Received Date' }
  ],
  BUDGET: [
    { id: 'CLOSE', label: 'Mark as Closed', requiresDate: false },
    { id: 'ACTIVE', label: 'Mark as Active', requiresDate: false },
    { id: 'UPDATE_TIMEFRAME', label: 'Update Timeframe (Days)', requiresDate: false, requiresNumber: true, numberLabel: 'Payment Timeframe (Days)' }
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

  // Fetch Data based on Module
  const { data: jmsRecords = [], isLoading: loadingJms } = useQuery({
    queryKey: ['jms', 'all'],
    queryFn: () => jmsDb.listAll(),
    enabled: activeModule === 'JMS'
  })

  const { data: invoiceRecords = [], isLoading: loadingInv } = useQuery({
    queryKey: ['invoices', 'overall'],
    queryFn: () => invoiceDb.listAll(),
    enabled: activeModule === 'INVOICE'
  })

  const { data: budgetRecords = [], isLoading: loadingBud } = useQuery({
    queryKey: ['budgets', 'all'],
    queryFn: () => budgetDb.listAll(),
    enabled: activeModule === 'BUDGET'
  })

  // Action configuration
  const currentActions = ACTIONS[activeModule] || []
  const selectedActionConfig = currentActions.find(a => a.id === activeAction) || currentActions[0]

  // Reset selection when module or action changes
  useEffect(() => {
    setSelectedIds([])
  }, [activeModule, activeAction])

  // Filter records based on selected action
  const filteredRecords = useMemo(() => {
    if (activeModule === 'JMS') {
      return jmsRecords.filter(r => {
        const s = getJmsDbStatus(r.status)
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
  }, [activeModule, activeAction, jmsRecords, invoiceRecords, budgetRecords])

  // Table Columns
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
        { key: 'payment_timeframe_days', header: 'Timeframe', render: r => `${r.payment_timeframe_days || 30} Days` },
        { key: 'status', header: 'Status', render: r => <span className="badge badge-a3">{r.status || 'Active'}</span> }
      ]
    }
    return []
  }

  // Selection handlers are removed because DataTable handles them automatically if setSelectedIds is provided.


  // Execute Bulk Operation
  const handleApplyBulk = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one record!')
      return
    }
    
    if (selectedActionConfig.requiresDate && !dateValue) {
      toast.error(`Please select a ${selectedActionConfig.dateLabel}!`)
      return
    }
    if (selectedActionConfig.requiresNumber && !numValue) {
      toast.error(`Please enter ${selectedActionConfig.numberLabel}!`)
      return
    }

    setIsProcessing(true)
    let successCount = 0

    try {
      const updates = []
      
      for (const id of selectedIds) {
        let payload = {}
        const record = filteredRecords.find(r => r.id === id)
        if (!record) continue

        if (activeModule === 'JMS') {
          if (activeAction === 'TO_A2') { payload = { ...record, status: 'A2', a1_release_date: dateValue } }
          else if (activeAction === 'TO_QSD') { payload = { ...record, status: 'QSD', a2_release_date: dateValue } }
          else if (activeAction === 'TO_A3') { payload = { ...record, status: 'A3', qsd_release_date: dateValue } }
          else if (activeAction === 'TO_INVOICED') { payload = { ...record, status: 'Invoiced', a3_name: 'Released', a3_release_date: dateValue } }
          updates.push(jmsDb.update(id, payload))
        } 
        else if (activeModule === 'INVOICE') {
          if (activeAction === 'GST_PAID') { payload = { ...record, payment_status: 'GST Payment Only Received', gst_amount_received_date: dateValue } }
          else if (activeAction === 'NET_PAID') { payload = { ...record, payment_status: 'Net Amount Received', full_amount_received_date: dateValue } }
          else if (activeAction === 'FULL_PAID') { payload = { ...record, payment_status: 'Full Payment Received', full_amount_received_date: dateValue } }
          updates.push(invoiceDb.update(id, payload))
        }
        else if (activeModule === 'BUDGET') {
          if (activeAction === 'CLOSE') { payload = { ...record, status: 'Closed' } }
          else if (activeAction === 'ACTIVE') { payload = { ...record, status: 'Active' } }
          else if (activeAction === 'UPDATE_TIMEFRAME') { payload = { ...record, payment_timeframe_days: Number(numValue) } }
          updates.push(budgetDb.update(id, payload))
        }
      }

      await Promise.all(updates)
      successCount = updates.length

      // Invalidate queries to refresh data across app
      if (activeModule === 'JMS') qc.invalidateQueries(['jms'])
      if (activeModule === 'INVOICE') qc.invalidateQueries(['invoices'])
      if (activeModule === 'BUDGET') qc.invalidateQueries(['budgets'])

      toast.success(`Successfully updated ${successCount} records! ✓`)
      setSelectedIds([])
    } catch (error) {
      console.error(error)
      toast.error('Bulk update failed. Some records might not have updated.')
    } finally {
      setIsProcessing(false)
    }
  }

  const isLoading = loadingJms || loadingInv || loadingBud

  return (
    <div className="space-y-6 animate-page-enter">
      <ModuleHeader
        title="Bulk Operations"
        subtitle="Perform mass updates to Stages, Statuses, and Dates across JMS, Invoices, and Budgets in one go."
      />

      {/* Control Panel */}
      <div className=" p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          
          {/* Module Selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-white dark:text-white mb-2 block uppercase tracking-wider flex items-center gap-1"><Filter size={12}/> Target Module</label>
            <select 
              value={activeModule}
              onChange={(e) => { setActiveModule(e.target.value); setActiveAction(ACTIONS[e.target.value][0].id); }}
              className="select-field w-full !text-sm !py-2.5"
            >
              {MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {/* Action Selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-white dark:text-white mb-2 block uppercase tracking-wider flex items-center gap-1"><Zap size={12}/> Bulk Action</label>
            <select 
              value={activeAction}
              onChange={(e) => setActiveAction(e.target.value)}
              className="select-field w-full !text-sm !py-2.5"
            >
              {currentActions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          {/* Dynamic Inputs */}
          {selectedActionConfig.requiresDate && (
            <div>
              <label className="text-xs font-semibold text-emerald-400 mb-2 block uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> {selectedActionConfig.dateLabel}</label>
              <input 
                type="date" 
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
                className="input-field w-full !text-sm !py-2.5 !text-emerald-300 !border-emerald-900/50 focus:!border-emerald-500/50"
              />
            </div>
          )}

          {selectedActionConfig.requiresNumber && (
            <div>
              <label className="text-xs font-semibold text-blue-400 mb-2 block uppercase tracking-wider flex items-center gap-1"><CheckSquare size={12}/> {selectedActionConfig.numberLabel}</label>
              <input 
                type="number" 
                value={numValue}
                onChange={e => setNumValue(e.target.value)}
                className="input-field w-full !text-sm !py-2.5 !text-blue-300 !border-blue-900/50 focus:!border-blue-500/50"
              />
            </div>
          )}

          {/* Apply Button */}
          <div className="md:ml-auto">
            <button 
              onClick={handleApplyBulk}
              disabled={isProcessing || selectedIds.length === 0}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg
                ${selectedIds.length === 0 
                  ? 'bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800 text-gray-500 dark:text-white dark:text-white cursor-not-allowed border border-gray-200 dark:border-gray-800' 
                  : 'bg-gradient-to-r from-neon-orange to-amber-600 text-white hover:brightness-110 hover:shadow-neon-orange/20 border border-orange-500/50'
                }`}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {isProcessing ? 'Processing...' : `Apply to ${selectedIds.length} Records`}
            </button>
          </div>

        </div>
      </div>

      {/* Grid */}
      <div className="bg-white dark:bg-[#1e1e2d] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800  flex items-center justify-between">
          <h3 className="font-semibold tracking-wide text-gray-700 dark:text-white flex items-center gap-2">
            <CheckSquare size={16} className="text-neon-orange"/>
            Eligible Records ({filteredRecords.length})
          </h3>
          {selectedIds.length > 0 && (
            <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
              {selectedIds.length} Selected
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500 dark:text-white dark:text-white">
            <Loader2 size={32} className="animate-spin mb-4 text-neon-orange" />
            <p className="text-sm font-medium tracking-wide">Fetching eligible records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-white dark:text-white font-medium">
            <div className="inline-block p-4 rounded-full bg-white dark:bg-[#1e1e2d] border-gray-200 dark:border-gray-800/50 mb-3 border border-gray-200 dark:border-gray-800/50">
              <CheckSquare size={24} className="text-gray-500 dark:text-white dark:text-white opacity-50" />
            </div>
            <p>No records found in this stage.</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <DataTable 
              columns={getColumns()} 
              data={filteredRecords} 
              onRowClick={() => {}}
              enableSelection={true}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
            />
          </div>
        )}
      </div>
    </div>
  )
}
