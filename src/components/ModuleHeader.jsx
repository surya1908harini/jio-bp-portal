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
    orange: 'bg-orange-600/20 text-orange-300 border-orange-600/40',
    green:  'bg-emerald-600/20 text-emerald-300 border-emerald-600/40',
    amber:  'bg-amber-500/20 text-amber-300 border-amber-500/40',
    red:    'bg-rose-500/20 text-rose-300 border-rose-500/40',
    cyan:   'bg-cyan-600/20 text-cyan-300 border-cyan-600/40',
    blue:   'bg-blue-600/20 text-blue-300 border-blue-600/40',
    rose:   'bg-rose-600/20 text-rose-300 border-rose-600/40',
    emerald:'bg-emerald-600/20 text-emerald-300 border-emerald-600/40',
  }

  return (
    <div className="mb-4">
      {/* Row 1: Action buttons & Title override if needed (handled by Layout now) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            {subtitle && <p className="text-xs text-gray-500 dark:text-white dark:text-white font-medium truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0 ml-auto">
          {actions}
        </div>
      </div>

      {/* Row 2: Stat chips (compact inline) */}
      {stats.length > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {stats.map((st, i) => {
            const Icon = st.icon
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e2d] shadow-sm text-[11px] font-semibold text-gray-700 dark:text-white"
              >
                <Icon size={14} className="text-brand-accent" />
                <span className="text-gray-500 dark:text-white dark:text-white">{st.label}:</span>
                <span className="font-extrabold text-gray-900 dark:text-white">{st.value}</span>
                {st.sub && <span className="text-gray-400 dark:text-white hidden sm:inline text-[10px]">· {st.sub}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
