import { Link, useParams } from 'react-router-dom'
import { FINANCIAL_YEARS, CURRENT_FY } from '../lib/utils'

export default function FyTabs({ basePath }) {
  const { fy } = useParams()
  const activeFy = fy || CURRENT_FY

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl w-fit backdrop-blur-xl shadow-lg flex-wrap">
      <Link
        to={`${basePath}/overall`}
        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
          activeFy === 'overall'
            ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-600/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        Overall FY
      </Link>
      {FINANCIAL_YEARS.map(f => (
        <Link
          key={f}
          to={`${basePath}/${f}`}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
            activeFy === f
              ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          FY {f}
        </Link>
      ))}
    </div>
  )
}
