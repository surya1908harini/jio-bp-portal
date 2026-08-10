import { Calendar } from 'lucide-react'

export const MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
]

export default function MonthTabs({ activeMonth, onChange }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1.5 scrollbar-thin">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-400 shrink-0 shadow-sm">
        <Calendar size={13} className="text-purple-400" />
        <span>Filter Month:</span>
      </div>
      <div className="flex items-center gap-1.5">
        {MONTHS.map(m => {
          const isActive = String(activeMonth) === String(m.value)
          return (
            <button
              key={m.value}
              onClick={() => onChange(m.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 font-bold scale-105 border border-purple-400/30'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
