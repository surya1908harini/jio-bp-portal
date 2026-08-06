import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, CURRENT_FY, getFinancialYear, getBudgetRecordFy } from '../lib/utils'
import {
  FileText, Receipt, PieChart as PieChartIcon, Clock, CheckCircle, TrendingUp, Calendar,
  ArrowRight, Shield, Zap, DollarSign, Activity, FileCheck, Layers, Settings, RefreshCw, CheckCircle2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

function StatCard({ icon: Icon, label, value, sub, trend, color = 'purple', to }) {
  const bgColors = {
    purple: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
    green:  'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
    amber:  'bg-amber-600/20 text-amber-400 border-amber-500/30',
    red:    'bg-rose-600/20 text-rose-400 border-rose-500/30',
    cyan:   'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
    blue:   'bg-blue-600/20 text-blue-400 border-blue-500/30',
  }

  const iconCircle = {
    purple: 'bg-indigo-600 shadow-indigo-600/30',
    green:  'bg-emerald-600 shadow-emerald-600/30',
    amber:  'bg-amber-500 shadow-amber-500/30',
    red:    'bg-rose-600 shadow-rose-600/30',
    cyan:   'bg-cyan-600 shadow-cyan-600/30',
    blue:   'bg-blue-600 shadow-blue-600/30',
  }

  const CardWrapper = to ? Link : 'div'
  const wrapperProps = to ? { to, className: 'block group' } : {}

  return (
    <CardWrapper {...wrapperProps}>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl shadow-lg hover:border-slate-700 hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">{label}</span>
          <div className={`w-9 h-9 rounded-full ${iconCircle[color]} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
            <Icon size={18} />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-extrabold text-white tracking-tight">{value}</p>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
          <span className="text-[11px] text-slate-500">{sub}</span>
          {trend && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 flex items-center gap-0.5">
              ▲ {trend}
            </span>
          )}
        </div>
      </div>
    </CardWrapper>
  )
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')

  // Fetch data
  const { data: jmsList = [] }     = useQuery({ queryKey: ['jms', 'all'],     queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }  = useQuery({ queryKey: ['budget', 'all'],   queryFn: () => budgetDb.listAll() })

  // Helpers to determine FY
  const getJmsFy = (r) => {
    const date = r.jms_create_date || r.inv_date || r.a1_release_date || r.a2_release_date || r.qsd_release_date || r.inv_posting_date || r.payment_date;
    if (date) {
      const fy = getFinancialYear(date)
      if (fy) return fy
    }
    return r.financial_year || '2024-25'
  }

  const getInvFy = (r) => {
    const date = r.inv_date || r.amount_received_date;
    if (date) {
      const fy = getFinancialYear(date)
      if (fy) return fy
    }
    return r.financial_year || '2024-25'
  }

  // Filter for CURRENT_FY
  const currentJmsList    = jmsList.filter(j => getJmsFy(j) === CURRENT_FY)
  const currentInvList    = invoiceList.filter(i => getInvFy(i) === CURRENT_FY)
  const currentBudgetList = budgetList.filter(b => getBudgetRecordFy(b) === CURRENT_FY)

  const totalJmsCount = currentJmsList.length
  const pendingJms    = currentJmsList.filter(j => !['Released by A3','Invoiced'].includes(j.status)).length
  const a3Released    = currentJmsList.filter(j => j.status === 'Released by A3' || j.status === 'Invoiced').length
  const totalInvAmt   = currentInvList.reduce((s, i) => s + (i.grand_total || 0), 0)
  const fullPaid      = currentInvList.filter(i => i.payment_status === 'Full Payment Received').length

  const totalBudget   = currentBudgetList.reduce((s, b) => s + (b.fo_total_budget || 0), 0)
  const totalConsumed = currentBudgetList.reduce((s, b) => s + (b.total_consumed || 0), 0)
  const remainingBudget = totalBudget - totalConsumed

  // Donut chart status breakdown
  const pieData = [
    { name: 'Released A3', value: a3Released, color: '#10b981' },
    { name: 'Pending A1/A2', value: currentJmsList.filter(j => ['Pending A1','Pending A2','A1','A2'].includes(j.status)).length, color: '#f59e0b' },
    { name: 'Pending QSD/A3', value: currentJmsList.filter(j => ['Pending QSD','Pending A3','QSD','A3'].includes(j.status)).length, color: '#6366f1' },
    { name: 'Invoiced', value: currentInvList.length, color: '#06b6d4' },
  ].filter(d => d.value > 0)

  // Status Distribution Bar Chart
  const statusDist = [
    { name: 'Pending A1', count: currentJmsList.filter(j => ['Pending A1','Pending','A1'].includes(j.status)).length },
    { name: 'Pending A2', count: currentJmsList.filter(j => ['Pending A2','A2'].includes(j.status)).length },
    { name: 'Pending QSD', count: currentJmsList.filter(j => ['Pending QSD','QSD'].includes(j.status)).length },
    { name: 'Pending A3', count: currentJmsList.filter(j => ['Pending A3','A3'].includes(j.status)).length },
    { name: 'Released A3', count: a3Released },
  ]
  const BAR_COLORS = ['#f59e0b', '#a855f7', '#06b6d4', '#3b82f6', '#10b981']

  // Latest JMS records
  const recentJms = [...currentJmsList].sort((a, b) => {
    const da = a.jms_create_date || a.inv_date || a.a1_release_date || a.created_at || ''
    const db = b.jms_create_date || b.inv_date || b.a1_release_date || b.created_at || ''
    return db.localeCompare(da)
  }).slice(0, 5)

  // Latest Invoices
  const recentInvoices = [...currentInvList].sort((a, b) => {
    const da = a.inv_date || a.amount_received_date || a.created_at || ''
    const db = b.inv_date || b.amount_received_date || b.created_at || ''
    return db.localeCompare(da)
  }).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ─────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/mmc_logo.jpg" alt="MMC Logo" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950/90 text-indigo-300 border border-indigo-700/60">
                  {isAdmin ? 'MMC Admin' : 'User Portal'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time tracking of JMS records, billing invoices & contract budgets for <strong className="text-slate-200">FY {CURRENT_FY}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
              <Calendar size={15} className="text-indigo-400" />
              <span className="text-xs font-semibold text-white">FY {CURRENT_FY}</span>
              <span className="text-[10px] text-slate-400 font-mono">(Active)</span>
            </div>
          </div>
        </div>

        {/* ── Quick Action Pill Buttons Bar ───────────────────── */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 flex-wrap">
          {[
            { id: 'all', label: 'Overview', path: '/dashboard', icon: Layers },
            { id: 'jms', label: 'JMS Details', path: '/jms', icon: FileText },
            { id: 'invoices', label: 'Invoices', path: '/invoices', icon: Receipt },
            { id: 'budget', label: 'Budget Status', path: '/budget', icon: PieChartIcon },
            ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', path: '/admin', icon: Settings }] : []),
          ].map(tab => (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-indigo-600/40 ring-1 ring-indigo-400'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 4 Key Performance Stat Cards Grid ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Total JMS Records"
          value={totalJmsCount}
          sub={`FY ${CURRENT_FY} Total`}
          trend="Realtime"
          color="purple"
          to={`/jms/${CURRENT_FY}?slot=all`}
        />
        <StatCard
          icon={Clock}
          label="Pending Approval"
          value={pendingJms}
          sub="Pending A1 / A2 / QSD / A3"
          color="amber"
          to={`/jms/${CURRENT_FY}?slot=pending_a1`}
        />
        <StatCard
          icon={CheckCircle}
          label="Released by A3"
          value={a3Released}
          sub="Ready for invoicing"
          trend="Verified"
          color="green"
          to={`/jms/${CURRENT_FY}?slot=released_a3`}
        />
        <StatCard
          icon={Receipt}
          label="Total Invoice Value"
          value={formatINR(totalInvAmt)}
          sub={`${currentInvList.length} Invoices (${fullPaid} Paid)`}
          color="cyan"
          to={`/invoices/${CURRENT_FY}?slot=all`}
        />
      </div>

      {/* ── Visual Graphics Row (Donut Statistics & Bar Distribution) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Donut Chart Statistics */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <PieChartIcon size={18} className="text-indigo-400" />
                JMS Stage Statistics
              </h2>
              <p className="text-xs text-slate-400">Distribution across release & payment stages</p>
            </div>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: 'Empty', value: 1, color: '#334155' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Donut Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-white">{totalJmsCount}</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total JMS</span>
            </div>
          </div>

          {/* Legend breakdown */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/60">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-slate-300 font-medium">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Bar Chart Distribution */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-emerald-400" />
                JMS Approval Stage Bar Chart
              </h2>
              <p className="text-xs text-slate-400">Current status counts for FY {CURRENT_FY}</p>
            </div>
            <Link to="/jms" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div className="my-2">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={statusDist} barSize={36}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 13 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget Overview Summary strip */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/60 text-center">
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 uppercase">FO Total Budget</p>
              <p className="text-xs font-bold text-indigo-400 mt-0.5">{formatINR(totalBudget)}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Total Consumed</p>
              <p className="text-xs font-bold text-rose-400 mt-0.5">{formatINR(totalConsumed)}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Remaining Budget</p>
              <p className={`text-xs font-bold mt-0.5 ${remainingBudget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatINR(remainingBudget)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Details Section: Recent JMS & Invoices Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent JMS Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
                <FileText size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Recent JMS Records</h3>
                <p className="text-[11px] text-slate-400">Latest entries for FY {CURRENT_FY}</p>
              </div>
            </div>
            <Link to="/jms" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">JMS No</th>
                  <th className="py-2.5 px-3 font-semibold">Work Order</th>
                  <th className="py-2.5 px-3 font-semibold">Net Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentJms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">No recent JMS records found</td>
                  </tr>
                ) : (
                  recentJms.map(j => (
                    <tr key={j.id} className="hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => navigate('/jms')}>
                      <td className="py-2.5 px-3 font-bold text-white">{j.jms_no}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{j.work_order_number || '—'}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400">{formatINR(j.net_amount)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                          {j.status || 'Pending A1'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
                <Receipt size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Recent Invoices</h3>
                <p className="text-[11px] text-slate-400">Latest billing entries for FY {CURRENT_FY}</p>
              </div>
            </div>
            <Link to="/invoices" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">Invoice No</th>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Grand Total</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">No recent invoice records found</td>
                  </tr>
                ) : (
                  recentInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => navigate('/invoices')}>
                      <td className="py-2.5 px-3 font-bold text-white">{inv.inv_number || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatDate(inv.inv_date)}</td>
                      <td className="py-2.5 px-3 font-semibold text-cyan-400">{formatINR(inv.grand_total)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.payment_status === 'Full Payment Received'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                        }`}>
                          {inv.payment_status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
