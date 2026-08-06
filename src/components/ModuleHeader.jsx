import { Link, useLocation } from 'react-router-dom'
import { Calendar, Layers, FileText, Receipt, PieChart as PieChartIcon, Settings } from 'lucide-react'
import { CURRENT_FY } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

export default function ModuleHeader({
  title,
  subtitle,
  actions,
  stats = []
}) {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const tabs = [
    { id: 'dashboard', label: 'Overview', path: '/dashboard', icon: Layers },
    { id: 'jms', label: 'JMS Details', path: '/jms', icon: FileText },
    { id: 'invoices', label: 'Invoices', path: '/invoices', icon: Receipt },
    { id: 'budget', label: 'Budget Status', path: '/budget', icon: PieChartIcon },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', path: '/admin', icon: Settings }] : []),
  ]

  const statColors = {
    purple: 'bg-indigo-600 shadow-indigo-600/30',
    green:  'bg-emerald-600 shadow-emerald-600/30',
    amber:  'bg-amber-500 shadow-amber-500/30',
    red:    'bg-rose-600 shadow-rose-600/30',
    cyan:   'bg-cyan-600 shadow-cyan-600/30',
    blue:   'bg-blue-600 shadow-blue-600/30',
  }

  return (
    <div className="space-y-5">
      {/* ── Top Header Banner ─────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/mmc_logo.jpg" alt="MMC Logo" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-lg" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950/90 text-indigo-300 border border-indigo-700/60">
                  {isAdmin ? 'MMC Admin' : 'User Portal'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
              <Calendar size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-white">FY {CURRENT_FY}</span>
            </div>
            {actions}
          </div>
        </div>
      </div>

      {/* ── 4 Executive Stat Cards Grid (if provided) ──────────── */}
      {stats.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} gap-4`}>
          {stats.map((st, i) => {
            const Icon = st.icon
            return (
              <div
                key={i}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl shadow-lg hover:border-slate-700 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">{st.label}</span>
                  <div className={`w-8 h-8 rounded-full ${statColors[st.color || 'purple']} flex items-center justify-center text-white shadow-md`}>
                    <Icon size={16} />
                  </div>
                </div>
                <p className="text-xl font-extrabold text-white tracking-tight">{st.value}</p>
                {st.sub && <p className="text-[11px] text-slate-500 mt-1">{st.sub}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
