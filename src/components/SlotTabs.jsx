import { Link, useLocation } from 'react-router-dom'
import { FINANCIAL_YEARS } from '../lib/utils'

export default function SlotTabs({ slots, active, setActive }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-900 rounded-xl w-fit">
      {slots.map(s => (
        <button
          key={s.key}
          onClick={() => setActive(s.key)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            active === s.key ? 'bg-jio-blue-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
