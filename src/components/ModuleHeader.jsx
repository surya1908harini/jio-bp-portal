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
      {/* ── Top Hero Gradient Banner (With Floating Decorative Elements) ── */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-6 text-white shadow-2xl relative overflow-hidden scroll-reveal">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none animate-float-slow" />
        <div className="absolute right-32 top-3 w-16 h-16 bg-white/10 rounded-full blur-lg pointer-events-none animate-float" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <img src="/mmc_logo.jpg" alt="MMC Logo" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/40 shadow-xl animate-float" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">{title}</h1>
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white border border-white/30 backdrop-blur-md animate-pulse-glow">
                  {isAdmin ? 'MMC Admin' : 'User Portal'}
                </span>
              </div>
              <p className="text-xs text-purple-100 mt-1 font-medium">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-md text-xs font-semibold shadow-sm">
              <Calendar size={14} className="animate-float" />
              <span>FY {CURRENT_FY}</span>
            </div>
            {actions}
          </div>
        </div>
      </div>

      {/* ── 4 Executive Stat Cards Grid with Card Elevation ──────────────────────────── */}
      {stats.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} gap-4 scroll-reveal`}>
          {stats.map((st, i) => {
            const Icon = st.icon
            return (
              <div
                key={i}
                className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xl shadow-xl card-elevation flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{st.label}</span>
                  <div className={`p-2 rounded-2xl shadow-lg ${statColors[st.color || 'purple']} animate-float`}>
                    <Icon size={16} />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white tracking-tight leading-none my-1">{st.value}</p>
                  <p className="text-[11px] text-slate-400 font-medium truncate mt-1">{st.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
