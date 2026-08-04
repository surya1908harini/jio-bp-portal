import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Plus, Download, Upload, Pencil, Trash2, PieChart, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { budgetDb } from '../lib/db'
import { formatINR, exportToExcel, getFinancialYear } from '../lib/utils'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import PdfCell from '../components/PdfCell'
import FyTabs from '../components/FyTabs'
import SlotTabs from '../components/SlotTabs'
import SummaryModal from '../components/SummaryModal'

const EMPTY_FORM = {
  operation: '', description: '', arc_number: '', work_order_number: '',
  validity_of_contract: '', fo_total_budget: '',
}

const IMPORT_MAP = {
  'SNo': null,
  'OPERATION': 'operation', 'Operation': 'operation', 'operation': 'operation',
  'Description': 'description', 'description': 'description',
  'ARC Number': 'arc_number', 'ARC No': 'arc_number', 'arc_number': 'arc_number',
  'Work order number': 'work_order_number', 'Work Order Number': 'work_order_number', 'Work Order No': 'work_order_number', 'work_order_number': 'work_order_number',
  'Validity of Contract': 'validity_of_contract', 'Validity': 'validity_of_contract', 'validity_of_contract': 'validity_of_contract',
  'FO Total Budget': 'fo_total_budget', 'FO Total Budget Amount': 'fo_total_budget', 'fo_total_budget': 'fo_total_budget',
}

const BUDGET_IMPORT_COLUMNS = [
  'operation','description','arc_number','work_order_number',
  'validity_of_contract','fo_total_budget',
]

