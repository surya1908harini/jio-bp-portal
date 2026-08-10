import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb, purchaseBillDb } from '../lib/db'
import { formatINR, formatDate, CURRENT_FY, getFinancialYear, getBudgetRecordFy } from '../lib/utils'
import {
  FileText, Receipt, PieChart as PieChartIcon, Clock, CheckCircle, TrendingUp, Calendar,
  ArrowRight, Shield, Activity, Sparkles, Award, Zap, DollarSign, Layers, Plus, ExternalLink, ShoppingBag
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area } from 'recharts'

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  // Fetch data
  const { data: jmsList = [] }          = useQuery({ queryKey: ['jms', 'all'],            queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] }      = useQuery({ queryKey: ['invoices', 'all'],        queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }       = useQuery({ queryKey: ['budget', 'all'],          queryFn: () => budgetDb.listAll() })
  const { data: purchaseBillList = [] } = useQuery({ queryKey: ['purchase_bills', 'all'],  queryFn: () => purchaseBillDb.listAll() })

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

  const getPbFy = (r) => {
    const date = r.inv_date
    if (date) {
      const fy = getFinancialYear(date)
      if (fy) return fy
    }
    return r.financial_year || CURRENT_FY
  }

  // Active (non-cancelled) records
  const activeJmsList = useMemo(() => jmsList.filter(j => {
    const desc = String(j.work_description || '')
    const st = String(j.status || '').toLowerCase()
    return !desc.includes('[Cancelled:') && !st.includes('cancel')
  }), [jmsList])

  // Active non-cancelled, non-IOCL invoices
  const activeInvList = useMemo(() => invoiceList.filter(i => {
    const desc = String(i.work_description || '')
    const st = String(i.payment_status || i.status || '').toLowerCase()
    const isCancelled = desc.includes('[Cancelled:') || st.includes('cancel')
    const isIocl = String(i.type_of_ro || '').trim().toUpperCase() === 'IOCL'
    return !isCancelled && !isIocl
  }), [invoiceList])

  // Filter for CURRENT_FY
  const currentJmsList    = activeJmsList.filter(j => getJmsFy(j) === CURRENT_FY)
  const currentInvList    = activeInvList.filter(i => getInvFy(i) === CURRENT_FY)
  const currentBudgetList = budgetList.filter(b => getBudgetRecordFy(b) === CURRENT_FY)
  const currentPbList     = purchaseBillList.filter(b => getPbFy(b) === CURRENT_FY)

  // JMS Status calculations
  const isJmsReleased = (j) => {
    if (j.a3_release_date) return true
    const st = String(j.status || '').trim().toLowerCase()
    return st === 'released by a3' || st === 'invoiced' || st.includes('released')
  }

  const totalJmsCount   = currentJmsList.length
  const a3Released      = currentJmsList.filter(isJmsReleased).length
  const pendingJmsCount = currentJmsList.filter(j => !isJmsReleased(j)).length

  const pendingA1 = currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending a1' || st === 'a1' || st === 'pending' }).length
  const pendingA2 = currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending a2' || st === 'a2' }).length
  const pendingQsd= currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending qsd' || st === 'qsd' }).length
  const pendingA3 = currentJmsList.filter(j => { const st = String(j.status || '').trim().toLowerCase(); return st === 'pending a3' || st === 'a3' }).length

  const totalInvAmt = currentInvList.reduce((s, i) => s + (i.grand_total || 0), 0)

  // Donut chart: JMS breakdown
  const pieData = [
    { name: 'Pending A1',  value: pendingA1,  color: '#3b82f6' },
    { name: 'Pending A2',  value: pendingA2,  color: '#8b5cf6' },
    { name: 'Pending QSD', value: pendingQsd, color: '#f59e0b' },
    { name: 'Pending A3',  value: pendingA3,  color: '#ec4899' },
    { name: 'Released A3', value: a3Released, color: '#10b981' },
  ].filter(d => d.value > 0)

  const [trendFy, setTrendFy] = useState(CURRENT_FY)

  const trendJmsList = useMemo(() => activeJmsList.filter(j => getJmsFy(j) === trendFy), [activeJmsList, trendFy])
  const trendInvList = useMemo(() => activeInvList.filter(i => getInvFy(i) === trendFy), [activeInvList, trendFy])

  // Monthly Activity Trend Data
  const trendData = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
    const monthCounts = months.map(m => ({ name: m, jms: 0, invoices: 0 }))

    const getMonthAbbrev = (dateStr) => {
      if (!dateStr) return null
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      return d.toLocaleString('default', { month: 'short' })
    }

    trendJmsList.forEach(j => {
      const date = j.jms_create_date || j.inv_date || j.a1_release_date || j.created_at
      const m = getMonthAbbrev(date)
      const item = monthCounts.find(x => x.name === m)
      if (item) item.jms += 1
    })

    trendInvList.forEach(inv => {
      const date = inv.inv_date || inv.amount_received_date || inv.created_at
      const m = getMonthAbbrev(date)
      const item = monthCounts.find(x => x.name === m)
      if (item) item.invoices += 1
    })

    return monthCounts
  }, [trendJmsList, trendInvList])

  // Month-wise Purchase Bill amount data (FY-wise)
  const [pbFy, setPbFy] = useState(CURRENT_FY)
  const pbFyList = useMemo(() => purchaseBillList.filter(b => getPbFy(b) === pbFy), [purchaseBillList, pbFy])

  const pbMonthData = useMemo(() => {
    const months = [
      { name: 'Apr', num: 4 }, { name: 'May', num: 5 }, { name: 'Jun', num: 6 },
      { name: 'Jul', num: 7 }, { name: 'Aug', num: 8 }, { name: 'Sep', num: 9 },
      { name: 'Oct', num: 10 }, { name: 'Nov', num: 11 }, { name: 'Dec', num: 12 },
      { name: 'Jan', num: 1 }, { name: 'Feb', num: 2 }, { name: 'Mar', num: 3 },
    ]
    return months.map(m => {
      const rows = pbFyList.filter(b => {
        if (!b.inv_date) return false
        const d = new Date(b.inv_date)
        return !isNaN(d.getTime()) && (d.getMonth() + 1) === m.num
      })
      const amount = rows.reduce((s, b) => s + (Number(b.invoice_value) || 0), 0)
      return { name: m.name, amount, count: rows.length }
    })
  }, [pbFyList])

  const totalPbAmount = currentPbList.reduce((s, b) => s + (Number(b.invoice_value) || 0), 0)

  return (
    <div className="space-y-6">
      {/* ── Full Width Hero Banner ── */}
      <div className="w-full rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-7 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between reveal-on-scroll hover-elevate">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center gap-1.5 animate-pulse-glow">
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
              to="/budget"
              className="px-5 py-2.5 rounded-full bg-white text-purple-700 font-bold text-xs shadow-lg hover:bg-purple-50 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2"
            >
              <PieChartIcon size={15} /> View Budget Status
            </Link>
          </div>
        </div>

        {/* Mini Stat Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-5 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 hover-elevate-sm cursor-pointer" onClick={() => navigate('/jms')}>
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Total JMS</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{totalJmsCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 hover-elevate-sm cursor-pointer" onClick={() => navigate(`/jms?slot=released_a3&fy=${CURRENT_FY}`)}>
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Released A3</p>
            <p className="text-xl font-extrabold text-emerald-300 mt-0.5">{a3Released}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 hover-elevate-sm cursor-pointer" onClick={() => navigate('/invoices')}>
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Total Invoices</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{currentInvList.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 hover-elevate-sm cursor-pointer" onClick={() => navigate(`/jms?slot=pending_a1&fy=${CURRENT_FY}`)}>
            <p className="text-[10px] text-purple-200 uppercase font-semibold">Pending JMS</p>
            <p className="text-xl font-extrabold text-amber-300 mt-0.5">{pendingJmsCount}</p>
          </div>
        </div>
      </div>

      {/* ── Invoicing Summary (single card replacing Quick Actions + Contract Budget) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 reveal-on-scroll">
        <div className="rounded-3xl bg-emerald-600 p-5 text-white shadow-xl flex flex-col justify-between hover-elevate">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">INVOICING TOTAL</span>
              <DollarSign size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{formatINR(totalInvAmt)}</h3>
            <p className="text-xs text-emerald-100 mt-1">{currentInvList.length} Total Invoices Issued</p>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/50 flex items-center justify-between text-xs text-emerald-100">
            <span>FY {CURRENT_FY} Billing</span>
            <Link to="/invoices" className="font-bold underline hover:text-white transition-all">View Invoices →</Link>
          </div>
        </div>

        <div className="rounded-3xl bg-indigo-700 p-5 text-white shadow-xl flex flex-col justify-between hover-elevate">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">PURCHASE BILLS TOTAL</span>
              <ShoppingBag size={20} />
            </div>
            <h3 className="text-2xl font-extrabold text-white">{formatINR(totalPbAmount)}</h3>
            <p className="text-xs text-indigo-200 mt-1">{currentPbList.length} Purchase Bills — FY {CURRENT_FY}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-500/50 flex items-center justify-between text-xs text-indigo-200">
            <span>Supplier Invoice Total</span>
            <Link to="/purchase-bills" className="font-bold underline hover:text-white transition-all">View Bills →</Link>
          </div>
        </div>
      </div>

      {/* ── Month-wise Purchase Bill Bar Chart ── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl hover-elevate reveal-on-scroll">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Month-wise Purchase Bill Amount</h3>
              <select
                value={pbFy}
                onChange={e => setPbFy(e.target.value)}
                className="bg-slate-800 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-xl border border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="2023-24">FY 2023-24</option>
                <option value="2024-25">FY 2024-25</option>
                <option value="2025-26">FY 2025-26</option>
                <option value="2026-27">FY 2026-27 (Current)</option>
              </select>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Total invoice value purchased per month — FY {pbFy}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-indigo-400">Invoice Value (₹)</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pbMonthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="pbGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}K` : `₹${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                formatter={(value, name) => [formatINR(value), 'Invoice Value']}
                labelFormatter={label => `Month: ${label}`}
              />
              <Bar
                dataKey="amount"
                fill="url(#pbGrad)"
                radius={[6, 6, 0, 0]}
                isAnimationActive
                animationDuration={1400}
                style={{ cursor: 'pointer' }}
                onClick={(data) => {
                  if (data && data.name) {
                    navigate(`/purchase-bills?month=${data.name}&fy=${pbFy}`);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Dynamic Area Trend Chart & Donut Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 reveal-on-scroll">
        {/* Monthly Activity Area Chart */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl hover-elevate">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Monthly Activity Trend</h3>
                <select
                  value={trendFy}
                  onChange={e => setTrendFy(e.target.value)}
                  className="bg-slate-800 text-purple-300 text-xs font-bold px-2.5 py-1 rounded-xl border border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
                >
                  <option value="2023-24">FY 2023-24</option>
                  <option value="2024-25">FY 2024-25</option>
                  <option value="2025-26">FY 2025-26</option>
                  <option value="2026-27">FY 2026-27 (Current)</option>
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Live distribution of JMS entries vs Invoices for FY {trendFy}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" /> JMS Records
              </span>
              <span className="flex items-center gap-1.5 text-pink-400">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" /> Invoices
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorJms" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="jms"
                  name="JMS Records"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorJms)"
                  isAnimationActive
                  animationDuration={1600}
                  animationEasing="ease-out"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/jms?fy=${trendFy}`)}
                />
                <Area
                  type="monotone"
                  dataKey="invoices"
                  name="Invoices"
                  stroke="#ec4899"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorInv)"
                  isAnimationActive
                  animationDuration={1600}
                  animationEasing="ease-out"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/invoices?fy=${trendFy}`)}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Stage Breakdown */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl flex flex-col justify-between hover-elevate">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-white">JMS Details</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                FY {CURRENT_FY}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Stage-wise release & approval breakdown</p>

            <div className="h-44 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive
                    animationDuration={1500}
                    animationEasing="ease-out"
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (data && data.name) {
                        const map = {
                          'Pending A1': 'pending_a1',
                          'Pending A2': 'pending_a2',
                          'Pending QSD': 'pending_qsd',
                          'Pending A3': 'pending_a3',
                          'Released A3': 'released_a3'
                        }
                        const slot = map[data.name] || 'all';
                        navigate(`/jms?fy=${CURRENT_FY}&slot=${slot}`);
                      }
                    }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-white">{totalJmsCount}</span>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Total JMS</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs hover:bg-slate-800/40 p-1 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-medium">{item.name}</span>
                </div>
                <span className="font-extrabold text-white font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
