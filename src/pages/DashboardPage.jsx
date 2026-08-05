import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { jmsDb, invoiceDb, budgetDb } from '../lib/db'
import { formatINR, formatDate, CURRENT_FY, JMS_STATUSES, getFinancialYear } from '../lib/utils'
import { FileText, Receipt, PieChart, Clock, CheckCircle, TrendingUp, Calendar, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function KpiCard({ icon: Icon, label, value, sub, color = 'blue', to }) {
  const colors = {
    blue:   'from-jio-blue-600 to-jio-blue-800 hover:from-jio-blue-500 hover:to-jio-blue-700',
    red:    'from-jio-red-600 to-jio-red-800 hover:from-jio-red-500 hover:to-jio-red-700',
    green:  'from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700',
    amber:  'from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700',
    purple: 'from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700',
    cyan:   'from-cyan-600 to-cyan-800 hover:from-cyan-500 hover:to-cyan-700',
  }

  const CardWrapper = to ? Link : 'div'
  const wrapperProps = to ? { to, className: 'block group' } : {}

  return (
    <CardWrapper {...wrapperProps}>
      <div className="kpi-card animate-fade-in transition-all duration-200 group-hover:border-jio-blue-500/60 group-hover:scale-[1.02] cursor-pointer relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center mb-3 shadow-md`}>
            <Icon size={20} className="text-white" />
          </div>
          {to && <ArrowRight size={16} className="text-slate-500 group-hover:text-jio-blue-400 group-hover:translate-x-0.5 transition-all mb-3" />}
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm font-medium text-slate-300">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </CardWrapper>
  )
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  // Fetch data directly via Supabase DB layer
  const { data: jmsList = [] }     = useQuery({ queryKey: ['jms', 'all'],     queryFn: () => jmsDb.listAll() })
  const { data: invoiceList = [] } = useQuery({ queryKey: ['invoices', 'all'], queryFn: () => invoiceDb.listAll() })
  const { data: budgetList = [] }  = useQuery({ queryKey: ['budget', 'all'],   queryFn: () => budgetDb.listAll() })

  // Helper to determine FY
  const getJmsFy = (r) => {
    const d = r.jms_create_date || r.inv_date || r.a1_release_date || r.created_at
    return d ? getFinancialYear(d) : r.financial_year || CURRENT_FY
  }

  const getInvFy = (r) => {
    return r.inv_date ? getFinancialYear(r.inv_date) : r.financial_year || CURRENT_FY
  }

  // Filter lists strictly for current FY
  const currentJmsList    = jmsList.filter(j => getJmsFy(j) === CURRENT_FY)
  const currentInvList    = invoiceList.filter(i => getInvFy(i) === CURRENT_FY)
  const currentBudgetList = budgetList.filter(b => b.financial_year === CURRENT_FY || !b.financial_year)

  const pendingJms   = currentJmsList.filter(j => !['Released by A3','Invoiced'].includes(j.status)).length
  const a3Released   = currentJmsList.filter(j => j.status === 'Released by A3' || j.status === 'Invoiced' || j.status === 'Pending A3' || j.status === 'A3').length
  const fullPaid     = currentInvList.filter(i => i.payment_status === 'Full Payment Received').length
  const totalInvAmt  = currentInvList.reduce((s, i) => s + (i.grand_total || 0), 0)
  const totalBudget  = currentBudgetList.reduce((s, b) => s + (b.fo_total_budget || 0), 0)
  const totalConsumed= currentBudgetList.reduce((s, b) => s + (b.total_consumed || 0), 0)
  const utilization  = totalBudget > 0 ? Math.round((totalConsumed / totalBudget) * 100) : 0

  // Status distribution for CURRENT_FY
  const statusDist = [
    { name: 'Pending A1', label: 'Pending A1', count: currentJmsList.filter(j => j.status === 'Pending A1' || j.status === 'Pending' || j.status === 'A1').length },
    { name: 'Pending A2', label: 'Pending A2', count: currentJmsList.filter(j => j.status === 'Pending A2' || j.status === 'A2').length },
    { name: 'Pending QSD', label: 'Pending QSD', count: currentJmsList.filter(j => j.status === 'Pending QSD' || j.status === 'QSD').length },
    { name: 'Pending A3', label: 'Pending A3', count: currentJmsList.filter(j => j.status === 'Pending A3' || j.status === 'A3').length },
    { name: 'Released by A3', label: 'Released', count: currentJmsList.filter(j => j.status === 'Released by A3' || j.status === 'Invoiced').length },
  ]

  const BAR_COLORS = ['#f59e0b','#a855f7','#06b6d4','#3b82f6','#10b981']

  // Latest 8 JMS records for CURRENT_FY
  const recentJms = [...currentJmsList].sort((a, b) => {
    const da = a.jms_create_date || a.inv_date || a.a1_release_date || a.created_at || ''
    const db = b.jms_create_date || b.inv_date || b.a1_release_date || b.created_at || ''
    return db.localeCompare(da)
  }).slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Page title with current FY badge */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
            {isAdmin && <span className="ml-2 badge badge-a3">Admin</span>}
          </p>
        </div>
        {/* Current FY indicator */}
        <div className="flex items-center gap-2 px-4 py-2 glass-card">
          <Calendar size={15} className="text-jio-blue-400" />
          <span className="text-sm font-semibold text-white">FY {CURRENT_FY}</span>
          <span className="text-xs text-slate-400">(Current)</span>
        </div>
      </div>

      {/* KPI Grid - CURRENT FY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={FileText}    label="Total JMS"        value={currentJmsList.length} sub={`FY ${CURRENT_FY}`}   color="blue"   to={`/jms/${CURRENT_FY}`} />
        <KpiCard icon={Clock}       label="Pending Approval" value={pendingJms}           sub="Pending A1/A2/QSD/A3"  color="amber"  to={`/jms/${CURRENT_FY}`} />
        <KpiCard icon={CheckCircle} label="Released by A3"   value={a3Released}           sub="Ready to invoice"     color="green"  to={`/jms/${CURRENT_FY}`} />
        <KpiCard icon={Receipt}     label="Invoices"         value={currentInvList.length} sub={`Paid: ${fullPaid}`}  color="cyan"   to={`/invoices/${CURRENT_FY}`} />
        <KpiCard icon={TrendingUp}  label="Invoice Value"    value={formatINR(totalInvAmt)} sub={`FY ${CURRENT_FY}`} color="purple" to={`/invoices/${CURRENT_FY}`} />
        <KpiCard icon={PieChart}    label="Budget Used"      value={`${utilization}%`}   sub={formatINR(totalConsumed)} color="red" to={`/budget/${CURRENT_FY}`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* JMS Status distribution */}
        <div className="glass-card p-5 cursor-pointer hover:border-jio-blue-500/50 transition-all" onClick={() => navigate(`/jms/${CURRENT_FY}`)}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">JMS Approval Status Distribution</h2>
              <p className="text-xs text-slate-500">FY {CURRENT_FY} counts across all stages (Click to view JMS)</p>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusDist} barSize={32}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 13 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="count" radius={[6,6,0,0]}>
                {statusDist.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Utilization */}
        <div className="glass-card p-5 cursor-pointer hover:border-jio-blue-500/50 transition-all" onClick={() => navigate(`/budget/${CURRENT_FY}`)}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Budget Utilization (FY {CURRENT_FY})</h2>
              <p className="text-xs text-slate-500">Current financial year work orders (Click to view Budget)</p>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Budget</span>
              <span className="text-white font-semibold">{formatINR(totalBudget)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Consumed</span>
              <span className="text-jio-red-400 font-semibold">{formatINR(totalConsumed)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Available</span>
              <span className="text-emerald-400 font-semibold">{formatINR(totalBudget - totalConsumed)}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Utilization</span><span>{utilization}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(utilization, 100)}%`,
                    background: utilization > 85
                      ? 'linear-gradient(90deg,#E30613,#88040b)'
                      : utilization > 60
                        ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                        : 'linear-gradient(90deg,#0052A5,#003163)',
                  }}
                />
              </div>
            </div>
          </div>

          {currentBudgetList.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Work Orders (FY {CURRENT_FY})</p>
              {currentBudgetList.slice(0, 4).map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs hover:text-jio-blue-400">
                  <span className="text-slate-400 truncate max-w-[60%]">{b.work_order_number || 'N/A'}</span>
                  <span className="text-white font-medium">{formatINR(b.total_consumed)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent JMS Table - Clickable Rows to navigate to JMS Details */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent JMS Records</h2>
            <p className="text-xs text-slate-500">Latest entries across all financial years (Click any row to open JMS page)</p>
          </div>
          <Link to="/jms" className="text-xs text-jio-blue-400 hover:text-jio-blue-300 font-semibold flex items-center gap-1">
            View All JMS <ArrowRight size={13} />
          </Link>
        </div>

        {recentJms.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p>No JMS records found</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>JMS No</th><th>Work Order</th><th>JMS Date</th><th>Net Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentJms.map(j => (
                  <tr key={j.id} className="cursor-pointer hover:bg-slate-800/80 transition-colors" onClick={() => navigate('/jms')}>
                    <td className="text-white font-medium">{j.jms_no}</td>
                    <td>{j.work_order_number || '—'}</td>
                    <td>{formatDate(j.jms_create_date || j.inv_date || j.a1_release_date)}</td>
                    <td className="font-medium text-emerald-400">{formatINR(j.net_amount)}</td>
                    <td><span className="badge badge-pending">{j.status || 'Pending A1'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

