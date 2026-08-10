import { Calendar } from 'lucide-react'
import { CURRENT_FY } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

export default function ModuleHeader({
  title,
  subtitle,
  actions,
  stats = []
}) {
  const { isAdmin } = useAuth()

  const chipColors = {
    purple: 'bg-purple-600/20 text-purple-300 border-purple-600/40',
    green:  'bg-emerald-600/20 text-emerald-300 border-emerald-600/40',
    amber:  'bg-amber-500/20 text-amber-300 border-amber-500/40',
    red:    'bg-rose-500/20 text-rose-300 border-rose-500/40',
    cyan:   'bg-cyan-600/20 text-cyan-300 border-cyan-600/40',
    blue:   'bg-blue-600/20 text-blue-300 border-blue-600/40',
    rose:   'bg-rose-600/20 text-rose-300 border-rose-600/40',
    emerald:'bg-emerald-600/20 text-emerald-300 border-emerald-600/40',
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-600 px-4 py-2.5 text-white shadow-lg relative overflow-hidden">
      <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      {/* Row 1: Title + FY badge + Action buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/mmc_logo.jpg" alt="MMC" className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/40 shadow shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-extrabold text-white tracking-tight leading-tight truncate">{title}</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white/20 text-white border border-white/30 shrink-0">
                {isAdmin ? 'MMC Admin' : 'User'}
              </span>
            </div>
            {subtitle && <p className="text-[10px] text-purple-100 font-medium truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-semibold">
            <Calendar size={11} />
            <span>FY {CURRENT_FY}</span>
          </div>
          {actions}
        </div>
      </div>

      {/* Row 2: Stat chips (compact inline) */}
      {stats.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap relative z-10">
          {stats.map((st, i) => {
            const Icon = st.icon
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-semibold ${chipColors[st.color || 'purple']} bg-black/20 backdrop-blur-sm`}
              >
                <Icon size={11} />
                <span className="text-white/70">{st.label}:</span>
                <span className="font-extrabold text-white">{st.value}</span>
                {st.sub && <span className="text-white/50 hidden sm:inline">· {st.sub}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
