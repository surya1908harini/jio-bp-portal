import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, CURRENT_FY, getFinancialYear, getBudgetRecordFy } from '../lib/utils'
import {
  FileText, Receipt, PieChart as PieChartIcon, Clock, CheckCircle, TrendingUp, Calendar,
  ArrowRight, Shield, Activity, FileCheck, Layers, Settings, ChevronRight
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

function StatCard({ icon: Icon, label, value, sub, trend, color = 'purple', to }) {
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

  // Budget Allocation Bar Chart (Unique non-repeated dataset)
  const budgetChartData = currentBudgetList.slice(0, 5).map(b => ({
    name: b.work_order_number ? String(b.work_order_number).slice(-6) : 'WO',
    allocated: b.fo_total_budget || 0,
    consumed: b.total_consumed || 0,
  }))

  // Activity stream items
  const recentActivities = [
    ...currentJmsList.slice(0, 3).map(j => ({
      id: j.id,
      title: `JMS ${j.jms_no || 'Record'} Status`,
      sub: `WO: ${j.work_order_number || 'N/A'} · Status: ${j.status || 'Pending'}`,
      date: formatDate(j.jms_create_date || j.created_at),
      type: 'jms',
      badgeColor: 'bg-indigo-950/80 text-indigo-400 border-indigo-700/50'
    })),
    ...currentInvList.slice(0, 2).map(inv => ({
      id: inv.id,
      title: `Invoice ${inv.inv_number || 'INV'}`,
      sub: `Amount: ${formatINR(inv.grand_total)} · ${inv.payment_status || 'Pending'}`,
      date: formatDate(inv.inv_date || inv.created_at),
      type: 'invoice',
      badgeColor: 'bg-cyan-950/80 text-cyan-400 border-cyan-700/50'
    }))
  ]

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

      {/* ── Visual Graphics Row (Donut Statistics & Budget Bar Comparison) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Donut Chart Stage Statistics */}
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

        {/* Right: Contract Budget Spending Chart (Non-repetitive unique data) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Work Order Budget vs Consumed (FY {CURRENT_FY})
              </h2>
              <p className="text-xs text-slate-400">Budget allocation vs total amount consumed</p>
            </div>
            <Link to="/budget" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View Budget <ArrowRight size={13} />
            </Link>
          </div>

          <div className="my-2">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={budgetChartData} barSize={24}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 12 }}
                  formatter={(val) => formatINR(val)}
                />
                <Bar dataKey="allocated" name="Allocated Budget" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="consumed" name="Consumed" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget Summary Footer Strip */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/60 text-center">
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Total Allocation</p>
              <p className="text-xs font-bold text-indigo-400 mt-0.5">{formatINR(totalBudget)}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Total Consumed</p>
              <p className="text-xs font-bold text-rose-400 mt-0.5">{formatINR(totalConsumed)}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Remaining Balance</p>
              <p className={`text-xs font-bold mt-0.5 ${remainingBudget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatINR(remainingBudget)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Activity Stream Widget ───────────────────── */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-indigo-400" />
            <h2 className="text-base font-bold text-white">Recent Portal Activities</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Real-time updates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentActivities.map((act, i) => (
            <div key={i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">{act.title}</p>
                <p className="text-[11px] text-slate-400">{act.sub}</p>
                <p className="text-[10px] text-slate-500">{act.date}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor}`}>
                {act.type.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
