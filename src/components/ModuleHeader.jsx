import { Link, useLocation } from 'react-router-dom'
import { Calendar, FileText, Receipt, PieChart as PieChartIcon, Settings, Sparkles } from 'lucide-react'
import { CURRENT_FY } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

export default function ModuleHeader({
  title,
  subtitle,
  actions,
  stats = []
}) {
  const { isAdmin } = useAuth()

  const statColors = {
    purple: 'bg-purple-600 text-white shadow-purple-600/30',
    green:  'bg-emerald-500 text-white shadow-emerald-500/30',
    amber:  'bg-amber-500 text-white shadow-amber-500/30',
    red:    'bg-rose-500 text-white shadow-rose-500/30',
    cyan:   'bg-cyan-600 text-white shadow-cyan-600/30',
    blue:   'bg-blue-600 text-white shadow-blue-600/30',
  }

  return (
    <div className="space-y-5">
      {/* ── Top Hero Gradient Banner (Matches Dashboard Theme 100%) ── */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/mmc_logo.jpg" alt="MMC Logo" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/40 shadow-xl" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">{title}</h1>
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white border border-white/30 backdrop-blur-md">
                  {isAdmin ? 'MMC Admin' : 'User Portal'}
                </span>
              </div>
              <p className="text-xs text-purple-100 mt-1 font-medium">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-md text-xs font-semibold">
              <Calendar size={14} />
              <span>FY {CURRENT_FY}</span>
            </div>
            {actions}
          </div>
        </div>
      </div>

      {/* ── 4 Executive Stat Cards Grid ──────────────────────────── */}
      {stats.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} gap-4`}>
          {stats.map((st, i) => {
            const Icon = st.icon
            return (
              <div
                key={i}
                className="rounded-3xl border border-purple-100/80 bg-white dark:bg-slate-900/70 p-4 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{st.label}</span>
                  <div className={`w-9 h-9 rounded-2xl ${statColors[st.color || 'purple']} flex items-center justify-center shadow-md`}>
                    <Icon size={18} />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{st.value}</p>
                {st.sub && <p className="text-[11px] font-medium text-slate-400 mt-1">{st.sub}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
