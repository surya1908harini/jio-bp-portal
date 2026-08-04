import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { formatINR, CURRENT_FY, FINANCIAL_YEARS } from '../lib/utils'
import { FileText, Receipt, PieChart, Clock, CheckCircle, TrendingUp, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'from-jio-blue-600 to-jio-blue-800',
    red:    'from-jio-red-600 to-jio-red-800',
    green:  'from-emerald-600 to-emerald-800',
    amber:  'from-amber-600 to-amber-800',
    purple: 'from-purple-600 to-purple-800',
    cyan:   'from-cyan-600 to-cyan-800',
  }
  return (
    <div className="kpi-card animate-fade-in">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm font-medium text-slate-300">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()

  // Use auto-detected current FY
  const { data: jmsData }     = useQuery({ queryKey: ['jms-summary',    CURRENT_FY], queryFn: () => api.get(`/api/jms?fy=${CURRENT_FY}`).then(r => r.data) })
  const { data: invoiceData } = useQuery({ queryKey: ['invoice-summary',CURRENT_FY], queryFn: () => api.get(`/api/invoices?fy=${CURRENT_FY}`).then(r => r.data) })
  const { data: budgetData }  = useQuery({ queryKey: ['budget-summary', CURRENT_FY], queryFn: () => api.get(`/api/budget?fy=${CURRENT_FY}`).then(r => r.data) })

  const jmsList     = jmsData?.data     ?? []
  const invoiceList = invoiceData?.data ?? []
  const budgetList  = budgetData?.data  ?? []

  const pendingJms   = jmsList.filter(j => !['A3','Invoiced'].includes(j.status)).length
  const a3Released   = jmsList.filter(j => j.status === 'A3').length
  const fullPaid     = invoiceList.filter(i => i.payment_status === 'Full Payment Received').length
  const totalInvAmt  = invoiceList.reduce((s, i) => s + (i.grand_total || 0), 0)
  const totalBudget  = budgetList.reduce((s, b) => s + (b.fo_total_budget || 0), 0)
  const totalConsumed= budgetList.reduce((s, b) => s + (b.total_consumed || 0), 0)
  const utilization  = totalBudget > 0 ? Math.round((totalConsumed / totalBudget) * 100) : 0

  const statusDist = ['Pending','A1','A2','QSD','A3','Invoiced'].map(s => ({
    name: s,
    count: jmsList.filter(j => j.status === s).length,
  }))

  const BAR_COLORS = ['#f59e0b','#3b82f6','#6366f1','#a855f7','#10b981','#06b6d4']

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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={FileText}    label="Total JMS"        value={jmsList.length}      sub={`FY ${CURRENT_FY}`}   color="blue"   />
        <KpiCard icon={Clock}       label="Pending Approval" value={pendingJms}           sub="Awaiting stages"      color="amber"  />
        <KpiCard icon={CheckCircle} label="A3 Released"      value={a3Released}           sub="Ready to invoice"     color="green"  />
        <KpiCard icon={Receipt}     label="Invoices"         value={invoiceList.length}   sub={`Paid: ${fullPaid}`}  color="cyan"   />
        <KpiCard icon={TrendingUp}  label="Invoice Value"    value={formatINR(totalInvAmt)} sub="Grand total"        color="purple" />
        <KpiCard icon={PieChart}    label="Budget Used"      value={`${utilization}%`}   sub={formatINR(totalConsumed)} color="red" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* JMS Status distribution */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-1">JMS Approval Status</h2>
          <p className="text-xs text-slate-500 mb-4">Distribution for FY {CURRENT_FY}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusDist} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
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
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Budget Utilization</h2>
          <p className="text-xs text-slate-500 mb-4">FY {CURRENT_FY} across all work orders</p>
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

          {budgetList.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Work Orders</p>
              {budgetList.slice(0, 4).map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[60%]">{b.work_order_number || 'N/A'}</span>
                  <span className="text-white font-medium">{formatINR(b.total_consumed)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent JMS */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Recent JMS Records</h2>
        <p className="text-xs text-slate-500 mb-4">Latest entries for FY {CURRENT_FY}</p>
        {jmsList.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p>No JMS records yet for FY {CURRENT_FY}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>JMS No</th><th>Work Order</th><th>Site</th><th>Net Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {jmsList.slice(0, 8).map(j => (
                  <tr key={j.id}>
                    <td className="text-white font-medium">{j.jms_no}</td>
                    <td>{j.work_order_number || '—'}</td>
                    <td>{j.site || '—'}</td>
                    <td className="font-medium text-emerald-400">{formatINR(j.net_amount)}</td>
                    <td><span className={`badge badge-${j.status?.toLowerCase() || 'pending'}`}>{j.status || 'Pending'}</span></td>
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
