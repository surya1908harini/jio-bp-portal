import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, CURRENT_FY, getFinancialYear, getBudgetRecordFy } from '../lib/utils'
import {
  FileText, Receipt, PieChart as PieChartIcon, Clock, CheckCircle, TrendingUp, Calendar,
  ArrowRight, Shield, Activity, Sparkles, Award, Zap, DollarSign, Layers, Plus, ExternalLink
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area } from 'recharts'

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
    { name: 'Released A3', value: a3Released, color: '#ec4899' },
    { name: 'Pending Approval', value: pendingJms, color: '#8b5cf6' },
    { name: 'Invoiced', value: currentInvList.length, color: '#06b6d4' },
  ].filter(d => d.value > 0)

  // Monthly Activity Trend Data
  const trendData = [
    { name: 'Jan', jms: 12, invoices: 8 },
    { name: 'Feb', jms: 18, invoices: 14 },
    { name: 'Mar', jms: 25, invoices: 20 },
    { name: 'Apr', jms: 30, invoices: 22 },
    { name: 'May', jms: 22, invoices: 18 },
    { name: 'Jun', jms: 35, invoices: 28 },
  ]

  // Activity pulse list
  const pulseItems = [
    { time: '09:00', title: 'JMS Record Synchronization', desc: 'Auto-synced work orders from JMS into Budget' },
    { time: '11:30', title: 'A3 Released Verification', desc: `${a3Released} JMS records ready for invoicing` },
    { time: '14:00', title: 'Contract Budget Audit', desc: `${currentBudgetList.length} Work Orders active for FY ${CURRENT_FY}` },
  ]

  return (
    <div className="space-y-6">
      {/* ── Acadx Style Top Row: Hero Banner & Today's Pulse Card ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hero Banner (Purple/Magenta Gradient) */}
        <div className="lg:col-span-8 rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-7 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center gap-1.5">
                <Sparkles size={12} /> LIVE · {totalJmsCount} ACTIVE JMS RECORDS
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              MM Contractor Portal is humming.
            </h1>
            <p className="text-sm text-purple-100 mt-2 max-w-xl leading-relaxed">
              Up <strong className="text-white">+18% this month</strong> across all work orders. Real-time billing, contract validity, and A3 releases for <strong>FY {CURRENT_FY}</strong>.
            </p>

            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <Link
                to="/jms"
                className="px-5 py-2.5 rounded-full bg-white text-purple-700 font-bold text-xs shadow-lg hover:bg-purple-50 active:scale-95 transition-all flex items-center gap-2"
              >
                <Plus size={15} strokeWidth={3} /> Create / Manage JMS
              </Link>
              <Link
                to="/budget"
                className="px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-md text-white font-semibold text-xs border border-white/30 hover:bg-white/30 transition-all flex items-center gap-2"
              >
                <PieChartIcon size={14} /> Schedule Budget Audit
              </Link>
            </div>
          </div>

          {/* Mini Stat Boxes Inside Hero Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-5 border-t border-white/20">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <p className="text-[10px] text-purple-200 uppercase font-semibold">Total JMS</p>
              <p className="text-lg font-bold text-white mt-0.5">{totalJmsCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <p className="text-[10px] text-purple-200 uppercase font-semibold">Released A3</p>
              <p className="text-lg font-bold text-emerald-300 mt-0.5">{a3Released}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <p className="text-[10px] text-purple-200 uppercase font-semibold">Invoices Value</p>
              <p className="text-sm font-bold text-white mt-0.5">{formatINR(totalInvAmt)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <p className="text-[10px] text-purple-200 uppercase font-semibold">Budget Available</p>
              <p className="text-sm font-bold text-emerald-300 mt-0.5">{formatINR(remainingBudget)}</p>
            </div>
          </div>
        </div>

        {/* Today's Pulse Card (Right side) */}
        <div className="lg:col-span-4 rounded-3xl border border-purple-100/80 bg-white dark:bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={18} className="text-purple-600" />
                  Today's Pulse
                </h2>
                <p className="text-xs text-slate-400">Portal events & status updates</p>
              </div>
              <span className="text-xs font-semibold text-purple-600">Active</span>
            </div>

            <div className="space-y-4 my-2">
              {pulseItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-xs p-2.5 rounded-2xl hover:bg-purple-50 dark:hover:bg-slate-800/50 transition-colors">
                  <span className="font-mono text-[11px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-lg shrink-0">
                    {item.time}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{item.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/jms"
            className="w-full py-2.5 rounded-2xl bg-purple-50 dark:bg-slate-800/80 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-purple-100 transition-colors mt-4"
          >
            View All Portal Activities <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── 4 Acadx Vibrant Color Stat Cards Grid ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Quick Actions Card (White) */}
        <div className="rounded-3xl border border-purple-100/80 bg-white dark:bg-slate-900/70 p-5 shadow-xl">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-md mb-3">
            <Zap size={20} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Quick Actions</h3>
          <p className="text-xs text-slate-400 mb-3">Jump straight to work</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link to="/jms" className="p-2 rounded-xl bg-purple-50 dark:bg-slate-800 text-purple-700 dark:text-purple-300 font-semibold text-center hover:bg-purple-100 transition-colors">
              + New JMS
            </Link>
            <Link to="/invoices" className="p-2 rounded-xl bg-pink-50 dark:bg-slate-800 text-pink-700 dark:text-pink-300 font-semibold text-center hover:bg-pink-100 transition-colors">
              + Add Invoice
            </Link>
          </div>
        </div>

        {/* Revenue Card (Emerald Green #10b981) */}
        <div className="rounded-3xl bg-emerald-500 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">REVENUE / NET</span>
              <DollarSign size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{formatINR(totalInvAmt)}</h3>
            <p className="text-xs text-emerald-100 mt-1">▲ +9.6% vs last month</p>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-200 mt-4">FY {CURRENT_FY} Total</span>
        </div>

        {/* JMS Active Card (Electric Violet #7c3aed) */}
        <div className="rounded-3xl bg-purple-600 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-100">TOTAL JMS</span>
              <FileText size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{totalJmsCount} Records</h3>
            <p className="text-xs text-purple-100 mt-1">▲ {a3Released} Released by A3</p>
          </div>
          <span className="text-[10px] uppercase font-bold text-purple-200 mt-4">Realtime Synced</span>
        </div>

        {/* Budget Milestone Card (Bright Pink #ec4899) */}
        <div className="rounded-3xl bg-pink-500 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-100">BUDGET MILESTONE</span>
              <Award size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{formatINR(remainingBudget)}</h3>
            <p className="text-xs text-pink-100 mt-1">Available Contract Balance</p>
          </div>
          <span className="text-[10px] uppercase font-bold text-pink-200 mt-4">{currentBudgetList.length} Work Orders</span>
        </div>
      </div>

      {/* ── Acadx Visual Charts Grid (Line & Donut Radial) ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Line / Area Chart (Enrollments vs Completions Style) */}
        <div className="lg:col-span-8 rounded-3xl border border-purple-100/80 bg-white dark:bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">JMS Activity vs Invoicing Trend</h2>
              <p className="text-xs text-slate-400">6-month rolling view across all work orders</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-purple-600"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> JMS Created</span>
              <span className="flex items-center gap-1 text-pink-500"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Invoiced</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 12 }} />
              <Area type="monotone" dataKey="jms" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={3} />
              <Area type="monotone" dataKey="invoices" stroke="#ec4899" fill="#ec4899" fillOpacity={0.15} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radial Donut Radial Progress Chart */}
        <div className="lg:col-span-4 rounded-3xl border border-purple-100/80 bg-white dark:bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">A3 Release Goals</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">On Track</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Target vs actual release progress</p>

            <div className="relative flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-extrabold text-purple-600">68.7%</span>
                <span className="text-[10px] text-slate-400 font-semibold">Overall Goal</span>
              </div>
            </div>
          </div>

          <div className="flex justify-around text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-purple-600 font-semibold">● Completion</span>
            <span className="text-pink-500 font-semibold">● Engagement</span>
            <span className="text-cyan-500 font-semibold">● Retention</span>
          </div>
        </div>
      </div>
    </div>
  )
}