function UtilBar({ consumed, total }) {
  const pct   = total > 0 ? Math.min(100, Math.round((consumed / total) * 100)) : 0
  const color = pct > 85 ? '#E30613' : pct > 60 ? '#f59e0b' : '#10b981'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'slate' }) {
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
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function BudgetPage() {
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  // Fiscal year tab handling
  const { fy } = useParams()
  const activeFy = fy || 'overall'

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedRow, setSelectedRow] = useState(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['budget', activeFy],
    queryFn: () => activeFy === 'overall' ? budgetDb.listAll() : budgetDb.list(activeFy),
  })
  const displayedRecords = records


  // Overall stats
  const totalBudget    = records.reduce((s, r) => s + (r.fo_total_budget    || 0), 0)
  const totalConsumed  = records.reduce((s, r) => s + (r.total_consumed     || 0), 0)
  const totalA3        = records.reduce((s, r) => s + (r.a3_released_amount || 0), 0)
  const totalPending   = records.reduce((s, r) => s + (r.pending_amount     || 0), 0)
  const totalInvoiced  = records.reduce((s, r) => s + (r.invoiced_amount    || 0), 0)
  const totalBalance   = totalBudget - totalConsumed
  const overallUtil    = totalBudget > 0 ? Math.round((totalConsumed / totalBudget) * 100) : 0
  const overdraftCount = records.filter(r => (r.balance_available || 0) < 0).length

  const saveMutation = useMutation({
    mutationFn: (payload) => editRow
      ? budgetDb.update(editRow.id, payload)
      : budgetDb.create({ ...payload, fy: activeFy }, user?.id),
    onSuccess: () => { qc.invalidateQueries(['budget']); toast.success(editRow ? 'Budget updated ✓' : 'Budget created ✓'); handleClose() },
    onError:   (e) => toast.error(e?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: budgetDb.delete,
    onSuccess: () => { qc.invalidateQueries(['budget']); toast.success('Budget entry deleted') },
    onError:   (e) => toast.error(e?.message || 'Delete failed'),
  })

  const pdfMutation = useMutation({
    mutationFn: ({ id, pdf_url }) => budgetDb.update(id, { pdf_url }),
    onSuccess: () => qc.invalidateQueries(['budget']),
  })

  const importRecords = async (rows) => {
    const mapped = rows.map(raw => {
      const rec = {}
      for (const [k, v] of Object.entries(raw)) {
        const dbKey = IMPORT_MAP[k] ?? IMPORT_MAP[k.trim()]
        if (dbKey && v !== '' && v !== null && v !== undefined) rec[dbKey] = v
      }
      return rec
    }).filter(r => r.work_order_number)

    if (!mapped.length) throw new Error('No valid rows found. Ensure "Work order number" column exists.')
    const count = await budgetDb.bulkInsert(mapped, user?.id, activeFy)
    qc.invalidateQueries(['budget'])
    return count
  }

  const openEdit = (row) => { setEditRow(row); setForm({ ...EMPTY_FORM, ...row }); setFormOpen(true) }
  const openAdd  = ()    => { setEditRow(null); setForm(EMPTY_FORM); setFormOpen(true) }
  const handleClose  = () => { setFormOpen(false); setEditRow(null); setForm(EMPTY_FORM) }
  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const handleDelete = (id) => { if (window.confirm('Delete this budget entry?')) deleteMutation.mutate(id) }
  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form) }
  const handleExport = () => { exportToExcel(records, `Budget_${activeFy}.xlsx`, 'Budget'); toast.success('Excel downloaded') }

  const columns = [
    { key: 'operation',           header: 'Operation' },
    { key: 'description',         header: 'Description' },
    { key: 'arc_number',          header: 'ARC Number' },
    { key: 'work_order_number',   header: 'Work Order No',     render: r => <span className="font-semibold text-white">{r.work_order_number}</span> },
    { key: 'validity_of_contract',header: 'Validity' },
    { key: 'fo_total_budget',     header: 'FO Total Budget',   render: r => <span className="text-blue-400 font-semibold">{formatINR(r.fo_total_budget)}</span> },
    {
      key: 'total_consumed',      header: 'Budget Consumed',
      render: r => (
        <div className="space-y-1 min-w-[160px]">
          <div className="text-jio-red-400 font-medium text-xs">{formatINR(r.total_consumed)}</div>
          <div className="text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between gap-3"><span>A3 Released:</span><span className="text-emerald-400">{formatINR(r.a3_released_amount)}</span></div>
            <div className="flex justify-between gap-3"><span>Pending:</span><span className="text-amber-400">{formatINR(r.pending_amount)}</span></div>
            <div className="flex justify-between gap-3"><span>Invoiced:</span><span className="text-cyan-400">{formatINR(r.invoiced_amount)}</span></div>
          </div>
          <UtilBar consumed={r.total_consumed} total={r.fo_total_budget} />
        </div>
      )
    },
    {
      key: 'balance_available',   header: 'Balance Available',
      render: r => (
        <span className={`font-semibold text-sm ${(r.balance_available || 0) < 0 ? 'text-jio-red-400' : 'text-emerald-400'}`}>
          {formatINR(r.balance_available)}
          {(r.balance_available || 0) < 0 && <span className="text-[10px] ml-1 text-jio-red-500">(Overdraft)</span>}
        </span>
      )
    },
    {
      key: 'pdf', header: 'PDF Doc', sortable: false,
      render: r => (
        <PdfCell pdfUrl={r.pdf_url} folder="budget" isAdmin={isAdmin}
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget Status</h1>
          <p className="text-sm text-slate-400 mt-0.5">Overall Contract Budget Tracking · {records.length} work orders</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="btn-ghost"><Download size={15} /> Export</button>
          {isAdmin && (
            <>
              <button onClick={() => setImportOpen(true)} className="btn-ghost"><Upload size={15} /> Import</button>
              <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Budget Entry</button>
            </>
          )}
        </div>
      </div>
      {/* FY Tabs */}
      <FyTabs basePath="/budget" />

      {/* ═══ OVERALL SUMMARY ══════════════════════════════ */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-jio-blue-400" /> Overall Budget Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <StatCard label="Work Orders"     value={records.length}            color="blue"   />
          <StatCard label="FO Total Budget" value={formatINR(totalBudget)}   color="blue"   />
          <StatCard label="Total Consumed"  value={formatINR(totalConsumed)} color="red"    />
          <StatCard label="Balance Available" value={formatINR(totalBalance)} color={totalBalance < 0 ? 'red' : 'green'} />
          <StatCard label="A3 Released"     value={formatINR(totalA3)}       color="green"  />
          <StatCard label="Pending Stage"   value={formatINR(totalPending)}  color="amber"  />
          <StatCard label="Invoiced Amount" value={formatINR(totalInvoiced)} color="cyan"   />
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Utilization: {overallUtil}% consumed</span>
            <span>{100 - overallUtil}% available</span>
          </div>
          <div className="w-full h-3.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{
              width: `${Math.min(overallUtil, 100)}%`,
              background: overallUtil > 85 ? 'linear-gradient(90deg,#E30613,#88040b)' : overallUtil > 60 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#0052A5,#003163)'
            }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card p-4">
        <DataTable columns={columns} data={displayedRecords} loading={isLoading}
          emptyMessage="No budget entries found" onRowClick={(row) => setSelectedRow(row)} />
      </div>

      {/* Modal */}
      <Modal open={formOpen} onClose={handleClose} title={editRow ? 'Edit Budget Entry' : 'Add Budget Entry'} size="max-w-xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          {[
            { name: 'operation',            label: 'Operation' },
            { name: 'arc_number',           label: 'ARC Number' },
            { name: 'work_order_number',    label: 'Work Order Number', required: true },
            { name: 'validity_of_contract', label: 'Validity of Contract' },
            { name: 'fo_total_budget',      label: 'FO Total Budget',   type: 'number' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}{f.required && ' *'}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''} onChange={handleChange}
                required={f.required} className="input-field" step={f.type === 'number' ? '0.01' : undefined} />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea name="description" value={form.description || ''} onChange={handleChange} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-slate-700 mt-2">
            <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving…' : editRow ? 'Update Entry' : 'Create Entry'}
            </button>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)}
        onImport={importRecords} columnMap={BUDGET_IMPORT_COLUMNS} title="Import Budget Records" />

      {/* Summary Modal - opens when a row is clicked */}
      <SummaryModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  )
}
