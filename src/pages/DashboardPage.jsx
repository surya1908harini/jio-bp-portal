import { useState, useMemo } from 'react'
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
  const pendingA1     = currentJmsList.filter(j => j.status === 'Pending A1' || j.status === 'A1').length
  const pendingA2     = currentJmsList.filter(j => j.status === 'Pending A2' || j.status === 'A2').length
  const pendingQsd    = currentJmsList.filter(j => j.status === 'Pending QSD' || j.status === 'QSD').length
  const pendingA3     = currentJmsList.filter(j => j.status === 'Pending A3' || j.status === 'A3').length
  const a3Released    = currentJmsList.filter(j => j.status === 'Released by A3' || j.status === 'Invoiced').length

  const totalInvAmt   = currentInvList.reduce((s, i) => s + (i.grand_total || 0), 0)
  const totalBudget   = currentBudgetList.reduce((s, b) => s + (b.fo_total_budget || 0), 0)
  const totalConsumed = currentBudgetList.reduce((s, b) => s + (b.total_consumed || 0), 0)
  const remainingBudget = totalBudget - totalConsumed

  // Donut chart: "JMS Details" (Pending A1, A2, QSD, A3 and Released A3 - No Invoiced)
  const pieData = [
    { name: 'Pending A1',  value: pendingA1,  color: '#3b82f6' },
    { name: 'Pending A2',  value: pendingA2,  color: '#8b5cf6' },
    { name: 'Pending QSD', value: pendingQsd, color: '#f59e0b' },
    { name: 'Pending A3',  value: pendingA3,  color: '#ec4899' },
    { name: 'Released A3', value: a3Released, color: '#10b981' },
  ].filter(d => d.value > 0)

  // Realtime Monthly Activity Trend Data calculated dynamically from DB
  const trendData = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
    const monthCounts = months.map(m => ({ name: m, jms: 0, invoices: 0 }))

    const getMonthAbbrev = (dateStr) => {
      if (!dateStr) return null
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      return d.toLocaleString('default', { month: 'short' })
    }

    currentJmsList.forEach(j => {
      const date = j.jms_create_date || j.inv_date || j.a1_release_date || j.created_at
      const m = getMonthAbbrev(date)
      const item = monthCounts.find(x => x.name === m)
      if (item) item.jms += 1
    })

    currentInvList.forEach(inv => {
      const date = inv.inv_date || inv.amount_received_date || inv.created_at
      const m = getMonthAbbrev(date)
      const item = monthCounts.find(x => x.name === m)
      if (item) item.invoices += 1
    })

    return monthCounts
  }, [currentJmsList, currentInvList])

  return (
    <div className="space-y-6">
      {/* ── Full Width Hero Banner (Purple/Magenta Gradient) ───── */}
      <div className="w-full rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-7 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center gap-1.5">
              <Sparkles size={12} /> LIVE · {totalJmsCount} ACTIVE JMS RECORDS
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            MM Contractor Portal Executive Overview
          </h1>
          <p className="text-sm text-purple-100 mt-2 max-w-2xl leading-relaxed">
            Real-time billing, contract validity, and stage releases tracking for <strong>FY {CURRENT_FY}</strong>.
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
              <PieChartIcon size={14} /> View Budget Status
            </Link>
          </div>
        </div>

        {/* Mini Stat Boxes Inside Hero Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-5 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Total JMS</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{totalJmsCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Released A3</p>
            <p className="text-xl font-extrabold text-emerald-300 mt-0.5">{a3Released}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Invoices Value</p>
            <p className="text-base font-extrabold text-white mt-0.5">{formatINR(totalInvAmt)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Budget Available</p>
            <p className="text-base font-extrabold text-emerald-300 mt-0.5">{formatINR(remainingBudget)}</p>
          </div>
        </div>
      </div>

      {/* ── 3 Focus Cards Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Quick Actions Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-md mb-3">
            <Zap size={20} />
          </div>
          <h3 className="text-base font-bold text-white">Quick Actions</h3>
          <p className="text-xs text-slate-400 mb-3">Jump straight to work</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link to="/jms" className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-300 font-semibold text-center hover:bg-purple-900 transition-colors">
              + New JMS
            </Link>
            <Link to="/invoices" className="p-2.5 rounded-xl bg-pink-950/80 border border-pink-800/60 text-pink-300 font-semibold text-center hover:bg-pink-900 transition-colors">
              + Add Invoice
            </Link>
          </div>
        </div>

        {/* Invoicing Summary Card */}
        <div className="rounded-3xl bg-emerald-600 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">INVOICING TOTAL</span>
              <DollarSign size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{formatINR(totalInvAmt)}</h3>
            <p className="text-xs text-emerald-100 mt-1">{currentInvList.length} Total Invoices Issued</p>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-200 mt-4">FY {CURRENT_FY} Billing</span>
        </div>

        {/* Contract Budget Overview Card */}
        <div className="rounded-3xl bg-purple-600 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-100">CONTRACT BUDGET</span>
              <PieChartIcon size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{formatINR(totalBudget)}</h3>
            <p className="text-xs text-purple-100 mt-1">Consumed: {formatINR(totalConsumed)}</p>
          </div>
          <span className="text-[10px] uppercase font-bold text-purple-200 mt-4">{currentBudgetList.length} Work Orders Active</span>
        </div>
      </div>

      {/* ── Dynamic Realtime Visual Charts Grid ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Line / Area Chart */}
        <div className="lg:col-span-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Monthly Activity Trend (FY {CURRENT_FY})</h2>
              <p className="text-xs text-slate-400">Live distribution of JMS entries vs Invoices</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-purple-400"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> JMS Records</span>
              <span className="flex items-center gap-1 text-pink-400"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Invoices</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 12 }} />
              <Area type="monotone" dataKey="jms" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={3} />
              <Area type="monotone" dataKey="invoices" stroke="#ec4899" fill="#ec4899" fillOpacity={0.2} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut Progress Chart: "JMS Details" (Pending A1, A2, QSD, A3 and Released A3) */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-white">JMS Details</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                FY {CURRENT_FY}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Stage-wise release & approval breakdown</p>

            <div className="relative flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: 'Empty', value: 1, color: '#334155' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-extrabold text-white">{totalJmsCount}</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total JMS</span>
              </div>
            </div>
          </div>

          {/* Legend for Pending A1, A2, QSD, A3 & Released A3 */}
          <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-slate-800 text-[11px]">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <span className="text-slate-300 font-medium truncate">{item.name}</span>
                </div>
                <span className="font-bold text-white ml-1">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
